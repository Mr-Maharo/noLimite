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
    getDocs
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


// ================= AUTH =================
onAuthStateChanged(auth, async (user) => {

    if (user) {
        document.getElementById("login-screen").classList.add("hidden");
        document.getElementById("lobby-screen").classList.remove("hidden");

        document.getElementById("user-name").innerText = user.displayName;
        document.getElementById("user-avatar").src = user.photoURL;

        await setDoc(doc(db, "users", user.uid), {
            uid: user.uid,
            name: user.displayName,
            avatar: user.photoURL,
            status: "online",
            lastSeen: serverTimestamp()
        }, { merge: true });

        initLobby();
        initPlayerList();
        initInvites(user.uid);

    } else {
        document.getElementById("login-screen").classList.remove("hidden");
    }
});

window.addEventListener("beforeunload", async () => {
    if (auth.currentUser) {
        await updateDoc(doc(db, "users", auth.currentUser.uid), {
            status: "offline"
        });
    }
});


// ================= BUTTONS =================
document.getElementById("btn-google").onclick = () => {
    signInWithPopup(auth, provider);
};

document.getElementById("btn-create-room").onclick = () => {
    document.getElementById("modal-create").classList.remove("hidden");
};

document.querySelector(".close-modal").onclick = () => {
    document.getElementById("modal-create").classList.add("hidden");
};

document.getElementById("room-type").onchange = function () {
    document.getElementById("room-password").style.display =
        this.value === "private" ? "block" : "none";
};


// ================= CREATE ROOM =================
document.getElementById("btn-confirm-create").onclick = async () => {

    if (!auth.currentUser) return;

    const roomName =
        document.getElementById("room-uid-input").value.trim() ||
        "ROOM_" + Math.floor(Math.random() * 10000);

    const type = document.getElementById("room-type").value;
    const password = document.getElementById("room-password").value;

    await setDoc(doc(db, "rooms", roomName), {
        creator: {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL
        },
        status: "waiting",
        type: type,
        password: type === "private" ? password : "",
        createdAt: serverTimestamp()
    });

    document.getElementById("modal-create").classList.add("hidden");
};


// ================= QUICK PLAY =================
document.getElementById("btn-quick-play").onclick = async () => {

    if (!auth.currentUser) {
        alert("Midira aloha");
        return;
    }

    const q = query(
        collection(db, "rooms"),
        where("status", "==", "waiting"),
        limit(5)
    );

    const snap = await getDocs(q);

    let targetRoom = null;

    snap.forEach(d => {
        const r = d.data();
        if (r.creator.id !== auth.currentUser.uid) {
            targetRoom = d.id;
        }
    });

    if (targetRoom) {
        joinRoom(targetRoom);
        return;
    }

    const roomId = "BOT_" + Math.floor(Math.random() * 10000);

    await setDoc(doc(db, "rooms", roomId), {
        creator: {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName
        },
        opponent: {
            id: "bot_id",
            name: "Bot NoLimite (AI)"
        },
        turn: auth.currentUser.uid,
        status: "playing",
        board: initBoard(),
        winner: null
    });

    enterGame(roomId);
};


// ================= GLOBAL FUNCTIONS =================
window.joinRoom = async (id) => {

    await updateDoc(doc(db, "rooms", id), {
        opponent: {
            id: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            avatar: auth.currentUser.photoURL
        },
        status: "playing"
    });

    enterGame(id);
};

window.sendInvite = async (uid, name) => {

    await addDoc(collection(db, "invites"), {
        from: auth.currentUser.uid,
        fromName: auth.currentUser.displayName,
        to: uid,
        toName: name,
        status: "pending",
        createdAt: Date.now()
    });

    alert("Fanasana nalefa ho an'i " + name);
};

window.acceptInvite = async (id, data) => {

    const roomId = "GAME_" + Math.floor(Math.random() * 10000);

    await setDoc(doc(db, "rooms", roomId), {
        creator: {
            id: data.from,
            name: data.fromName
        },
        opponent: {
            id: data.to,
            name: data.toName
        },
        turn: data.from,
        status: "playing",
        board: initBoard(),
        winner: null
    });

    await updateDoc(doc(db, "invites", id), {
        status: "accepted"
    });

    document.getElementById("invite-" + id)?.remove();

    enterGame(roomId);
};


