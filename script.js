// =========================================================
//  NOLIMITE FANORONA — script.js  v3.1
//  Voa-katsaka, voa-hasina, manara-penitra
// =========================================================

// 1. IMPORTS REHETRA - INDRINDRA IRAY IHANY
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInAnonymously,
    signInWithPopup, 
    GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { initializeAppCheck, ReCaptchaV3Provider } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app-check.js";
import {
    getFirestore, collection, doc, setDoc, updateDoc,
    onSnapshot, serverTimestamp, addDoc, query,
    orderBy, where, limit, getDocs, getDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

// =========================================================
//  CONFIG
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

// 2. INIT FIREBASE - FILAHARANA MARINA
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const provider = new GoogleAuthProvider();


const appCheck = initializeAppCheck(app, {
  provider: new ReCaptchaV3Provider('6Ld6BCAtAAAAAANU9s1hepNcHwCM0_RfbPVQxVML'),
  isTokenAutoRefreshEnabled: true
});
// =========================================================
//  ÉTAT GLOBAL
// =========================================================
let currentRoomId   = null;
let selectedCell    = null;
let myCurrentUid    = null;
let isAiThinking    = false;
let turnTimerInterval = null;
let lastMovedCellId = null;

let unsubscribeRoom      = null;
let unsubscribeRoomLobby = null;
let unsubscribeChat      = null;
let unsubscribePlayers   = null;
let unsubscribeRooms     = null;
let unsubscribeInvites   = null;

// =========================================================
//  UTILITIES
// =========================================================
function getUserId() { return myCurrentUid || auth.currentUser?.uid || null; }

function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g,'&amp;')
        .replace(/</g,'&lt;')
        .replace(/>/g,'&gt;')
        .replace(/"/g,'&quot;')
        .replace(/'/g,'&#39;');
}

function slugify(str) {
    return String(str)
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g,'_')
        .substring(0, 20);
}

function showToast(msg, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), duration);
}

function randomOhabolana() {
    const list = [
        "Ny fanahy no maha-olona.",
        "Tsy misy hazo afa-tsy ny tsinjony no hita.",
        "Aleo very tsikalakalam-bola toy izay very tsikalakalam-pihavanana.",
        "Ny rano amoron-tsiraka tsy mety ritra.",
        "Ny teny lava mody fohy, ny teny fohy mody lava.",
    ];
    return list[Math.floor(Math.random() * list.length)];
}

// =========================================================
//  PRESENCE
// =========================================================
let presenceIntervalId = null;
function setupPresence(uid) {
    if (!uid) return;
    const userRef = doc(db, "users", uid);
    updateDoc(userRef, { status: "online", lastSeen: serverTimestamp() }).catch(() => {});
    presenceIntervalId = setInterval(() => {
        updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(() => {});
    }, 30000);
}
function teardownPresence(uid) {
    if (presenceIntervalId) { clearInterval(presenceIntervalId); presenceIntervalId = null; }
    if (!uid) return;
    updateDoc(doc(db, "users", uid), { status: "offline" }).catch(() => {});
}

// =========================================================
//  UNSUBSCRIBE ALL
// =========================================================
function unsubscribeAll() {
    if (unsubscribeRoom)      { unsubscribeRoom();      unsubscribeRoom = null; }
    if (unsubscribeRoomLobby) { unsubscribeRoomLobby(); unsubscribeRoomLobby = null; }
    if (unsubscribeChat)      { unsubscribeChat();      unsubscribeChat = null; }
    if (unsubscribePlayers)   { unsubscribePlayers();   unsubscribePlayers = null; }
    if (unsubscribeRooms)     { unsubscribeRooms();     unsubscribeRooms = null; }
    if (unsubscribeInvites)   { unsubscribeInvites();   unsubscribeInvites = null; }
    if (turnTimerInterval)    { clearInterval(turnTimerInterval); turnTimerInterval = null; }
}

// =========================================================
//  BOARD INIT
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
                // rangée du milieu (y=2) : vide
                cells.push({ id: id++, x, y, value });
            }
        }
        return cells;
    }
    // Fanorontelo 3x3
    return [
        { id:0, x:0, y:0, value:1 }, { id:1, x:1, y:0, value:1 }, { id:2, x:2, y:0, value:1 },
        { id:3, x:0, y:1, value:0 }, { id:4, x:1, y:1, value:0 }, { id:5, x:2, y:1, value:0 },
        { id:6, x:0, y:2, value:2 }, { id:7, x:1, y:2, value:2 }, { id:8, x:2, y:2, value:2 }
    ];
}

// =========================================================
//  RÈGLES — Fihetsika azo atao
// =========================================================
function isValidMove(from, to, gameType) {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    if (dx > 1 || dy > 1) return false;
    if (dx === 0 && dy === 0) return false;
    // Fanorontelo 3x3 : diagonale @ afovoany ihany
    if (gameType === "fanorontelo") {
        if (dx === 1 && dy === 1) {
            // Diagonale autorisée uniquement si from ou to est le centre (1,1)
            return (from.x === 1 && from.y === 1) || (to.x === 1 && to.y === 1);
        }
    }
    return true;
}

// =========================================================
//  CAPTURES
// =========================================================
function getCaptures(board, fromCell, toCell, myVal, gameType) {
    const opponentVal = myVal === 1 ? 2 : 1;
    const captured = [];
    const dx = toCell.x - fromCell.x;
    const dy = toCell.y - fromCell.y;

    // Direction avant (approche)
    let nx = toCell.x + dx;
    let ny = toCell.y + dy;
    while (nx >= 0 && nx <= (gameType==="fanorontsivy"?4:2) &&
           ny >= 0 && ny <= (gameType==="fanorontsivy"?4:2)) {
        const c = board.find(c => c.x === nx && c.y === ny);
        if (!c || c.value !== opponentVal) break;
        captured.push(c.id);
        nx += dx; ny += dy;
    }

    // Direction arrière (retrait)
    nx = fromCell.x - dx;
    ny = fromCell.y - dy;
    while (nx >= 0 && nx <= (gameType==="fanorontsivy"?4:2) &&
           ny >= 0 && ny <= (gameType==="fanorontsivy"?4:2)) {
        const c = board.find(c => c.x === nx && c.y === ny);
        if (!c || c.value !== opponentVal) break;
        captured.push(c.id);
        nx -= dx; ny -= dy;
    }

    return [...new Set(captured)];
}

