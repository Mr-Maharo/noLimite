import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { 
    getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import { 
    getFirestore, collection, doc, setDoc, getDoc, updateDoc,
    onSnapshot, serverTimestamp, getDocs, addDoc, query, orderBy
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// ================= CONFIG =================
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

// ================= VARIABLES =================
let currentRoomId = null;
let selectedCell = null;

let invitesUnsub = null;
let friendsUnsub = null;

// ================= AUTH =================
onAuthStateChanged(auth, (user) => {

    if (!user) return;

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    initLobby();
    initFriends(user.uid);
    initInvites(user.uid);
});

// ================= LOGIN =================
document.getElementById('btn-google').onclick = () => {
    signInWithPopup(auth, provider);
};

// ================= UTILS =================
function cloneBoard(board) {
    return JSON.parse(JSON.stringify(board));
}

function getCell(board, x, y) {
    return board.find(c => c.x === x && c.y === y);
}

function addClick(el, fn) {
    el.onclick = fn;
    el.ontouchstart = fn;
}

// ================= FRIEND SYSTEM =================
async function addFriend(friendId, friendName) {

    const myId = auth.currentUser.uid;

    await setDoc(doc(db, "friends", `${myId}_${friendId}`), {
        users: [myId, friendId],
        names: [auth.currentUser.displayName, friendName],
        createdAt: serverTimestamp()
    });

    await setDoc(doc(db, "friends", `${friendId}_${myId}`), {
        users: [friendId, myId],
        names: [friendName, auth.currentUser.displayName],
        createdAt: serverTimestamp()
    });
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
                el.innerHTML = `
                    👤 ${f.names[i]}
                    <button onclick="sendInvite('${f.users[i]}','${f.names[i]}')">Invite</button>
                `;
                list.appendChild(el);
            }
        });
    });
}

// ================= INVITE SYSTEM =================
function isExpired(invite) {
    return Date.now() - invite.createdAt > 30000;
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
            const id = docSnap.id;

            if (i.to !== uid || i.status !== "pending") return;

            if (isExpired(i)) {
                updateDoc(doc(db, "invites", id), { status: "expired" });
                return;
            }

            showInviteUI(id, i);
        });
    });
}

function showInviteUI(id, invite) {

    if (document.getElementById("invite-"+id)) return;

    const box = document.createElement("div");
    box.id = "invite-"+id;
    box.className = "invite-popup";

    box.innerHTML = `
        <p>🎮 ${invite.fromName}</p>
        <button class="a">Accept</button>
        <button class="d">Decline</button>
    `;

    document.body.appendChild(box);

    box.querySelector(".a").onclick = async () => {
        await acceptInvite(id, invite);
        box.remove();
    };

    box.querySelector(".d").onclick = async () => {
        await declineInvite(id);
        box.remove();
    };

    setTimeout(()=>box.remove(),30000);
}

async function acceptInvite(id, i) {

    const room = Math.floor(100000 + Math.random() * 900000).toString();

    await setDoc(doc(db,"rooms",room),{
        creator:{id:i.from,name:i.fromName},
        opponent:{id:i.to,name:i.toName},
        turn:i.from,
        status:"playing",
        board:initBoard()
    });

    await updateDoc(doc(db,"invites",id),{status:"accepted"});

    enterGame(room);
}

async function declineInvite(id){
    await updateDoc(doc(db,"invites",id),{status:"declined"});
}

// ================= LOBBY =================
function initLobby() {

    onSnapshot(collection(db,"rooms"),(snap)=>{

        const div = document.getElementById("rooms-list-dynamic");
        div.innerHTML="";

        snap.forEach(d=>{
            const el = document.createElement("div");
            el.innerHTML = `${d.id} <button onclick="joinRoom('${d.id}')">Join</button>`;
            div.appendChild(el);
        });
    });
}

// ================= JOIN =================
window.joinRoom = async (id)=>{

    await updateDoc(doc(db,"rooms",id),{
        opponent:{id:auth.currentUser.uid,name:"Player"},
        status:"playing"
    });

    enterGame(id);
};

