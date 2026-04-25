import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc,
    onSnapshot, serverTimestamp, getDocs, addDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

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
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentRoomId = null;
let selectedCell = null;
let invitesUnsub = null;
let friendsUnsub = null;
let gameUnsub = null;

onAuthStateChanged(auth, (user) => {
    if (!user) return;
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');
    initLobby();
    initFriends(user.uid);
    initInvites(user.uid);
});

document.getElementById('btn-google').onclick = () => {
    signInWithPopup(auth, provider);
};

function cloneBoard(board) {
    return JSON.parse(JSON.stringify(board));
}

function getCell(board, x, y) {
    return board.find(c => c.x === x && c.y === y);
}

function addClick(el, fn) {
    if(!el) return;
    el.onclick = fn;
}

function initFriends(uid) {
    if (friendsUnsub) friendsUnsub();
    friendsUnsub = onSnapshot(collection(db, "friends"), (snap) => {
        const list = document.getElementById("friends-list");
        if (!list) return;
        list.innerHTML = "";
        snap.forEach(docSnap => {
            const f = docSnap.data();
            if (f.users.includes(uid)) {
                const i = f.users[0] === uid ? 1 : 0;
                const el = document.createElement("div");
                el.innerHTML = `👤 ${f.names[i]} <button id="inv-${f.users[i]}">Invite</button>`;
                list.appendChild(el);
                addClick(el.querySelector('button'), () => sendInvite(f.users[i], f.names[i]));
            }
        });
    });
}

async function sendInvite(id, name) {
    await addDoc(collection(db, "invites"), {
        from: auth.currentUser.uid,
        fromName: auth.currentUser.displayName,
        to: id,
        toName: name,
        status: "pending",
        createdAt: Date.now()
    });
}

function initInvites(uid) {
    if (invitesUnsub) invitesUnsub();
    invitesUnsub = onSnapshot(collection(db, "invites"), (snap) => {
        snap.forEach(docSnap => {
            const i = docSnap.data();
            if (i.to !== uid || i.status !== "pending") return;
            if (Date.now() - i.createdAt > 30000) {
                updateDoc(doc(db, "invites", docSnap.id), { status: "expired" });
                return;
            }
            showInviteUI(docSnap.id, i);
        });
    });
}

function showInviteUI(id, invite) {
    if (document.getElementById("invite-"+id)) return;
    const box = document.createElement("div");
    box.id = "invite-"+id;
    box.className = "invite-popup";
    box.innerHTML = `<p>🎮 ${invite.fromName}</p><button class="a">Accept</button><button class="d">Decline</button>`;
    document.body.appendChild(box);

    box.querySelector(".a").onclick = async () => {
        await acceptInvite(id, invite);
        box.remove();
    };
    box.querySelector(".d").onclick = async () => {
        await updateDoc(doc(db,"invites",id),{status:"declined"});
        box.remove();
    };
    setTimeout(()=>box.remove(), 30000);
}

async function acceptInvite(id, i) {
    const room = Math.floor(100000 + Math.random() * 900000).toString();
    await setDoc(doc(db,"rooms",room),{
        creator:{id:i.from, name:i.fromName},
        opponent:{id:i.to, name:i.toName},
        turn:i.from,
        status:"playing",
        board:initBoard()
    });
    await updateDoc(doc(db,"invites",id),{status:"accepted"});
    enterGame(room);
}

function initLobby() {
    onSnapshot(collection(db,"rooms"),(snap)=>{
        const div = document.getElementById("rooms-list-dynamic");
        if(!div) return;
        div.innerHTML="";
        snap.forEach(d=>{
            const el = document.createElement("div");
            el.innerHTML = `${d.id} <button id="join-${d.id}">Join</button>`;
            div.appendChild(el);
            addClick(el.querySelector('button'), () => window.joinRoom(d.id));
        });
    });
}

window.joinRoom = async (id)=>{
    await updateDoc(doc(db,"rooms",id),{
        opponent:{id:auth.currentUser.uid, name:auth.currentUser.displayName || "Player"},
        status:"playing"
    });
    enterGame(id);
};

