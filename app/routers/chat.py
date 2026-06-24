from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.database import get_db
from db import models, crud
from agent.graph import get_graph
from agent.tools import current_business_id as biz_id_var
from langchain_core.messages import HumanMessage, AIMessage, ToolMessage

router = APIRouter(tags=["chat"])


def _resolve_profile(db: Session, session_id: str, business_id: int = None):
    """Get or create a session and resolve the business profile."""
    sess = crud.get_session(db, session_id)
    if not sess:
        latest = (
            db.query(models.BusinessProfile)
            .filter(models.BusinessProfile.name != "")
            .order_by(models.BusinessProfile.id.desc())
            .first()
        )
        biz_id = business_id or (latest.id if latest else None)
        sess = crud.create_session(db, session_id, business_id=biz_id)
    else:
        biz_id = sess.business_id or business_id

    profile = None
    if biz_id:
        profile = db.query(models.BusinessProfile).filter(
            models.BusinessProfile.id == biz_id
        ).first()
    if not profile:
        profile = (
            db.query(models.BusinessProfile)
            .filter(models.BusinessProfile.name != "")
            .order_by(models.BusinessProfile.id.desc())
            .first()
        )
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
async def chat(session_id: str, message: str, db: Session = Depends(get_db)):
    sess, profile = _resolve_profile(db, session_id)
    biz_id_var.set(profile.id if profile else None)

    profile_dict = {
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "config": profile.config,
        "dynamic_tables": profile.dynamic_tables or [],
        "capabilities": profile.capabilities or {},
    } if profile else {}

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

    last_response = result["messages"][-1].content
    crud.create_audit_log(
        db, "chat_interaction",
        {"input": message, "output": last_response},
        session_id,
        business_id=profile.id if profile else None,
    )

    return {"response": last_response}


@router.get("/history/{session_id}")
def get_history(session_id: str, db: Session = Depends(get_db)):
    sess = crud.get_session(db, session_id)
    if not sess:
        return {"history": []}
    clean_history = [
        {"role": "user" if m["type"] == "human" else "assistant", "content": m["content"]}
        for m in (sess.history or [])
        if m["type"] in ["human", "ai"]
    ]
    return {"history": clean_history}
