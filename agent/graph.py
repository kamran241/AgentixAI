from typing import TypedDict, Annotated, List
from langchain_openai import ChatOpenAI
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage, AIMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from pydantic import BaseModel, Field
from dotenv import load_dotenv

load_dotenv()

from .state import AgentState
from .tools import (
    search_knowledge, update_cart, check_availability, 
    finalize_order, update_order, cancel_order,
    create_booking, modify_booking, 
    cancel_booking, get_order_status, validate_address, 
    analyze_business_stats, get_customer_history
)

# Schema for the critic's evaluation
class Evaluation(BaseModel):
    is_valid: bool = Field(description="True if the response follows all business rules and collects required info.")
    feedback: str = Field(description="Specific instructions on what is missing or wrong, e.g. 'You forgot to ask for their phone number'.")

# Define the tools
tools = [
    search_knowledge, update_cart, check_availability, 
    finalize_order, update_order, cancel_order,
    create_booking, modify_booking, 
    cancel_booking, get_order_status, validate_address, analyze_business_stats, get_customer_history
]
tool_node = ToolNode(tools)

# LLMs
model = ChatOpenAI(model="gpt-4o-mini", temperature=0).bind_tools(tools)
critic_model = ChatOpenAI(model="gpt-4o-mini", temperature=0).with_structured_output(Evaluation)

def call_model(state: AgentState):
    messages = state["messages"]
    profile = state.get("business_profile", {})
    feedback = state.get("critic_feedback", "")
    
    # Dynamic System Prompt
    rules_text = "\n".join([f"- {r['category']}: {r['rule_details']}" for r in profile.get('config', []) if isinstance(r, dict)])
    
    feedback_instruction = ""
    if feedback:
        print(f"DEBUG: Self-Correction feedback received: {feedback}")
        feedback_instruction = f"\n\nCRITICAL FIX REQUIRED:\nYour last response was rejected. Please address this issue: {feedback}"

    system_msg = SystemMessage(content=f"""
You are a professional AI assistant for '{profile.get('name', 'a small business')}'.
Business Type: {profile.get('type', 'Unknown')}
Description: {profile.get('description', 'Generic Service')}

SPECIFIC BUSINESS RULES:
{rules_text}

CORE RULES:
1. KNOWLEDGE FIRST: If the user asks for info (menu, prices), ALWAYS use 'search_knowledge'. Search first, never assume.
2. Use 'update_cart' for products/services.
3. Use 'check_availability' and 'create_booking' for time-based appointments.
4. DATE/TIME: For appointments, you MUST ask for a specific Date and Time before booking.
5. CUSTOMER INFO: You MUST collect the customer's Name and Phone Number before finalizing any order or booking.
6. ADDRESS: For delivery, collect and 'validate_address'.
7. CALENDAR VERIFICATION: NEVER confirm a booking or appointment from memory. You MUST call 'check_availability' first, and ONLY if it returns 'available: True', call 'create_booking'. 
10. RETURNING CUSTOMERS: When a user provides their phone number, ALWAYS use 'get_customer_history' to see if they have been here before.
11. STATISTICS & UPSELLING: Use 'analyze_business_stats' at the start of an order or when asked for recommendations to suggest popular items.
{feedback_instruction}
""")
    
    input_messages = [system_msg] + messages
    response = model.invoke(input_messages)
    # Clear feedback after the agent tries to fix it
    return {"messages": [response], "critic_feedback": ""}

def critic_node(state: AgentState):
    """The Critic (Requirement 35): Verifies if the AI response follows all rules."""
    profile = state.get("business_profile", {})
    rules_text = "\n".join([f"- {r['category']}: {r['rule_details']}" for r in profile.get('config', []) if isinstance(r, dict)])
    
    # Check if we have already tried once
    current_retries = state.get("retry_count", 0)
    
    last_msg = state["messages"][-1].content
    user_query = ""
    for m in reversed(state["messages"]):
        if isinstance(m, HumanMessage):
            user_query = m.content
            break

    # Extract tool calls for history analysis
    tools_called = []
    for m in state["messages"]:
        if hasattr(m, "tool_calls") and m.tool_calls:
            for tc in m.tool_calls:
                tools_called.append(tc['name'])
    
    evaluation_prompt = f"""
Compare the Assistant's response to the Business Rules and ensure it is helpful.
User Query: {user_query}
Assistant Response: {last_msg}
Tools Called in this session: {", ".join(tools_called) if tools_called else "None"}

Rules:
- COLLECT INFO: Ask for Name and Phone ONLY when the user is explicitly starting an order, making a booking, or checking out.
- KNOWLEDGE: Use PDF knowledge to answer questions. If the user just wants the menu or info, showing it IS valid without asking for Name/Phone.
- BOOKING: Must ask for Date/Time for appointments.
- AVAILABILITY: You MUST ensure the agent calls 'check_availability' BEFORE calling 'create_booking'. If the agent confirms an appointment without a tool call proving availability, it is INVALID.
- UPSELLING: Offer one upsell if the user is in the process of ordering.

Decision Criteria:
1. If the user is just asking for information (menu, hours, etc.), the response is VALID if it provides that info.
2. If the user is trying to finalize/place an order or book a slot, the response is INVALID IF IT MISSES Name or Phone.
3. If the user is at the very beginning of an order, we should suggest popular items (analyze_business_stats).

Task: Evaluate this response.
"""
    result = critic_model.invoke(evaluation_prompt)
    
    if not result.is_valid and current_retries < 1:
        # Increase retry count to stop infinite loops
        return {"critic_feedback": result.feedback, "retry_count": current_retries + 1}
    
    # If valid OR if we already tried once, reset count and finish
    return {"critic_feedback": "", "retry_count": 0}

def should_continue(state: AgentState):
    last_message = state["messages"][-1]
    if last_message.tool_calls:
        return "tools"
    return "critic"

def check_critic_decision(state: AgentState):
    if state.get("critic_feedback"):
        return "agent" # Loop back for self-correction ONLY once
    return END

# Build the Graph
workflow = StateGraph(AgentState)

workflow.add_node("agent", call_model)
workflow.add_node("tools", tool_node)
workflow.add_node("critic", critic_node) # The Evaluator node

workflow.set_entry_point("agent")
workflow.add_conditional_edges("agent", should_continue)
workflow.add_edge("tools", "agent")
workflow.add_conditional_edges("critic", check_critic_decision)

graph = workflow.compile()