// ================= PLAYER LIST =================
function initPlayerList() {

    const playerDiv = document.getElementById("players-list-dynamic");
    const searchInput = document.getElementById("search-player");

    onSnapshot(collection(db, "users"), (snap) => {

        let allUsers = [];

        snap.forEach(d => {
            const p = d.data();

            if (p.uid && p.uid !== auth.currentUser.uid) {
                allUsers.push(p);
            }
        });

        const renderList = (filter = "") => {

            playerDiv.innerHTML = "";

            const filtered = allUsers.filter(u =>
                u.name.toLowerCase().includes(filter.toLowerCase()) ||
                u.uid.toLowerCase().includes(filter.toLowerCase())
            );

            if (filtered.length === 0) {
                playerDiv.innerHTML =
                    "<div class='no-player'>Tsy misy mpilalao hita...</div>";
                return;
            }

            filtered.forEach(p => {

                const el = document.createElement("div");
                el.className = "player-item glass animate-pop";

                el.innerHTML = `
                    <div class="player-avatar-wrap">
                        <img src="${p.avatar || ''}" class="player-img">
                        <span class="status-dot ${p.status === 'online' ? 'online' : 'offline'}"></span>
                    </div>

                    <div class="player-info">
                        <b>${p.name}</b><br>
                        <small>#${p.uid.substring(0,6)}</small>
                    </div>
                `;

                el.onclick = () => sendInvite(p.uid, p.name);

                playerDiv.appendChild(el);
            });
        };

        renderList();

        if (searchInput) {
            searchInput.oninput = (e) => renderList(e.target.value);
        }
    });
}


// ================= LOBBY =================
function initLobby() {

    onSnapshot(collection(db, "rooms"), (snap) => {

        const div = document.getElementById("rooms-list-dynamic");
        div.innerHTML = "";

        snap.forEach(d => {

            const r = d.data();

            if (r.status === "waiting") {

                div.innerHTML += `
                    <div class="room-card glass animate-pop">
                        <span>🏠 ${d.id}</span>
                        <button onclick="joinRoom('${d.id}')">
                            Hiditra
                        </button>
                    </div>
                `;
            }
        });
    });
}


// ================= INVITES =================
function initInvites(uid) {

    onSnapshot(collection(db, "invites"), (snap) => {

        snap.forEach(d => {

            const i = d.data();

            if (i.to === uid && i.status === "pending") {
                showInviteUI(d.id, i);
            }
        });
    });
}

function showInviteUI(id, invite) {

    if (document.getElementById("invite-" + id)) return;

    const box = document.createElement("div");

    box.id = "invite-" + id;
    box.className = "invite-popup glass animate-pop";

    box.innerHTML = `
        <p>🎮 <b>${invite.fromName}</b> manasa anao</p>

        <button onclick='acceptInvite("${id}", ${JSON.stringify(invite).replace(/"/g, '&quot;')})'>
            Ekena
        </button>
    `;

    document.body.appendChild(box);
}


// ================= GAME =================
function initBoard() {

    let b = [];

    for (let i = 0; i < 9; i++) {
        b.push({
            id: i,
            x: i % 3,
            y: Math.floor(i / 3),
            value: 0
        });
    }

    return b;
}

function enterGame(id) {

    currentRoomId = id;

    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");

    initChat(id);

    onSnapshot(doc(db, "rooms", id), (snap) => {

        const game = snap.data();

        if (!game) return;

        render(game);

        if (game.turn === "bot_id" && !game.winner) {
            setTimeout(() => executeBotMove(game), 1000);
        }

        if (game.winner) {
            alert("🏆 Mpandresy: " + game.winner);
            location.reload();
        }
    });
}

