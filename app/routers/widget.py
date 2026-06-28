from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db import crud
from agent.graph import get_graph
from agent.tools import current_business_id as biz_id_var
from app.routers.chat import (
    _build_history, _resolve_profile, _clean_response,
    _last_ai_text, _serialize_history, _build_profile_dict,
)
from app.constants import DEFAULT_WIDGET_CONFIG
from langchain_core.messages import HumanMessage

router = APIRouter(prefix="/widget", tags=["widget"])


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
    elif sess.business_id and sess.business_id != profile.id:
        # Session belongs to a different business — isolate by using a namespaced key
        safe_sid = f"{session_id}__biz{profile.id}"
        sess = crud.get_session(db, safe_sid) or crud.create_session(db, safe_sid, business_id=profile.id)
        session_id = safe_sid

    biz_id_var.set(profile.id)

    profile_dict = await _build_profile_dict(profile)

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

    new_history = _serialize_history(result["messages"])
    crud.update_session_history(db, session_id, new_history)

    return {"response": _clean_response(_last_ai_text(result["messages"]))}
