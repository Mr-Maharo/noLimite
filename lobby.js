import { db } from "./firebase.js";
import { collection, onSnapshot } 
from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export function initLobby(joinRoom) {

    const btnCreate = document.getElementById("btn-create-room");
    const btnQuick = document.getElementById("btn-quick-play");
    const modal = document.getElementById("modal-create");

    // ================= CREATE ROOM =================
    if (btnCreate) {
        btnCreate.onclick = () => {
            if (modal) modal.classList.remove("hidden");
        };
    }

    // ================= QUICK PLAY (TEMP FIX) =================
    btnQuick.onclick = async () => {

    console.log("QUICK PLAY START");

    // temporary real room
    const roomId = "room_" + Date.now();

    await setDoc(doc(db, "rooms", roomId), {
        status: "waiting",
        board: initBoard ? initBoard() : [],
        creator: "me",
        opponent: null
    });

    joinRoom(roomId);
};
    // ================= ROOMS LIST =================
    onSnapshot(collection(db, "rooms"), (snap) => {

        const div = document.getElementById("rooms-list-dynamic");
        if (!div) return;

        div.innerHTML = "";

        snap.forEach(docu => {

            const el = document.createElement("div");

            el.innerHTML = `
                <span>${docu.id}</span>
                <button class="join-btn">Join</button>
            `;

            const btn = el.querySelector(".join-btn");

            // ✔ SAFE click (tsy break UI)
            btn.addEventListener("click", () => {
                joinRoom(docu.id);
            });

            div.appendChild(el);
        });
    });
}
