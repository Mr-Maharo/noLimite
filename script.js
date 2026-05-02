import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    addDoc,
    query,
    orderBy,
    where,
    limit,
    getDocs,
    getDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabase = createClient(
  "https://YOUR_PROJECT.supabase.co",
  "YOUR_ANON_KEY"
);

// ================= CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyCeeK9mTTNb5f5t3xM8K7WnxOij6uY7THM",
  authDomain: "fanorona-d6911.firebaseapp.com",
  databaseURL: "https://fanorona-d6911-default-rtdb.firebaseio.com",
  projectId: "fanorona-d6911",
  storageBucket: "fanorona-d6911.firebasestorage.app",
  messagingSenderId: "882799309556",
  appId: "1:882799309556:web:662773f9fcc8ad982ca4a1",
  measurementId: "G-DL0KC683X8"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ================= GLOBAL STATE =================
let currentRoomId = null;
let selectedCell = null;
let myCurrentUid = null;
let isAiThinking = false;
let turnTimerInterval = null;

let unsubscribeRoom = null;
let unsubscribeRoomLobby = null;
let unsubscribeChat = null;
let unsubscribePlayers = null;
let unsubscribeRooms = null;

// ================= SOUND - ATAO MUTE FA 403 =================
function playSound(type) {
    // Esorina aloha fa 403 ny CDN
    // Azonao soloina base64 na file-nao manokana
}

// ================= HELPER =================
function getUserId() {
    return myCurrentUid || auth.currentUser?.uid || null;
}

function unsubscribeAll() {
    if (unsubscribeRoom) unsubscribeRoom();
    if (unsubscribeRoomLobby) unsubscribeRoomLobby();
    if (unsubscribeChat) unsubscribeChat();
    if (unsubscribePlayers) unsubscribePlayers();
    if (unsubscribeRooms) unsubscribeRooms();
    if (turnTimerInterval) clearInterval(turnTimerInterval);
}

// ================= PRESENCE =================
function setupPresence(uid) {
    const userRef = doc(db, "users", uid);
    updateDoc(userRef, { status: "online", lastSeen: serverTimestamp() }).catch(() => {});
    window.addEventListener("beforeunload", () => {
        updateDoc(userRef, { status: "offline" }).catch(() => {});
    });
    setInterval(() => {
        updateDoc(userRef, { lastSeen: serverTimestamp() }).catch(() => {});
    }, 30000);
}

// ================= BOARD INIT =================
function initBoard(gameType) {
    if (gameType === "fanorontsivy") {
        return [
            { id: 0, x: 0, y: 0, value: 1 }, { id: 1, x: 1, y: 0, value: 1 }, { id: 2, x: 2, y: 0, value: 1 }, { id: 3, x: 3, y: 0, value: 1 }, { id: 4, x: 4, y: 0, value: 1 },
            { id: 5, x: 0, y: 1, value: 1 }, { id: 6, x: 1, y: 1, value: 1 }, { id: 7, x: 2, y: 1, value: 1 }, { id: 8, x: 3, y: 1, value: 1 }, { id: 9, x: 4, y: 1, value: 1 },
            { id: 10, x: 0, y: 2, value: 0 }, { id: 11, x: 1, y: 2, value: 0 }, { id: 12, x: 2, y: 2, value: 0 }, { id: 13, x: 3, y: 2, value: 0 }, { id: 14, x: 4, y: 2, value: 0 },
            { id: 15, x: 0, y: 3, value: 2 }, { id: 16, x: 1, y: 3, value: 2 }, { id: 17, x: 2, y: 3, value: 2 }, { id: 18, x: 3, y: 3, value: 2 }, { id: 19, x: 4, y: 3, value: 2 },
            { id: 20, x: 0, y: 4, value: 2 }, { id: 21, x: 1, y: 4, value: 2 }, { id: 22, x: 2, y: 4, value: 2 }, { id: 23, x: 3, y: 4, value: 2 }, { id: 24, x: 4, y: 4, value: 2 }
        ];
    } else {
        return [
            { id: 0, x: 0, y: 0, value: 1 }, { id: 1, x: 1, y: 0, value: 1 }, { id: 2, x: 2, y: 0, value: 1 },
            { id: 3, x: 0, y: 1, value: 0 }, { id: 4, x: 1, y: 1, value: 0 }, { id: 5, x: 2, y: 1, value: 0 },
            { id: 6, x: 0, y: 2, value: 2 }, { id: 7, x: 1, y: 2, value: 2 }, { id: 8, x: 2, y: 2, value: 2 }
        ];
    }
}

