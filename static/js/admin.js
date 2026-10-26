/**
 * CivicSense AI — Municipal Authority Command Center Logic
 */

let adminMap = null;
let mapMarkers = [];
let allComplaints = [];
let currentComplaint = null;

document.addEventListener("DOMContentLoaded", () => {
  initAdminMap();
  loadAdminData();
  initFormListeners();
});

// ==========================================
// 1. LEAFLET GIS INCIDENT MAP
// ==========================================
function initAdminMap() {
  const lat = window.CITY_DEFAULT_LAT || 12.9716;
  const lng = window.CITY_DEFAULT_LNG || 77.5946;

  adminMap = L.map("map").setView([lat, lng], 13);

  // Modern Dark Theme Map Tiles
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a> &copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(adminMap);
}

function renderMapMarkers(complaints) {
  // Clear existing markers
  mapMarkers.forEach(m => adminMap.removeLayer(m));
  mapMarkers = [];

  complaints.forEach(c => {
    let pinColor = "#3b82f6"; // Medium
    let pulseClass = "";

    if (c.status === "Resolved") {
      pinColor = "#10b981"; // Resolved
    } else if (c.priority === "Critical") {
      pinColor = "#f43f5e"; // Critical
      pulseClass = "pulse-animation";
    } else if (c.priority === "High") {
      pinColor = "#f59e0b"; // High
    }

    const customIcon = L.divIcon({
      className: "gis-marker",
      html: `
        <div style="background: ${pinColor}; width: 20px; height: 20px; border-radius: 50%; border: 3px solid #090d16; box-shadow: 0 0 12px ${pinColor}; cursor: pointer;"></div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const marker = L.marker([c.latitude, c.longitude], { icon: customIcon }).addTo(adminMap);

    const popupHtml = `
      <div style="color: #0f172a; font-family: system-ui, sans-serif; min-width: 200px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 700; color: #475569; margin-bottom: 4px;">
          <span>${c.tracking_id}</span>
          <span style="color: ${pinColor}; text-transform: uppercase;">${c.priority}</span>
        </div>
        <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: #0f172a;">${c.title}</div>
        <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 6px;">${c.address}</div>
        <div style="font-size: 0.8rem; font-weight: 600; color: #0284c7; margin-bottom: 8px;">Dept: ${c.department}</div>
        <button onclick="inspectComplaintById(${c.id})" style="background: #0284c7; color: white; border: none; padding: 4px 10px; border-radius: 4px; font-size: 0.78rem; cursor: pointer; width: 100%;">
          Inspect & Dispatch
        </button>
      </div>
    `;

    marker.bindPopup(popupHtml);
    mapMarkers.push(marker);
  });
}

// ==========================================
// 2. FETCH DATA & KPIS
// ==========================================
async function loadAdminData() {
  try {
    // 1. Fetch Stats
    const statsRes = await fetch("/api/stats");
    const statsData = await statsRes.json();
    if (statsData.success) {
      const s = statsData.stats;
      document.getElementById("kpiTotal").textContent = s.total;
      document.getElementById("kpiCritical").textContent = s.critical;
      document.getElementById("kpiInProgress").textContent = s.in_progress;
      document.getElementById("kpiResolved").textContent = s.resolved;
      document.getElementById("kpiDuplicates").textContent = s.duplicates_detected;
    }

    // 2. Fetch Complaints
    const compRes = await fetch("/api/complaints");
    const compData = await compRes.json();
    if (compData.success) {
      allComplaints = compData.complaints;
      renderTable(allComplaints);
      renderMapMarkers(allComplaints);
    }
  } catch (err) {
    console.error("Error loading admin data:", err);
  }
}

// ==========================================
// 3. TABLE RENDERING & FILTERING
// ==========================================
function renderTable(complaints) {
  const tbody = document.getElementById("complaintsTableBody");
  tbody.innerHTML = "";

  if (complaints.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; padding: 2rem; color: var(--text-dim);">
          No complaints match the current filter criteria.
        </td>
      </tr>
    `;
    return;
  }

  complaints.forEach(c => {
    const tr = document.createElement("tr");
    tr.style.borderBottom = "1px solid rgba(255, 255, 255, 0.06)";
    tr.style.transition = "background 0.2s ease";

    const pClass = c.priority.toLowerCase();
    const isResolved = c.status === "Resolved";
    const statusBadgeClass = isResolved ? "badge-resolved" : "badge-category";

    tr.innerHTML = `
      <td style="padding: 1rem; font-family: monospace; font-size: 0.85rem; color: #38bdf8;">
        <a href="/track/${c.tracking_id}" target="_blank" style="color: #38bdf8; text-decoration: none;">
          ${c.tracking_id}
        </a>
      </td>
      <td style="padding: 1rem; max-width: 280px;">
        <div style="font-weight: 600; color: var(--text-main); font-size: 0.92rem; margin-bottom: 0.2rem;">
          ${c.title}
        </div>
        <div style="font-size: 0.8rem; color: var(--text-dim); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
          <i class="fa-solid fa-location-dot" style="color: var(--accent-rose);"></i> ${c.address}
        </div>
      </td>
      <td style="padding: 1rem; font-size: 0.84rem;">
        <div style="color: var(--text-muted); font-weight: 500;">${c.category}</div>
        <div style="color: var(--accent-cyan); font-size: 0.78rem;">${c.department}</div>
      </td>
      <td style="padding: 1rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
          <span class="badge badge-${pClass}">${c.priority}</span>
          <span style="font-size: 0.78rem; font-weight: 700; color: #cbd5e1;">${c.severity_score}/100</span>
        </div>
        <div class="severity-bar-container" style="width: 100px; height: 5px;">
          <div class="severity-fill" style="width: ${c.severity_score}%; background: ${c.severity_score >= 80 ? '#f43f5e' : (c.severity_score >= 60 ? '#f59e0b' : '#38bdf8')};"></div>
        </div>
      </td>
      <td style="padding: 1rem;">
        <span class="badge ${statusBadgeClass}">
          ${c.status}
        </span>
      </td>
      <td style="padding: 1rem; font-size: 0.88rem; color: var(--text-muted); text-align: center;">
        <span style="background: rgba(255,255,255,0.06); padding: 0.2rem 0.55rem; border-radius: 12px; font-weight: 600;">
          <i class="fa-solid fa-thumbs-up" style="color: var(--accent-cyan); font-size: 0.75rem;"></i> ${c.upvotes_count || 1}
        </span>
      </td>
      <td style="padding: 1rem; text-align: right;">
        <button onclick="inspectComplaintById(${c.id})" class="btn-secondary" style="font-size: 0.8rem; padding: 0.4rem 0.8rem; border-radius: 6px; cursor: pointer;">
          <i class="fa-solid fa-screwdriver-wrench"></i> Action
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function filterComplaints() {
  const search = document.getElementById("adminSearch").value.toLowerCase().trim();
  const cat = document.getElementById("filterCategory").value;
  const status = document.getElementById("filterStatus").value;
  const priority = document.getElementById("filterPriority").value;

  const filtered = allComplaints.filter(c => {
    const matchSearch = !search || 
      c.title.toLowerCase().includes(search) || 
      c.description.toLowerCase().includes(search) || 
      c.address.toLowerCase().includes(search) || 
      c.tracking_id.toLowerCase().includes(search);
    
    const matchCat = (cat === "All") || (c.category === cat);
    const matchStatus = (status === "All") || (c.status === status);
    const matchPriority = (priority === "All") || (c.priority === priority);

    return matchSearch && matchCat && matchStatus && matchPriority;
  });

  renderTable(filtered);
  renderMapMarkers(filtered);
}

// ==========================================
// 4. WORK ORDER & INSPECTION MODAL
// ==========================================
function inspectComplaintById(id) {
  const c = allComplaints.find(x => x.id === id);
  if (!c) return;
  currentComplaint = c;

  document.getElementById("woComplaintId").value = c.id;
  document.getElementById("woTrackingId").textContent = c.tracking_id;
  document.getElementById("woTitle").textContent = c.title;
  document.getElementById("woDescription").textContent = c.description;
  document.getElementById("woAddress").textContent = c.address;
  document.getElementById("woCitizen").textContent = `${c.citizen_name || 'Anonymous'} (${c.citizen_phone || 'No phone'})`;
  document.getElementById("woStatusSelect").value = c.status;
  document.getElementById("woDepartment").textContent = c.department;

  // Evidence Image
  const imgCont = document.getElementById("woImageContainer");
  if (c.image_path) {
    imgCont.style.display = "block";
    document.getElementById("woImage").src = `/uploads/${c.image_path}`;
  } else {
    imgCont.style.display = "none";
  }

  // AI Directive
  const ai = c.ai_reasoning || {};
  document.getElementById("woAiDirective").textContent = ai.recommended_action || "Dispatch standard inspection unit to verify incident coordinates.";

  document.getElementById("workOrderModal").style.display = "flex";
}

function closeWorkOrderModal() {
  document.getElementById("workOrderModal").style.display = "none";
}

function initFormListeners() {
  const form = document.getElementById("statusUpdateForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const complaintId = document.getElementById("woComplaintId").value;
    const formData = new FormData(form);

    try {
      const res = await fetch(`/api/complaint/${complaintId}/status`, {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        closeWorkOrderModal();
        loadAdminData();
        form.reset();
      } else {
        alert(data.error || "Failed to update status.");
      }
    } catch (err) {
      console.error(err);
      alert("Error saving status change.");
    }
  });
}

// ==========================================
// 5. GENERATIVE AI SITUATION BRIEFING
// ==========================================
async function generateExecutiveDigest() {
  const modal = document.getElementById("digestModal");
  const body = document.getElementById("digestBody");
  
  body.innerHTML = `
    <div style="text-align: center; padding: 3rem;">
      <i class="fa-solid fa-spinner fa-spin" style="font-size: 2.5rem; color: #a855f7;"></i>
      <p style="margin-top: 1rem; color: var(--text-muted);">
        Synthesizing active civic incidents with Gemini Generative AI...
      </p>
    </div>
  `;
  modal.style.display = "flex";

  try {
    const res = await fetch("/api/generate-digest", { method: "POST" });
    const data = await res.json();
    if (data.success && data.digest) {
      if (typeof marked !== "undefined") {
        body.innerHTML = marked.parse(data.digest);
      } else {
        body.innerHTML = `<pre style="white-space: pre-wrap; font-family: inherit;">${data.digest}</pre>`;
      }
    } else {
      body.innerHTML = `<p style="color: #f43f5e;">Could not generate AI briefing: ${data.error || 'Unknown error'}</p>`;
    }
  } catch (err) {
    body.innerHTML = `<p style="color: #f43f5e;">Network error communicating with AI service.</p>`;
  }
}

function closeDigestModal() {
  document.getElementById("digestModal").style.display = "none";
}

function printDigest() {
  const content = document.getElementById("digestBody").innerHTML;
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <html>
      <head>
        <title>CivicSense AI — Executive Briefing</title>
        <style>
          body { font-family: system-ui, sans-serif; padding: 2rem; color: #1e293b; line-height: 1.6; }
          h3, h4 { color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
          ul { margin-left: 20px; }
        </style>
      </head>
      <body>${content}</body>
    </html>
  `);
  printWin.document.close();
  printWin.print();
}

function printWorkOrder() {
  if (!currentComplaint) return;
  const c = currentComplaint;
  const printWin = window.open('', '_blank');
  printWin.document.write(`
    <html>
      <head>
        <title>MUNICIPAL WORK ORDER — ${c.tracking_id}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 30px; color: #111; line-height: 1.5; }
          .header { border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 20px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
          .box { border: 1px solid #ccc; padding: 12px; border-radius: 4px; }
          .signoff { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
          .line { border-top: 1px solid #000; margin-top: 60px; text-align: center; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>MUNICIPAL CORPORATION — OFFICIAL WORK ORDER</h2>
          <div><strong>Ticket Reference:</strong> ${c.tracking_id} &nbsp;|&nbsp; <strong>Date:</strong> ${c.created_at}</div>
        </div>
        <div class="grid">
          <div class="box">
            <h4>Incident Information</h4>
            <p><strong>Title:</strong> ${c.title}</p>
            <p><strong>Category:</strong> ${c.category}</p>
            <p><strong>Location:</strong> ${c.address} (${c.latitude}, ${c.longitude})</p>
            <p><strong>Priority:</strong> ${c.priority} (Severity: ${c.severity_score}/100)</p>
          </div>
          <div class="box">
            <h4>AI Action Directive</h4>
            <p><strong>Department:</strong> ${c.department}</p>
            <p><strong>Recommended Action:</strong> ${(c.ai_reasoning || {}).recommended_action || 'Repair and verify on site.'}</p>
            <p><strong>Estimated SLA:</strong> ${(c.ai_reasoning || {}).estimated_repair_time || '24 Hours'}</p>
          </div>
        </div>
        <div class="signoff">
          <div><div class="line">Field Crew Supervisor Signature</div></div>
          <div><div class="line">Ward Municipal Executive Engineer</div></div>
        </div>
      </body>
    </html>
  `);
  printWin.document.close();
  printWin.print();
}
