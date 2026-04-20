import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, onSnapshot, serverTimestamp, query, orderBy, addDoc, deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- CONFIG ---
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentRoomId = null;
let myRole = null; 
let mpilalaoVoafidy = null;
let chatId = null;
let unsubChat = null;

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    const loginScreen = document.getElementById('login-screen');
    const lobbyScreen = document.getElementById('lobby-screen');

    if (user) {
        if (loginScreen) loginScreen.classList.add('hidden');
        if (lobbyScreen) lobbyScreen.classList.remove('hidden');
        updateUIProfile(user);
        initLobby();
        saveUserStatus(user, true);
    } else {
        if (loginScreen) loginScreen.classList.remove('hidden');
        if (lobbyScreen) lobbyScreen.classList.add('hidden');
    }
});

// --- LOGIN ---
const btnGoogle = document.getElementById('btn-google');
if (btnGoogle) {
    btnGoogle.onclick = async () => {
        try { await signInWithPopup(auth, provider); } 
        catch (e) { console.error(e); }
    };
}

// --- QUICK PLAY ---
const btnQuick = document.getElementById('btn-quick-play');
if (btnQuick) {
    btnQuick.onclick = async () => {
        const snapshot = await getDocs(collection(db, "rooms"));
        let foundRoom = null;

        snapshot.forEach(docu => {
            const room = docu.data();
            if (room.status === "waiting" && !room.opponent && !foundRoom) {
                foundRoom = docu.id;
            }
        });

        if (foundRoom) {
            window.joinRoom(foundRoom);
        } else {
            const uid = "ROOM-" + Math.floor(Math.random() * 10000);
            await setDoc(doc(db, "rooms", uid), {
                roomUID: uid,
                creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
                opponent: null,
                status: "waiting",
                turn: auth.currentUser.uid,
                board: initFanoronaBoard(),
                createdAt: serverTimestamp()
            });
            myRole = "creator";
            enterGameView(uid);
        }
    };
}

// --- SAVE USER ---
async function saveUserStatus(user, isOnline) {
    await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        avatar: user.photoURL,
        online: isOnline,
        lastSeen: serverTimestamp()
    }, { merge: true });
}

function updateUIProfile(user) {
    document.getElementById('user-avatar').src = user.photoURL;
    document.getElementById('user-name').innerText = user.displayName;
}

// --- LOBBY ---
function initLobby() {
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        const roomsDiv = document.getElementById('rooms-list-dynamic');
        if (!roomsDiv) return;
        roomsDiv.innerHTML = "";
        snapshot.forEach(roomDoc => {
            const room = roomDoc.data();
            if (room.status !== "finished") {
                const card = document.createElement('div');
                card.className = "player-item";
                card.innerHTML = `<b>${roomDoc.id}</b> <button class="btn quick" style="padding:5px" data-id="${roomDoc.id}">Hiditra</button>`;
                roomsDiv.appendChild(card);
            }
        });
        document.querySelectorAll('#rooms-list-dynamic [data-id]').forEach(btn => {
            btn.onclick = () => window.joinRoom(btn.getAttribute('data-id'));
        });
    });

    onSnapshot(collection(db, "users"), (snapshot) => {
        const playersDiv = document.getElementById('players-list-dynamic');
        if (!playersDiv) return;
        playersDiv.innerHTML = "";
        snapshot.forEach(pDoc => {
            const p = pDoc.data();
            if (p.online && pDoc.id !== auth.currentUser.uid) {
                const div = document.createElement('div');
                div.className = "player-item";
                div.dataset.id = pDoc.id;
                div.dataset.name = p.name;
                div.innerText = p.name;
                playersDiv.appendChild(div);
            }
        });
        initPlayerClick();
    });
}

// --- CHAT SYSTEM ---
function initPlayerClick() {
    document.querySelectorAll('#players-list-dynamic .player-item').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            mpilalaoVoafidy = { id: el.dataset.id, name: el.dataset.name };
            const menu = document.getElementById('player-menu');
            menu.style.top = e.clientY + "px";
            menu.style.left = e.clientX + "px";
            menu.classList.remove('hidden');
        };
    });
}

document.getElementById('btn-open-chat').onclick = () => {
    if (!mpilalaoVoafidy) return;
    chatId = [auth.currentUser.uid, mpilalaoVoafidy.id].sort().join("_");
    document.getElementById('chat-username').innerText = mpilalaoVoafidy.name;
    document.getElementById('chat-panel').classList.remove('hidden');
    document.getElementById('player-menu').classList.add('hidden');
    startChat();
};

function startChat() {
    if (unsubChat) unsubChat();
    const q = query(collection(db, "chats", chatId, "messages"), orderBy("createdAt"));
    unsubChat = onSnapshot(q, async (snap) => {
        const box = document.getElementById('chat-messages');
        box.innerHTML = "";
        snap.forEach(d => {
            const m = d.data();
            box.innerHTML += `<div class="msg ${m.sender === auth.currentUser.uid ? 'me' : 'other'}">${m.text}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

document.getElementById('send-chat').onclick = async () => {
    const input = document.getElementById('chat-input');
    if (!input.value.trim() || !chatId) return;
    await addDoc(collection(db, "chats", chatId, "messages"), {
        text: input.value,
        sender: auth.currentUser.uid,
        createdAt: Date.now()
    });
    input.value = "";
};

// Hanidy menu raha mikitika toerana hafa
document.addEventListener('click', () => document.getElementById('player-menu').classList.add('hidden'));

// --- GAME FUNCTIONS ---
window.joinRoom = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    if (!snap.exists()) return alert("Room tsy misy");
    await updateDoc(roomRef, {
        opponent: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
        status: "playing"
    });
    myRole = 'opponent';
    enterGameView(roomId);
};

function enterGameView(roomId) {
    document.getElementById('lobby-screen').classList.add('hidden');
    // Eto ianao no mampiseho ny 'game-screen' raha efa namboarinao
}

function initFanoronaBoard() {
    let board = Array(5).fill().map(() => Array(9).fill(0));
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 9; j++) {
            if (i < 2) board[i][j] = 1; else if (i > 2) board[i][j] = 2; else board[i][j] = 0;
        }
    }
    return board;
}