// ================= GAME =================
function enterGame(id){

    currentRoomId = id;

    document.getElementById('lobby-screen').classList.add('hidden');
    document.getElementById('game-screen').classList.remove('hidden');

    onSnapshot(doc(db,"rooms",id),(snap)=>{

        const game = snap.data();
        render(game);

        if(game.winner){
            alert("Winner: "+game.winner);
            return;
        }

        if(game.turn==="bot") botPlay(game);
    });
}

// ================= BOARD =================
function initBoard(){

    let b=[];

    for(let y=0;y<5;y++){
        for(let x=0;x<9;x++){
            let v=0;
            if(y<2)v=1;
            else if(y>2)v=2;
            b.push({x,y,value:v});
        }
    }

    return b;
}

// ================= RENDER =================
function render(game){

    const grid=document.getElementById("fanorona-grid");
    grid.innerHTML="";

    game.board.forEach(cell=>{

        const div=document.createElement("div");
        div.className="grid-spot";

        if(selectedCell && selectedCell.x===cell.x && selectedCell.y===cell.y){
            div.style.background="yellow";
        }

        if(cell.value){
            const s=document.createElement("div");
            s.className=cell.value===1?"black":"white";
            div.appendChild(s);
        }

        addClick(div,()=>move(cell,game));
        grid.appendChild(div);
    });
}

// ================= MOVE =================
async function move(cell,game){

    if(game.turn!==auth.currentUser.uid) return;

    const my = game.creator.id===auth.currentUser.uid?1:2;
    const enemy = my===1?2:1;

    if(!selectedCell){
        if(cell.value===my){
            selectedCell=cell;
            render(game);
        }
        return;
    }

    let dx=cell.x-selectedCell.x;
    let dy=cell.y-selectedCell.y;

    if(Math.abs(dx)<=1 && Math.abs(dy)<=1 && cell.value===0){

        let b=cloneBoard(game.board);

        getCell(b,selectedCell.x,selectedCell.y).value=0;
        getCell(b,cell.x,cell.y).value=my;

        let x=cell.x+dx,y=cell.y+dy;

        while(true){
            let t=getCell(b,x,y);
            if(t && t.value===enemy){
                t.value=0;
                x+=dx;y+=dy;
            }else break;
        }

        selectedCell=null;

        const win=checkWin(b);

        await updateDoc(doc(db,"rooms",currentRoomId),{
            board:b,
            turn:win?"end":"bot",
            winner:win||null
        });

    }else{
        selectedCell=null;
    }
}

// ================= BOT LEVEL 3 =================
function botPlay(game){

    setTimeout(async()=>{

        let b=cloneBoard(game.board);
        let best=null,score=-999;

        b.filter(c=>c.value===2).forEach(p=>{

            for(let dx=-1;dx<=1;dx++){
                for(let dy=-1;dy<=1;dy++){

                    if(!dx&&!dy) continue;

                    let t=getCell(b,p.x+dx,p.y+dy);
                    if(!t||t.value!==0) continue;

                    let temp=cloneBoard(b);

                    getCell(temp,p.x,p.y).value=0;
                    getCell(temp,p.x+dx,p.y+dy).value=2;

                    let s=0,x=p.x+dx+dx,y=p.y+dy+dy;

                    while(true){
                        let c=getCell(temp,x,y);
                        if(c&&c.value===1){
                            s++;x+=dx;y+=dy;
                        }else break;
                    }

                    if(s>score){
                        score=s;
                        best={p,dx,dy};
                    }
                }
            }
        });

        if(!best) return;

        let nx=best.p.x+best.dx;
        let ny=best.p.y+best.dy;

        getCell(b,best.p.x,best.p.y).value=0;
        getCell(b,nx,ny).value=2;

        await updateDoc(doc(db,"rooms",currentRoomId),{
            board:b,
            turn:game.creator.id
        });

    },500);
}

// ================= WIN =================
function checkWin(b){

    const dirs=[[1,0],[0,1],[1,1],[1,-1]];

    for(let c of b){
        if(!c.value) continue;

        for(let[dX,dY] of dirs){

            let count=1;

            for(let i=1;i<3;i++){
                let n=getCell(b,c.x+dX*i,c.y+dY*i);
                if(n&&n.value===c.value) count++;
            }

            if(count>=3){
                return c.value===1?"PLAYER":"BOT";
            }
        }
    }

    return null;
}
