from fastapi import FastAPI, File, UploadFile, HTTPException, Depends, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from typing import List, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import os
import uuid
import zipfile
import io

# Import our modules
from database import get_db, init_db
from models import Session as SessionModel, Photo as PhotoModel
from r2_storage import (
    upload_file_to_r2, 
    download_file_from_r2, 
    generate_thumbnail,
    R2_BUCKET_NAME
)
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="Photo Matcher API - Free Tier")

# CORS Configuration
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# App Settings
MAX_PHOTOS = int(os.getenv("MAX_PHOTOS_PER_SESSION", "100"))
STORAGE_DAYS = int(os.getenv("STORAGE_DAYS", "7"))
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")

# Initialize database on startup
@app.on_event("startup")
async def startup_event():
    print("Initializing database...")
    init_db()
    print("Database initialized!")


@app.get("/")
def read_root():
    return {
        "message": "Photo Matcher API - Free Tier",
        "version": "2.0",
        "max_photos": MAX_PHOTOS,
        "storage_days": STORAGE_DAYS
    }


@app.post("/api/host/create-session")
async def create_session(
    files: List[UploadFile] = File(...),
    session_name: str = Form(...),
    session_mode: str = Form("browse"),
    welcome_message: Optional[str] = Form(None),
    theme_primary: Optional[str] = Form("#FF6B35"),
    theme_secondary: Optional[str] = Form("#F7931E"),
    db: Session = Depends(get_db)
):
    """
    Create a new photo session
    
    Args:
        files: Photos to upload
        session_name: Name of the event (e.g., "Priya & Rahul's Wedding")
        session_mode: "privacy" or "browse"
        welcome_message: Optional welcome text
        theme_primary: Primary color (hex)
        theme_secondary: Secondary color (hex)
    """
    
    # Validate photo count
    if len(files) > MAX_PHOTOS:
        raise HTTPException(
            status_code=400, 
            detail=f"Maximum {MAX_PHOTOS} photos allowed per session"
        )
    
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")
    
    # Create session
    session_id = str(uuid.uuid4())
    expires_at = datetime.utcnow() + timedelta(days=STORAGE_DAYS)
    
    theme_colors = {
        "primary": theme_primary,
        "secondary": theme_secondary
    }
    
    new_session = SessionModel(
        id=session_id,
        name=session_name,
        mode=session_mode,
        welcome_message=welcome_message,
        theme_colors=theme_colors,
        expires_at=expires_at
    )
    
    db.add(new_session)
    db.commit()
    
    # Upload photos
    uploaded_count = 0
    
    for file in files:
        if not file.content_type or not file.content_type.startswith('image/'):
            continue
        
        try:
            # Read file content
            content = await file.read()
            
            # Generate unique photo ID
            photo_id = str(uuid.uuid4())
            file_extension = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
            
            # R2 keys
            original_key = f"sessions/{session_id}/originals/{photo_id}.{file_extension}"
            thumbnail_key = f"sessions/{session_id}/thumbnails/{photo_id}.{file_extension}"
            
            # Upload original
            upload_file_to_r2(content, original_key, file.content_type)
            
            # Generate and upload thumbnail
            thumbnail_content = generate_thumbnail(content)
            upload_file_to_r2(thumbnail_content, thumbnail_key, "image/jpeg")
            
            # Save to database
            photo = PhotoModel(
                id=photo_id,
                session_id=session_id,
                original_filename=file.filename,
                r2_key_original=original_key,
                r2_key_thumbnail=thumbnail_key,
                file_size=len(content)
            )
            
            db.add(photo)
            uploaded_count += 1
            
        except Exception as e:
            print(f"Error uploading photo {file.filename}: {e}")
            continue
    
    # Update session photo count
    new_session.photo_count = uploaded_count
    db.commit()
    
    return {
        "session_id": session_id,
        "photo_count": uploaded_count,
        "share_url": f"{FRONTEND_URL}/session/{session_id}",
        "expires_at": expires_at.isoformat()
    }


@app.get("/api/session/{session_id}")
def get_session(session_id: str, db: Session = Depends(get_db)):
    """Get session details"""
    
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if expired
    if session.expires_at and session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Session has expired")
    
    return session.to_dict()


