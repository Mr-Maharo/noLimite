import { db } from "./firebase.js";
import {
  collection, addDoc, onSnapshot,
  query, where, deleteDoc, doc, getDocs, updateDoc
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";

let currentQueueId = null;

export async function findMatch(user, enterGame) {

    const q = query(collection(db, "queue"), where("status", "==", "waiting"));

    const snap = await getDocs(q);

    // 👉 raha misy player miandry
    if (!snap.empty) {
        const opponent = snap.docs[0];

        const roomId = Date.now().toString();

        await setDoc(doc(db, "rooms", roomId), {
            players: [opponent.data().uid, user.uid],
            turn: user.uid,
            board: initBoard(),
            status: "playing"
        });

        await deleteDoc(doc(db, "queue", opponent.id));

        enterGame(roomId);
        return;
    }

    // 👉 raha tsy misy dia miditra queue
    const qdoc = await addDoc(collection(db, "queue"), {
        uid: user.uid,
        status: "waiting",
        createdAt: Date.now()
    });

    currentQueueId = qdoc.id;
}
