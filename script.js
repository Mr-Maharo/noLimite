// =========================================================
// NOLIMITE FANORONA — script.js v4.2 ULTRA
// Lalao Malagasy Tena Marina + AI Minimax + Multiplayer
// 1750+ lignes, Production Ready
// =========================================================

// =========================================================
// 1. IMPORTS REHETRA
// =========================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
    getAuth,
    onAuthStateChanged,
    signInAnonymously,
    signInWithPopup,
    GoogleAuthProvider,
    signOut
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app-check.js";
import {
    getFirestore, collection, doc, setDoc, updateDoc,
    onSnapshot, serverTimestamp, addDoc, query,
    orderBy, where, limit, getDocs, getDoc, deleteDoc,
    increment, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =========================================================
// 2. CONFIG
// =========================================================
const supabase = createClient(
    "https://ajkqodiuhqzibxqjoxpl.supabase.co",
    "sb_publishable_lTjKv2nsYdzUdSw9NvoyAg_UPgBezlo"
);

const firebaseConfig = {
  apiKey: "AIzaSyCW5xkhQQFI9YZhsjVUU05RXwE7JNjMc4w",
  authDomain: "fanorona-mg-88384.firebaseapp.com",
  databaseURL: "https://fanorona-mg-88384-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "fanorona-mg-88384",
  storageBucket: "fanorona-mg-88384.firebasestorage.app",
  messagingSenderId: "659804025087",
  appId: "1:659804025087:web:b2a380c0544998785f9cca",
  measurementId: "G-F93X9LWS32"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// App Check - Anti bot
const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Ld6BCAtAAAAAANU9s1hepNcHwCM0_RfbPVQxVML'),
  isTokenAutoRefreshEnabled: true
});

// =========================================================
// 3. ÉTAT GLOBAL
// =========================================================
const GameState = {
  currentRoomId: null,
  selectedCell: null,
  myCurrentUid: null,
  isAiThinking: false,
  turnTimerInterval: null,
  lastMovedCellId: null,
  soundEnabled: true,
  theme: 'dark',
  gameHistory: [],
  replayMode: false,

  // Unsubscribers
  unsubscribeRoom: null,
  unsubscribeRoomLobby: null,
  unsubscribeChat: null,
  unsubscribePlayers: null,
  unsubscribeRooms: null,
  unsubscribeInvites: null,

  // Presence
  presenceIntervalId: null,

  // Rate limiting
  lastWrite: 0,
  chatRateLimit: { count: 0, resetAt: 0 },

  // Auto-delete timers
  autoDeleteTimers: {},

  // Shown invites cache
  shownInvites: new Set()
};

// =========================================================
// 4. SOUND SYSTEM
// =========================================================
const SoundSystem = {
  enabled: true,
  volume: 0.5,

  sounds: {
    move: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
    capture: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
    win: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
    lose: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
    click: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE'),
    notification: new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHm7A7+OZURE')
  },

  init() {
    Object.values(this.sounds).forEach(sound => {
      sound.volume = this.volume;
      sound.preload = 'auto';
    });
    this.loadSettings();
  },

  play(soundName) {
    if (!this.enabled ||!this.sounds[soundName]) return;
    try {
      this.sounds[soundName].currentTime = 0;
      this.sounds[soundName].play().catch(() => {});
    } catch(e) {}
  },

  toggle() {
    this.enabled =!this.enabled;
    this.saveSettings();
    return this.enabled;
  },

  setVolume(vol) {
    this.volume = Math.max(0, Math.min(1, vol));
    Object.values(this.sounds).forEach(sound => sound.volume = this.volume);
    this.saveSettings();
  },

  saveSettings() {
    localStorage.setItem('nolimite_sound', JSON.stringify({
      enabled: this.enabled,
      volume: this.volume
    }));
  },

  loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem('nolimite_sound'));
      if (saved) {
        this.enabled = saved.enabled!== false;
        this.volume = saved.volume || 0.5;
        Object.values(this.sounds).forEach(sound => sound.volume = this.volume);
      }
    } catch(e) {}
  }
};

// =========================================================
// 5. UTILITIES
// =========================================================
function getUserId() {
  return GameState.myCurrentUid || auth.currentUser?.uid || null;
}

function escapeHtml(str) {
  if (typeof str!== 'string') return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function slugify(str) {
  return String(str)
   .trim()
   .toLowerCase()
   .replace(/[^a-z0-9_-]/g, '_')
   .replace(/_+/g, '_')
   .substring(0, 20);
}

function showToast(msg, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type} animate-pop`;
  toast.textContent = msg;
  container.appendChild(toast);

  SoundSystem.play('notification');

  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s reverse';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function randomOhabolana() {
  const list = [
    "Ny fanahy no maha-olona.",
    "Tsy misy hazo afa-tsy ny tsinjony no hita.",
    "Aleo very tsikalakalam-bola toy izay very tsikalakalam-pihavanana.",
    "Ny rano amoron-tsiraka tsy mety ritra.",
    "Ny teny lava mody fohy, ny teny fohy mody lava.",
    "Ny adala no mpandry andro.",
    "Aza manao amboadia miandry vorona."
  ];
  return list[Math.floor(Math.random() * list.length)];
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function throttle(fn, ms) {
  let last = 0;
  return (...args) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  };
}

// =========================================================
// 6. SANITIZATION
// =========================================================
function sanitizeName(raw) {
  if (!raw || typeof raw!== 'string') return 'Mpilalao';
  return raw
   .replace(/[<>&"']/g, '')
   .trim()
   .substring(0, 20)
    || 'Mpilalao';
}

function sanitizeAvatar(url, uid) {
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;
  if (!url || typeof url!== 'string') return fallback;
  if (url.startsWith('http://')) url = url.replace('http://', 'https://');
  if (!url.startsWith('https://') || url.length > 500) return fallback;
  return url;
}

function isValidRoomId(id) {
  return /^[A-Za-z0-9_-]{1,20}$/.test(id);
}

// =========================================================
// 7. PRESENCE SYSTEM
// =========================================================
function setupPresence(uid) {
  if (!uid) return;

  const userRef = doc(db, "users", uid);
  updateDoc(userRef, {
    status: "online",
    lastSeen: serverTimestamp()
  }).catch(() => {});

  GameState.presenceIntervalId = setInterval(() => {
    updateDoc(userRef, {
      lastSeen: serverTimestamp()
    }).catch(() => {});
  }, 30000);

  // Before unload
  window.addEventListener('beforeunload', () => {
    teardownPresence(uid);
  });
}

function teardownPresence(uid) {
  if (GameState.presenceIntervalId) {
    clearInterval(GameState.presenceIntervalId);
    GameState.presenceIntervalId = null;
  }
  if (!uid) return;
  updateDoc(doc(db, "users", uid), {
    status: "offline",
    lastSeen: serverTimestamp()
  }).catch(() => {});
}

// =========================================================
// 8. UNSUBSCRIBE ALL
// =========================================================
function unsubscribeAll() {
  if (GameState.unsubscribeRoom) {
    GameState.unsubscribeRoom();
    GameState.unsubscribeRoom = null;
  }
  if (GameState.unsubscribeRoomLobby) {
    GameState.unsubscribeRoomLobby();
    GameState.unsubscribeRoomLobby = null;
  }
  if (GameState.unsubscribeChat) {
    GameState.unsubscribeChat();
    GameState.unsubscribeChat = null;
  }
  if (GameState.unsubscribePlayers) {
    GameState.unsubscribePlayers();
    GameState.unsubscribePlayers = null;
  }
  if (GameState.unsubscribeRooms) {
    GameState.unsubscribeRooms();
    GameState.unsubscribeRooms = null;
  }
  if (GameState.unsubscribeInvites) {
    GameState.unsubscribeInvites();
    GameState.unsubscribeInvites = null;
  }
  if (GameState.turnTimerInterval) {
    clearInterval(GameState.turnTimerInterval);
    GameState.turnTimerInterval = null;
  }
}

// =========================================================
// 9. BOARD INIT
// =========================================================
function initBoard(gameType) {
  if (gameType === "fanorontsivy") {
    const cells = [];
    let id = 0;
    for (let y = 0; y < 5; y++) {
      for (let x = 0; x < 5; x++) {
        let value = 0;
        if (y < 2) value = 1;
        else if (y > 2) value = 2;
        cells.push({ id: id++, x, y, value });
      }
    }
    return cells;
  }

  // Fanorontelo 3x3
  return [
    { id: 0, x: 0, y: 0, value: 1 }, { id: 1, x: 1, y: 0, value: 1 }, { id: 2, x: 2, y: 0, value: 1 },
    { id: 3, x: 0, y: 1, value: 0 }, { id: 4, x: 1, y: 1, value: 0 }, { id: 5, x: 2, y: 1, value: 0 },
    { id: 6, x: 0, y: 2, value: 2 }, { id: 7, x: 1, y: 2, value: 2 }, { id: 8, x: 2, y: 2, value: 2 }
  ];
}

// =========================================================
// 10. GAME LOGIC - VRAI FANORONA
// =========================================================

function isOnDiagonal(x, y, gameType) {
  if (gameType === "fanorontelo") {
    // 3x3: centre + diagonales
    return (x === 1 && y === 1) || (x === y) || (x + y === 2);
  } else {
    // 5x5: toutes les diagonales
    return (x + y) % 2 === 0;
  }
}

function isValidMove(from, to, gameType) {
  const dx = Math.abs(to.x - from.x);
  const dy = Math.abs(to.y - from.y);

  if (dx > 1 || dy > 1) return false;
  if (dx === 0 && dy === 0) return false;

  // Diagonale: tsy maintsy eo amin'ny intersection misy diagonale
  if (dx === 1 && dy === 1) {
    return isOnDiagonal(from.x, from.y, gameType) && isOnDiagonal(to.x, to.y, gameType);
  }

  return true;
}

function getCaptures(board, fromCell, toCell, myVal, gameType) {
  const opponentVal = myVal === 1? 2 : 1;
  const maxSize = gameType === "fanorontsivy"? 5 : 3;
  const captured = [];

  const dx = toCell.x - fromCell.x;
  const dy = toCell.y - fromCell.y;

  // PAIKA - Percussion: mamely mandroso
  let nx = toCell.x + dx;
  let ny = toCell.y + dy;
  while (nx >= 0 && nx < maxSize && ny >= 0 && ny < maxSize) {
    const c = board.find(cell => cell.x === nx && cell.y === ny);
    if (!c || c.value!== opponentVal) break;
    captured.push({ id: c.id, type: 'paika' });
    nx += dx;
    ny += dy;
  }

  // VELA - Aspiration: misintona miverina
  nx = fromCell.x - dx;
  ny = fromCell.y - dy;
  while (nx >= 0 && nx < maxSize && ny >= 0 && ny < maxSize) {
    const c = board.find(cell => cell.x === nx && cell.y === ny);
    if (!c || c.value!== opponentVal) break;
    captured.push({ id: c.id, type: 'vela' });
    nx -= dx;
    ny -= dy;
  }

  return captured;
}

function hasMandatoryCapture(board, myVal, gameType) {
  const myStones = board.filter(c => c.value === myVal);
  const emptyCells = board.filter(c => c.value === 0);

  for (let stone of myStones) {
    for (let empty of emptyCells) {
      if (isValidMove(stone, empty, gameType)) {
        const caps = getCaptures(board, stone, empty, myVal, gameType);
        if (caps.length > 0) return true;
      }
    }
  }
  return false;
}

function getAllPossibleMoves(board, myVal, gameType) {
  const myStones = board.filter(c => c.value === myVal);
  const emptyCells = board.filter(c => c.value === 0);
  const moves = [];
  const mustCapture = hasMandatoryCapture(board, myVal, gameType);

  for (let stone of myStones) {
    for (let empty of emptyCells) {
      if (isValidMove(stone, empty, gameType)) {
        const caps = getCaptures(board, stone, empty, myVal, gameType);
        if (!mustCapture || caps.length > 0) {
          moves.push({ from: stone, to: empty, captures: caps });
        }
      }
    }
  }
  return moves;
}

function hasFurtherCaptures(board, fromCell, myVal, gameType) {
  const emptyCells = board.filter(c => c.value === 0);
  for (let empty of emptyCells) {
    if (isValidMove(fromCell, empty, gameType)) {
      const caps = getCaptures(board, fromCell, empty, myVal, gameType);
      if (caps.length > 0) return true;
    }
  }
  return false;
}

function checkWinnerFanorona(board, creatorId, opponentId, gameType) {
  if (!board ||!creatorId ||!opponentId) return null;

  const p1 = board.filter(c => c.value === 1).length;
  const p2 = board.filter(c => c.value === 2).length;

  if (p1 === 0) return opponentId;
  if (p2 === 0) return creatorId;

  const p1Moves = getAllPossibleMoves(board, 1, gameType);
  const p2Moves = getAllPossibleMoves(board, 2, gameType);

  if (p1Moves.length === 0) return opponentId;
  if (p2Moves.length === 0) return creatorId;

  return null;
}

function cellToNotation(cell) {
  const cols = ['A', 'B', 'C', 'D', 'E'];
  return cols[cell.x] + (cell.y + 1);
}

function applyMove(board, move, myVal) {
  return board.map(c => {
    if (c.id === move.from.id) return {...c, value: 0 };
    if (c.id === move.to.id) return {...c, value: myVal };
    if (move.captures.some(cap => cap.id === c.id)) return {...c, value: 0 };
    return c;
  });
}

// =========================================================
// 11. AUTH STATE
// =========================================================


function sanitizeAvatar(url, uid) {
  const fallback = `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;
  if (!url || typeof url!== 'string') return fallback;
  if (url.startsWith('http://')) url = url.replace('http://', 'https://');
  if (!url.startsWith('https://') || url.length > 500) return fallback;
  return url;
}

