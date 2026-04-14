import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// --- CONFIG FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// --- SETUP CANVAS ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.onresize = resize;
resize();

// --- DATA STATE ---
let myId;
let players = {};
let me = {
    x: Math.random() * 2000 + 500,
    y: Math.random() * 2000 + 500,
    hp: 100,
    kills: 0,
    name: "Player_" + Math.floor(Math.random() * 999)
};
const MAP_SIZE = 3000;
let zoneRadius = 1200;

// --- AUTH LOGIC ---
document.getElementById("signup-btn").onclick = () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    createUserWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
};

document.getElementById("login-btn").onclick = () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById("auth-screen").style.display = "none";
        document.getElementById("lobby-screen").style.display = "block";
    }
});

// --- GAME START ---
document.getElementById("join-btn").onclick = () => {
    document.getElementById("lobby-screen").style.display = "none";
    document.getElementById("game-ui").style.display = "block";
    startGame();
};

function startGame() {
    myId = auth.currentUser.uid;
    const pRef = ref(db, "players/" + myId);
    set(pRef, me);
    onDisconnect(pRef).remove();

    onValue(ref(db, "players"), snap => {
        players = snap.val() || {};
        if (!players[myId]) location.reload(); // Rehefa maty
    });

    setupJoystick(pRef);
    draw();
}

// --- CONTROLS (JOYSTICK) ---
function setupJoystick(pRef) {
    const manager = nipplejs.create({
        zone: document.getElementById('joystick-zone'),
        mode: 'static',
        position: { left: '50%', top: '50%' },
        color: 'cyan'
    });

    manager.on('move', (evt, data) => {
        if (data.vector) {
            const speed = 12;
            me.x = Math.max(0, Math.min(MAP_SIZE, me.x + data.vector.x * speed));
            me.y = Math.max(0, Math.min(MAP_SIZE, me.y - data.vector.y * speed));
            update(pRef, { x: me.x, y: me.y });
        }
    });

    document.getElementById("btn-attack").onclick = attack;
}

function attack() {
    for (let id in players) {
        if (id === myId) continue;
        let enemy = players[id];
        let dist = Math.hypot(me.x - enemy.x, me.y - enemy.y);

        if (dist < 80) {
            let newHp = (enemy.hp || 100) - 15;
            if (newHp <= 0) {
                remove(ref(db, "players/" + id));
                me.kills++;
                update(ref(db, "players/" + myId), { kills: me.kills });
            } else {
                update(ref(db, "players/" + id), { hp: newHp });
            }
        }
    }
}

// --- ZONE LOGIC ---
setInterval(() => { if (zoneRadius > 200) zoneRadius -= 2; }, 1000);

function zoneDamage() {
    let d = Math.hypot(me.x - MAP_SIZE/2, me.y - MAP_SIZE/2);
    if (d > zoneRadius) {
        me.hp -= 0.3;
        update(ref(db, "players/" + myId), { hp: me.hp });
    }
}

// --- DRAWING ---
function draw() {
    ctx.fillStyle = "#0a0a0f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    zoneDamage();

    // Camera follow me
    const camX = canvas.width / 2 - me.x;
    const camY = canvas.height / 2 - me.y;

    // Draw Grid
    ctx.strokeStyle = "rgba(0, 255, 255, 0.05)";
    for(let x=0; x<=MAP_SIZE; x+=100) {
        ctx.beginPath(); ctx.moveTo(x+camX, camY); ctx.lineTo(x+camX, MAP_SIZE+camY); ctx.stroke();
    }
    for(let y=0; y<=MAP_SIZE; y+=100) {
        ctx.beginPath(); ctx.moveTo(camX, y+camY); ctx.lineTo(MAP_SIZE+camX, y+camY); ctx.stroke();
    }

    // Draw Zone
    ctx.beginPath();
    ctx.arc(MAP_SIZE/2 + camX, MAP_SIZE/2 + camY, zoneRadius, 0, Math.PI*2);
    ctx.strokeStyle = "purple"; ctx.lineWidth = 10; ctx.stroke();

    // Draw Players
    for (let id in players) {
        let p = players[id];
        let screenX = p.x + camX;
        let screenY = p.y + camY;

        // Player Circle
        ctx.fillStyle = (id === myId) ? "cyan" : "red";
        ctx.beginPath();
        ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
        ctx.fill();

        // HP Bar
        ctx.fillStyle = "#333";
        ctx.fillRect(screenX - 25, screenY - 35, 50, 6);
        ctx.fillStyle = (p.hp || 100) > 40 ? "#0f0" : "#f00";
        ctx.fillRect(screenX - 25, screenY - 35, ((p.hp || 100) / 100) * 50, 6);

        // Name Tag
        ctx.fillStyle = "white";
        ctx.font = "12px Arial";
        ctx.textAlign = "center";
        ctx.fillText(p.name || "Player", screenX, screenY - 45);
    }

    // HUD
    ctx.fillStyle = "white";
    ctx.font = "bold 20px sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(`Kills: ${me.kills}`, 20, 40);
    ctx.fillText(`HP: ${Math.floor(me.hp)}%`, 20, 70);

    requestAnimationFrame(draw);
}