// ================= FANORONA LOGIC =================
function getCaptures(board, fromCell, toCell, myVal, gameType) {
    const maxSize = gameType === "fanorontsivy" ? 4 : 2;
    const opponentVal = myVal === 1 ? 2 : 1;
    const captured = [];
    const dx = toCell.x - fromCell.x;
    const dy = toCell.y - fromCell.y;

    // PAIKA
    let nx = toCell.x + dx;
    let ny = toCell.y + dy;
    while (nx >= 0 && nx <= maxSize && ny >= 0 && ny <= maxSize) {
        const nextCell = board.find(c => c.x === nx && c.y === ny);
        if (!nextCell || nextCell.value !== opponentVal) break;
        captured.push(nextCell.id);
        nx += dx;
        ny += dy;
    }

    // VELA
    nx = fromCell.x - dx;
    ny = fromCell.y - dy;
    while (nx >= 0 && nx <= maxSize && ny >= 0 && ny <= maxSize) {
        const nextCell = board.find(c => c.x === nx && c.y === ny);
        if (!nextCell || nextCell.value !== opponentVal) break;
        captured.push(nextCell.id);
        nx -= dx;
        ny -= dy;
    }

    return [...new Set(captured)];
}

function checkWinnerFanorona(board, creatorId, opponentId, gameType) {
    const creatorStones = board.filter(c => c.value === 1).length;
    const opponentStones = board.filter(c => c.value === 2).length;
    if (creatorStones === 0) return opponentId;
    if (opponentStones === 0) return creatorId;

    const canMove = (val) => {
        const stones = board.filter(c => c.value === val);
        for (let stone of stones) {
            for (let cell of board) {
                if (cell.value === 0) {
                    const dx = Math.abs(cell.x - stone.x);
                    const dy = Math.abs(cell.y - stone.y);
                    if (dx <= 1 && dy <= 1) return true;
                }
            }
        }
        return false;
    };

    if (!canMove(1)) return opponentId;
    if (!canMove(2)) return creatorId;
    return null;
}

// ================= AI =================
async function aiMove(game) {
    if (game.turn !== 'AI_BOT' || game.status !== 'playing') return;
    await new Promise(resolve => setTimeout(resolve, 1200));

    const aiStones = game.board.filter(cell => cell.value === 2);
    const emptyCells = game.board.filter(cell => cell.value === 0);
    if (aiStones.length === 0 || emptyCells.length === 0) return;

    let bestMove = null;
    let maxCaptures = -1;

    for (let stone of aiStones) {
        for (let empty of emptyCells) {
            const dx = Math.abs(empty.x - stone.x);
            const dy = Math.abs(empty.y - stone.y);
            if (dx <= 1 && dy <= 1) {
                const captures = getCaptures(game.board, stone, empty, 2, game.gameType);
                if (captures.length > maxCaptures) {
                    maxCaptures = captures.length;
                    bestMove = { from: stone, to: empty, captures };
                }
            }
        }
    }

    if (!bestMove) {
        const randomStone = aiStones[Math.floor(Math.random() * aiStones.length)];
        const validMoves = emptyCells.filter(cell => {
            const dx = Math.abs(cell.x - randomStone.x);
            const dy = Math.abs(cell.y - randomStone.y);
            return dx <= 1 && dy <= 1;
        });
        if (validMoves.length > 0) {
            bestMove = {
                from: randomStone,
                to: validMoves[Math.floor(Math.random() * validMoves.length)],
                captures: []
            };
        }
    }

    if (bestMove) {
        let newBoard = game.board.map(cell => {
            if (cell.id === bestMove.from.id) return { ...cell, value: 0 };
            if (cell.id === bestMove.to.id) return { ...cell, value: 2 };
            return cell;
        });

        if (bestMove.captures.length > 0) {
            playSound('capture');
            newBoard = newBoard.map(cell =>
                bestMove.captures.includes(cell.id) ? { ...cell, value: 0 } : cell
            );
        }

        await updateDoc(doc(db, "rooms", currentRoomId), {
            board: newBoard,
            turn: game.creator.id
        });
        playSound('click');
    }
}

