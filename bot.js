// bot.js

export function botPlay(board) {

    const bot = 2;
    const enemy = 1;

    let bestMove = null;
    let bestScore = -Infinity;

    for (let i = 0; i < board.length; i++) {

        const from = board[i];
        if (from.value !== bot) continue;

        for (let j = 0; j < board.length; j++) {

            const to = board[j];
            if (to.value !== 0) continue;

            const dx = to.x - from.x;
            const dy = to.y - from.y;

            // move valid (1 step only)
            if (Math.abs(dx) > 1 || Math.abs(dy) > 1) continue;

            let score = 0;

            // ⭐ Capture check (fanorona simple)
            const nx = to.x + dx;
            const ny = to.y + dy;

            const capture = board.find(c =>
                c.x === nx && c.y === ny && c.value === enemy
            );

            if (capture) score += 20;

            // ⭐ center control
            if (to.x >= 3 && to.x <= 5) score += 3;
            if (to.y >= 1 && to.y <= 3) score += 2;

            // ⭐ avoid danger (basic defense)
            const danger = board.find(c =>
                c.value === enemy &&
                Math.abs(c.x - to.x) <= 1 &&
                Math.abs(c.y - to.y) <= 1
            );

            if (danger) score -= 5;

            // ⭐ randomness (less chaotic)
            score += Math.random() * 2;

            if (score > bestScore) {
                bestScore = score;
                bestMove = { from, to };
            }
        }
    }

    return bestMove;
}
