import os
import json
import logging
from datetime import datetime
from flask import Flask, render_template, request, jsonify, redirect, url_for, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from config import Config
from database import get_db, init_db, generate_tracking_id
import ai_service

# Logging Setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Ensure required folders exist
os.makedirs(Config.UPLOAD_FOLDER, exist_ok=True)

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in Config.ALLOWED_EXTENSIONS

# ==========================================
# PAGE ROUTES
# ==========================================

@app.route("/")
def index():
    """Citizen Reporting & Civic Home Page"""
    return render_template("index.html", default_lat=Config.DEFAULT_LAT, default_lng=Config.DEFAULT_LNG, city_name=Config.CITY_NAME)

@app.route("/track")
def track():
    """Citizen Complaint Tracking Portal"""
    tracking_id = request.args.get("id", "").strip()
    return render_template("track.html", tracking_id=tracking_id)

@app.route("/track/<tracking_id>")
def track_direct(tracking_id):
    """Direct link for specific tracking ID"""
    return render_template("track.html", tracking_id=tracking_id)

@app.route("/admin")
def admin():
    """Municipal Authority Command Center & Dashboard"""
    return render_template("admin.html", default_lat=Config.DEFAULT_LAT, default_lng=Config.DEFAULT_LNG, city_name=Config.CITY_NAME)

# ==========================================
# API ROUTES
# ==========================================