// ================= LOGIN =================
document.getElementById("btn-guest").onclick = async () => {
    let guestUid = localStorage.getItem("nolimite_guest_uid");
    let guestName = localStorage.getItem("nolimite_guest_name") || "Mpanandrana_" + Math.floor(Math.random() * 1000);
    let guestAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=" + guestName;

    if (!guestUid) {
        guestUid = "GUEST_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        localStorage.setItem("nolimite_guest_uid", guestUid);
        localStorage.setItem("nolimite_guest_name", guestName);
    }

    myCurrentUid = guestUid;
    const guestData = {
        uid: guestUid,
        name: guestName,
        avatar: guestAvatar,
        status: "online",
        isGuest: true,
        lastSeen: serverTimestamp()
    };

    await setDoc(doc(db, "users", guestUid), guestData, { merge: true });
    setupGuestUI(guestData);
};

function setupGuestUI(user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");
    document.getElementById("user-name").innerText = user.name;
    document.getElementById("user-avatar").src = user.avatar;
    setupPresence(user.uid);
    initLobby();
    initPlayerList();
    initInvites(user.uid);
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        myCurrentUid = user.uid;
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("lobby-screen").classList.remove("hidden");

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        let finalName = user.displayName;
        let finalAvatar = user.photoURL;

        if (userSnap.exists()) {
            const data = userSnap.data();
            finalName = data.name || user.displayName;
            finalAvatar = data.avatar || user.photoURL;
        }

        await setDoc(userRef, {
            uid: user.uid,
            name: finalName,
            avatar: finalAvatar,
            status: "online",
            lastSeen: serverTimestamp()
        }, { merge: true });

        setupGuestUI({ uid: user.uid, name: finalName, avatar: finalAvatar });
    } else {
        if (!localStorage.getItem("nolimite_guest_uid")) {
            document.getElementById("login-screen").classList.remove("hidden");
            document.getElementById("lobby-screen").classList.add("hidden");
        }
    }
});

// ================= AUTO DELETE =================
async function autoDeleteRoom(roomId) {
    setTimeout(async () => {
        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);
        if (snap.exists() && snap.data().status === "waiting") {
            await deleteDoc(roomRef);
        }
    }, 5 * 60 * 1000);
}

// ================= BUTTONS =================
document.getElementById("btn-google").onclick = () => signInWithPopup(auth, provider);
document.getElementById("btn-create-room").onclick = () => document.getElementById("modal-create").classList.remove("hidden");
document.getElementById("room-type").onchange = function () {
    document.getElementById("room-password").style.display = this.value === "private" ? "block" : "none";
};

window.deleteRoom = async (roomId) => {
    if (confirm("Tena hovafanao ve ity efitra ity?")) {
        await deleteDoc(doc(db, "rooms", roomId));
        leaveRoomLobby();
    }
};

// ================= INVITES =================
window.sendInvite = async (targetUid) => {
    const uid = getUserId();
    if (!uid) return;
    const myName = document.getElementById("user-name").innerText;
    await addDoc(collection(db, "invites"), {
        from: uid,
        fromName: myName,
        to: targetUid,
        status: "pending",
        createdAt: serverTimestamp()
    });
    playSound('invite');
    alert("Nalefa ny fanasana!");
};

