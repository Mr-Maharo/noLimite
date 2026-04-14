import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// --- CONFIGURATION ---
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
const db = getDatabase(app);

// --- GAME STATE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let playerId, playerRef;
let players = {};
let localPlayer = {
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    hp: 100,
    name: "Hunter",
    isAttacking: false,
    auraIntensity: 0
};

let zoneRadius = 2000;
const MAP_SIZE = 3000;

// --- AUTH LOGIC ---
document.getElementById('signup-btn').onclick = () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    createUserWithEmailAndPassword(auth, email, pass);
};

document.getElementById('login-btn').onclick = () => {
    const email = document.getElementById('email').value;
    const pass = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, pass);
};

onAuthStateChanged(auth, (user) => {
    if (user) {
        playerId = user.uid;
        playerRef = ref(db, `players/${playerId}`);
        document.getElementById('auth-screen').style.display = 'none';
        document.getElementById('lobby-screen').style.display = 'block';
    }
});

document.getElementById('join-btn').onclick = () => {
    document.getElementById('lobby-screen').style.display = 'none';
    document.getElementById('game-ui').style.display = 'block';
    initGame();
};

function initGame() {
    // Sync Local to Cloud
    set(playerRef, localPlayer);
    onDisconnect(playerRef).remove();

    // Listen for all players
    onValue(ref(db, 'players'), (snapshot) => {
        players = snapshot.val() || {};
    });

    gameLoop();
}

// --- INPUTS ---
const keys = {};
window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

// --- GAME LOGIC ---
function updatePlayer() {
    let moved = false;
    const speed = 5;
    if (keys['w'] || keys['arrowup']) { localPlayer.y -= speed; moved = true; }
    if (keys['s'] || keys['arrowdown']) { localPlayer.y += speed; moved = true; }
    if (keys['a'] || keys['arrowleft']) { localPlayer.x -= speed; moved = true; }
    if (keys['d'] || keys['arrowright']) { localPlayer.x += speed; moved = true; }

    if (moved) {
        update(playerRef, { x: localPlayer.x, y: localPlayer.y });
    }

    // Zone Damage Logic
    const distFromCenter = Math.hypot(localPlayer.x - MAP_SIZE/2, localPlayer.y - MAP_SIZE/2);
    if (distFromCenter > zoneRadius) {
        localPlayer.hp -= 0.1;
        update(playerRef, { hp: localPlayer.hp });
    }
    
    // UI Update
    document.getElementById('hp-bar').style.width = localPlayer.hp + "%";
}

function drawStickman(p, id) {
    const isLocal = id === playerId;
    
    // Camera follow (simple offset)
    const offsetX = canvas.width/2 - localPlayer.x;
    const offsetY = canvas.height/2 - localPlayer.y;
    const px = p.x + offsetX;
    const py = p.y + offsetY;

    // Solo Leveling Aura
    ctx.shadowBlur = 15;
    ctx.shadowColor = isLocal ? "#00f2ff" : "#ff0055";
    
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;

    // Head
    ctx.beginPath();
    ctx.arc(px, py - 20, 10, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(px, py - 10);
    ctx.lineTo(px, py + 10);
    // Arms
    ctx.moveTo(px - 15, py);
    ctx.lineTo(px + 15, py);
    // Legs
    ctx.moveTo(px, py + 10);
    ctx.lineTo(px - 10, py + 25);
    ctx.moveTo(px, py + 10);
    ctx.lineTo(px + 10, py + 25);
    ctx.stroke();

    // Name Tag
    ctx.fillStyle = "white";
    ctx.fillText(p.name || "Hunter", px - 20, py - 40);
}

function drawZone() {
    const offsetX = canvas.width/2 - localPlayer.x;
    const offsetY = canvas.height/2 - localPlayer.y;
    
    ctx.beginPath();
    ctx.strokeStyle = "purple";
    ctx.lineWidth = 10;
    ctx.arc(MAP_SIZE/2 + offsetX, MAP_SIZE/2 + offsetY, zoneRadius, 0, Math.PI*2);
    ctx.stroke();
    
    zoneRadius -= 0.05; // Shrink
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    updatePlayer();
    drawZone();

    Object.keys(players).forEach(id => {
        drawStickman(players[id], id);
    });

    requestAnimationFrame(gameLoop);
}

// Mobile Button Examples
document.getElementById('btn-attack').onclick = () => {
    // Basic hit detection logic would go here
    console.log("Attack!");
};
