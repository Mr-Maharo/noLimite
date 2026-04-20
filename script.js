import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp 
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
let selectedStone = null; 

// --- AUTH ---
onAuthStateChanged(auth, (user) => {
    console.log("USER:", user);

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
const btnQuick = document.getElementById('btn-quick-play');

if (btnQuick) {
    btnQuick.onclick = async () => {

        const snapshot = await getDocs(collection(db, "rooms"));

        let foundRoom = null;

        snapshot.forEach(docu => {
            const room = docu.data();

            // 🔥 mitady room mbola tsy feno
            if (room.status === "waiting" && !room.opponent && !foundRoom) {
                foundRoom = docu.id;
            }
        });

        if (foundRoom) {
            // 👉 miditra direct
            window.joinRoom(foundRoom);
        } else {
            // 👉 raha tsy misy dia mamorona
            const uid = "ROOM-" + Math.floor(Math.random() * 10000);

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
    };
}
// --- LOGIN FIX (POPUP) ---
const btnGoogle = document.getElementById('btn-google');
if (btnGoogle) {
    btnGoogle.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, provider);
            console.log("✅ Login OK:", result.user);
        } catch (e) {
            console.error("❌ Login error:", e);
        }
    });
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

// --- PROFILE ---
function updateUIProfile(user) {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');

    if (avatar) avatar.src = user.photoURL;
    if (name) name.innerText = user.displayName;
}

// --- 🔥 FIX MODAL (TENY LEHIBE) ---
const modal = document.getElementById('modal-create');

const btnCreateRoom = document.getElementById('btn-create-room');
if (btnCreateRoom) {
    btnCreateRoom.onclick = () => {
        modal.classList.remove('hidden');
    };
}

const closeModal = document.querySelector('.close-modal');
if (closeModal) {
    closeModal.onclick = () => {
        modal.classList.add('hidden');
    };
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
                card.innerHTML = `
                    <b>${roomDoc.id}</b>
                    <button data-id="${roomDoc.id}">Hiditra</button>
                `;
                roomsDiv.appendChild(card);
            }
        });

        // 🔥 FIX (rooms only)
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

            if (p.online) {
                playersDiv.innerHTML += `
                <div class="player-item" 
                     data-id="${pDoc.id}" 
                     data-name="${p.name}">
                    ${p.name}
                </div>`;
            }
        });

        // 🔥 IMPORTANT
        initPlayerClick();
    });
}
// --- CREATE ROOM ---
const btnCreate = document.getElementById('btn-confirm-create');
if (btnCreate) {
    btnCreate.onclick = async () => {
        const uid = document.getElementById('room-uid-input').value.trim();
        if (!uid) return alert("UID ilaina!");

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

        modal.classList.add('hidden'); // 🔥 FIX

        myRole = 'creator';
        enterGameView(uid);
    };
}

// --- JOIN ---
window.joinRoom = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    const room = snap.data();

    if (!room) return alert("Room tsy misy");

    await updateDoc(roomRef, {
        opponent: {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName
        },
        status: "playing"
    });

    myRole = 'opponent';
    enterGameView(roomId);
};

// --- GAME ---
function enterGameView(roomId) {
    currentRoomId = roomId;

    document.getElementById('lobby-screen')?.classList.add('hidden');
    document.getElementById('game-screen')?.classList.remove('hidden');

    onSnapshot(doc(db, "rooms", roomId), (snap) => {
        const data = snap.data();
        if (data) renderGameBoard(data);
    });
}

// --- FANORONA (tsy novaina) ---
function initFanoronaBoard() {
    let board = Array(5).fill().map(() => Array(9).fill(0));
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 9; j++) {
            if (i < 2) board[i][j] = 1;
            else if (i > 2) board[i][j] = 2;
            else board[i][j] = 0;
        }
    }
    return board;
}
// ===============================
// CHAT SYSTEM
// ===============================

let mpilalaoVoafidy = null;
let chatId = null;
let unsubChat = null;

// CLICK PLAYER
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

// OPEN CHAT
document.getElementById('btn-open-chat')?.addEventListener('click', () => {

    if (!mpilalaoVoafidy) return;

    const ahy = auth.currentUser.uid;

    chatId = [ahy, mpilalaoVoafidy.id].sort().join("_");

    document.getElementById('chat-username').innerText = mpilalaoVoafidy.name;

    document.getElementById('chat-panel').classList.remove('hidden');
    document.getElementById('player-menu').classList.add('hidden');

    startChat();
});

// LOAD CHAT
function startChat() {

    if (unsubChat) unsubChat();

    const q = query(
        collection(db, "chats", chatId, "messages"),
        orderBy("createdAt")
    );

    unsubChat = onSnapshot(q, async (snap) => {

        const box = document.getElementById('chat-messages');
        box.innerHTML = "";

        const now = Date.now();

        for (const d of snap.docs) {
            const m = d.data();

            // delete 24h
            if (now - m.createdAt > 86400000) {
                await deleteDoc(d.ref);
                continue;
            }

            box.innerHTML += `
            <div class="msg ${m.sender === auth.currentUser.uid ? 'me' : 'other'}">
                ${m.text}
            </div>`;
        }

        box.scrollTop = box.scrollHeight;
    });
}

// SEND
document.getElementById('send-chat')?.addEventListener('click', async () => {

    const input = document.getElementById('chat-input');
    const text = input.value.trim();

    if (!text || !chatId) return;

    await addDoc(collection(db, "chats", chatId, "messages"), {
        text,
        sender: auth.currentUser.uid,
        createdAt: Date.now()
    });

    input.value = "";
});

// CLOSE CHAT
document.getElementById('close-chat')?.onclick = () => {
    document.getElementById('chat-panel').classList.add('hidden');

    if (unsubChat) {
        unsubChat();
        unsubChat = null;
    }
};

// CLOSE MENU
document.addEventListener('click', (e) => {
    const menu = document.getElementById('player-menu');
    if (!menu) return;

    if (!menu.contains(e.target) && !e.target.classList.contains('player-item')) {
        menu.classList.add('hidden');
    }
});
function renderGameBoard(game) {
    const grid = document.getElementById('fanorona-grid');
    if (!grid) return;

    grid.innerHTML = "";
    const myNum = (myRole === 'creator') ? 1 : 2;

    game.board.forEach((row, r) => {
        row.forEach((cell, c) => {
            const spot = document.createElement('div');
            spot.className = "grid-spot";

            if (cell !== 0) {
                const stone = document.createElement('div');
                stone.className = `stone ${cell === 1 ? 'black' : 'white'}`;
                spot.appendChild(stone);
            }

            grid.appendChild(spot);
        });
    });
}