function initInvites(uid) {
    const q = query(collection(db, "invites"), where("to", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        snap.forEach(d => showInviteUI(d.id, d.data()));
    });
}

function showInviteUI(inviteId, invite) {
    if (document.getElementById("invite-" + inviteId)) return;
    const container = document.getElementById("invite-notifications");
    const box = document.createElement("div");
    box.id = "invite-" + inviteId;
    box.className = "invite-popup glass animate-pop";
    box.innerHTML = `
        <p>🎮 <b>${invite.fromName}</b> manasa anao!</p>
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button class="btn-save" onclick="acceptInvite('${inviteId}', '${invite.from}', '${invite.fromName}')">Ekena</button>
            <button class="btn-cancel" onclick="rejectInvite('${inviteId}')">Tsia</button>
        </div>
    `;
    container.appendChild(box);
}

window.acceptInvite = async (inviteId, senderUid, senderName) => {
    const uid = getUserId();
    if (!uid) return;
    document.getElementById("invite-" + inviteId)?.remove();
    const roomId = "INVITE_" + Math.floor(Math.random() * 10000);
    const myName = document.getElementById("user-name").innerText;
    const myAvatar = document.getElementById("user-avatar").src;

    await setDoc(doc(db, "rooms", roomId), {
        creator: { id: senderUid, name: senderName, avatar: "" },
        opponent: { id: uid, name: myName, avatar: myAvatar },
        status: "playing",
        gameType: "fanorontelo",
        turn: senderUid,
        board: initBoard("fanorontelo"),
        createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "invites", inviteId), { status: "accepted" });
    enterGame(roomId);
};

window.rejectInvite = async (inviteId) => {
    document.getElementById("invite-" + inviteId)?.remove();
    await updateDoc(doc(db, "invites", inviteId), { status: "rejected" });
};

// ================= LOBBY =================
async function initPlayerList() {
    if (unsubscribePlayers) unsubscribePlayers();
    const q = query(collection(db, "users"), where("status", "==", "online"), limit(20));
    unsubscribePlayers = onSnapshot(q, (snapshot) => {
        const listSidebar = document.getElementById("online-players");
        const listMain = document.getElementById("players-list-dynamic");
        if (listSidebar) listSidebar.innerHTML = "";
        if (listMain) listMain.innerHTML = "";

        snapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.uid !== getUserId()) {
                const html = `
                    <div class="player-item">
                        <img src="${userData.avatar}" class="player-avatar-mini">
                        <div class="player-info">
                            <span class="player-name-mini">${userData.name}</span>
                            <div class="status-indicator"><span class="dot-online"></span> Online</div>
                        </div>
                        <button class="btn-invite-mini" onclick="sendInvite('${userData.uid}')">Hantsy</button>
                    </div>`;
                if (listSidebar) listSidebar.innerHTML += html;
                if (listMain) listMain.innerHTML += html;
            }
        });
    });
}

function initLobby() {
    if (unsubscribeRooms) unsubscribeRooms();
    unsubscribeRooms = onSnapshot(collection(db, "rooms"), (snap) => {
        const publicList = document.getElementById("rooms-list-dynamic");
        const myRoomsList = document.getElementById("my-rooms-list");

        if (publicList) publicList.innerHTML = "";
        if (myRoomsList) myRoomsList.innerHTML = "";

        snap.forEach(d => {
            const r = d.data();
            const roomId = d.id;
            if (r.status === "waiting") {
                const isPrivate = r.type === "private" ? "🔒" : "🌐";
                const gameLabel = r.gameType === "fanorontsivy" ? "5x5" : "3x3";
                const playerBadge = `<span class="badge-waiting">● ${gameLabel} 1/2</span>`;

                if (r.creator.id === getUserId()) {
                    if (myRoomsList) {
                        myRoomsList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>🏠 ${roomId} (${gameLabel})</span>
                                <div class="room-actions">
                                    <button class="btn-cancel" onclick="deleteRoom('${roomId}')">🗑️</button>
                                    <button onclick="viewRoom('${roomId}')">Hiditra</button>
                                </div>
                            </div>`;
                    }
                } else if (r.type !== "private") {
                    if (publicList) {
                        publicList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>${isPrivate} ${roomId} (${gameLabel})</span>
                                ${playerBadge}
                                <button onclick="viewRoom('${roomId}')">Hijery</button>
                            </div>`;
                    }
                }
            }
        });
    });

    document.getElementById("search-player").addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll("#players-list-dynamic .player-item").forEach(player => {
            const name = player.querySelector(".player-name-mini").innerText.toLowerCase();
            player.style.display = name.includes(searchTerm) ? "flex" : "none";
        });
    });

    document.getElementById("search-room").addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll("#rooms-list-dynamic .room-card").forEach(room => {
            const roomName = room.querySelector("span").innerText.toLowerCase();
            room.style.display = roomName.includes(searchTerm) ? "flex" : "none";
        });
    });
}

