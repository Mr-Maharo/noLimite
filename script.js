import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithRedirect, getRedirectResult, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// --- 1. CONFIGURATION ---
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentRoomId = null;
let myRole = null; 
let selectedStone = null; 

// --- 2. AUTHENTICATION & REDIRECT RESULT ---


onAuthStateChanged(auth, (user) => {
    console.log("USER:", user);

    const loginScreen = document.getElementById('login-screen');
    const lobbyScreen = document.getElementById('lobby-screen');

    if (user) {
        console.log("✅ MIDITRA");

        if (loginScreen) loginScreen.classList.add('hidden');
        if (lobbyScreen) lobbyScreen.classList.remove('hidden');

        updateUIProfile(user);
        initLobby();
        saveUserStatus(user, true);

    } else {
        console.log("❌ TSY MIDITRA");

        if (loginScreen) loginScreen.classList.remove('hidden');
        if (lobbyScreen) lobbyScreen.classList.add('hidden');
    }
});

async function saveUserStatus(user, isOnline) {
    await setDoc(doc(db, "users", user.uid), {
        name: user.displayName,
        avatar: user.photoURL,
        online: isOnline,
        lastSeen: serverTimestamp()
    }, { merge: true });
}

import { signInWithPopup } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

const loginWithGoogle = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("✅ Login OK:", result.user);
    } catch (error) {
        console.error("❌ Login error:", error);
    }
};

const btnGoogle = document.getElementById('btn-google');
if (btnGoogle) {
    btnGoogle.addEventListener('click', loginWithGoogle);
}

// --- 3. LOBBY LOGIC ---

function initLobby() {
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        const roomsDiv = document.getElementById('rooms-list-dynamic');
        if (!roomsDiv) return;

        roomsDiv.innerHTML = "";

        snapshot.forEach(roomDoc => {
            const room = roomDoc.data();
            if (room.status !== "finished") {
                const card = document.createElement('div');
                card.className = "room-card glass animate-pop";
                card.innerHTML = `
                    <div class="room-info">
                        <b>🏠 ${roomDoc.id}</b> 
                        <span>${room.prive ? '🔒' : '🔓'} | Tours: ${room.maxTours}</span>
                    </div>
                    <button class="btn-join" data-id="${roomDoc.id}">Hiditra</button>
                `;
                roomsDiv.appendChild(card);
            }
        });

        document.querySelectorAll('.btn-join').forEach(btn => {
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
                    <div class="player-item glass">
                        <img src="${p.avatar}" class="small-avatar">
                        <span>${p.name}</span>
                    </div>`;
            }
        });
    });
}

// --- 4. FANORONA ENGINE ---

function initFanoronaBoard() {
    let board = Array(5).fill().map(() => Array(9).fill(0));
    for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 9; j++) {
            if (i < 2) board[i][j] = 1; 
            else if (i > 2) board[i][j] = 2;
            else {
                if (j < 4) board[i][j] = (j % 2 === 0) ? 1 : 2;
                else if (j > 4) board[i][j] = (j % 2 === 0) ? 2 : 1;
                else board[i][j] = 0;
            }
        }
    }
    return board;
}

function isStrongPoint(r, c) { return (r + c) % 2 === 0; }

function isValidMove(r1, c1, r2, c2, board) {
    const dr = Math.abs(r1 - r2);
    const dc = Math.abs(c1 - c2);
    if (dr > 1 || dc > 1 || (dr === 0 && dc === 0)) return false;
    if (board[r2][c2] !== 0) return false;
    if (dr === 1 && dc === 1 && !isStrongPoint(r1, c1)) return false;
    return true;
}

function executeMove(r1, c1, r2, c2, board, player) {
    let newBoard = JSON.parse(JSON.stringify(board));
    newBoard[r2][c2] = player;
    newBoard[r1][c1] = 0;

    const dr = r2 - r1;
    const dc = c2 - c1;
    const enemy = (player === 1) ? 2 : 1;

    let nextR = r2 + dr, nextC = c2 + dc;
    while (nextR >= 0 && nextR < 5 && nextC >= 0 && nextC < 9 && newBoard[nextR][nextC] === enemy) {
        newBoard[nextR][nextC] = 0;
        nextR += dr; nextC += dc;
    }

    let backR = r1 - dr, backC = c1 - dc;
    while (backR >= 0 && backR < 5 && backC >= 0 && backC < 9 && newBoard[backR][backC] === enemy) {
        newBoard[backR][backC] = 0;
        backR -= dr; backC -= dc;
    }

    return newBoard;
}

// --- 5. GAME ACTIONS ---

const btnCreate = document.getElementById('btn-confirm-create');
if (btnCreate) {
    btnCreate.onclick = async () => {
        const uid = document.getElementById('room-uid-input').value.trim();
        const tours = document.getElementById('room-tours-select').value;
        const isPrive = document.getElementById('check-prive').checked;
        const pass = document.getElementById('room-pass-input').value;

        if (!uid) return alert("UID ilaina!");

        await setDoc(doc(db, "rooms", uid), {
            roomUID: uid,
            maxTours: parseInt(tours),
            prive: isPrive,
            password: isPrive ? pass : null,
            creator: { id: auth.currentUser.uid, name: auth.currentUser.displayName, avatar: auth.currentUser.photoURL },
            opponent: null,
            status: "waiting",
            turn: auth.currentUser.uid,
            board: initFanoronaBoard(),
            createdAt: serverTimestamp()
        });

        myRole = 'creator';
        enterGameView(uid);
    };
}

// --- JOIN ROOM ---
window.joinRoom = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    const room = snap.data();

    if (!room) return alert("Room tsy misy");

    if (room.prive) {
        const p = prompt("Teny miafina:");
        if (p !== room.password) return alert("Diso!");
    }

    await updateDoc(roomRef, {
        opponent: { id: auth.currentUser.uid, name: auth.currentUser.displayName, avatar: auth.currentUser.photoURL },
        status: "playing"
    });

    myRole = 'opponent';
    enterGameView(roomId);
};

// --- 6. GAMEPLAY SYNC ---

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
                if (selectedStone?.r === r && selectedStone?.c === c) {
                    stone.classList.add('selected');
                }
                spot.appendChild(stone);
            }

            spot.onclick = async () => {
                if (game.turn !== auth.currentUser.uid) return;

                if (cell === myNum) {
                    selectedStone = { r, c };
                    renderGameBoard(game);
                } else if (selectedStone && cell === 0) {
                    if (isValidMove(selectedStone.r, selectedStone.c, r, c, game.board)) {
                        const newBoard = executeMove(selectedStone.r, selectedStone.c, r, c, game.board, myNum);

                        const nextTurn = (myRole === 'creator') 
                            ? (game.opponent ? game.opponent.id : game.turn) 
                            : game.creator.id;

                        await updateDoc(doc(db, "rooms", currentRoomId), {
                            board: newBoard,
                            turn: nextTurn
                        });

                        selectedStone = null;
                    }
                }
            };

            grid.appendChild(spot);
        });
    });
}

function updateUIProfile(user) {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');

    if (avatar) avatar.src = user.photoURL;
    if (name) name.innerText = user.displayName;
}
