import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect, push, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ==========================================
// 1. CONFIGURATION & CORE ENGINE
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// Game Settings
const MAP_SIZE = 5000;
const PLAYER_SPEED = 7;
const BULLET_SPEED = 15;
let zoneRadius = 2500;
let isPlaying = false;
let myId = null;
let myUsername = "Player";

// Data Storage
let players = {};
let bullets = {}; // Synchronized bullets
let localBullets = []; // Bullets fired by me locally
let joystick = { x: 0, y: 0, active: false };

// Player Local State
let me = {
    x: Math.random() * 3000 + 1000,
    y: Math.random() * 3000 + 1000,
    hp: 100,
    kills: 0,
    angle: 0,
    lastUpdate: 0
};

// ==========================================
// 2. AUTHENTICATION & UI NAVIGATION
// ==========================================

// Handle Auth State
onAuthStateChanged(auth, user => {
    if (user) {
        myId = user.uid;
        myUsername = user.displayName || "Survivor";
        document.getElementById("auth-screen").style.display = "none";
        document.getElementById("main-hub").style.display = "block";
        document.getElementById("top-username").innerText = myUsername;
        initChat();
        syncGlobalData();
    }
});

// Login/Signup Events
document.getElementById("signup-btn").onclick = async () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    const name = document.getElementById("name").value;
    if(!name) return alert("Anarana azafady!");
    try {
        const res = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(res.user, { displayName: name });
        location.reload();
    } catch (e) { alert(e.message); }
};

document.getElementById("login-btn").onclick = () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;
    signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
};

// Tab Manager
window.switchSection = (id) => {
    const sections = ['home', 'profile', 'messages'];
    sections.forEach(s => document.getElementById('sec-' + s).style.display = 'none');
    document.getElementById('sec-' + id).style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    event.currentTarget.classList.add('active');
};

// ==========================================
// 3. MULTIPLAYER SYNC (FIREBASE)
// ==========================================

function syncGlobalData() {
    // Listen for players
    onValue(ref(db, 'players'), snap => {
        players = snap.val() || {};
        if(players[myId]) {
            me.hp = players[myId].hp;
            me.kills = players[myId].kills;
            // Update UI
            document.getElementById("hp-bar").style.width = me.hp + "%";
            document.getElementById("kill-val").innerText = me.kills;
            document.getElementById("prof-kills").innerText = me.kills;
            
            if(me.hp <= 0 && isPlaying) {
                gameOver();
            }
        }
    });

    // Listen for bullets (only new ones)
    onValue(ref(db, 'bullets'), snap => {
        bullets = snap.val() || {};
    });
}