// =========================================================
//  WIN CHECK
// =========================================================
function checkWinnerFanorona(board, creatorId, opponentId, gameType) {
    if (!board || !creatorId || !opponentId) return null;
    const p1 = board.filter(c => c.value === 1);
    const p2 = board.filter(c => c.value === 2);
    if (p1.length === 0) return opponentId;
    if (p2.length === 0) return creatorId;

    const canMove = (val) => {
        const stones = board.filter(c => c.value === val);
        const empty  = board.filter(c => c.value === 0);
        for (let s of stones) {
            for (let e of empty) {
                if (isValidMove(s, e, gameType)) return true;
            }
        }
        return false;
    };
    if (!canMove(1)) return opponentId;
    if (!canMove(2)) return creatorId;
    return null;
}

// =========================================================
//  COORDONNÉES → notation algébrique (A1, B2…)
// =========================================================
function cellToNotation(cell) {
    const cols = ['A','B','C','D','E'];
    return cols[cell.x] + (cell.y + 1);
}

// =========================================================
//  AI
// =========================================================
async function aiMove(game) {
    if (!game || game.turn !== 'AI_BOT' || game.status !== 'playing') return;
    if (!currentRoomId) return;
    if (isAiThinking) return;
    isAiThinking = true;

    try {
        await new Promise(r => setTimeout(r, 1000 + Math.random() * 600));
        if (!currentRoomId) { isAiThinking = false; return; }

        const board = game.board;
        if (!Array.isArray(board)) { isAiThinking = false; return; }

        const aiStones    = board.filter(c => c.value === 2);
        const emptyCells  = board.filter(c => c.value === 0);
        if (aiStones.length === 0 || emptyCells.length === 0) { isAiThinking = false; return; }

        let bestMove = null;
        let maxCaptures = -1;

        for (const stone of aiStones) {
            for (const empty of emptyCells) {
                if (!isValidMove(stone, empty, game.gameType)) continue;
                const caps = getCaptures(board, stone, empty, 2, game.gameType);
                if (caps.length > maxCaptures) {
                    maxCaptures = caps.length;
                    bestMove = { from: stone, to: empty, captures: caps };
                }
            }
        }

        // Fallback : mouvement aléatoire
        if (!bestMove || maxCaptures === 0) {
            const moves = [];
            for (const stone of aiStones) {
                for (const empty of emptyCells) {
                    if (isValidMove(stone, empty, game.gameType)) {
                        moves.push({ from: stone, to: empty, captures: [] });
                    }
                }
            }
            if (moves.length > 0) {
                bestMove = moves[Math.floor(Math.random() * moves.length)];
            }
        }

        if (!bestMove) { isAiThinking = false; return; }

        let newBoard = board.map(cell => {
            if (cell.id === bestMove.from.id) return { ...cell, value: 0 };
            if (cell.id === bestMove.to.id)   return { ...cell, value: 2 };
            if (bestMove.captures.includes(cell.id)) return { ...cell, value: 0 };
            return cell;
        });

        await updateDoc(doc(db, "rooms", currentRoomId), {
            board: newBoard,
            turn: game.creator.id,
            lastMove: cellToNotation(bestMove.from) + '-' + cellToNotation(bestMove.to)
        });
    } catch (err) {
        console.error("AI error:", err);
    } finally {
        isAiThinking = false;
    }
}