function render(game) {

    const grid = document.getElementById("fanorona-grid");

    grid.innerHTML = "";
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "repeat(3,100px)";

    game.board.forEach(cell => {

        const div = document.createElement("div");
        div.className = "grid-spot";

        if (selectedCell?.id === cell.id) {
            div.classList.add("active-spot");
        }

        if (cell.value) {

            const s = document.createElement("div");

            s.className =
                `stone ${cell.value === 1 ? 'black-stone' : 'white-stone'}`;

            div.appendChild(s);
        }

        div.onclick = () => handleMove(cell, game);

        grid.appendChild(div);
    });
}

async function handleMove(cell, game) {

    if (game.turn !== auth.currentUser.uid) return;

    const myVal =
        game.creator.id === auth.currentUser.uid ? 1 : 2;

    let b = [...game.board];

    const myStones =
        b.filter(c => c.value === myVal).length;

    if (myStones < 3) {

        if (cell.value === 0) {
            b[cell.id].value = myVal;
            finalizeTurn(b, game);
        }

    } else {

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

                finalizeTurn(b, game);

            } else {
                selectedCell = null;
                render(game);
            }
        }
    }
}

function finalizeTurn(b, game) {

    const winPatterns = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];

    let winner = null;

    for (let p of winPatterns) {

        if (
            b[p[0]].value !== 0 &&
            b[p[0]].value === b[p[1]].value &&
            b[p[0]].value === b[p[2]].value
        ) {
            winner = auth.currentUser.displayName;
            break;
        }
    }

    const nextTurn =
        game.turn === game.creator.id
            ? game.opponent?.id || game.creator.id
            : game.creator.id;

    updateDoc(doc(db, "rooms", currentRoomId), {
        board: b,
        turn: winner ? "end" : nextTurn,
        winner: winner
    });
}


// ================= BOT =================
async function executeBotMove(game) {

    let b = [...game.board];

    const botVal = 2;

    const stones = b.filter(c => c.value === botVal);

    if (stones.length < 3) {

        const empty = b.filter(c => c.value === 0);
        const target = empty[Math.floor(Math.random() * empty.length)];

        b[target.id].value = botVal;

    } else {

        for (let s of stones) {

            const moves = b.filter(c =>
                c.value === 0 &&
                Math.abs(c.x - s.x) <= 1 &&
                Math.abs(c.y - s.y) <= 1
            );

            if (moves.length > 0) {

                const target =
                    moves[Math.floor(Math.random() * moves.length)];

                b[s.id].value = 0;
                b[target.id].value = botVal;
                break;
            }
        }
    }

    const winPatterns = [
        [0,1,2],[3,4,5],[6,7,8],
        [0,3,6],[1,4,7],[2,5,8],
        [0,4,8],[2,4,6]
    ];

    let botWins = false;

    for (let p of winPatterns) {

        if (
            b[p[0]].value === botVal &&
            b[p[1]].value === botVal &&
            b[p[2]].value === botVal
        ) {
            botWins = true;
            break;
        }
    }

    await updateDoc(doc(db, "rooms", currentRoomId), {
        board: b,
        turn: botWins ? "end" : game.creator.id,
        winner: botWins ? "Bot NoLimite" : null
    });
}


// ================= CHAT =================
function initChat(roomId) {

    const msgDiv = document.getElementById("chat-messages");

    document.getElementById("send-chat").onclick = async () => {

        const txt = document.getElementById("chat-text").value.trim();

        if (!txt) return;

        await addDoc(collection(db, "rooms", roomId, "messages"), {
            uid: auth.currentUser.uid,
            name: auth.currentUser.displayName,
            text: txt,
            time: serverTimestamp()
        });

        document.getElementById("chat-text").value = "";
    };

    onSnapshot(
        query(
            collection(db, "rooms", roomId, "messages"),
            orderBy("time", "asc")
        ),
        (snap) => {

            msgDiv.innerHTML = "";

            snap.forEach(m => {

                const d = m.data();

                msgDiv.innerHTML += `
                    <div class="chat-bubble ${d.uid === auth.currentUser.uid ? 'me' : 'them'}">
                        <p><b>${d.name}:</b> ${d.text}</p>
                    </div>
                `;
            });

            msgDiv.scrollTop = msgDiv.scrollHeight;
        }
    );
}