@app.get("/api/session/{session_id}/photos")
def get_session_photos(
    session_id: str,
    page: int = 1,
    per_page: int = 10,
    db: Session = Depends(get_db)
):
    """
    Get photos for a session with pagination
    
    Args:
        session_id: Session ID
        page: Page number (starts at 1)
        per_page: Photos per page (default 10)
    """
    
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check if expired
    if session.expires_at and session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Session has expired")
    
    # Get photos with pagination
    offset = (page - 1) * per_page
    photos = db.query(PhotoModel).filter(
        PhotoModel.session_id == session_id
    ).offset(offset).limit(per_page).all()
    
    # Get total count
    total_photos = db.query(PhotoModel).filter(
        PhotoModel.session_id == session_id
    ).count()
    
    total_pages = (total_photos + per_page - 1) // per_page
    
    return {
        "photos": [
            {
                "id": photo.id,
                "thumbnail_url": f"/api/photo/{photo.id}/thumbnail",
                "original_url": f"/api/photo/{photo.id}/original",
                "filename": photo.original_filename
            }
            for photo in photos
        ],
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total_photos": total_photos,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


@app.get("/api/photo/{photo_id}/thumbnail")
def get_photo_thumbnail(photo_id: str, db: Session = Depends(get_db)):
    """Get photo thumbnail"""
    
    photo = db.query(PhotoModel).filter(PhotoModel.id == photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        image_data = download_file_from_r2(photo.r2_key_thumbnail)
        return StreamingResponse(io.BytesIO(image_data), media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching photo: {str(e)}")


@app.get("/api/photo/{photo_id}/original")
def get_photo_original(photo_id: str, db: Session = Depends(get_db)):
    """Get original photo"""
    
    photo = db.query(PhotoModel).filter(PhotoModel.id == photo_id).first()
    
    if not photo:
        raise HTTPException(status_code=404, detail="Photo not found")
    
    try:
        image_data = download_file_from_r2(photo.r2_key_original)
        return StreamingResponse(io.BytesIO(image_data), media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching photo: {str(e)}")


@app.post("/api/session/{session_id}/download")
async def download_photos(
    session_id: str,
    photo_ids: List[str],
    db: Session = Depends(get_db)
):
    """
    Download selected photos as ZIP
    
    Args:
        session_id: Session ID
        photo_ids: List of photo IDs to include (empty list = all photos)
    """
    
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Get photos
    if photo_ids:
        # Download specific photos
        photos = db.query(PhotoModel).filter(
            PhotoModel.session_id == session_id,
            PhotoModel.id.in_(photo_ids)
        ).all()
    else:
        # Download all photos
        photos = db.query(PhotoModel).filter(
            PhotoModel.session_id == session_id
        ).all()
    
    if not photos:
        raise HTTPException(status_code=404, detail="No photos found")
    
    # Create ZIP in memory
    zip_buffer = io.BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for photo in photos:
            try:
                # Download original from R2
                image_data = download_file_from_r2(photo.r2_key_original)
                
                # Add to ZIP with original filename
                zip_file.writestr(photo.original_filename, image_data)
            except Exception as e:
                print(f"Error adding photo {photo.id} to ZIP: {e}")
                continue
    
    zip_buffer.seek(0)
    
    filename = f"{session.name.replace(' ', '_')}_{session_id[:8]}.zip"
    
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.put("/api/session/{session_id}/settings")
def update_session_settings(
    session_id: str,
    name: Optional[str] = None,
    mode: Optional[str] = None,
    welcome_message: Optional[str] = None,
    theme_primary: Optional[str] = None,
    theme_secondary: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Update session settings"""
    
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Update fields if provided
    if name:
        session.name = name
    if mode in ["privacy", "browse"]:
        session.mode = mode
    if welcome_message is not None:
        session.welcome_message = welcome_message
    
    # Update theme colors
    if theme_primary or theme_secondary:
        theme_colors = session.theme_colors or {}
        if theme_primary:
            theme_colors["primary"] = theme_primary
        if theme_secondary:
            theme_colors["secondary"] = theme_secondary
        session.theme_colors = theme_colors
    
    db.commit()
    
    return session.to_dict()


@app.delete("/api/session/{session_id}")
def delete_session(session_id: str, db: Session = Depends(get_db)):
    """Delete a session and all its photos"""
    
    session = db.query(SessionModel).filter(SessionModel.id == session_id).first()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Delete photos from R2
    photos = db.query(PhotoModel).filter(PhotoModel.session_id == session_id).all()
    
    for photo in photos:
        try:
            from r2_storage import delete_file_from_r2
            delete_file_from_r2(photo.r2_key_original)
            delete_file_from_r2(photo.r2_key_thumbnail)
        except Exception as e:
            print(f"Error deleting photo from R2: {e}")
    
    # Delete from database (cascade will delete photos)
    db.delete(session)
    db.commit()
    
    return {"message": "Session deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