// =========================================================
//  AUTH STATE
// =========================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myCurrentUid = user.uid;
        const userRef  = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef).catch(() => null);
        let finalName   = user.displayName || "Mpilalao";
        let finalAvatar = user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`;
        if (userSnap && userSnap.exists()) {
            const d = userSnap.data();
            finalName   = d.name   || finalName;
            finalAvatar = d.avatar || finalAvatar;
        }
        await setDoc(userRef, {
            uid: user.uid, name: finalName, avatar: finalAvatar,
            status: "online", lastSeen: serverTimestamp()
        }, { merge: true }).catch(() => {});
        setupGuestUI({ uid: user.uid, name: finalName, avatar: finalAvatar });
    } else {
        const guestUid = localStorage.getItem("nolimite_guest_uid");
        if (!guestUid) {
            showScreen('login-screen');
        }
    }
});

// =========================================================
//  SETUP UI after login
// =========================================================
function setupGuestUI(user) {
    myCurrentUid = user.uid;
    const nameEl   = document.getElementById("user-name");
    const avatarEl = document.getElementById("user-avatar");
    if (nameEl)   nameEl.textContent = user.name;
    if (avatarEl) avatarEl.src = user.avatar;
    showScreen('lobby-screen');
    setupPresence(user.uid);
    initLobby();
    initPlayerList();
    initInvites(user.uid);
    loadLeaderboard();
}

function showScreen(id) {
    ['login-screen','lobby-screen','room-lobby-screen','game-screen'].forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
}

// =========================================================
//  AUTO-DELETE ROOM
// =========================================================
let autoDeleteTimers = {};
function autoDeleteRoom(roomId) {
    if (autoDeleteTimers[roomId]) clearTimeout(autoDeleteTimers[roomId]);
    autoDeleteTimers[roomId] = setTimeout(async () => {
        try {
            const snap = await getDoc(doc(db, "rooms", roomId));
            if (snap.exists() && snap.data().status === "waiting") {
                await deleteDoc(doc(db, "rooms", roomId));
            }
        } catch(e) { /* ignoré */ }
        delete autoDeleteTimers[roomId];
    }, 5 * 60 * 1000);
}

// =========================================================
//  DELETE ROOM (window-exposed)
// =========================================================
window.deleteRoom = async (roomId) => {
    if (!confirm("Tena fafana ity kianja ity?")) return;
    try {
        await deleteDoc(doc(db, "rooms", roomId));
        leaveRoomLobby();
        showToast("Voafafa ny kianja", "success");
    } catch(e) {
        showToast("Tsy afaka namafa: " + e.message, "error");
    }
};

// =========================================================
//  SEND INVITE
// =========================================================
window.sendInvite = async (targetUid) => {
    const uid = getUserId();
    if (!uid) return;
    if (uid === targetUid) return;
    try {
        const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
        await addDoc(collection(db, "invites"), {
            from: uid, fromName: escapeHtml(myName),
            to: targetUid, status: "pending",
            createdAt: serverTimestamp()
        });
        showToast("Nalefa ny fanasana! 🎮", "success");
    } catch(e) {
        showToast("Tsy afaka nandefa fanasana", "error");
    }
};

// =========================================================
//  INVITES
// =========================================================
const shownInvites = new Set();
function initInvites(uid) {
    if (unsubscribeInvites) { unsubscribeInvites(); unsubscribeInvites = null; }
    const q = query(collection(db, "invites"),
        where("to", "==", uid), where("status", "==", "pending"), limit(5));
    unsubscribeInvites = onSnapshot(q, (snap) => {
        snap.forEach(d => {
            if (!shownInvites.has(d.id)) {
                shownInvites.add(d.id);
                showInviteUI(d.id, d.data());
            }
        });
    }, (err) => console.warn("Invites error:", err));
}

function showInviteUI(inviteId, invite) {
    const container = document.getElementById("invite-notifications");
    if (!container) return;
    if (document.getElementById("invite-" + inviteId)) return;
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
    setTimeout(() => box.remove(), 30000);
}

window.acceptInvite = async (inviteId, senderUid, senderName) => {
    const uid = getUserId();
    if (!uid) return;
    document.getElementById("invite-" + inviteId)?.remove();
    const roomId = "INV" + (Math.random().toString(36).substr(2,6)).toUpperCase();
    const myName   = document.getElementById("user-name")?.textContent || "Mpilalao";
    const myAvatar = document.getElementById("user-avatar")?.src || '';
    try {
        await setDoc(doc(db, "rooms", roomId), {
            creator:  { id: senderUid, name: escapeHtml(senderName), avatar: "" },
            opponent: { id: uid, name: escapeHtml(myName), avatar: myAvatar },
            status: "playing", gameType: "fanorontelo",
            board: initBoard("fanorontelo"),
            turn: senderUid, createdAt: serverTimestamp()
        });
        await updateDoc(doc(db, "invites", inviteId), {
            status: "accepted", respondedAt: serverTimestamp()
        });
        enterGame(roomId);
    } catch(e) { showToast("Tsy afaka niditra: " + e.message, "error"); }
};

window.rejectInvite = async (inviteId) => {
    document.getElementById("invite-" + inviteId)?.remove();
    try {
        await updateDoc(doc(db, "invites", inviteId), {
            status: "rejected", respondedAt: serverTimestamp()
        });
    } catch(e) { /* ignoré */ }
};

// =========================================================
//  PLAYER LIST
// =========================================================
function initPlayerList() {
    if (unsubscribePlayers) { unsubscribePlayers(); unsubscribePlayers = null; }
    const q = query(collection(db, "users"), where("status","==","online"), limit(20));
    unsubscribePlayers = onSnapshot(q, (snapshot) => {
        const sideEl   = document.getElementById("online-players");
        const mainEl   = document.getElementById("players-list-dynamic");
        const fragment = document.createDocumentFragment();
        const fragment2 = document.createDocumentFragment();
        let hasPlayers = false;

        snapshot.forEach(d => {
            const u = d.data();
            if (!u.uid || u.uid === getUserId()) return;
            hasPlayers = true;
            const div = document.createElement("div");
            div.className = "player-item";
            div.setAttribute("role","listitem");
            div.innerHTML = `
                <img src="${escapeHtml(u.avatar||'')}" class="player-avatar-mini" alt="${escapeHtml(u.name||'')}"
                     onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=default'">
                <div class="player-info">
                    <span class="player-name-mini">${escapeHtml(u.name||'Mpilalao')}</span>
                    <div class="status-indicator"><span class="dot-online"></span> Online</div>
                </div>
                <button class="btn-invite-mini" type="button"
                    onclick="sendInvite('${escapeHtml(u.uid)}')"
                    aria-label="Hantsy ${escapeHtml(u.name||'')}">Hantsy</button>`;
            const div2 = div.cloneNode(true);
            fragment.appendChild(div);
            fragment2.appendChild(div2);
        });

        if (sideEl) {
            sideEl.innerHTML = '';
            if (!hasPlayers) sideEl.innerHTML = '<div class="empty-state"><p>Tsy misy mpilalao hafa eto</p></div>';
            else sideEl.appendChild(fragment);
        }
        if (mainEl) {
            mainEl.innerHTML = '';
            if (!hasPlayers) mainEl.innerHTML = '<div class="empty-state"><p>Tsy misy mpilalao hafa eto</p></div>';
            else mainEl.appendChild(fragment2);
        }
    }, err => console.warn("Players error:", err));
}

// =========================================================
//  LOBBY (rooms list)
// =========================================================
function initLobby() {
    if (unsubscribeRooms) { unsubscribeRooms(); unsubscribeRooms = null; }
    const q = query(collection(db, "rooms"), where("status","==","waiting"), limit(30));
    unsubscribeRooms = onSnapshot(q, (snap) => {
        const publicFrag  = document.createDocumentFragment();
        const myFrag      = document.createDocumentFragment();
        let hasPublic = false, hasMy = false;

        snap.forEach(d => {
            const r = d.data();
            const roomId  = d.id;
            const safeId  = escapeHtml(roomId);
            const gameLabel = r.gameType === "fanorontsivy" ? "5×5" : "3×3";
            const isPrivate = r.type === "private";

            if (r.creator?.id === getUserId()) {
                hasMy = true;
                const div = document.createElement("div");
                div.className = "room-card animate-pop";
                div.setAttribute("role","listitem");
                div.innerHTML = `
                    <span>🏠 ${safeId} (${gameLabel})</span>
                    <span class="badge-waiting">⏳ 1/2</span>
                    <div class="room-actions">
                        <button class="btn-cancel" type="button" onclick="deleteRoom('${safeId}')" aria-label="Fafao">🗑️</button>
                        <button type="button" class="room-card-btn" onclick="viewRoom('${safeId}')">Hiditra</button>
                    </div>`;
                myFrag.appendChild(div);
            } else if (!isPrivate) {
                hasPublic = true;
                const div = document.createElement("div");
                div.className = "room-card animate-pop";
                div.setAttribute("role","listitem");
                div.innerHTML = `
                    <span>🌐 ${safeId} (${gameLabel})</span>
                    <span class="badge-waiting">⏳ 1/2</span>
                    <button type="button" class="room-card-btn" onclick="viewRoom('${safeId}')">Hiditra</button>`;
                publicFrag.appendChild(div);
            }
        });

        const publicEl = document.getElementById("rooms-list-dynamic");
        const myEl     = document.getElementById("my-rooms-list");
        if (publicEl) {
            publicEl.innerHTML = '';
            if (!hasPublic) publicEl.innerHTML = '<div class="empty-state"><p>Tsy misy kianja malalaka eto<br>Mamorona ianao! 🏠</p></div>';
            else publicEl.appendChild(publicFrag);
        }
        if (myEl) {
            myEl.innerHTML = '';
            if (!hasMy) myEl.innerHTML = '<div class="empty-state"><p>Tsy mbola nanao kianja ianao</p></div>';
            else myEl.appendChild(myFrag);
        }
    }, err => console.warn("Rooms error:", err));
}

// =========================================================
//  SEARCH (debounced)
// =========================================================
function debounce(fn, ms) {
    let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
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
//  VIEW ROOM (enter lobby before game starts)
// =========================================================
window.viewRoom = async (id) => {
    if (!id || typeof id !== 'string') return;
    try {
        const roomSnap = await getDoc(doc(db, "rooms", id));
        if (!roomSnap.exists()) { showToast("Tsy misy io kianja io", "error"); return; }
        const r = roomSnap.data();
        if (!r) return;

        if (r.type === "private" && r.creator?.id !== getUserId()) {
            const entered = prompt("Teny miafina:");
            if (entered === null) return; // user cancelled
            if (entered !== r.password) { showToast("Teny miafina diso!", "error"); return; }
        }

        currentRoomId = id;
        showScreen('room-lobby-screen');

        if (unsubscribeRoomLobby) { unsubscribeRoomLobby(); unsubscribeRoomLobby = null; }
        unsubscribeRoomLobby = onSnapshot(doc(db, "rooms", id), (snap) => {
            if (!snap.exists()) { leaveRoomLobby(); return; }
            const game = snap.data();
            if (!game) { leaveRoomLobby(); return; }
            renderRoomLobby(game, id);
            if (game.status === "playing") enterGame(id);
        }, err => { showToast("Tapaka ny tambazotra", "error"); leaveRoomLobby(); });
    } catch(e) {
        showToast("Hadisoana: " + e.message, "error");
    }
};

// =========================================================
//  RENDER ROOM LOBBY
// =========================================================
function renderRoomLobby(room, roomId) {
    const lobbyEl = document.getElementById("room-lobby-content");
    if (!lobbyEl) return;
    const isCreator = room.creator?.id === getUserId();
    const isFull    = !!room.opponent?.id;
    const isAI      = room.opponent?.id === 'AI_BOT';
    const gameLabel = room.gameType === "fanorontsivy" ? "Fanorontsivy 5×5" : "Fanorontelo 3×3";
    const safeId    = escapeHtml(roomId);

    lobbyEl.innerHTML = `
        <div class="room-lobby-header">
            <h2>🏠 ${safeId} — ${escapeHtml(gameLabel)}</h2>
            <button type="button" onclick="leaveRoomLobby()" class="btn-exit" aria-label="Hiverina">← Hiverina</button>
        </div>
        <div class="players-vs">
            <div class="player-slot ${isCreator ? 'you' : ''}">
                <img src="${escapeHtml(room.creator?.avatar||'')}" class="player-img-large"
                     alt="${escapeHtml(room.creator?.name||'')}"
                     onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=creator'">
                <h3>${escapeHtml(room.creator?.name||'Mpilalao')}</h3>
                <span class="badge-host">Mpamorona</span>
            </div>
            <div class="vs-text">VS</div>
            <div class="player-slot ${!isCreator && isFull ? 'you' : ''}">
                ${isFull ? `
                    <img src="${escapeHtml(room.opponent?.avatar||'')}" class="player-img-large"
                         alt="${escapeHtml(room.opponent?.name||'')}"
                         onerror="this.src='https://api.dicebear.com/7.x/bottts/svg?seed=opp'">
                    <h3>${escapeHtml(room.opponent?.name||'Mpilalao')}</h3>
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
                <button type="button" onclick="deleteRoom('${safeId}')" class="btn-cancel">🗑️ Fafao ny kianja</button>
            ` : `
                ${!isFull ? `<button type="button" onclick="joinRoom('${safeId}')" class="btn-primary-large">Hiditra amin'ny kianja</button>` : ''}
            `}
        </div>`;
}

