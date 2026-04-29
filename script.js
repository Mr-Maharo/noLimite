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

// Apetraho any ambony indrindra (ivelan'ny function) ity:
let myCurrentUid = null; 

document.getElementById("btn-guest").onclick = async () => {
    // 1. Fakana data avy amin'ny LocalStorage
    let guestUid = localStorage.getItem("nolimite_guest_uid");
    let guestName = localStorage.getItem("nolimite_guest_name") || "Mpanandrana_" + Math.floor(Math.random() * 1000);
    let guestAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=" + guestName;

    if (!guestUid) {
        guestUid = "GUEST_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        localStorage.setItem("nolimite_guest_uid", guestUid);
        localStorage.setItem("nolimite_guest_name", guestName);
    }

    // 2. Famaritana ny variable global myCurrentUid
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
        // 3. Mitahiry ao amin'ny Firestore
        await setDoc(doc(db, "users", guestUid), guestData, { merge: true });

        // 4. Manokatra UI
        setupGuestUI(guestData);
        
        // 5. Mampandeha ny lisitra (Tena ilaina!)
        initLobby();
        initPlayerList();
    } catch (e) {
        console.error("Login Guest Error: ", e);
    }
};
// ================= LOGIN GUEST =================
document.getElementById("btn-guest").onclick = async () => {
    // 1. Fakana data avy amin'ny LocalStorage
    let guestUid = localStorage.getItem("nolimite_guest_uid");
    let guestName = localStorage.getItem("nolimite_guest_name") || "Mpanandrana_" + Math.floor(Math.random() * 1000);
    let guestAvatar = "https://api.dicebear.com/7.x/bottts/svg?seed=" + guestName;

    if (!guestUid) {
        guestUid = "GUEST_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        localStorage.setItem("nolimite_guest_uid", guestUid);
        localStorage.setItem("nolimite_guest_name", guestName);
    }

    // 2. Tehirizina amin'ny variable global
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
        
        // Alefa ny lisitra
        initLobby();
        initPlayerList();
    } catch (e) {
        console.error("Login Guest Error: ", e);
    }
}; // Eto ihany no misy }; iray fotsiny

function setupGuestUI(user) {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("lobby-screen").classList.remove("hidden");
    
    document.getElementById("user-name").innerText = user.name;
    document.getElementById("user-avatar").src = user.avatar;

    // Alefa ny Lobby sy ny sisa (tsy mampiasa auth.currentUser intsony eto)
    // Mila ovaina kely ny kaody hafa mba hanaiky an'ity guest UID ity
    initLobby();
    initPlayerList();
}
// ================= AUTH & USER STATE =================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myCurrentUid = user.uid; // Aza adino ity!
        // ... ny sisa
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

        document.getElementById("user-name").innerText = finalName;
        document.getElementById("user-avatar").src = finalAvatar;

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
        await updateDoc(doc(db, "users", auth.currentUser.uid), { status: "offline" });
    }
});

// ================= BUTTONS & MODALS =================
document.getElementById("btn-google").onclick = () => signInWithPopup(auth, provider);
document.getElementById("btn-create-room").onclick = () => document.getElementById("modal-create").classList.remove("hidden");

document.getElementById("room-type").onchange = function () {
    document.getElementById("room-password").style.display = this.value === "private" ? "block" : "none";
};

// ================= AUTO-DELETE LOGIC =================
// Hamafa ny room raha tsy misy miditra ao anatin'ny 5 minitra
async function autoDeleteRoom(roomId) {
    setTimeout(async () => {
        const roomRef = doc(db, "rooms", roomId);
        const snap = await getDoc(roomRef);
        if (snap.exists() && snap.data().status === "waiting") {
            await deleteDoc(roomRef);
            console.log("Room deleted due to inactivity: " + roomId);
        }
    }, 5 * 60 * 1000); 
}

