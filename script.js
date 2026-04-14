// FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
  authDomain: "nolimite-29e0b.firebaseapp.com",
  databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// CANVAS
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

// DATA
let myId;
let players = {};
let me = {
    x: Math.random()*3000,
    y: Math.random()*3000,
    hp:100,
    kills:0,
    name:"Player"
};

// MAP + ZONE
const MAP_SIZE = 3000;
let zoneRadius = 1200;

// ================= AUTH =================

// SIGNUP
document.getElementById("signup-btn").onclick = () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    createUserWithEmailAndPassword(auth, email, pass)
    .then(()=>alert("Account created"))
    .catch(e=>alert(e.message));
};

// LOGIN
document.getElementById("login-btn").onclick = () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    signInWithEmailAndPassword(auth, email, pass)
    .then(()=>alert("Connected"))
    .catch(e=>alert(e.message));
};

// AUTO LOGIN
onAuthStateChanged(auth, (user)=>{
    if(user){
        document.getElementById("auth-screen").style.display="none";
        document.getElementById("lobby-screen").style.display="block";
    }
});

// ================= GAME =================

document.getElementById("join-btn").onclick = ()=>{
    document.getElementById("lobby-screen").style.display="none";
    document.getElementById("game-ui").style.display="block";
    startGame();
};

function startGame(){
    myId = auth.currentUser.uid;

    const pRef = ref(db,"players/"+myId);
    set(pRef, me);
    onDisconnect(pRef).remove();

    onValue(ref(db,"players"), snap=>{
        players = snap.val()||{};
    });

    setupControls(pRef);
    spawnBots();
    draw();
}

// ================= CONTROLS =================

function setupControls(pRef){
    document.getElementById("btn-up").onclick=()=>move(pRef,0,-15);
    document.getElementById("btn-down").onclick=()=>move(pRef,0,15);
    document.getElementById("btn-left").onclick=()=>move(pRef,-15,0);
    document.getElementById("btn-right").onclick=()=>move(pRef,15,0);

    document.getElementById("btn-attack").onclick=attack;
}

function move(pRef,dx,dy){
    me.x = Math.max(0, Math.min(MAP_SIZE, me.x+dx));
    me.y = Math.max(0, Math.min(MAP_SIZE, me.y+dy));

    update(pRef,{x:me.x,y:me.y});
}

// ================= COMBAT =================

function attack(){
    for(let id in players){
        if(id===myId) continue;

        let enemy = players[id];
        let dist = Math.hypot(me.x-enemy.x, me.y-enemy.y);

        if(dist < 80){
            let newHp = (enemy.hp||100)-20;

            if(newHp <= 0){
                remove(ref(db,"players/"+id));
                me.kills++;
                update(ref(db,"players/"+myId),{kills:me.kills});
            }else{
                update(ref(db,"players/"+id),{hp:newHp});
            }
        }
    }
}

// ================= AI BOTS =================

function spawnBots(){
    for(let i=0;i<5;i++){
        let id = "bot_"+i;

        set(ref(db,"players/"+id),{
            x:Math.random()*MAP_SIZE,
            y:Math.random()*MAP_SIZE,
            hp:100,
            name:"Bot_"+i,
            isBot:true
        });
    }
}

// BOT MOVE
setInterval(()=>{
    for(let id in players){
        let p = players[id];
        if(!p.isBot) continue;

        let dx = (Math.random()-0.5)*50;
        let dy = (Math.random()-0.5)*50;

        update(ref(db,"players/"+id),{
            x: Math.max(0, Math.min(MAP_SIZE,p.x+dx)),
            y: Math.max(0, Math.min(MAP_SIZE,p.y+dy))
        });
    }
},500);

// BOT ATTACK
setInterval(()=>{
    for(let id in players){
        let bot = players[id];
        if(!bot.isBot) continue;

        for(let tid in players){
            if(tid===id) continue;

            let t = players[tid];
            let d = Math.hypot(bot.x-t.x, bot.y-t.y);

            if(d<80){
                let hp = (t.hp||100)-10;

                if(hp<=0){
                    remove(ref(db,"players/"+tid));
                }else{
                    update(ref(db,"players/"+tid),{hp:hp});
                }
            }
        }
    }
},800);

// ================= ZONE =================

setInterval(()=>{
    if(zoneRadius>200){
        zoneRadius-=5;
    }
},1000);

function zoneDamage(){
    let d = Math.hypot(me.x-MAP_SIZE/2, me.y-MAP_SIZE/2);

    if(d>zoneRadius){
        me.hp -= 0.2;
        update(ref(db,"players/"+myId),{hp:me.hp});
    }
}

// ================= DRAW =================

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    zoneDamage();

    // DRAW ZONE
    let zx = MAP_SIZE/2 - me.x + canvas.width/2;
    let zy = MAP_SIZE/2 - me.y + canvas.height/2;

    ctx.beginPath();
    ctx.arc(zx, zy, zoneRadius, 0, Math.PI*2);
    ctx.strokeStyle="purple";
    ctx.lineWidth=4;
    ctx.stroke();

    // PLAYERS
    for(let id in players){
        let p = players[id];

        let x = p.x - me.x + canvas.width/2;
        let y = p.y - me.y + canvas.height/2;

        let hp = p.hp||100;

        if(hp>60) ctx.fillStyle="cyan";
        else if(hp>30) ctx.fillStyle="orange";
        else ctx.fillStyle="red";

        ctx.beginPath();
        ctx.arc(x,y,20,0,Math.PI*2);
        ctx.fill();

        ctx.fillStyle="white";
        ctx.textAlign="center";
        ctx.fillText(p.name||"Player",x,y-25);
    }

    requestAnimationFrame(draw);
}
