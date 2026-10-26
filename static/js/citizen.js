/**
 * CivicSense AI — Citizen Portal Interaction Logic
 */

let pickerMap = null;
let pickerMarker = null;
let speechRecognizer = null;
let isRecording = false;

document.addEventListener("DOMContentLoaded", () => {
  initPickerMap();
  initDropzone();
  initVoiceRecorder();
  initFormHandlers();
  loadStats();
  loadRecentReports();
});

// ==========================================
// 1. LEAFLET LOCATION PICKER MAP
// ==========================================
function initPickerMap() {
  const defaultLat = parseFloat(document.getElementById("latInput").value) || 12.9716;
  const defaultLng = parseFloat(document.getElementById("lngInput").value) || 77.5946;

  pickerMap = L.map("pickerMap").setView([defaultLat, defaultLng], 14);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    maxZoom: 19
  }).addTo(pickerMap);

  const markerIcon = L.divIcon({
    className: "custom-pin",
    html: `<div style="background: #f43f5e; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 10px rgba(244,63,94,0.6);"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11]
  });

  pickerMarker = L.marker([defaultLat, defaultLng], { draggable: true, icon: markerIcon }).addTo(pickerMap);

  pickerMarker.on("dragend", function (e) {
    const pos = e.target.getLatLng();
    updateLocationInputs(pos.lat, pos.lng);
  });

  pickerMap.on("click", function (e) {
    pickerMarker.setLatLng(e.latlng);
    updateLocationInputs(e.latlng.lat, e.latlng.lng);
  });

  // GPS Locate Button
  document.getElementById("btnDetectLocation").addEventListener("click", () => {
    if (navigator.geolocation) {
      document.getElementById("btnDetectLocation").innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Locating...`;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          pickerMap.setView([lat, lng], 16);
          pickerMarker.setLatLng([lat, lng]);
          updateLocationInputs(lat, lng);
          document.getElementById("btnDetectLocation").innerHTML = `<i class="fa-solid fa-crosshairs"></i> GPS Locked`;
        },
        (err) => {
          alert("Could not access GPS. Please pin your location on the map manually.");
          document.getElementById("btnDetectLocation").innerHTML = `<i class="fa-solid fa-crosshairs"></i> Use My GPS`;
        }
      );
    }
  });
}

function updateLocationInputs(lat, lng) {
  document.getElementById("latInput").value = lat.toFixed(6);
  document.getElementById("lngInput").value = lng.toFixed(6);
}

// ==========================================
// 2. IMAGE DROPZONE & PREVIEW
// ==========================================
function initDropzone() {
  const dropzone = document.getElementById("dropzone");
  const fileInput = document.getElementById("imageInput");
  const previewWrapper = document.getElementById("previewWrapper");
  const previewImg = document.getElementById("imagePreview");
  const promptText = document.getElementById("dropzonePrompt");
  const btnRemove = document.getElementById("btnRemoveImage");

  dropzone.addEventListener("click", (e) => {
    if (e.target !== btnRemove && !btnRemove.contains(e.target)) {
      fileInput.click();
    }
  });

  dropzone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropzone.classList.add("dragover");
  });

  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });

  dropzone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropzone.classList.remove("dragover");
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      displayImagePreview(e.dataTransfer.files[0]);
    }
  });

  fileInput.addEventListener("change", (e) => {
    if (e.target.files && e.target.files.length > 0) {
      displayImagePreview(e.target.files[0]);
    }
  });

  btnRemove.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.value = "";
    previewImg.src = "";
    previewWrapper.style.display = "none";
    promptText.style.display = "block";
  });
}

function displayImagePreview(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById("imagePreview").src = e.target.result;
    document.getElementById("previewWrapper").style.display = "block";
    document.getElementById("dropzonePrompt").style.display = "none";
    // Trigger instant AI pre-scan
    triggerAiPreScan();
  };
  reader.readAsDataURL(file);
}

