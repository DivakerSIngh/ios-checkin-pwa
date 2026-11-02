// ============================================================================
// 1. HARDCODED LOCATION CONFIG & LIVE AUTO-SYNC URL
// ============================================================================
const LIVE_WEB_APP_URL = "https://divakersingh.github.io/ios-checkin-pwa/";

const DEFAULT_TARGET_LOCATION = {
  name: "My Hardcoded Office",
  lat: 28.6139,          // <-- Yahan apna Latitude daalein (e.g., 19.0760)
  lng: 77.2090,          // <-- Yahan apna Longitude daalein (e.g., 72.8777)
  maxRadiusMeters: 100   // <-- 100 Meter Radius limit
};

// Auto-sync for installed APK / IPA: If running from bundled local assets and GitHub Pages is live,
// load the live hosted build so future updates reflect immediately without reinstalling APK/IPA.
(async function checkLiveAutoUpdate() {
  const isBundledNative =
    window.location.hostname === "localhost" &&
    (window.Capacitor || window.navigator.userAgent.includes("wv"));

  if (isBundledNative && navigator.onLine) {
    try {
      const res = await fetch(`${LIVE_WEB_APP_URL}version.json?t=${Date.now()}`, { cache: "no-store" });
      if (res.ok) {
        window.location.replace(LIVE_WEB_APP_URL);
      }
    } catch (_) {
      // Offline or GitHub Pages not active yet — continue using bundled offline files seamlessly
    }
  }
})();

// Load target location (supports test override from localStorage or falls back to hardcoded)
function getTargetLocation() {
  const savedOverride = localStorage.getItem("geocheck_target_override");
  if (savedOverride) {
    return JSON.parse(savedOverride);
  }
  return DEFAULT_TARGET_LOCATION;
}

// ============================================================================
// 2. HAVERSINE FORMULA (Calculates exact distance in meters between 2 GPS points)
// ============================================================================
function calculateDistanceInMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

// ============================================================================
// 3. PAGE NAVIGATION & AUTHENTICATION (Static via localStorage)
// ============================================================================
function navigateTo(pageName) {
  document.querySelectorAll(".page").forEach((sec) => sec.classList.remove("active"));
  const target = document.getElementById(`page-${pageName}`);
  if (target) target.classList.add("active");
}

function showToast(message) {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), 3000);
}

function getUsers() {
  return JSON.parse(localStorage.getItem("geocheck_users") || "[]");
}

function getCurrentUser() {
  return JSON.parse(localStorage.getItem("geocheck_session") || "null");
}

// Registration Handler
document.getElementById("form-register").addEventListener("submit", (e) => {
  e.preventDefault();
  const name = document.getElementById("reg-name").value.trim();
  const empId = document.getElementById("reg-empid").value.trim();
  const email = document.getElementById("reg-email").value.trim().toLowerCase();
  const password = document.getElementById("reg-password").value;

  const users = getUsers();
  if (users.some((u) => u.email === email)) {
    showToast("⚠️ User already registered with this Email/Mobile!");
    return;
  }

  const newUser = { name, empId, email, password };
  users.push(newUser);
  localStorage.setItem("geocheck_users", JSON.stringify(users));
  localStorage.setItem("geocheck_session", JSON.stringify(newUser));

  showToast("✅ Registration successful!");
  initDashboard();
});

// Login Handler
document.getElementById("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  const email = document.getElementById("login-email").value.trim().toLowerCase();
  const password = document.getElementById("login-password").value;

  const users = getUsers();
  const matched = users.find((u) => u.email === email && u.password === password);

  if (!matched) {
    showToast("❌ Invalid credentials or user not registered on this phone.");
    return;
  }

  localStorage.setItem("geocheck_session", JSON.stringify(matched));
  showToast(`👋 Welcome back, ${matched.name}!`);
  initDashboard();
});

function logoutUser() {
  localStorage.removeItem("geocheck_session");
  showToast("Logged out successfully");
  navigateTo("login");
}

// ============================================================================
// 4. DASHBOARD, GPS RADIUS CHECK & CHECK-IN / CHECK-OUT
// ============================================================================
function initDashboard() {
  const user = getCurrentUser();
  if (!user) {
    navigateTo("login");
    return;
  }

  navigateTo("dashboard");
  document.getElementById("user-greeting").textContent = `Hello, ${user.name}`;
  document.getElementById("user-empid").textContent = `ID: ${user.empId}`;

  updateTargetLabel();
  renderHistory();
  checkLiveDistance();
}

function updateTargetLabel() {
  const target = getTargetLocation();
  document.getElementById("target-coords-label").textContent =
    `${target.name} (${target.lat.toFixed(5)}, ${target.lng.toFixed(5)})`;
}

