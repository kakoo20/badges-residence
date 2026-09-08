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
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/\s+/g, "");
}

// UI ELEMENTS
const verifyForm = document.getElementById('verifyForm');
const checkIdInput = document.getElementById('checkId');
const verifyBtn = document.getElementById('verifyBtn');

const addBadgeForm = document.getElementById('addBadgeForm');
const saveBtn = document.getElementById('saveBtn');
const badgeListContainer = document.getElementById('badgeList');
const adminPanel = document.getElementById('adminPanel');

// MODAL ELEMENTS
const resultModal = document.getElementById('resultModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const modalDismissBtn = document.getElementById('modalDismissBtn');
const modalStatusBadge = document.getElementById('modalStatusBadge');
const modalTitle = document.getElementById('modalTitle');
const modalDetails = document.getElementById('modalDetails');

function showModal(isValid, titleText, detailsHtml) {
  modalStatusBadge.className = `modal-status-badge ${isValid ? 'valid' : 'invalid'}`;
  modalStatusBadge.textContent = isValid ? '✓' : '✕';
  
  modalTitle.className = `modal-title ${isValid ? 'valid' : 'invalid'}`;
  modalTitle.textContent = titleText;
  
  modalDetails.innerHTML = detailsHtml;
  resultModal.classList.add('active');
}

function hideModal() {
  resultModal.classList.remove('active');
}

closeModalBtn.addEventListener('click', hideModal);
modalDismissBtn.addEventListener('click', hideModal);
resultModal.addEventListener('click', (e) => {
  if (e.target === resultModal) hideModal();
});

// CORE LOOKUP FUNCTION
async function performVerification(rawBadgeId) {
  const badgeId = cleanId(rawBadgeId);
  if (!badgeId) return;

  checkIdInput.value = badgeId;
  verifyBtn.disabled = true;
  verifyBtn.textContent = "Vérification dans le Cloud...";

  try {
    const docRef = doc(db, "badges", badgeId);
    const docSnap = await getDoc(docRef);

    if (docSnap.exists()) {
      const worker = docSnap.data();
      const isActive = worker.status && worker.status.toLowerCase() === 'active';

      const detailsHtml = `
        <strong>ID:</strong> ${badgeId}<br>
        <strong>Ouvrier:</strong> ${worker.name || 'N/A'}<br>
        <strong>Rôle:</strong> ${worker.role || 'N/A'}<br>
        <strong>Statut:</strong> <span style="color: ${isActive ? 'var(--success)' : 'var(--error)'}; font-weight: bold;">${worker.status === 'Active' ? 'Actif' : worker.status === 'Suspended' ? 'Suspendu' : worker.status}</span>
      `;

      showModal(
        isActive,
        isActive ? 'Badge Légitime' : 'Badge Inactif / Révoqué',
        detailsHtml
      );
    } else {
      showModal(
        false,
        'Badge Inconnu',
        `Aucun enregistrement trouvé pour l'ID: <strong>${badgeId}</strong>`
      );
    }
  } catch (err) {
    console.error("Firestore Fetch Error:", err);
    showModal(
      false,
      'Erreur de Connexion',
      'Impossible de contacter la base de données. Vérifiez la console ou votre connexion.'
    );
  } finally {
    verifyBtn.disabled = false;
    verifyBtn.textContent = "Vérifier le Badge";
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

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has('id')) {
    badgeId = urlParams.get('id');
  }

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

checkUrlForBadge();

// ADD / UPDATE BADGE IN FIRESTORE
addBadgeForm.addEventListener('submit', async function(e) {
  e.preventDefault();
  
  const id = cleanId(document.getElementById('newId').value);
  const name = document.getElementById('newName').value.trim();
  const role = document.getElementById('newRole').value.trim();
  const status = document.getElementById('newStatus').value;

  saveBtn.disabled = true;
  saveBtn.textContent = "Enregistrement...";

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
    alert("Échec de l'enregistrement dans la BDD cloud. Vérifiez la console.");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Enregistrer dans la BDD Cloud";
  }
});

// REAL-TIME SYNC FOR ADMIN LIST
onSnapshot(badgesCollection, (snapshot) => {
  badgeListContainer.innerHTML = '<strong style="font-size:0.8rem; color:var(--text-muted); display:block; margin-bottom:0.5rem;">BADGES EN DIRECT DANS LE CLOUD:</strong>';

  if (snapshot.empty) {
    badgeListContainer.innerHTML += '<p style="font-size:0.85rem; color:var(--text-muted);">Aucun badge trouvé dans Firestore. Ajoutez-en un ci-dessus !</p>';
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
        <div style="color: var(--text-muted); font-size: 0.75rem;">${item.role}</div>
        <span class="badge-status-tag ${isActive ? 'tag-active' : 'tag-suspended'}">${isActive ? 'Actif' : 'Suspendu'}</span>
      </div>
      <div class="action-group">
        <button class="status-btn" style="background-color: ${isActive ? '#f59e0b' : '#10b981'}; color: #000;">
          ${isActive ? 'Suspendre' : 'Activer'}
        </button>
        <button class="delete-btn">Supprimer</button>
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
      if (confirm(`Supprimer le badge ${id} de la BDD cloud ?`)) {
        await deleteDoc(doc(db, "badges", id));
      }
    });

    badgeListContainer.appendChild(div);
  });
}, (error) => {
  console.error("Snapshot listener error:", error);
  badgeListContainer.innerHTML = '<p style="color: var(--error); font-size: 0.85rem;">Erreur lors du chargement des données depuis le Cloud.</p>';
});

// ADMIN PANEL TOGGLE
document.getElementById('toggleAdminBtn').addEventListener('click', () => {
  adminPanel.style.display = adminPanel.style.display === 'block' ? 'none' : 'block';
});