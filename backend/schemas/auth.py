from pydantic import BaseModel
from typing import Optional

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"

class TokenData(BaseModel):
    sub: Optional[str] = None

class RequestSms(BaseModel):
    phone: str

class VerifySms(BaseModel):
    phone: str
    code: str