// ================= ROOM LOBBY =================
window.viewRoom = async (id) => {
    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return alert("Tsy misy io efitra io");

    const r = roomSnap.data();
    if (r.type === "private" && r.creator.id !== getUserId()) {
        if (prompt("Teny miafina:") !== r.password) return alert("Diso!");
    }

    currentRoomId = id;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("room-lobby-screen").classList.remove("hidden");

    if (unsubscribeRoomLobby) unsubscribeRoomLobby();
    unsubscribeRoomLobby = onSnapshot(roomRef, (snap) => {
        const game = snap.data();
        if (!game) return;
        renderRoomLobby(game, id);
        if (game.status === "playing") enterGame(id);
    });
};

function renderRoomLobby(room, roomId) {
    const lobbyEl = document.getElementById("room-lobby-content");
    const isCreator = room.creator.id === getUserId();
    const isFull = room.opponent?.id;
    const isPlayingWithAI = room.opponent?.id === 'AI_BOT';
    const gameLabel = room.gameType === "fanorontsivy" ? "Fanorontsivy 5x5" : "Fanorontelo 3x3";

    lobbyEl.innerHTML = `
        <div class="room-lobby-header">
            <h2>🏠 ${roomId} - ${gameLabel}</h2>
            <button onclick="leaveRoomLobby()" class="btn-exit">← Hiverina</button>
        </div>
        <div class="players-vs">
            <div class="player-slot ${isCreator ? 'you' : ''}">
                <img src="${room.creator.avatar}" class="player-img-large">
                <h3>${room.creator.name}</h3>
                <span class="badge-host">Mpamorona</span>
            </div>
            <div class="vs-text">VS</div>
            <div class="player-slot ${!isCreator && isFull ? 'you' : ''}">
                ${isFull ? `
                    <img src="${room.opponent.avatar}" class="player-img-large">
                    <h3>${room.opponent.name}</h3>
                    ${isPlayingWithAI ? '<span class="badge-ai">🤖 AI</span>' : ''}
                ` : `
                    <div class="waiting-player">
                        <div class="spinner"></div>
                        <p>Miandry mpifanandrina...</p>
                        ${isCreator ? `<button onclick="playWithAI('${roomId}')" class="btn-ai">🤖 Milalao miaraka amin'ny AI</button>` : ''}
                    </div>
                `}
            </div>
        </div>
        <div class="lobby-actions">
            ${isCreator ? `
                ${isFull ? `<button onclick="startGame('${roomId}')" class="btn-primary-large">🎮 Atombohy ny lalao</button>` : ''}
                <button onclick="deleteRoom('${roomId}')" class="btn-cancel">🗑️ Fafao ny efitra</button>
            ` : `
                ${!isFull ? `<button onclick="joinRoom('${roomId}')" class="btn-primary-large">Hiditra amin'ny efitra</button>` : ''}
            `}
        </div>
    `;
}

window.startGame = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    const gameType = snap.data().gameType || "fanorontelo";
    await updateDoc(roomRef, {
        status: "playing",
        board: initBoard(gameType),
        turn: getUserId()
    });
};

