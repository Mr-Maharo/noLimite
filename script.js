import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc,
    onSnapshot, serverTimestamp, getDocs
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ================= CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// ================= VARIABLES =================
let currentRoomId = null;
let selectedCell = null;

// ================= AUTH =================
onAuthStateChanged(auth, (user) => {
    if (!user) return;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    initLobby();
});

// ================= LOGIN =================
document.getElementById('btn-google').onclick = () => {
    signInWithPopup(auth, provider);
};

// ================= QUICK PLAY =================
document.getElementById('btn-quick-play').onclick = async () => {

    const uid = Math.floor(100000 + Math.random() * 900000).toString();

    await setDoc(doc(db, "rooms", uid), {
        creator: auth.currentUser.uid,
        opponent: "bot",
        turn: auth.currentUser.uid,
        status: "playing",
        board: initBoard(),
        createdAt: serverTimestamp()
    });

    enterGame(uid);
};

// ================= LOBBY =================
function initLobby() {
    onSnapshot(collection(db, "rooms"), (snap) => {
        const div = document.getElementById('rooms-list-dynamic');
        div.innerHTML = "";

        snap.forEach(d => {
            const r = d.data();

            const el = document.createElement('div');
            el.innerHTML = `
                ${d.id}
                <button onclick="joinRoom('${d.id}')">Join</button>
            `;
            div.appendChild(el);
        });
    });
}

// ================= JOIN =================
window.joinRoom = async (id) => {
    await updateDoc(doc(db, "rooms", id), {
        opponent: auth.currentUser.uid,
        status: "playing"
    });
    enterGame(id);
};

// ================= ENTER GAME =================
function enterGame(id) {
    currentRoomId = id;

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    onSnapshot(doc(db, "rooms", id), (snap) => {
        const game = snap.data();

        render(game);

        if (game.winner) {
            alert("🏆 Winner: " + game.winner);
            return;
        }

        if (game.turn === "bot") {
            botPlay(game);
        }
    });
}

// ================= BOARD =================
function initBoard() {
    let board = [];

    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 9; x++) {

            let value = 0;
            if (y < 2) value = 1;
            else if (y > 2) value = 2;

            board.push({ x, y, value });
        }
    }
    return board;
}

// ================= RENDER =================
function render(game) {
    const grid = document.getElementById('fanorona-grid');
    grid.innerHTML = "";

    game.board.forEach(cell => {
        const div = document.createElement('div');
        div.className = "grid-spot";

        if (cell.value !== 0) {
            const stone = document.createElement('div');
            stone.className = cell.value === 1 ? "black" : "white";
            div.appendChild(stone);
        }

        div.onclick = () => move(cell, game);
        grid.appendChild(div);
    });
}

// ================= MOVE =================
function move(cell, game) {

    if (game.turn !== auth.currentUser.uid) return;

    const myVal = (game.creator === auth.currentUser.uid) ? 1 : 2;
    const enemy = myVal === 1 ? 2 : 1;

    if (!selectedCell) {
        if (cell.value === myVal) selectedCell = cell;
        return;
    }

    let dx = cell.x - selectedCell.x;
    let dy = cell.y - selectedCell.y;

    if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && cell.value === 0) {

        let board = JSON.parse(JSON.stringify(game.board));

        // move
        board.forEach(c => {
            if (c.x === selectedCell.x && c.y === selectedCell.y) c.value = 0;
            if (c.x === cell.x && c.y === cell.y) c.value = myVal;
        });

        // capture
        let x = cell.x + dx;
        let y = cell.y + dy;

        while (true) {
            let target = board.find(c => c.x === x && c.y === y);
            if (target && target.value === enemy) {
                target.value = 0;
                x += dx;
                y += dy;
            } else break;
        }

        selectedCell = null;

        const winner = checkWin(board);

        await updateDoc(doc(db, "rooms", currentRoomId), {
            board: board,
            turn: winner ? "end" : "bot",
            winner: winner || null
        });
    } else {
        selectedCell = null;
    }
}

// ================= BOT =================
function botPlay(game) {
    setTimeout(async () => {

        let board = JSON.parse(JSON.stringify(game.board));

        let myPieces = board.filter(c => c.value === 2);
        let empty = board.filter(c => c.value === 0);

        for (let p of myPieces) {
            for (let e of empty) {

                let dx = e.x - p.x;
                let dy = e.y - p.y;

                if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {

                    board.forEach(c => {
                        if (c.x === p.x && c.y === p.y) c.value = 0;
                        if (c.x === e.x && c.y === e.y) c.value = 2;
                    });

                    await updateDoc(doc(db, "rooms", currentRoomId), {
                        board: board,
                        turn: game.creator
                    });

                    return;
                }
            }
        }

    }, 500);
}

// ================= WIN =================
function checkWin(board) {

    const p1 = board.filter(c => c.value === 1).length;
    const p2 = board.filter(c => c.value === 2).length;

    if (p1 === 0) return "BOT";
    if (p2 === 0) return "PLAYER";

    const dirs = [[1,0],[0,1],[1,1],[1,-1]];

    for (let c of board) {
        if (c.value === 0) continue;

        for (let [dx,dy] of dirs) {

            let count = 1;

            for (let i=1;i<3;i++) {
                let n = board.find(x =>
                    x.x === c.x + dx*i &&
                    x.y === c.y + dy*i &&
                    x.value === c.value
                );
                if (n) count++;
            }

            if (count >= 3) {
                return c.value === 1 ? "PLAYER" : "BOT";
            }
        }
    }

    return null;
}
