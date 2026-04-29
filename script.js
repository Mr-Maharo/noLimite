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

// ================= AUTH & USER STATE =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
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

        document.getElementById("user-name").innerText = finalName;
        document.getElementById("user-avatar").src = finalAvatar;

        await setDoc(userRef, {
            uid: user.uid,
            name: finalName,
            avatar: finalAvatar,
            status: "online",
            lastSeen: serverTimestamp()
        }, { merge: true });

        initLobby();
        initPlayerList();
        initInvites(user.uid);
    } else {
        document.getElementById("login-screen").classList.remove("hidden");
        document.getElementById("lobby-screen").classList.add("hidden");
    }
});

window.addEventListener("beforeunload", async () => {
    if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), { status: "offline" });
    }
});

// ================= BUTTONS & MODALS =================
document.getElementById("btn-google").onclick = () => signInWithPopup(auth, provider);
document.getElementById("btn-create-room").onclick = () => document.getElementById("modal-create").classList.remove("hidden");

document.getElementById("room-type").onchange = function () {
    document.getElementById("room-password").style.display = this.value === "private" ? "block" : "none";
};

// ================= AUTO-DELETE LOGIC =================
// Hamafa ny room raha tsy misy miditra ao anatin'ny 5 minitra
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
        await deleteDoc(doc(db, "rooms", roomId));
    }
};