// ==========================================
// 3. VOICE RECORDING (Web Speech API)
// ==========================================
function initVoiceRecorder() {
  const btnMic = document.getElementById("btnMic");
  const voiceStatus = document.getElementById("voiceStatus");
  const descInput = document.getElementById("descriptionInput");
  const transcriptInput = document.getElementById("voiceTranscriptInput");

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    voiceStatus.textContent = "Speech recognition not supported in this browser. Please type description.";
    btnMic.style.opacity = "0.5";
    btnMic.style.cursor = "not-allowed";
    return;
  }

  speechRecognizer = new SpeechRecognition();
  speechRecognizer.continuous = true;
  speechRecognizer.interimResults = true;
  speechRecognizer.lang = "en-US";

  speechRecognizer.onstart = () => {
    isRecording = true;
    btnMic.classList.add("recording");
    voiceStatus.innerHTML = `<span style="color: #f43f5e; font-weight: 600;"><i class="fa-solid fa-circle-dot"></i> Listening...</span> Speak your complaint details.`;
  };

  speechRecognizer.onresult = (event) => {
    let interimTranscript = "";
    let finalTranscript = "";

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript + " ";
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    if (finalTranscript) {
      const existing = descInput.value.trim();
      descInput.value = existing ? `${existing} ${finalTranscript.trim()}` : finalTranscript.trim();
      transcriptInput.value = descInput.value;
      triggerAiPreScanDebounced();
    }
    if (interimTranscript) {
      voiceStatus.textContent = `"${interimTranscript}"`;
    }
  };

  speechRecognizer.onerror = (event) => {
    isRecording = false;
    btnMic.classList.remove("recording");
    voiceStatus.textContent = `Mic error: ${event.error}. Click to retry.`;
  };

  speechRecognizer.onend = () => {
    isRecording = false;
    btnMic.classList.remove("recording");
    voiceStatus.textContent = "Voice recording ended. Click mic to speak again.";
  };

  btnMic.addEventListener("click", () => {
    if (!isRecording) {
      try {
        speechRecognizer.start();
      } catch (err) {
        console.error(err);
      }
    } else {
      speechRecognizer.stop();
    }
  });
}

// ==========================================
// 4. FORM HANDLERS & AI PRE-SCAN
// ==========================================
let preScanTimeout = null;
function triggerAiPreScanDebounced() {
  clearTimeout(preScanTimeout);
  preScanTimeout = setTimeout(triggerAiPreScan, 600);
}

async function triggerAiPreScan() {
  const desc = document.getElementById("descriptionInput").value.trim();
  const address = document.getElementById("addressInput").value.trim();
  const fileInput = document.getElementById("imageInput");

  if (!desc && (!fileInput.files || fileInput.files.length === 0)) {
    return;
  }

  const pill = document.getElementById("aiStatusPill");
  pill.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Neural Scanning...`;
  pill.style.color = "#c084fc";

  const formData = new FormData();
  formData.append("description", desc);
  formData.append("address", address);
  if (fileInput.files && fileInput.files.length > 0) {
    formData.append("image", fileInput.files[0]);
  }

  try {
    const res = await fetch("/api/analyze-preview", {
      method: "POST",
      body: formData
    });
    const data = await res.json();
    if (data.success && data.analysis) {
      renderAiPreview(data.analysis);
      pill.innerHTML = `<i class="fa-solid fa-check"></i> Diagnostic Synchronized`;
      pill.style.color = "#10b981";
    }
  } catch (err) {
    console.error("Pre-scan error:", err);
    pill.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Offline Fallback`;
    pill.style.color = "#f59e0b";
  }
}

function renderAiPreview(ai) {
  document.getElementById("previewTitle").textContent = ai.title || "Civic Hazard Detected";
  document.getElementById("previewCategory").textContent = ai.category || "General";
  document.getElementById("previewDepartment").textContent = ai.department || "Municipal Administration";
  
  const priorityEl = document.getElementById("previewPriority");
  const p = (ai.priority || "Medium").toLowerCase();
  priorityEl.className = `badge badge-${p}`;
  priorityEl.textContent = `${ai.priority} Urgency`;

  const sevScore = ai.severity_score || 50;
  document.getElementById("previewSeverityText").textContent = `${sevScore} / 100`;
  const sevBar = document.getElementById("previewSeverityBar");
  sevBar.style.width = `${sevScore}%`;
  sevBar.style.background = sevScore >= 80 ? '#f43f5e' : (sevScore >= 60 ? '#f59e0b' : '#38bdf8');

  // Risks
  const risksList = document.getElementById("previewRisks");
  risksList.innerHTML = "";
  (ai.risk_factors || []).forEach(r => {
    const li = document.createElement("li");
    li.textContent = r;
    risksList.appendChild(li);
  });

  document.getElementById("previewAction").textContent = ai.recommended_action || "Standard municipal response dispatched.";
}