function initChat() {
    const chatIn = document.getElementById("chat-input");
    document.getElementById("send-btn").onclick = () => {
        if(!chatIn.value) return;
        push(ref(db, "chat"), {
            name: myUsername,
            msg: chatIn.value,
            time: serverTimestamp()
        });
        chatIn.value = "";
    };

    onValue(ref(db, "chat"), snap => {
        const box = document.getElementById("chat-messages");
        box.innerHTML = "";
        const data = snap.val() || {};
        Object.values(data).slice(-20).forEach(m => {
            box.innerHTML += `<div class="msg"><b>${m.name}:</b> ${m.msg}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// ==========================================
// 4. GAMEPLAY LOGIC
// ==========================================

document.getElementById("start-btn").onclick = () => {
    document.getElementById("main-hub").style.display = "none";
    document.getElementById("game-ui").style.display = "block";
    isPlaying = true;
    
    // Spawn in Firebase
    const pRef = ref(db, `players/${myId}`);
    set(pRef, {
        x: me.x, y: me.y,
        hp: 100, kills: 0,
        name: myUsername,
        angle: 0
    });
    onDisconnect(pRef).remove();

    initJoystick();
    requestAnimationFrame(gameLoop);
};

function initJoystick() {
    const manager = nipplejs.create({
        zone: document.getElementById('joystick-zone'),
        mode: 'static',
        position: { left: '80px', bottom: '80px' },
        color: 'cyan'
    });

    manager.on('move', (evt, data) => {
        joystick.active = true;
        const force = Math.min(data.force, 1);
        joystick.x = Math.cos(data.angle.radian) * PLAYER_SPEED * force;
        joystick.y = -Math.sin(data.angle.radian) * PLAYER_SPEED * force;
        me.angle = data.angle.radian;
    });

    manager.on('end', () => {
        joystick.active = false;
        joystick.x = 0;
        joystick.y = 0;
    });
}

// Shooting Logic
document.getElementById("btn-attack").onclick = () => {
    if(!isPlaying) return;
    
    const bulletId = push(ref(db, 'bullets')).key;
    const bData = {
        owner: myId,
        x: me.x,
        y: me.y,
        vx: Math.cos(me.angle) * BULLET_SPEED,
        vy: -Math.sin(me.angle) * BULLET_SPEED,
        t: Date.now()
    };
    
    set(ref(db, `bullets/${bulletId}`), bData);
    
    // Remove bullet from Firebase after 2 seconds
    setTimeout(() => {
        remove(ref(db, `bullets/${bulletId}`));
    }, 2000);
};

// ==========================================
// 5. RENDERING & PHYSICS
// ==========================================

function gameLoop() {
    if (!isPlaying) return;

    // 1. Movement & Physics
    if (joystick.active) {
        me.x = Math.max(0, Math.min(MAP_SIZE, me.x + joystick.x));
        me.y = Math.max(0, Math.min(MAP_SIZE, me.y + joystick.y));

        // Network sync every 50ms to save bandwidth
        if (Date.now() - me.lastUpdate > 50) {
            update(ref(db, `players/${myId}`), { 
                x: me.x, y: me.y, angle: me.angle 
            });
            me.lastUpdate = Date.now();
        }
    }

    // Zone Shrinking logic (Local calculation)
    let distToCenter = Math.hypot(me.x - MAP_SIZE/2, me.y - MAP_SIZE/2);
    if(distToCenter > zoneRadius) {
        me.hp -= 0.2; // Zone damage
        if(Math.random() > 0.9) update(ref(db, `players/${myId}`), { hp: me.hp });
    }

    // 2. Canvas Rendering
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera offset
    const camX = canvas.width / 2 - me.x;
    const camY = canvas.height / 2 - me.y;

    drawMap(ctx, camX, camY);
    drawBullets(ctx, camX, camY);
    drawPlayers(ctx, camX, camY);

    requestAnimationFrame(gameLoop);
}

function drawMap(ctx, cx, cy) {
    // Ground
    ctx.fillStyle = "#15151e";
    ctx.fillRect(cx, cy, MAP_SIZE, MAP_SIZE);

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 2;
    for(let i=0; i<=MAP_SIZE; i+=200) {
        ctx.beginPath(); ctx.moveTo(i+cx, cy); ctx.lineTo(i+cx, MAP_SIZE+cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, i+cy); ctx.lineTo(MAP_SIZE+cx, i+cy); ctx.stroke();
    }

    // Zone
    ctx.strokeStyle = "#ff4b2b";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(MAP_SIZE/2 + cx, MAP_SIZE/2 + cy, zoneRadius, 0, Math.PI*2);
    ctx.stroke();
}

function drawPlayers(ctx, cx, cy) {
    for (let id in players) {
        const p = players[id];
        const px = p.x + cx;
        const py = p.y + cy;

        // Skip if offscreen
        if(px < -50 || px > canvas.width+50 || py < -50 || py > canvas.height+50) continue;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-p.angle);

        // Character Body
        ctx.fillStyle = (id === myId) ? "#00f2ff" : "#ff4b2b";
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;
        
        // Shape
        ctx.beginPath();
        ctx.moveTo(25, 0);
        ctx.lineTo(-15, -20);
        ctx.lineTo(-15, 20);
        ctx.closePath();
        ctx.fill();
        
        ctx.restore();

        // Name & HP Bar
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Oswald";
        ctx.textAlign = "center";
        ctx.fillText(p.name.toUpperCase(), px, py - 40);
        
        // Mini HP Bar
        ctx.fillStyle = "#333";
        ctx.fillRect(px - 20, py - 35, 40, 5);
        ctx.fillStyle = (p.hp > 30) ? "#4cd137" : "red";
        ctx.fillRect(px - 20, py - 35, (p.hp/100)*40, 5);
    }
}

function drawBullets(ctx, cx, cy) {
    ctx.fillStyle = "#fff200";
    for (let id in bullets) {
        const b = bullets[id];
        // Calculate current position based on time elapsed
        const elapsed = (Date.now() - b.t) / 16; 
        const bx = b.x + (b.vx * elapsed) + cx;
        const by = b.y + (b.vy * elapsed) + cy;

        ctx.beginPath();
        ctx.arc(bx, by, 4, 0, Math.PI*2);
        ctx.fill();

        // Collision Detection (Only if I am the owner)
        if(b.owner === myId) {
            checkBulletCollision(b, id, bx - cx, by - cy);
        }
    }
}

function checkBulletCollision(b, bId, realBx, realBy) {
    for (let id in players) {
        if(id === myId) continue;
        const p = players[id];
        const dist = Math.hypot(realBx - p.x, realBy - p.y);
        
        if(dist < 30) {
            // HIT!
            remove(ref(db, `bullets/${bId}`));
            const newHp = Math.max(0, p.hp - 10);
            update(ref(db, `players/${id}`), { hp: newHp });
            
            if(newHp <= 0) {
                update(ref(db, `players/${myId}`), { kills: me.kills + 1 });
            }
            break;
        }
    }
}

function gameOver() {
    isPlaying = false;
    alert("GAME OVER! ELIMINATED.");
    remove(ref(db, `players/${myId}`));
    location.reload();
}

// Shrink Zone every second
setInterval(() => {
    if(isPlaying && zoneRadius > 200) {
        zoneRadius -= 2;
    }
}, 1000);
