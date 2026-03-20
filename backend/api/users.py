from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from backend.db.session import get_db
from backend.db.models import User as UserModel
from backend.schemas.user import User, UserUpdate
from backend.api.deps import get_current_user

router = APIRouter()

@router.get("/me", response_model=User)
async def get_me(current_user: UserModel = Depends(get_current_user)):
    return current_user

@router.get("/search", response_model=List[User])
async def search_users(
    query: str,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search users by phone or username.
    """
    stmt = (
        select(UserModel)
        .where(
            and_(
                UserModel.id != current_user.id,
                or_(
                    UserModel.username.ilike(f"%{query}%"),
                    UserModel.phone.ilike(f"%{query}%")
                )
            )
        )
        .limit(20)
    )
    result = await db.execute(stmt)
    return result.scalars().all()

@router.patch("/me", response_model=User)
async def update_me(
    payload: UserUpdate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if payload.username is not None:
        current_user.username = payload.username
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    if payload.bio is not None:
        current_user.bio = payload.bio
        
    await db.commit()
    await db.refresh(current_user)
    return current_user
