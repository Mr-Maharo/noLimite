import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, updateDoc, onSnapshot, serverTimestamp, addDoc, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

// ================= GLOBAL FUNCTIONS =================
window.joinRoom = async (id) => {
    await updateDoc(doc(db, "rooms", id), {
        opponent: { id: auth.currentUser.uid, name: auth.currentUser.displayName, avatar: auth.currentUser.photoURL },
        status: "playing"
    });
    enterGame(id);
};

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

window.acceptInvite = async (id, i) => {
    const roomId = "GAME_" + Math.floor(Math.random() * 10000);
    await setDoc(doc(db, "rooms", roomId), {
        creator: { id: i.from, name: i.fromName },
        opponent: { id: i.to, name: i.toName },
        turn: i.from,
        status: "playing",
        board: initBoard(),
        winner: null
    });
    await updateDoc(doc(db, "invites", id), { status: "accepted" });
    document.getElementById("invite-" + id)?.remove();
    enterGame(roomId);
};

// ================= AUTH & PRESENCE =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        document.getElementById('user-name').innerText = user.displayName;
        document.getElementById('user-avatar').src = user.photoURL;

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
        document.getElementById('login-screen').classList.remove('hidden');
    }
});

document.getElementById('btn-google').onclick = () => signInWithPopup(auth, provider);
document.getElementById('btn-create-room').onclick = () => document.getElementById('modal-create').classList.remove('hidden');

document.getElementById('btn-confirm-create').onclick = async () => {
    const roomName = document.getElementById('room-uid-input').value || "Lalao";
    const roomId = roomName.replace(/\s+/g, '_') + "_" + Math.floor(Math.random() * 1000);
    await setDoc(doc(db, "rooms", roomId), {
        creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
        status: "waiting",
        turn: auth.currentUser.uid,
        board: initBoard(),
        winner: null
    });
    document.getElementById('modal-create').classList.add('hidden');
    enterGame(roomId);
};

// ================= LOBBY & PLAYERS =================
function initLobby() {
    onSnapshot(collection(db, "rooms"), (snap) => {
        const div = document.getElementById("rooms-list-dynamic");
        div.innerHTML = "";
        snap.forEach(d => {
            const r = d.data();
            if (r.status === "waiting") {
                div.innerHTML += `<div class="room-card glass animate-pop">
                    <span>🏠 ${d.id}</span>
                    <button onclick="joinRoom('${d.id}')">Hiditra</button>
                </div>`;
            }
        });
    });
}

function initPlayerList() {
    onSnapshot(collection(db, "users"), (snap) => {
        const div = document.getElementById("players-list-dynamic");
        div.innerHTML = "";
        snap.forEach(docSnap => {
            const p = docSnap.data();
            if (!p.uid || p.uid === auth.currentUser.uid) return;
            div.innerHTML += `
                <div class="player-item glass animate-pop" onclick="sendInvite('${p.uid}', '${p.name}')">
                    <img src="${p.avatar}" class="player-img">
                    <div class="player-info">
                        <span class="player-name">${p.name}</span>
                        <span class="player-uid">#${p.uid.substring(0,6)}</span>
                    </div>
                </div>`;
        });
    });
}

function initInvites(uid) {
    onSnapshot(collection(db, "invites"), (snap) => {
        snap.forEach(d => {
            const i = d.data();
            if (i.to === uid && i.status === "pending") showInviteUI(d.id, i);
        });
    });
}

function showInviteUI(id, invite) {
    if (document.getElementById("invite-" + id)) return;
    const box = document.createElement("div");
    box.id = "invite-" + id;
    box.className = "invite-popup glass animate-pop";
    box.innerHTML = `<p>🎮 <b>${invite.fromName}</b> manasa anao</p>
                     <button onclick='acceptInvite("${id}", ${JSON.stringify(invite).replace(/"/g, '&quot;')})'>Ekena</button>`;
    document.body.appendChild(box);
}

// ================= GAME LOGIC (FANORONA TELO) =================
function initBoard() {
    let b = [];
    for (let i = 0; i < 9; i++) b.push({ id: i, x: i % 3, y: Math.floor(i / 3), value: 0 });
    return b;
}

function enterGame(id) {
    currentRoomId = id;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    initChat(id);

    onSnapshot(doc(db, "rooms", id), (snap) => {
        const game = snap.data();
        if (game) {
            render(game);
            if (game.winner) {
                alert("🏆 Mpandresy: " + game.winner);
                location.reload();
            }
        }
    });
}

function render(game) {
    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3, 100px)";
    
    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot";
        if (selectedCell?.id === cell.id) div.classList.add("active-spot");
        
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
    const myVal = (game.creator.id === auth.currentUser.uid) ? 1 : 2;
    let b = [...game.board];
    const myStones = b.filter(c => c.value === myVal).length;

    // Phase 1: Fametrahana (latsaky ny 3 vato)
    if (myStones < 3) {
        if (cell.value === 0) {
            b[cell.id].value = myVal;
            checkAndFinish(b, game);
        }
    } 
    // Phase 2: Fifindra (efa misy 3 vato)
    else {
        if (!selectedCell) {
            if (cell.value === myVal) { selectedCell = cell; render(game); }
        } else {
            const dx = Math.abs(cell.x - selectedCell.x);
            const dy = Math.abs(cell.y - selectedCell.y);
            if (cell.value === 0 && dx <= 1 && dy <= 1) {
                b[selectedCell.id].value = 0;
                b[cell.id].value = myVal;
                selectedCell = null;
                checkAndFinish(b, game);
            } else { selectedCell = null; render(game); }
        }
    }
}

function checkAndFinish(newBoard, game) {
    const winPatterns = [
        [0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]
    ];
    let winner = null;
    for (let p of winPatterns) {
        if (newBoard[p[0]].value !== 0 && 
            newBoard[p[0]].value === newBoard[p[1]].value && 
            newBoard[p[0]].value === newBoard[p[2]].value) {
            winner = auth.currentUser.displayName;
            break;
        }
    }
    const nextTurn = game.turn === game.creator.id ? (game.opponent?.id || game.creator.id) : game.creator.id;
    updateDoc(doc(db, "rooms", currentRoomId), {
        board: newBoard,
        turn: winner ? "end" : nextTurn,
        winner: winner
    });
}

// ================= CHAT =================
function initChat(roomId) {
    const msgDiv = document.getElementById('chat-messages');
    document.getElementById('send-chat').onclick = async () => {
        const txt = document.getElementById('chat-text').value;
        if (!txt) return;
        await addDoc(collection(db, "rooms", roomId, "messages"), {
            uid: auth.currentUser.uid, text: txt, time: serverTimestamp()
        });
        document.getElementById('chat-text').value = "";
    };

    onSnapshot(query(collection(db, "rooms", roomId, "messages"), orderBy("time", "asc")), (snap) => {
        msgDiv.innerHTML = "";
        snap.forEach(m => {
            const d = m.data();
            msgDiv.innerHTML += `<div class="chat-bubble ${d.uid === auth.currentUser.uid ? 'me' : 'them'}">
                <p>${d.text}</p>
            </div>`;
        });
        msgDiv.scrollTop = msgDiv.scrollHeight;
    });
}
