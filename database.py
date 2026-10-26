import sqlite3
import os
import json
import uuid
from datetime import datetime
from config import Config

def get_db():
    conn = sqlite3.connect(Config.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs(os.path.dirname(Config.DATABASE_PATH), exist_ok=True)
    os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)
    
    conn = get_db()
    cursor = conn.cursor()
    
    # Complaints Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS complaints (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tracking_id TEXT UNIQUE NOT NULL,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        category TEXT NOT NULL,
        priority TEXT NOT NULL,
        severity_score INTEGER NOT NULL DEFAULT 50,
        department TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Reported',
        citizen_name TEXT DEFAULT 'Anonymous Citizen',
        citizen_phone TEXT DEFAULT '',
        citizen_email TEXT DEFAULT '',
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        address TEXT NOT NULL,
        image_path TEXT DEFAULT '',
        voice_transcript TEXT DEFAULT '',
        ai_confidence REAL DEFAULT 0.95,
        ai_reasoning TEXT DEFAULT '',
        is_duplicate INTEGER DEFAULT 0,
        duplicate_of_id INTEGER DEFAULT NULL,
        upvotes_count INTEGER DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (duplicate_of_id) REFERENCES complaints(id)
    )
    """)
    
    # Status Audit History
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS status_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        complaint_id INTEGER NOT NULL,
        old_status TEXT NOT NULL,
        new_status TEXT NOT NULL,
        changed_by TEXT NOT NULL,
        notes TEXT DEFAULT '',
        proof_image TEXT DEFAULT '',
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id)
    )
    """)

    # AI Digest / Daily Summaries Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS ai_digests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        digest_title TEXT NOT NULL,
        summary_markdown TEXT NOT NULL,
        critical_hotspots TEXT NOT NULL,
        stats_snapshot TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """)
    
    conn.commit()
    seed_demo_data(conn)
    conn.close()

def generate_tracking_id():
    now = datetime.now()
    rand_suffix = uuid.uuid4().hex[:5].upper()
    return f"CIVIC-{now.year}-{rand_suffix}"

def seed_demo_data(conn):
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM complaints")
    count = cursor.fetchone()[0]
    if count > 0:
        return  # Already seeded
    
    sample_reports = [
        {
            "tracking_id": "CIVIC-2026-A109F",
            "title": "Severe Deep Pothole on Commercial Arterial Road",
            "description": "Deep 1.5-foot crater in the right lane near the metro pillar 142. Two two-wheelers skidded this morning during rain. Dangerous hazard for high-speed night traffic.",
            "category": "Road Damage & Potholes",
            "priority": "Critical",
            "severity_score": 92,
            "department": "Roads & Transportation Infrastructure",
            "status": "In Progress",
            "citizen_name": "Rohan Deshmukh",
            "citizen_phone": "+91 98450 11234",
            "citizen_email": "rohan.desh@example.com",
            "latitude": 12.9784,
            "longitude": 77.5960,
            "address": "MG Road near Metro Pillar 142, Central Zone",
            "image_path": "sample_pothole.jpg",
            "voice_transcript": "There is a massive pothole right opposite the metro pillar, water is logged and vehicles are violently dodging it.",
            "ai_confidence": 0.96,
            "ai_reasoning": json.dumps({
                "detected_objects": ["Deep asphalt crater", "Water pooling", "Traffic proximity"],
                "risk_factors": ["High accident risk for two-wheelers", "Structural road erosion"],
                "recommended_action": "Emergency cold asphalt patch mix within 12 hours followed by asphalt compaction",
                "estimated_repair_time": "24 Hours",
                "urgency_rationale": "High-traffic commercial street with vehicle hazard and wet weather compounding danger."
            }),
            "is_duplicate": 0,
            "duplicate_of_id": None,
            "upvotes_count": 8,
            "created_at": "2026-10-25 09:30:00"
        },
        {
            "tracking_id": "CIVIC-2026-B882C",
            "title": "Massive Overflowing Garbage Dump Blocking Footpath",
            "description": "Community bin has not been cleared for 4 days. Organic and plastic waste spilling across sidewalk and onto residential street. Foul odor and stray animals gathering.",
            "category": "Garbage & Waste Management",
            "priority": "High",
            "severity_score": 78,
            "department": "Solid Waste & Sanitation Department",
            "status": "Assigned",
            "citizen_name": "Priya Sharma",
            "citizen_phone": "+91 99123 45678",
            "citizen_email": "priya.sharma@example.com",
            "latitude": 12.9692,
            "longitude": 77.6045,
            "address": "8th Main, Ward 112, Indiranagar Sector 2",
            "image_path": "sample_garbage.jpg",
            "voice_transcript": "The garbage bins in 8th Main are completely full, garbage is all over the walking path and dogs are tearing bags open.",
            "ai_confidence": 0.94,
            "ai_reasoning": json.dumps({
                "detected_objects": ["Uncompacted waste pile", "Decomposing organic matter", "Blocked pedestrian pathway"],
                "risk_factors": ["Vector-borne disease outbreak risk", "Pedestrians forced into vehicular traffic lane"],
                "recommended_action": "Deploy hydraulic dumper truck and sanitize ground with lime powder",
                "estimated_repair_time": "12 Hours",
                "urgency_rationale": "Public health sanitation violation in high-density residential locality."
            }),
            "is_duplicate": 0,
            "duplicate_of_id": None,
            "upvotes_count": 5,
            "created_at": "2026-10-25 14:15:00"
        },
        {
            "tracking_id": "CIVIC-2026-C441E",
            "title": "High-Pressure Water Main Burst Flooding Junction",
            "description": "Potable water pipeline rupture underneath the sidewalk. Clean drinking water gushing at high pressure, eroding soil foundation and flooding the junction.",
            "category": "Water Supply & Leakage",
            "priority": "Critical",
            "severity_score": 96,
            "department": "Municipal Water Supply & Sewerage Board",
            "status": "Reported",
            "citizen_name": "Vikram Iyer",
            "citizen_phone": "+91 97234 56789",
            "citizen_email": "vikram.i@example.com",
            "latitude": 12.9620,
            "longitude": 77.5880,
            "address": "South End Circle near Park Gate, Ward 85",
            "image_path": "sample_waterleak.jpg",
            "voice_transcript": "A major water pipe burst here. Drinking water is shooting up 3 feet high and submerging the road.",
            "ai_confidence": 0.98,
            "ai_reasoning": json.dumps({
                "detected_objects": ["Pressurized water plume", "Soil washout", "Localized street ponding"],
                "risk_factors": ["Severe potable water wastage", "Sub-surface ground erosion and potential sinkhole"],
                "recommended_action": "Immediate isolation valve shut-off; pipe sleeve replacement crew dispatch",
                "estimated_repair_time": "6 Hours",
                "urgency_rationale": "Massive loss of treated city water and imminent risk of road surface collapse."
            }),
            "is_duplicate": 0,
            "duplicate_of_id": None,
            "upvotes_count": 14,
            "created_at": "2026-10-26 08:20:00"
        },
        {
            "tracking_id": "CIVIC-2026-D902A",
            "title": "Damaged Streetlight with Exposed Electrical Wiring",
            "description": "Streetlight pole hit by truck. Fixture hanging loose and open wiring exposed at eye level near primary school bus stop.",
            "category": "Electrical & Streetlighting",
            "priority": "Critical",
            "severity_score": 90,
            "department": "City Electricity & Lighting Board",
            "status": "Assigned",
            "citizen_name": "Anita Rao",
            "citizen_phone": "+91 98888 23456",
            "citizen_email": "anita.rao@example.com",
            "latitude": 12.9750,
            "longitude": 77.6100,
            "address": "School Road, Trinity Crossing, Ward 94",
            "image_path": "sample_streetlight.jpg",
            "voice_transcript": "Street lamp pole is leaning badly with live wires hanging down right where kids wait for school bus.",
            "ai_confidence": 0.95,
            "ai_reasoning": json.dumps({
                "detected_objects": ["Tilted steel pole", "Bare electrical wires", "Damaged luminaire housing"],
                "risk_factors": ["High risk of electrocution to pedestrians and school children", "Darkness at night causing collisions"],
                "recommended_action": "Kill power circuit at feeder pillar, replace pole foundation and secure cabling",
                "estimated_repair_time": "18 Hours",
                "urgency_rationale": "Direct life-safety electrical hazard adjacent to children's transit zone."
            }),
            "is_duplicate": 0,
            "duplicate_of_id": None,
            "upvotes_count": 6,
            "created_at": "2026-10-25 18:40:00"
        },
        {
            "tracking_id": "CIVIC-2026-E512B",
            "title": "Fallen Tree Branch Obstructing Single-Lane Residential By-pass",
            "description": "Large eucalyptus branch snapped during thunderstorm, resting across road. Emergency vehicles cannot pass through.",
            "category": "Public Hazards & Trees",
            "priority": "Medium",
            "severity_score": 60,
            "department": "Parks & Urban Forestry Division",
            "status": "Resolved",
            "citizen_name": "Arun Kumar",
            "citizen_phone": "+91 94444 88776",
            "citizen_email": "arun.k@example.com",
            "latitude": 12.9820,
            "longitude": 77.5850,
            "address": "4th Cross, Malleshwaram West",
            "image_path": "sample_tree.jpg",
            "voice_transcript": "A huge branch fell down and completely blocked the lane.",
            "ai_confidence": 0.92,
            "ai_reasoning": json.dumps({
                "detected_objects": ["Tree limb obstruction", "Road blockage", "Overhead cable entanglement"],
                "risk_factors": ["Fire and ambulance access delay", "Minor pedestrian trip hazard"],
                "recommended_action": "Chainsaw crew dispatch for sectioning and municipal flatbed removal",
                "estimated_repair_time": "12 Hours",
                "urgency_rationale": "Secondary road closure impeding residential traffic flow."
            }),
            "is_duplicate": 0,
            "duplicate_of_id": None,
            "upvotes_count": 3,
            "created_at": "2026-10-24 11:00:00"
        }
    ]
    
    for r in sample_reports:
        cursor.execute("""
        INSERT INTO complaints (
            tracking_id, title, description, category, priority, severity_score,
            department, status, citizen_name, citizen_phone, citizen_email,
            latitude, longitude, address, image_path, voice_transcript,
            ai_confidence, ai_reasoning, is_duplicate, duplicate_of_id,
            upvotes_count, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            r["tracking_id"], r["title"], r["description"], r["category"], r["priority"],
            r["severity_score"], r["department"], r["status"], r["citizen_name"],
            r["citizen_phone"], r["citizen_email"], r["latitude"], r["longitude"],
            r["address"], r["image_path"], r["voice_transcript"], r["ai_confidence"],
            r["ai_reasoning"], r["is_duplicate"], r["duplicate_of_id"],
            r["upvotes_count"], r["created_at"], r["created_at"]
        ))
        complaint_id = cursor.lastrowid
        
        # Add initial audit log
        cursor.execute("""
        INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes, timestamp)
        VALUES (?, 'None', 'Reported', 'CivicSense AI Ingestion System', 'Citizen report successfully verified and categorized via Generative AI.', ?)
        """, (complaint_id, r["created_at"]))
        
        if r["status"] in ["Assigned", "In Progress", "Resolved"]:
            cursor.execute("""
            INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes, timestamp)
            VALUES (?, 'Reported', 'Assigned', 'Automated Dispatch AI', 'Assigned directly to ' || ?, ?)
            """, (complaint_id, r["department"], r["created_at"]))
            
        if r["status"] in ["In Progress", "Resolved"]:
            cursor.execute("""
            INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes, timestamp)
            VALUES (?, 'Assigned', 'In Progress', 'Ward Field Superintendent', 'Repair team and materials dispatched to location.', ?)
            """, (complaint_id, r["created_at"]))
            
        if r["status"] == "Resolved":
            cursor.execute("""
            INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes, timestamp)
            VALUES (?, 'In Progress', 'Resolved', 'Ward Field Superintendent', 'Obstruction cleared, road restored and verified by field inspection.', ?)
            """, (complaint_id, r["created_at"]))
            
    conn.commit()
