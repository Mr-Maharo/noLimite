import { db } from "./firebase.js";
import { doc, getDoc, updateDoc } 
from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export async function tryReconnect(user, enterGame) {

    const savedRoom = localStorage.getItem("lastRoom");

    if (!savedRoom) return;

    const snap = await getDoc(doc(db, "rooms", savedRoom));

    if (!snap.exists()) return;

    const game = snap.data();

    // 👉 check raha mbola active
    if (game.status === "finished") return;

    // 👉 reconnect user
    if (game.players?.includes(user.uid)) {

        await updateDoc(doc(db, "rooms", savedRoom), {
            reconnectLog: Date.now()
        });

        enterGame(savedRoom);
    }
}
