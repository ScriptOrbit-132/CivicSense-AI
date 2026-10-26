import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", "civicsense-ai-super-secret-key-2026")
    DATABASE_PATH = os.path.join(BASE_DIR, "civicsense.db")
    UPLOAD_FOLDER = os.path.join(BASE_DIR, "static", "uploads")
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB max upload
    ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "webp", "gif", "mp3", "wav", "m4a", "webm"}
    GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
    # Default city coords (e.g., Central City / Bangalore / New Delhi / San Francisco - configurable)
    DEFAULT_LAT = float(os.getenv("DEFAULT_LAT", "12.9716"))
    DEFAULT_LNG = float(os.getenv("DEFAULT_LNG", "77.5946"))
    CITY_NAME = os.getenv("CITY_NAME", "Metro City")
