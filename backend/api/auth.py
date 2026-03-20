import logging
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from backend.db.session import get_db
from backend.db.models import User
from backend.schemas.auth import RequestSms, VerifySms, Token
from backend.core.security import create_access_token

router = APIRouter()
logger = logging.getLogger(__name__)

@router.post("/request-code")
async def request_code(
    payload: RequestSms,
    db: AsyncSession = Depends(get_db)
):
    phone = payload.phone
    code = "123456" 
    
    result = await db.execute(select(User).where(User.phone == phone))
    user = result.scalars().first()
    
    if not user:
        user = User(
            phone=phone,
            username=f"User_{phone[-4:]}",
            last_verify_code=code
        )
        db.add(user)
    else:
        user.last_verify_code = code
        
    await db.commit()
    logger.info(f"SMS code for {phone}: {code}")
    return {"message": "Code sent successfully", "debug_code": code}

@router.post("/verify-code", response_model=Token)
async def verify_code(
    payload: VerifySms,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.phone == payload.phone))
    user = result.scalars().first()
    
    if not user or user.last_verify_code != payload.code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect phone or code"
        )
    
    user.last_verify_code = None
    await db.commit()
    
    access_token = create_access_token(data={"sub": user.phone})
    return {"access_token": access_token, "token_type": "bearer"}
