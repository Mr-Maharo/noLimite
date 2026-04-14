// 🔥 IMPORT FIREBASE
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } 
from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// 🔥 CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
  authDomain: "nolimite-29e0b.firebaseapp.com",
  databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nolimite-29e0b",
};

// INIT
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// 🎮 GAME CANVAS
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

// 🎮 DATA
let myId;
let players = {};
let me = {
    x: Math.random()*1000,
    y: Math.random()*1000,
    hp:100,
    name:"Player"
};

// =======================
// 🔐 AUTH SYSTEM
// =======================

// SIGN UP
document.getElementById("signup-btn").onclick = () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    createUserWithEmailAndPassword(auth, email, pass)
    .then(() => alert("Compte créé ✅"))
    .catch(err => alert(err.message));
};

// LOGIN
document.getElementById("login-btn").onclick = () => {
    const email = document.getElementById("email").value;
    const pass = document.getElementById("password").value;

    signInWithEmailAndPassword(auth, email, pass)
    .then(() => alert("Connecté ✅"))
    .catch(err => alert(err.message));
};

// AUTO LOGIN
onAuthStateChanged(auth, (user) => {
    if(user){
        document.getElementById("auth-screen").style.display="none";
        document.getElementById("lobby-screen").style.display="block";
    }
});

// =======================
// 🎮 JOIN GAME
// =======================

document.getElementById("join-btn").onclick = () => {
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
    draw();
}

// =======================
// 🎮 CONTROLS
// =======================

function setupControls(pRef){

    document.getElementById("btn-up").onclick=()=>move(pRef,0,-10);
    document.getElementById("btn-down").onclick=()=>move(pRef,0,10);
    document.getElementById("btn-left").onclick=()=>move(pRef,-10,0);
    document.getElementById("btn-right").onclick=()=>move(pRef,10,0);

    document.getElementById("btn-attack").onclick=()=>{
        for(let id in players){
            if(id===myId) continue;

            let e=players[id];
            let dist=Math.hypot(me.x-e.x,me.y-e.y);

            if(dist<80){
                remove(ref(db,"players/"+id));
            }
        }
    };
}

function move(pRef,dx,dy){
    me.x+=dx;
    me.y+=dy;

    update(pRef,{
        x:me.x,
        y:me.y
    });
}

// =======================
// 🎨 DRAW GAME
// =======================

function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    for(let id in players){
        let p=players[id];

        let x=p.x-me.x+canvas.width/2;
        let y=p.y-me.y+canvas.height/2;

        // PLAYER
        ctx.beginPath();
        ctx.arc(x,y,20,0,Math.PI*2);
        ctx.fillStyle=id===myId?"cyan":"red";
        ctx.fill();

        // NAME
        ctx.fillStyle="white";
        ctx.textAlign="center";
        ctx.fillText(p.name||"Player",x,y-25);
    }

    requestAnimationFrame(draw);
}
