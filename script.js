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
// --- (Ny imports sy Firebase config mbola mitovy foana) ---

// --- GAME STATE ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

let playerId, playerRef;
let players = {};
let frameCount = 0; // Ho an'ny animation aura

let localPlayer = {
    x: Math.random() * 1000,
    y: Math.random() * 1000,
    hp: 100,
    name: "Hunter",
    isAttacking: false
};

const MAP_SIZE = 3000;
let zoneRadius = 2000;

// --- AUTH & JOIN LOGIC ---
// (Ampiasao ilay login/signup efa nataonao teo ambony)

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
    set(playerRef, localPlayer);
    onDisconnect(playerRef).remove();

    onValue(ref(db, 'players'), (snapshot) => {
        players = snapshot.val() || {};
    });

    gameLoop();
}

// --- INPUTS (KEYBOARD + MOBILE) ---
const keys = {};
window.onkeydown = (e) => keys[e.key.toLowerCase()] = true;
window.onkeyup = (e) => keys[e.key.toLowerCase()] = false;

function setupMobileBtn(id, key) {
    const btn = document.getElementById(id);
    if(!btn) return;
    
    const startAction = (e) => { e.preventDefault(); keys[key] = true; };
    const endAction = (e) => { e.preventDefault(); keys[key] = false; };

    btn.ontouchstart = startAction;
    btn.ontouchend = endAction;
    btn.onmousedown = startAction;
    btn.onmouseup = endAction;
}

setupMobileBtn('btn-up', 'w');
setupMobileBtn('btn-down', 's');
setupMobileBtn('btn-left', 'a');
setupMobileBtn('btn-right', 'd');

// Bouton Attack manokana
const atkBtn = document.getElementById('btn-attack');
if(atkBtn) {
    atkBtn.ontouchstart = () => { 
        localPlayer.isAttacking = true; 
        update(playerRef, { isAttacking: true });
    };
    atkBtn.ontouchend = () => { 
        localPlayer.isAttacking = false; 
        update(playerRef, { isAttacking: false });
    };
}

// --- GAME LOGIC ---
function updatePlayer() {
    let moved = false;
    const speed = 5;
    
    if (keys['w']) { localPlayer.y -= speed; moved = true; }
    if (keys['s']) { localPlayer.y += speed; moved = true; }
    if (keys['a']) { localPlayer.x -= speed; moved = true; }
    if (keys['d']) { localPlayer.x += speed; moved = true; }

    if (moved) {
        update(playerRef, { x: localPlayer.x, y: localPlayer.y });
    }

    const distFromCenter = Math.hypot(localPlayer.x - MAP_SIZE/2, localPlayer.y - MAP_SIZE/2);
    if (distFromCenter > zoneRadius) {
        localPlayer.hp -= 0.1;
        update(playerRef, { hp: localPlayer.hp });
    }
    
    document.getElementById('hp-bar').style.width = localPlayer.hp + "%";
}

function drawPlayerOrb(p, id) {
    const isLocal = id === playerId;
    const offsetX = canvas.width/2 - localPlayer.x;
    const offsetY = canvas.height/2 - localPlayer.y;
    const px = p.x + offsetX;
    const py = p.y + offsetY;

    // 1. AURA PULSE
    const pulse = Math.sin(frameCount * 0.1) * 5;
    const auraColor = isLocal ? "0, 242, 255" : "255, 0, 85";
    
    for(let i = 3; i > 0; i--) {
        ctx.beginPath();
        ctx.arc(px, py, 18 + (i * 6) + pulse, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${auraColor}, ${0.15 / i})`;
        ctx.fill();
    }

    // 2. CORE GLOW
    ctx.shadowBlur = 15;
    ctx.shadowColor = isLocal ? "#00f2ff" : "#ff0055";
    
    const grad = ctx.createRadialGradient(px, py, 2, px, py, 15);
    grad.addColorStop(0, "#fff");
    grad.addColorStop(1, isLocal ? "#00f2ff" : "#ff0055");

    ctx.beginPath();
    ctx.arc(px, py, 15, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // 3. ATTACK VISUAL
    if (p.isAttacking) {
        ctx.beginPath();
        ctx.arc(px, py, 35 + pulse, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // Name
    ctx.fillStyle = "white";
    ctx.font = "bold 12px Arial";
    ctx.textAlign = "center";
    ctx.fillText(p.name || "Hunter", px, py - 35);
}

function drawZone() {
    const offsetX = canvas.width/2 - localPlayer.x;
    const offsetY = canvas.height/2 - localPlayer.y;
    
    ctx.beginPath();
    ctx.strokeStyle = "rgba(128, 0, 128, 0.5)";
    ctx.lineWidth = 5;
    ctx.arc(MAP_SIZE/2 + offsetX, MAP_SIZE/2 + offsetY, zoneRadius, 0, Math.PI*2);
    ctx.stroke();
    zoneRadius -= 0.02;
}

function gameLoop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    frameCount++;
    
    updatePlayer();
    drawZone();

    Object.keys(players).forEach(id => {
        drawPlayerOrb(players[id], id);
    });

    requestAnimationFrame(gameLoop);
}
// Function hanamorana ny fifehezana bokotra
function bindAction(id, property) {
    const btn = document.getElementById(id);
    if (!btn) return;

    const startAction = (e) => {
        e.preventDefault();
        localPlayer[property] = true;
        // Ampitaina any amin'ny Firebase avy hatrany
        const data = {};
        data[property] = true;
        update(playerRef, data);
        
        // Raha "Heal" no tsindrina, averina ho 100 ny HP
        if(property === 'isHealing' && localPlayer.hp < 100) {
            localPlayer.hp = Math.min(100, localPlayer.hp + 10);
            update(playerRef, { hp: localPlayer.hp });
        }
    };

    const endAction = (e) => {
        e.preventDefault();
        localPlayer[property] = false;
        const data = {};
        data[property] = false;
        update(playerRef, data);
    };

    btn.ontouchstart = startAction;
    btn.ontouchend = endAction;
    btn.onmousedown = startAction;
    btn.onmouseup = endAction;
}

// Ampifandraisina amin'ny localPlayer state ny bokotra rehetra
bindAction('btn-attack', 'isAttacking');
bindAction('btn-dash', 'isDashing');
bindAction('btn-skill', 'isUsingSkill');
bindAction('btn-heal', 'isHealing');
bindAction('btn-interact', 'isInteracting');