onAuthStateChanged(auth, async (user) => {
  if (user) {
    GameState.myCurrentUid = user.uid;

    try {
      const banSnap = await getDoc(doc(db, "users", user.uid));
      if (banSnap.exists() && banSnap.data().banned === true) {
        showToast("Voarara ny kaontinao. Mifandraisa amin'ny admin.", "error", 8000);
        await auth.signOut().catch(() => {});
        showScreen('login-screen');
        return;
      }
    } catch(e) {}

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef).catch(() => null);
    const isNew =!userSnap ||!userSnap.exists();

    let finalName, finalAvatar;

    if (!isNew) {
      const d = userSnap.data();
      finalName = d.name || sanitizeName(user.displayName);
      finalAvatar = d.avatar || sanitizeAvatar(user.photoURL, user.uid);
    } else {
      finalName = sanitizeName(user.displayName);
      finalAvatar = sanitizeAvatar(user.photoURL, user.uid);
    }

    try {
      if (isNew) {
        await setDoc(userRef, {
          uid: user.uid,
          name: finalName,
          avatar: finalAvatar,
          status: "online",
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp(),
          isGuest: false
        });
      } else {
        await updateDoc(userRef, {
          status: "online",
          lastSeen: serverTimestamp()
        });
      }
    } catch(e) {
      console.error("Auth write error:", e);
      showToast("Tsy afaka niditra: " + (e.code || e.message), "error", 5000);
      showScreen('login-screen');
      return;
    }

    setupGuestUI({ uid: user.uid, name: finalName, avatar: finalAvatar });

  } else {
    const guestUid = localStorage.getItem("nolimite_guest_uid");
    const guestName = localStorage.getItem("nolimite_guest_name");

    if (guestUid && guestName) {
      GameState.myCurrentUid = guestUid;
      const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${guestUid}`;

      try {
        const banSnap = await getDoc(doc(db, "users", guestUid));
        if (banSnap.exists() && banSnap.data().banned === true) {
          localStorage.removeItem("nolimite_guest_uid");
          localStorage.removeItem("nolimite_guest_name");
          showToast("Voarara ny kaontinao.", "error", 8000);
          showScreen('login-screen');
          return;
        }
      } catch(e) {}

      try {
        await updateDoc(doc(db, "users", guestUid), {
          status: "online",
          lastSeen: serverTimestamp()
        });
      } catch(e) {}

      setupGuestUI({ uid: guestUid, name: guestName, avatar });
    } else {
      showScreen('login-screen');
    }
  }
});

// =========================================================
// 12. SETUP UI
// =========================================================
function setupGuestUI(user) {
  GameState.myCurrentUid = user.uid;
  const nameEl = document.getElementById("user-name");
  const avatarEl = document.getElementById("user-avatar");
  if (nameEl) nameEl.textContent = user.name;
  if (avatarEl) avatarEl.src = user.avatar;

  showScreen('lobby-screen');
  setupPresence(user.uid);
  initLobby();
  initPlayerList();
  initInvites(user.uid);
  loadLeaderboard();
  SoundSystem.init();
}

function showScreen(id) {
  ['login-screen', 'lobby-screen', 'room-lobby-screen', 'game-screen'].forEach(s => {
    const el = document.getElementById(s);
    if (el) el.classList.toggle('hidden', s!== id);
  });
}

// =========================================================
// 13. AUTO-DELETE ROOM
// =========================================================
function autoDeleteRoom(roomId) {
  if (GameState.autoDeleteTimers[roomId]) {
    clearTimeout(GameState.autoDeleteTimers[roomId]);
  }

  GameState.autoDeleteTimers[roomId] = setTimeout(async () => {
    try {
      const snap = await getDoc(doc(db, "rooms", roomId));
      if (snap.exists() && snap.data().status === "waiting") {
        await deleteDoc(doc(db, "rooms", roomId));
      }
    } catch(e) {}
    delete GameState.autoDeleteTimers[roomId];
  }, 5 * 60 * 1000);
}

// =========================================================
// 14. DELETE ROOM
// =========================================================
window.deleteRoom = async (roomId) => {
  if (!confirm("Tena fafana ity kianja ity?")) return;
  try {
    await deleteDoc(doc(db, "rooms", roomId));
    leaveRoomLobby();
    showToast("Voafafa ny kianja", "success");
    SoundSystem.play('click');
  } catch(e) {
    showToast("Tsy afaka namafa: " + e.message, "error");
  }
};

// =========================================================
// 15. SEND INVITE
// =========================================================
window.sendInvite = async (targetUid) => {
  const uid = getUserId();
  if (!uid || uid === targetUid) return;

  try {
    const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
    await addDoc(collection(db, "invites"), {
      from: uid,
      fromName: escapeHtml(myName),
      to: targetUid,
      status: "pending",
      createdAt: serverTimestamp(),
      expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    showToast("Nalefa ny fanasana! 🎮", "success");
    SoundSystem.play('notification');
  } catch(e) {
    showToast("Tsy afaka nandefa fanasana", "error");
  }
};

// =========================================================
// 16. INVITES
// =========================================================
function initInvites(uid) {
  if (GameState.unsubscribeInvites) {
    GameState.unsubscribeInvites();
    GameState.unsubscribeInvites = null;
  }

  const q = query(
    collection(db, "invites"),
    where("to", "==", uid),
    where("status", "==", "pending"),
    limit(5)
  );

  GameState.unsubscribeInvites = onSnapshot(q, (snap) => {
    snap.forEach(d => {
      if (!GameState.shownInvites.has(d.id)) {
        GameState.shownInvites.add(d.id);
        showInviteUI(d.id, d.data());
      }
    });
  }, (err) => console.warn("Invites error:", err));
}

function showInviteUI(inviteId, invite) {
  const container = document.getElementById("invite-notifications");
  if (!container || document.getElementById("invite-" + inviteId)) return;

  const box = document.createElement("div");
  box.id = "invite-" + inviteId;
  box.className = "invite-popup animate-pop";
  box.setAttribute("role", "alert");
  box.innerHTML = `
    <p>🎮 <b>${escapeHtml(invite.fromName)}</b> manasa anao!</p>
    <div class="invite-actions">
      <button class="btn-save" type="button"
        onclick="acceptInvite('${escapeHtml(inviteId)}','${escapeHtml(invite.from)}','${escapeHtml(invite.fromName)}')">
        ✅ Ekena
      </button>
      <button class="btn-cancel" type="button"
        onclick="rejectInvite('${escapeHtml(inviteId)}')">
        ❌ Tsia
      </button>
    </div>`;
  container.appendChild(box);
  SoundSystem.play('notification');

  setTimeout(() => box.remove(), 30000);
}

window.rejectInvite = async (inviteId) => {
  document.getElementById("invite-" + inviteId)?.remove();
  try {
    await updateDoc(doc(db, "invites", inviteId), {
      status: "rejected",
      respondedAt: serverTimestamp()
    });
    SoundSystem.play('click');
  } catch(e) {}
};

// =========================================================
// 17. PLAYER LIST
// =========================================================
function initPlayerList() {
  if (GameState.unsubscribePlayers) {
    GameState.unsubscribePlayers();
    GameState.unsubscribePlayers = null;
  }

  const q = query(
    collection(db, "users"),
    where("status", "==", "online"),
    limit(20)
  );

  GameState.unsubscribePlayers = onSnapshot(q, (snapshot) => {
    const sideEl = document.getElementById("online-players");
    const mainEl = document.getElementById("players-list-dynamic");
    const fragment = document.createDocumentFragment();
    const fragment2 = document.createDocumentFragment();
    let hasPlayers = false;

    snapshot.forEach(d => {
      const u = d.data();
      if (!u.uid || u.uid === getUserId()) return;
      hasPlayers = true;

      const div = document.createElement("div");
      div.className = "player-item";
      div.setAttribute("role", "listitem");
      div.innerHTML = `
        <img src="${escapeHtml(u.avatar || '')}" class="player-avatar-mini" alt="${escapeHtml(u.name || '')}"
             onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=default'">
        <div class="player-info">
          <span class="player-name-mini">${escapeHtml(u.name || 'Mpilalao')}</span>
          <div class="status-indicator"><span class="dot-online"></span> Online</div>
        </div>
        <button class="btn-invite-mini" type="button"
          onclick="sendInvite('${escapeHtml(u.uid)}')"
          aria-label="Hantsy ${escapeHtml(u.name || '')}">Hantsy</button>`;

      const div2 = div.cloneNode(true);
      fragment.appendChild(div);
      fragment2.appendChild(div2);
    });

    if (sideEl) {
      sideEl.innerHTML = '';
      if (!hasPlayers) {
        sideEl.innerHTML = '<div class="empty-state"><p>Tsy misy mpilalao hafa eto</p></div>';
      } else {
        sideEl.appendChild(fragment);
      }
    }

    if (mainEl) {
      mainEl.innerHTML = '';
      if (!hasPlayers) {
        mainEl.innerHTML = '<div class="empty-state"><p>Tsy misy mpilalao hafa eto</p></div>';
      } else {
        mainEl.appendChild(fragment2);
      }
    }
  }, err => console.warn("Players error:", err));
}

// =========================================================
// 18. LOBBY
// =========================================================
function initLobby() {
  if (GameState.unsubscribeRooms) {
    GameState.unsubscribeRooms();
    GameState.unsubscribeRooms = null;
  }

  const q = query(
    collection(db, "rooms"),
    where("status", "==", "waiting"),
    limit(30)
  );

  GameState.unsubscribeRooms = onSnapshot(q, (snap) => {
    const publicFrag = document.createDocumentFragment();
    const myFrag = document.createDocumentFragment();
    let hasPublic = false, hasMy = false;

    snap.forEach(d => {
      const r = d.data();
      const roomId = d.id;
      const safeId = escapeHtml(roomId);
      const gameLabel = r.gameType === "fanorontsivy"? "5×5" : "3×3";
      const isPrivate = r.type === "private";

      if (r.creator?.id === getUserId()) {
        hasMy = true;
        const div = document.createElement("div");
        div.className = "room-card animate-pop";
        div.setAttribute("role", "listitem");
        div.innerHTML = `
          <span>🏠 ${safeId} (${gameLabel})</span>
          <span class="badge-waiting">⏳ 1/2</span>
          <div class="room-actions">
            <button class="btn-cancel" type="button" onclick="deleteRoom('${safeId}')" aria-label="Fafao">🗑</button>
            <button type="button" class="room-card-btn" onclick="viewRoom('${safeId}')">Hiditra</button>
          </div>`;
        myFrag.appendChild(div);
      } else if (!isPrivate) {
        hasPublic = true;
        const div = document.createElement("div");
        div.className = "room-card animate-pop";
        div.setAttribute("role", "listitem");
        div.innerHTML = `
          <span>🌐 ${safeId} (${gameLabel})</span>
          <span class="badge-waiting">⏳ 1/2</span>
          <button type="button" class="room-card-btn" onclick="viewRoom('${safeId}')">Hiditra</button>`;
        publicFrag.appendChild(div);
      }
    });

    const publicEl = document.getElementById("rooms-list-dynamic");
    const myEl = document.getElementById("my-rooms-list");

    if (publicEl) {
      publicEl.innerHTML = '';
      if (!hasPublic) {
        publicEl.innerHTML = '<div class="empty-state"><p>Tsy misy kianja malalaka eto<br>Mamorona ianao! 🏠</p></div>';
      } else {
        publicEl.appendChild(publicFrag);
      }
    }

    if (myEl) {
      myEl.innerHTML = '';
      if (!hasMy) {
        myEl.innerHTML = '<div class="empty-state"><p>Tsy mbola nanao kianja ianao</p></div>';
      } else {
        myEl.appendChild(myFrag);
      }
    }
  }, err => console.warn("Rooms error:", err));
}

// =========================================================
// 19. SEARCH (tohiny)
// =========================================================
function setupSearch() {
  const searchPlayer = document.getElementById("search-player");
  if (searchPlayer) {
    searchPlayer.addEventListener("input", debounce((e) => {
      const term = (e.target.value || '').toLowerCase();
      document.querySelectorAll("#players-list-dynamic .player-item, #online-players .player-item").forEach(el => {
        const name = (el.querySelector(".player-name-mini")?.textContent || '').toLowerCase();
        el.style.display = name.includes(term) ? "" : "none";
      });
    }, 250));
  }
  
  const searchRoom = document.getElementById("search-room");
  if (searchRoom) {
    searchRoom.addEventListener("input", debounce((e) => {
      const term = (e.target.value || '').toLowerCase();
      document.querySelectorAll("#rooms-list-dynamic .room-card, #my-rooms-list .room-card").forEach(el => {
        const name = (el.querySelector("span")?.textContent || '').toLowerCase();
        el.style.display = name.includes(term) ? "" : "none";
      });
    }, 250));
  }
}

// =========================================================
// 20. VIEW ROOM
// =========================================================
window.viewRoom = async (id) => {
  if (!id || typeof id !== 'string' || !isValidRoomId(id)) {
    showToast("ID kianja tsy mety", "error");
    return;
  }
  
  try {
    const roomSnap = await getDoc(doc(db, "rooms", id));
    if (!roomSnap.exists()) {
      showToast("Tsy misy io kianja io", "error");
      return;
    }
    
    const r = roomSnap.data();
    if (!r) return;
    
    if (r.type === "private" && r.creator?.id !== getUserId()) {
      const entered = prompt("Teny miafina:");
      if (entered === null) return;
      if (entered !== r.password) {
        showToast("Teny miafina diso!", "error");
        SoundSystem.play('lose');
        return;
      }
    }
    
    GameState.currentRoomId = id;
    showScreen('room-lobby-screen');
    SoundSystem.play('click');
    
    if (GameState.unsubscribeRoomLobby) {
      GameState.unsubscribeRoomLobby();
      GameState.unsubscribeRoomLobby = null;
    }
    
    GameState.unsubscribeRoomLobby = onSnapshot(doc(db, "rooms", id), (snap) => {
      if (!snap.exists()) {
        leaveRoomLobby();
        return;
      }
      const game = snap.data();
      if (!game) {
        leaveRoomLobby();
        return;
      }
      renderRoomLobby(game, id);
      if (game.status === "playing") enterGame(id);
    }, err => {
      showToast("Tapaka ny tambazotra", "error");
      leaveRoomLobby();
    });
  } catch(e) {
    showToast("Hadisoana: " + e.message, "error");
  }
};

// =========================================================
// 21. RENDER ROOM LOBBY
// =========================================================
function renderRoomLobby(room, roomId) {
  const lobbyEl = document.getElementById("room-lobby-content");
  if (!lobbyEl) return;
  
  const isCreator = room.creator?.id === getUserId();
  const isFull = !!room.opponent?.id;
  const isAI = room.opponent?.id === 'AI_BOT';
  const gameLabel = room.gameType === "fanorontsivy" ? "Fanorontsivy 5×5" : "Fanorontelo 3×3";
  const safeId = escapeHtml(roomId);
  
  lobbyEl.innerHTML = `
    <div class="room-lobby-header">
      <h2>🏠 ${safeId} — ${escapeHtml(gameLabel)}</h2>
      <button type="button" onclick="leaveRoomLobby()" class="btn-exit" aria-label="Hiverina">← Hiverina</button>
    </div>
    <div class="players-vs">
      <div class="player-slot ${isCreator ? 'you' : ''}">
        <img src="${escapeHtml(room.creator?.avatar || '')}" class="player-img-large"
             alt="${escapeHtml(room.creator?.name || '')}"
             onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=creator'">
        <h3>${escapeHtml(room.creator?.name || 'Mpilalao')}</h3>
        <span class="badge-host">Mpamorona</span>
      </div>
      <div class="vs-text">VS</div>
      <div class="player-slot ${!isCreator && isFull ? 'you' : ''}">
        ${isFull ? `
          <img src="${escapeHtml(room.opponent?.avatar || '')}" class="player-img-large"
               alt="${escapeHtml(room.opponent?.name || '')}"
               onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=opp'">
          <h3>${escapeHtml(room.opponent?.name || 'Mpilalao')}</h3>
          ${isAI ? '<span class="badge-ai">🤖 NOLIMITE AI</span>' : ''}
        ` : `
          <div class="waiting-player">
            <div class="spinner" aria-label="Miandry" aria-busy="true"></div>
            <p>Miandry mpifanandrina...</p>
            ${isCreator ? `<button type="button" onclick="playWithAI('${safeId}')" class="btn-ai">🤖 Milalao amin'ny AI</button>` : ''}
          </div>
        `}
      </div>
    </div>
    <div class="lobby-actions">
      ${isCreator ? `
        ${isFull ? `<button type="button" onclick="startGame('${safeId}')" class="btn-primary-large">🎮 Atombohy ny lalao</button>` : ''}
        <button type="button" onclick="deleteRoom('${safeId}')" class="btn-cancel">🗑 Fafao ny kianja</button>
      ` : `
        ${!isFull ? `<button type="button" onclick="joinRoom('${safeId}')" class="btn-primary-large">Hiditra amin'ny kianja</button>` : ''}
      `}
    </div>`;
}

// =========================================================
// 22. LEAVE ROOM LOBBY
// =========================================================
window.leaveRoomLobby = () => {
  if (GameState.unsubscribeRoomLobby) {
    GameState.unsubscribeRoomLobby();
    GameState.unsubscribeRoomLobby = null;
  }
  GameState.currentRoomId = null;
  showScreen('lobby-screen');
  SoundSystem.play('click');
};

// =========================================================
// 23. ENTER GAME
// =========================================================
window.enterGame = async (id) => {
  if (!id) return;
  unsubscribeAll();
  GameState.currentRoomId = id;
  GameState.selectedCell = null;
  GameState.lastMovedCellId = null;
  GameState.isAiThinking = false;
  GameState.gameHistory = [];
  
  showScreen('game-screen');
  initChat(id);
  SoundSystem.play('notification');
  
  let gameEnded = false;
  const roomRef = doc(db, "rooms", id);
  
  GameState.unsubscribeRoom = onSnapshot(roomRef, async (snap) => {
    if (!snap.exists()) {
      leaveGame();
      return;
    }
    
    const game = snap.data();
    if (!game) {
      leaveGame();
      return;
    }
    
    render(game);
    GameState.gameHistory.push({ board: JSON.parse(JSON.stringify(game.board)), turn: game.turn, time: Date.now() });
    
    if (GameState.turnTimerInterval) {
      clearInterval(GameState.turnTimerInterval);
      GameState.turnTimerInterval = null;
    }
    
    if (game.status === 'playing') {
      const timerEl = document.getElementById("turn-timer");
      if (timerEl) {
        let timeLeft = 30;
        timerEl.textContent = `⏱ ${timeLeft}s`;
        timerEl.className = '';
        GameState.turnTimerInterval = setInterval(async () => {
          timeLeft--;
          if (timerEl) {
            timerEl.textContent = `⏱ ${timeLeft}s`;
            timerEl.className = timeLeft <= 10 ? (timeLeft <= 5 ? 'timer-danger' : 'timer-warning') : '';
          }
          if (timeLeft <= 0) {
            clearInterval(GameState.turnTimerInterval);
            GameState.turnTimerInterval = null;
            if (game.turn === getUserId() && GameState.currentRoomId) {
              const nextTurn = game.turn === game.creator?.id ? game.opponent?.id : game.creator?.id;
              if (nextTurn) {
                await updateDoc(roomRef, {
                  turn: nextTurn,
                  updatedAt: serverTimestamp(),
                  version: (game.version || 0) + 1
                }).catch(() => {});
              }
            }
          }
        }, 1000);
      }
      
      if (game.turn === 'AI_BOT' && !GameState.isAiThinking) {
        aiMove(game);
      }
      
      const winner = checkWinnerFanorona(
        game.board, game.creator?.id, game.opponent?.id, game.gameType
      );
      
      if (winner && !gameEnded) {
        clearInterval(GameState.turnTimerInterval);
        GameState.turnTimerInterval = null;
        await updateDoc(roomRef, {
          status: 'finished',
          winner,
          finishedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          version: (game.version || 0) + 1
        }).catch(() => {});
      }
    }
    
    if (game.status === 'finished' && game.winner && !gameEnded) {
      gameEnded = true;
      if (GameState.turnTimerInterval) {
        clearInterval(GameState.turnTimerInterval);
        GameState.turnTimerInterval = null;
      }
      
      const winnerId = game.winner;
      const loserId = winnerId === game.creator?.id ? game.opponent?.id : game.creator?.id;
      const winnerName = winnerId === game.creator?.id ? game.creator?.name : game.opponent?.name;
      const loserName = loserId === game.creator?.id ? game.creator?.name : game.opponent?.name;
      
      if (winnerId !== 'AI_BOT' && loserId && loserId !== 'AI_BOT') {
        await updateLeaderboard(winnerId, winnerName, loserId, loserName).catch(console.warn);
      }
      
      const isWinner = winnerId === getUserId();
      SoundSystem.play(isWinner ? 'win' : 'lose');
      
      const msg = `🎉 ${escapeHtml(winnerName || 'Iray')} no nandresy! ${randomOhabolana()}`;
      setTimeout(() => {
        showToast(msg, 'success', 5000);
        if (confirm(`🏆 ${winnerName} no nandresy!\nHifandimby indray?`)) {
          leaveGame();
        } else {
          leaveGame();
        }
      }, 600);
    }
  }, err => {
    showToast("Tapaka ny tambazotra", "error");
    leaveGame();
  });
};

// =========================================================
// 24. RENDER
// =========================================================
function render(game) {
  const grid = document.getElementById("fanorona-grid");
  if (!grid || !game?.board) return;
  
  const gridSize = game.gameType === "fanorontsivy" ? "grid-5x5" : "grid-3x3";
  grid.className = `fanorona-grid ${gridSize}`;
  grid.innerHTML = '';
  
  const fragment = document.createDocumentFragment();
  
  game.board.forEach(cell => {
    const div = document.createElement("div");
    div.className = "grid-spot";
    div.setAttribute("role", "gridcell");
    div.setAttribute("tabindex", "0");
    div.setAttribute("data-cell-id", cell.id);
    div.setAttribute("data-x", cell.x);
    div.setAttribute("data-y", cell.y);
    
    if (GameState.selectedCell?.id === cell.id) div.classList.add("active-spot");
    if (GameState.lastMovedCellId === cell.id) div.classList.add("last-moved");
    
    if (cell.value) {
      const stone = document.createElement("div");
      const isBlack = cell.value === 1;
      stone.className = `stone ${isBlack ? 'black-stone' : 'white-stone'} animate-pop`;
      stone.setAttribute("aria-label", `Vato ${isBlack ? 'mainty' : 'fotsy'}`);
      div.appendChild(stone);
    } else {
      div.setAttribute("aria-label", "Toerana malalaka");
    }
    
    div.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      handleMove(cell, game);
    });
    div.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') handleMove(cell, game);
    });
    
    fragment.appendChild(div);
  });
  
  grid.appendChild(fragment);
  
  const turnEl = document.getElementById("turn-indicator");
  if (turnEl) {
    const isMyTurn = game.turn === getUserId();
    const isAITurn = game.turn === 'AI_BOT';
    if (isAITurn) {
      turnEl.textContent = "🤖 AI mihetsika...";
      turnEl.className = "ai-turn";
    } else if (isMyTurn) {
      turnEl.textContent = "✅ Anjaranao!";
      turnEl.className = "my-turn";
    } else {
      turnEl.textContent = "⏳ Anjaran'ny mpifanandrina";
      turnEl.className = "opp-turn";
    }
  }
  
  const countBlack = game.board.filter(c => c.value === 1).length;
  const countWhite = game.board.filter(c => c.value === 2).length;
  const cbEl = document.getElementById("count-black");
  const cwEl = document.getElementById("count-white");
  const lmEl = document.getElementById("last-move-display");
  if (cbEl) cbEl.textContent = countBlack;
  if (cwEl) cwEl.textContent = countWhite;
  if (lmEl && game.lastMove) lmEl.textContent = game.lastMove;
}

