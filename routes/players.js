const express = require('express');
const router  = express.Router();
const db      = require('../database');

// GET tous les joueurs
router.get('/', (req, res) => {
    const players = db.prepare('SELECT * FROM players ORDER BY name').all();
    res.json(players.map(p => p.name));
});

// POST ajouter un joueur
router.post('/', (req, res) => {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Nom requis' });
    const clean = name.trim().substring(0, 20);

    try {
        db.prepare('INSERT INTO players (name) VALUES (?)').run(clean);
        res.json({ success: true, name: clean });
    } catch (e) {
        res.status(409).json({ error: 'Joueur déjà existant' });
    }
});

// DELETE supprimer un joueur
router.delete('/:name', (req, res) => {
    db.prepare('DELETE FROM players WHERE name = ?').run(req.params.name);
    res.json({ success: true });
});

module.exports = router;
