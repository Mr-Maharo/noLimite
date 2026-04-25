import { initAuth } from "./auth.js";
import { initLobby } from "./lobby.js";
import { enterGame } from "./game.js";
import { tryReconnect } from "./reconnect.js";
import { initPresence } from "./presence.js";

console.log("MAIN JS LOADED");

// 🔥 DEBUG CLICK (ok)
document.addEventListener("click", (e) => {
    console.log("CLICK:", e.target);
});

initAuth((user) => {

    console.log("USER LOGGED IN");

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    initPresence(user);
    tryReconnect(user, enterGame);

    initLobby((roomId) => {
        console.log("JOIN ROOM:", roomId);
        enterGame(roomId);
    });
});
