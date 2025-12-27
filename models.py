from sqlalchemy import (
    create_engine,
    Column,
    String,
    Text,
    DateTime,
    ForeignKey,
    CheckConstraint
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Site(Base):
    __tablename__ = 'sites'

    site_id = Column(String(255), primary_key=True)
    domain = Column(String(255))
    ai_script_id = Column(String(255))
    ai_prompt = Column(Text)
    brand_name = Column(String(255))
    language = Column(String(50))
    hubspot_pipeline = Column(String(255))
    hubspot_stage = Column(String(255))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def __repr__(self):
        return f"<Site(site_id='{self.site_id}', domain='{self.domain}')>"

class ChatMessage(Base):
    __tablename__ = 'chat_messages'

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(String(255), nullable=False)
    site_id = Column(String(255), ForeignKey('sites.site_id'), nullable=False)
    role = Column(String(50), nullable=False)
    message = Column(Text)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        CheckConstraint(role.in_(['user', 'ai']), name='chat_messages_role_check'),
    )

    def __repr__(self):
        return f"<ChatMessage(role='{self.role}', user_id='{self.user_id}')>"

class User(Base):
    __tablename__ = 'users'

    user_id = Column(String(255), primary_key=True)
    email = Column(String(255))
    first_seen = Column(DateTime(timezone=True), server_default=func.now())
    last_seen = Column(DateTime(timezone=True), onupdate=func.now())

    def __repr__(self):
        return f"<User(user_id='{self.user_id}', email='{self.email}')>"

# Example of how to create an engine
# DATABASE_URL = "postgresql://user:password@host:port/database"
# engine = create_engine(DATABASE_URL)

# To create tables (not needed with Alembic migrations):
# Base.metadata.create_all(engine)
