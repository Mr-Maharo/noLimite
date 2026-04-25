import { db } from "./firebase.js";
import { doc, onSnapshot, updateDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { renderBoard, selectedCell } from "./board.js";

import { botPlay } from "./bot.js";
let currentRoomId = null;

window.addEventListener("beforeunload", () => {
    if (currentRoomId) {
        localStorage.setItem("lastRoom", currentRoomId);
    }
});

export function enterGame(roomId) {

    currentRoomId = roomId;

 onSnapshot(doc(db, "rooms", roomId), (snap) => {

    if (!snap.exists()) return;

    const game = snap.data();

    if (!game || !game.board) {
        console.warn("Room tsy mbola ready");
        return;
    }

    renderBoard(game);
});
async function handleMove(cell, game) {
    console.log("move...");
});
