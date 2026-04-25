export function botMove(board) {

    let bestMove = null;
    let bestScore = -999;

    const bot = 2;
    const enemy = 1;

    for (let i = 0; i < board.length; i++) {

        const p = board[i];
        if (p.value !== bot) continue;

        for (let j = 0; j < board.length; j++) {

            const t = board[j];
            if (t.value !== 0) continue;

            let score = 0;

            // ✔ capture check
            const dx = t.x - p.x;
            const dy = t.y - p.y;

            const nx = t.x + dx;
            const ny = t.y + dy;

            const target = board.find(c =>
                c.x === nx && c.y === ny && c.value === enemy
            );

            if (target) score += 10;

            // ✔ center control
            if (t.x >= 3 && t.x <= 5) score += 2;

            // ✔ random factor
            score += Math.random();

            if (score > bestScore) {
                bestScore = score;
                bestMove = { from: p, to: t };
            }
        }
    }

    return bestMove;
}
