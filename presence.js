import { getDatabase, ref, set, onDisconnect, onValue } 
from "https://www.gstatic.com/firebasejs/9.22.1/firebase-database.js";

import { db } from "./firebase.js";
import { doc, updateDoc, serverTimestamp } 
from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

const rtdb = getDatabase();

export function initPresence(user) {

    const statusRef = ref(rtdb, `/status/${user.uid}`);

    // 👉 online
    set(statusRef, {
        state: "online",
        lastChanged: Date.now()
    });

    // 👉 offline automatique rehefa miala / tapaka internet
    onDisconnect(statusRef).set({
        state: "offline",
        lastChanged: Date.now()
    });

    // 👉 sync Firestore (for UI list)
    onValue(statusRef, async (snap) => {

        const data = snap.val();

        await updateDoc(doc(db, "users", user.uid), {
            online: data.state === "online",
            lastSeen: serverTimestamp()
        });
    });
}
