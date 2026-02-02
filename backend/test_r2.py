from dotenv import load_dotenv
load_dotenv()

from r2_storage import s3_client, R2_BUCKET_NAME

print("Testing R2 connection...")

try:
    # List objects in bucket
    response = s3_client.list_objects_v2(Bucket=R2_BUCKET_NAME, MaxKeys=1)
    print(f"✓ Successfully connected to R2 bucket: {R2_BUCKET_NAME}")
    print(f"  Bucket exists and is accessible!")
except Exception as e:
    print(f"✗ R2 connection failed: {e}")
    exit(1)

print("\nR2 is ready!")
