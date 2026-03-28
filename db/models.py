from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, Float, JSON
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base

class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    business_type = Column(String) # e.g., Pizza, Dentist
    description = Column(Text)
    config = Column(JSON) # Store parsed rules like hours, pricing rules, etc.
    dynamic_table_name = Column(String, nullable=True) # Name of the auto-generated orders table
    created_at = Column(DateTime, server_default=func.now())

class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, index=True)
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    customer_address = Column(Text, nullable=True)
    history = Column(JSON, default=[]) # Store chat history JSON
    created_at = Column(DateTime, server_default=func.now())

class Order(Base):
    __tablename__ = "orders"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    total_price = Column(Float)
    status = Column(String, default="pending") # pending, confirmed, cancelled
    order_details = Column(JSON) # Store structured order info
    created_at = Column(DateTime, server_default=func.now())
    
class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"))
    customer_name = Column(String)
    customer_phone = Column(String)
    service_name = Column(String)
    appointment_time = Column(DateTime)
    status = Column(String, default="booked") # booked, cancelled, completed
    created_at = Column(DateTime, server_default=func.now())

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, ForeignKey("sessions.id"), nullable=True)
    action = Column(String) # Tool Call, LLM Response, DB Write
    details = Column(JSON) # Parameters, retrieved chunks, etc.
    timestamp = Column(DateTime, server_default=func.now())