function enterGame(id){
    currentRoomId = id;
    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');
    if(gameUnsub) gameUnsub();
    gameUnsub = onSnapshot(doc(db,"rooms",id),(snap)=>{
        const game = snap.data();
        if(!game) return;
        render(game);
        if(game.winner) { alert("Winner: "+game.winner); return; }
        if(game.turn === "bot") botPlay(game);
    });
}

function initBoard(){
    let b=[];
    for(let y=0;y<5;y++){
        for(let x=0;x<9;x++){
            let v=0;
            if(y<2) v=1; else if(y>2) v=2;
            b.push({x,y,value:v});
        }
    }
    return b;
}

function render(game){
    const grid=document.getElementById("fanorona-grid");
    if(!grid) return;
    grid.innerHTML="";
    game.board.forEach(cell=>{
        const div=document.createElement("div");
        div.className="grid-spot";
        if(selectedCell && selectedCell.x===cell.x && selectedCell.y===cell.y) div.style.background="yellow";
        if(cell.value){
            const s=document.createElement("div");
            s.className=cell.value===1?"black":"white";
            div.appendChild(s);
        }
        addClick(div,()=>move(cell,game));
        grid.appendChild(div);
    });
}

async function move(cell,game){
    if(game.turn!==auth.currentUser.uid) return;
    const my = game.creator.id===auth.currentUser.uid?1:2;
    const enemy = my===1?2:1;

    if(!selectedCell){
        if(cell.value===my){ selectedCell=cell; render(game); }
        return;
    }

    let dx=cell.x-selectedCell.x, dy=cell.y-selectedCell.y;
    if(Math.abs(dx)<=1 && Math.abs(dy)<=1 && cell.value===0){
        let b=cloneBoard(game.board);
        getCell(b,selectedCell.x,selectedCell.y).value=0;
        getCell(b,cell.x,cell.y).value=my;
        let x=cell.x+dx, y=cell.y+dy;
        while(true){
            let t=getCell(b,x,y);
            if(t && t.value===enemy){ t.value=0; x+=dx; y+=dy; } else break;
        }
        const win = checkWin(b);
        const next = (game.opponent.id === "bot" || !game.opponent.id) ? "bot" : (game.turn === game.creator.id ? game.opponent.id : game.creator.id);
        selectedCell=null;
        await updateDoc(doc(db,"rooms",currentRoomId),{
            board:b,
            turn: win ? "end" : next,
            winner: win
        });
    } else { selectedCell=null; render(game); }
}

function botPlay(game){
    setTimeout(async()=>{
        let b=cloneBoard(game.board);
        let best=null, score=-1;
        b.filter(c=>c.value===2).forEach(p=>{
            for(let dx=-1;dx<=1;dx++){
                for(let dy=-1;dy<=1;dy++){
                    if(!dx && !dy) continue;
                    let t=getCell(b,p.x+dx,p.y+dy);
                    if(t && t.value===0){
                        let s=0, x=p.x+dx+dx, y=p.y+dy+dy;
                        while(true){
                            let c=getCell(b,x,y);
                            if(c && c.value===1){ s++; x+=dx; y+=dy; } else break;
                        }
                        if(s>score){ score=s; best={p,dx,dy}; }
                    }
                }
            }
        });
        if(!best) return;
        let nb=cloneBoard(game.board);
        getCell(nb,best.p.x,best.p.y).value=0;
        getCell(nb,best.p.x+best.dx,best.p.y+best.dy).value=2;
        let x=best.p.x+best.dx+best.dx, y=best.p.y+best.dy+best.dy;
        while(true){
            let c=getCell(nb,x,y);
            if(c && c.value===1){ c.value=0; x+=best.dx; y+=best.dy; } else break;
        }
        await updateDoc(doc(db,"rooms",currentRoomId),{ board:nb, turn:game.creator.id });
    },500);
}

function checkWin(b){
    const v1 = b.filter(c=>c.value===1).length;
    const v2 = b.filter(c=>c.value===2).length;
    if(v1 === 0) return "BOT/WHITE";
    if(v2 === 0) return "PLAYER/BLACK";
    return null;
}
