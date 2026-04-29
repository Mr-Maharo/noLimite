import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import {
    getAuth,
    signInWithPopup,
    GoogleAuthProvider,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    doc,
    setDoc,
    updateDoc,
    onSnapshot,
    serverTimestamp,
    addDoc,
    query,
    orderBy,
    where,
    limit,
    getDocs,
    getDoc,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ================= CONFIG =================
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    projectId: "nolimite-29e0b",
    databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentRoomId = null;
let selectedCell = null;
let myCurrentUid = null;
let isAiThinking = false;
let turnTimerInterval = null;

// ================= SOUND =================
const sounds = {
    click: new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_2c8d2e3e4d.mp3'),
    invite: new Audio('https://cdn.pixabay.com/audio/2022/03/10/audio_5a6b7c8d9e.mp3'),
    win: new Audio('https://cdn.pixabay.com/audio/2022/03/15/audio_1a2b3c4d5e.mp3')
};

function playSound(type) {
    if (sounds[type]) {
        sounds[type].currentTime = 0;
        sounds[type].play().catch(e => {});
    }
}

// ================= HELPER =================
function getUserId() {
    return myCurrentUid || auth.currentUser?.uid || null;
}

// ================= AI LOGIC =================
async function aiMove(game) {
    if (game.turn!== 'AI_BOT' || game.status!== 'playing') return;

    await new Promise(resolve => setTimeout(resolve, 1200));

    const aiStones = game.board.filter(cell => cell.value === 2);
    const emptyCells = game.board.filter(cell => cell.value === 0);

    if (aiStones.length === 0 || emptyCells.length === 0) return;

    // AI tsotra: manatona centre
    const centerCell = game.board.find(c => c.x === 1 && c.y === 1);
    let bestMove = null;

    if (centerCell.value === 0) {
        // Raha malalaka ny centre dia aleo
        const nearestStone = aiStones.reduce((prev, curr) => {
            const prevDist = Math.abs(prev.x - 1) + Math.abs(prev.y - 1);
            const currDist = Math.abs(curr.x - 1) + Math.abs(curr.y - 1);
            return currDist < prevDist? curr : prev;
        });
        bestMove = { from: nearestStone, to: centerCell };
    } else {
        // Random move
        const randomStone = aiStones[Math.floor(Math.random() * aiStones.length)];
        const validMoves = emptyCells.filter(cell => {
            const dx = Math.abs(cell.x - randomStone.x);
            const dy = Math.abs(cell.y - randomStone.y);
            return dx <= 1 && dy <= 1;
        });
        if (validMoves.length > 0) {
            bestMove = {
                from: randomStone,
                to: validMoves[Math.floor(Math.random() * validMoves.length)]
            };
        }
    }

    if (bestMove) {
        const newBoard = game.board.map(cell => {
            if (cell.id === bestMove.from.id) return {...cell, value: 0 };
            if (cell.id === bestMove.to.id) return {...cell, value: 2 };
            return cell;
        });

        await updateDoc(doc(db, "rooms", currentRoomId), {
            board: newBoard,
            turn: game.creator.id
        });
        playSound('click');
    }
}

// ================= LOGIN GUEST =================
document.getElementById("btn-guest").onclick = async () => {
    let guestUid = localStorage.getItem("nolimite_guest_uid");
    let guestName = localStorage.getItem("nolimite_guest_name") || "Mpanandrana_" + Math.floor(Math.random() * 1000);
    let guestAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=" + guestName;

    if (!guestUid) {
        guestUid = "GUEST_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        localStorage.setItem("nolimite_guest_uid", guestUid);
        localStorage.setItem("nolimite_guest_name", guestName);
    }

    myCurrentUid = guestUid;

    const guestData = {
        uid: guestUid,
        name: guestName,
        avatar: guestAvatar,
        status: "online",
        isGuest: true,
        lastSeen: serverTimestamp()
    };

    try {
        await setDoc(doc(db, "users", guestUid), guestData, { merge: true });
        setupGuestUI(guestData);
    } catch (e) {
        console.error("Login Guest Error: ", e);
    }
};

function setupGuestUI(user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");
    document.getElementById("user-name").innerText = user.name;
    document.getElementById("user-avatar").src = user.avatar;
    initLobby();
    initPlayerList();
    initInvites(user.uid);
}

// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myCurrentUid = user.uid;
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("lobby-screen").classList.remove("hidden");

        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        let finalName = user.displayName;
        let finalAvatar = user.photoURL;

        if (userSnap.exists()) {
            const data = userSnap.data();
            finalName = data.name || user.displayName;
            finalAvatar = data.avatar || user.photoURL;
        }

        await setDoc(userRef, {
            uid: user.uid,
            name: finalName,
            avatar: finalAvatar,
            status: "online",
            lastSeen: serverTimestamp()
        }, { merge: true });

        setupGuestUI({ uid: user.uid, name: finalName, avatar: finalAvatar });
    } else {
        if (!localStorage.getItem("nolimite_guest_uid")) {
            document.getElementById("login-screen").classList.remove("hidden");
            document.getElementById("lobby-screen").classList.add("hidden");
        }
    }
});

