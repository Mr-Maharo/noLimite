import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export function initLobby(joinRoom) {

    const btnCreate = document.getElementById("btn-create-room");
    const btnQuick = document.getElementById("btn-quick-play");

    if (btnCreate) {
        btnCreate.onclick = () => {
            document.getElementById("modal-create").classList.remove("hidden");
        };
    }

    if (btnQuick) {
        btnQuick.onclick = () => {
            joinRoom("quick"); // placeholder raha mbola tsy matchmaking
        };
    }

    onSnapshot(collection(db, "rooms"), (snap) => {

        const div = document.getElementById("rooms-list-dynamic");
        div.innerHTML = "";

        snap.forEach(doc => {
            const el = document.createElement("div");

            el.innerHTML = `
                <span>${doc.id}</span>
                <button class="join-btn">Join</button>
            `;

            el.querySelector(".join-btn").onclick = () => {
                joinRoom(doc.id);
            };

            div.appendChild(el);
        });
    });
}
