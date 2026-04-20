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
        login?.classList.add('hidden');
        lobby?.classList.remove('hidden');

        updateUIProfile(user);
        initLobby();
        saveUserStatus(user, true);

    } else {
        login?.classList.remove('hidden');
        lobby?.classList.add('hidden');
    }
});

// LOGIN
document.getElementById('btn-google')?.addEventListener('click', async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (e) {
        console.error("Login error:", e);
    }
});

// ================= SAVE USER =================
async function saveUserStatus(user, isOnline) {
    await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        avatar: user.photoURL,
        online: isOnline,
        lastSeen: serverTimestamp()
    }, { merge: true });
}

// ================= PROFILE =================
function updateUIProfile(user) {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');

    if (avatar) avatar.src = user.photoURL;
    if (name) name.innerText = user.displayName;
}

// ================= QUICK PLAY =================
document.getElementById('btn-quick-play')?.addEventListener('click', async () => {
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
            creator: {
                id: auth.currentUser.uid,
                name: auth.currentUser.displayName
            },
            opponent: null,
            status: "waiting",
            turn: auth.currentUser.uid,
            board: initFanoronaBoard(),
            createdAt: serverTimestamp()
        });

        myRole = "creator";
        enterGameView(uid);
    }
});

// ================= LOBBY =================
function initLobby() {

    // ROOMS
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        const div = document.getElementById('rooms-list-dynamic');
        if (!div) return;

        div.innerHTML = "";

        snapshot.forEach(docu => {
            const r = docu.data();

            if (r.status !== "finished") {
                const card = document.createElement('div');
                card.className = "room-card glass animate-pop";

                card.innerHTML = `
                    <div>
                        <b>🏠 ${docu.id}</b>
                    </div>
                    <button class="btn-join" data-id="${docu.id}">Hiditra</button>
                `;

                div.appendChild(card);
            }
        });

        document.querySelectorAll('#rooms-list-dynamic [data-id]')
        .forEach(btn => {
            btn.onclick = () => window.joinRoom(btn.dataset.id);
        });
    });

    // PLAYERS
    onSnapshot(collection(db, "users"), (snapshot) => {
        const div = document.getElementById('players-list-dynamic');
        if (!div) return;

        div.innerHTML = "";

        snapshot.forEach(pDoc => {
            const p = pDoc.data();

            if (p.online) {
                div.innerHTML += `
                <div class="player-item glass animate-pop"
                     data-id="${pDoc.id}"
                     data-name="${p.name}">
                    <img src="${p.avatar}" class="small-avatar">
                    <span>${p.name}</span>
                </div>`;
            }
        });

        initPlayerClick();
    });
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
            if (!menu) return;

            menu.style.top = e.clientY + "px";
            menu.style.left = e.clientX + "px";

            menu.classList.remove('hidden');
        };
    });
}

// ================= MENU ACTION =================
const btnChatUser = document.getElementById('btn-chat-user');
if (btnChatUser) {
    btnChatUser.onclick = () => {
        if (!mpilalaoVoafidy) return;

        chatId = [auth.currentUser.uid, mpilalaoVoafidy.id].sort().join("_");
        openChat();
    };
}

document.getElementById('close-chat')?.onclick = () => {
    document.getElementById('chat-panel')?.classList.add('hidden');
    if (unsubChat) unsubChat();
};

// ================= CHAT =================
function openChat() {

    if (unsubChat) unsubChat(); // 🔥 FIX

    const panel = document.getElementById('chat-panel');
    const box = document.getElementById('chat-messages');

    if (!panel || !box) return;

    panel.classList.remove('hidden');
    box.innerHTML = "";

    const q = query(collection(db, "chats", chatId, "messages"), orderBy("time"));

    unsubChat = onSnapshot(q, (snapshot) => {
        box.innerHTML = "";

        snapshot.forEach(docu => {
            const m = docu.data();

            const div = document.createElement('div');
            div.innerText = m.text;

            box.appendChild(div);

            // delete after 24h
            const now = Date.now();
            if (m.time?.seconds && (now - m.time.seconds * 1000 > 86400000)) {
                deleteDoc(doc(db, "chats", chatId, "messages", docu.id));
            }
        });

        box.scrollTop = box.scrollHeight;
    });
}

// SEND
document.getElementById('send-chat')?.onclick = async () => {
    if (!chatId) return;

    const input = document.getElementById('chat-text');
    if (!input || !input.value.trim()) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
        text: input.value,
        sender: auth.currentUser.uid,
        time: serverTimestamp()
    });

    input.value = "";
};

// ================= ROOM =================
window.joinRoom = async (roomId) => {
    const ref = doc(db, "rooms", roomId);
    const snap = await getDoc(ref);
    const room = snap.data();

    if (!room) return alert("Room tsy misy");

    await updateDoc(ref, {
        opponent: {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName
        },
        status: "playing"
    });

    myRole = 'opponent';
    enterGameView(roomId);
};

// ================= GAME =================
function enterGameView(roomId) {
    currentRoomId = roomId;

    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    onSnapshot(doc(db, "rooms", roomId), (snap) => {
        const data = snap.data();
        if (data) renderGameBoard(data);
    });
}

// ================= FANORONA =================
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
