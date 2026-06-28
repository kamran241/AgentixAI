import re
import json
import time as _time
from langchain_groq import ChatGroq
from langchain_core.messages import HumanMessage, AIMessage, SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from .state import AgentState
from .tools import (
    search_knowledge, validate_address, check_availability,
    save_record, get_records, analyze_stats, get_customer_history,
    get_available_slots, cancel_booking,
)


class Evaluation(BaseModel):
    # str instead of bool — Groq LLM outputs "false"/"true" strings and fails
    # boolean schema validation. We coerce manually in critic_node.
    is_valid: str = Field(description="Set to 'true' if the response is correct and complete, or 'false' if it needs correction.")
    feedback: str = Field(description="Specific instructions on what is missing or needs to be fixed.")


# Tool groups — composed per business capabilities
_BASE_TOOLS = [search_knowledge, get_records, get_customer_history]
_ORDER_TOOLS = [save_record, analyze_stats]
_BOOKING_TOOLS = [get_available_slots, check_availability, save_record, cancel_booking]
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

    # Build availability section
    availability = profile.get("availability") or {}
    if isinstance(availability, str):
        import json as _json
        try:
            availability = _json.loads(availability)
        except Exception:
            availability = {}
    schedule = availability.get("schedule") or {}
    avail_lines = []
    if schedule:
        avail_lines.append("BUSINESS HOURS (the booking schedule set by the owner):")
        for day in ["monday","tuesday","wednesday","thursday","friday","saturday","sunday"]:
            day_cfg = schedule.get(day, {})
            if day_cfg.get("open"):
                avail_lines.append(f"  {day.capitalize()}: {day_cfg.get('start','09:00')} – {day_cfg.get('end','17:00')}")
            else:
                avail_lines.append(f"  {day.capitalize()}: CLOSED")
        slot_min = availability.get("slot_duration", 30)
        buffer   = availability.get("buffer_minutes", 0)
        avail_lines.append(f"  Slot duration: {slot_min} minutes" + (f", {buffer} min buffer between slots" if buffer else ""))
        blocked = availability.get("blocked_dates") or []
        if blocked:
            avail_lines.append(f"  Blocked/holiday dates: {', '.join(blocked)}")
    avail_section = "\n".join(avail_lines)

    # Must be defined before tool_instructions block
    upcoming_slots = profile.get("upcoming_slots") or []

    tool_instructions = [
        "KNOWLEDGE FIRST: Use 'search_knowledge' to answer any question about services, menu, prices, or hours.",
        "RETURNING CUSTOMERS: When a customer gives their phone number, call 'get_customer_history' immediately.",
        "READING DATA: Use 'get_records' to look up existing orders, bookings, or customer data.",
    ]

    if capabilities.get('has_orders'):
        tool_instructions.append(
            "ORDERS — follow this exact flow every time:\n"
            "  1. Ask what item(s) they want and any customizations\n"
            "  2. Confirm item, size, customization, and total price\n"
            "  3. Collect: Full Name, Phone Number, Email Address — if the customer skips any of these, ask again. Do NOT proceed.\n"
            "  4. Read back the complete order for CONFIRMATION\n"
            "  5. Only after customer says yes/confirms → call save_record(always_insert=True)\n"
            "  HARD RULE: If you cannot find the customer's real Name, Phone, AND Email in this conversation, you MUST ask for them before calling save_record. No exceptions.\n"
            "  NEVER use placeholder values like 'John Doe', 'your_name', or '1234567890'."
        )
    if capabilities.get('has_bookings'):
        slots_note = (
            "The REAL-TIME AVAILABILITY block above lists free slots for the next 7 days — use those directly. "
            "For dates beyond 7 days call get_available_slots(date) first."
            if upcoming_slots else
            "Call get_available_slots(date) first to get genuine free slots — NEVER invent times."
        )
        tool_instructions.append(
            f"BOOKINGS — follow this exact flow every time:\n"
            f"  1. Ask what SERVICE/TYPE of appointment they need (e.g. Check-up, Cleaning, etc.).\n"
            f"  2. Ask for their preferred DATE. {slots_note}\n"
            f"  3. Show available slots for that date and let the customer CHOOSE one.\n"
            f"  4. In ONE single message ask for ALL THREE: Full Name, Phone Number, AND Email Address together. Example: 'To confirm your booking, could I get your full name, phone number, and email address?'. Do NOT ask for them one at a time.\n"
            f"  5. Read back ALL details for CONFIRMATION in one message: service, date/time, name, phone, email.\n"
            f"  6. When the customer says yes/confirms — call save_record(always_insert=True) RIGHT NOW in this very response. Do NOT say 'I will save' or 'I'll book now' — just call the tool immediately. After the tool returns success, tell the customer their booking is confirmed.\n"
            f"  HARD RULE: Step 4 is MANDATORY — all three fields in ONE ask. If Name, Phone, or Email is missing, ask for the missing ones together in one message. Do NOT call save_record until you have all three.\n"
            f"  HARD RULE: NEVER narrate that you are about to save. The tool call IS the save.\n"
            f"  NEVER use placeholder values like 'John Doe', 'session123', or '1234567890'.\n"
            f"  RESCHEDULE — follow these steps:\n"
            f"    a. Call get_records to find the customer's existing booking and note its 'id'.\n"
            f"    b. Call get_available_slots for the new preferred date.\n"
            f"    c. Let the customer choose a new slot and confirm ALL details.\n"
            f"    d. Call cancel_booking(table_name, booking_id) to delete the old slot.\n"
            f"    e. Call save_record(always_insert=True) to create the new booking.\n"
            f"  Do NOT create the new booking before cancelling the old one — this would double-book the customer."
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

    # Language instruction
    _LANGUAGE_NAMES = {
        "auto":    None,
        "en":      "English",
        "ur":      "Urdu",
        "ar":      "Arabic",
        "fr":      "French",
        "es":      "Spanish",
        "de":      "German",
        "zh":      "Chinese (Simplified)",
        "hi":      "Hindi",
        "pt":      "Portuguese",
        "tr":      "Turkish",
        "ru":      "Russian",
        "id":      "Indonesian",
        "bn":      "Bengali",
    }
    widget_cfg  = profile.get("widget_config") or {}
    lang_code   = widget_cfg.get("language", "auto")
    lang_name   = _LANGUAGE_NAMES.get(lang_code)

    if lang_name:
        language_rule = (
            f"\n\nLANGUAGE RULE: You MUST respond ONLY in {lang_name}. "
            f"Even if the customer writes in another language, always reply in {lang_name}. "
            f"Booking confirmations, questions, and all messages must be in {lang_name}."
        )
    else:
        language_rule = (
            "\n\nLANGUAGE RULE: Detect the language the customer is writing in and always reply in that same language. "
            "If the customer writes in Urdu, reply in Urdu. If in Arabic, reply in Arabic. "
            "Match the customer's language exactly in every message."
        )

    custom_prompt = (profile.get("custom_prompt") or "").strip()

    if custom_prompt:
        intro = f"""{custom_prompt}

---
Business: {profile.get('name', 'a small business')} | Type: {profile.get('type', 'Unknown')}"""
    else:
        intro = f"""You are a professional AI assistant for '{profile.get('name', 'a small business')}'.
Business Type: {profile.get('type', 'Unknown')}
Description: {profile.get('description', '')}"""

    # Build upcoming slots section (pre-computed, always accurate)
    upcoming_slots = profile.get("upcoming_slots") or []
    slots_lines = []
    if upcoming_slots:
        slots_lines.append("REAL-TIME AVAILABILITY — next 7 days (pre-fetched, 100% accurate):")
        for day_info in upcoming_slots:
            if not day_info.get("open"):
                reason = day_info.get("reason", "closed")
                slots_lines.append(f"  {day_info['date']} ({day_info['day']}): {reason.upper()}")
            else:
                free = day_info.get("free_slots", [])
                booked = day_info.get("booked_slots", [])
                hours = day_info.get("open_hours", "")
                if free:
                    slots_lines.append(
                        f"  {day_info['date']} ({day_info['day']}) {hours}: "
                        f"FREE → {', '.join(free)}"
                        + (f" | BOOKED → {', '.join(booked)}" if booked else "")
                    )
                else:
                    slots_lines.append(
                        f"  {day_info['date']} ({day_info['day']}) {hours}: FULLY BOOKED"
                        + (f" (booked: {', '.join(booked)})" if booked else "")
                    )
        slots_lines.append(
            "  ↑ Use ONLY these slots when booking. "
            "For dates beyond 7 days call get_available_slots(date)."
        )
    slots_section = "\n".join(slots_lines)

    avail_block = f"\n{avail_section}\n" if avail_section else ""

    slots_block = f"\n{slots_section}\n" if slots_section else ""

    return SystemMessage(content=f"""{intro}

BUSINESS RULES:
{rules_text}
{avail_block}{slots_block}
{schema_section}

TOOL USAGE:
{tool_section}

ALWAYS collect Name, Phone Number, and Email Address before saving any booking or order record.

CUSTOMER DATA RULE: Accept the name, phone, and email EXACTLY as the customer provides them. NEVER ask the customer to re-confirm their email or phone because it "looks unusual" or might be a typo. Trust what the customer types and move forward.

CRITICAL — TOOL CALLS: You have real tools. NEVER write tool or function calls in your response text. Do NOT output <function=...>, <tool_call>, or raw JSON blocks. Invoke tools silently through the API only.

RESPONSE STYLE: Be concise and conversational. Answer in 1-3 sentences. Only list details when the customer specifically asks.{language_rule}{feedback_section}""")


def _build_critic_prompt(profile: dict, user_query: str, last_msg: str, tools_called: list, conversation_transcript: str = "") -> str:
    capabilities = profile.get("capabilities") or {}

    criteria = [
        "INFO REQUESTS: If the user asks for information only, the response is VALID if it answers the question. Do NOT require customer info for info-only queries.",
        "CUSTOMER INFO: Name, Phone AND Email are ALL REQUIRED before any record is saved.",
        "TOOL USE: The agent must use 'save_record' (not just describe) to actually save data.",
    ]
    if capabilities.get('has_orders'):
        criteria.append(
            "ORDER FLOW: Before saving an order, the agent MUST collect: Name, Phone, Email, and confirm the complete "
            "order details (items, size, customization, total). Only after customer confirms → call save_record(always_insert=True). "
            "If the response says the order is 'saved', 'confirmed', or 'ready' but save_record is NOT in Tools Called, this is INVALID. "
            "Missing email before saving is also INVALID."
        )
        criteria.append("UPSELLING: Suggest a complementary item (pastry, snack, upgrade) when the user is ordering.")
    if capabilities.get('has_bookings'):
        criteria.append(
            "BOOKING FLOW: The agent must follow these steps: ask service → ask date → show slots → customer picks → "
            "ask Name+Phone+Email TOGETHER in one message → confirm all details → save_record(always_insert=True). "
            "Confirming without collecting email is INVALID. "
            "CRITICAL: If the customer just said yes/confirmed AND 'save_record' does NOT appear in Tools Called, "
            "the response is INVALID — tell the agent to call save_record immediately, not narrate that it will."
        )
        criteria.append(
            "NARRATION vs ACTION: If the response says 'I'll save', 'I'll now save', 'I'll book', or similar future-tense "
            "phrases about saving, but save_record is NOT in Tools Called, this is INVALID. "
            "The agent must call the tool, not describe calling it."
        )
        criteria.append(
            "RESCHEDULE: If the customer wants to change their booking, the agent must collect new date/time, "
            "re-confirm all details, call cancel_booking, then call save_record(always_insert=True). "
            "Saying 'rescheduled' without calling save_record is INVALID."
        )
    if capabilities.get('has_delivery'):
        criteria.append("DELIVERY: 'validate_address' must be called before saving a delivery order.")

    criteria_text = "\n".join(f"- {c}" for c in criteria)

    transcript_section = f"\nConversation so far:\n{conversation_transcript}\n" if conversation_transcript else ""

    return f"""Evaluate whether the assistant's last response is correct and complete.
{transcript_section}
Last User Message: {user_query}
Assistant's Last Response: {last_msg}
Tools Called (entire session): {', '.join(tools_called) if tools_called else 'None'}

Criteria:
{criteria_text}

CUSTOMER DATA CHECK: If save_record was called, verify that the customer's real Name, Phone, AND Email actually appear in the conversation transcript above (typed by the customer, not invented by the assistant). If any are missing or look like placeholders (e.g. "John Doe", "session123", "1234567890", "your_name"), the response is INVALID — instruct the assistant to ask the customer for the missing information before saving.

Is this response valid? If not, give specific, actionable instructions for what must be fixed."""


# Matches Llama's leaked text format: <function=name{...}</function> or <function=name>{...}</function>
_TEXT_TOOL_RE = re.compile(
    r'<function=(\w+)>?\s*(\{.*?\})\s*</function>',
    re.DOTALL,
)


def _recover_text_tool_calls(response: AIMessage) -> AIMessage:
    """
    When Llama leaks <function=name{args}</function> into text instead of
    using the proper tool_calls API, parse and promote them to real tool calls
    so the ToolNode can execute them.
    """
    if response.tool_calls or not response.content:
        return response

    matches = _TEXT_TOOL_RE.findall(response.content)
    if not matches:
        return response

    tool_calls = []
    for func_name, args_str in matches:
        try:
            args = json.loads(args_str)
            tool_calls.append({
                "name": func_name,
                "args": args,
                "id": f"recovered_{func_name}_{int(_time.time() * 1000)}",
                "type": "tool_call",
            })
        except (json.JSONDecodeError, ValueError):
            pass

    if not tool_calls:
        # Could not parse — at least strip the raw tags from visible text
        clean = _TEXT_TOOL_RE.sub("", response.content).strip()
        return AIMessage(content=clean or response.content)

    clean_content = _TEXT_TOOL_RE.sub("", response.content).strip()
    return AIMessage(content=clean_content, tool_calls=tool_calls)


def _compile_graph(has_orders: bool, has_bookings: bool, has_delivery: bool):
    tools = _select_tools(has_orders, has_bookings, has_delivery)
    tool_node = ToolNode(tools)

    llm = ChatGroq(model="llama-3.3-70b-versatile", temperature=0)
    fallback_llm = ChatGroq(model="llama-3.1-8b-instant", temperature=0)
    model = llm.bind_tools(tools)
    fallback_model = fallback_llm.bind_tools(tools)
    critic_model = llm.with_structured_output(Evaluation)

    def call_model(state: AgentState):
        from groq import BadRequestError, APIConnectionError, RateLimitError, APIStatusError
        profile = state.get("business_profile", {})
        feedback = state.get("critic_feedback", "")
        system_msg = _build_system_prompt(profile, feedback)
        messages = [system_msg] + list(state["messages"])
        response = None
        try:
            response = model.invoke(messages)
        except RateLimitError:
            # Main model quota exhausted — fall through to fallback model
            try:
                response = fallback_model.invoke(messages)
            except RateLimitError:
                response = AIMessage(content="I'm very busy right now. Please wait 30 seconds and try again.")
            except Exception:
                response = AIMessage(content="Something went wrong. Please try again.")
        except APIConnectionError:
            _time.sleep(1)
            try:
                response = model.invoke(messages)
            except Exception:
                response = AIMessage(content="I'm having trouble connecting. Please try again in a moment.")
        except BadRequestError as e:
            if "tool_use_failed" in str(e):
                try:
                    response = fallback_model.invoke(messages)
                except Exception:
                    response = AIMessage(content="I'm sorry, I had trouble processing that. Could you rephrase?")
            else:
                response = AIMessage(content="Something went wrong on my end. Please try again.")
        except APIStatusError as e:
            response = AIMessage(content=f"The AI service returned an error ({e.status_code}). Please try again.")

        if response is None:
            response = AIMessage(content="Something unexpected happened. Please try again.")

        # Recover any <function=...> tags the model leaked into plain text
        response = _recover_text_tool_calls(response)
        return {"messages": [response], "critic_feedback": ""}

    def critic_node(state: AgentState):
        profile = state.get("business_profile", {})
        current_retries = state.get("retry_count", 0)
        last_msg = state["messages"][-1].content
        # LLM can return content as a list of blocks instead of a plain string
        if isinstance(last_msg, list):
            last_msg = " ".join(
                block.get("text", "") if isinstance(block, dict) else str(block)
                for block in last_msg
            )

        user_query = ""
        human_messages = []
        for m in state["messages"]:
            if isinstance(m, HumanMessage):
                human_messages.append(m.content)
                user_query = m.content  # last human message

        tools_called = [
            tc['name']
            for m in state["messages"]
            if hasattr(m, "tool_calls") and m.tool_calls
            for tc in m.tool_calls
        ]

        # Build a compact conversation transcript for the critic
        transcript_lines = []
        for m in state["messages"]:
            if isinstance(m, HumanMessage):
                transcript_lines.append(f"Customer: {m.content}")
            elif isinstance(m, AIMessage) and m.content:
                transcript_lines.append(f"Assistant: {m.content}")
        conversation_transcript = "\n".join(transcript_lines[-20:])  # last 20 turns max

        prompt = _build_critic_prompt(profile, user_query, last_msg, tools_called, conversation_transcript)
        try:
            result = critic_model.invoke(prompt)
        except Exception:
            # Critic failure: pass through without resetting the retry counter so the
            # retry budget isn't artificially restored if the critic is consistently broken.
            return {"critic_feedback": "", "retry_count": current_retries}

        # Coerce string → bool (model returns "true"/"false" strings)
        is_valid = str(result.is_valid).strip().lower() not in ("false", "0", "no", "invalid")

        # Allow 2 retries when save_record is missing but claimed — strict enforcement
        caps = profile.get("capabilities") or {}
        needs_save = caps.get("has_orders") or caps.get("has_bookings")
        claimed_saved = any(w in last_msg.lower() for w in (
            "saved", "confirmed", "order ready", "booking confirmed", "record saved",
            "i'll save", "i will save", "i'll now save", "saving your", "booking now",
            "appointment is booked", "appointment has been", "i'll book",
        ))
        save_was_called = "save_record" in tools_called
        max_retries = 2 if (needs_save and claimed_saved and not save_was_called) else 1

        if not is_valid and current_retries < max_retries:
            return {"critic_feedback": result.feedback, "retry_count": current_retries + 1}
        return {"critic_feedback": "", "retry_count": 0}

    def route_agent(state: AgentState):
        """After agent: go to tools if it made tool calls, else go to critic."""
        if state["messages"][-1].tool_calls:
            return "tools"
        return "critic"

    def route_critic(state: AgentState):
        """After critic: retry agent if feedback was set, else end."""
        if state.get("critic_feedback"):
            return "agent"
        return END

    workflow = StateGraph(AgentState)
    workflow.add_node("agent", call_model)
    workflow.add_node("tools", tool_node)
    workflow.add_node("critic", critic_node)
    workflow.set_entry_point("agent")
    workflow.add_conditional_edges("agent", route_agent, {"tools": "tools", "critic": "critic"})
    workflow.add_edge("tools", "agent")
    workflow.add_conditional_edges("critic", route_critic, {"agent": "agent", END: END})
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