window.addEventListener("beforeunload", async () => {
    const uid = getUserId();
    if (uid) {
        await updateDoc(doc(db, "users", uid), { status: "offline" });
    }
});

// ================= BUTTONS & MODALS =================
document.getElementById("btn-google").onclick = () => signInWithPopup(auth, provider);
document.getElementById("btn-create-room").onclick = () => document.getElementById("modal-create").classList.remove("hidden");
document.getElementById("room-type").onchange = function () {
    document.getElementById("room-password").style.display = this.value === "private"? "block" : "none";
};

// ================= AUTO-DELETE =================
async function autoDeleteRoom(roomId) {
    setTimeout(async () => {
        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);
        if (snap.exists() && snap.data().status === "waiting") {
            await deleteDoc(roomRef);
        }
    }, 5 * 60 * 1000);
}

window.deleteRoom = async (roomId) => {
    if (confirm("Tena hovafanao ve ity efitra ity?")) {
        try {
            await deleteDoc(doc(db, "rooms", roomId));
            leaveRoomLobby();
        } catch (e) {
            console.error("Error deleting room:", e);
        }
    }
};

// ================= INVITE SYSTEM =================
window.sendInvite = async (targetUid) => {
    const uid = getUserId();
    if (!uid) return;
    const myName = document.getElementById("user-name").innerText;
    await addDoc(collection(db, "invites"), {
        from: uid,
        fromName: myName,
        to: targetUid,
        status: "pending",
        createdAt: serverTimestamp()
    });
    playSound('invite');
    alert("Nalefa ny fanasana!");
};

function initInvites(uid) {
    const q = query(collection(db, "invites"), where("to", "==", uid), where("status", "==", "pending"));
    onSnapshot(q, (snap) => {
        snap.forEach(d => showInviteUI(d.id, d.data()));
    });
}

function showInviteUI(inviteId, invite) {
    if (document.getElementById("invite-" + inviteId)) return;
    const container = document.getElementById("invite-notifications");
    const box = document.createElement("div");
    box.id = "invite-" + inviteId;
    box.className = "invite-popup glass animate-pop";
    box.innerHTML = `
        <p>🎮 <b>${invite.fromName}</b> manasa anao!</p>
        <div style="display:flex; gap:10px; margin-top:10px;">
            <button class="btn-save" onclick="acceptInvite('${inviteId}', '${invite.from}', '${invite.fromName}')">Ekena</button>
            <button class="btn-cancel" onclick="rejectInvite('${inviteId}')">Tsia</button>
        </div>
    `;
    container.appendChild(box);
}

window.acceptInvite = async (inviteId, senderUid, senderName) => {
    const uid = getUserId();
    if (!uid) return;
    document.getElementById("invite-" + inviteId)?.remove();
    const roomId = "INVITE_" + Math.floor(Math.random() * 10000);
    const myName = document.getElementById("user-name").innerText;
    const myAvatar = document.getElementById("user-avatar").src;

    await setDoc(doc(db, "rooms", roomId), {
        creator: { id: senderUid, name: senderName, avatar: "" },
        opponent: { id: uid, name: myName, avatar: myAvatar },
        status: "playing",
        turn: senderUid,
        board: initBoard(),
        createdAt: serverTimestamp()
    });
    await updateDoc(doc(db, "invites", inviteId), { status: "accepted" });
    enterGame(roomId);
};

