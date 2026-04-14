import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// FIREBASE CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
  databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// GAME
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
canvas.width = innerWidth;
canvas.height = innerHeight;

let myId;
let players = {};

let me = {
    x: Math.random()*1000,
    y: Math.random()*1000,
    hp:100
};

// CREATE PLAYER
const pRef = ref(db,"players/"+Date.now());
myId = pRef.key;
set(pRef, me);
onDisconnect(pRef).remove();

// LISTEN
onValue(ref(db,"players"), snap=>{
    players = snap.val()||{};
});

// MOVE
document.getElementById("btn-up").onclick=()=>move(0,-10);
document.getElementById("btn-down").onclick=()=>move(0,10);
document.getElementById("btn-left").onclick=()=>move(-10,0);
document.getElementById("btn-right").onclick=()=>move(10,0);

function move(dx,dy){
    me.x+=dx;
    me.y+=dy;
    update(pRef,{x:me.x,y:me.y});
}

// ATTACK
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

// DRAW
function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);

    for(let id in players){
        let p=players[id];

        let x=p.x-me.x+canvas.width/2;
        let y=p.y-me.y+canvas.height/2;

        ctx.beginPath();
        ctx.arc(x,y,20,0,Math.PI*2);
        ctx.fillStyle=id===myId?"cyan":"red";
        ctx.fill();
    }

    requestAnimationFrame(draw);
}

draw();
