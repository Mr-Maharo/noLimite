import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc, onSnapshot, 
    query, orderBy, serverTimestamp, arrayUnion, deleteDoc 
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

// State an'ny lalao
let currentRoomId = null;
let myRole = null; // 'creator' (Mainty/1) na 'opponent' (Fotsy/2)
let selectedStone = null; 

// --- 2. AUTHENTICATION & USER STATUS ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        updateUIProfile(user);
        initLobby();
        saveUserStatus(user, true);
    } else {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('lobby-screen').classList.add('hidden');
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


// Function hisahana ny Login
const loginWithGoogle = async () => {
    try {
        console.log("Andrana fidirana amin'ny Google...");
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("Tafiditra soa aman-tsara:", user.displayName);
        
        // Rehefa tafiditra dia hita ny Lobby
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('lobby-screen').classList.remove('hidden');
        
    } catch (error) {
        console.error("Fahadisoana tamin'ny Login:", error.message);
        alert("Nisy olana: " + error.message);
    }
};

// Ampifandraisina amin'ilay bokotra ny click
document.getElementById('btn-google').addEventListener('click', loginWithGoogle);
// --- 3. LOBBY LOGIC ---
function initLobby() {
    // Mihaino ny Rooms rehetra
    onSnapshot(collection(db, "rooms"), (snapshot) => {
        const roomsDiv = document.getElementById('rooms-list-dynamic');
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
                    <button class="btn-join" onclick="joinRoom('${roomDoc.id}')">Hiditra</button>
                `;
                roomsDiv.appendChild(card);
            }
        });
    });

    // Mihaino ny Online Players
    onSnapshot(collection(db, "users"), (snapshot) => {
        const playersDiv = document.getElementById('players-list-dynamic');
        playersDiv.innerHTML = "";
        snapshot.forEach(pDoc => {
            const p = pDoc.data();
            if (p.online) {
                playersDiv.innerHTML += `
                    <div class="player-item glass animate-fade">
                        <img src="${p.avatar}" class="small-avatar">
                        <span>${p.name}</span>
                    </div>`;
            }
        });
    });
}

// --- 4. FANORONA CORE ENGINE (Rules & Logic) ---

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

// Algorithm Tika sy Taka
function executeMove(r1, c1, r2, c2, board, player) {
    let newBoard = JSON.parse(JSON.stringify(board));
    newBoard[r2][c2] = player;
    newBoard[r1][c1] = 0;

    const dr = r2 - r1;
    const dc = c2 - c1;
    const enemy = (player === 1) ? 2 : 1;

    // Tika (Approach)
    let nextR = r2 + dr; let nextC = c2 + dc;
    while (nextR >= 0 && nextR < 5 && nextC >= 0 && nextC < 9 && newBoard[nextR][nextC] === enemy) {
        newBoard[nextR][nextC] = 0;
        nextR += dr; nextC += dc;
    }

    // Taka (Withdrawal)
    let backR = r1 - dr; let backC = c1 - dc;
    while (backR >= 0 && backR < 5 && backC >= 0 && backC < 9 && newBoard[backR][backC] === enemy) {
        newBoard[backR][backC] = 0;
        backR -= dr; backC -= dc;
    }
    return newBoard;
}

// --- 5. GAME ACTIONS ---

document.getElementById('btn-confirm-create').onclick = async () => {
    const uid = document.getElementById('room-uid-input').value.trim();
    const tours = document.getElementById('room-tours-select').value;
    const isPrive = document.getElementById('check-prive').checked;
    const pass = document.getElementById('room-pass-input').value;

    if (!uid) return alert("UID ilaina!");

    const roomData = {
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
    };

    await setDoc(doc(db, "rooms", uid), roomData);
    myRole = 'creator';
    enterGameView(uid);
};

window.joinRoom = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    const snap = await getDoc(roomRef);
    const room = snap.data();

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

// --- 6. GAMEPLAY SYNC & UI ---

function enterGameView(roomId) {
    currentRoomId = roomId;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden'); // Ataovy azo antoka fa misy ity ID ity

    onSnapshot(doc(db, "rooms", roomId), (snap) => {
        const game = snap.data();
        if (!game) return;
        renderGameBoard(game);
    });
}

function renderGameBoard(game) {
    const grid = document.getElementById('fanorona-grid');
    grid.innerHTML = "";
    const myNum = (myRole === 'creator') ? 1 : 2;

    game.board.forEach((row, r) => {
        row.forEach((cell, c) => {
            const spot = document.createElement('div');
            spot.className = "grid-spot";
            
            if (cell !== 0) {
                const stone = document.createElement('div');
                stone.className = `stone ${cell === 1 ? 'black' : 'white'} animate-pop`;
                if (selectedStone?.r === r && selectedStone?.c === c) stone.classList.add('selected');
                spot.appendChild(stone);
            }

            spot.onclick = async () => {
                if (game.turn !== auth.currentUser.uid) return;

                if (cell === myNum) {
                    selectedStone = { r, c };
                    renderGameBoard(game); // Refresh highlight
                } else if (selectedStone && cell === 0) {
                    if (isValidMove(selectedStone.r, selectedStone.c, r, c, game.board)) {
                        const newBoard = executeMove(selectedStone.r, selectedStone.c, r, c, game.board, myNum);
                        const nextTurn = (myRole === 'creator') ? game.opponent.id : game.creator.id;
                        
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
    document.getElementById('user-avatar').src = user.photoURL;
    document.getElementById('user-name').innerText = user.displayName;
}
