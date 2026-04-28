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
    getDoc
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

        // Famakiana ny angona avy ao amin'ny Firestore aloha (Persistence)
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);
        
        let finalName = user.displayName;
        let finalAvatar = user.photoURL;

        if (userSnap.exists()) {
            const data = userSnap.data();
            finalName = data.name || user.displayName;
            finalAvatar = data.avatar || user.photoURL;
        }

        // Havaozina ny UI (Lobby Sidebar)
        document.getElementById("user-name").innerText = finalName;
        document.getElementById("user-avatar").src = finalAvatar;

        // Tehirizina nefa mampiasa merge mba tsy ho voafafa ny fanovana
        await setDoc(userRef, {
            uid: user.uid,
            name: finalName,
            avatar: finalAvatar,
            status: "online",
            lastSeen: serverTimestamp()
        }, { merge: true });

        initLobby();
        initPlayerList();
        initInvites(user.uid);
    } else {
        document.getElementById("login-screen").classList.remove("hidden");
        document.getElementById("lobby-screen").classList.add("hidden");
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
 // ------- Function hisintonana ny mpilalao online
async function initPlayerList() {
    const q = query(collection(db, "users"), where("status", "==", "online"), limit(20));
    
    onSnapshot(q, (snapshot) => {
        const listDiv = document.getElementById("online-players");
        listDiv.innerHTML = ""; // Diovina aloha

        snapshot.forEach((doc) => {
            const userData = doc.data();
            // Tsy aseho ny tena ato anaty lisitra
            if (userData.uid !== auth.currentUser.uid) {
                listDiv.innerHTML += `
                    <div class="player-item">
                        <img src="${userData.avatar}" class="player-avatar-mini">
                        <div class="player-info">
                            <span class="player-name-mini">${userData.name}</span>
                            <div class="status-indicator"><span class="dot-online"></span> Online</div>
                        </div>
                        <button class="btn-invite-mini" onclick="sendInvite('${userData.uid}')">Hantsy</button>
                    </div>
                `;
            }
        });
    });
}
// ================= CREATE ROOM =================
document.getElementById("room-type").onchange = function () {
    document.getElementById("room-password").style.display =
        this.value === "private" ? "block" : "none";
};

document.getElementById("btn-confirm-create").onclick = async () => {
    if (!auth.currentUser) return;

    const roomName = document.getElementById("room-uid-input").value.trim() || 
                     "ROOM_" + Math.floor(Math.random() * 10000);
    const type = document.getElementById("room-type").value;
    const password = document.getElementById("room-password").value;

    if (type === "private" && !password) {
        alert("Ampidiro ny teny miafina ho an'ny efitra mihidy!");
        return;
    }

    await setDoc(doc(db, "rooms", roomName), {
        creator: {
            id: auth.currentUser.uid,
            name: document.getElementById("user-name").innerText,
            avatar: document.getElementById("user-avatar").src
        },
        status: "waiting",
        type: type,
        password: type === "private" ? password : "",
        createdAt: serverTimestamp()
    });

    document.getElementById("modal-create").classList.add("hidden");
};

// ================= GLOBAL FUNCTIONS =================
window.joinRoom = async (id) => {
    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) return;
    const roomData = roomSnap.data();

    // Fanadihadiana momba ny efitra mihidy
    if (roomData.type === "private") {
        const passInput = prompt("Ampidiro ny teny miafina:");
        if (passInput !== roomData.password) {
            alert("Diso ny teny miafina!");
            return;
        }
    }

    await updateDoc(roomRef, {
        opponent: {
            id: auth.currentUser.uid,
            name: document.getElementById("user-name").innerText,
            avatar: document.getElementById("user-avatar").src
        },
        status: "playing"
    });

    enterGame(id);
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
    const user = auth.currentUser;
    if (!user) return;

    let newName = document.getElementById("edit-name").value.trim().replace(/\s+/g, ' ');
    const newAvatar = document.getElementById("edit-avatar").value.trim();

    if (newName.length === 0 || newName.length > 8 || !(/^[a-zA-Z0-9 ]+$/.test(newName))) {
        alert("Anarana tsy manara-penitra (8 litera max, tsy misy marika hafahafa)!");
        return;
    }

    try {
        await updateDoc(doc(db, "users", user.uid), {
            name: newName,
            avatar: newAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.uid
        });

        document.getElementById("user-name").innerText = newName;
        if (newAvatar) document.getElementById("user-avatar").src = newAvatar;

        alert("Vita soa aman-tsara!");
        closeEditModal();
    } catch (e) {
        alert("Tsy nety ny fanovana.");
    }
};

