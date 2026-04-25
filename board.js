import { getCell } from "./utils.js";

export let selectedCell = null;

// ================= RENDER BOARD =================
export function renderBoard(game, onClick) {

    if (!game || !game.board) return;

    const grid = document.getElementById("fanorona-grid");
    if (!grid) return;

    grid.innerHTML = "";

    game.board.forEach(cell => {

        const div = document.createElement("div");
        div.className = "grid-spot";

        // highlight selection
        if (
            selectedCell &&
            selectedCell.x === cell.x &&
            selectedCell.y === cell.y
        ) {
            div.classList.add("selected");
        }

        // piece
        if (cell.value !== 0) {
            const stone = document.createElement("div");
            stone.className = cell.value === 1 ? "black" : "white";
            div.appendChild(stone);
        }

        // click handler
        div.onclick = () => {
            if (onClick) onClick(cell);
        };

        grid.appendChild(div);
    });
}

// ================= INIT BOARD =================
export function initBoard() {

    let board = [];

    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 9; x++) {

            let value = 0;

            if (y < 2) value = 1;
            else if (y > 2) value = 2;

            board.push({ x, y, value });
        }
    }

    return board;
}

// ================= SELECT LOGIC =================
export function setSelectedCell(cell) {
    selectedCell = cell;
}

export function clearSelectedCell() {
    selectedCell = null;
}
