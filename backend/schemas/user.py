from pydantic import BaseModel, ConfigDict
from typing import Optional, List

class UserBase(BaseModel):
    phone: str
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

class UserCreate(UserBase):
    pass

class UserUpdate(BaseModel):
    username: Optional[str] = None
    avatar_url: Optional[str] = None
    bio: Optional[str] = None

class User(UserBase):
    id: int
    is_active: bool = True

    model_config = ConfigDict(from_attributes=True)

class UserFull(User):
    # This might include additional fields or relations later
    pass