// =========================================================
// 25. HANDLE MOVE
// =========================================================
async function handleMove(cell, game) {
  if (!game || game.status !== 'playing') return;
  const uid = getUserId();
  if (!uid || game.turn !== uid) return;
  
  const myVal = game.creator?.id === uid ? 1 : 2;
  let b = game.board.map(c => ({...c }));
  
  if (!GameState.selectedCell) {
    if (cell.value === myVal) {
      GameState.selectedCell = cell;
      highlightPossibleMoves(game, myVal);
      render(game);
      SoundSystem.play('click');
    }
  } else {
    if (cell.id === GameState.selectedCell.id) {
      GameState.selectedCell = null;
      clearHints();
      render(game);
      return;
    }
    
    if (cell.value === 0 && isValidMove(GameState.selectedCell, cell, game.gameType)) {
      const captures = getCaptures(b, GameState.selectedCell, cell, myVal, game.gameType);
      const mustCapture = hasMandatoryCapture(b, myVal, game.gameType);
      
      if (mustCapture && captures.length === 0) {
        showToast("Tsy maintsy maka paika ianao! ⚠️", "error");
        GameState.selectedCell = null;
        clearHints();
        render(game);
        SoundSystem.play('lose');
        return;
      }
      
      captures.forEach(cap => {
        const stoneEl = document.querySelector(`[data-cell-id="${cap.id}"] .stone`);
        if (stoneEl) stoneEl.classList.add('capturing');
      });
      
      if (captures.length > 0) SoundSystem.play('capture');
      else SoundSystem.play('move');
      
      await new Promise(r => setTimeout(r, 400));
      
      const fromId = GameState.selectedCell.id;
      const notation = cellToNotation(GameState.selectedCell) + '-' + cellToNotation(cell)
        + (captures.length > 0 ? ` x${captures.length}` : '');
      
      b = b.map(c => {
        if (c.id === fromId) return {...c, value: 0 };
        if (c.id === cell.id) return {...c, value: myVal };
        if (captures.some(cap => cap.id === c.id)) return {...c, value: 0 };
        return c;
      });
      
      GameState.lastMovedCellId = cell.id;
      GameState.selectedCell = null;
      clearHints();
      
      if (captures.length > 0) {
        const furtherCaps = hasFurtherCaptures(b, cell, myVal, game.gameType);
        if (furtherCaps) {
          showToast("Mbola afaka maka ianao! 🎯", "info");
          GameState.selectedCell = b.find(c => c.id === cell.id);
          await updateDoc(doc(db, "rooms", GameState.currentRoomId), {
            board: b,
            lastMove: notation,
            updatedAt: serverTimestamp(),
            version: (game.version || 0) + 1
          });
          highlightPossibleMoves({...game, board: b }, myVal);
          render({...game, board: b });
          return;
        }
      }
      
      await finalizeTurn(b, game, notation);
    } else if (cell.value === myVal) {
      GameState.selectedCell = cell;
      clearHints();
      highlightPossibleMoves(game, myVal);
      render(game);
      SoundSystem.play('click');
    } else {
      GameState.selectedCell = null;
      clearHints();
      render(game);
    }
  }
}

