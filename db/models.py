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
    created_at = Column(DateTime, server_default=func.now())


class Session(Base):
    __tablename__ = "sessions"
    id = Column(String, primary_key=True, index=True)
    business_id = Column(Integer, nullable=True)
    customer_name = Column(String, nullable=True)
    customer_phone = Column(String, nullable=True)
    customer_address = Column(Text, nullable=True)
    history = Column(JSON, default=[])
    created_at = Column(DateTime, server_default=func.now())


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String, nullable=True)
    business_id = Column(Integer, nullable=True)
    action = Column(String)
    details = Column(JSON)
    timestamp = Column(DateTime, server_default=func.now())