// =========================================================
//  START GAME
// =========================================================
window.startGame = async (roomId) => {
    const uid = getUserId();
    if (!uid) return;
    try {
        const snap = await getDoc(doc(db, "rooms", roomId));
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.status === 'playing') return; // déjà démarré
        if (!data.opponent?.id) { showToast("Miandry mpifanandrina aloha", "info"); return; }
        const gameType = data.gameType || "fanorontelo";
        await updateDoc(doc(db, "rooms", roomId), {
            status: "playing",
            board: initBoard(gameType),
            turn: uid,
            startedAt: serverTimestamp()
        });
    } catch(e) { showToast("Tsy afaka nanomboka: " + e.message, "error"); }
};

// =========================================================
//  LEAVE ROOM LOBBY
// =========================================================
window.leaveRoomLobby = () => {
    if (unsubscribeRoomLobby) { unsubscribeRoomLobby(); unsubscribeRoomLobby = null; }
    currentRoomId = null;
    showScreen('lobby-screen');
};

// =========================================================
//  JOIN ROOM
// =========================================================
window.joinRoom = async (id) => {
    const uid = getUserId();
    if (!uid) { showToast("Tsy tafiditra ianao", "error"); return; }
    try {
        const snap = await getDoc(doc(db, "rooms", id));
        if (!snap.exists()) return;
        const r = snap.data();
        if (r.opponent?.id) { showToast("Efa feno ity kianja ity", "error"); return; }
        if (r.status !== "waiting") { showToast("Efa nanomboka ity lalao ity", "error"); return; }
        if (r.creator?.id === uid) return;
        const myName   = document.getElementById("user-name")?.textContent || "Mpilalao";
        const myAvatar = document.getElementById("user-avatar")?.src || '';
        await updateDoc(doc(db, "rooms", id), {
            opponent: { id: uid, name: escapeHtml(myName), avatar: myAvatar },
            joinedAt: serverTimestamp()
        });
    } catch(e) { showToast("Tsy afaka niditra: " + e.message, "error"); }
};

