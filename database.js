const Database = require('better-sqlite3');
const path     = require('path');
const fs       = require('fs');

// Créer le dossier data si inexistant
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);

const db = new Database(path.join(dataDir, 'poker.db'));

// Performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
//  CRÉATION DES TABLES
// ============================================================
db.exec(`
    CREATE TABLE IF NOT EXISTS players (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT    NOT NULL UNIQUE,
        created_at TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS games (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        date        TEXT    NOT NULL,
        end_date    TEXT,
        small_blind REAL    NOT NULL DEFAULT 0.25,
        big_blind   REAL    NOT NULL DEFAULT 0.50,
        flash       REAL    DEFAULT 0,
        finished    INTEGER DEFAULT 0,
        created_at  TEXT    DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS game_players (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        game_id     INTEGER NOT NULL REFERENCES games(id) ON DELETE CASCADE,
        player_name TEXT    NOT NULL,
        total       REAL    NOT NULL DEFAULT 0,
        final_cash  REAL    DEFAULT 0,
        flash_adj   REAL    DEFAULT 0,
        final_value REAL    DEFAULT 0,
        gain_loss   REAL    DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS buy_ins (
        id             INTEGER PRIMARY KEY AUTOINCREMENT,
        game_player_id INTEGER NOT NULL REFERENCES game_players(id) ON DELETE CASCADE,
        amount         REAL    NOT NULL,
        created_at     TEXT    DEFAULT (datetime('now'))
    );
`);

// Insérer joueurs par défaut si table vide
const count = db.prepare('SELECT COUNT(*) as c FROM players').get();
if (count.c === 0) {
    const insert = db.prepare('INSERT OR IGNORE INTO players (name) VALUES (?)');
    ['Alice', 'Bob', 'Charlie', 'David', 'Eva'].forEach(n => insert.run(n));
}

module.exports = db;
