from database import init_db, engine
from sqlalchemy import text

if __name__ == "__main__":
    print("Initializing database...")
    
    # Test connection first
    try:
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1"))
            print("✓ Database connection successful!")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        exit(1)
    
    # Create tables
    try:
        init_db()
        print("✓ Database initialized successfully!")
    except Exception as e:
        print(f"✗ Database initialization failed: {e}")
        exit(1)
    
    print("\nDatabase is ready!")
