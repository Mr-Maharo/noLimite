import { initAuth } from "./auth.js";
import { initLobby } from "./lobby.js";
import { enterGame } from "./game.js";
import { tryReconnect } from "./reconnect.js";
import { initPresence } from "./presence.js";
console.log("JS LOADED OK");
initAuth((user) => {

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    // 👥 presence realtime
    initPresence(user);

    // 🔁 reconnect automatique
    tryReconnect(user, enterGame);

    initLobby((roomId) => {
        enterGame(roomId);
    });
});