window.leaveRoomLobby = () => {
    if (unsubscribeRoomLobby) unsubscribeRoomLobby();
    document.getElementById("room-lobby-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");
    currentRoomId = null;
};

window.joinRoom = async (id) => {
    const uid = getUserId();
    if (!uid) return alert("Tsy tafiditra ianao");

    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const r = roomSnap.data();
    if (r.opponent?.id) return alert("Efa feno ity efitra ity");

    await updateDoc(roomRef, {
        opponent: {
            id: uid,
            name: document.getElementById("user-name").innerText,
            avatar: document.getElementById("user-avatar").src
        }
    });
};

window.playWithAI = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    const gameType = snap.data().gameType || "fanorontelo";
    await updateDoc(roomRef, {
        opponent: {
            id: 'AI_BOT',
            name: 'NOLIMITE AI',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=NoLimiteAI'
        },
        status: "playing",
        board: initBoard(gameType),
        turn: getUserId()
    });
    playSound('invite');
};

// ================= PROFILE =================
window.openEditModal = () => {
    document.getElementById("edit-name").value = document.getElementById("user-name").innerText;
    document.getElementById("edit-avatar").value = document.getElementById("user-avatar").src;
    document.getElementById("modal-edit-profile").classList.remove("hidden");
};

window.closeEditModal = () => {
    document.getElementById("modal-edit-profile").classList.add("hidden");
};

document.getElementById("btn-save-profile").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;
    let newName = document.getElementById("edit-name").value.trim();
    const newAvatar = document.getElementById("edit-avatar").value.trim();

    if (newName.length === 0 || newName.length > 8) {
        alert("Anarana 1 hatramin'ny 8 litera ihany azafady!");
        return;
    }

    await updateDoc(doc(db, "users", uid), {
        name: newName,
        avatar: newAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + uid
    });
    document.getElementById("user-name").innerText = newName;
    document.getElementById("user-avatar").src = newAvatar;
    closeEditModal();
};

// ================= GAME =================
window.enterGame = async (id) => {
    unsubscribeAll();
    currentRoomId = id;
    let gameEnded = false;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("room-lobby-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    initChat(id);

    const roomRef = doc(db, "rooms", id);
    unsubscribeRoom = onSnapshot(roomRef, async (snap) => {
        const game = snap.data();
        if (!game) return;
        render(game);

        if (turnTimerInterval) clearInterval(turnTimerInterval);

        if (game.status === 'playing') {
            const timerEl = document.getElementById("turn-timer");
            if (timerEl) {
                let timeLeft = 30;
                timerEl.innerText = `⏱️ ${timeLeft}s`;
                turnTimerInterval = setInterval(async () => {
                    timeLeft--;
                    timerEl.innerText = `⏱️ ${timeLeft}s`;
                    if (timeLeft <= 0) {
                        clearInterval(turnTimerInterval);
                        if (game.turn === getUserId()) {
                            const nextTurn = game.turn === game.creator.id ? game.opponent.id : game.creator.id;
                            await updateDoc(roomRef, { turn: nextTurn });
                        }
                    }
                }, 1000);
            }

            if (game.turn === 'AI_BOT' && !isAiThinking) {
                isAiThinking = true;
                await aiMove(game);
                isAiThinking = false;
            }

            const winner = checkWinnerFanorona(game.board, game.creator.id, game.opponent.id, game.gameType);
            if (winner) {
                clearInterval(turnTimerInterval);
                await updateDoc(roomRef, { status: 'finished', winner: winner });
            }
        }

        if (game.status === 'finished' && game.winner && !gameEnded) {
            gameEnded = true;

            const winnerId = game.winner;
            const loserId = winnerId === game.creator.id
                ? game.opponent.id
                : game.creator.id;

            const winnerName = winnerId === game.creator.id
                ? game.creator.name
                : game.opponent.name;

            const loserName = loserId === game.creator.id
                ? game.creator.name
                : game.opponent.name;

            await updateLeaderboard(winnerId, winnerName, loserId, loserName);

            setTimeout(() => {
                playSound('win');
                alert(`🎉 ${winnerName} no nandresy!`);
                leaveGame();
            }, 500);
        }
    });
};

function render(game) {
    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";
    const gridSize = game.gameType === "fanorontsivy" ? "grid-5x5" : "grid-3x3";
    grid.className = `fanorona-grid ${gridSize}`;

    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot" + (selectedCell?.id === cell.id ? " active-spot" : "");

        if (cell.value) {
            const stone = document.createElement("div");
            stone.className = `stone ${cell.value === 1 ? 'black-stone' : 'white-stone'} animate-pop`;
            div.appendChild(stone);
        }

        div.addEventListener('click', () => {
            playSound('click');
            handleMove(cell, game);
        });
        div.addEventListener('touchend', (e) => {
            e.preventDefault();
            playSound('click');
            handleMove(cell, game);
        });

        grid.appendChild(div);
    });

    const turnEl = document.getElementById("turn-indicator");
    if (turnEl) {
        const isMyTurn = game.turn === getUserId();
        turnEl.innerText = isMyTurn ? "Anjaranao!" : "Anjaran'ny mpifanandrina";
        turnEl.className = isMyTurn ? "my-turn" : "opp-turn";
    }
}