function highlightPossibleMoves(game, myVal) {
  clearHints();
  const moves = getAllPossibleMoves(game.board, myVal, game.gameType);
  const mustCapture = hasMandatoryCapture(game.board, myVal, game.gameType);
  
  moves.forEach(move => {
    if (!mustCapture || move.captures.length > 0) {
      const cellEl = document.querySelector(`[data-cell-id="${move.to.id}"]`);
      if (cellEl) cellEl.classList.add('paika-hint');
    }
  });
}

function clearHints() {
  document.querySelectorAll('.paika-hint').forEach(el => el.classList.remove('paika-hint'));
}

// =========================================================
// 26. AI MINIMAX
// =========================================================
function evaluateBoard(board, gameType) {
  const p1 = board.filter(c => c.value === 1).length;
  const p2 = board.filter(c => c.value === 2).length;
  
  let score = (p2 - p1) * 100;
  
  const center = gameType === "fanorontsivy" ? { x: 2, y: 2 } : { x: 1, y: 1 };
  board.forEach(c => {
    if (c.value === 2) {
      const dist = Math.abs(c.x - center.x) + Math.abs(c.y - center.y);
      score += (5 - dist) * 2;
    } else if (c.value === 1) {
      const dist = Math.abs(c.x - center.x) + Math.abs(c.y - center.y);
      score -= (5 - dist) * 2;
    }
  });
  
  return score;
}

