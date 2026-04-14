import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, onValue, remove } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

// 🔥 CONFIG-NAO
const firebaseConfig = {
  apiKey: "AIzaSyA7ZtoI2iBifQqfiDJ-K1xrUVpxAgK77Jo",
  authDomain: "nolimite-29e0b.firebaseapp.com",
  databaseURL: "https://nolimite-29e0b-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "nolimite-29e0b",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

// 🎮 Canvas
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

// 👤 Player
const playerId = Math.random().toString(36).substr(2, 9);
let x = 100;
let y = 100;

// ⌨️ Movement
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowUp") y -= 10;
  if (e.key === "ArrowDown") y += 10;
  if (e.key === "ArrowLeft") x -= 10;
  if (e.key === "ArrowRight") x += 10;

  updatePlayer();
});

// 📡 Update Firebase
function updatePlayer() {
  set(ref(db, 'players/' + playerId), {
    x: x,
    y: y
  });
}

// ❌ Remove rehefa miala
window.addEventListener("beforeunload", () => {
  remove(ref(db, 'players/' + playerId));
});

// 👥 Players rehetra
let players = {};

onValue(ref(db, 'players'), (snapshot) => {
  players = snapshot.val() || {};
});

// 🎨 Draw
function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let id in players) {
    const p = players[id];

    ctx.fillStyle = (id === playerId) ? "lime" : "red";
    ctx.fillRect(p.x, p.y, 20, 20);
  }

  requestAnimationFrame(draw);
}

draw();
updatePlayer();