async function handleMove(cell, game) {
    const uid = getUserId();
    if (game.turn !== uid) return;

    const myVal = game.creator.id === uid ? 1 : 2;
    let b = [...game.board];

    if (!selectedCell) {
        if (cell.value === myVal) {
            selectedCell = cell;
            render(game);
        }
    } else {
        const dx = Math.abs(cell.x - selectedCell.x);
        const dy = Math.abs(cell.y - selectedCell.y);

        if (cell.value === 0 && dx <= 1 && dy <= 1) {
            const captures = getCaptures(b, selectedCell, cell, myVal, game.gameType);
            b[selectedCell.id].value = 0;
            b[cell.id].value = myVal;

            if (captures.length > 0) {
                playSound('capture');
                captures.forEach(id => {
                    b[id].value = 0;
                });
            }

            selectedCell = null;
            await finalizeTurn(b, game);
        } else {
            selectedCell = (cell.value === myVal) ? cell : null;
            render(game);
        }
    }
}

async function finalizeTurn(b, game) {
    const winner = checkWinnerFanorona(b, game.creator.id, game.opponent.id, game.gameType);
    const nextTurn = game.turn === game.creator.id ? game.opponent.id : game.creator.id;

    await updateDoc(doc(db, "rooms", currentRoomId), {
        board: b,
        turn: winner ? "end" : nextTurn,
        winner: winner
    });
}

window.leaveGame = async () => {
    unsubscribeAll();
    if (currentRoomId) {
        await deleteDoc(doc(db, "rooms", currentRoomId));
    }
    currentRoomId = null;
    selectedCell = null;
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");
};