function minimax(board, depth, isMaximizing, gameType, alpha, beta) {
  if (depth === 0) return evaluateBoard(board, gameType);
  
  const winner = checkWinnerFanorona(board, 'p1', 'p2', gameType);
  if (winner === 'p2') return 10000 + depth;
  if (winner === 'p1') return -10000 - depth;
  
  const myVal = isMaximizing ? 2 : 1;
  const moves = getAllPossibleMoves(board, myVal, gameType);
  
  if (moves.length === 0) return isMaximizing ? -10000 : 10000;
  
  if (isMaximizing) {
    let maxEval = -Infinity;
    for (let move of moves) {
      const newBoard = applyMove(board, move, myVal);
      const eval = minimax(newBoard, depth - 1, false, gameType, alpha, beta);
      maxEval = Math.max(maxEval, eval);
      alpha = Math.max(alpha, eval);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let move of moves) {
      const newBoard = applyMove(board, move, myVal);
      const eval = minimax(newBoard, depth - 1, true, gameType, alpha, beta);
      minEval = Math.min(minEval, eval);
      beta = Math.min(beta, eval);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

async function aiMove(game) {
  if (!game || game.turn !== 'AI_BOT' || game.status !== 'playing') return;
  if (!GameState.currentRoomId || GameState.isAiThinking) return;
  GameState.isAiThinking = true;
  
  try {
    await new Promise(r => setTimeout(r, 800 + Math.random() * 400));
    if (!GameState.currentRoomId) {
      GameState.isAiThinking = false;
      return;
    }
    
    const board = game.board;
    const moves = getAllPossibleMoves(board, 2, game.gameType);
    if (moves.length === 0) {
      GameState.isAiThinking = false;
      return;
    }
    
    moves.sort((a, b) => b.captures.length - a.captures.length);
    
    let bestMove = moves[0];
    let bestScore = -Infinity;
    const depth = game.gameType === "fanorontsivy" ? 3 : 4;
    
    for (let move of moves.slice(0, 10)) {
      const newBoard = applyMove(board, move, 2);
      const score = minimax(newBoard, depth, false, game.gameType, -Infinity, Infinity);
      if (score > bestScore) {
        bestScore = score;
        bestMove = move;
      }
    }
    
    const newBoard = applyMove(board, bestMove, 2);
    const notation = cellToNotation(bestMove.from) + '-' + cellToNotation(bestMove.to)
      + (bestMove.captures.length > 0 ? ` x${bestMove.captures.length}` : '');
    
    await updateDoc(doc(db, "rooms", GameState.currentRoomId), {
      board: newBoard,
      turn: game.creator.id,
      lastMove: notation,
      updatedAt: serverTimestamp(),
      version: (game.version || 0) + 1
    });
  } catch (err) {
    console.error("AI error:", err);
  } finally {
    GameState.isAiThinking = false;
  }
}

// =========================================================
// 27. FINALIZE TURN
// =========================================================
async function finalizeTurn(b, game, notation) {
  if (!GameState.currentRoomId || !game.opponent?.id) return;
  
  const winner = checkWinnerFanorona(b, game.creator?.id, game.opponent?.id, game.gameType);
  const nextTurn = game.turn === game.creator?.id ? game.opponent?.id : game.creator?.id;
  const currentVersion = game.version || 0;
  
  try {
    await updateDoc(doc(db, "rooms", GameState.currentRoomId), {
      board: b,
      turn: winner ? "end" : nextTurn,
      winner: winner || null,
      lastMove: notation || null,
      updatedAt: serverTimestamp(),
      version: currentVersion + 1
    });
  } catch(e) {
    showToast("Hadisoana @ fandefasana paika", "error");
    console.error("finalizeTurn error:", e);
  }
}

// =========================================================
// 28. START GAME
// =========================================================
window.startGame = async (roomId) => {
  const uid = getUserId();
  if (!uid) return;
  
  try {
    const snap = await getDoc(doc(db, "rooms", roomId));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.status === 'playing') return;
    if (!data.opponent?.id) {
      showToast("Miandry mpifanandrina aloha", "info");
      return;
    }
    
    const gameType = data.gameType || "fanorontelo";
    const currentVersion = data.version || 0;
    
    await updateDoc(doc(db, "rooms", roomId), {
      status: "playing",
      board: initBoard(gameType),
      turn: uid,
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      version: currentVersion + 1
    });
    SoundSystem.play('notification');
  } catch(e) {
    showToast("Tsy afaka nanomboka: " + e.message, "error");
  }
};

// =========================================================
// 29. PLAY WITH AI
// =========================================================
window.playWithAI = async (roomId) => {
  try {
    const snap = await getDoc(doc(db, "rooms", roomId));
    if (!snap.exists()) return;
    const data = snap.data();
    if (data.opponent?.id) {
      showToast("Efa feno ity kianja ity", "error");
      return;
    }
    
    const gameType = data.gameType || "fanorontelo";
    const currentVersion = data.version || 0;
    
    await updateDoc(doc(db, "rooms", roomId), {
      opponent: {
        id: 'AI_BOT',
        name: 'NOLIMITE AI',
        avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=NoLimiteAI',
        isAI: true
      },
      status: "playing",
      board: initBoard(gameType),
      turn: getUserId(),
      startedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      version: currentVersion + 1
    });
    SoundSystem.play('notification');
  } catch(e) {
    showToast("Tsy afaka nampiditra AI: " + e.message, "error");
  }
};

// =========================================================
// 30. JOIN ROOM
// =========================================================
window.joinRoom = async (id) => {
  const uid = getUserId();
  if (!uid) {
    showToast("Tsy tafiditra ianao", "error");
    return;
  }
  
  try {
    const snap = await getDoc(doc(db, "rooms", id));
    if (!snap.exists()) return;
    const r = snap.data();
    if (r.opponent?.id) {
      showToast("Efa feno ity kianja ity", "error");
      return;
    }
    if (r.status !== "waiting") {
      showToast("Efa nanomboka ity lalao ity", "error");
      return;
    }
    if (r.creator?.id === uid) return;
    
    const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
    const myAvatar = document.getElementById("user-avatar")?.src || '';
    const currentVersion = r.version || 0;
    
    await updateDoc(doc(db, "rooms", id), {
      opponent: { id: uid, name: escapeHtml(myName), avatar: myAvatar },
      joinedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      version: currentVersion + 1
    });
    SoundSystem.play('notification');
  } catch(e) {
    showToast("Tsy afaka niditra: " + e.message, "error");
  }
};

// =========================================================
// 31. ACCEPT INVITE
// =========================================================
window.acceptInvite = async (inviteId, senderUid, senderName) => {
  const uid = getUserId();
  if (!uid) return;
  
  document.getElementById("invite-" + inviteId)?.remove();
  const roomId = "INV" + (Math.random().toString(36).substr(2, 6)).toUpperCase();
  const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
  const myAvatar = document.getElementById("user-avatar")?.src || '';
  
  try {
    await setDoc(doc(db, "rooms", roomId), {
      creator: { id: senderUid, name: escapeHtml(senderName), avatar: "" },
      opponent: { id: uid, name: escapeHtml(myName), avatar: myAvatar },
      status: "playing",
      gameType: "fanorontelo",
      type: "private",
      password: "",
      board: initBoard("fanorontelo"),
      turn: senderUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      version: 1
    });
    
    await updateDoc(doc(db, "invites", inviteId), {
      status: "accepted",
      respondedAt: serverTimestamp()
    });
    
    enterGame(roomId);
    SoundSystem.play('notification');
  } catch(e) {
    showToast("Tsy afaka niditra: " + e.message, "error");
  }
};

// =========================================================
// 32. LEAVE GAME
// =========================================================
window.leaveGame = async () => {
  unsubscribeAll();
  const rid = GameState.currentRoomId;
  GameState.currentRoomId = null;
  GameState.selectedCell = null;
  GameState.lastMovedCellId = null;
  GameState.isAiThinking = false;
  showScreen('lobby-screen');
  SoundSystem.play('click');
  
  if (rid) {
    try {
      await deleteDoc(doc(db, "rooms", rid));
    } catch(e) {}
  }
};

window.leaveGameAbandoned = async () => {
  unsubscribeAll();
  const rid = GameState.currentRoomId;
  GameState.currentRoomId = null;
  GameState.selectedCell = null;
  GameState.lastMovedCellId = null;
  GameState.isAiThinking = false;
  showScreen('lobby-screen');
  
  if (rid) {
    try {
      const snap = await getDoc(doc(db, "rooms", rid));
      if (snap.exists() && snap.data().status === 'playing') {
        await updateDoc(doc(db, "rooms", rid), {
          status: 'abandoned',
          abandonedBy: getUserId(),
          finishedAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          version: (snap.data().version || 0) + 1
        });
      } else {
        await deleteDoc(doc(db, "rooms", rid));
      }
    } catch(e) {}
  }
};

// =========================================================
// 33. CHAT
// =========================================================
function initChat(roomId) {
  if (!roomId) return;
  if (GameState.unsubscribeChat) {
    GameState.unsubscribeChat();
    GameState.unsubscribeChat = null;
  }
  
  const chatMessages = document.getElementById("chat-messages");
  const chatInput = document.getElementById("chat-input");
  const chatSend = document.getElementById("chat-send");
  if (!chatMessages || !chatInput || !chatSend) return;
  
  chatMessages.innerHTML = '';
  
  const q = query(
    collection(db, "rooms", roomId, "chat"),
    orderBy("timestamp", "asc"),
    limit(50)
  );
  
  GameState.unsubscribeChat = onSnapshot(q, (snap) => {
    if (!chatMessages) return;
    chatMessages.innerHTML = '';
    const frag = document.createDocumentFragment();
    
    snap.forEach(d => {
      const msg = d.data();
      const isMe = msg.senderId === getUserId();
      const div = document.createElement("div");
      div.className = isMe ? "chat-me" : "chat-opp";
      div.textContent = `${msg.senderName}: ${msg.text}`;
      frag.appendChild(div);
    });
    
    chatMessages.appendChild(frag);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }, err => console.warn("Chat error:", err));
  
  async function sendMessage() {
    const text = (chatInput.value || '').trim();
    if (!text || text.length > 200) return;
    
    const now = Date.now();
    if (now > GameState.chatRateLimit.resetAt) {
      GameState.chatRateLimit.count = 0;
      GameState.chatRateLimit.resetAt = now + 10000;
    }
    if (GameState.chatRateLimit.count >= 5) {
      showToast("Miadina kely alohan'ny handefa hafatra hafa", "info");
      return;
    }
    GameState.chatRateLimit.count++;
    
    const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
    chatInput.value = '';
    
    try {
      await addDoc(collection(db, "rooms", roomId, "chat"), {
        senderId: getUserId(),
        senderName: escapeHtml(myName),
        text: escapeHtml(text),
        timestamp: serverTimestamp()
      });
    } catch(e) {
      showToast("Tsy afaka nandefa hafatra", "error");
    }
  }
  
  const newSend = chatSend.cloneNode(true);
  chatSend.parentNode.replaceChild(newSend, chatSend);
  newSend.addEventListener('click', sendMessage);
  
  const newInput = chatInput.cloneNode(true);
  chatInput.parentNode.replaceChild(newInput, chatInput);
  newInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendMessage();
  });
  
  document.querySelectorAll('.qc-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const msg = btn.dataset.msg;
      if (!msg) return;
      const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
      try {
        await addDoc(collection(db, "rooms", roomId, "chat"), {
          senderId: getUserId(),
          senderName: escapeHtml(myName),
          text: msg,
          timestamp: serverTimestamp()
        });
      } catch(e) {}
    });
  });
}