function initFormHandlers() {
  document.getElementById("btnAiRefine").addEventListener("click", triggerAiPreScan);
  document.getElementById("descriptionInput").addEventListener("input", triggerAiPreScanDebounced);

  // Form Submit
  const form = document.getElementById("reportForm");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btnSubmit = document.getElementById("btnSubmit");
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Processing Gemini AI Analysis...`;

    const formData = new FormData(form);

    try {
      const res = await fetch("/api/report", {
        method: "POST",
        body: formData
      });
      const data = await res.json();
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit & Dispatch Ticket`;

      if (data.success) {
        // Show Success Modal
        showSuccessModal(data);
        form.reset();
        document.getElementById("btnRemoveImage").click();
        loadStats();
        loadRecentReports();
      } else {
        alert(`Error: ${data.error || "Could not register complaint."}`);
      }
    } catch (err) {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Submit & Dispatch Ticket`;
      alert("Network error submitting complaint. Please try again.");
    }
  });
}

function showSuccessModal(data) {
  document.getElementById("modalTrackingId").textContent = data.tracking_id;
  document.getElementById("modalCategory").textContent = data.ai_analysis.category;
  
  const pBadge = document.getElementById("modalPriority");
  pBadge.className = `badge badge-${data.ai_analysis.priority.toLowerCase()}`;
  pBadge.textContent = data.ai_analysis.priority;

  document.getElementById("modalDepartment").textContent = data.ai_analysis.department;
  document.getElementById("modalTrackBtn").href = `/track/${data.tracking_id}`;

  if (data.is_duplicate) {
    const dupBox = document.getElementById("duplicateAlertBox");
    dupBox.style.display = "block";
    document.getElementById("duplicateAlertMsg").textContent = 
      `This incident closely matches an existing active ticket (${data.duplicate_info.tracking_id}). It has been clustered to avoid duplicate municipal crew dispatches, and priority urgency has been increased!`;
  }

  document.getElementById("successModal").style.display = "flex";
}

function closeSuccessModal() {
  document.getElementById("successModal").style.display = "none";
}

// Quick Track Handler
function handleQuickTrack() {
  const id = document.getElementById("quickTrackInput").value.trim();
  if (id) {
    window.location.href = `/track/${encodeURIComponent(id)}`;
  }
}

// Load Stats Strip
async function loadStats() {
  try {
    const res = await fetch("/api/stats");
    const data = await res.json();
    if (data.success) {
      const s = data.stats;
      document.getElementById("statTotal").textContent = s.total;
      document.getElementById("statCritical").textContent = s.critical;
      document.getElementById("statResolved").textContent = s.resolved;
      document.getElementById("statDuplicates").textContent = s.duplicates_detected;
    }
  } catch (err) {
    console.error(err);
  }
}

// Load Recent Community Complaints Grid
async function loadRecentReports() {
  const container = document.getElementById("recentComplaintsGrid");
  try {
    const res = await fetch("/api/complaints?limit=6");
    const data = await res.json();
    if (data.success) {
      container.innerHTML = "";
      data.complaints.forEach(c => {
        const card = document.createElement("div");
        card.className = "glass-panel";
        card.style.padding = "1.25rem";
        card.style.display = "flex";
        card.style.flexDirection = "column";
        card.style.justifyContent = "space-between";

        const pClass = c.priority.toLowerCase();
        const imgThumb = c.image_path ? `/uploads/${c.image_path}` : 'https://placehold.co/400x200/0f172a/38bdf8?text=CivicSense+Report';

        card.innerHTML = `
          <div>
            <div style="position: relative; height: 160px; border-radius: 8px; overflow: hidden; margin-bottom: 0.85rem; border: 1px solid var(--border-subtle);">
              <img src="${imgThumb}" alt="${c.title}" style="width: 100%; height: 100%; object-fit: cover;">
              <span class="badge badge-${pClass}" style="position: absolute; top: 10px; right: 10px;">${c.priority}</span>
              <span class="badge" style="position: absolute; bottom: 10px; left: 10px; background: rgba(9,13,22,0.85); color: #38bdf8; font-family: monospace;">${c.tracking_id}</span>
            </div>
            <h4 style="font-size: 1.05rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-main); line-height: 1.3;">
              ${c.title}
            </h4>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 0.75rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${c.description}
            </p>
            <div style="font-size: 0.78rem; color: var(--text-dim); margin-bottom: 0.85rem;">
              <i class="fa-solid fa-location-dot" style="color: var(--accent-rose);"></i> ${c.address}
            </div>
          </div>

          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; margin-top: 0.5rem;">
            <button onclick="upvoteIssue(${c.id}, this)" class="btn-secondary" style="font-size: 0.78rem; padding: 0.35rem 0.65rem; border-radius: 6px; cursor: pointer;">
              <i class="fa-solid fa-thumbs-up" style="color: var(--accent-cyan);"></i> <span class="upvote-count">${c.upvotes_count || 1}</span> Upvotes
            </button>
            <a href="/track/${c.tracking_id}" class="nav-link" style="font-size: 0.8rem; padding: 0.3rem 0.6rem; color: var(--accent-cyan);">
              Track Details <i class="fa-solid fa-arrow-right"></i>
            </a>
          </div>
        `;
        container.appendChild(card);
      });
    }
  } catch (err) {
    console.error(err);
  }
}

async function upvoteIssue(id, btn) {
  try {
    const res = await fetch(`/api/complaint/${id}/upvote`, { method: "POST" });
    const data = await res.json();
    if (data.success) {
      btn.querySelector(".upvote-count").textContent = data.upvotes_count;
      btn.style.color = "#38bdf8";
      btn.style.borderColor = "#38bdf8";
    }
  } catch (err) {
    console.error(err);
  }
}
