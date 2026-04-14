import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// ELEMENTS
const joinBtn = document.getElementById("join-btn");
const authScreen = document.getElementById("auth-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameUI = document.getElementById("game-ui");

const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const nameInput = document.getElementById("name");

const btnAttack = document.getElementById("btn-attack");

// FIREBASE
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
function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
window.onresize = resize;
resize();

// DATA
let myId;
let players = {};
let me = {
    x: Math.random()*2000+500,
    y: Math.random()*2000+500,
    hp:100,
    kills:0,
    name:"Player"
};

const MAP_SIZE = 3000;
let zoneRadius = 1200;

// ================= AUTH =================

// SIGNUP
document.getElementById("signup-btn").onclick = async () => {
    try {
        let userCred = await createUserWithEmailAndPassword(
            auth,
            emailInput.value,
            passwordInput.value
        );

        await updateProfile(userCred.user,{
            displayName: nameInput.value
        });

        await sendEmailVerification(userCred.user);

        alert("Check your email then login");
    } catch(e){
        alert(e.message);
    }
};

// LOGIN
document.getElementById("login-btn").onclick = async () => {
    try {
        await signInWithEmailAndPassword(
            auth,
            emailInput.value,
            passwordInput.value
        );

        // IMPORTANT FIX
        await auth.currentUser.reload();

        if(!auth.currentUser.emailVerified){
            alert("Verify email first");
            await signOut(auth);
            return;
        }

    } catch(e){
        alert(e.message);
    }
};

// AUTH STATE
onAuthStateChanged(auth,user=>{
    if(user){
        me.name = user.displayName || "Player";

        authScreen.style.display="none";
        lobbyScreen.style.display="block";
    }
});

// ================= GAME =================

joinBtn.onclick = ()=>{
    lobbyScreen.style.display="none";
    gameUI.style.display="block";
    startGame();
};

function startGame(){
    myId = auth.currentUser.uid;

    let pRef = ref(db,"players/"+myId);

    set(pRef,me);
    onDisconnect(pRef).remove();

    onValue(ref(db,"players"),snap=>{
        players = snap.val() || {};
    });

    draw();
}

// ATTACK
btnAttack.onclick = ()=>{
    for(let id in players){
        if(id===myId) continue;

        let p = players[id];
        let d = Math.hypot(me.x-p.x,me.y-p.y);

        if(d<80){
            let hp = (p.hp||100)-15;

            if(hp<=0){
                remove(ref(db,"players/"+id));
                me.kills++;
                update(ref(db,"players/"+myId),{kills:me.kills});
            }else{
                update(ref(db,"players/"+id),{hp:hp});
            }
        }
    }
};

// ZONE
setInterval(()=>{
    if(zoneRadius>200) zoneRadius-=2;
},1000);

function zoneDamage(){
    let d=Math.hypot(me.x-MAP_SIZE/2,me.y-MAP_SIZE/2);
    if(d>zoneRadius){
        me.hp-=0.3;
        update(ref(db,"players/"+myId),{hp:me.hp});
    }
}

// DRAW
function draw(){
    ctx.fillStyle="#0a0a0f";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    zoneDamage();

    let cx=canvas.width/2-me.x;
    let cy=canvas.height/2-me.y;

    // zone
    ctx.beginPath();
    ctx.arc(MAP_SIZE/2+cx,MAP_SIZE/2+cy,zoneRadius,0,Math.PI*2);
    ctx.strokeStyle="purple";
    ctx.stroke();

    // players
    for(let id in players){
        let p=players[id];
        let x=p.x+cx;
        let y=p.y+cy;

        ctx.fillStyle=id===myId?"cyan":"red";
        ctx.beginPath();
        ctx.arc(x,y,20,0,Math.PI*2);
        ctx.fill();

        ctx.fillStyle="white";
        ctx.fillText(p.name,x,y-30);
    }

    requestAnimationFrame(draw);
}