// =========================================================
// 34. LEADERBOARD
// =========================================================
async function updateLeaderboard(winnerId, winnerName, loserId, loserName) {
  if (!winnerId || !loserId || winnerId === loserId) return;

  try {
    const [{ data: winData }, { data: loseData }] = await Promise.all([
      supabase.from("leaderboard").select("*").eq("player_id", winnerId).maybeSingle(),
      supabase.from("leaderboard").select("*").eq("player_id", loserId).maybeSingle()
    ]);

    const updates = [];

    if (winData) {
      updates.push(
        supabase.from("leaderboard").update({
          wins: (winData.wins || 0) + 1,
          lastPlayed: new Date().toISOString(),
          streak: (winData.streak || 0) + 1
        }).eq("player_id", winnerId)
      );
    } else {
      updates.push(
        supabase.from("leaderboard").insert([{
          player_id: winnerId,
          player_name: escapeHtml(winnerName || ''),
          wins: 1,
          losses: 0,
          streak: 1,
          lastPlayed: new Date().toISOString()
        }])
      );
    }

    if (loseData) {
      updates.push(
        supabase.from("leaderboard").update({
          losses: (loseData.losses || 0) + 1,
          lastPlayed: new Date().toISOString(),
          streak: 0
        }).eq("player_id", loserId)
      );
    } else {
      updates.push(
        supabase.from("leaderboard").insert([{
          player_id: loserId,
          player_name: escapeHtml(loserName || ''),
          wins: 0,
          losses: 1,
          streak: 0,
          lastPlayed: new Date().toISOString()
        }])
      );
    }

    await Promise.all(updates);
  } catch(e) {
    console.warn("Leaderboard error:", e);
  }
}

async function loadLeaderboard() {
  const container = document.getElementById("leaderboard");
  if (!container) return;

  try {
    const { data, error } = await supabase
      .from("leaderboard")
      .select("*")
      .order("wins", { ascending: false })
      .order("losses", { ascending: true })
      .limit(20);

    if (error) throw error;

    if (!data || data.length === 0) {
      container.innerHTML = '<div class="empty-state"><p>Tsy mbola misy ato ny laharana</p></div>';
      return;
    }

    const frag = document.createDocumentFragment();
    data.forEach((p, i) => {
      const div = document.createElement("div");
      div.className = "leaderboard-row";
      div.setAttribute("role", "listitem");
      const medals = ['🥇', '🥈', '🥉'];
      const winRate = p.wins + p.losses > 0 ? ((p.wins / (p.wins + p.losses)) * 100).toFixed(1) : '0.0';
      const streak = p.streak > 0 ? ` 🔥${p.streak}` : '';
      
      div.innerHTML = `
        <span class="leaderboard-rank">${medals[i] || (i + 1) + '.'}</span>
        <span class="leaderboard-name">${escapeHtml(p.player_name || '')}${streak}</span>
        <span class="leaderboard-stats">🟢${p.wins || 0} 🔴${p.losses || 0} (${winRate}%)</span>`;
      frag.appendChild(div);
    });

    container.innerHTML = '';
    container.appendChild(frag);
  } catch(e) {
    container.innerHTML = '<div class="empty-state"><p>Tsy afaka nitondra ny laharana</p></div>';
  }
}

// =========================================================
// 35. INVITE NOTIFICATIONS
// =========================================================
function initInvites(uid) {
  if (GameState.unsubscribeInvites) {
    GameState.unsubscribeInvites();
    GameState.unsubscribeInvites = null;
  }

  const q = query(
    collection(db, "invites"),
    where("to", "==", uid),
    where("status", "==", "pending"),
    limit(5)
  );

  GameState.unsubscribeInvites = onSnapshot(q, (snap) => {
    snap.forEach(d => {
      if (!GameState.shownInvites.has(d.id)) {
        GameState.shownInvites.add(d.id);
        showInviteUI(d.id, d.data());
      }
    });
  }, (err) => console.warn("Invites error:", err));
}

