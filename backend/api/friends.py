from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_
from typing import List

from backend.db.session import get_db
from backend.db.models import User, FriendRequest, FriendRequestStatus, Channel, user_dm_channel
from backend.api.deps import get_current_user

router = APIRouter()

@router.post("/request/{user_id}")
async def send_friend_request(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot friend yourself")

    result = await db.execute(
        select(FriendRequest).where(
            or_(
                and_(FriendRequest.sender_id == current_user.id, FriendRequest.receiver_id == user_id),
                and_(FriendRequest.sender_id == user_id, FriendRequest.receiver_id == current_user.id)
            )
        )
    )
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Request already sent or friendship exists")

    new_req = FriendRequest(sender_id=current_user.id, receiver_id=user_id)
    db.add(new_req)
    await db.commit()
    return {"message": "Request sent"}

@router.get("/incoming")
async def get_incoming_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(FriendRequest).where(
            and_(FriendRequest.receiver_id == current_user.id, FriendRequest.status == FriendRequestStatus.PENDING)
        )
    )
    reqs = result.scalars().all()
    return reqs

@router.post("/accept/{request_id}")
async def accept_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))
    req = result.scalars().first()
    if not req or req.receiver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = FriendRequestStatus.ACCEPTED
    
    res_sender = await db.execute(select(User).where(User.id == req.sender_id))
    sender = res_sender.scalars().first()
    
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    # Create DM channel using Relationship - SAFER
    dm_channel = Channel(
        name=f"DM-{sender.username}-{current_user.username}", 
        is_dm=True,
    )
    dm_channel.dm_users = [sender, current_user]
    
    db.add(dm_channel)
    await db.commit()
    
    return {"message": "Request accepted", "channel_id": dm_channel.id}

@router.post("/decline/{request_id}")
async def decline_request(
    request_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(FriendRequest).where(FriendRequest.id == request_id))
    req = result.scalars().first()
    if not req or req.receiver_id != current_user.id:
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = FriendRequestStatus.REJECTED
    await db.commit()
    return {"message": "Request declined"}

@router.get("/dms")
async def list_friends(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch DM channels where user is a member
    result = await db.execute(
        select(Channel).join(Channel.dm_users).where(
            and_(Channel.is_dm == True, User.id == current_user.id)
        )
    )
    channels = result.scalars().unique().all()
    return channels
