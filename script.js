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
let bullets = {};
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

// --- VARIABLE HO AN'NY CANVAS ---
let canvas, ctx;

// ==========================================
// 2. WAIT FOR DOM LOAD (Mba tsy hisy error null)
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    canvas = document.getElementById("gameCanvas");
    if (canvas) ctx = canvas.getContext("2d");

    // Login/Signup Events
    const signupBtn = document.getElementById("signup-btn");
    if (signupBtn) {
        signupBtn.onclick = async () => {
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
    }

    const loginBtn = document.getElementById("login-btn");
    if (loginBtn) {
        loginBtn.onclick = () => {
            const email = document.getElementById("email").value;
            const pass = document.getElementById("password").value;
            signInWithEmailAndPassword(auth, email, pass).catch(e => alert(e.message));
        };
    }

    const startBtn = document.getElementById("start-btn");
    if (startBtn) {
        startBtn.onclick = () => {
            document.getElementById("main-hub").style.display = "none";
            document.getElementById("game-ui").style.display = "block";
            isPlaying = true;
            
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
    }

    const attackBtn = document.getElementById("btn-attack");
    if (attackBtn) {
        attackBtn.onclick = () => {
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
            setTimeout(() => { remove(ref(db, `bullets/${bulletId}`)); }, 2000);
        };
    }
});

// ==========================================
// 3. AUTH & SYNC LOGIC
// ==========================================

onAuthStateChanged(auth, user => {
    if (user) {
        myId = user.uid;
        myUsername = user.displayName || "Survivor";
        
        const authScr = document.getElementById("auth-screen");
        const mainHub = document.getElementById("main-hub");
        const topUser = document.getElementById("top-username");

        if (authScr) authScr.style.display = "none";
        if (mainHub) mainHub.style.display = "block";
        if (topUser) topUser.innerText = myUsername;
        
        initChat();
        syncGlobalData();
    }
});

window.switchSection = (id) => {
    const sections = ['home', 'profile', 'messages'];
    sections.forEach(s => {
        const el = document.getElementById('sec-' + s);
        if (el) el.style.display = 'none';
    });
    const target = document.getElementById('sec-' + id);
    if (target) target.style.display = 'block';
    
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (event && event.currentTarget) event.currentTarget.classList.add('active');
};

function syncGlobalData() {
    onValue(ref(db, 'players'), snap => {
        players = snap.val() || {};
        if(players[myId]) {
            me.hp = players[myId].hp;
            me.kills = players[myId].kills;
            
            const hpBar = document.getElementById("hp-bar");
            const killVal = document.getElementById("kill-val");
            const profKills = document.getElementById("prof-kills");

            if (hpBar) hpBar.style.width = me.hp + "%";
            if (killVal) killVal.innerText = me.kills;
            if (profKills) profKills.innerText = me.kills;
            
            if(me.hp <= 0 && isPlaying) gameOver();
        }
    });

    onValue(ref(db, 'bullets'), snap => {
        bullets = snap.val() || {};
    });
}

function initChat() {
    const chatIn = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");

    if (sendBtn) {
        sendBtn.onclick = () => {
            if(!chatIn.value) return;
            push(ref(db, "chat"), {
                name: myUsername,
                msg: chatIn.value,
                time: serverTimestamp()
            });
            chatIn.value = "";
        };
    }

    onValue(ref(db, "chat"), snap => {
        const box = document.getElementById("chat-messages");
        if (!box) return;
        box.innerHTML = "";
        const data = snap.val() || {};
        Object.values(data).slice(-20).forEach(m => {
            box.innerHTML += `<div class="msg"><b>${m.name}:</b> ${m.msg}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

// ==========================================
// 4. PHYSICS & RENDERING
// ==========================================

function initJoystick() {
    const joyZone = document.getElementById('joystick-zone');
    if (!joyZone) return;
    const manager = nipplejs.create({
        zone: joyZone,
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
        joystick.x = 0; joystick.y = 0;
    });
}

function gameLoop() {
    if (!isPlaying) return;

    if (joystick.active) {
        me.x = Math.max(0, Math.min(MAP_SIZE, me.x + joystick.x));
        me.y = Math.max(0, Math.min(MAP_SIZE, me.y + joystick.y));

        if (Date.now() - me.lastUpdate > 50) {
            update(ref(db, `players/${myId}`), { x: me.x, y: me.y, angle: me.angle });
            me.lastUpdate = Date.now();
        }
    }

    let distToCenter = Math.hypot(me.x - MAP_SIZE/2, me.y - MAP_SIZE/2);
    if(distToCenter > zoneRadius) {
        me.hp -= 0.2;
        if(Math.random() > 0.9) update(ref(db, `players/${myId}`), { hp: me.hp });
    }

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const camX = canvas.width / 2 - me.x;
    const camY = canvas.height / 2 - me.y;

    drawMap(ctx, camX, camY);
    drawBullets(ctx, camX, camY);
    drawPlayers(ctx, camX, camY);

    requestAnimationFrame(gameLoop);
}

function drawMap(ctx, cx, cy) {
    ctx.fillStyle = "#15151e";
    ctx.fillRect(cx, cy, MAP_SIZE, MAP_SIZE);
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 2;
    for(let i=0; i<=MAP_SIZE; i+=200) {
        ctx.beginPath(); ctx.moveTo(i+cx, cy); ctx.lineTo(i+cx, MAP_SIZE+cy); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(cx, i+cy); ctx.lineTo(MAP_SIZE+cx, i+cy); ctx.stroke();
    }
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
        if(px < -50 || px > canvas.width+50 || py < -50 || py > canvas.height+50) continue;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(-p.angle);
        ctx.fillStyle = (id === myId) ? "#00f2ff" : "#ff4b2b";
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;
        ctx.beginPath();
        ctx.moveTo(25, 0); ctx.lineTo(-15, -20); ctx.lineTo(-15, 20); ctx.closePath();
        ctx.fill();
        ctx.restore();

        ctx.fillStyle = "white";
        ctx.font = "bold 14px Oswald";
        ctx.textAlign = "center";
        ctx.fillText(p.name.toUpperCase(), px, py - 40);
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
        const elapsed = (Date.now() - b.t) / 16; 
        const bx = b.x + (b.vx * elapsed) + cx;
        const by = b.y + (b.vy * elapsed) + cy;
        ctx.beginPath(); ctx.arc(bx, by, 4, 0, Math.PI*2); ctx.fill();
        if(b.owner === myId) checkBulletCollision(b, id, bx - cx, by - cy);
    }
}

function checkBulletCollision(b, bId, realBx, realBy) {
    for (let id in players) {
        if(id === myId) continue;
        const p = players[id];
        const dist = Math.hypot(realBx - p.x, realBy - p.y);
        if(dist < 30) {
            remove(ref(db, `bullets/${bId}`));
            const newHp = Math.max(0, p.hp - 10);
            update(ref(db, `players/${id}`), { hp: newHp });
            if(newHp <= 0) update(ref(db, `players/${myId}`), { kills: me.kills + 1 });
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

setInterval(() => {
    if(isPlaying && zoneRadius > 200) zoneRadius -= 2;
}, 1000);