function showInviteUI(inviteId, invite) {
  const container = document.getElementById("invite-notifications");
  if (!container || document.getElementById("invite-" + inviteId)) return;

  const box = document.createElement("div");
  box.id = "invite-" + inviteId;
  box.className = "invite-popup animate-pop";
  box.setAttribute("role", "alert");
  box.innerHTML = `
    <p>🎮 <b>${escapeHtml(invite.fromName)}</b> manasa anao!</p>
    <div class="invite-actions">
      <button class="btn-save" type="button"
        onclick="acceptInvite('${escapeHtml(inviteId)}','${escapeHtml(invite.from)}','${escapeHtml(invite.fromName)}')">
        ✅ Ekena
      </button>
      <button class="btn-cancel" type="button"
        onclick="rejectInvite('${escapeHtml(inviteId)}')">
        ❌ Tsia
      </button>
    </div>`;
  container.appendChild(box);
  SoundSystem.play('notification');

  setTimeout(() => {
    box.style.animation = 'fadeIn 0.3s reverse';
    setTimeout(() => box.remove(), 300);
  }, 30000);
}

window.rejectInvite = async (inviteId) => {
  document.getElementById("invite-" + inviteId)?.remove();
  try {
    await updateDoc(doc(db, "invites", inviteId), {
      status: "rejected",
      respondedAt: serverTimestamp()
    });
    SoundSystem.play('click');
  } catch(e) {}
};

// =========================================================
// 36. PLAYER LIST
// =========================================================
function initPlayerList() {
  if (GameState.unsubscribePlayers) {
    GameState.unsubscribePlayers();
    GameState.unsubscribePlayers = null;
  }

  const q = query(
    collection(db, "users"),
    where("status", "==", "online"),
    limit(30)
  );

  GameState.unsubscribePlayers = onSnapshot(q, (snapshot) => {
    const sideEl = document.getElementById("online-players");
    const mainEl = document.getElementById("players-list-dynamic");
    const fragment = document.createDocumentFragment();
    const fragment2 = document.createDocumentFragment();
    let hasPlayers = false;

    snapshot.forEach(d => {
      const u = d.data();
      if (!u.uid || u.uid === getUserId()) return;
      hasPlayers = true;

      const div = document.createElement("div");
      div.className = "player-item";
      div.setAttribute("role", "listitem");
      div.innerHTML = `
        <img src="${escapeHtml(u.avatar || '')}" class="player-avatar-mini" alt="${escapeHtml(u.name || '')}"
             onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=default'">
        <div class="player-info">
          <span class="player-name-mini">${escapeHtml(u.name || 'Mpilalao')}</span>
          <div class="status-indicator"><span class="dot-online"></span> Online</div>
        </div>
        <button class="btn-invite-mini" type="button"
          onclick="sendInvite('${escapeHtml(u.uid)}')"
          aria-label="Hantsy ${escapeHtml(u.name || '')}">Hantsy</button>`;

      const div2 = div.cloneNode(true);
      fragment.appendChild(div);
      fragment2.appendChild(div2);
    });

    if (sideEl) {
      sideEl.innerHTML = '';
      if (!hasPlayers) {
        sideEl.innerHTML = '<div class="empty-state"><p>Tsy misy mpilalao hafa eto</p></div>';
      } else {
        sideEl.appendChild(fragment);
      }
    }

    if (mainEl) {
      mainEl.innerHTML = '';
      if (!hasPlayers) {
        mainEl.innerHTML = '<div class="empty-state"><p>Tsy misy mpilalao hafa eto</p></div>';
      } else {
        mainEl.appendChild(fragment2);
      }
    }
  }, err => console.warn("Players error:", err));
}

// =========================================================
// 37. LOBBY
// =========================================================
function initLobby() {
  if (GameState.unsubscribeRooms) {
    GameState.unsubscribeRooms();
    GameState.unsubscribeRooms = null;
  }

  const q = query(
    collection(db, "rooms"),
    where("status", "==", "waiting"),
    limit(30)
  );

  GameState.unsubscribeRooms = onSnapshot(q, (snap) => {
    const publicFrag = document.createDocumentFragment();
    const myFrag = document.createDocumentFragment();
    let hasPublic = false, hasMy = false;

    snap.forEach(d => {
      const r = d.data();
      const roomId = d.id;
      const safeId = escapeHtml(roomId);
      const gameLabel = r.gameType === "fanorontsivy" ? "5×5" : "3×3";
      const isPrivate = r.type === "private";

      if (r.creator?.id === getUserId()) {
        hasMy = true;
        const div = document.createElement("div");
        div.className = "room-card animate-pop";
        div.setAttribute("role", "listitem");
        div.innerHTML = `
          <span>🏠 ${safeId} (${gameLabel})</span>
          <span class="badge-waiting">⏳ 1/2</span>
          <div class="room-actions">
            <button class="btn-cancel" type="button" onclick="deleteRoom('${safeId}')" aria-label="Fafao">🗑</button>
            <button type="button" class="room-card-btn" onclick="viewRoom('${safeId}')">Hiditra</button>
          </div>`;
        myFrag.appendChild(div);
      } else if (!isPrivate) {
        hasPublic = true;
        const div = document.createElement("div");
        div.className = "room-card animate-pop";
        div.setAttribute("role", "listitem");
        div.innerHTML = `
          <span>🌐 ${safeId} (${gameLabel})</span>
          <span class="badge-waiting">⏳ 1/2</span>
          <button type="button" class="room-card-btn" onclick="viewRoom('${safeId}')">Hiditra</button>`;
        publicFrag.appendChild(div);
      }
    });

    const publicEl = document.getElementById("rooms-list-dynamic");
    const myEl = document.getElementById("my-rooms-list");

    if (publicEl) {
      publicEl.innerHTML = '';
      if (!hasPublic) {
        publicEl.innerHTML = '<div class="empty-state"><p>Tsy misy kianja malalaka eto<br>Mamorona ianao! 🏠</p></div>';
      } else {
        publicEl.appendChild(publicFrag);
      }
    }

    if (myEl) {
      myEl.innerHTML = '';
      if (!hasMy) {
        myEl.innerHTML = '<div class="empty-state"><p>Tsy mbola nanao kianja ianao</p></div>';
      } else {
        myEl.appendChild(myFrag);
      }
    }
  }, err => console.warn("Rooms error:", err));
}

// =========================================================
// 38. QUICK CHAT
// =========================================================
function setupQuickChat() {
  document.querySelectorAll('.qc-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!GameState.currentRoomId) return;
      const msg = btn.dataset.msg;
      if (!msg) return;

      const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
      try {
        await addDoc(collection(db, "rooms", GameState.currentRoomId, "chat"), {
          senderId: getUserId(),
          senderName: escapeHtml(myName),
          text: msg,
          timestamp: serverTimestamp()
        });
        SoundSystem.play('click');
      } catch(e) {}
    });
  });
}

// =========================================================
// 39. PROFILE MODAL
// =========================================================
window.openEditModal = () => {
  const modal = document.getElementById("modal-edit-profile");
  const nameEl = document.getElementById("edit-name");
  const avatarEl = document.getElementById("edit-avatar");
  if (!modal) return;
  if (nameEl) nameEl.value = document.getElementById("user-name")?.textContent || '';
  if (avatarEl) avatarEl.value = document.getElementById("user-avatar")?.src || '';
  modal.classList.remove("hidden");
  SoundSystem.play('click');
};

window.closeEditModal = () => {
  document.getElementById("modal-edit-profile")?.classList.add("hidden");
  SoundSystem.play('click');
};

// =========================================================
// 40. THEME SYSTEM
// =========================================================
const ThemeSystem = {
  current: 'dark',
  
  init() {
    const saved = localStorage.getItem('nolimite_theme');
    this.current = saved || 'dark';
    this.apply();
    this.createToggle();
  },
  
  apply() {
    document.documentElement.setAttribute('data-theme', this.current);
  },
  
  toggle() {
    this.current = this.current === 'dark' ? 'light' : 'dark';
    this.apply();
    localStorage.setItem('nolimite_theme', this.current);
    SoundSystem.play('click');
  },
  
  createToggle() {
    if (document.getElementById('theme-toggle')) return;
    const btn = document.createElement('button');
    btn.id = 'theme-toggle';
    btn.className = 'theme-toggle';
    btn.innerHTML = this.current === 'dark' ? '☀️' : '🌙';
    btn.onclick = () => {
      this.toggle();
      btn.innerHTML = this.current === 'dark' ? '☀️' : '🌙';
    };
    document.body.appendChild(btn);
  }
};

// =========================================================
// 41. REPLAY SYSTEM
// =========================================================
const ReplaySystem = {
  currentIndex: 0,
  isPlaying: false,
  interval: null,
  
  start() {
    if (GameState.gameHistory.length === 0) {
      showToast("Tsy misy history", "info");
      return;
    }
    GameState.replayMode = true;
    this.currentIndex = 0;
    this.play();
  },
  
  play() {
    if (this.isPlaying) return;
    this.isPlaying = true;
    
    this.interval = setInterval(() => {
      if (this.currentIndex >= GameState.gameHistory.length) {
        this.stop();
        return;
      }
      
      const state = GameState.gameHistory[this.currentIndex];
      render(state);
      this.currentIndex++;
    }, 1000);
  },
  
  pause() {
    this.isPlaying = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  },
  
  stop() {
    this.pause();
    this.currentIndex = 0;
    GameState.replayMode = false;
  },
  
  next() {
    if (this.currentIndex < GameState.gameHistory.length - 1) {
      this.currentIndex++;
      render(GameState.gameHistory[this.currentIndex]);
    }
  },
  
  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      render(GameState.gameHistory[this.currentIndex]);
    }
  }
};