window.rejectInvite = async (inviteId) => {
    document.getElementById("invite-" + inviteId)?.remove();
    await updateDoc(doc(db, "invites", inviteId), { status: "rejected" });
};

// ================= LOBBY & PLAYERS =================
async function initPlayerList() {
    const q = query(collection(db, "users"), where("status", "==", "online"), limit(20));
    onSnapshot(q, (snapshot) => {
        const listSidebar = document.getElementById("online-players");
        const listMain = document.getElementById("players-list-dynamic");
        if (listSidebar) listSidebar.innerHTML = "";
        if (listMain) listMain.innerHTML = "";

        snapshot.forEach((doc) => {
            const userData = doc.data();
            if (userData.uid!== getUserId()) {
                const html = `
                    <div class="player-item">
                        <img src="${userData.avatar}" class="player-avatar-mini">
                        <div class="player-info">
                            <span class="player-name-mini">${userData.name}</span>
                            <div class="status-indicator"><span class="dot-online"></span> Online</div>
                        </div>
                        <button class="btn-invite-mini" onclick="sendInvite('${userData.uid}')">Hantsy</button>
                    </div>`;
                if (listSidebar) listSidebar.innerHTML += html;
                if (listMain) listMain.innerHTML += html;
            }
        });
    });
}

function initLobby() {
    onSnapshot(collection(db, "rooms"), (snap) => {
        const publicList = document.getElementById("rooms-list-dynamic");
        const myRoomsList = document.getElementById("my-rooms-list");

        if (publicList) publicList.innerHTML = "";
        if (myRoomsList) myRoomsList.innerHTML = "";

        snap.forEach(d => {
            const r = d.data();
            const roomId = d.id;
            if (r.status === "waiting") {
                const isPrivate = r.type === "private"? "🔒" : "🌐";
                const playerBadge = `<span class="badge-waiting">● 1/2 miandry</span>`;

                if (r.creator.id === getUserId()) {
                    if (myRoomsList) {
                        myRoomsList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>🏠 ${roomId}</span>
                                <div class="room-actions">
                                    <button class="btn-cancel" onclick="deleteRoom('${roomId}')">🗑️</button>
                                    <button onclick="viewRoom('${roomId}')">Hiditra</button>
                                </div>
                            </div>`;
                    }
                } else if (r.type!== "private") {
                    if (publicList) {
                        publicList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>${isPrivate} ${roomId}</span>
                                ${playerBadge}
                                <button onclick="viewRoom('${roomId}')">Hijery</button>
                            </div>`;
                    }
                }
            }
        });
    });

    // Search functionality
    document.getElementById("search-player").addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll("#players-list-dynamic.player-item").forEach(player => {
            const name = player.querySelector(".player-name-mini").innerText.toLowerCase();
            player.style.display = name.includes(searchTerm)? "flex" : "none";
        });
    });

    document.getElementById("search-room").addEventListener("input", (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll("#rooms-list-dynamic.room-card").forEach(room => {
            const roomName = room.querySelector("span").innerText.toLowerCase();
            room.style.display = roomName.includes(searchTerm)? "flex" : "none";
        });
    });
}

// ================= ROOM LOBBY =================
window.viewRoom = async (id) => {
    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return alert("Tsy misy io efitra io");

    const r = roomSnap.data();

    if (r.type === "private" && r.creator.id!== getUserId()) {
        if (prompt("Teny miafina:")!== r.password) return alert("Diso!");
    }

    currentRoomId = id;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("room-lobby-screen").classList.remove("hidden");

    onSnapshot(roomRef, (snap) => {
        const game = snap.data();
        if (!game) return;
        renderRoomLobby(game, id);

        if (game.status === "playing") {
            enterGame(id);
        }
    });
};