// ================= CHAT =================
function initChat(roomId) {
    if (unsubscribeChat) unsubscribeChat();

    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send");

    chatMessages.innerHTML = "";

    const q = query(collection(db, "rooms", roomId, "chat"), orderBy("timestamp", "asc"));
    unsubscribeChat = onSnapshot(q, (snap) => {
        chatMessages.innerHTML = "";
        snap.forEach(d => {
            const msg = d.data();
            const isMe = msg.senderId === getUserId();
            const div = document.createElement("div");
            div.className = isMe ? "chat-me" : "chat-opp";
            div.innerText = `${msg.senderName}: ${msg.text}`;
            chatMessages.appendChild(div);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    chatSend.onclick = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        await addDoc(collection(db, "rooms", roomId, "chat"), {
            senderId: getUserId(),
            senderName: document.getElementById("user-name").innerText,
            text: text,
            timestamp: serverTimestamp()
        });
        chatInput.value = "";
    };

    chatInput.onkeypress = (e) => {
        if (e.key === "Enter") chatSend.click();
    };
}

// ================= QUICK PLAY =================
document.getElementById("btn-quick-play").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;

    const q = query(collection(db, "rooms"), where("status", "==", "waiting"), limit(10));
    const snap = await getDocs(q);
    let foundRoom = null;

    snap.forEach(d => {
        const r = d.data();
        if (r.creator.id !== uid && r.type !== "private") {
            foundRoom = d.id;
        }
    });
    if (foundRoom) {
        viewRoom(foundRoom);
    } else {
        const autoId = "QUICK_" + Math.floor(Math.random() * 10000);
        await setDoc(doc(db, "rooms", autoId), {
            creator: {
                id: uid,
                name: document.getElementById("user-name").innerText,
                avatar: document.getElementById("user-avatar").src
            },
            status: "waiting",
            type: "public",
            gameType: "fanorontelo",
            createdAt: serverTimestamp()
        });
        autoDeleteRoom(autoId);
        viewRoom(autoId);
    }
};

// ================= ROOM CREATION =================
document.getElementById("btn-confirm-create").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;

    const name = document.getElementById("room-uid-input").value || "ROOM_" + Math.floor(Math.random() * 10000);
    const type = document.getElementById("room-type").value;
    const pass = document.getElementById("room-password").value;
    const gameType = document.getElementById("game-type").value;

    await setDoc(doc(db, "rooms", name), {
        creator: {
            id: uid,
            name: document.getElementById("user-name").innerText,
            avatar: document.getElementById("user-avatar").src
        },
        status: "waiting",
        type: type,
        gameType: gameType,
        password: pass,
        createdAt: serverTimestamp()
    });

    autoDeleteRoom(name);
    document.getElementById("modal-create").classList.add("hidden");
    viewRoom(name);
};

// ================= LOGOUT =================
document.getElementById("btn-logout").onclick = async () => {
    if (confirm("Hivoaka ve ianao?")) {
        unsubscribeAll();
        const uid = getUserId();
        if (uid) {
            await updateDoc(doc(db, "users", uid), { status: "offline" });
        }
        await auth.signOut();
        localStorage.removeItem("nolimite_guest_uid");
        localStorage.removeItem("nolimite_guest_name");
        location.reload();
    }
};

// ================= EXIT BUTTON LALAO =================
document.addEventListener('click', (e) => {
    if (e.target.matches('#game-screen .btn-exit')) {
        if (confirm("Hiala amin'ny lalao ve ianao?")) {
            leaveGame();
        }
    }
});

// ================= LEADERBOARD =================
async function updateLeaderboard(winnerId, winnerName, loserId, loserName) {
    // WINNER
    const { data: winData } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("player_id", winnerId)
        .single();

    if (winData) {
        await supabase
            .from("leaderboard")
            .update({ wins: winData.wins + 1 })
            .eq("player_id", winnerId);
    } else {
        await supabase.from("leaderboard").insert([{
            player_id: winnerId,
            player_name: winnerName,
            wins: 1,
            losses: 0
        }]);
    }

    // LOSER
    const { data: loseData } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("player_id", loserId)
        .single();

    if (loseData) {
        await supabase
            .from("leaderboard")
            .update({ losses: loseData.losses + 1 })
            .eq("player_id", loserId);
    } else {
        await supabase.from("leaderboard").insert([{
            player_id: loserId,
            player_name: loserName,
            wins: 0,
            losses: 1
        }]);
    }
}

async function loadLeaderboard() {
    const { data } = await supabase
        .from("leaderboard")
        .select("*")
        .order("wins", { ascending: false })
        .limit(10);

    const container = document.getElementById("leaderboard");
    if (!container) return;
    
    container.innerHTML = "<h3>🏆 Leaderboard</h3>";
    data.forEach((player, index) => {
        container.innerHTML += `
            <div class="leaderboard-row">
                ${index + 1}. ${player.player_name} - 
                🟢 ${player.wins} | 🔴 ${player.losses}
            </div>
        `;
    });
}

// Antsoy rehefa vita load ny lobby
document.addEventListener('DOMContentLoaded', () => {
    loadLeaderboard();
});