// =========================================================
//  PLAY WITH AI
// =========================================================
window.playWithAI = async (roomId) => {
    try {
        const snap = await getDoc(doc(db, "rooms", roomId));
        if (!snap.exists()) return;
        const data = snap.data();
        if (data.opponent?.id) { showToast("Efa feno ity kianja ity", "error"); return; }
        const gameType = data.gameType || "fanorontelo";
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
            startedAt: serverTimestamp()
        });
    } catch(e) { showToast("Tsy afaka nampiditra AI: " + e.message, "error"); }
};

// =========================================================
//  ENTER GAME
// =========================================================
window.enterGame = async (id) => {
    if (!id) return;
    unsubscribeAll();
    currentRoomId = id;
    selectedCell  = null;
    lastMovedCellId = null;
    isAiThinking  = false;

    showScreen('game-screen');
    initChat(id);

    let gameEnded = false;
    const roomRef = doc(db, "rooms", id);

    unsubscribeRoom = onSnapshot(roomRef, async (snap) => {
        if (!snap.exists()) { leaveGame(); return; }
        const game = snap.data();
        if (!game) { leaveGame(); return; }

        render(game);

        // --- Timer ---
        if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }

        if (game.status === 'playing') {
            const timerEl = document.getElementById("turn-timer");
            if (timerEl) {
                let timeLeft = 30;
                timerEl.textContent = `⏱️ ${timeLeft}s`;
                timerEl.className = '';
                turnTimerInterval = setInterval(async () => {
                    timeLeft--;
                    if (timerEl) {
                        timerEl.textContent = `⏱️ ${timeLeft}s`;
                        timerEl.className = timeLeft <= 10 ? (timeLeft <= 5 ? 'timer-danger' : 'timer-warning') : '';
                    }
                    if (timeLeft <= 0) {
                        clearInterval(turnTimerInterval);
                        turnTimerInterval = null;
                        if (game.turn === getUserId() && currentRoomId) {
                            const nextTurn = game.turn === game.creator?.id
                                ? game.opponent?.id
                                : game.creator?.id;
                            if (nextTurn) {
                                await updateDoc(roomRef, { turn: nextTurn }).catch(() => {});
                            }
                        }
                    }
                }, 1000);
            }

            // AI move
            if (game.turn === 'AI_BOT' && !isAiThinking) {
                aiMove(game);
            }

            // Vérification winner
            const winner = checkWinnerFanorona(
                game.board, game.creator?.id, game.opponent?.id, game.gameType
            );
            if (winner && !gameEnded) {
                clearInterval(turnTimerInterval); turnTimerInterval = null;
                await updateDoc(roomRef, {
                    status: 'finished', winner, finishedAt: serverTimestamp()
                }).catch(() => {});
            }
        }

        // Game over
        if (game.status === 'finished' && game.winner && !gameEnded) {
            gameEnded = true;
            if (turnTimerInterval) { clearInterval(turnTimerInterval); turnTimerInterval = null; }

            const winnerId   = game.winner;
            const loserId    = winnerId === game.creator?.id ? game.opponent?.id : game.creator?.id;
            const winnerName = winnerId === game.creator?.id ? game.creator?.name : game.opponent?.name;
            const loserName  = loserId  === game.creator?.id ? game.creator?.name : game.opponent?.name;

            // Update leaderboard (seulement humains)
            if (winnerId !== 'AI_BOT' && loserId && loserId !== 'AI_BOT') {
                await updateLeaderboard(winnerId, winnerName, loserId, loserName).catch(console.warn);
            }

            const msg = `🎉 ${escapeHtml(winnerName||'Iray')} no nandresy! ${randomOhabolana()}`;
            setTimeout(() => {
                showToast(msg, 'success', 5000);
                if (confirm(`🏆 ${winnerName} no nandresy!\nHifandimby indray?`)) {
                    // Rematch — ovay turn
                    leaveGame();
                } else {
                    leaveGame();
                }
            }, 600);
        }
    }, err => { showToast("Tapaka ny tambazotra", "error"); leaveGame(); });
};

