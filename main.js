import { initAuth } from "./auth.js";
import { initLobby } from "./lobby.js";
import { enterGame } from "./game.js";

initAuth((user) => {

    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('lobby-screen').classList.remove('hidden');

    initLobby((roomId) => {
        enterGame(roomId);
    });

});
