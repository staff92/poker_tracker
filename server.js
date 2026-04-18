const express = require('express');
const cors    = require('cors');
const path    = require('path');

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes API
app.use('/api/players',     require('./routes/players'));
app.use('/api/games',       require('./routes/games'));
app.use('/api/leaderboard', require('./routes/leaderboard'));

// Toujours servir index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🃏 Poker Tracker → http://localhost:${PORT}`));