// =========================================================
//  RENDER
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
        if (selectedCell?.id === cell.id) div.classList.add("active-spot");
        if (lastMovedCellId === cell.id)  div.classList.add("last-moved");

        if (cell.value) {
            const stone = document.createElement("div");
            const isBlack = cell.value === 1;
            stone.className = `stone ${isBlack ? 'black-stone' : 'white-stone'} animate-pop`;
            stone.setAttribute("aria-label", `Vato ${isBlack ? 'mainty' : 'fotsy'}`);
            div.appendChild(stone);
        } else {
            div.setAttribute("aria-label", "Toerana malalaka");
        }

        // Utiliser pointerdown pour éviter double-trigger tactile/souris
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

    // Turn indicator
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

    // Score
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
//  HANDLE MOVE
// =========================================================
async function handleMove(cell, game) {
    if (!game || game.status !== 'playing') return;
    const uid = getUserId();
    if (!uid || game.turn !== uid) return;

    const myVal = game.creator?.id === uid ? 1 : 2;
    let b = game.board.map(c => ({ ...c })); // copie profonde

    if (!selectedCell) {
        if (cell.value === myVal) {
            selectedCell = cell;
            render(game);
        }
    } else {
        if (cell.id === selectedCell.id) {
            // Déselectionner
            selectedCell = null;
            render(game);
            return;
        }

        if (cell.value === 0 && isValidMove(selectedCell, cell, game.gameType)) {
            const captures = getCaptures(b, selectedCell, cell, myVal, game.gameType);
            const fromId   = selectedCell.id;

            // Notation du dernier mouvement
            const notation = cellToNotation(selectedCell) + '-' + cellToNotation(cell);

            b = b.map(c => {
                if (c.id === fromId)             return { ...c, value: 0 };
                if (c.id === cell.id)            return { ...c, value: myVal };
                if (captures.includes(c.id))     return { ...c, value: 0 };
                return c;
            });

            lastMovedCellId = cell.id;
            selectedCell = null;
            await finalizeTurn(b, game, notation);
        } else if (cell.value === myVal) {
            selectedCell = cell;
            render(game);
        } else {
            selectedCell = null;
            render(game);
        }
    }
}

// =========================================================
//  FINALIZE TURN
// =========================================================
async function finalizeTurn(b, game, notation) {
    if (!currentRoomId) return;
    if (!game.opponent?.id) return;

    const winner   = checkWinnerFanorona(b, game.creator?.id, game.opponent?.id, game.gameType);
    const nextTurn = game.turn === game.creator?.id ? game.opponent?.id : game.creator?.id;

    try {
        await updateDoc(doc(db, "rooms", currentRoomId), {
            board:    b,
            turn:     winner ? "end" : nextTurn,
            winner:   winner || null,
            lastMove: notation || null,
            updatedAt: serverTimestamp()
        });
    } catch(e) {
        showToast("Hadisoana @ fandefasana paika", "error");
        console.error("finalizeTurn error:", e);
    }
}

// =========================================================
//  LEAVE GAME
// =========================================================
window.leaveGame = async () => {
    unsubscribeAll();
    const rid = currentRoomId;
    currentRoomId   = null;
    selectedCell    = null;
    lastMovedCellId = null;
    isAiThinking    = false;
    showScreen('lobby-screen');
    if (rid) {
        try { await deleteDoc(doc(db, "rooms", rid)); } catch(e) { /* ignoré */ }
    }
};

// =========================================================
//  CHAT
// =========================================================
const chatRateLimit = { count: 0, resetAt: 0 };

function initChat(roomId) {
    if (!roomId) return;
    if (unsubscribeChat) { unsubscribeChat(); unsubscribeChat = null; }

    const chatMessages = document.getElementById("chat-messages");
    const chatInput    = document.getElementById("chat-input");
    const chatSend     = document.getElementById("chat-send");
    if (!chatMessages || !chatInput || !chatSend) return;

    chatMessages.innerHTML = '';

    const q = query(
        collection(db, "rooms", roomId, "chat"),
        orderBy("timestamp", "asc"),
        limit(100)
    );
    unsubscribeChat = onSnapshot(q, (snap) => {
        if (!chatMessages) return;
        chatMessages.innerHTML = '';
        const frag = document.createDocumentFragment();
        snap.forEach(d => {
            const msg = d.data();
            const isMe = msg.senderId === getUserId();
            const div  = document.createElement("div");
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

        // Rate limit : 5 messages / 10s
        const now = Date.now();
        if (now > chatRateLimit.resetAt) {
            chatRateLimit.count = 0;
            chatRateLimit.resetAt = now + 10000;
        }
        if (chatRateLimit.count >= 5) {
            showToast("Miadina kely alohan'ny handefa hafatra hafa", "info");
            return;
        }
        chatRateLimit.count++;

        const myName = document.getElementById("user-name")?.textContent || "Mpilalao";
        chatInput.value = '';
        try {
            await addDoc(collection(db, "rooms", roomId, "chat"), {
                senderId:   getUserId(),
                senderName: escapeHtml(myName),
                text:       escapeHtml(text),
                timestamp:  serverTimestamp()
            });
        } catch(e) { showToast("Tsy afaka nandefa hafatra", "error"); }
    }

    // Enlever les anciens handlers
    const newSend = chatSend.cloneNode(true);
    chatSend.parentNode.replaceChild(newSend, chatSend);
    newSend.addEventListener('click', sendMessage);

    const newInput = chatInput.cloneNode(true);
    chatInput.parentNode.replaceChild(newInput, chatInput);
    newInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendMessage(); });

    // Quick chat buttons
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
            } catch(e) { /* ignoré */ }
        });
    });
}

