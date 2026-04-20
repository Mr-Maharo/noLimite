import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc,
    onSnapshot, serverTimestamp, getDocs, addDoc,
    query, orderBy, deleteDoc
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

let currentRoomId = null;
let myRole = null;

// CHAT
let mpilalaoVoafidy = null;
let chatId = null;
let unsubChat = null;

// ================= AUTH =================
onAuthStateChanged(auth, (user) => {
    const login = document.getElementById('login-screen');
    const lobby = document.getElementById('lobby-screen');

    if (user) {
        if (login) login.classList.add('hidden');
        if (lobby) lobby.classList.remove('hidden');

        updateUIProfile(user);
        initLobby();
        saveUserStatus(user, true);
    } else {
        if (login) login.classList.remove('hidden');
        if (lobby) lobby.classList.add('hidden');
    }
});

// ================= LOGIN =================
const btnGoogle = document.getElementById('btn-google');
if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
        try {
            await signInWithPopup(auth, provider);
        } catch (e) {
            console.error("Login error:", e);
        }
    });
}

// ================= SAVE USER (FIX DUPLICATE EMAIL) =================
async function saveUserStatus(user, isOnline) {

    const usersRef = collection(db, "users");
    const snapshot = await getDocs(usersRef);

    let existingDocId = null;

    snapshot.forEach(docu => {
        const data = docu.data();
        if (data.email === user.email) {
            existingDocId = docu.id;
        }
    });

    if (existingDocId) {
        const userRef = doc(db, "users", existingDocId);

        await updateDoc(userRef, {
            online: isOnline,
            lastSeen: serverTimestamp(),
            name: user.displayName,
            avatar: user.photoURL
        });

    } else {
        const userRef = doc(db, "users", user.uid);

        await setDoc(userRef, {
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
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    if (avatar) avatar.src = user.photoURL;
    if (name) name.innerText = user.displayName;
}

// ================= QUICK PLAY =================
const btnQuick = document.getElementById('btn-quick-play');
if (btnQuick) {
    btnQuick.onclick = async () => {
        const snapshot = await getDocs(collection(db, "rooms"));
        let found = null;

        snapshot.forEach(d => {
            const r = d.data();
            if (r.status === "waiting" && !r.opponent && !found) {
                found = d.id;
            }
        });

        if (found) {
            window.joinRoom(found);
        } else {
            const uid = "ROOM-" + Math.floor(Math.random() * 9999);
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

// ================= LOBBY =================
function initLobby() {
    // ROOMS LIST
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        const div = document.getElementById('rooms-list-dynamic');
        if (!div) return;
        div.innerHTML = "";
        snapshot.forEach(docu => {
            const r = docu.data();
            if (r.status !== "finished") {
                const card = document.createElement('div');
                card.className = "room-item animate-pop";
                card.innerHTML = `
                    <span>🏠 Room: ${docu.id}</span>
                    <button class="btn-side" style="width:auto" onclick="joinRoom('${docu.id}')">Hiditra</button>
                `;
                div.appendChild(card);
            }
        });
    });

    // PLAYERS LIST
    onSnapshot(collection(db, "users"), (snapshot) => {
        const div = document.getElementById('players-list-dynamic');
        if (!div) return;
        div.innerHTML = "";
        snapshot.forEach(pDoc => {
            const p = pDoc.data();
            if (p.online && pDoc.id !== auth.currentUser.uid) { 
                const pItem = document.createElement('div');
                pItem.className = "player-item animate-pop";
                pItem.dataset.id = pDoc.id;
                pItem.dataset.name = p.name;
                pItem.innerHTML = `
                    <img src="${p.avatar}" style="width:30px; border-radius:50%">
                    <span>${p.name}</span>
                `;
                div.appendChild(pItem);
            }
        });
        initPlayerClick();
    });
}

// ================= MODAL CREATE ROOM =================
const modalCreate = document.getElementById('modal-create');
const btnOpenCreate = document.getElementById('btn-create-room');
const btnConfirmCreate = document.getElementById('btn-confirm-create');
const roomUidInput = document.getElementById('room-uid-input');
const closeModal = document.querySelector('.close-modal');

if (btnOpenCreate) {
    btnOpenCreate.onclick = () => modalCreate.classList.remove('hidden');
}
if (closeModal) {
    closeModal.onclick = () => modalCreate.classList.add('hidden');
}

if (btnConfirmCreate) {
    btnConfirmCreate.onclick = async () => {
        const customId = roomUidInput.value.trim();
        if (!customId) return alert("Ampidiro ny UID!");
        
        await setDoc(doc(db, "rooms", customId), {
            roomUID: customId,
            creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
            opponent: null,
            status: "waiting",
            turn: auth.currentUser.uid,
            board: initFanoronaBoard(),
            createdAt: serverTimestamp()
        });
        myRole = "creator";
        modalCreate.classList.add('hidden');
        enterGameView(customId);
    };
}

// ================= PLAYER CLICK & CONTEXT MENU =================
function initPlayerClick() {
    document.querySelectorAll('.player-item').forEach(el => {
        el.onclick = (e) => {
            mpilalaoVoafidy = { id: el.dataset.id, name: el.dataset.name };
            const menu = document.getElementById('player-menu');
            if (menu) {
                menu.style.top = e.clientY + "px";
                menu.style.left = e.clientX + "px";
                menu.classList.remove('hidden');
            }
        };
    });
}

// Hanidy an'ilay menu rehefa mikitika toerana hafa
window.addEventListener('click', (e) => {
    const menu = document.getElementById('player-menu');
    if (menu && !e.target.closest('.player-item')) menu.classList.add('hidden');
});

// ================= CHAT LOGIC =================
const btnChatUser = document.getElementById('btn-chat-user');
if (btnChatUser) {
    btnChatUser.onclick = () => {
        if (!mpilalaoVoafidy) return;
        chatId = [auth.currentUser.uid, mpilalaoVoafidy.id].sort().join("_");
        openChat();
    };
}

function openChat() {
    if (unsubChat) unsubChat();
    const panel = document.getElementById('chat-panel');
    const box = document.getElementById('chat-messages');
    const chatName = document.getElementById('chat-name');

    if (panel) panel.classList.remove('hidden');
    if (chatName) chatName.innerText = mpilalaoVoafidy.name;

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("time"));
    unsubChat = onSnapshot(q, (snapshot) => {
        if (box) {
            box.innerHTML = "";
            snapshot.forEach(docu => {
                const m = docu.data();
                const msgDiv = document.createElement('div');
                msgDiv.className = m.sender === auth.currentUser.uid ? "msg me" : "msg other";
                msgDiv.innerText = m.text;
                box.appendChild(msgDiv);
            });
            box.scrollTop = box.scrollHeight;
        }
    });
}

const btnCloseChat = document.getElementById('close-chat');
if (btnCloseChat) {
    btnCloseChat.onclick = () => {
        document.getElementById('chat-panel').classList.add('hidden');
        if (unsubChat) unsubChat();
    };
}

const btnSend = document.getElementById('send-chat');
if (btnSend) {
    btnSend.onclick = async () => {
        const input = document.getElementById('chat-text');
        if (!chatId || !input || !input.value.trim()) return;
        await addDoc(collection(db, "chats", chatId, "messages"), {
            text: input.value,
            sender: auth.currentUser.uid,
            time: serverTimestamp()
        });
        input.value = "";
    };
}

// ================= GAME LOGIC =================
window.joinRoom = async (roomId) => {
    const ref = doc(db, "rooms", roomId);
    await updateDoc(ref, {
        opponent: { id: auth.currentUser.uid, name: auth.currentUser.displayName },
        status: "playing"
    });
    myRole = 'opponent';
    enterGameView(roomId);
};

function enterGameView(roomId) {
    currentRoomId = roomId;
    const lobby = document.getElementById('lobby-screen');
    const game = document.getElementById('game-screen');
    if (lobby) lobby.classList.add('hidden');
    if (game) game.classList.remove('hidden');

    onSnapshot(doc(db, "rooms", roomId), (snap) => {
        const data = snap.data();
        if (data) renderGameBoard(data);
    });
}

function initFanoronaBoard() {
    return Array(5).fill().map(() => Array(9).fill(0));
}

function renderGameBoard(game) {
    const grid = document.getElementById('fanorona-grid');
    if (!grid) return;
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
