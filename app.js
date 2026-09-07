import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  deleteDoc, 
  collection, 
  onSnapshot 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 1. FIREBASE CONFIGURATION
const firebaseConfig = {
  apiKey: "AIzaSyDjVRDGg32mwD5FD1g4fmgA0BgTJYMLwOw",
  authDomain: "badge-residence.firebaseapp.com",
  projectId: "badge-residence",
  storageBucket: "badge-residence.firebasestorage.app",
  messagingSenderId: "127189334832",
  appId: "1:127189334832:web:418ceaf8e79faad086e6f5",
  measurementId: "G-9R66KLFZYP"
};

// 2. INITIALIZE FIREBASE & FIRESTORE
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const badgesCollection = collection(db, "badges");

// Helper function to sanitize IDs
function cleanId(input) {
  if (!input) return "";
  return input
    .trim()
    .toUpperCase()
    .replace(/[\u2010-\u2015]/g, "-") // Normalizes special dash characters
    .replace(/\s+/g, "");            // Removes hidden spaces
}

// UI ELEMENTS
const verifyForm = document.getElementById('verifyForm');
const checkIdInput = document.getElementById('checkId');
const resultBox = document.getElementById('resultBox');
const verifyBtn = document.getElementById('verifyBtn');

const addBadgeForm = document.getElementById('addBadgeForm');
const saveBtn = document.getElementById('saveBtn');
const badgeListContainer = document.getElementById('badgeList');
const adminPanel = document.getElementById('adminPanel');

// CORE LOOKUP FUNCTION
async function performVerification(rawBadgeId) {
  const badgeId = cleanId(rawBadgeId);
  if (!badgeId) return;

  checkIdInput.value = badgeId;
  verifyBtn.disabled = true;
  verifyBtn.textContent = "Checking Cloud DB...";
  resultBox.style.display = 'block';
  resultBox.className = 'result';
  resultBox.style.backgroundColor = '#1d263b';
  resultBox.style.borderColor = '#374151';
  resultBox.style.color = '#9ca3af';
  resultBox.innerHTML = `Querying record for: <strong>${badgeId}</strong>...`;

  try {
    const docRef = doc(db, "badges", badgeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const worker = docSnap.data();
      const isActive = worker.status && worker.status.toLowerCase() === 'active';

      resultBox.className = isActive ? 'result valid' : 'result invalid';
      resultBox.innerHTML = `
        ${isActive ? '✓ LEGITIMATE BADGE' : '✕ INACTIVE / REVOKED'}
        <div class="worker-details">
          <strong>Worker:</strong> ${worker.name || 'N/A'}<br>
          <strong>Role:</strong> ${worker.role || 'N/A'}<br>
          <strong>Status:</strong> <span style="color: ${isActive ? 'var(--success)' : 'var(--error)'};">${worker.status}</span>
        </div>
      `;
    } else {
      resultBox.className = 'result invalid';
      resultBox.innerHTML = `
        ✕ UNKNOWN BADGE
        <div class="worker-details" style="text-align: center;">
          No record found for ID: <strong>${badgeId}</strong>
        </div>
      `;
    }
  } catch (err) {
    console.error("Firestore Fetch Error:", err);
    resultBox.className = 'result invalid';
    resultBox.innerHTML = `✕ ERROR: Unable to reach database. Check console logs.`;
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Verify Badge";
  }
}

// VERIFY FORM SUBMIT EVENT
verifyForm.addEventListener('submit', function(e) {
  e.preventDefault();
  performVerification(checkIdInput.value);
});

// AUTO-RUN URL PARAMETER CHECK DIRECTLY AFTER SCRIPT LOAD
function checkUrlForBadge() {
  let badgeId = null;

  // Check query string ?id=TC-2026-328W-B2JD
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('id')) {
    badgeId = urlParams.get('id');
  }

  // Fallback: check path format /idTC-2026-328W-B2JD
  if (!badgeId) {
    const path = window.location.pathname.replace('/', '');
    if (path.toLowerCase().startsWith('id')) {
      badgeId = path.substring(2);
    }
  }

  if (badgeId) {
    performVerification(badgeId);
  }
}

// Run immediately when script initializes
checkUrlForBadge();

// ADD / UPDATE BADGE IN FIRESTORE
addBadgeForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const id = cleanId(document.getElementById('newId').value);
  const name = document.getElementById('newName').value.trim();
  const role = document.getElementById('newRole').value.trim();
  const status = document.getElementById('newStatus').value;

  saveBtn.disabled = true;
  saveBtn.textContent = "Saving...";

  try {
    await setDoc(doc(db, "badges", id), {
      name: name,
      role: role,
      status: status,
      updatedAt: new Date().toISOString()
    });

    addBadgeForm.reset();
  } catch (err) {
    console.error("Error saving badge:", err);
    alert("Failed to save badge to cloud DB. Check browser console.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Save to Cloud DB";
  }
});

// REAL-TIME SYNC FOR ADMIN LIST
onSnapshot(badgesCollection, (snapshot) => {
  badgeListContainer.innerHTML = '<strong style="font-size:0.8rem; color:#9ca3af; display:block; margin-bottom:0.5rem;">LIVE BADGES IN CLOUD:</strong>';

  if (snapshot.empty) {
    badgeListContainer.innerHTML += '<p style="font-size:0.85rem; color:#6b7280;">No badges found in Firestore. Add one above!</p>';
    return;
  }

  snapshot.forEach((docSnap) => {
    const item = docSnap.data();
    const id = docSnap.id;
    const isActive = item.status === 'Active';

    const div = document.createElement('div');
    div.className = 'badge-item';
    div.innerHTML = `
      <div class="info">
        <div><strong>${id}</strong> - ${item.name}</div>
        <div style="color: #9ca3af; font-size: 0.75rem;">${item.role}</div>
        <span class="badge-status-tag ${isActive ? 'tag-active' : 'tag-suspended'}">${item.status}</span>
      </div>
      <div class="action-group">
        <button class="status-btn" style="background-color: ${isActive ? '#f59e0b' : '#10b981'}; color: #000;">
          ${isActive ? 'Suspend' : 'Activate'}
        </button>
        <button class="delete-btn">Delete</button>
      </div>
    `;

    div.querySelector('.status-btn').addEventListener('click', async () => {
      const newStatus = isActive ? 'Suspended' : 'Active';
      await setDoc(doc(db, "badges", id), {
        ...item,
        status: newStatus,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    });

    div.querySelector('.delete-btn').addEventListener('click', async () => {
      if (confirm(`Delete badge ${id} from cloud DB?`)) {
        await deleteDoc(doc(db, "badges", id));
      }
    });

    badgeListContainer.appendChild(div);
  });
}, (error) => {
  console.error("Snapshot listener error:", error);
  badgeListContainer.innerHTML = '<p style="color: var(--error); font-size: 0.85rem;">Error loading live data from Cloud DB.</p>';
});

// ADMIN PANEL TOGGLE
document.getElementById('toggleAdminBtn').addEventListener('click', () => {
  adminPanel.style.display = adminPanel.style.display === 'block' ? 'none' : 'block';
});