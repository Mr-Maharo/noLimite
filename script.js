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

// ================= CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    projectId: "nolimite-29e0b",
    databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentRoomId = null;
let selectedCell = null;
let myCurrentUid = null;

// ================= HELPER =================
function getUserId() {
    return myCurrentUid || auth.currentUser?.uid || null;
}

// ================= LOGIN GUEST =================
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

    try {
        await setDoc(doc(db, "users", guestUid), guestData, { merge: true });
        setupGuestUI(guestData);
    } catch (e) {
        console.error("Login Guest Error: ", e);
    }
};

function setupGuestUI(user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");

    document.getElementById("user-name").innerText = user.name;
    document.getElementById("user-avatar").src = user.avatar;

    initLobby();
    initPlayerList();
    initInvites(user.uid);
}

// ================= AUTH & USER STATE =================
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

window.addEventListener("beforeunload", async () => {
    const uid = getUserId();
    if (uid) {
        await updateDoc(doc(db, "users", uid), { status: "offline" });
    }
});

// ================= BUTTONS & MODALS =================
document.getElementById("btn-google").onclick = () => signInWithPopup(auth, provider);
document.getElementById("btn-create-room").onclick = () => document.getElementById("modal-create").classList.remove("hidden");

document.getElementById("room-type").onchange = function () {
    document.getElementById("room-password").style.display = this.value === "private"? "block" : "none";
};

// ================= AUTO-DELETE LOGIC =================
async function autoDeleteRoom(roomId) {
    setTimeout(async () => {
        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);
        if (snap.exists() && snap.data().status === "waiting") {
            await deleteDoc(roomRef);
            console.log("Room deleted due to inactivity: " + roomId);
        }
    }, 5 * 60 * 1000);
}

window.deleteRoom = async (roomId) => {
    if (confirm("Tena hovafanao ve ity efitra ity?")) {
        try {
            await deleteDoc(doc(db, "rooms", roomId));
        } catch (e) {
            console.error("Error deleting room:", e);
        }
    }
};

// ================= INVITE SYSTEM =================
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
            <button class="btn-save" onclick="acceptInvite('${inviteId}', '${invite.fromName}')">Ekena</button>
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
        turn: senderUid,
        board: initBoard(),
        createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "invites", inviteId), { status: "accepted" });
    enterGame(roomId);
};

window.rejectInvite = async (inviteId) => {
    document.getElementById("invite-" + inviteId)?.remove();
    await updateDoc(doc(db, "invites", inviteId), { status: "rejected" });
};

