import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export function initLobby(joinRoom) {

    onSnapshot(collection(db, "rooms"), (snap) => {

        const div = document.getElementById("rooms-list-dynamic");
        div.innerHTML = "";

        snap.forEach(doc => {
            const el = document.createElement("div");

            el.innerHTML = `
                ${doc.id}
                <button onclick="window.joinRoom('${doc.id}')">Join</button>
            `;

            div.appendChild(el);
        });
    });

    window.joinRoom = joinRoom;
}
