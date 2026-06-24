from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from .state import AgentState
from .tools import (
    search_knowledge, validate_address, check_availability,
    save_record, get_records, analyze_stats, get_customer_history
)


class Evaluation(BaseModel):
    is_valid: bool = Field(description="True if the response is correct and complete.")
    feedback: str = Field(description="Specific instructions on what is missing or needs to be fixed.")


# Tool groups — composed per business capabilities
_BASE_TOOLS = [search_knowledge, get_records, get_customer_history]
_ORDER_TOOLS = [save_record, analyze_stats]
_BOOKING_TOOLS = [check_availability, save_record]
_DELIVERY_TOOLS = [validate_address]


def _select_tools(has_orders: bool, has_bookings: bool, has_delivery: bool) -> list:
    seen = set()
    tools = []
    for t in _BASE_TOOLS:
        if t.name not in seen:
            tools.append(t)
            seen.add(t.name)
    if has_orders:
        for t in _ORDER_TOOLS:
            if t.name not in seen:
                tools.append(t)
                seen.add(t.name)
    if has_bookings:
        for t in _BOOKING_TOOLS:
            if t.name not in seen:
                tools.append(t)
                seen.add(t.name)
    if has_delivery:
        for t in _DELIVERY_TOOLS:
            if t.name not in seen:
                tools.append(t)
                seen.add(t.name)
    return tools


def _build_schema_section(profile: dict) -> str:
    """Build a schema description the agent can use to call tools correctly."""
    tables = profile.get("dynamic_tables") or []
    if not tables:
        return "No database tables configured yet."

    lines = ["DATABASE SCHEMA — use these exact table and column names in your tool calls:"]
    for t in tables:
        cols = ", ".join(
            f"{c['name']} ({c['type']})"
            for c in t.get("columns", [])
        )
        lines.append(f"\nTable: {t['table_name']}")
        lines.append(f"  Purpose: {t.get('purpose', 'Business data')}")
        lines.append(f"  Columns: session_id (TEXT), {cols}, created_at")
    return "\n".join(lines)


def _build_system_prompt(profile: dict, feedback: str = "") -> SystemMessage:
    capabilities = profile.get("capabilities") or {}
    rules_text = "\n".join(
        f"- {r['category']}: {r['rule_details']}"
        for r in (profile.get('config') or [])
        if isinstance(r, dict)
    )
    schema_section = _build_schema_section(profile)

    tool_instructions = [
        "KNOWLEDGE FIRST: Use 'search_knowledge' to answer any question about services, menu, prices, or hours.",
        "RETURNING CUSTOMERS: When a customer gives their phone number, call 'get_customer_history' immediately.",
        "READING DATA: Use 'get_records' to look up existing orders, bookings, or customer data.",
    ]

    if capabilities.get('has_orders'):
        tool_instructions.append(
            "ORDERS: Use 'analyze_stats' at the start of an order to suggest popular items. "
            "When an order is ready, use 'save_record' to write it to the correct table."
        )
    if capabilities.get('has_bookings'):
        tool_instructions.append(
            "BOOKINGS: You MUST call 'check_availability' before saving any booking. "
            "Never confirm an appointment without verifying availability first. "
            "Collect a specific Date and Time before checking."
        )
    if capabilities.get('has_delivery'):
        tool_instructions.append(
            "DELIVERY: Collect the delivery address and call 'validate_address' to verify it before saving the order."
        )

    tool_section = "\n".join(f"{i+1}. {inst}" for i, inst in enumerate(tool_instructions))

    feedback_section = (
        f"\n\nCRITICAL CORRECTION — your last response was rejected:\n{feedback}"
        if feedback else ""
    )

    return SystemMessage(content=f"""You are a professional AI assistant for '{profile.get('name', 'a small business')}'.
Business Type: {profile.get('type', 'Unknown')}
Description: {profile.get('description', '')}

BUSINESS RULES:
{rules_text}

{schema_section}

TOOL USAGE:
{tool_section}

ALWAYS collect the customer's Name and Phone Number before saving any record.{feedback_section}""")


