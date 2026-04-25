import { db } from "./firebase.js";
import {
    doc, setDoc, onSnapshot,
    deleteDoc, getDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

// 👉 send invite
export async function sendInvite(from, to) {

    const inviteId = `${from}_${to}_${Date.now()}`;

    await setDoc(doc(db, "invites", inviteId), {
        from,
        to,
        status: "pending",
        createdAt: Date.now()
    });

    // ⏱ auto delete after 30s
    setTimeout(async () => {
        await deleteDoc(doc(db, "invites", inviteId));
    }, 30000);
}

// 👉 listen invites
export function listenInvites(userId, onAccept) {

    onSnapshot(collection(db, "invites"), (snap) => {

        snap.forEach(inv => {
            const data = inv.data();

            if (data.to === userId && data.status === "pending") {

                if (confirm(`Invite from ${data.from}`)) {
                    onAccept(data.from);
                }
            }
        });
    });
}