// =========================================================
//  LEADERBOARD (Supabase)
// =========================================================
async function updateLeaderboard(winnerId, winnerName, loserId, loserName) {
    if (!winnerId || !loserId || winnerId === loserId) return;
    try {
        const [{ data: winData }, { data: loseData }] = await Promise.all([
            supabase.from("leaderboard").select("*").eq("player_id", winnerId).maybeSingle(),
            supabase.from("leaderboard").select("*").eq("player_id", loserId).maybeSingle()
        ]);
        await Promise.all([
            winData
                ? supabase.from("leaderboard").update({ wins: (winData.wins||0) + 1 }).eq("player_id", winnerId)
                : supabase.from("leaderboard").insert([{ player_id: winnerId, player_name: escapeHtml(winnerName||''), wins: 1, losses: 0 }]),
            loseData
                ? supabase.from("leaderboard").update({ losses: (loseData.losses||0) + 1 }).eq("player_id", loserId)
                : supabase.from("leaderboard").insert([{ player_id: loserId, player_name: escapeHtml(loserName||''), wins: 0, losses: 1 }])
        ]);
    } catch(e) { console.warn("Leaderboard error:", e); }
}

async function loadLeaderboard() {
    const container = document.getElementById("leaderboard");
    if (!container) return;
    try {
        const { data, error } = await supabase
            .from("leaderboard")
            .select("*")
            .order("wins", { ascending: false })
            .limit(10);
        if (error) throw error;
        if (!data || data.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>Tsy mbola misy ato ny laharana</p></div>';
            return;
        }
        const frag = document.createDocumentFragment();
        data.forEach((p, i) => {
            const div = document.createElement("div");
            div.className = "leaderboard-row";
            div.setAttribute("role","listitem");
            const medals = ['🥇','🥈','🥉'];
            div.innerHTML = `
                <span class="leaderboard-rank">${medals[i] || (i+1)+'.'}</span>
                <span class="leaderboard-name">${escapeHtml(p.player_name||'')}</span>
                <span class="leaderboard-stats">🟢${p.wins||0} 🔴${p.losses||0}</span>`;
            frag.appendChild(div);
        });
        container.innerHTML = '';
        container.appendChild(frag);
    } catch(e) {
        container.innerHTML = '<div class="empty-state"><p>Tsy afaka nitondra ny laharana</p></div>';
    }
}

// =========================================================
//  PROFILE MODAL
// =========================================================
window.openEditModal = () => {
    const modal    = document.getElementById("modal-edit-profile");
    const nameEl   = document.getElementById("edit-name");
    const avatarEl = document.getElementById("edit-avatar");
    if (!modal) return;
    if (nameEl)   nameEl.value   = document.getElementById("user-name")?.textContent || '';
    if (avatarEl) avatarEl.value = document.getElementById("user-avatar")?.src || '';
    modal.classList.remove("hidden");
};
window.closeEditModal = () => {
    document.getElementById("modal-edit-profile")?.classList.add("hidden");
};

