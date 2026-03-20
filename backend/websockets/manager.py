import json
import logging
from typing import Dict, List, Set, Optional
from fastapi import WebSocket, status, WebSocketDisconnect
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_

from backend.core.security import verify_token
from backend.db.session import AsyncSessionLocal
from backend.db.models import User, Message, Channel, user_server, user_dm_channel
from backend.schemas.message import Message as MessageSchema

logger = logging.getLogger(__name__)

class ConnectionManager:
    def __init__(self):
        # user_id -> WebSocket
        self.user_connections: Dict[int, WebSocket] = {}

    async def connect(self, websocket: WebSocket, user_id: int):
        await websocket.accept()
        self.user_connections[user_id] = websocket
        logger.info(f"[WS] User {user_id} connected")

    def disconnect(self, user_id: int):
        if user_id in self.user_connections:
            del self.user_connections[user_id]
            logger.info(f"[WS] User {user_id} disconnected")

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.user_connections:
            try:
                await self.user_connections[user_id].send_json(message)
            except Exception as e:
                logger.error(f"[WS] Error sending to user {user_id}: {e}")

    async def broadcast_to_channel(self, db: AsyncSession, channel_id: int, message: dict):
        # 1. Get the channel (to know server_id or is_dm)
        result = await db.execute(select(Channel).where(Channel.id == channel_id))
        channel = result.scalars().first()
        if not channel:
            return

        target_user_ids = []
        if channel.is_dm:
            # DM: Find both participants
            res = await db.execute(select(user_dm_channel.c.user_id).where(user_dm_channel.c.channel_id == channel_id))
            target_user_ids = [r[0] for r in res.all()]
        else:
            # Server Channel: Find all members of the server
            res = await db.execute(select(user_server.c.user_id).where(user_server.c.server_id == channel.server_id))
            target_user_ids = [r[0] for r in res.all()]

        # 2. Send to all online targets
        for uid in target_user_ids:
            await self.send_to_user(uid, message)

    async def broadcast_global(self, message: dict):
        for ws in self.user_connections.values():
            try:
                await ws.send_json(message)
            except:
                pass

manager = ConnectionManager()

async def handle_websocket_logic(websocket: WebSocket, token: str):
    payload = verify_token(token)
    if not payload:
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    phone = payload.get("sub")
    async with AsyncSessionLocal() as db:
        res = await db.execute(select(User).where(User.phone == phone))
        user = res.scalars().first()
        if not user:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return

        await manager.connect(websocket, user.id)

        try:
            while True:
                data = await websocket.receive_text()
                message_data = json.loads(data)
                m_type = message_data.get("type")
                
                # We need a new session context for each message to avoid transaction issues
                async with AsyncSessionLocal() as session:
                    if m_type == "send_message":
                        chid = message_data.get("channel_id")
                        content = message_data.get("content")
                        m_url = message_data.get("media_url")
                        m_type_actual = message_data.get("media_type", "text")
                        
                        new_msg = Message(
                            content=content,
                            sender_id=user.id,
                            channel_id=chid,
                            media_url=m_url,
                            media_type=m_type_actual
                        )
                        session.add(new_msg)
                        await session.commit()
                        await session.refresh(new_msg, attribute_names=["sender"])
                        
                        msg_json = MessageSchema.model_validate(new_msg).model_dump(mode="json")
                        await manager.broadcast_to_channel(session, chid, {
                            "type": "new_message",
                            "data": msg_json
                        })
                        
                    elif m_type == "ping":
                        await websocket.send_json({"type": "pong"})
                        
                    elif m_type == "voice_join":
                        # Simplistic global broadcast for voice (can be room-based later)
                        chid = message_data.get("channel_id")
                        await manager.broadcast_global({
                            "type": "voice_update",
                            "data": {"user_id": user.id, "channel_id": chid, "status": "joined"}
                        })
                        
                    elif m_type == "voice_leave":
                        chid = message_data.get("channel_id")
                        await manager.broadcast_global({
                            "type": "voice_update",
                            "data": {"user_id": user.id, "channel_id": chid, "status": "left"}
                        })
        except WebSocketDisconnect:
            manager.disconnect(user.id)
        except Exception as e:
            logger.error(f"[WS] Logic Error: {e}")
            manager.disconnect(user.id)
