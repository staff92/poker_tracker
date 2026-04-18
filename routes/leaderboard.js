const express = require('express');
const router  = express.Router();
const db      = require('../database');

router.get('/', (req, res) => {
    const stats = db.prepare(`
        SELECT
            gp.player_name                     AS name,
            COUNT(DISTINCT gp.game_id)         AS games,
            SUM(gp.total)                      AS totalInvested,
            SUM(gp.gain_loss)                  AS totalGain
        FROM game_players gp
        JOIN games g ON g.id = gp.game_id
        WHERE g.finished = 1
        GROUP BY gp.player_name
        ORDER BY totalGain DESC
    `).all();

    // Calculer les victoires
    stats.forEach(s => {
        const wins = db.prepare(`
            SELECT COUNT(*) as c
            FROM games g
            WHERE g.finished = 1
              AND (
                SELECT player_name
                FROM game_players
                WHERE game_id = g.id
                ORDER BY gain_loss DESC
                LIMIT 1
              ) = ?
        `).get(s.name);
        s.wins = wins.c;
    });

    res.json(stats);
});

module.exports = router;
