import { db } from "./firebase.js";
import { collection, addDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

export function initChat(roomId, user) {

    const box = document.getElementById("chat-messages");

    onSnapshot(query(collection(db, "rooms", roomId, "chat"), orderBy("time")), snap => {

        box.innerHTML = "";

        snap.forEach(doc => {
            const m = doc.data();

            const div = document.createElement("div");
            div.innerHTML = `<b>${m.name}</b>: ${m.text}`;
            box.appendChild(div);
        });

        box.scrollTop = box.scrollHeight;
    });

    document.getElementById("send-chat").onclick = async () => {

        const input = document.getElementById("chat-input");

        if (!input.value.trim()) return;

        await addDoc(collection(db, "rooms", roomId, "chat"), {
            text: input.value,
            name: user.displayName,
            time: Date.now()
        });

        input.value = "";
    };
}