@app.route("/api/analyze-preview", methods=["POST"])
def analyze_preview():
    """
    On-the-fly AI pre-inspection for the citizen reporting form.
    Provides instant feedback on category, severity, and hazards before submission.
    """
    description = request.form.get("description", "")
    voice_transcript = request.form.get("voice_transcript", "")
    address = request.form.get("address", "")
    
    saved_path = None
    if "image" in request.files:
        file = request.files["image"]
        if file and file.filename != "" and allowed_file(file.filename):
            filename = f"temp_preview_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{secure_filename(file.filename)}"
            saved_path = os.path.join(Config.UPLOAD_FOLDER, filename)
            file.save(saved_path)

    try:
        analysis = ai_service.analyze_civic_complaint(
            image_path=saved_path,
            description=description,
            voice_transcript=voice_transcript,
            location_address=address
        )
        return jsonify({"success": True, "analysis": analysis})
    except Exception as e:
        logger.error(f"Error in analyze-preview: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        # Clean up temporary preview file if needed
        if saved_path and os.path.exists(saved_path) and "temp_preview" in saved_path:
            try:
                os.remove(saved_path)
            except Exception:
                pass


@app.route("/api/report", methods=["POST"])
def submit_report():
    """
    Submits a new civic complaint.
    Executes Generative AI analysis, duplicate detection, and stores the record.
    """
    try:
        description = request.form.get("description", "").strip()
        voice_transcript = request.form.get("voice_transcript", "").strip()
        citizen_name = request.form.get("citizen_name", "Anonymous Citizen").strip() or "Anonymous Citizen"
        citizen_phone = request.form.get("citizen_phone", "").strip()
        citizen_email = request.form.get("citizen_email", "").strip()
        address = request.form.get("address", "Unspecified Location").strip()
        
        try:
            latitude = float(request.form.get("latitude", Config.DEFAULT_LAT))
            longitude = float(request.form.get("longitude", Config.DEFAULT_LNG))
        except (ValueError, TypeError):
            latitude = Config.DEFAULT_LAT
            longitude = Config.DEFAULT_LNG

        # Handle Image Upload
        image_filename = ""
        saved_image_path = None
        if "image" in request.files:
            file = request.files["image"]
            if file and file.filename != "" and allowed_file(file.filename):
                ext = file.filename.rsplit('.', 1)[1].lower()
                unique_name = f"issue_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.urandom(4).hex()}.{ext}"
                saved_image_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
                file.save(saved_image_path)
                image_filename = unique_name

        # Execute AI Multimodal Analysis
        ai_result = ai_service.analyze_civic_complaint(
            image_path=saved_image_path,
            description=description,
            voice_transcript=voice_transcript,
            location_address=address
        )

        title = ai_result.get("title", "Civic Incident Reported")
        category = ai_result.get("category", "General Civic")
        department = ai_result.get("department", "General Municipal Administration")
        priority = ai_result.get("priority", "Medium")
        severity_score = int(ai_result.get("severity_score", 50))
        ai_confidence = float(ai_result.get("ai_confidence", 0.90))

        # Check for Duplicates in Database
        conn = get_db()
        cursor = conn.cursor()
        cursor.execute("SELECT id, tracking_id, title, description, category, latitude, longitude, status, upvotes_count FROM complaints WHERE status != 'Resolved'")
        existing_rows = [dict(row) for row in cursor.fetchall()]

        new_incident_payload = {
            "latitude": latitude,
            "longitude": longitude,
            "category": category,
            "title": title,
            "description": description
        }

        dup_check = ai_service.detect_duplicates(new_incident_payload, existing_rows)
        is_duplicate = 1 if dup_check["is_duplicate"] else 0
        duplicate_of_id = dup_check["match_id"] if dup_check["is_duplicate"] else None

        tracking_id = generate_tracking_id()

        cursor.execute("""
        INSERT INTO complaints (
            tracking_id, title, description, category, priority, severity_score,
            department, status, citizen_name, citizen_phone, citizen_email,
            latitude, longitude, address, image_path, voice_transcript,
            ai_confidence, ai_reasoning, is_duplicate, duplicate_of_id, upvotes_count
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            tracking_id, title, description, category, priority, severity_score,
            department, "Reported", citizen_name, citizen_phone, citizen_email,
            latitude, longitude, address, image_filename, voice_transcript,
            ai_confidence, json.dumps(ai_result), is_duplicate, duplicate_of_id, 1
        ))
        
        new_complaint_id = cursor.lastrowid

        # If it's a duplicate of an existing ticket, increment the primary ticket's upvotes and log it
        if is_duplicate and duplicate_of_id:
            cursor.execute("UPDATE complaints SET upvotes_count = upvotes_count + 1 WHERE id = ?", (duplicate_of_id,))
            cursor.execute("""
            INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes)
            VALUES (?, 'Active', 'Active', 'CivicSense AI Deduplication', ?)
            """, (duplicate_of_id, f"Corroborating citizen report filed ({tracking_id}). Community urgency upvoted."))

        # Create initial audit log for the new report
        cursor.execute("""
        INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes)
        VALUES (?, 'None', 'Reported', 'CivicSense AI Ingestion', ?)
        """, (
            new_complaint_id,
            f"AI verified {category} ({priority} priority, Severity: {severity_score}/100). Assigned to {department}."
        ))

        conn.commit()
        conn.close()

        return jsonify({
            "success": True,
            "tracking_id": tracking_id,
            "complaint_id": new_complaint_id,
            "is_duplicate": is_duplicate,
            "duplicate_info": dup_check if is_duplicate else None,
            "ai_analysis": ai_result,
            "message": "Complaint successfully registered and analyzed."
        })

    except Exception as e:
        logger.error(f"Error in submit_report: {e}", exc_info=True)
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/complaints", methods=["GET"])
def get_complaints():
    """Lists all complaints with optional filtering"""
    category = request.args.get("category", "").strip()
    status = request.args.get("status", "").strip()
    priority = request.args.get("priority", "").strip()
    search = request.args.get("search", "").strip()
    limit = int(request.args.get("limit", 100))

    query = "SELECT * FROM complaints WHERE 1=1"
    params = []

    if category and category != "All":
        query += " AND category = ?"
        params.append(category)

    if status and status != "All":
        query += " AND status = ?"
        params.append(status)

    if priority and priority != "All":
        query += " AND priority = ?"
        params.append(priority)

    if search:
        query += " AND (title LIKE ? OR description LIKE ? OR tracking_id LIKE ? OR address LIKE ?)"
        term = f"%{search}%"
        params.extend([term, term, term, term])

    query += " ORDER BY CASE priority WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END, created_at DESC LIMIT ?"
    params.append(limit)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    
    complaints = []
    for r in rows:
        c = dict(r)
        if c.get("ai_reasoning"):
            try:
                c["ai_reasoning"] = json.loads(c["ai_reasoning"])
            except Exception:
                pass
        complaints.append(c)

    conn.close()
    return jsonify({"success": True, "complaints": complaints, "total": len(complaints)})


@app.route("/api/complaint/<tracking_id>", methods=["GET"])
def get_complaint_by_tracking_id(tracking_id):
    """Fetches full complaint details and audit history for tracking"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints WHERE tracking_id = ? OR id = ?", (tracking_id, tracking_id))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Complaint tracking ID not found"}), 404

    complaint = dict(row)
    if complaint.get("ai_reasoning"):
        try:
            complaint["ai_reasoning"] = json.loads(complaint["ai_reasoning"])
        except Exception:
            pass

    # Fetch status history
    cursor.execute("SELECT * FROM status_history WHERE complaint_id = ? ORDER BY timestamp ASC", (complaint["id"],))
    history_rows = cursor.fetchall()
    history = [dict(h) for h in history_rows]

    conn.close()
    return jsonify({"success": True, "complaint": complaint, "history": history})


