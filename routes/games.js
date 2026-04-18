const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET toutes les parties terminées
router.get('/', (req, res) => {
    const games = db.prepare('SELECT * FROM games WHERE finished = 1 ORDER BY date DESC').all();

    const result = games.map(g => {
        const players = db.prepare('SELECT * FROM game_players WHERE game_id = ?').all(g.id);
        players.forEach(p => {
            p.buyIns = db.prepare('SELECT amount FROM buy_ins WHERE game_player_id = ?')
                         .all(p.id).map(b => b.amount);
        });
        return {
            id:         g.id,
            date:       g.date,
            endDate:    g.end_date,
            smallBlind: g.small_blind,
            bigBlind:   g.big_blind,
            flash:      g.flash,
            players:    players.map(p => ({
                name:       p.player_name,
                total:      p.total,
                finalCash:  p.final_cash,
                flashAdj:   p.flash_adj,
                finalValue: p.final_value,
                gainLoss:   p.gain_loss,
                buyIns:     p.buyIns
            }))
        };
    });

    res.json(result);
});

// GET partie en cours
router.get('/current', (req, res) => {
    const g = db.prepare('SELECT * FROM games WHERE finished = 0 ORDER BY id DESC LIMIT 1').get();
    if (!g) return res.json(null);

    const players = db.prepare('SELECT * FROM game_players WHERE game_id = ?').all(g.id);
    players.forEach(p => {
        p.buyIns = db.prepare('SELECT amount FROM buy_ins WHERE game_player_id = ?')
                     .all(p.id).map(b => b.amount);
    });

    res.json({
        id:         g.id,
        date:       g.date,
        smallBlind: g.small_blind,
        bigBlind:   g.big_blind,
        players:    players.map(p => ({
            id:    p.id,
            name:  p.player_name,
            total: p.total,
            buyIns: p.buyIns
        }))
    });
});

// POST démarrer une partie
router.post('/start', (req, res) => {
    const { players, smallBlind, bigBlind } = req.body;

    if (!players || players.length < 2)
        return res.status(400).json({ error: 'Minimum 2 joueurs' });

    // Annuler toute partie en cours
    db.prepare('UPDATE games SET finished = 1 WHERE finished = 0').run();

    const gameId = db.prepare(
        'INSERT INTO games (date, small_blind, big_blind) VALUES (?, ?, ?)'
    ).run(new Date().toISOString(), smallBlind || 0.25, bigBlind || 0.50).lastInsertRowid;

    players.forEach(p => {
        const gpId = db.prepare(
            'INSERT INTO game_players (game_id, player_name, total) VALUES (?, ?, ?)'
        ).run(gameId, p.name, p.amount).lastInsertRowid;

        db.prepare('INSERT INTO buy_ins (game_player_id, amount) VALUES (?, ?)').run(gpId, p.amount);
    });

    res.json({ success: true, gameId });
});

// POST recave
router.post('/rebuy', (req, res) => {
    const { gamePlayers_id, amount } = req.body;
    if (!gamePlayers_id || !amount) return res.status(400).json({ error: 'Données manquantes' });

    // Chercher l'ID game_player via game_id + player_name
    const gp = db.prepare('SELECT * FROM game_players WHERE id = ?').get(gamePlayers_id);
    if (!gp) return res.status(404).json({ error: 'Joueur introuvable' });

    db.prepare('INSERT INTO buy_ins (game_player_id, amount) VALUES (?, ?)').run(gp.id, amount);
    db.prepare('UPDATE game_players SET total = total + ? WHERE id = ?').run(amount, gp.id);

    res.json({ success: true });
});

// POST terminer une partie
router.post('/end', (req, res) => {
    const { gameId, players, flash } = req.body;
    if (!gameId) return res.status(400).json({ error: 'gameId requis' });

    const updatePlayer = db.prepare(`
        UPDATE game_players
        SET final_cash  = ?,
            flash_adj   = ?,
            final_value = ?,
            gain_loss   = ?
        WHERE game_id = ? AND player_name = ?
    `);

    const endAll = db.transaction(() => {
        players.forEach(p => {
            updatePlayer.run(
                p.finalCash,
                p.flashAdj,
                p.finalValue,
                p.gainLoss,
                gameId,
                p.name
            );
        });
        db.prepare(`
            UPDATE games
            SET finished = 1, end_date = ?, flash = ?
            WHERE id = ?
        `).run(new Date().toISOString(), flash || 0, gameId);
    });

    endAll();
    res.json({ success: true });
});

// DELETE supprimer une partie
router.delete('/:id', (req, res) => {
    db.prepare('DELETE FROM games WHERE id = ?').run(req.params.id);
    res.json({ success: true });
});

// DELETE tout l'historique
router.delete('/', (req, res) => {
    db.prepare('DELETE FROM games WHERE finished = 1').run();
    res.json({ success: true });
});

module.exports = router;
