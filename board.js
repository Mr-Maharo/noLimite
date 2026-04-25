import { getCell } from "./utils.js";

export let selectedCell = null;

export function renderBoard(game, onClick) {

    const grid = document.getElementById("fanorona-grid");
    grid.innerHTML = "";

    game.board.forEach(cell => {

        const div = document.createElement("div");
        div.className = "grid-spot";

        if (selectedCell && selectedCell.x === cell.x && selectedCell.y === cell.y) {
            div.style.background = "gold";
        }

        if (cell.value !== 0) {
            const stone = document.createElement("div");
            stone.className = cell.value === 1 ? "black" : "white";
            div.appendChild(stone);
        }

        div.onclick = () => onClick(cell, game);
        div.ontouchstart = () => onClick(cell, game);

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
