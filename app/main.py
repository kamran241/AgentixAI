from dotenv import load_dotenv
print("DEBUG: main.py is starting...")
print("DEBUG: Loading Dotenv...")
load_dotenv(override=True)
print("DEBUG: Dotenv Loaded.")

print("DEBUG: Importing FastAPI...")
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
print("DEBUG: FastAPI Imported.")

print("DEBUG: Importing DB Modules...")
from sqlalchemy.orm import Session
from db import models, database, crud
print("DEBUG: DB Modules Imported.")

print("DEBUG: Importing RAG Engine...")
from rag.engine import RAGEngine
print("DEBUG: RAG Engine Imported.")

print("DEBUG: Importing Agent Graph...")
from agent.graph import graph
print("DEBUG: Agent Graph Imported.")

from langchain_core.messages import HumanMessage
import uuid
import os

from app.routers import admin as admin_router

app = FastAPI(title="Generic Business AI Agent")

print("DEBUG: Setting up Middleware...")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

print("DEBUG: Initializing DB...")
models.Base.metadata.create_all(bind=database.engine)
print("DEBUG: DB Initialized.")

print("DEBUG: Loading RAG Engine...")
from rag.instance import rag_engine
print("DEBUG: RAG Engine Loaded.")

app.include_router(admin_router.router)

@app.post("/ingest-pdf")
async def ingest_pdf(file: UploadFile = File(...), db: Session = Depends(database.get_db)):
    # Create tables if they don't exist before any CRUD operations
    models.Base.metadata.create_all(bind=database.engine)
    
    # Save file temporarily
    os.makedirs("./data/pdfs", exist_ok=True)
    file_path = f"./data/pdfs/{file.filename}"
    with open(file_path, "wb") as buffer:
        buffer.write(await file.read())
    
    # 1. Clear OLD business data (including dropping old dynamic tables)
    crud.clear_business_data(db)

    # 2. Ingest and profile (including dynamic schema extraction)
    identity = rag_engine.ingest_business_file(file_path)
    
    # Create the business-specific table
    dynamic_table_name = crud.create_dynamic_table(
        db, 
        table_name=identity.suggested_orders_table.table_name,
        columns=[c.model_dump() for c in identity.suggested_orders_table.columns]
    )
    
    # Save to profile
    crud.update_business_profile(
        db, 
        name=identity.name, 
        b_type=identity.type, 
        description=identity.description, 
        config=[r.model_dump() for r in identity.rules],
        dynamic_table=dynamic_table_name
    )
    
    return {"status": "success", "identity": identity}

@app.post("/chat")
async def chat(session_id: str, message: str, db: Session = Depends(database.get_db)):
    # 1. Get business profile
    profile = db.query(models.BusinessProfile).first()
    profile_dict = {
        "name": profile.name,
        "type": profile.business_type,
        "description": profile.description,
        "config": profile.config,
        "dynamic_table": profile.dynamic_table_name
    } if profile else {}

    # 2. Invoke Agent with 'thread_id' for built-in Memory
    config = {"configurable": {"thread_id": session_id}}
    
    # Get or create session
    sess = crud.get_session(db, session_id)
    if not sess:
        sess = crud.create_session(db, session_id)

    # 3. Load history
    from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
    history = sess.history or []
    langchain_history = []
    
    for i, m in enumerate(history):
        if m["type"] == "human":
            langchain_history.append(HumanMessage(content=m["content"]))
        elif m["type"] == "ai":
            # Only add AI message with tool_calls if the NEXT message is a tool response
            # This prevents 400 errors from OpenAI about missing tool responses
            if "tool_calls" in m and m["tool_calls"]:
                has_response = False
                if i + 1 < len(history) and history[i+1]["type"] == "tool":
                    # Simple check: assumes history is in order
                    has_response = True
                
                if has_response:
                    langchain_history.append(AIMessage(content=m["content"], tool_calls=m["tool_calls"]))
                else:
                    # If tool call has no response, strip the tool_calls to keep history valid
                    langchain_history.append(AIMessage(content=m["content"]))
            else:
                langchain_history.append(AIMessage(content=m["content"]))
        elif m["type"] == "tool":
            langchain_history.append(ToolMessage(content=str(m["content"]), tool_call_id=m["tool_call_id"]))
    
    # 3. Trim history to prevent context overflow (keep last 15 messages)
    if len(langchain_history) > 15:
        # Take the slice but ensure we don't start with a ToolMessage if its AIMessage was cut
        langchain_history = langchain_history[-15:]
        if isinstance(langchain_history[0], ToolMessage):
            # If the first message is a tool response, we lost its call. Remove it.
            langchain_history = langchain_history[1:]
    
    input_messages = langchain_history + [HumanMessage(content=message)]

    input_state = {
        "messages": input_messages,
        "business_profile": profile_dict,
        "session_id": session_id,
        "order_context": {},
        "customer_info": {}
    }
    
    # This runs the agentic flow. GPT-4o-mini + local embeddings make this very fast.
    result = await graph.ainvoke(input_state, config=config)
    
    # 3. Update persistent DB history (Optional backup)
    from langchain_core.messages import HumanMessage, AIMessage, ToolMessage
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
            new_history.append({"type": "tool", "content": str(m.content), "tool_call_id": m.tool_call_id})
            
    crud.update_session_history(db, session_id, new_history)
    
    # 4. Log the interaction
    last_response = result["messages"][-1].content
    crud.create_audit_log(db, "chat_interaction", {"input": message, "output": last_response}, session_id)

    return {"response": last_response}

@app.get("/logs")
def get_logs(db: Session = Depends(database.get_db)):
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(100).all()
    return logs

@app.get("/history/{session_id}")
async def get_history(session_id: str, db: Session = Depends(database.get_db)):
    sess = crud.get_session(db, session_id)
    if not sess:
        return {"history": []}
    
    # Filter the history to return only human and ai messages for the UI
    # We strip tool calls and raw tool data to keep the UI clean
    clean_history = []
    for m in (sess.history or []):
        if m["type"] in ["human", "ai"]:
            clean_history.append({
                "role": "user" if m["type"] == "human" else "assistant",
                "content": m["content"]
            })
    return {"history": clean_history}

@app.get("/dashboard/summary")
def get_dashboard_summary(db: Session = Depends(database.get_db)):
    """A master API to see everything in the business database at once."""
    profile = db.query(models.BusinessProfile).first()
    orders = db.query(models.Order).all()
    appointments = db.query(models.Appointment).all()
    logs = db.query(models.AuditLog).order_by(models.AuditLog.timestamp.desc()).limit(20).all()
    
    dynamic_data = []
    if profile and profile.dynamic_table_name:
        try:
            from sqlalchemy import text
            # Get everything from the custom business table
            res = db.execute(text(f"SELECT * FROM {profile.dynamic_table_name} ORDER BY created_at DESC LIMIT 50"))
            # Convert to list of dicts
            dynamic_data = [dict(r._mapping) for r in res]
        except Exception as e:
            dynamic_data = [{"error": f"Could not read dynamic table: {str(e)}"}]

    return {
        "business": {
            "name": profile.name if profile else "No Business Active",
            "type": profile.business_type if profile else "None",
            "table": profile.dynamic_table_name if profile else "None"
        },
        "statistics": {
            "total_orders": len(orders),
            "total_appointments": len(appointments)
        },
        "orders": orders,
        "appointments": appointments,
        "dynamic_data": dynamic_data,
        "recent_logs": logs
    }

@app.get("/health")
def health():
    return {"status": "ok"}