// ================= LOBBY & PLAYER LIST (TOY NY TALOHA) =================
function initPlayerList() {
    const playerDiv = document.getElementById("players-list-dynamic");
    onSnapshot(collection(db, "users"), (snap) => {
        playerDiv.innerHTML = "";
        snap.forEach(d => {
            const p = d.data();
            if (p.uid && p.uid !== auth.currentUser.uid) {
                const el = document.createElement("div");
                el.className = "player-item glass animate-pop";
                el.innerHTML = `
                    <div class="player-avatar-wrap">
                        <img src="${p.avatar || ''}" class="player-img">
                        <span class="status-dot ${p.status === 'online' ? 'online' : 'offline'}"></span>
                    </div>
                    <div class="player-info"><b>${p.name}</b><br><small>#${p.uid.substring(0,6)}</small></div>
                `;
                el.onclick = () => sendInvite(p.uid, p.name);
                playerDiv.appendChild(el);
            }
        });
    });
}

function initLobby() {
    onSnapshot(collection(db, "rooms"), (snap) => {
        const div = document.getElementById("rooms-list-dynamic");
        div.innerHTML = "";
        snap.forEach(d => {
            const r = d.data();
            if (r.status === "waiting") {
                const isPrivate = r.type === "private" ? "🔒" : "🌐";
                div.innerHTML += `
                    <div class="room-card glass animate-pop">
                        <span>${isPrivate} ${d.id}</span>
                        <button onclick="joinRoom('${d.id}')">Hiditra</button>
                    </div>
                `;
            }
        });
    });
}

// ... Tohizo eto ny ambin'ny kaody (invites, game, bot, sns) izay efa nanananao ...
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
// --- FUNCTIONS HANOKAFANA NY MODAL ---
window.openEditModal = () => {
    const currentName = document.getElementById("user-name").innerText;
    const currentAvatar = document.getElementById("user-avatar").src;
    
    document.getElementById("edit-name").value = currentName;
    document.getElementById("edit-avatar").value = currentAvatar;
    document.getElementById("modal-edit-profile").classList.remove("hidden");
};

window.closeEditModal = () => {
    document.getElementById("modal-edit-profile").classList.add("hidden");
};

// --- LOGIKA HITRERIZANA NY FANOVANA ---
document.getElementById("btn-save-profile").onclick = async () => {
    const user = auth.currentUser;
    if (!user) return;

    let newName = document.getElementById("edit-name").value;
    const newAvatar = document.getElementById("edit-avatar").value.trim();

    // 1. "Clean Name" - fafana ny spasy be loatra
    const cleanedName = newName.trim().replace(/\s+/g, ' ');

    // 2. Validation: Tsy maintsy misy litera
    if (cleanedName.length === 0) {
        alert("Ampidiro ny anaranao!");
        return;
    }

    // 3. Validation: 8 characters max
    if (cleanedName.length > 8) {
        alert("Tsy mahazo mihoatra ny 8 litera!");
        return;
    }

    // 4. Validation: Litera, tarehimarika, ary spasy ihany
    const regex = /^[a-zA-Z0-9 ]+$/;
    if (!regex.test(cleanedName)) {
        alert("Litera, tarehimarika, ary spasy ihany no azo ampiasaina!");
        return;
    }

    try {
        // Havaozina ao amin'ny Firestore
        await updateDoc(doc(db, "users", user.uid), {
            name: cleanedName,
            avatar: newAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.uid
        });

        // Havaozina ny UI
        document.getElementById("user-name").innerText = cleanedName;
        if (newAvatar) document.getElementById("user-avatar").src = newAvatar;

        alert("Vita soa aman-tsara!");
        closeEditModal();
        
    } catch (error) {
        console.error("Error:", error);
        alert("Tsy nety ny fanovana.");
    }
};
// ================= QUICK PLAY FUNCTION =================
document.getElementById("btn-quick-play").onclick = async () => {

    if (!auth.currentUser) {
        alert("Midira aloha vao afaka milalao!");
        return;
    }

    // 1. Mitady efitra "waiting" (Efitra efa misy mpilalao miandry)
    const q = query(
        collection(db, "rooms"),
        where("status", "==", "waiting"),
        limit(10)
    );

    const snap = await getDocs(q);
    let targetRoomId = null;

    snap.forEach(d => {
        const r = d.data();
        // Tsy miditra amin'ny efitra noforonintsika ihany
        if (r.creator.id !== auth.currentUser.uid && r.type !== "private") {
            targetRoomId = d.id;
        }
    });

    // 2. Raha nahita efitra dia miditra avy hatrany
    if (targetRoomId) {
        joinRoom(targetRoomId);
        return;
    }

    // 3. Raha tsy nisy efitra hita, dia mamorona efitra vaovao miaraka amin'ny Bot
    const botRoomId = "BOT_" + Math.floor(Math.random() * 10000);
    const userName = document.getElementById("user-name").innerText;
    const userAvatar = document.getElementById("user-avatar").src;

    await setDoc(doc(db, "rooms", botRoomId), {
        creator: {
            id: auth.currentUser.uid,
            name: userName,
            avatar: userAvatar
        },
        opponent: {
            id: "bot_id",
            name: "Bot NoLimite (AI)",
            avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=NoLimite"
        },
        turn: auth.currentUser.uid,
        status: "playing",
        board: initBoard(), // Ataovy azo antoka fa misy ity function ity
        winner: null,
        createdAt: serverTimestamp()
    });

    enterGame(botRoomId); // Miditra ao anaty lalao avy hatrany
};