window.deleteRoom = async (roomId) => {
    if (confirm("Tena hovafanao ve ity efitra ity?")) {
        try {
            await deleteDoc(doc(db, "rooms", roomId));
            // Tsy mila manao inona isika eto fa ny onSnapshot (initLobby) 
            // no hanala azy ho azy eo amin'ny sary.
        } catch (e) {
            console.error("Error deleting room:", e);
        }
    }
};
// ================= INVITE SYSTEM =================
window.sendInvite = async (targetUid) => {
    if (!auth.currentUser) return;
    const myName = document.getElementById("user-name").innerText;
    await addDoc(collection(db, "invites"), {
        from: auth.currentUser.uid,
        fromName: myName,
        to: targetUid,
        status: "pending",
        createdAt: serverTimestamp()
    });
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
    document.getElementById("invite-" + inviteId)?.remove();
    const roomId = "INVITE_" + Math.floor(Math.random() * 10000);
    const myName = document.getElementById("user-name").innerText;
    const myAvatar = document.getElementById("user-avatar").src;

    await setDoc(doc(db, "rooms", roomId), {
        creator: { id: senderUid, name: senderName, avatar: "" },
        opponent: { id: auth.currentUser.uid, name: myName, avatar: myAvatar },
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

// ================= LOBBY & PLAYERS (2 COLUMNS) =================
async function initPlayerList() {
    const q = query(collection(db, "users"), where("status", "==", "online"), limit(20));
    onSnapshot(q, (snapshot) => {
        const listSidebar = document.getElementById("online-players");
        const listMain = document.getElementById("players-list-dynamic");
        if (listSidebar) listSidebar.innerHTML = ""; 
        if (listMain) listMain.innerHTML = "";

        snapshot.forEach((doc) => {
            const userData = doc.data();
            // Jereo tsara eto: mampiasa myCurrentUid
            if (userData.uid !== myCurrentUid) {
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
                const isPrivate = r.type === "private" ? "🔒" : "🌐";
                const playerBadge = `<span class="badge-waiting">● 1/2 miandry</span>`;

                // Jereo tsara eto koa: mampiasa myCurrentUid
                if (r.creator.id === myCurrentUid) {
                    if (myRoomsList) {
                        myRoomsList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>🏠 ${roomId}</span>
                                <div class="room-actions">
                                    <button class="btn-cancel" onclick="deleteRoom('${roomId}')">🗑️</button>
                                </div>
                            </div>`;
                    }
                } else if (r.type !== "private") {
                    if (publicList) {
                        publicList.innerHTML += `
                            <div class="room-card glass animate-pop">
                                <span>${isPrivate} ${roomId}</span>
                                ${playerBadge}
                                <button onclick="joinRoom('${roomId}')">Hiditra</button>
                            </div>`;
                    }
                }
            }
        });
    });
}

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
    let newName = document.getElementById("edit-name").value.trim();
    const newAvatar = document.getElementById("edit-avatar").value.trim();

    if (newName.length === 0 || newName.length > 8) {
        alert("Anarana 1 hatramin'ny 8 litera ihany azafady!");
        return;
    }

    try {
        await updateDoc(doc(db, "users", user.uid), {
            name: newName,
            avatar: newAvatar || "https://api.dicebear.com/7.x/avataaars/svg?seed=" + user.uid
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
    // 1 = Mpilalao 1, 2 = Mpilalao 2, 0 = Banga
    // Izany hoe 3 ambony vs 3 ambany
    return [
        { id: 0, x: 0, y: 0, value: 1 }, { id: 1, x: 1, y: 0, value: 1 }, { id: 2, x: 2, y: 0, value: 1 }, // 5-n'ny iray
        { id: 3, x: 0, y: 1, value: 0 }, { id: 4, x: 1, y: 1, value: 0 }, { id: 5, x: 2, y: 1, value: 0 }, // Andalana banga
        { id: 6, x: 0, y: 2, value: 2 }, { id: 7, x: 1, y: 2, value: 2 }, { id: 8, x: 2, y: 2, value: 2 }  // 8-n'ny faharoa
    ];
}

window.joinRoom = async (id) => {
    const roomRef = doc(db, "rooms", id);
    const roomSnap = await getDoc(roomRef);
    if (!roomSnap.exists()) return;
    const r = roomSnap.data();

    if (r.type === "private" && prompt("Teny miafina:") !== r.password) return alert("Diso!");

    await updateDoc(roomRef, {
        opponent: { id: auth.currentUser.uid, name: document.getElementById("user-name").innerText, avatar: document.getElementById("user-avatar").src },
        status: "playing",
        board: initBoard(),
        turn: r.creator.id
    });
    enterGame(id);
};

function enterGame(id) {
    currentRoomId = id;
    document.getElementById("lobby-screen").classList.add("hidden");
    document.getElementById("game-screen").classList.remove("hidden");
    initChat(id);

    onSnapshot(doc(db, "rooms", id), (snap) => {
        const game = snap.data();
        if (!game) return;
        render(game);
        if (game.turn === "bot_id" && !game.winner) setTimeout(() => executeBotMove(game), 1000);
        if (game.winner) { alert("🏆 Mpandresy: " + game.winner); location.reload(); }
    });
}

function render(game) {
    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";
    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot" + (selectedCell?.id === cell.id ? " active-spot" : "");
        if (cell.value) {
            const stone = document.createElement("div");
            stone.className = `stone ${cell.value === 1 ? 'black-stone' : 'white-stone'}`;
            div.appendChild(stone);
        }
        div.onclick = () => handleMove(cell, game);
        grid.appendChild(div);
    });
}

async function handleMove(cell, game) {
    if (game.turn !== auth.currentUser.uid) return;
    
    const myVal = game.creator.id === auth.currentUser.uid ? 1 : 2;
    let b = [...game.board];

    if (!selectedCell) {
        // MIFIDY NY VATO HAKISAKA
        if (cell.value === myVal) {
            selectedCell = cell;
            render(game); 
        }
    } else {
        // MIFIDY NY TOERANA HANAKISAHANA
        const dx = Math.abs(cell.x - selectedCell.x);
        const dy = Math.abs(cell.y - selectedCell.y);

        // Fitsipika Fanorona Telo:
        // 1. Toerana banga (value === 0)
        // 2. Toerana mifanila (distance 1: ambony, ambany, havia, havanana, ary sary mitsaka/diagonal)
        if (cell.value === 0 && dx <= 1 && dy <= 1) {
            b[selectedCell.id].value = 0; // Miala amin'ny toerana taloha
            b[cell.id].value = myVal;      // Mifindra amin'ny toerana vaovao
            
            selectedCell = null;
            finalizeTurn(b, game);
        } else {
            // Raha te hifidy vato hafa indray
            selectedCell = (cell.value === myVal) ? cell : null;
            render(game);
        }
    }
}

function finalizeTurn(b, game) {
    const winPatterns = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
    let winner = null;
    const myVal = game.creator.id === auth.currentUser.uid ? 1 : 2;
    for (let p of winPatterns) {
        if (b[p[0]].value === myVal && b[p[1]].value === myVal && b[p[2]].value === myVal) {
            winner = document.getElementById("user-name").innerText;
        }
    }
    const nextTurn = game.turn === game.creator.id ? (game.opponent?.id || game.creator.id) : game.creator.id;
    updateDoc(doc(db, "rooms", currentRoomId), { board: b, turn: winner ? "end" : nextTurn, winner: winner });
}

// ================= BOT & CHAT =================
async function executeBotMove(game) {
    let b = [...game.board]; const botVal = 2;
    const empty = b.filter(c => c.value === 0);
    if (empty.length > 0) {
        const target = empty[Math.floor(Math.random() * empty.length)];
        b[target.id].value = botVal;
    }
    updateDoc(doc(db, "rooms", currentRoomId), { board: b, turn: game.creator.id });
}

function initChat(roomId) {}

// ================= QUICK PLAY =================
document.getElementById("btn-quick-play").onclick = async () => {
    // 1. Mitady efitra efa misy aloha
    const q = query(collection(db, "rooms"), where("status", "==", "waiting"), limit(10));
    const snap = await getDocs(q);
    let foundRoom = null;

    snap.forEach(d => {
        const r = d.data();
        if (r.creator.id !== auth.currentUser.uid && r.type !== "private") {
            foundRoom = d.id;
        }
    });

    if (foundRoom) {
        joinRoom(foundRoom);
    } else {
        // 2. Raha tsy misy dia mamorona efitra vaovao (izay hiseho ao amin'ny Colone 2)
        const autoId = "QUICK_" + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, "rooms", autoId), {
            creator: { 
                id: auth.currentUser.uid, 
                name: document.getElementById("user-name").innerText,
                avatar: document.getElementById("user-avatar").src 
            },
            status: "waiting",
            type: "public",
            createdAt: serverTimestamp()
        });
        
        // Alefa ny timer 5min hamafa azy raha tsy misy miditra
        autoDeleteRoom(autoId); 
        
        alert("Tsy misy efitra malalaka. Namorona efitra vaovao ho anao izahay, miandrasa kely misy hiditra...");
    }
};
// ================= ROOM CREATION =================
document.getElementById("btn-confirm-create").onclick = async () => {
    const name = document.getElementById("room-uid-input").value || "ROOM_" + Math.floor(Math.random()*1000);
    const type = document.getElementById("room-type").value;
    const pass = document.getElementById("room-password").value;
    
    await setDoc(doc(db, "rooms", name), {
        creator: { id: auth.currentUser.uid, name: document.getElementById("user-name").innerText, avatar: "" },
        status: "waiting", type: type, password: pass, createdAt: serverTimestamp()
    });

    autoDeleteRoom(name); // Alefa ny timer famafana ho azy
    document.getElementById("modal-create").classList.add("hidden");
};