// ================= LOBBY & PLAYERS =================
async function initPlayerList() {
    const q = query(collection(db, "users"), where("status", "==", "online"), limit(20));
    onSnapshot(q, (snapshot) => {
        const listSidebar = document.getElementById("online-players");
        const listMain = document.getElementById("players-list-dynamic");
        if (listSidebar) listSidebar.innerHTML = "";
        if (listMain) listMain.innerHTML = "";

        snapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.uid!== getUserId()) {
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
    onSnapshot(collection(db, "rooms"), (snap) => {
        const publicList = document.getElementById("rooms-list-dynamic");
        const myRoomsList = document.getElementById("my-rooms-list");

        if (publicList) publicList.innerHTML = "";
        if (myRoomsList) myRoomsList.innerHTML = "";

        snap.forEach(d => {
            const r = d.data();
            const roomId = d.id;
            if (r.status === "waiting") {
                const isPrivate = r.type === "private"? "🔒" : "🌐";
                const playerBadge = `<span class="badge-waiting">● 1/2 miandry</span>`;

                if (r.creator.id === getUserId()) {
                    if (myRoomsList) {
                        myRoomsList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>🏠 ${roomId}</span>
                                <div class="room-actions">
                                    <button class="btn-cancel" onclick="deleteRoom('${roomId}')">🗑️</button>
                                    <button onclick="viewRoom('${roomId}')">Hiditra</button>
                                </div>
                            </div>`;
                    }
                } else if (r.type!== "private") {
                    if (publicList) {
                        publicList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>${isPrivate} ${roomId}</span>
                                ${playerBadge}
                                <button onclick="viewRoom('${roomId}')">Hijery</button>
                            </div>`;
                    }
                }
            }
        });
    });
}
// ================= ROOM LOBBY =================
window.viewRoom = async (id) => {
    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return alert("Tsy misy io efitra io");
    
    const r = roomSnap.data();
    
    // Raha private dia mangataka password
    if (r.type === "private" && r.creator.id !== getUserId()) {
        if (prompt("Teny miafina:") !== r.password) return alert("Diso!");
    }

    currentRoomId = id;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("room-lobby-screen").classList.remove("hidden");
    
    // Listener ny room
    onSnapshot(roomRef, (snap) => {
        const game = snap.data();
        if (!game) return;
        renderRoomLobby(game, id);
        
        // Raha efa 2 ny mpilalao dia miditra automatique
        if (game.status === "playing") {
            enterGame(id);
        }
    });
};

function renderRoomLobby(room, roomId) {
    const lobbyEl = document.getElementById("room-lobby-content");
    const isCreator = room.creator.id === getUserId();
    const isFull = room.opponent?.id;
    const isPlayingWithAI = room.opponent?.id === 'AI_BOT';
    
    lobbyEl.innerHTML = `
        <div class="room-lobby-header">
            <h2>🏠 ${roomId}</h2>
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
    await updateDoc(doc(db, "rooms", roomId), {
        status: "playing",
        board: initBoard(),
        turn: getUserId()
    });
};

window.leaveRoomLobby = () => {
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
    // Tsy mila enterGame eto fa ny onSnapshot no hitantana azy
};
window.playWithAI = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
        opponent: { 
            id: 'AI_BOT', 
            name: 'NOLIMITE AI', 
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=NoLimiteAI'
        },
        status: "playing",
        board: initBoard(),
        turn: getUserId() // Ianao no manomboka foana
    });
    playSound('invite');
};
// ================= PROFILE EDIT =================
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

    try {
        await updateDoc(doc(db, "users", uid), {
            name: newName,
            avatar: newAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + uid
        });
        document.getElementById("user-name").innerText = newName;
        document.getElementById("user-avatar").src = newAvatar;
        closeEditModal();
    } catch (error) {
        alert("Tsy nety ny fanovana.");
    }
};

// ================= GAME LOGIC =================
function initBoard() {
    return [
        { id: 0, x: 0, y: 0, value: 1 }, { id: 1, x: 1, y: 0, value: 1 }, { id: 2, x: 2, y: 0, value: 1 },
        { id: 3, x: 0, y: 1, value: 0 }, { id: 4, x: 1, y: 1, value: 0 }, { id: 5, x: 2, y: 1, value: 0 },
        { id: 6, x: 0, y: 2, value: 2 }, { id: 7, x: 1, y: 2, value: 2 }, { id: 8, x: 2, y: 2, value: 2 }
    ];
}

window.joinRoom = async (id) => {
    const uid = getUserId();
    if (!uid) return alert("Tsy tafiditra ianao");

    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const r = roomSnap.data();

    if (r.type === "private" && prompt("Teny miafina:")!== r.password) return alert("Diso!");

    await updateDoc(roomRef, {
        opponent: { id: uid, name: document.getElementById("user-name").innerText, avatar: document.getElementById("user-avatar").src },
        status: "playing",
        board: initBoard(),
        turn: r.creator.id
    });
    enterGame(id);
};

function enterGame(id) {
    currentRoomId = id;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    initChat(id);

    onSnapshot(doc(db, "rooms", id), (snap) => {
        const game = snap.data();
        if (!game) return;
        render(game);
        if (game.turn === "bot_id" &&!game.winner) setTimeout(() => executeBotMove(game), 1000);
        if (game.winner) { alert("🏆 Mpandresy: " + game.winner); location.reload(); }
    });
}

function render(game) {
    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";
    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot" + (selectedCell?.id === cell.id? " active-spot" : "");
        
        if (cell.value) {
            const stone = document.createElement("div");
            stone.className = `stone ${cell.value === 1? 'black-stone' : 'white-stone'} animate-pop`;
            div.appendChild(stone);
        }

        // ITO NO VAOVAO: soloinao ilay div.onclick taloha
        div.onclick = null; // Fafana aloha
        div.addEventListener('click', () => {
            playSound('click');
            handleMove(cell, game);
        });
        div.addEventListener('touchend', (e) => {
            e.preventDefault(); // Sakana ny click fanindroany
            playSound('click');
            handleMove(cell, game);
        });
        
        grid.appendChild(div);
    });

    // Aseho hoe iza no tour
    const turnEl = document.getElementById("turn-indicator");
    if (turnEl) {
        const isMyTurn = game.turn === getUserId();
        turnEl.innerText = isMyTurn? "Anjaranao!" : "Anjaran'ny fahavalo";
        turnEl.className = isMyTurn? "my-turn" : "opp-turn";
    }
}
async function handleMove(cell, game) {
    const uid = getUserId();
    if (game.turn!== uid) return;

    const myVal = game.creator.id === uid? 1 : 2;
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
            b[selectedCell.id].value = 0;
            b[cell.id].value = myVal;
            selectedCell = null;
            finalizeTurn(b, game);
        } else {
            selectedCell = (cell.value === myVal)? cell : null;
            render(game);
        }
    }
}

function finalizeTurn(b, game) {
    const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let winner = null;
    const uid = getUserId();
    const myVal = game.creator.id === uid? 1 : 2;
    for (let p of winPatterns) {
        if (b[p[0]].value === myVal && b[p[1]].value === myVal && b[p[2]].value === myVal) {
            winner = document.getElementById("user-name").innerText;
        }
    }
    const nextTurn = game.turn === game.creator.id? (game.opponent?.id || game.creator.id) : game.creator.id;
    updateDoc(doc(db, "rooms", currentRoomId), { board: b, turn: winner? "end" : nextTurn, winner: winner });
}

// ================= BOT & CHAT =================
async function executeBotMove(game) {
    let b = [...game.board]; const botVal = 2;
    const empty = b.filter(c => c.value === 0);
    if (empty.length > 0) {
        const target = empty[Math.floor(Math.random() * empty.length)];
        b[target.id].value = botVal;
    }
    updateDoc(doc(db, "rooms", currentRoomId), { board: b, turn: game.creator.id });
}

function initChat(roomId) {}

// ================= QUICK PLAY =================
document.getElementById("btn-quick-play").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;

    const q = query(collection(db, "rooms"), where("status", "==", "waiting"), limit(10));
    const snap = await getDocs(q);
    let foundRoom = null;

    snap.forEach(d => {
        const r = d.data();
        if (r.creator.id!== uid && r.type!== "private") {
            foundRoom = d.id;
        }
    });

    if (foundRoom) {
        joinRoom(foundRoom);
    } else {
        const autoId = "QUICK_" + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, "rooms", autoId), {
            creator: {
                id: uid,
                name: document.getElementById("user-name").innerText,
                avatar: document.getElementById("user-avatar").src
            },
            status: "waiting",
            type: "public",
            createdAt: serverTimestamp()
        });

        autoDeleteRoom(autoId);
        alert("Tsy misy efitra malalaka. Namorona efitra vaovao ho anao izahay, miandrasa kely misy hiditra...");
    }
};

// ================= ROOM CREATION =================
document.getElementById("btn-confirm-create").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;

    const name = document.getElementById("room-uid-input").value || "ROOM_" + Math.floor(Math.random() * 1000);
    const type = document.getElementById("room-type").value;
    const pass = document.getElementById("room-password").value;

    await setDoc(doc(db, "rooms", name), {
        creator: { id: uid, name: document.getElementById("user-name").innerText, avatar: "" },
        status: "waiting", type: type, password: pass, createdAt: serverTimestamp()
    });

    autoDeleteRoom(name);
    document.getElementById("modal-create").classList.add("hidden");
};
