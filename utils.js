export function cloneBoard(board) {
    return JSON.parse(JSON.stringify(board));
}

export function getCell(board, x, y) {
    return board.find(c => c.x === x && c.y === y);
}
