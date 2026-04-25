import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, addDoc, query, orderBy, limit } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ================= CONFIG & INIT =================
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

// ================= AUTH & PRESENCE =================
onAuthStateChanged(auth, async (user) => {
    const loginScr = document.getElementById('login-screen');
    const lobbyScr = document.getElementById('lobby-screen');

    if (user) {
        loginScr.classList.add('hidden');
        lobbyScr.classList.remove('hidden');
        
        // Update Profile UI
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;

        // Save User to Firestore (Presence)
        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: user.displayName,
            avatar: user.photoURL,
            status: "online",
            lastSeen: serverTimestamp()
        }, { merge: true });

        initLobby();
        initPlayerList();
        initInvites(user.uid);
    } else {
        loginScr.classList.remove('hidden');
        lobbyScr.classList.add('hidden');
    }
});

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, provider);

// ================= LOBBY & PLAYERS =================
function initLobby() {
    onSnapshot(collection(db, "rooms"), (snap) => {
        const div = document.getElementById("rooms-list-dynamic");
        div.innerHTML = "";
        snap.forEach(d => {
            const room = d.data();
            if (room.status === "end") return;
            const el = document.createElement("div");
            el.className = "room-card glass animate-pop";
            el.innerHTML = `<span>🏠 ${d.id}</span> <button onclick="joinRoom('${d.id}')">Hiditra</button>`;
            div.appendChild(el);
        });
    });
}

function initPlayerList() {
    onSnapshot(collection(db, "users"), (snap) => {
        const playerDiv = document.getElementById("players-list-dynamic");
        playerDiv.innerHTML = "";
        snap.forEach(docSnap => {
            const p = docSnap.data();
            if (p.uid === auth.currentUser.uid) return;
            const el = document.createElement("div");
            el.className = "player-item glass animate-pop";
            el.innerHTML = `
                <div class="player-avatar-wrap">
                    <img src="${p.avatar}" class="player-img">
                    <span class="status-dot online"></span>
                </div>
                <div class="player-info">
                    <span class="player-name">${p.name}</span>
                    <span class="player-uid">#${p.uid.substring(0,6)}</span>
                </div>
            `;
            el.onclick = () => window.sendInvite(p.uid, p.name);
            playerDiv.appendChild(el);
        });
    });
}

// ================= INVITE SYSTEM =================
window.sendInvite = async (id, name) => {
    await addDoc(collection(db, "invites"), {
        from: auth.currentUser.uid,
        fromName: auth.currentUser.displayName,
        to: id,
        toName: name,
        status: "pending",
        createdAt: Date.now()
    });
    alert("Fanasana nalefa ho an'i " + name);
};

function initInvites(uid) {
    onSnapshot(collection(db, "invites"), (snap) => {
        snap.forEach(docSnap => {
            const i = docSnap.data();
            if (i.to === uid && i.status === "pending") {
                showInviteUI(docSnap.id, i);
            }
        });
    });
}

function showInviteUI(id, invite) {
    if (document.getElementById("invite-" + id)) return;
    const box = document.createElement("div");
    box.id = "invite-" + id;
    box.className = "invite-popup glass animate-pop";
    box.innerHTML = `<p>🎮 <b>${invite.fromName}</b> manasa anao</p>
                     <button class="btn-accept">Ekena</button>`;
    document.body.appendChild(box);
    box.querySelector('.btn-accept').onclick = () => acceptInvite(id, invite);
    setTimeout(() => box.remove(), 15000);
}

async function acceptInvite(id, i) {
    const roomId = "ROOM_" + Math.floor(Math.random() * 10000);
    await setDoc(doc(db, "rooms", roomId), {
        creator: { id: i.from, name: i.fromName },
        opponent: { id: i.to, name: i.toName },
        turn: i.from,
        status: "playing",
        board: initBoard()
    });
    await updateDoc(doc(db, "invites", id), { status: "accepted" });
    document.getElementById("invite-" + id)?.remove();
    enterGame(roomId);
}

