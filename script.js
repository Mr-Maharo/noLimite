import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc,
    onSnapshot, serverTimestamp, getDocs, addDoc,
    query, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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

// ================= UTILS =================
function generateUID() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function initFanoronaBoard() {
    const board = Array(5).fill().map(() => Array(9).fill(0));
    return JSON.stringify(board);
}

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

// ================= PLAYER CLICK =================
function initPlayerClick() {
    document.querySelectorAll('.player-item').forEach(el => {
        el.onclick = (e) => {
            mpilalaoVoafidy = {
                id: el.dataset.id,
                name: el.dataset.name
            };

            const menu = document.getElementById('player-menu');
            menu.style.top = e.clientY + "px";
            menu.style.left = e.clientX + "px";
            menu.classList.remove('hidden');
        };
    });
}

// ================= PLAYER MENU ACTION =================
document.getElementById('btn-play-user').onclick = async () => {
    if (!mpilalaoVoafidy) return;

    const uid = generateUID();

    await setDoc(doc(db, "rooms", uid), {
        roomUID: uid,
        creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
        opponent: { id: mpilalaoVoafidy.id, name: mpilalaoVoafidy.name },
        status: "playing",
        type: "public",
        password: null,
        turn: auth.currentUser.uid,
        board: initFanoronaBoard(),
        createdAt: serverTimestamp()
    });

    myRole = "creator";
    document.getElementById('player-menu').classList.add('hidden');
    enterGameView(uid);
};

document.getElementById('btn-chat-user').onclick = () => {
    if (!mpilalaoVoafidy) return;

    chatId = [auth.currentUser.uid, mpilalaoVoafidy.id].sort().join("_");
    openChat();
    document.getElementById('player-menu').classList.add('hidden');
};

// ================= CLOSE MENU =================
window.addEventListener('click', (e) => {
    const menu = document.getElementById('player-menu');
    if (!e.target.closest('.player-item')) {
        menu.classList.add('hidden');
    }
});

// ================= CHAT =================
function openChat() {
    if (unsubChat) unsubChat();

    const panel = document.getElementById('chat-panel');
    const box = document.getElementById('chat-messages');

    panel.classList.remove('hidden');

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("time"));

    unsubChat = onSnapshot(q, (snapshot) => {
        box.innerHTML = "";

        snapshot.forEach(docu => {
            const m = docu.data();

            const div = document.createElement('div');
            div.innerText = m.text;

            box.appendChild(div);
        });

        box.scrollTop = box.scrollHeight;
    });
}

document.getElementById('send-chat').onclick = async () => {
    const input = document.getElementById('chat-text');

    if (!chatId || !input.value.trim()) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
        text: input.value,
        sender: auth.currentUser.uid,
        time: serverTimestamp()
    });

    input.value = "";
};

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
        const uid = generateUID();

        await setDoc(doc(db, "rooms", uid), {
            roomUID: uid,
            creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
            opponent: { id: "BOT", name: "🤖 Bot" },
            status: "playing",
            type: "public",
            password: null,
            turn: auth.currentUser.uid,
            board: initFanoronaBoard(),
            createdAt: serverTimestamp()
        });

        myRole = "creator";
        enterGameView(uid);

        setTimeout(() => botPlay(uid), 1500);
    }
};

// ================= LOBBY =================
function initLobby() {

    onSnapshot(collection(db, "rooms"), (snapshot) => {
        const div = document.getElementById('rooms-list-dynamic');
        div.innerHTML = "";

        snapshot.forEach(docu => {
            const r = docu.data();

            const card = document.createElement('div');
            card.innerHTML = `
                ${docu.id}
                <button onclick="joinRoom('${docu.id}')">Hiditra</button>
            `;
            div.appendChild(card);
        });
    });

    onSnapshot(collection(db, "users"), (snapshot) => {
        const div = document.getElementById('players-list-dynamic');
        div.innerHTML = "";

        snapshot.forEach(pDoc => {
            const p = pDoc.data();

            if (p.online && pDoc.id !== auth.currentUser.uid) {
                const el = document.createElement('div');
                el.className = "player-item";
                el.dataset.id = pDoc.id;
                el.dataset.name = p.name;

                el.innerHTML = `
                    <img src="${p.avatar}" width="30">
                    ${p.name}
                `;

                div.appendChild(el);
            }
        });

        initPlayerClick();
    });
}

// ================= JOIN =================
window.joinRoom = async (roomId) => {

    const snap = await getDoc(doc(db, "rooms", roomId));
    const room = snap.data();

    if (!room) return alert("Tsy misy io");

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

function renderGameBoard(game) {
    const grid = document.getElementById('fanorona-grid');
    grid.innerHTML = "";

    const board = JSON.parse(game.board);

    board.forEach(row => {
        row.forEach(cell => {
            const div = document.createElement('div');

            if (cell !== 0) {
                const stone = document.createElement('div');
                stone.className = cell === 1 ? "black" : "white";
                div.appendChild(stone);
            }

            grid.appendChild(div);
        });
    });
}

// ================= BOT =================
async function botPlay(roomId) {
    const ref = doc(db, "rooms", roomId);
    const snap = await getDoc(ref);
    const data = snap.data();

    if (!data) return;

    let board = JSON.parse(data.board);

    const x = Math.floor(Math.random() * 5);
    const y = Math.floor(Math.random() * 9);

    board[x][y] = 2;

    await updateDoc(ref, {
        board: JSON.stringify(board)
    });
}
