import { getCell } from "./utils.js";

export let selectedCell = null;

export function renderBoard(game, onClick) {

    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";

 export function renderBoard(game) {

    if (!game?.board) return;

    const grid = document.getElementById("fanorona-grid");
    if (!grid) return;

    grid.innerHTML = "";

    game.board.forEach(cell => {
        const div = document.createElement("div");
        div.className = "grid-spot";

        grid.appendChild(div);
    });
}

    

export function initBoard() {
    let board = [];

    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 9; x++) {

            let v = 0;
            if (y < 2) v = 1;
            else if (y > 2) v = 2;

            board.push({ x, y, value: v });
        }
    }

    return board;
}