@app.route("/api/complaint/<int:complaint_id>/status", methods=["POST"])
def update_complaint_status(complaint_id):
    """Updates complaint status, logs municipal notes and proof image"""
    new_status = request.form.get("status", "").strip()
    notes = request.form.get("notes", "").strip()
    officer_name = request.form.get("officer_name", "Municipal Ward Officer").strip()

    valid_statuses = ["Reported", "Under Review", "Assigned", "In Progress", "Resolved"]
    if new_status not in valid_statuses:
        return jsonify({"success": False, "error": "Invalid status transition"}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints WHERE id = ?", (complaint_id,))
    row = cursor.fetchone()

    if not row:
        conn.close()
        return jsonify({"success": False, "error": "Complaint not found"}), 404

    old_status = row["status"]

    # Handle resolution proof image upload if provided
    proof_image_name = ""
    if "proof_image" in request.files:
        file = request.files["proof_image"]
        if file and file.filename != "" and allowed_file(file.filename):
            ext = file.filename.rsplit('.', 1)[1].lower()
            proof_image_name = f"proof_{complaint_id}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"
            file.save(os.path.join(Config.UPLOAD_FOLDER, proof_image_name))

    # Update complaint
    cursor.execute("""
    UPDATE complaints
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
    """, (new_status, complaint_id))

    # Insert audit record
    cursor.execute("""
    INSERT INTO status_history (complaint_id, old_status, new_status, changed_by, notes, proof_image)
    VALUES (?, ?, ?, ?, ?, ?)
    """, (complaint_id, old_status, new_status, officer_name, notes, proof_image_name))

    conn.commit()
    conn.close()

    return jsonify({"success": True, "message": f"Status updated to '{new_status}' successfully."})


@app.route("/api/complaint/<int:complaint_id>/upvote", methods=["POST"])
def upvote_complaint(complaint_id):
    """Community citizen upvote to elevate priority"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("UPDATE complaints SET upvotes_count = upvotes_count + 1 WHERE id = ?", (complaint_id,))
    cursor.execute("SELECT upvotes_count FROM complaints WHERE id = ?", (complaint_id,))
    count = cursor.fetchone()[0]
    conn.commit()
    conn.close()
    return jsonify({"success": True, "upvotes_count": count})


@app.route("/api/generate-digest", methods=["POST"])
def generate_digest():
    """Generates an executive municipal briefing from active complaints"""
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM complaints WHERE status != 'Resolved' ORDER BY severity_score DESC")
    rows = cursor.fetchall()
    active_complaints = [dict(r) for r in rows]
    conn.close()

    digest_markdown = ai_service.generate_executive_digest(active_complaints)
    return jsonify({"success": True, "digest": digest_markdown, "active_count": len(active_complaints)})


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Dashboard KPI metrics"""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT COUNT(*) FROM complaints")
    total = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE priority = 'Critical' AND status != 'Resolved'")
    critical = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status = 'In Progress'")
    in_progress = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE status = 'Resolved'")
    resolved = cursor.fetchone()[0]

    cursor.execute("SELECT COUNT(*) FROM complaints WHERE is_duplicate = 1")
    duplicates_detected = cursor.fetchone()[0]

    cursor.execute("SELECT category, COUNT(*) as count FROM complaints GROUP BY category")
    categories = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT department, COUNT(*) as count FROM complaints GROUP BY department")
    departments = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return jsonify({
        "success": True,
        "stats": {
            "total": total,
            "critical": critical,
            "in_progress": in_progress,
            "resolved": resolved,
            "duplicates_detected": duplicates_detected,
            "resolution_rate": round((resolved / total * 100) if total > 0 else 0, 1),
            "categories": categories,
            "departments": departments
        }
    })


@app.route("/uploads/<path:filename>")
def uploaded_file(filename):
    """Serves uploaded images or assets safely"""
    return send_from_directory(Config.UPLOAD_FOLDER, filename)


# Initialize DB upon starting
with app.app_context():
    init_db()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
