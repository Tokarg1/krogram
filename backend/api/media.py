import os
import uuid
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from backend.api.deps import get_current_user
from backend.db.models import User as UserModel

router = APIRouter()

UPLOAD_DIR = "/app/backend/uploads"
if not os.path.exists(UPLOAD_DIR):
    os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    current_user: UserModel = Depends(get_current_user)
):
    """
    Загрузка медиафайла (картинка, видео или кружок).
    """
    file_ext = os.path.splitext(file.filename)[1]
    unique_filename = f"{uuid.uuid4()}{file_ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
        
    url = f"/api/media/files/{unique_filename}"
    return {"url": url, "filename": unique_filename}
