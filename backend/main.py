from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from typing import List
import os
import uuid
import json
from datetime import datetime
from pathlib import Path
import zipfile
import io

app = FastAPI(title="Photo Matcher API")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Create necessary directories
UPLOAD_DIR = Path("../uploads")
SESSIONS_DIR = UPLOAD_DIR / "sessions"
UPLOAD_DIR.mkdir(exist_ok=True)
SESSIONS_DIR.mkdir(exist_ok=True)

# Simple JSON-based storage for session metadata
SESSIONS_FILE = UPLOAD_DIR / "sessions.json"

def load_sessions():
    if SESSIONS_FILE.exists():
        with open(SESSIONS_FILE, 'r') as f:
            return json.load(f)
    return {}

def save_sessions(sessions):
    with open(SESSIONS_FILE, 'w') as f:
        json.dump(sessions, f, indent=2)

@app.get("/")
def read_root():
    return {"message": "Photo Matcher API", "version": "1.0"}

@app.post("/api/host/create-session")
async def create_session(files: List[UploadFile] = File(...)):
    if not files:
        raise HTTPException(status_code=400, detail="No files uploaded")

    session_id = str(uuid.uuid4())
    session_dir = SESSIONS_DIR / session_id
    session_dir.mkdir(exist_ok=True)

    saved_files = []
    for file in files:
        if not file.content_type.startswith('image/'):
            continue

        file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
        file_id = str(uuid.uuid4())
        filename = f"{file_id}.{file_ext}"
        file_path = session_dir / filename

        with open(file_path, 'wb') as f:
            content = await file.read()
            f.write(content)

        saved_files.append({
            'id': file_id,
            'filename': filename,
            'original_name': file.filename
        })

    sessions = load_sessions()
    sessions[session_id] = {
        'id': session_id,
        'created_at': datetime.now().isoformat(),
        'photo_count': len(saved_files),
        'photos': saved_files
    }
    save_sessions(sessions)

    return {
        'session_id': session_id,
        'photo_count': len(saved_files),
        'share_url': f"http://localhost:5173/session/{session_id}"
    }

@app.get("/api/session/{session_id}")
def get_session(session_id: str):
    sessions = load_sessions()
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")
    return sessions[session_id]

@app.get("/api/session/{session_id}/photos")
def get_session_photos(session_id: str):
    sessions = load_sessions()
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    photos = []
    for photo in session['photos']:
        photos.append({
            'id': photo['id'],
            'url': f"/api/session/{session_id}/photo/{photo['filename']}"
        })
    return {'photos': photos}

@app.get("/api/session/{session_id}/photo/{filename}")
def get_photo(session_id: str, filename: str):
    sessions = load_sessions()
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    photo_path = SESSIONS_DIR / session_id / filename
    if not photo_path.exists():
        raise HTTPException(status_code=404, detail="Photo not found")

    return FileResponse(photo_path)

@app.post("/api/session/{session_id}/download")
async def download_photos(session_id: str, photo_ids: List[str]):
    sessions = load_sessions()
    if session_id not in sessions:
        raise HTTPException(status_code=404, detail="Session not found")

    session = sessions[session_id]
    zip_buffer = io.BytesIO()

    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for photo in session['photos']:
            if photo['id'] in photo_ids:
                photo_path = SESSIONS_DIR / session_id / photo['filename']
                if photo_path.exists():
                    zip_file.write(photo_path, photo['original_name'])

    zip_buffer.seek(0)
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={"Content-Disposition": f"attachment; filename=photos_{session_id[:8]}.zip"}
    )

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
