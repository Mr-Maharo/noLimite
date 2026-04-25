import { auth, provider } from "./firebase.js";
import { signInWithPopup, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";

export function initAuth(onLogin) {

    document.getElementById('btn-google').onclick = () => {
        signInWithPopup(auth, provider);
    };

    onAuthStateChanged(auth, (user) => {
        if (user) onLogin(user);
    });
}
