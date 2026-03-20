from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from backend.db.session import get_db
from backend.db.models import Message as MessageModel, Channel as ChannelModel, User as UserModel
from backend.schemas.message import Message, MessageCreate
from backend.api.deps import get_current_user

router = APIRouter()

@router.get("/{channel_id}", response_model=List[Message])
async def get_message_history(
    channel_id: int,
    limit: int = 50,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(MessageModel)
        .where(MessageModel.channel_id == channel_id)
        .options(selectinload(MessageModel.sender))
        .order_by(MessageModel.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(stmt)
    messages = result.scalars().all()
    return messages[::-1]

@router.delete("/{message_id}")
async def delete_message(
    message_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserModel = Depends(get_current_user)
):
    stmt = (
        select(MessageModel)
        .where(MessageModel.id == message_id)
        .options(selectinload(MessageModel.sender))
    )
    result = await db.execute(stmt)
    msg = result.scalars().first()
    
    if not msg:
        raise HTTPException(status_code=404, detail="Message not found")
    
    if msg.sender_id != current_user.id:
        raise HTTPException(status_code=403, detail="Can only delete your own messages")
    
    cid = msg.channel_id
    await db.delete(msg)
    await db.commit()
    
    # Broadcast deletion to everyone in the channel
    from backend.websockets.manager import manager
    await manager.broadcast_to_channel(db, cid, {
        "type": "message_deleted",
        "data": {"id": message_id}
    })
    
    return {"status": "ok"}

@router.post("/", response_model=Message)
async def send_message_rest(
    payload: MessageCreate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    message = MessageModel(
        content=payload.content,
        sender_id=current_user.id,
        channel_id=payload.channel_id
    )
    db.add(message)
    await db.commit()
    await db.refresh(message, attribute_names=["sender"])
    return message