// ================= INVITE SYSTEM =================
window.sendInvite = async (targetUid) => {
    if (!auth.currentUser) return;
    const myName = document.getElementById("user-name").innerText;
    await addDoc(collection(db, "invites"), {
        from: auth.currentUser.uid,
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
            <button class="btn-save" onclick="acceptInvite('${inviteId}', '${invite.from}', '${invite.fromName}')">Ekena</button>
            <button class="btn-cancel" onclick="rejectInvite('${inviteId}')">Tsia</button>
        </div>
    `;
    container.appendChild(box);
}

window.acceptInvite = async (inviteId, senderUid, senderName) => {
    document.getElementById("invite-" + inviteId)?.remove();
    const roomId = "INVITE_" + Math.floor(Math.random() * 10000);
    const myName = document.getElementById("user-name").innerText;
    const myAvatar = document.getElementById("user-avatar").src;

    await setDoc(doc(db, "rooms", roomId), {
        creator: { id: senderUid, name: senderName, avatar: "" },
        opponent: { id: auth.currentUser.uid, name: myName, avatar: myAvatar },
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

// ================= LOBBY & PLAYERS (2 COLUMNS) =================
async function initPlayerList() {
    const q = query(collection(db, "users"), where("status", "==", "online"), limit(20));
    onSnapshot(q, (snapshot) => {
        const listSidebar = document.getElementById("online-players");
        const listMain = document.getElementById("players-list-dynamic");
        listSidebar.innerHTML = ""; listMain.innerHTML = "";

        snapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.uid !== auth.currentUser.uid) {
                const html = `
                    <div class="player-item">
                        <img src="${userData.avatar}" class="player-avatar-mini">
                        <div class="player-info">
                            <span class="player-name-mini">${userData.name}</span>
                            <div class="status-indicator"><span class="dot-online"></span> Online</div>
                        </div>
                        <button class="btn-invite-mini" onclick="sendInvite('${userData.uid}')">Hantsy</button>
                    </div>`;
                listSidebar.innerHTML += html;
                listMain.innerHTML += html;
            }
        });
    });
}

function initLobby() {
    onSnapshot(collection(db, "rooms"), (snap) => {
        const publicList = document.getElementById("rooms-list-dynamic"); // Colone 1
        const myRoomsList = document.getElementById("my-rooms-list"); // Colone 2 (Mila ampidirina ao anaty HTML ity id ity)
        
        if (publicList) publicList.innerHTML = "";
        if (myRoomsList) myRoomsList.innerHTML = "";

        snap.forEach(d => {
            const r = d.data();
            const roomId = d.id;
            if (r.status === "waiting") {
                const isPrivate = r.type === "private" ? "🔒" : "🌐";
                const playerBadge = `<span class="badge-waiting">● 1/2 miandry</span>`;

                if (r.creator.id === auth.currentUser.uid) {
                    if (myRoomsList) {
                        myRoomsList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>🏠 ${roomId}</span>
                                <div class="room-actions">
                                    <button onclick="sendInviteModal('${roomId}')">📧 Hantsy</button>
                                    <button class="btn-cancel" style="padding:5px" onclick="deleteRoom('${roomId}')">🗑️</button>
                                </div>
                            </div>`;
                    }
                } else if (r.type !== "private") {
                    if (publicList) {
                        publicList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>${isPrivate} ${roomId}</span>
                                ${playerBadge}
                                <button onclick="joinRoom('${roomId}')">Hiditra</button>
                            </div>`;
                    }
                }
            }
        });
    });
}

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
    const user = auth.currentUser;
    if (!user) return;
    let newName = document.getElementById("edit-name").value.trim();
    const newAvatar = document.getElementById("edit-avatar").value.trim();

    if (newName.length === 0 || newName.length > 8) {
        alert("Anarana 1 hatramin'ny 8 litera ihany azafady!");
        return;
    }

    try {
        await updateDoc(doc(db, "users", user.uid), {
            name: newName,
            avatar: newAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.uid
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
    let b = [];
    for (let i = 0; i < 9; i++) {
        b.push({ id: i, x: i % 3, y: Math.floor(i / 3), value: 0 });
    }
    return b;
}

window.joinRoom = async (id) => {
    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const r = roomSnap.data();

    if (r.type === "private" && prompt("Teny miafina:") !== r.password) return alert("Diso!");

    await updateDoc(roomRef, {
        opponent: { id: auth.currentUser.uid, name: document.getElementById("user-name").innerText, avatar: document.getElementById("user-avatar").src },
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
        if (game.turn === "bot_id" && !game.winner) setTimeout(() => executeBotMove(game), 1000);
        if (game.winner) { alert("🏆 Mpandresy: " + game.winner); location.reload(); }
    });
}

function render(game) {
    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";
    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot" + (selectedCell?.id === cell.id ? " active-spot" : "");
        if (cell.value) {
            const stone = document.createElement("div");
            stone.className = `stone ${cell.value === 1 ? 'black-stone' : 'white-stone'}`;
            div.appendChild(stone);
        }
        div.onclick = () => handleMove(cell, game);
        grid.appendChild(div);
    });
}

async function handleMove(cell, game) {
    if (game.turn !== auth.currentUser.uid) return;
    const myVal = game.creator.id === auth.currentUser.uid ? 1 : 2;
    let b = [...game.board];
    const myStones = b.filter(c => c.value === myVal).length;

    // 1. DINGANA FAMETRAHANA (Placement Phase) - hatramin'ny 3 vato
    if (myStones < 3) {
        if (cell.value === 0) { 
            b[cell.id].value = myVal; 
            finalizeTurn(b, game); 
        }
    } 
    // 2. DINGANA FIFINDRANA (Movement Phase)
    else {
        if (!selectedCell) {
            // Mifidy ny vato hifindra
            if (cell.value === myVal) { 
                selectedCell = cell; 
                render(game); 
            }
        } else {
            // Ny "Fanorona telo" dia afaka mifindra amin'ny teboka rehetra mifanila (8 directions)
            const dx = Math.abs(cell.x - selectedCell.x);
            const dy = Math.abs(cell.y - selectedCell.y);
            
            // Raha banga ilay teboka ary eo akaiky (distansy 1)
            if (cell.value === 0 && dx <= 1 && dy <= 1) {
                b[selectedCell.id].value = 0; // miala eo amin'ny toerana taloha
                b[cell.id].value = myVal;      // mifindra amin'ny vaovao
                selectedCell = null; 
                finalizeTurn(b, game);
            } else {
                // Raha hifidy vato hafa indray
                selectedCell = null; 
                render(game); 
            }
        }
    }
}

function finalizeTurn(b, game) {
    const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let winner = null;
    const myVal = game.creator.id === auth.currentUser.uid ? 1 : 2;
    for (let p of winPatterns) {
        if (b[p[0]].value === myVal && b[p[1]].value === myVal && b[p[2]].value === myVal) {
            winner = document.getElementById("user-name").innerText;
        }
    }
    const nextTurn = game.turn === game.creator.id ? (game.opponent?.id || game.creator.id) : game.creator.id;
    updateDoc(doc(db, "rooms", currentRoomId), { board: b, turn: winner ? "end" : nextTurn, winner: winner });
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
    const q = query(collection(db, "rooms"), where("status", "==", "waiting"), limit(5));
    const snap = await getDocs(q);
    let target = null;
    snap.forEach(d => { if (d.data().creator.id !== auth.currentUser.uid) target = d.id; });
    
    if (target) joinRoom(target);
    else {
        const botId = "BOT_" + Date.now();
        await setDoc(doc(db, "rooms", botId), {
            creator: { id: auth.currentUser.uid, name: document.getElementById("user-name").innerText, avatar: "" },
            opponent: { id: "bot_id", name: "Bot NoLimite", avatar: "" },
            status: "playing", board: initBoard(), turn: auth.currentUser.uid, createdAt: serverTimestamp()
        });
        enterGame(botId);
    }
};

// ================= ROOM CREATION =================
document.getElementById("btn-confirm-create").onclick = async () => {
    const name = document.getElementById("room-uid-input").value || "ROOM_" + Math.floor(Math.random()*1000);
    const type = document.getElementById("room-type").value;
    const pass = document.getElementById("room-password").value;
    
    await setDoc(doc(db, "rooms", name), {
        creator: { id: auth.currentUser.uid, name: document.getElementById("user-name").innerText, avatar: "" },
        status: "waiting", type: type, password: pass, createdAt: serverTimestamp()
    });

    autoDeleteRoom(name); // Alefa ny timer famafana ho azy
    document.getElementById("modal-create").classList.add("hidden");
};
