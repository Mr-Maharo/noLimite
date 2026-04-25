import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
    getFirestore, collection, doc, setDoc, updateDoc,
    onSnapshot, serverTimestamp, addDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ================= CONFIG =================
const firebaseConfig = {
  apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
  authDomain: "nolimite-29e0b.firebaseapp.com",
  databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nolimite-29e0b",
  storageBucket: "nolimite-29e0b.firebasestorage.app",
  messagingSenderId: "779663542451",
  appId: "1:779663542451:web:e87cd9eba6d8e1bcfd88c6",
  measurementId: "G-VZTK4QBN2J"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ================= STATE =================
let currentRoomId = null;
let selectedCell = null;
let gameUnsub = null;
let invitesUnsub = null;
let friendsUnsub = null;

// ================= SAFE CLICK =================
function addClick(el, fn) {
    if (!el) return;
    el.addEventListener("click", fn);
}

// ================= AUTH =================
onAuthStateChanged(auth, (user) => {
    if (!user) return;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    initLobby();
    initFriends(user.uid);
    initInvites(user.uid);
});

// ================= LOGIN =================
addClick(document.getElementById('btn-google'), () => {
    signInWithPopup(auth, provider);
});

// ================= LOBBY =================
function initLobby() {

    onSnapshot(collection(db, "rooms"), (snap) => {

        const div = document.getElementById("rooms-list-dynamic");
        if (!div) return;

        div.innerHTML = "";

        snap.forEach(d => {
            const el = document.createElement("div");

            el.innerHTML = `
                <span>${d.id}</span>
                <button class="join-btn">Join</button>
            `;

            el.querySelector(".join-btn").addEventListener("click", () => {
                window.joinRoom(d.id);
            });

            div.appendChild(el);
        });
    });
}

// ================= JOIN =================
window.joinRoom = async (id) => {

    await updateDoc(doc(db, "rooms", id), {
        opponent: { id: auth.currentUser.uid, name: "Player" },
        status: "playing"
    });

    enterGame(id);
};

// ================= GAME =================
function enterGame(id) {

    currentRoomId = id;

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    if (gameUnsub) gameUnsub();

    gameUnsub = onSnapshot(doc(db, "rooms", id), (snap) => {

        const game = snap.data();
        if (!game) return;

        render(game);

        if (game.winner) {
            alert("Winner: " + game.winner);
            return;
        }

        if (game.turn === "bot") botPlay(game);
    });
}

// ================= BOARD =================
function getCell(board, x, y) {
    return board.find(c => c.x === x && c.y === y);
}

function cloneBoard(board) {
    return JSON.parse(JSON.stringify(board));
}

function initBoard() {
    let b = [];

    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 9; x++) {
            let v = 0;
            if (y < 2) v = 1;
            else if (y > 2) v = 2;
            b.push({ x, y, value: v });
        }
    }

    return b;
}

// ================= RENDER =================
function render(game) {

    const grid = document.getElementById("fanorona-grid");
    if (!grid) return;

    grid.innerHTML = "";

    game.board.forEach(cell => {

        const div = document.createElement("div");
        div.className = "grid-spot";

        if (selectedCell &&
            selectedCell.x === cell.x &&
            selectedCell.y === cell.y) {
            div.style.background = "yellow";
        }

        if (cell.value) {
            const s = document.createElement("div");
            s.className = cell.value === 1 ? "black" : "white";
            div.appendChild(s);
        }

        addClick(div, () => move(cell, game));
        grid.appendChild(div);
    });
}

// ================= MOVE =================
async function move(cell, game) {

    if (game.turn !== auth.currentUser.uid) return;

    const my = game.creator.id === auth.currentUser.uid ? 1 : 2;
    const enemy = my === 1 ? 2 : 1;

    if (!selectedCell) {
        if (cell.value === my) {
            selectedCell = cell;
            render(game);
        }
        return;
    }

    let dx = cell.x - selectedCell.x;
    let dy = cell.y - selectedCell.y;

    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && cell.value === 0) {

        let b = cloneBoard(game.board);

        getCell(b, selectedCell.x, selectedCell.y).value = 0;
        getCell(b, cell.x, cell.y).value = my;

        let x = cell.x + dx;
        let y = cell.y + dy;

        while (true) {
            let t = getCell(b, x, y);
            if (t && t.value === enemy) {
                t.value = 0;
                x += dx;
                y += dy;
            } else break;
        }

        selectedCell = null;

        await updateDoc(doc(db, "rooms", currentRoomId), {
            board: b,
            turn: game.creator.id
        });

    } else {
        selectedCell = null;
    }
}

// ================= BOT (simple safe) =================
function botPlay(game) {
    setTimeout(async () => {
        let b = cloneBoard(game.board);

        let from = b.find(c => c.value === 2);
        let to = b.find(c => c.value === 0);

        if (!from || !to) return;

        getCell(b, from.x, from.y).value = 0;
        getCell(b, to.x, to.y).value = 2;

        await updateDoc(doc(db, "rooms", currentRoomId), {
            board: b,
            turn: game.creator.id
        });

    }, 500);
}
