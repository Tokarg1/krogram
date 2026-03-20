from pydantic import BaseModel, ConfigDict
from datetime import datetime
from typing import Optional
from backend.schemas.user import User

class MessageBase(BaseModel):
    content: Optional[str] = None
    media_url: Optional[str] = None
    media_type: str = "text"

class MessageCreate(MessageBase):
    channel_id: int

class Message(MessageBase):
    id: int
    created_at: datetime
    sender_id: int
    channel_id: int
    media_url: Optional[str] = None
    media_type: str = "text"
    sender: User
    
    model_config = ConfigDict(from_attributes=True)
