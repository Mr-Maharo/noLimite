import{initializeApp as _0x1a}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import{getDatabase as _0x2b,ref as _0x3c,set as _0x4d,onValue as _0x5e,update as _0x6f,remove as _0x7g,onDisconnect as _0x8h}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import{getAuth as _0x9i,signInWithEmailAndPassword as _0x10j,createUserWithEmailAndPassword as _0x11k,onAuthStateChanged as _0x12l}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const _0xconf={apiKey:"AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",authDomain:"nolimite-29e0b.firebaseapp.com",databaseURL:"https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",projectId:"nolimite-29e0b"};

const _0xapp=_0x1a(_0xconf);
const _0xdb=_0x2b(_0xapp);
const _0xauth=_0x9i(_0xapp);

const _0xc=document.getElementById("gameCanvas");
const _0xctx=_0xc.getContext("2d");

function _0xresize(){_0xc.width=innerWidth;_0xc.height=innerHeight}
onresize=_0xresize;_0xresize();

let _0xid,_0xpl={};
let _0xme={x:Math.random()*2000+500,y:Math.random()*2000+500,hp:100,kills:0,name:"P_"+Math.floor(Math.random()*999)};
const _0xmap=3000;
let _0xzone=1200;

document.getElementById("signup-btn").onclick=()=>{
let e=document.getElementById("email").value;
let p=document.getElementById("password").value;
_0x11k(_0xauth,e,p).catch(e=>alert(e.message))
};

document.getElementById("login-btn").onclick=()=>{
let e=document.getElementById("email").value;
let p=document.getElementById("password").value;
_0x10j(_0xauth,e,p).catch(e=>alert(e.message))
};

_0x12l(_0xauth,u=>{
if(u){
document.getElementById("auth-screen").style.display="none";
document.getElementById("lobby-screen").style.display="block";
}
});

document.getElementById("join-btn").onclick=()=>{
document.getElementById("lobby-screen").style.display="none";
document.getElementById("game-ui").style.display="block";
_0xstart()
};

function _0xstart(){
_0xid=_0xauth.currentUser.uid;
let r=_0x3c(_0xdb,"players/"+_0xid);
_0x4d(r,_0xme);
_0x8h(r).remove();

_0x5e(_0x3c(_0xdb,"players"),s=>{
_0xpl=s.val()||{};
if(!_0xpl[_0xid])location.reload()
});

_0xjoy(r);
_0xdraw()
}

function _0xjoy(r){
let m=nipplejs.create({zone:document.getElementById("joystick-zone"),mode:"static",position:{left:"50%",top:"50%"},color:"cyan"});

m.on("move",(e,d)=>{
if(d.vector){
let sp=12;
_0xme.x=Math.max(0,Math.min(_0xmap,_0xme.x+d.vector.x*sp));
_0xme.y=Math.max(0,Math.min(_0xmap,_0xme.y-d.vector.y*sp));
_0x6f(r,{x:_0xme.x,y:_0xme.y})
}
});

document.getElementById("btn-attack").onclick=_0xatk
}

function _0xatk(){
for(let i in _0xpl){
if(i===_0xid)continue;
let e=_0xpl[i];
let d=Math.hypot(_0xme.x-e.x,_0xme.y-e.y);

if(d<80){
let hp=(e.hp||100)-15;
if(hp<=0){
_0x7g(_0x3c(_0xdb,"players/"+i));
_0xme.kills++;
_0x6f(_0x3c(_0xdb,"players/"+_0xid),{kills:_0xme.kills})
}else{
_0x6f(_0x3c(_0xdb,"players/"+i),{hp:hp})
}
}
}
}

setInterval(()=>{if(_0xzone>200)_0xzone-=2},1000);

function _0xzoneD(){
let d=Math.hypot(_0xme.x-_0xmap/2,_0xme.y-_0xmap/2);
if(d>_0xzone){
_0xme.hp-=0.3;
_0x6f(_0x3c(_0xdb,"players/"+_0xid),{hp:_0xme.hp})
}
}

function _0xdraw(){
_0xctx.fillStyle="#0a0a0f";
_0xctx.fillRect(0,0,_0xc.width,_0xc.height);

_0xzoneD();

let cx=_0xc.width/2-_0xme.x;
let cy=_0xc.height/2-_0xme.y;

_0xctx.strokeStyle="rgba(0,255,255,0.05)";
for(let x=0;x<=_0xmap;x+=100){
_0xctx.beginPath();
_0xctx.moveTo(x+cx,cy);
_0xctx.lineTo(x+cx,_0xmap+cy);
_0xctx.stroke()
}
for(let y=0;y<=_0xmap;y+=100){
_0xctx.beginPath();
_0xctx.moveTo(cx,y+cy);
_0xctx.lineTo(_0xmap+cx,y+cy);
_0xctx.stroke()
}

_0xctx.beginPath();
_0xctx.arc(_0xmap/2+cx,_0xmap/2+cy,_0xzone,0,Math.PI*2);
_0xctx.strokeStyle="purple";
_0xctx.lineWidth=10;
_0xctx.stroke();

for(let i in _0xpl){
let p=_0xpl[i];
let sx=p.x+cx;
let sy=p.y+cy;

_0xctx.fillStyle=i===_0xid?"cyan":"red";
_0xctx.beginPath();
_0xctx.arc(sx,sy,20,0,Math.PI*2);
_0xctx.fill();

_0xctx.fillStyle="#333";
_0xctx.fillRect(sx-25,sy-35,50,6);
_0xctx.fillStyle=(p.hp||100)>40?"#0f0":"#f00";
_0xctx.fillRect(sx-25,sy-35,((p.hp||100)/100)*50,6);

_0xctx.fillStyle="white";
_0xctx.font="12px Arial";
_0xctx.textAlign="center";
_0xctx.fillText(p.name||"P",sx,sy-45)
}

_0xctx.fillStyle="white";
_0xctx.font="bold 20px sans-serif";
_0xctx.textAlign="left";
_0xctx.fillText("Kills: "+_0xme.kills,20,40);
_0xctx.fillText("HP: "+Math.floor(_0xme.hp)+"%",20,70);

requestAnimationFrame(_0xdraw)
}
