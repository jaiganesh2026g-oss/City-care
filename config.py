"""
CityCare - Backend Database Configuration

Set your MongoDB Connection String (MongoDB Atlas or Local MongoDB) here.
Example MongoDB Atlas URI:
MONGODB_URI = "mongodb+srv://<username>:<password>@cluster0.mongodb.net/citycare_db?retryWrites=true&w=majority"
"""

import os

# MongoDB Connection String (URL)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/citycare_db")

# Database & Collection Names
DB_NAME = "citycare_db"
USERS_COLLECTION = "users"
COMPLAINTS_COLLECTION = "complaints"

# Server Port & Security
PORT = 8000
SECRET_KEY = "citycare_sec_key_2026"
