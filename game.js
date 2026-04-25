import { db } from "./firebase.js";
import { doc, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { renderBoard } from "./board.js";
import { botPlay } from "./bot.js";

let currentRoomId = null;

window.addEventListener("beforeunload", () => {
    if (currentRoomId) {
        localStorage.setItem("lastRoom", currentRoomId);
    }
});

export function enterGame(roomId) {

    console.log("ENTER GAME:", roomId);

    onSnapshot(doc(db, "rooms", roomId), (snap) => {

        if (!snap.exists()) return;

        const game = snap.data();

        console.log("GAME DATA:", game);

        renderBoard(game);
    });
}
// ================= MOVE SYSTEM =================
export async function handleMove(cell, game) {

    console.log("move...", cell);

    // TODO: logique move eto
}
