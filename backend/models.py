from sqlalchemy import Column, String, Integer, DateTime, Boolean, JSON, ForeignKey, Text, Float
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta
import uuid

Base = declarative_base()

def generate_uuid():
    return str(uuid.uuid4())

class Session(Base):
    """Photo session created by host"""
    __tablename__ = "sessions"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    
    # Session settings
    name = Column(String, nullable=False)  # e.g., "Priya & Rahul's Wedding"
    mode = Column(String, default="browse")  # "privacy" or "browse"
    
    # Customization
    cover_photo_url = Column(String, nullable=True)
    welcome_message = Column(Text, nullable=True)
    theme_colors = Column(JSON, nullable=True)  # {"primary": "#FF6B35", "secondary": "#F7931E"}
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime, default=lambda: datetime.utcnow() + timedelta(days=7))
    photo_count = Column(Integer, default=0)
    
    # Relationships
    photos = relationship("Photo", back_populates="session", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "mode": self.mode,
            "cover_photo_url": self.cover_photo_url,
            "welcome_message": self.welcome_message,
            "theme_colors": self.theme_colors,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "photo_count": self.photo_count
        }


class Photo(Base):
    """Individual photo in a session"""
    __tablename__ = "photos"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False)
    
    # File info
    original_filename = Column(String, nullable=False)
    r2_key_original = Column(String, nullable=False)  # Path in R2 for original
    r2_key_thumbnail = Column(String, nullable=False)  # Path in R2 for thumbnail
    
    # Metadata
    uploaded_at = Column(DateTime, default=datetime.utcnow)
    file_size = Column(Integer)  # Size in bytes
    
    # Relationships
    session = relationship("Session", back_populates="photos")
    face_descriptors = relationship("FaceDescriptor", back_populates="photo", cascade="all, delete-orphan")
    
    def to_dict(self):
        return {
            "id": self.id,
            "session_id": self.session_id,
            "original_filename": self.original_filename,
            "uploaded_at": self.uploaded_at.isoformat() if self.uploaded_at else None,
            "file_size": self.file_size,
            "face_count": len(self.face_descriptors) if self.face_descriptors else 0
        }


class FaceDescriptor(Base):
    """Face descriptors extracted from photos (for future use if needed)"""
    __tablename__ = "face_descriptors"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    photo_id = Column(String, ForeignKey("photos.id", ondelete="CASCADE"), nullable=False)
    
    # Face data (stored as JSON for now, not used in free tier but ready for future)
    descriptor_data = Column(JSON, nullable=True)  # 128-number array
    quality_score = Column(Float, nullable=True)  # 0-1, face quality
    is_primary = Column(Boolean, default=False)  # Is this the best face in photo?
    
    # Relationships
    photo = relationship("Photo", back_populates="face_descriptors")