function renderRoomLobby(room, roomId) {
    const lobbyEl = document.getElementById("room-lobby-content");
    const isCreator = room.creator.id === getUserId();
    const isFull = room.opponent?.id;
    const isPlayingWithAI = room.opponent?.id === 'AI_BOT';

    lobbyEl.innerHTML = `
        <div class="room-lobby-header">
            <h2>🏠 ${roomId}</h2>
            <button onclick="leaveRoomLobby()" class="btn-exit">← Hiverina</button>
        </div>

        <div class="players-vs">
            <div class="player-slot ${isCreator? 'you' : ''}">
                <img src="${room.creator.avatar}" class="player-img-large">
                <h3>${room.creator.name}</h3>
                <span class="badge-host">Mpamorona</span>
            </div>

            <div class="vs-text">VS</div>

            <div class="player-slot ${!isCreator && isFull? 'you' : ''}">
                ${isFull? `
                    <img src="${room.opponent.avatar}" class="player-img-large">
                    <h3>${room.opponent.name}</h3>
                    ${isPlayingWithAI? '<span class="badge-ai">🤖 AI</span>' : ''}
                ` : `
                    <div class="waiting-player">
                        <div class="spinner"></div>
                        <p>Miandry mpifanandrina...</p>
                        ${isCreator? `<button onclick="playWithAI('${roomId}')" class="btn-ai">🤖 Milalao miaraka amin'ny AI</button>` : ''}
                    </div>
                `}
            </div>
        </div>

        <div class="lobby-actions">
            ${isCreator? `
                ${isFull? `<button onclick="startGame('${roomId}')" class="btn-primary-large">🎮 Atombohy ny lalao</button>` : ''}
                <button onclick="deleteRoom('${roomId}')" class="btn-cancel">🗑️ Fafao ny efitra</button>
            ` : `
                ${!isFull? `<button onclick="joinRoom('${roomId}')" class="btn-primary-large">Hiditra amin'ny efitra</button>` : ''}
            `}
        </div>
    `;
}

window.startGame = async (roomId) => {
    await updateDoc(doc(db, "rooms", roomId), {
        status: "playing",
        board: initBoard(),
        turn: getUserId()
    });
};

window.leaveRoomLobby = () => {
    document.getElementById("room-lobby-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");
    currentRoomId = null;
};

window.joinRoom = async (id) => {
    const uid = getUserId();
    if (!uid) return alert("Tsy tafiditra ianao");

    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const r = roomSnap.data();

    if (r.opponent?.id) return alert("Efa feno ity efitra ity");

    await updateDoc(roomRef, {
        opponent: {
            id: uid,
            name: document.getElementById("user-name").innerText,
            avatar: document.getElementById("user-avatar").src
        }
    });
};

window.playWithAI = async (roomId) => {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, {
        opponent: {
            id: 'AI_BOT',
            name: 'NOLIMITE AI',
            avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=NoLimiteAI'
        },
        status: "playing",
        board: initBoard(),
        turn: getUserId()
    });
    playSound('invite');
};

// ================= PROFILE EDIT =================
window.openEditModal = () => {
    document.getElementById("edit-name").value = document.getElementById("user-name").innerText;
    document.getElementById("edit-avatar").value = document.getElementById("user-avatar").src;
    document.getElementById("modal-edit-profile").classList.remove("hidden");
};

window.closeEditModal = () => {
    document.getElementById("modal-edit-profile").classList.add("hidden");
};

document.getElementById("btn-save-profile").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;
    let newName = document.getElementById("edit-name").value.trim();
    const newAvatar = document.getElementById("edit-avatar").value.trim();

    if (newName.length === 0 || newName.length > 8) {
        alert("Anarana 1 hatramin'ny 8 litera ihany azafady!");
        return;
    }

    try {
        await updateDoc(doc(db, "users", uid), {
            name: newName,
            avatar: newAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + uid
        });
        document.getElementById("user-name").innerText = newName;
        document.getElementById("user-avatar").src = newAvatar;
        closeEditModal();
    } catch (error) {
        alert("Tsy nety ny fanovana.");
    }
};

