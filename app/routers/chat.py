import asyncio
import re
import time as _time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db import models, crud
from agent.graph import get_graph
from agent.tools import current_business_id as biz_id_var
from app.dependencies import get_current_user
from db.models import User
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

router = APIRouter(tags=["chat"])

# Strip any leaked tool-call syntax the LLM accidentally writes in response text
_TOOL_LEAK_RE = re.compile(
    r'<function[=\s][^>]*>.*?</function>|'  # <function=name>...</function>
    r'<tool_call>.*?</tool_call>|'           # <tool_call>...</tool_call>
    r'<function_calls>.*?</function_calls>', # <function_calls>...</function_calls>
    re.DOTALL,
)

def _clean_response(text: str) -> str:
    """Remove any raw function/tool-call blocks the model leaked into response text."""
    cleaned = _TOOL_LEAK_RE.sub('', text)
    return re.sub(r'\n{3,}', '\n\n', cleaned).strip()


def _extract_text(content) -> str:
    """Safely extract a plain string from a message content value.

    Some LLM providers return content as a list of typed blocks
    (e.g. [{"type": "text", "text": "..."}]). This handles both cases.
    """
    if isinstance(content, list):
        return " ".join(
            block.get("text", "") if isinstance(block, dict) else str(block)
            for block in content
        )
    return content or ""


def _serialize_history(messages: list) -> list:
    """Convert LangGraph message objects to storable dicts."""
    result = []
    for m in messages:
        if isinstance(m, HumanMessage):
            result.append({"type": "human", "content": m.content})
        elif isinstance(m, AIMessage):
            entry = {"type": "ai", "content": m.content}
            if m.tool_calls:
                entry["tool_calls"] = m.tool_calls
            result.append(entry)
        elif isinstance(m, ToolMessage):
            result.append({"type": "tool", "content": str(m.content), "tool_call_id": m.tool_call_id})
    return result


# Slot availability doesn't change faster than bookings are made, so a short TTL
# avoids 7 blocking DB queries on every single chat message.
_slots_cache: dict = {}  # biz_id -> (monotonic_ts, slots_list)
_SLOTS_CACHE_TTL = 60    # seconds


def _fetch_slots(profile) -> list:
    """Sync helper that fetches 7-day slot data — called via run_in_executor."""
    from datetime import date, timedelta
    data_sess = crud.get_business_session(profile)
    try:
        upcoming = []
        for i in range(7):
            day_str = (date.today() + timedelta(days=i)).isoformat()
            info = crud.compute_slots_for_date(profile, day_str, data_sess)
            if info:
                upcoming.append(info)
        return upcoming
    finally:
        data_sess.close()


async def _build_profile_dict(profile) -> dict:
    """Build the agent profile dict and prefetch upcoming slots for booking businesses."""
    d = {
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "config": profile.config,
        "dynamic_tables": profile.dynamic_tables or [],
        "capabilities": profile.capabilities or {},
        "custom_prompt": profile.custom_prompt or "",
        "availability": profile.availability or {},
    }
    if (profile.capabilities or {}).get("has_bookings") and profile.availability:
        cached = _slots_cache.get(profile.id)
        if cached and (_time.monotonic() - cached[0]) < _SLOTS_CACHE_TTL:
            d["upcoming_slots"] = cached[1]
        else:
            loop = asyncio.get_event_loop()
            upcoming = await loop.run_in_executor(None, _fetch_slots, profile)
            _slots_cache[profile.id] = (_time.monotonic(), upcoming)
            d["upcoming_slots"] = upcoming
    return d


def _last_ai_text(messages: list) -> str:
    """Return the last non-empty AIMessage text from a LangGraph result message list.

    We scan backwards because the very last entry can be an intermediate
    AIMessage with content="" that only carried tool_calls — the actual
    final reply is the preceding non-empty AIMessage.
    """
    for m in reversed(messages):
        if isinstance(m, AIMessage):
            text = _extract_text(m.content).strip()
            if text:
                return text
    return ""


def _resolve_profile(db: Session, session_id: str, business_id: int = None):
    """Get or create a session and resolve the business profile."""
    sess = crud.get_session(db, session_id)
    if not sess:
        sess = crud.create_session(db, session_id, business_id=business_id)
    else:
        # Prefer the explicit business_id param over whatever is stored
        if business_id:
            biz_id = business_id
        else:
            biz_id = sess.business_id
        business_id = biz_id

    profile = None
    if business_id:
        profile = db.query(models.BusinessProfile).filter(
            models.BusinessProfile.id == business_id
        ).first()
        if profile and not sess.business_id:
            sess.business_id = profile.id
            db.commit()

    return sess, profile


def _build_history(history: list) -> list:
    langchain_history = []
    for i, m in enumerate(history):
        if m["type"] == "human":
            langchain_history.append(HumanMessage(content=m["content"]))
        elif m["type"] == "ai":
            if "tool_calls" in m and m["tool_calls"]:
                has_response = i + 1 < len(history) and history[i + 1]["type"] == "tool"
                langchain_history.append(
                    AIMessage(content=m["content"], tool_calls=m["tool_calls"])
                    if has_response else AIMessage(content=m["content"])
                )
            else:
                langchain_history.append(AIMessage(content=m["content"]))
        elif m["type"] == "tool":
            langchain_history.append(
                ToolMessage(content=str(m["content"]), tool_call_id=m["tool_call_id"])
            )

    if len(langchain_history) > 15:
        langchain_history = langchain_history[-15:]
        if isinstance(langchain_history[0], ToolMessage):
            langchain_history = langchain_history[1:]

    return langchain_history


@router.post("/chat")
async def chat(
    session_id: str,
    message: str,
    business_id: int = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sess, profile = _resolve_profile(db, session_id, business_id=business_id)

    # Verify the resolved business belongs to the authenticated user
    if not profile:
        raise HTTPException(status_code=404, detail="No business found")
    if profile.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    biz_id_var.set(profile.id if profile else None)

    profile_dict = await _build_profile_dict(profile) if profile else {}

    agent_graph = get_graph(profile.capabilities or {} if profile else {})
    config = {"configurable": {"thread_id": session_id}}

    input_state = {
        "messages": _build_history(sess.history or []) + [HumanMessage(content=message)],
        "business_profile": profile_dict,
        "session_id": session_id,
        "order_context": {},
        "customer_info": {},
    }

    result = await agent_graph.ainvoke(input_state, config=config)

    new_history = _serialize_history(result["messages"])
    crud.update_session_history(db, session_id, new_history)

    last_response = _clean_response(_last_ai_text(result["messages"]))
    crud.create_audit_log(
        db, "chat_interaction",
        {"message_count": len(new_history)},
        session_id,
        business_id=profile.id if profile else None,
    )

    return {"response": last_response}


@router.get("/history/{session_id}")
def get_history(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    sess = crud.get_session(db, session_id)
    if not sess:
        return {"history": []}

    # Verify the session's business belongs to the current user
    if sess.business_id:
        profile = db.query(models.BusinessProfile).filter(
            models.BusinessProfile.id == sess.business_id
        ).first()
        if not profile or profile.user_id != current_user.id:
            raise HTTPException(status_code=403, detail="Access denied")

    clean_history = [
        {"role": "user" if m["type"] == "human" else "assistant", "content": m["content"]}
        for m in (sess.history or [])
        if m["type"] in ["human", "ai"]
    ]
    return {"history": clean_history}
