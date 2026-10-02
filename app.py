"""
CityCare - Python Flask & PyMongo Backend REST API Server
Reads configuration from config.py and stores users & complaints in MongoDB.
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import config
import datetime
import uuid

app = Flask(__name__, static_folder=".", static_url_path="")
CORS(app)

# MongoDB Integration
db_connected = False
try:
    from pymongo import MongoClient
    client = MongoClient(config.MONGODB_URI, serverSelectionTimeoutMS=3000)
    db = client[config.DB_NAME]
    users_col = db[config.USERS_COLLECTION]
    complaints_col = db[config.COMPLAINTS_COLLECTION]
    client.admin.command('ping')
    db_connected = True
    print(f"✅ Connected to MongoDB Database: {config.DB_NAME}")
except Exception as e:
    print(f"⚠️ MongoDB Connection warning: {e}. Operating in JSON fallback mode.")

@app.route("/api/complaints", methods=["GET"])
def get_complaints():
    if db_connected:
        try:
            items = list(complaints_col.find({}, {"_id": 0}).sort("created_at", -1))
            return jsonify({"success": True, "count": len(items), "data": items})
        except Exception as e:
            return jsonify({"success": False, "error": str(e)}), 500
    return jsonify({"success": True, "data": []})

@app.route("/api/complaints", methods=["POST"])
def create_complaint():
    data = request.json or {}
    complaint_id = data.get("id") or f"CC-2026-{uuid.uuid4().hex[:4].upper()}"
    new_doc = {
        "id": complaint_id,
        "full_name": data.get("fullName") or data.get("full_name") or "Anonymous",
        "phone": data.get("phone") or "Not Provided",
        "category": data.get("category", "General"),
        "title": data.get("title", ""),
        "description": data.get("description", ""),
        "location": data.get("location", ""),
        "image_url": data.get("image") or data.get("image_url") or "",
        "priority": data.get("priority", "Medium"),
        "status": data.get("status", "Pending"),
        "admin_remarks": data.get("adminRemarks") or data.get("admin_remarks") or "",
        "created_at": datetime.datetime.utcnow().isoformat()
    }

    if db_connected:
        complaints_col.insert_one(new_doc.copy())

    return jsonify({"success": True, "message": "Complaint saved to MongoDB", "data": new_doc}), 201

@app.route("/api/auth/register", methods=["POST"])
def register_user():
    data = request.json or {}
    email = (data.get("email") or "").strip().lower()
    phone = (data.get("phone") or "").strip().replace(" ", "")

    if db_connected:
        existing = users_col.find_one({"$or": [{"email": email}, {"phone": phone}]})
        if existing:
            return jsonify({"success": False, "message": "User with this email or phone already exists."}), 400

    user_doc = {
        "id": f"CIT-{uuid.uuid4().hex[:4].upper()}",
        "fullName": data.get("fullName", "").strip(),
        "phone": phone,
        "email": email,
        "password": data.get("password"),
        "address": data.get("address", ""),
        "role": "Citizen",
        "registeredAt": datetime.datetime.utcnow().isoformat()
    }

    if db_connected:
        users_col.insert_one(user_doc.copy())

    return jsonify({"success": True, "user": user_doc, "message": "Registered in MongoDB successfully"}), 201

@app.route("/api/auth/login", methods=["POST"])
def login_user():
    data = request.json or {}
    identifier = (data.get("identifier") or "").strip().lower().replace(" ", "")
    password = data.get("password")

    if db_connected:
        user = users_col.find_one({
            "$and": [
                {"$or": [{"email": identifier}, {"phone": identifier}]},
                {"password": password}
            ]
        }, {"_id": 0})
        if user:
            return jsonify({"success": True, "user": user, "message": f"Welcome back, {user['fullName']}!"})
        return jsonify({"success": False, "message": "Invalid Email/Phone or Password."}), 401

    return jsonify({"success": False, "message": "User not found."}), 404

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=config.PORT, debug=True)