def _build_critic_prompt(profile: dict, user_query: str, last_msg: str, tools_called: list) -> str:
    capabilities = profile.get("capabilities") or {}

    criteria = [
        "INFO REQUESTS: If the user asks for information only, the response is VALID if it answers the question. Do NOT require Name/Phone for info-only queries.",
        "CUSTOMER INFO: Name and Phone are REQUIRED before any record is saved.",
        "TOOL USE: The agent must use 'save_record' (not describe) to actually save data.",
    ]
    if capabilities.get('has_orders'):
        criteria.append("UPSELLING: Suggest a popular item when the user is ordering.")
    if capabilities.get('has_bookings'):
        criteria.append(
            "BOOKING SAFETY: 'check_availability' MUST be called before 'save_record' for any booking. "
            "Confirming without checking is INVALID."
        )
    if capabilities.get('has_delivery'):
        criteria.append("DELIVERY: 'validate_address' must be called before saving a delivery order.")

    criteria_text = "\n".join(f"- {c}" for c in criteria)

    return f"""Evaluate whether the assistant's response is correct and complete.

User Query: {user_query}
Assistant Response: {last_msg}
Tools Called: {', '.join(tools_called) if tools_called else 'None'}

Criteria:
{criteria_text}

Is this response valid? If not, give specific instructions for exactly what must be fixed."""


def _compile_graph(has_orders: bool, has_bookings: bool, has_delivery: bool):
    tools = _select_tools(has_orders, has_bookings, has_delivery)
    tool_node = ToolNode(tools)

    llm = ChatGroq(model="meta-llama/llama-4-scout-17b-16e-instruct", temperature=0)
    fallback_llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)
    model = llm.bind_tools(tools)
    fallback_model = fallback_llm.bind_tools(tools)
    critic_model = llm.with_structured_output(Evaluation)

    def call_model(state: AgentState):
        from groq import BadRequestError
        profile = state.get("business_profile", {})
        feedback = state.get("critic_feedback", "")
        system_msg = _build_system_prompt(profile, feedback)
        messages = [system_msg] + list(state["messages"])
        try:
            response = model.invoke(messages)
        except BadRequestError as e:
            if "tool_use_failed" in str(e):
                # Groq malformed tool call — retry with fallback model
                try:
                    response = fallback_model.invoke(messages)
                except Exception:
                    from langchain_core.messages import AIMessage
                    response = AIMessage(content="I'm sorry, I had trouble processing that. Could you rephrase your question?")
            else:
                raise
        return {"messages": [response], "critic_feedback": ""}

    def critic_node(state: AgentState):
        profile = state.get("business_profile", {})
        current_retries = state.get("retry_count", 0)
        last_msg = state["messages"][-1].content

        user_query = ""
        for m in reversed(state["messages"]):
            if isinstance(m, HumanMessage):
                user_query = m.content
                break

        tools_called = [
            tc['name']
            for m in state["messages"]
            if hasattr(m, "tool_calls") and m.tool_calls
            for tc in m.tool_calls
        ]

        prompt = _build_critic_prompt(profile, user_query, last_msg, tools_called)
        result = critic_model.invoke(prompt)

        if not result.is_valid and current_retries < 1:
            return {"critic_feedback": result.feedback, "retry_count": current_retries + 1}
        return {"critic_feedback": "", "retry_count": 0}

    def should_continue(state: AgentState):
        return "tools" if state["messages"][-1].tool_calls else END

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", tool_node)
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", should_continue)
    workflow.add_edge("tools", "agent")
    return workflow.compile()


_graph_cache: dict = {}


def get_graph(capabilities: dict):
    """Return a compiled graph for the given capability set. Cached per unique combination."""
    key = (
        bool(capabilities.get('has_orders', True)),
        bool(capabilities.get('has_bookings', True)),
        bool(capabilities.get('has_delivery', False)),
    )
    if key not in _graph_cache:
        print(f"Compiling graph: orders={key[0]}, bookings={key[1]}, delivery={key[2]}")
        _graph_cache[key] = _compile_graph(*key)
    return _graph_cache[key]