// ================= GAME LOGIC =================
function initBoard() {
    return [
        { id: 0, x: 0, y: 0, value: 1 }, { id: 1, x: 1, y: 0, value: 1 }, { id: 2, x: 2, y: 0, value: 1 },
        { id: 3, x: 0, y: 1, value: 0 }, { id: 4, x: 1, y: 1, value: 0 }, { id: 5, x: 2, y: 1, value: 0 },
        { id: 6, x: 0, y: 2, value: 2 }, { id: 7, x: 1, y: 2, value: 2 }, { id: 8, x: 2, y: 2, value: 2 }
    ];
}

window.enterGame = async (id) => {
    currentRoomId = id;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("room-lobby-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    initChat(id);

    const roomRef = doc(db, "rooms", id);

    onSnapshot(roomRef, async (snap) => {
        const game = snap.data();
        if (!game) return;
        render(game);

        if (turnTimerInterval) clearInterval(turnTimerInterval);

        if (game.status === 'playing') {
            // Timer
            const timerEl = document.getElementById("turn-timer");
            if (timerEl) {
                let timeLeft = 30;
                timerEl.innerText = `⏱️ ${timeLeft}s`;
                turnTimerInterval = setInterval(async () => {
                    timeLeft--;
                    timerEl.innerText = `⏱️ ${timeLeft}s`;
                    if (timeLeft <= 0) {
                        clearInterval(turnTimerInterval);
                        if (game.turn === getUserId()) {
                            const nextTurn = game.turn === game.creator.id? game.opponent.id : game.creator.id;
                            await updateDoc(roomRef, { turn: nextTurn });
                        }
                    }
                }, 1000);
            }

            // AI Move
            if (game.turn === 'AI_BOT' &&!isAiThinking) {
                isAiThinking = true;
                await aiMove(game);
                isAiThinking = false;
            }

            // Check Winner
            const winner = checkWinner(game.board, game.creator.id, game.opponent.id);
            if (winner) {
                clearInterval(turnTimerInterval);
                await updateDoc(roomRef, { status: 'finished', winner: winner });
            }
        }

        if (game.status === 'finished' && game.winner) {
            const winnerName = game.winner === game.creator.id? game.creator.name : game.opponent.name;
            setTimeout(() => {
                playSound('win');
                alert(`🎉 ${winnerName} no nandresy!`);
                leaveGame();
            }, 500);
        }
    });
};

function render(game) {
    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";
    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot" + (selectedCell?.id === cell.id? " active-spot" : "");

        if (cell.value) {
            const stone = document.createElement("div");
            stone.className = `stone ${cell.value === 1? 'black-stone' : 'white-stone'} animate-pop`;
            div.appendChild(stone);
        }

        div.onclick = null;
        div.addEventListener('click', () => {
            playSound('click');
            handleMove(cell, game);
        });
        div.addEventListener('touchend', (e) => {
            e.preventDefault();
            playSound('click');
            handleMove(cell, game);
        });

        grid.appendChild(div);
    });

    const turnEl = document.getElementById("turn-indicator");
    if (turnEl) {
        const isMyTurn = game.turn === getUserId();
        turnEl.innerText = isMyTurn? "Anjaranao!" : "Anjaran'ny mpifanandrina";
        turnEl.className = isMyTurn? "my-turn" : "opp-turn";
    }
}

async function handleMove(cell, game) {
    const uid = getUserId();
    if (game.turn!== uid) return;

    const myVal = game.creator.id === uid? 1 : 2;
    let b = [...game.board];

    if (!selectedCell) {
        if (cell.value === myVal) {
            selectedCell = cell;
            render(game);
        }
    } else {
        const dx = Math.abs(cell.x - selectedCell.x);
        const dy = Math.abs(cell.y - selectedCell.y);

        if (cell.value === 0 && dx <= 1 && dy <= 1) {
            b[selectedCell.id].value = 0;
            b[cell.id].value = myVal;
            selectedCell = null;
            await finalizeTurn(b, game);
        } else {
            selectedCell = (cell.value === myVal)? cell : null;
            render(game);
        }
    }
}

