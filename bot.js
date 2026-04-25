import { cloneBoard, getCell } from "./utils.js";

export async function botPlay(game, db, currentRoomId) {

    let board = cloneBoard(game.board);

    let myPieces = board.filter(c => c.value === 2);

    for (let p of myPieces) {

        for (let dx=-1; dx<=1; dx++) {
            for (let dy=-1; dy<=1; dy++) {

                if (dx===0 && dy===0) continue;

                let nx = p.x + dx;
                let ny = p.y + dy;

                let target = getCell(board, nx, ny);
                if (!target || target.value !== 0) continue;

                getCell(board, p.x, p.y).value = 0;
                getCell(board, nx, ny).value = 2;

                await updateDoc(doc(db, "rooms", currentRoomId), {
                    board,
                    turn: game.creator.id
                });

                return;
            }
        }
    }
}