// =========================================================
// 42. DOM CONTENT LOADED - MAIN INIT
// =========================================================
document.addEventListener('DOMContentLoaded', () => {
  // Avatar preview
  const avatarInput = document.getElementById("edit-avatar");
  const preview = document.getElementById("avatar-preview");
  if (avatarInput && preview) {
    avatarInput.addEventListener('input', () => {
      const url = avatarInput.value.trim();
      if (url.startsWith('https://')) {
        preview.src = url;
        preview.style.display = 'block';
      } else {
        preview.style.display = 'none';
      }
    });
  }

  // Google Sign In
  const btnGoogle = document.getElementById("btn-google");
  if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
      btnGoogle.disabled = true;
      btnGoogle.textContent = "Miandry...";
      try {
        await signInWithPopup(auth, provider);
        SoundSystem.play('notification');
      } catch(e) {
        showToast("Tsy afaka niditra amin'ny Google: " + e.message, "error");
        btnGoogle.disabled = false;
        btnGoogle.innerHTML = '<i class="fab fa-google"></i> Midira amin\'ny Google';
      }
    });
  }

  // Guest Login
  const btnGuest = document.getElementById("btn-guest");
  if (btnGuest) {
    btnGuest.addEventListener('click', async () => {
      btnGuest.disabled = true;
      try {
        let guestUid = localStorage.getItem("nolimite_guest_uid");
        let guestName = localStorage.getItem("nolimite_guest_name");
        
        if (!guestUid) {
          guestUid = "GUEST_" + crypto.randomUUID().replace(/-/g, '').substr(0, 12);
          guestName = guestName || ("Mpanandrana_" + Math.floor(Math.random() * 9000 + 1000));
          localStorage.setItem("nolimite_guest_uid", guestUid);
          localStorage.setItem("nolimite_guest_name", guestName);
        } else {
          guestName = guestName || ("Mpanandrana_" + Math.floor(Math.random() * 9000 + 1000));
        }
        
        const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${guestUid}`;
        GameState.myCurrentUid = guestUid;
        
        await setDoc(doc(db, "users", guestUid), {
          uid: guestUid,
          name: guestName,
          avatar,
          status: "online",
          isGuest: true,
          lastSeen: serverTimestamp(),
          createdAt: serverTimestamp()
        }, { merge: true });
        
        setupGuestUI({ uid: guestUid, name: guestName, avatar });
        SoundSystem.play('notification');
      } catch(e) {
        showToast("Tsy afaka niditra: " + e.message, "error");
        btnGuest.disabled = false;
      }
    });
  }

  // Create Room
  const btnCreate = document.getElementById("btn-create-room");
  if (btnCreate) {
    btnCreate.addEventListener('click', () => {
      const modal = document.getElementById("modal-create");
      if (modal) modal.classList.remove("hidden");
      SoundSystem.play('click');
    });
  }

  // Room Type Toggle
  const roomType = document.getElementById("room-type");
  const pwGroup = document.getElementById("password-group");
  if (roomType && pwGroup) {
    roomType.addEventListener('change', () => {
      pwGroup.style.display = roomType.value === "private" ? "block" : "none";
    });
  }

  // Quick Play
  const btnQuick = document.getElementById("btn-quick-play");
  if (btnQuick) {
    btnQuick.addEventListener('click', async () => {
      const uid = getUserId();
      if (!uid) {
        showToast("Miditra aloha!", "error");
        return;
      }
      
      btnQuick.disabled = true;
      try {
        const q = query(
          collection(db, "rooms"),
          where("status", "==", "waiting"),
          where("type", "==", "public"),
          limit(10)
        );
        const snap = await getDocs(q);
        let found = null;
        
        snap.forEach(d => {
          if (!found && d.data().creator?.id !== uid) found = d.id;
        });
        
        if (found) {
          viewRoom(found);
        } else {
          const autoId = "Q" + (crypto.randomUUID().replace(/-/g, '').substr(0, 8)).toUpperCase();
          await setDoc(doc(db, "rooms", autoId), {
            creator: {
              id: uid,
              name: escapeHtml(document.getElementById("user-name")?.textContent || ""),
              avatar: document.getElementById("user-avatar")?.src || ""
            },
            status: "waiting",
            type: "public",
            gameType: "fanorontelo",
            createdAt: serverTimestamp(),
            version: 0
          });
          autoDeleteRoom(autoId);
          viewRoom(autoId);
        }
        SoundSystem.play('notification');
      } catch(e) {
        showToast("Hadisoana: " + e.message, "error");
      } finally {
        btnQuick.disabled = false;
      }
    });
  }

  // Confirm Create
  const btnConfirm = document.getElementById("btn-confirm-create");
  if (btnConfirm) {
    btnConfirm.addEventListener('click', async () => {
      const uid = getUserId();
      if (!uid) {
        showToast("Miditra aloha!", "error");
        return;
      }
      
      btnConfirm.disabled = true;
      try {
        const rawName = document.getElementById("room-uid-input")?.value || '';
        const name = slugify(rawName) || "KIANJA_" + Math.floor(Math.random() * 9000 + 1000);
        const type = document.getElementById("room-type")?.value || "public";
        const pass = document.getElementById("room-password")?.value || '';
        const gameType = document.getElementById("game-type")?.value || "fanorontelo";

        if (type === "private" && (!pass || pass.length < 1 || pass.length > 20)) {
          showToast("Password 1-20 litera takiana raha private", "error");
          btnConfirm.disabled = false;
          return;
        }

        const existSnap = await getDoc(doc(db, "rooms", name));
        if (existSnap.exists()) {
          showToast("Efa misy kianja mitovy anarana", "error");
          btnConfirm.disabled = false;
          return;
        }

        await setDoc(doc(db, "rooms", name), {
          creator: {
            id: uid,
            name: escapeHtml(document.getElementById("user-name")?.textContent || ""),
            avatar: document.getElementById("user-avatar")?.src || ""
          },
          status: "waiting",
          type,
          gameType,
          password: type === "private" ? pass : "",
          createdAt: serverTimestamp(),
          version: 0
        });

        if (document.getElementById("room-uid-input")) document.getElementById("room-uid-input").value = '';
        if (document.getElementById("room-password")) document.getElementById("room-password").value = '';
        if (document.getElementById("room-type")) document.getElementById("room-type").value = 'public';
        if (document.getElementById("password-group")) document.getElementById("password-group").style.display = 'none';

        document.getElementById("modal-create")?.classList.add("hidden");
        autoDeleteRoom(name);
        viewRoom(name);
        SoundSystem.play('notification');
      } catch(e) {
        showToast("Tsy afaka namorona kianja: " + e.message, "error");
      } finally {
        btnConfirm.disabled = false;
      }
    });
  }

  // Save Profile
  const btnSave = document.getElementById("btn-save-profile");
  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const uid = getUserId();
      if (!uid) {
        showToast("Tsy tafiditra ianao", "error");
        return;
      }
      
      btnSave.disabled = true;
      try {
        let newName = (document.getElementById("edit-name")?.value || '').trim();
        const newAvatar = (document.getElementById("edit-avatar")?.value || '').trim();

        if (!newName || newName.length > 20) {
          showToast("Anarana 1 hatramin'ny 20 litera", "error");
          return;
        }
        if (newAvatar && !newAvatar.startsWith('https://')) {
          showToast("URL avatar tsy marina (tsy maintsy https://)", "error");
          return;
        }
        if (newAvatar && newAvatar.length > 500) {
          showToast("URL avatar lava be (max 500 litera)", "error");
          return;
        }

        const finalAvatar = newAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;

        await setDoc(doc(db, "users", uid), {
          uid,
          name: newName,
          avatar: finalAvatar,
          status: "online",
          lastSeen: serverTimestamp()
        }, { merge: true });

        if (GameState.currentRoomId) {
          const roomRef = doc(db, "rooms", GameState.currentRoomId);
          const roomSnap = await getDoc(roomRef);
          if (roomSnap.exists()) {
            const roomData = roomSnap.data();
            const currentVersion = roomData.version || 0;
            if (roomData.creator?.id === uid) {
              await updateDoc(roomRef, {
                "creator.name": newName,
                "creator.avatar": finalAvatar,
                updatedAt: serverTimestamp(),
                version: currentVersion + 1
              });
            } else if (roomData.opponent?.id === uid) {
              await updateDoc(roomRef, {
                "opponent.name": newName,
                "opponent.avatar": finalAvatar,
                updatedAt: serverTimestamp(),
                version: currentVersion + 1
              });
            }
          }
        }

        const nameEl = document.getElementById("user-name");
        const avatarEl = document.getElementById("user-avatar");
        if (nameEl) nameEl.textContent = newName;
        if (avatarEl) avatarEl.src = finalAvatar;

        closeEditModal();
        showToast("Voatahiry ny mombamomba! ✅", "success");
        SoundSystem.play('notification');
      } catch(e) {
        console.error("Erreur save profile:", e);
        showToast("Tsy afaka nahitsy: " + e.code, "error");
      } finally {
        btnSave.disabled = false;
      }
    });
  }

  // Logout
  const btnLogout = document.getElementById("btn-logout");
  if (btnLogout) {
    btnLogout.addEventListener('click', async () => {
      if (!confirm("Hivoaka ve ianao?")) return;
      btnLogout.disabled = true;
      unsubscribeAll();
      const uid = getUserId();
      teardownPresence(uid);
      GameState.myCurrentUid = null;
      try {
        await auth.signOut();
      } catch(e) {}
      localStorage.removeItem("nolimite_guest_uid");
      localStorage.removeItem("nolimite_guest_name");
      showScreen('login-screen');
      SoundSystem.play('click');
    });
  }

  // Leave Game Button
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="leave-game"]')) {
      if (confirm("Hiala amin'ny lalao ve ianao?")) leaveGame();
    }
  });

  // Before Unload
  window.addEventListener('beforeunload', () => {
    const uid = getUserId();
    if (uid) {
      updateDoc(doc(db, "users", uid), { status: "offline" }).catch(() => {});
    }
  });

  // Init Systems
  setupSearch();
  loadLeaderboard();
  setupQuickChat();
  ThemeSystem.init();
});