async function finalizeTurn(b, game) {
    const uid = getUserId();
    const myVal = game.creator.id === uid? 1 : 2;
    const winner = checkWinner(b, game.creator.id, game.opponent.id);
    const nextTurn = game.turn === game.creator.id? game.opponent.id : game.creator.id;

    await updateDoc(doc(db, "rooms", currentRoomId), {
        board: b,
        turn: winner? "end" : nextTurn,
        winner: winner
    });
}

function checkWinner(board, creatorId, opponentId) {
    const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    for (let p of winPatterns) {
        if (board[p[0]].value === 1 && board[p[1]].value === 1 && board[p[2]].value === 1) {
            return creatorId;
        }
        if (board[p[0]].value === 2 && board[p[1]].value === 2 && board[p[2]].value === 2) {
            return opponentId;
        }
    }
    return null;
}

window.leaveGame = async () => {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    if (currentRoomId) {
        await deleteDoc(doc(db, "rooms", currentRoomId));
    }
    currentRoomId = null;
    selectedCell = null;
    document.getElementById("game-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");
};

// ================= CHAT =================
function initChat(roomId) {
    const chatMessages = document.getElementById("chat-messages");
    const chatInput = document.getElementById("chat-input");
    const chatSend = document.getElementById("chat-send");

    chatMessages.innerHTML = "";

    const q = query(collection(db, "rooms", roomId, "chat"), orderBy("timestamp", "asc"));
    onSnapshot(q, (snap) => {
        chatMessages.innerHTML = "";
        snap.forEach(d => {
            const msg = d.data();
            const isMe = msg.senderId === getUserId();
            const div = document.createElement("div");
            div.className = isMe? "chat-me" : "chat-opp";
            div.innerText = `${msg.senderName}: ${msg.text}`;
            chatMessages.appendChild(div);
        });
        chatMessages.scrollTop = chatMessages.scrollHeight;
    });

    chatSend.onclick = async () => {
        const text = chatInput.value.trim();
        if (!text) return;
        await addDoc(collection(db, "rooms", roomId, "chat"), {
            senderId: getUserId(),
            senderName: document.getElementById("user-name").innerText,
            text: text,
            timestamp: serverTimestamp()
        });
        chatInput.value = "";
    };

    chatInput.onkeypress = (e) => {
        if (e.key === "Enter") chatSend.click();
    };
}

// ================= QUICK PLAY =================
document.getElementById("btn-quick-play").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;

    const q = query(collection(db, "rooms"), where("status", "==", "waiting"), limit(10));
    const snap = await getDocs(q);
    let foundRoom = null;

    snap.forEach(d => {
        const r = d.data();
        if (r.creator.id!== uid && r.type!== "private") {
            foundRoom = d.id;
        }
    });

    if (foundRoom) {
        viewRoom(foundRoom);
    } else {
        const autoId = "QUICK_" + Math.floor(Math.random() * 10000);
        await setDoc(doc(db, "rooms", autoId), {
            creator: {
                id: uid,
                name: document.getElementById("user-name").innerText,
                avatar: document.getElementById("user-avatar").src
            },
            status: "waiting",
            type: "public",
            createdAt: serverTimestamp()
        });
        autoDeleteRoom(autoId);
        viewRoom(autoId);
    }
};

// ================= ROOM CREATION =================
document.getElementById("btn-confirm-create").onclick = async () => {
    const uid = getUserId();
    if (!uid) return;

    const name = document.getElementById("room-uid-input").value || "ROOM_" + Math.floor(Math.random() * 10000);
    const type = document.getElementById("room-type").value;
    const pass = document.getElementById("room-password").value;

    await setDoc(doc(db, "rooms", name), {
        creator: {
            id: uid,
            name: document.getElementById("user-name").innerText,
            avatar: document.getElementById("user-avatar").src
        },
        status: "waiting",
        type: type,
        password: pass,
        createdAt: serverTimestamp()
    });

    autoDeleteRoom(name);
    document.getElementById("modal-create").classList.add("hidden");
    viewRoom(name);
};

// ================= LOGOUT =================
document.getElementById("btn-logout").onclick = async () => {
    if (confirm("Hivoaka ve ianao?")) {
        await auth.signOut();
        localStorage.removeItem("nolimite_guest_uid");
        localStorage.removeItem("nolimite_guest_name");
        location.reload();
    }
};
