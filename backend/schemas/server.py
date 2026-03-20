from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from backend.db.models import ChannelType

class ChannelBase(BaseModel):
    name: str
    type: ChannelType = ChannelType.TEXT

class ChannelCreate(ChannelBase):
    pass

class Channel(ChannelBase):
    id: int
    server_id: int
    
    model_config = ConfigDict(from_attributes=True)

class ServerBase(BaseModel):
    name: str
    icon_url: Optional[str] = None

class ServerCreate(ServerBase):
    pass

class Server(ServerBase):
    id: int
    owner_id: int
    members_count: Optional[int] = None
    channels: List[Channel] = []
    
    model_config = ConfigDict(from_attributes=True)

class ServerBrief(ServerBase):
    id: int
    model_config = ConfigDict(from_attributes=True)
