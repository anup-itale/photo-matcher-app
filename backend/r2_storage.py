import boto3
from botocore.client import Config
import os
from PIL import Image
import io

# R2 Configuration from environment variables
R2_ACCOUNT_ID = os.getenv("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
R2_ENDPOINT = os.getenv("R2_ENDPOINT")

# Validate configuration
if not all([R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_ENDPOINT]):
    raise ValueError("R2 configuration incomplete. Check environment variables.")

# Create S3 client for R2
s3_client = boto3.client(
    's3',
    endpoint_url=R2_ENDPOINT,
    aws_access_key_id=R2_ACCESS_KEY_ID,
    aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    config=Config(signature_version='s3v4'),
    region_name='auto'
)


def upload_file_to_r2(file_content: bytes, key: str, content_type: str = "image/jpeg") -> str:
    """
    Upload a file to R2
    
    Args:
        file_content: File content as bytes
        key: Path in R2 bucket (e.g., "sessions/abc123/photo1.jpg")
        content_type: MIME type
    
    Returns:
        The key of the uploaded file
    """
    try:
        s3_client.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Body=file_content,
            ContentType=content_type
        )
        return key
    except Exception as e:
        print(f"Error uploading to R2: {e}")
        raise


def download_file_from_r2(key: str) -> bytes:
    """
    Download a file from R2
    
    Args:
        key: Path in R2 bucket
    
    Returns:
        File content as bytes
    """
    try:
        response = s3_client.get_object(Bucket=R2_BUCKET_NAME, Key=key)
        return response['Body'].read()
    except Exception as e:
        print(f"Error downloading from R2: {e}")
        raise


def delete_file_from_r2(key: str):
    """Delete a file from R2"""
    try:
        s3_client.delete_object(Bucket=R2_BUCKET_NAME, Key=key)
    except Exception as e:
        print(f"Error deleting from R2: {e}")
        raise


def generate_thumbnail(image_content: bytes, max_size: tuple = (800, 800)) -> bytes:
    """
    Generate a thumbnail from image content
    
    Args:
        image_content: Original image as bytes
        max_size: Maximum dimensions (width, height)
    
    Returns:
        Thumbnail image as bytes
    """
    try:
        # Open image
        img = Image.open(io.BytesIO(image_content))
        
        # Convert RGBA to RGB if necessary
        if img.mode == 'RGBA':
            img = img.convert('RGB')
        
        # Generate thumbnail (maintains aspect ratio)
        img.thumbnail(max_size, Image.Resampling.LANCZOS)
        
        # Save to bytes
        output = io.BytesIO()
        img.save(output, format='JPEG', quality=85, optimize=True)
        output.seek(0)
        
        return output.read()
    except Exception as e:
        print(f"Error generating thumbnail: {e}")
        raise


def get_public_url(key: str) -> str:
    """
    Get public URL for an R2 object
    Note: R2 bucket must be configured for public access
    """
    return f"{R2_ENDPOINT.replace('.r2.cloudflarestorage.com', '.r2.dev')}/{key}"
