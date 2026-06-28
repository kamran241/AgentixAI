from sqlalchemy import Column, Integer, String, Text, DateTime, JSON, Boolean, ForeignKey
from sqlalchemy.sql import func
from .database import Base


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    name = Column(String, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())


class BusinessProfile(Base):
    __tablename__ = "business_profiles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    public_token = Column(String, unique=True, index=True, nullable=True)
    name = Column(String, index=True)
    business_type = Column(String)
    description = Column(Text)
    config = Column(JSON)           # extracted business rules
    capabilities = Column(JSON)     # {has_orders, has_bookings, has_delivery}
    dynamic_tables = Column(JSON)   # [{table_name, purpose, columns:[{name,type}]}]
    widget_config = Column(JSON, default=dict)   # {bot_name, primary_color, welcome_message, logo_url, position}
    pdf_filename = Column(String, nullable=True)
    custom_prompt = Column(Text, nullable=True)       # optional system prompt override
    external_db_url = Column(Text, nullable=True)     # encrypted external DB connection string
    availability = Column(JSON, nullable=True)        # weekly schedule, slot duration, blocked dates
    created_at = Column(DateTime, server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, index=True)
    business_id = Column(Integer, nullable=True)
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    customer_address = Column(Text, nullable=True)
    history = Column(JSON, default=list)
    created_at = Column(DateTime, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, nullable=True)
    business_id = Column(Integer, nullable=True)
    action = Column(String)
    details = Column(JSON)
    timestamp = Column(DateTime, server_default=func.now())


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    business_id = Column(Integer, ForeignKey("business_profiles.id"), nullable=True)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, default="booking")   # booking | order | info
    read = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())
