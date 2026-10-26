# 🏛️ CivicSense AI — Generative AI-Based Civic Issue Detection and Management System

[![Python](https://img.shields.io/badge/Python-3.10%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-3.1-black.svg)](https://flask.palletsprojects.com/)
[![Google Gemini](https://img.shields.io/badge/Google%20Gemini-Multimodal%20AI-orange.svg)](https://ai.google.dev/)
[![SQLite](https://img.shields.io/badge/Database-SQLite-003B57.svg)](https://www.sqlite.org/)
[![GIS](https://img.shields.io/badge/GIS-Leaflet-199900.svg)](https://leafletjs.com/)

**CivicSense AI** is a Generative AI-powered municipal issue detection, triage, deduplication, and workflow management platform. It transforms how citizens report public infrastructure issues—such as deep potholes, overflowing garbage dumps, hazardous water pipeline bursts, and dangling electrical wires—while equipping municipal departments with automated AI dispatch, geospatial clustering, and executive situation briefings.

---

## 🌟 Key Features

### 1. 📷 Multimodal Citizen Reporting
- **Computer Vision & Image Analysis**: Citizens upload photos of civic damage. Gemini Generative AI inspects the imagery to identify damage severity, pavement cavities, water ponding, or exposed electrical wiring.
- **Voice-to-Text Transcription**: Citizens can speak complaints directly into their browser microphone (powered by Web Speech API & Gemini NLP).
- **Interactive Location Pinning & GPS Auto-Detection**: Single-click GPS location lock and interactive Leaflet map pin selector.
- **Instant AI Pre-Scan**: Real-time diagnostic preview that classifies the issue, estimates hazard score (0–100), and identifies target municipal departments *before* submission.

### 2. 🧠 Generative AI Intelligence Engine (Google Gemini)
- **Automated Issue Categorization**: Accurately classifies complaints into domains:
  - *Road Damage & Potholes*
  - *Garbage & Waste Management*
  - *Water Supply & Leakage*
  - *Electrical & Streetlighting*
  - *Public Hazards & Trees*
  - *Drainage & Sewage*
- **Severity & Urgency Scoring (0–100)**: Computes danger based on vehicular risk, public health vectors, electrocution risks, and pedestrian density.
- **AI Municipal Action Directives**: Formulates official engineering repair strategies and estimated completion timelines (e.g. *Cold asphalt compaction within 18 hours*).
- **Proximity & Semantic Duplicate Clustering**: Detects overlapping reports within a geographical radius (Haversine distance) and clusters them to prevent redundant crew dispatch while escalating ticket priority.
- **Executive Municipal Briefing Generator**: Synthesizes open incidents across the city into an AI Commissioner Situation Briefing with hotspot analysis and resource allocation directives.

### 3. 🔍 Citizen Tracking Portal
- Unique human-readable Tracking IDs (e.g. `CIVIC-2026-A109F`).
- Visual 5-stage progress stepper:
  $$\text{Reported} \longrightarrow \text{Under Review} \longrightarrow \text{Assigned} \longrightarrow \text{In Progress} \longrightarrow \text{Resolved}$$
- Real-time audit timeline showing field notes from municipal inspectors and post-repair proof photographs.

### 4. 🏢 Municipal Authority Command Center
- **Interactive GIS Incident Map**: Live Leaflet map with pulsing, color-coded markers (Critical, High, Medium, Resolved).
- **Real-Time KPI Dashboard**: Metrics on total issues, critical emergencies, in-progress jobs, and merged duplicates.
- **Filterable & Searchable Grid**: Filter by department, priority level, or resolution state.
- **Work Order Management & Printing**: Allows ward officers to update ticket statuses, log field notes, attach proof photos, and print official paper work orders.

---

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| **Backend** | Python, Flask, Flask-CORS, Python-Dotenv |
| **Generative AI** | Google Gemini (`google-genai` / `google-generativeai`) with resilient fallback heuristic engine |
| **Computer Vision** | Gemini Multimodal Vision / Pillow (PIL) |
| **Database** | SQLite3 with relational tables (`complaints`, `status_history`, `ai_digests`) |
| **Frontend** | HTML5, Vanilla Modern CSS (Glassmorphism & Dark Mode), JavaScript (ES6+) |
| **Geospatial & Maps** | Leaflet.js, OpenStreetMap, CartoDB DarkMatter |
| **Audio & Speech** | Web Speech API |

---

## 🚀 Quick Start Guide

### 1. Prerequisites
- Python 3.10+ installed
- (Optional) Google Gemini API Key from [Google AI Studio](https://aistudio.google.com/)

### 2. Environment Setup
```bash
# Clone or navigate to the directory
cd generative_ai_project

# Activate the virtual environment
# Windows:
.venv\Scripts\activate
# Linux/macOS:
source .venv/bin/activate

# Install dependencies (already included in requirements.txt)
pip install -r requirements.txt
```

### 3. Configure API Key (Optional)
Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```
Open `.env` and set your key:
```env
GEMINI_API_KEY=your_actual_gemini_api_key_here
```
> **Note:** If no API key is provided, CivicSense AI automatically switches to its **Smart Fallback Heuristic Engine**, allowing full offline demo capability right out of the box!

### 4. Run the Application
```bash
python app.py
```
Open your browser and visit:
- **Citizen Portal:** [http://127.0.0.1:5000/](http://127.0.0.1:5000/)
- **Citizen Issue Tracking:** [http://127.0.0.1:5000/track](http://127.0.0.1:5000/track)
- **Municipal Command Center:** [http://127.0.0.1:5000/admin](http://127.0.0.1:5000/admin)

---

## 📡 REST API Reference

| Endpoint | Method | Description |
|---|---|---|
| `/api/report` | `POST` | Submit complaint with image/voice; triggers Gemini AI analysis and deduplication |
| `/api/analyze-preview` | `POST` | Real-time AI pre-inspection for form fields before submitting |
| `/api/complaints` | `GET` | Retrieve complaints with category, status, and priority query filters |
| `/api/complaint/<tracking_id>` | `GET` | Get full complaint details, AI reasoning, and audit timeline |
| `/api/complaint/<id>/status` | `POST` | Update municipal resolution status, add officer notes, and upload proof |
| `/api/complaint/<id>/upvote` | `POST` | Community upvoting to elevate ticket urgency |
| `/api/generate-digest` | `POST` | Triggers Gemini to generate an executive municipal briefing |
| `/api/stats` | `GET` | Fetch real-time dashboard KPIs |

---

## 👥 Contributors & License
Developed as an Advanced Generative AI Civic Technology Solution.
License: MIT
