from sqlalchemy import Column, Integer, String, Text, ForeignKey, Table, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from enum import Enum
from backend.db.session import Base

# Enums required by the API schemas and logic
class ChannelType(str, Enum):
    TEXT = "text"
    VOICE = "voice"

class FriendRequestStatus(str, Enum):
    PENDING = "pending"
    ACCEPTED = "accepted"
    DECLINED = "declined"

# Many-to-Many: Users in Servers
user_server = Table(
    "user_server",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("server_id", Integer, ForeignKey("servers.id"), primary_key=True)
)

# Many-to-Many: DM Channels (usually 2 users)
user_dm_channel = Table(
    "user_dm_channel",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("users.id"), primary_key=True),
    Column("channel_id", Integer, ForeignKey("channels.id"), primary_key=True)
)

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    phone = Column(String, unique=True, index=True, nullable=False)
    username = Column(String, unique=True, index=True)
    avatar_url = Column(String, nullable=True)
    last_verify_code = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    servers = relationship("Server", secondary=user_server, back_populates="members")
    channels = relationship("Channel", secondary=user_dm_channel, back_populates="dm_participants")

class Server(Base):
    __tablename__ = "servers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    icon_url = Column(String, nullable=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    members = relationship("User", secondary=user_server, back_populates="servers")
    channels = relationship("Channel", back_populates="server", cascade="all, delete-orphan")

class Channel(Base):
    __tablename__ = "channels"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=True)
    type = Column(String, default=ChannelType.TEXT)
    server_id = Column(Integer, ForeignKey("servers.id"), nullable=True)
    is_dm = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    server = relationship("Server", back_populates="channels")
    messages = relationship("Message", back_populates="channel", cascade="all, delete-orphan")
    dm_participants = relationship("User", secondary=user_dm_channel, back_populates="channels")

class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=True)
    media_url = Column(String, nullable=True)
    media_type = Column(String, default="text") # text, image, video, circle, file
    sender_id = Column(Integer, ForeignKey("users.id"))
    channel_id = Column(Integer, ForeignKey("channels.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    sender = relationship("User")
    channel = relationship("Channel", back_populates="messages")

class FriendRequest(Base):
    __tablename__ = "friend_requests"
    id = Column(Integer, primary_key=True, index=True)
    from_user_id = Column(Integer, ForeignKey("users.id"))
    to_phone = Column(String)
    status = Column(String, default=FriendRequestStatus.PENDING)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
