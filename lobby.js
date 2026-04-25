import { db } from "./firebase.js";
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export function initLobby(onJoin) {

    const div = document.getElementById("rooms-list-dynamic");

    onSnapshot(collection(db, "rooms"), (snap) => {

        div.innerHTML = "";

        snap.forEach(docSnap => {

            const roomId = docSnap.id;

            const el = document.createElement("div");
            el.className = "room-item";

            const btn = document.createElement("button");
            btn.textContent = "Join";

            // ✔ SAFE CLICK (no global function)
            btn.addEventListener("click", () => {
                onJoin(roomId);
            });

            el.innerHTML = `<span>🏠 ${roomId}</span>`;
            el.appendChild(btn);

            div.appendChild(el);
        });
    });
}