// Get Current GPS Position Promise
function fetchCurrentGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not supported by your iPhone browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Update UI distance meter
async function checkLiveDistance() {
  const msgEl = document.getElementById("geo-message");
  const distValEl = document.getElementById("distance-value");
  const circleEl = document.getElementById("distance-circle");

  msgEl.textContent = "📡 Fetching accurate iPhone GPS...";

  try {
    const current = await fetchCurrentGPS();
    const target = getTargetLocation();
    const distance = calculateDistanceInMeters(current.lat, current.lng, target.lat, target.lng);

    distValEl.textContent = `${distance}m`;
    circleEl.classList.remove("inside", "outside");

    if (distance <= target.maxRadiusMeters) {
      circleEl.classList.add("inside");
      msgEl.textContent = `✅ Inside ${target.maxRadiusMeters}m zone! You can Check-In / Check-Out.`;
    } else {
      circleEl.classList.add("outside");
      msgEl.textContent = `❌ Outside 100m zone (${distance}m away). Move closer to Check-In.`;
    }

    return { allowed: distance <= target.maxRadiusMeters, distance, current };
  } catch (error) {
    distValEl.textContent = "ERR";
    msgEl.textContent = "⚠️ Please allow Location Permission in Safari Settings.";
    return { allowed: false, error };
  }
}

// Handle Check-In or Check-Out within 100m
async function handleAttendance(actionType) {
  const user = getCurrentUser();
  if (!user) return;

  showToast("📡 Verifying 100m radius...");
  const result = await checkLiveDistance();

  if (!result.allowed) {
    if (result.distance !== undefined) {
      showToast(`🚫 ${actionType} Blocked! You are ${result.distance}m away (Max allowed: 100m).`);
    } else {
      showToast("🚫 Unable to read GPS location. Allow location access.");
    }
    return;
  }

  // Record Attendance
  const now = new Date();
  const record = {
    id: Date.now(),
    empId: user.empId,
    name: user.name,
    type: actionType,
    distance: result.distance,
    coords: `${result.current.lat.toFixed(5)}, ${result.current.lng.toFixed(5)}`,
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    date: now.toLocaleDateString([], { day: "2-digit", month: "short", year: "numeric" })
  };

  const logs = JSON.parse(localStorage.getItem("geocheck_logs") || "[]");
  logs.unshift(record);
  localStorage.setItem("geocheck_logs", JSON.stringify(logs));

  renderHistory();
  showToast(`🎉 ${actionType} Successful (${result.distance}m from target)!`);
}

// Helper button so the user can test immediately at their current spot
async function setMyLocationAsTarget() {
  showToast("📍 Reading your current GPS...");
  try {
    const current = await fetchCurrentGPS();
    const newTarget = {
      name: "My Saved Spot",
      lat: current.lat,
      lng: current.lng,
      maxRadiusMeters: 100
    };
    localStorage.setItem("geocheck_target_override", JSON.stringify(newTarget));
    updateTargetLabel();
    await checkLiveDistance();
    showToast("✅ Current spot set as 100m center!");
  } catch (err) {
    showToast("⚠️ Could not get GPS. Please allow location access.");
  }
}

function renderHistory() {
  const user = getCurrentUser();
  const logs = JSON.parse(localStorage.getItem("geocheck_logs") || "[]")
    .filter((l) => user && l.empId === user.empId);

  const listEl = document.getElementById("history-list");
  const statusPill = document.getElementById("attendance-status-pill");

  if (logs.length === 0) {
    listEl.innerHTML = `<li class="empty-state">No check-in/out records yet.</li>`;
    statusPill.textContent = "Not Checked In";
    statusPill.className = "status-pill";
    return;
  }

  // Update current status pill from latest record
  const latest = logs[0];
  if (latest.type === "CHECK-IN") {
    statusPill.textContent = `Checked In at ${latest.time}`;
    statusPill.className = "status-pill checked-in";
  } else {
    statusPill.textContent = `Checked Out at ${latest.time}`;
    statusPill.className = "status-pill checked-out";
  }

  listEl.innerHTML = logs
    .map(
      (item) => `
      <li class="history-item">
        <div>
          <span class="history-type ${item.type === "CHECK-IN" ? "in" : "out"}">${item.type}</span>
          <div class="history-meta">${item.date} • ${item.distance}m from center</div>
        </div>
        <strong>${item.time}</strong>
      </li>
    `
    )
    .join("");
}

function clearHistory() {
  localStorage.removeItem("geocheck_logs");
  renderHistory();
  showToast("🗑️ History cleared");
}

// Live Clock
setInterval(() => {
  const now = new Date();
  const clockEl = document.getElementById("live-clock");
  const dateEl = document.getElementById("live-date");
  if (clockEl) {
    clockEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
  }
}, 1000);

// Register Service Worker & Check Session on Load
window.addEventListener("DOMContentLoaded", () => {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  }
  if (getCurrentUser()) {
    initDashboard();
  } else {
    navigateTo("login");
  }
});
