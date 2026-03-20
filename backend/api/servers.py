from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload

from backend.db.session import get_db
from backend.db.models import Server as ServerModel, User as UserModel, Channel as ChannelModel, user_server
from backend.schemas.server import Server, ServerCreate, Channel, ChannelCreate
from backend.api.deps import get_current_user

router = APIRouter()

@router.post("/", response_model=Server)
async def create_server(
    payload: ServerCreate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    server = ServerModel(
        name=payload.name,
        icon_url=payload.icon_url,
        owner_id=current_user.id
    )
    db.add(server)
    
    # Add creator as a member automatically
    server.members.append(current_user)
    
    # Create a default "general" text channel
    default_channel = ChannelModel(name="general", server=server)
    db.add(default_channel)
    
    await db.commit()
    await db.refresh(server)
    return server

@router.get("/", response_model=List[Server])
async def list_servers(
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Get all servers where user is a member
    # Using selectinload for channels
    stmt = (
        select(ServerModel)
        .join(ServerModel.members)
        .where(UserModel.id == current_user.id)
        .options(selectinload(ServerModel.channels))
    )
    result = await db.execute(stmt)
    return result.scalars().unique().all()

@router.get("/{server_id}", response_model=Server)
async def get_server(
    server_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(ServerModel)
        .where(ServerModel.id == server_id)
        .options(selectinload(ServerModel.channels))
    )
    result = await db.execute(stmt)
    server = result.scalars().first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    
    return server

@router.post("/{server_id}/channels", response_model=Channel)
async def create_channel(
    server_id: int,
    payload: ChannelCreate,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Check if server exists and user is owner
    result = await db.execute(select(ServerModel).where(ServerModel.id == server_id))
    server = result.scalars().first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
    if server.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only owner can create channels")
        
    channel = ChannelModel(
        name=payload.name,
        type=payload.type,
        server_id=server_id
    )
    db.add(channel)
    await db.commit()
    await db.refresh(channel)
    return channel

@router.post("/{server_id}/join")
async def join_server(
    server_id: int,
    current_user: UserModel = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Logic to join a server (for prototype, open joining)
    stmt = (
        select(ServerModel)
        .where(ServerModel.id == server_id)
        .options(selectinload(ServerModel.members))
    )
    result = await db.execute(stmt)
    server = result.scalars().first()
    
    if not server:
        raise HTTPException(status_code=404, detail="Server not found")
        
    if current_user not in server.members:
        server.members.append(current_user)
        await db.commit()
        
    return {"message": "Successfully joined server"}
