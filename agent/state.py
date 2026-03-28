from typing import Annotated, Sequence, TypedDict, Union
from langchain_core.messages import BaseMessage
from langgraph.graph.message import add_messages

class AgentState(TypedDict):
    # The messages in the conversation
    messages: Annotated[Sequence[BaseMessage], add_messages]
    # Business context (parsed from PDF)
    business_profile: dict
    # Current shopping cart or pending appointment
    order_context: dict
    # Session metadata
    session_id: str
    # Customer info collected during flow
    customer_info: dict
    # Feedback from the critic for self-correction
    critic_feedback: str = ""
    # Number of times we've tried to self-correct
    retry_count: int = 0
