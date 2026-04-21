import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc,
    onSnapshot, serverTimestamp, getDocs, addDoc,
    query, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
const btnOpen = document.getElementById('btn-create-room');

if (btnOpen) {
    btnOpen.onclick = () => {
        console.log("CLICK OK"); // test
        document.getElementById('modal-create').classList.remove('hidden');
    };
}
// ================= CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ================= VARIABLES =================
let currentRoomId = null;
let myRole = null;

let mpilalaoVoafidy = null;
let chatId = null;
let unsubChat = null;

// ================= AUTH =================
onAuthStateChanged(auth, (user) => {
    const login = document.getElementById('login-screen');
    const lobby = document.getElementById('lobby-screen');

    if (user) {
        login.classList.add('hidden');
        lobby.classList.remove('hidden');

        updateUIProfile(user);
        initLobby();
        saveUserStatus(user, true);
    } else {
        login.classList.remove('hidden');
        lobby.classList.add('hidden');
    }
});

// ================= LOGIN =================
document.getElementById('btn-google').onclick = async () => {
    await signInWithPopup(auth, provider);
};

// ================= SAVE USER =================
async function saveUserStatus(user, isOnline) {
    const snapshot = await getDocs(collection(db, "users"));
    let existing = null;

    snapshot.forEach(docu => {
        if (docu.data().email === user.email) existing = docu.id;
    });

    if (existing) {
        await updateDoc(doc(db, "users", existing), {
            online: isOnline,
            lastSeen: serverTimestamp(),
            name: user.displayName,
            avatar: user.photoURL
        });
    } else {
        await setDoc(doc(db, "users", user.uid), {
            name: user.displayName,
            avatar: user.photoURL,
            email: user.email,
            online: isOnline,
            createdAt: serverTimestamp(),
            lastSeen: serverTimestamp()
        });
    }
}

// ================= PROFILE =================
function updateUIProfile(user) {
    document.getElementById('user-avatar').src = user.photoURL;
    document.getElementById('user-name').innerText = user.displayName;
}

// ================= PLAYER CLICK (FIX) =================
function initPlayerClick() {
    document.querySelectorAll('.player-item').forEach(el => {
        el.onclick = (e) => {
            mpilalaoVoafidy = {
                id: el.dataset.id,
                name: el.dataset.name
            };

            const menu = document.getElementById('player-menu');
            if (menu) {
                menu.style.top = e.clientY + "px";
                menu.style.left = e.clientX + "px";
                menu.classList.remove('hidden');
            }
        };
    });
}

// ================= ROOM TYPE =================
const roomType = document.getElementById('room-type');
const roomPassword = document.getElementById('room-password');

if (roomType) {
    roomType.onchange = () => {
        if (roomType.value === "private") {
            roomPassword.style.display = "block";
        } else {
            roomPassword.style.display = "none";
            roomPassword.value = "";
        }
    };
}

// ================= QUICK PLAY =================
document.getElementById('btn-quick-play').onclick = async () => {
    const snapshot = await getDocs(collection(db, "rooms"));
    let found = null;

    snapshot.forEach(d => {
        const r = d.data();
        if (r.status === "waiting" && !r.opponent && !found && r.type !== "private") {
            found = d.id;
        }
    });

    if (found) {
        joinRoom(found);
    } else {
        const uid = "ROOM-" + Math.floor(Math.random() * 9999);
        await setDoc(doc(db, "rooms", uid), {
            roomUID: uid,
            creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
            opponent: null,
            status: "waiting",
            type: "public",
            password: null,
            turn: auth.currentUser.uid,
            board: initFanoronaBoard(),
            createdAt: serverTimestamp()
        });
        myRole = "creator";
        enterGameView(uid);
    }
};

// ================= LOBBY =================
function initLobby() {

    // ROOMS
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        const div = document.getElementById('rooms-list-dynamic');
        div.innerHTML = "";

        snapshot.forEach(docu => {
            const r = docu.data();

            if (r.status !== "finished") {
                const card = document.createElement('div');
                card.className = "room-item animate-pop";

                card.innerHTML = `
                    <span>🏠 ${docu.id} ${r.type === "private" ? "🔒" : "🌐"}</span>
                    <button class="btn-side" onclick="joinRoom('${docu.id}')">Hiditra</button>
                `;

                div.appendChild(card);
            }
        });
    });

    // PLAYERS
    onSnapshot(collection(db, "users"), (snapshot) => {
        const div = document.getElementById('players-list-dynamic');
        div.innerHTML = "";

        snapshot.forEach(pDoc => {
            const p = pDoc.data();

            if (p.online && pDoc.id !== auth.currentUser.uid) {
                const el = document.createElement('div');
                el.className = "player-item animate-pop";
                el.dataset.id = pDoc.id;
                el.dataset.name = p.name;

                el.innerHTML = `
                    <img src="${p.avatar}" style="width:30px;border-radius:50%">
                    <span>${p.name}</span>
                `;

                div.appendChild(el);
            }
        });

        initPlayerClick(); // ✔️ miasa tsara izao
    });
}

// ================= CREATE ROOM =================
document.getElementById('btn-confirm-create').onclick = async () => {

    const id = document.getElementById('room-uid-input').value.trim();
    const type = roomType ? roomType.value : "public";
    const password = roomPassword ? roomPassword.value.trim() : "";

    if (!id) return alert("Ampidiro ny anaran'ny efitra!");
    if (type === "private" && !password) return alert("Ampidiro ny teny miafina!");

    await setDoc(doc(db, "rooms", id), {
        roomUID: id,
        creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
        opponent: null,
        status: "waiting",
        type: type,
        password: type === "private" ? password : null,
        turn: auth.currentUser.uid,
        board: initFanoronaBoard(),
        createdAt: serverTimestamp()
    });

    myRole = "creator";
    document.getElementById('modal-create').classList.add('hidden');
    enterGameView(id);
};

// ================= JOIN ROOM =================
window.joinRoom = async (roomId) => {

    const snap = await getDoc(doc(db, "rooms", roomId));
    const room = snap.data();

    if (!room) return alert("Tsy misy io efitra io");

    if (room.type === "private") {
        const input = prompt("Ampidiro ny teny miafina:");
        if (input !== room.password) return alert("Diso ny teny miafina!");
    }

    await updateDoc(doc(db, "rooms", roomId), {
        opponent: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
        status: "playing"
    });

    myRole = "opponent";
    enterGameView(roomId);
};

// ================= GAME =================
function enterGameView(roomId) {
    currentRoomId = roomId;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    onSnapshot(doc(db, "rooms", roomId), (snap) => {
        renderGameBoard(snap.data());
    });
}

function initFanoronaBoard() {
    return Array(5).fill().map(() => Array(9).fill(0));
}

function renderGameBoard(game) {
    const grid = document.getElementById('fanorona-grid');
    grid.innerHTML = "";

    game.board.forEach(row => {
        row.forEach(cell => {
            const div = document.createElement('div');
            div.className = "grid-spot";

            if (cell !== 0) {
                const stone = document.createElement('div');
                stone.className = `stone ${cell === 1 ? 'black' : 'white'}`;
                div.appendChild(stone);
            }

            grid.appendChild(div);
        });
    });
}
