import { db } from "./firebase.js";
import {
    collection, addDoc,
    query, orderBy, onSnapshot
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

let chatRoomId = null;

export function initChat(roomId, user) {

    chatRoomId = roomId;

    const q = query(
        collection(db, "chats", roomId, "messages"),
        orderBy("time")
    );

    onSnapshot(q, (snap) => {

        const box = document.getElementById("chat-messages");
        box.innerHTML = "";

        snap.forEach(m => {
            const d = m.data();
            const el = document.createElement("div");

            el.textContent = `${d.name}: ${d.text}`;
            box.appendChild(el);
        });
    });

    document.getElementById("send-chat").onclick = async () => {

        const input = document.getElementById("chat-text");

        await addDoc(
            collection(db, "chats", roomId, "messages"),
            {
                uid: user.uid,
                name: user.displayName,
                text: input.value,
                time: Date.now()
            }
        );

        input.value = "";
    };
}
