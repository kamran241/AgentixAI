from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.database import get_db
from db import crud
from agent.graph import get_graph
from agent.tools import current_business_id as biz_id_var
from app.routers.chat import _build_history, _resolve_profile
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

router = APIRouter(prefix="/widget", tags=["widget"])


@router.get("/{token}/info")
def widget_info(token: str, db: Session = Depends(get_db)):
    """Public — returns business info for the widget UI."""
    profile = crud.get_business_by_token(db, token)
    if not profile or not profile.name:
        raise HTTPException(status_code=404, detail="Widget not found")
    return {
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "capabilities": profile.capabilities or {},
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
    }

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

    return {"response": result["messages"][-1].content}