// ================= GAME ENGINE =================
window.joinRoom = async (id) => {
    await updateDoc(doc(db, "rooms", id), {
        opponent: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
        status: "playing"
    });
    enterGame(id);
};

function enterGame(id) {
    currentRoomId = id;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initChat(id);

    onSnapshot(doc(db, "rooms", id), (snap) => {
        const game = snap.data();
        if (game) {
            render(game);
            if (game.winner) { alert("🏆 Mpandresy: " + game.winner); location.reload(); }
        }
    });
}

function initBoard() {
    let b = [];
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 9; x++) {
            b.push({ x, y, value: y < 2 ? 1 : (y > 2 ? 2 : 0) });
        }
    }
    b.find(c => c.x === 4 && c.y === 2).value = 0; // Foana ny afovoany
    return b;
}

function render(game) {
    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";
    const isMyTurn = game.turn === auth.currentUser.uid;
    grid.className = isMyTurn ? "my-turn" : "";

    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot";
        if (selectedCell?.x === cell.x && selectedCell?.y === cell.y) div.classList.add("active-spot");
        
        if (cell.value) {
            const s = document.createElement("div");
            s.className = `stone ${cell.value === 1 ? 'black-stone' : 'white-stone'}`;
            div.appendChild(s);
        }
        div.onclick = () => handleMove(cell, game);
        grid.appendChild(div);
    });
}

async function handleMove(cell, game) {
    if (game.turn !== auth.currentUser.uid) return;
    const myVal = game.creator.id === auth.currentUser.uid ? 1 : 2;
    const enemyVal = myVal === 1 ? 2 : 1;

    if (!selectedCell) {
        if (cell.value === myVal) { selectedCell = cell; render(game); }
        return;
    }

    let dx = cell.x - selectedCell.x, dy = cell.y - selectedCell.y;
    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && cell.value === 0) {
        let b = JSON.parse(JSON.stringify(game.board));
        b.find(c => c.x === selectedCell.x && c.y === selectedCell.y).value = 0;
        b.find(c => c.x === cell.x && c.y === cell.y).value = myVal;

        // Capture Logic
        let ax = cell.x + dx, ay = cell.y + dy;
        while (true) {
            let t = b.find(c => c.x === ax && c.y === ay);
            if (t && t.value === enemyVal) { t.value = 0; ax += dx; ay += dy; } else break;
        }

        const nextTurn = myVal === 1 ? game.opponent.id : game.creator.id;
        const win = b.filter(c => c.value === enemyVal).length === 0 ? auth.currentUser.displayName : null;
        selectedCell = null;
        await updateDoc(doc(db, "rooms", currentRoomId), { board: b, turn: win ? "end" : nextTurn, winner: win });
    } else { selectedCell = null; render(game); }
}

// ================= CHAT MATIHANINA =================
function initChat(roomId) {
    const msgDiv = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-text');

    document.getElementById('send-chat').onclick = async () => {
        const txt = chatInput.value.trim();
        if (!txt) return;
        await addDoc(collection(db, "rooms", roomId, "messages"), {
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL,
            text: txt,
            time: serverTimestamp()
        });
        chatInput.value = "";
    };

    const q = query(collection(db, "rooms", roomId, "messages"), orderBy("time", "asc"));
    onSnapshot(q, (snap) => {
        msgDiv.innerHTML = "";
        snap.forEach(m => {
            const d = m.data();
            const isMe = d.uid === auth.currentUser.uid;
            msgDiv.innerHTML += `
                <div class="chat-bubble ${isMe ? 'me' : 'them'} animate-pop">
                    <div class="bubble-content">
                        <p>${d.text}</p>
                    </div>
                </div>`;
        });
        msgDiv.scrollTop = msgDiv.scrollHeight;
    });
}