// Preview avatar
document.addEventListener('DOMContentLoaded', () => {
    const avatarInput = document.getElementById("edit-avatar");
    const preview = document.getElementById("avatar-preview");
    if (avatarInput && preview) {
        avatarInput.addEventListener('input', () => {
            const url = avatarInput.value.trim();
            if (url.startsWith('http')) {
                preview.src = url;
                preview.style.display = 'block';
            } else {
                preview.style.display = 'none';
            }
        });
    }

    // ===== BTN GOOGLE =====
    const btnGoogle = document.getElementById("btn-google");
    if (btnGoogle) {
        btnGoogle.addEventListener('click', async () => {
            btnGoogle.disabled = true;
            btnGoogle.textContent = "Miandry...";
            try {
                await signInWithPopup(auth, provider);
            } catch(e) {
                showToast("Tsy afaka niditra amin'ny Google: " + e.message, "error");
                btnGoogle.disabled = false;
                btnGoogle.innerHTML = '<i class="fab fa-google"></i> Midira amin\'ny Google';
            }
        });
    }

    // ===== BTN GUEST =====
    const btnGuest = document.getElementById("btn-guest");
    if (btnGuest) {
        btnGuest.addEventListener('click', async () => {
            btnGuest.disabled = true;
            try {
                let guestUid  = localStorage.getItem("nolimite_guest_uid");
                let guestName = localStorage.getItem("nolimite_guest_name");
                if (!guestUid) {
                    guestUid  = "GUEST_" + crypto.randomUUID().replace(/-/g,'').substr(0,12);
                    guestName = guestName || ("Mpanandrana_" + Math.floor(Math.random() * 9000 + 1000));
                    localStorage.setItem("nolimite_guest_uid",  guestUid);
                    localStorage.setItem("nolimite_guest_name", guestName);
                } else {
                    guestName = guestName || ("Mpanandrana_" + Math.floor(Math.random() * 9000 + 1000));
                }
                const avatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${guestUid}`;
                myCurrentUid = guestUid;
                await setDoc(doc(db, "users", guestUid), {
                    uid: guestUid, name: guestName, avatar,
                    status: "online", isGuest: true,
                    lastSeen: serverTimestamp(), createdAt: serverTimestamp()
                }, { merge: true });
                setupGuestUI({ uid: guestUid, name: guestName, avatar });
            } catch(e) {
                showToast("Tsy afaka niditra: " + e.message, "error");
                btnGuest.disabled = false;
            }
        });
    }

    // ===== BTN CREATE ROOM =====
    const btnCreate = document.getElementById("btn-create-room");
    if (btnCreate) {
        btnCreate.addEventListener('click', () => {
            const modal = document.getElementById("modal-create");
            if (modal) modal.classList.remove("hidden");
        });
    }

    // ===== ROOM TYPE CHANGE =====
    const roomType = document.getElementById("room-type");
    const pwGroup  = document.getElementById("password-group");
    if (roomType && pwGroup) {
        roomType.addEventListener('change', () => {
            pwGroup.style.display = roomType.value === "private" ? "block" : "none";
        });
    }

    // ===== QUICK PLAY =====
    const btnQuick = document.getElementById("btn-quick-play");
    if (btnQuick) {
        btnQuick.addEventListener('click', async () => {
            const uid = getUserId();
            if (!uid) { showToast("Miditra aloha!", "error"); return; }
            btnQuick.disabled = true;
            try {
                const q    = query(collection(db, "rooms"),
                    where("status","==","waiting"),
                    where("type","==","public"),
                    limit(10));
                const snap = await getDocs(q);
                let found  = null;
                snap.forEach(d => {
                    if (!found && d.data().creator?.id !== uid) found = d.id;
                });
                if (found) {
                    viewRoom(found);
                } else {
                    const autoId = "Q" + (crypto.randomUUID().replace(/-/g,'').substr(0,8)).toUpperCase();
                    await setDoc(doc(db, "rooms", autoId), {
                        creator: {
                            id: uid,
                            name: escapeHtml(document.getElementById("user-name")?.textContent||""),
                            avatar: document.getElementById("user-avatar")?.src||""
                        },
                        status: "waiting", type: "public",
                        gameType: "fanorontelo",
                        createdAt: serverTimestamp()
                    });
                    autoDeleteRoom(autoId);
                    viewRoom(autoId);
                }
            } catch(e) { showToast("Hadisoana: " + e.message, "error"); }
            finally { btnQuick.disabled = false; }
        });
    }

    // ===== CONFIRM CREATE ROOM =====
    const btnConfirm = document.getElementById("btn-confirm-create");
    if (btnConfirm) {
        btnConfirm.addEventListener('click', async () => {
            const uid = getUserId();
            if (!uid) { showToast("Miditra aloha!", "error"); return; }
            btnConfirm.disabled = true;
            try {
                const rawName  = document.getElementById("room-uid-input")?.value || '';
                const name     = slugify(rawName) || "KIANJA_" + Math.floor(Math.random()*9000+1000);
                const type     = document.getElementById("room-type")?.value || "public";
                const pass     = document.getElementById("room-password")?.value || '';
                const gameType = document.getElementById("game-type")?.value || "fanorontelo";

                const existSnap = await getDoc(doc(db, "rooms", name));
                if (existSnap.exists()) { showToast("Efa misy kianja mitovy anarana", "error"); btnConfirm.disabled = false; return; }

                await setDoc(doc(db, "rooms", name), {
                    creator: {
                        id: uid,
                        name: escapeHtml(document.getElementById("user-name")?.textContent||""),
                        avatar: document.getElementById("user-avatar")?.src||""
                    },
                    status: "waiting", type,
                    gameType,
                    password: type === "private" ? pass : "",
                    createdAt: serverTimestamp()
                });

                // Reset form
                if (document.getElementById("room-uid-input"))   document.getElementById("room-uid-input").value   = '';
                if (document.getElementById("room-password"))     document.getElementById("room-password").value   = '';
                if (document.getElementById("room-type"))         document.getElementById("room-type").value        = 'public';
                if (document.getElementById("password-group"))    document.getElementById("password-group").style.display = 'none';

                document.getElementById("modal-create")?.classList.add("hidden");
                autoDeleteRoom(name);
                viewRoom(name);
            } catch(e) { showToast("Tsy afaka namorona kianja: " + e.message, "error"); }
            finally { btnConfirm.disabled = false; }
        });
    }

    // ===== SAVE PROFILE =====
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
            
            if (!newName || newName.length > 8) {
                showToast("Anarana 1 hatramin'ny 8 litera", "error");
                return;
            }
            if (newAvatar && !newAvatar.startsWith('http')) {
                showToast("URL avatar tsy marina", "error");
                return;
            }
            
            const finalAvatar = newAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${uid}`;
            
            // 1. Update users collection
            await setDoc(doc(db, "users", uid), {
                uid: uid,
                name: newName, 
                avatar: finalAvatar,
                status: "online",
                lastSeen: serverTimestamp()
            }, { merge: true });
            
            // 2. Update anarana ao amin'ny room raha efa anaty lalao
            if (currentRoomId) {
                const roomRef = doc(db, "rooms", currentRoomId);
                const roomSnap = await getDoc(roomRef);
                if (roomSnap.exists()) {
                    const roomData = roomSnap.data();
                    if (roomData.creator?.id === uid) {
                        await updateDoc(roomRef, {
                            "creator.name": newName,
                            "creator.avatar": finalAvatar
                        });
                    } else if (roomData.opponent?.id === uid) {
                        await updateDoc(roomRef, {
                            "opponent.name": newName,
                            "opponent.avatar": finalAvatar
                        });
                    }
                }
            }
            
            // 3. Update UI
            const nameEl = document.getElementById("user-name");
            const avatarEl = document.getElementById("user-avatar");
            if (nameEl) nameEl.textContent = newName;
            if (avatarEl) avatarEl.src = finalAvatar;
            
            closeEditModal();
            showToast("Voatahiry ny mombamomba! ✅", "success");
        } catch(e) { 
            console.error("Erreur save profile:", e); 
            showToast("Tsy afaka nahitsy: " + e.code, "error"); 
        }
        finally { btnSave.disabled = false; }
    });
}
    // ===== LOGOUT =====
    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener('click', async () => {
            if (!confirm("Hivoaka ve ianao?")) return;
            btnLogout.disabled = true;
            unsubscribeAll();
            const uid = getUserId();
            teardownPresence(uid);
            myCurrentUid = null;
            try { await auth.signOut(); } catch(e) { /* ignoré */ }
            localStorage.removeItem("nolimite_guest_uid");
            localStorage.removeItem("nolimite_guest_name");
            showScreen('login-screen');
        });
    }

    // ===== GAME SCREEN EXIT BUTTON (event delegation) =====
    document.addEventListener('click', (e) => {
        if (e.target.closest('[data-action="leave-game"]')) {
            if (confirm("Hiala amin'ny lalao ve ianao?")) leaveGame();
        }
    });

    // ===== BEFORE UNLOAD =====
    window.addEventListener('beforeunload', () => {
        const uid = getUserId();
        if (uid) {
            updateDoc(doc(db, "users", uid), { status: "offline" }).catch(() => {});
        }
    });

    setupSearch();
    loadLeaderboard();
});
