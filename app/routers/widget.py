from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db import crud
from agent.graph import get_graph
from agent.tools import current_business_id as biz_id_var
from app.routers.chat import _build_history, _resolve_profile, _clean_response
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

router = APIRouter(prefix="/widget", tags=["widget"])


DEFAULT_WIDGET_CONFIG = {
    "bot_name": "AI Assistant",
    "primary_color": "#6366f1",
    "bg_color": "#0b0f1a",
    "welcome_message": "Hi! How can I help you today?",
    "position": "right",
    "logo_url": None,
}


@router.get("/{token}/info")
def widget_info(token: str, db: Session = Depends(get_db)):
    """Public — returns business info + widget config for the widget UI."""
    profile = crud.get_business_by_token(db, token)
    if not profile or not profile.name:
        raise HTTPException(status_code=404, detail="Widget not found")
    widget_cfg = {**DEFAULT_WIDGET_CONFIG, **(profile.widget_config or {})}
    return {
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "capabilities": profile.capabilities or {},
        "widget_config": widget_cfg,
    }


@router.post("/{token}/chat")
async def widget_chat(token: str, session_id: str, message: str, db: Session = Depends(get_db)):
    """Public — chat endpoint for embedded widgets (no auth required)."""
    profile = crud.get_business_by_token(db, token)
    if not profile or not profile.name:
        raise HTTPException(status_code=404, detail="Widget not found")

    sess = crud.get_session(db, session_id)
    if not sess:
        sess = crud.create_session(db, session_id, business_id=profile.id)

    biz_id_var.set(profile.id)

    profile_dict = {
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "config": profile.config,
        "dynamic_tables": profile.dynamic_tables or [],
        "capabilities": profile.capabilities or {},
        "custom_prompt": profile.custom_prompt or "",
        "availability": profile.availability or {},
    }

    # Pre-fetch upcoming slots so the AI has real-time availability in its context
    if (profile.capabilities or {}).get("has_bookings") and profile.availability:
        from datetime import date, timedelta
        data_sess = crud.get_business_session(profile)
        try:
            upcoming = []
            for i in range(7):
                d = (date.today() + timedelta(days=i)).isoformat()
                info = crud.compute_slots_for_date(profile, d, data_sess)
                if info:
                    upcoming.append(info)
            profile_dict["upcoming_slots"] = upcoming
        finally:
            data_sess.close()

    agent_graph = get_graph(profile.capabilities or {})
    config = {"configurable": {"thread_id": session_id}}

    input_state = {
        "messages": _build_history(sess.history or []) + [HumanMessage(content=message)],
        "business_profile": profile_dict,
        "session_id": session_id,
        "order_context": {},
        "customer_info": {},
    }

    result = await agent_graph.ainvoke(input_state, config=config)

    new_history = []
    for m in result["messages"]:
        if isinstance(m, HumanMessage):
            new_history.append({"type": "human", "content": m.content})
        elif isinstance(m, AIMessage):
            msg_dict = {"type": "ai", "content": m.content}
            if m.tool_calls:
                msg_dict["tool_calls"] = m.tool_calls
            new_history.append(msg_dict)
        elif isinstance(m, ToolMessage):
            new_history.append({
                "type": "tool",
                "content": str(m.content),
                "tool_call_id": m.tool_call_id,
            })

    crud.update_session_history(db, session_id, new_history)

    return {"response": _clean_response(result["messages"][-1].content)}
