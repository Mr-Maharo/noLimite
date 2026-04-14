import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
const joinBtn = document.getElementById("join-btn");
const authScreen = document.getElementById("auth-screen");
const lobbyScreen = document.getElementById("lobby-screen");
const gameUI = document.getElementById("game-ui");

const btnAttack = document.getElementById("btn-attack");

const fpsEl = document.getElementById("fps");
const pingEl = document.getElementById("ping");

const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const sendBtn = document.getElementById("send-btn");

const searchInput = document.getElementById("search");
const friendList = document.getElementById("friend-list");
// FIREBASE CONFIG
const firebaseConfig = {
    apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
    authDomain: "nolimite-29e0b.firebaseapp.com",
    databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "nolimite-29e0b",
};

document.getElementById("signup-btn").onclick = async () => {
    let email = emailInput.value;
    let pass = passwordInput.value;
    let name = nameInput.value;

    try {
        let userCred = await createUserWithEmailAndPassword(auth,email,pass);

        await updateProfile(userCred.user,{displayName:name});

        await sendEmailVerification(userCred.user);

        alert("Verification email nalefa! Jereo mail-nao");

    } catch(e) {
        alert(e.message);
    }
};
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const auth = getAuth(app);

// CANVAS
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function resize(){ canvas.width=innerWidth; canvas.height=innerHeight; }
window.onresize=resize; resize();

// DATA
let myId;
let players={};
let me={
    x:Math.random()*2000+500,
    y:Math.random()*2000+500,
    hp:100,
    kills:0,
    name:"Player"
};

const MAP_SIZE=3000;
let zoneRadius=1200;

// AUTH
document.getElementById("signup-btn").onclick=async()=>{
    let email=emailInput.value;
    let pass=passwordInput.value;
    let name=nameInput.value;

    try{
        let userCred=await createUserWithEmailAndPassword(auth,email,pass);
        await updateProfile(userCred.user,{displayName:name});
        await sendEmailVerification(userCred.user);
        alert("Verify your email");
    }catch(e){ alert(e.message); }
};

document.getElementById("login-btn").onclick=()=>{
    signInWithEmailAndPassword(auth,emailInput.value,passwordInput.value)
    .catch(e=>alert(e.message));
};

const emailInput=document.getElementById("email");
const passwordInput=document.getElementById("password");
const nameInput=document.getElementById("name");

onAuthStateChanged(auth,user=>{
    if(user){
        if(!user.emailVerified){
            alert("Verify email first");
            signOut(auth);
            return;
        }

        me.name=user.displayName||"Player";

        authScreen.style.display="none";
        lobbyScreen.style.display="block";
    }
});

// START GAME
joinBtn.onclick=()=>{
    lobbyScreen.style.display="none";
    gameUI.style.display="block";
    startGame();
};

function startGame(){
    myId=auth.currentUser.uid;
    let pRef=ref(db,"players/"+myId);

    set(pRef,me);
    onDisconnect(pRef).remove();

    onValue(ref(db,"players"),snap=>{
        players=snap.val()||{};
        if(!players[myId]) location.reload();
    });

    setupJoystick(pRef);
    draw();
}

// JOYSTICK
function setupJoystick(pRef){
    const manager=nipplejs.create({
        zone:document.getElementById("joystick-zone"),
        mode:"static",
        position:{left:"50%",top:"50%"}
    });

    manager.on("move",(e,data)=>{
        if(data.vector){
            let speed=10;
            me.x+=data.vector.x*speed;
            me.y-=data.vector.y*speed;
            update(pRef,{x:me.x,y:me.y});
        }
    });

    btnAttack.onclick=attack;
}

// ATTACK
function attack(){
    for(let id in players){
        if(id===myId) continue;
        let p=players[id];
        let d=Math.hypot(me.x-p.x,me.y-p.y);

        if(d<80){
            let hp=(p.hp||100)-15;
            if(hp<=0){
                remove(ref(db,"players/"+id));
                me.kills++;
                update(ref(db,"players/"+myId),{kills:me.kills});
            }else{
                update(ref(db,"players/"+id),{hp:hp});
            }
        }
    }
}

// ZONE
setInterval(()=>{ if(zoneRadius>200) zoneRadius-=2; },1000);

function zoneDamage(){
    let d=Math.hypot(me.x-MAP_SIZE/2,me.y-MAP_SIZE/2);
    if(d>zoneRadius){
        me.hp-=0.3;
        update(ref(db,"players/"+myId),{hp:me.hp});
    }
}

// FPS
let last=performance.now();
function updateFPS(){
    let now=performance.now();
    let fps=Math.round(1000/(now-last));
    last=now;
    fpsEl.innerText="FPS: "+fps;
}

// PING
setInterval(()=>{
    let start=performance.now();
    update(ref(db,"ping/test"),{t:Date.now()}).then(()=>{
        pingEl.innerText="Ping: "+Math.round(performance.now()-start)+" ms";
    });
},2000);

// CHAT
sendBtn.onclick=()=>{
    let msg=chatInput.value;
    if(!msg) return;

    set(ref(db,"chat/"+Date.now()),{
        name:me.name,
        text:msg
    });
    chatInput.value="";
};

onValue(ref(db,"chat"),snap=>{
    let data=snap.val()||{};
    chatMessages.innerHTML="";
    Object.values(data).slice(-20).forEach(m=>{
        let div=document.createElement("div");
        div.innerText=m.name+": "+m.text;
        chatMessages.appendChild(div);
    });
});

// SEARCH
searchInput.oninput=updateFriends;

function updateFriends(){
    friendList.innerHTML="";
    let key=searchInput.value.toLowerCase();

    for(let id in players){
        let p=players[id];
        if(!p.name.toLowerCase().includes(key)) continue;

        let li=document.createElement("li");
        li.innerText=p.name;
        friendList.appendChild(li);
    }
}

// DRAW
function draw(){
    ctx.fillStyle="#0a0a0f";
    ctx.fillRect(0,0,canvas.width,canvas.height);

    zoneDamage();
    updateFPS();

    let cx=canvas.width/2-me.x;
    let cy=canvas.height/2-me.y;

    ctx.beginPath();
    ctx.arc(MAP_SIZE/2+cx,MAP_SIZE/2+cy,zoneRadius,0,Math.PI*2);
    ctx.strokeStyle="purple";
    ctx.stroke();

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
