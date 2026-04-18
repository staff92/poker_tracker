// ============================================================
//  CONFIG API
// ============================================================
const API = '/api';

// ============================================================
//  INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    document.getElementById('header-date').textContent =
        new Date().toLocaleDateString('fr-FR', {
            weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
        });
    await loadAll();
});

async function loadAll() {
    await loadPlayers();
    await loadCurrentGame();
    await renderHistory();
    await renderLeaderboard();
}

// ============================================================
//  JOUEURS
// ============================================================
let playersList = [];

async function loadPlayers() {
    const res    = await fetch(`${API}/players`);
    playersList  = await res.json();
    renderPlayers();
    renderGameSetup();
}

function renderPlayers() {
    const el = document.getElementById('players-list');
    el.innerHTML = '';

    if (playersList.length === 0) {
        el.innerHTML = `<p style="color:var(--text-muted)">Aucun joueur.</p>`;
        return;
    }

    playersList.forEach(name => {
        const chip = document.createElement('div');
        chip.className = 'player-chip';
        chip.innerHTML = `
            <span>👤 ${escHtml(name)}</span>
            <button class="remove-btn" onclick="removePlayer('${escHtml(name)}')">✕</button>
        `;
        el.appendChild(chip);
    });
}

async function addPlayer() {
    const input = document.getElementById('new-player-input');
    const name  = input.value.trim();
    if (!name) return showToast('Entrez un nom !', '#e74c3c');

    const res = await fetch(`${API}/players`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ name })
    });
    const data = await res.json();

    if (!res.ok) return showToast(data.error || 'Erreur', '#e74c3c');
    input.value = '';
    showToast(`✅ ${name} ajouté !`);
    await loadPlayers();
}

async function removePlayer(name) {
    if (!confirm(`Supprimer ${name} ?`)) return;
    await fetch(`${API}/players/${encodeURIComponent(name)}`, { method: 'DELETE' });
    showToast(`🗑️ ${name} supprimé`, '#e74c3c');
    await loadPlayers();
}

// ============================================================
//  SETUP PARTIE
// ============================================================
function renderGameSetup() {
    const el = document.getElementById('game-player-select');
    el.innerHTML = '';

    playersList.forEach((name, i) => {
        const card = document.createElement('div');
        card.className = 'player-select-card';
        card.id = `psc-${i}`;
        card.innerHTML = `
            <div class="psc-name">👤 ${escHtml(name)}</div>
            <label>Mise de départ (€)</label>
            <input type="number" id="psc-amount-${i}" min="0" step="1"
                placeholder="Ex: 20" onclick="event.stopPropagation()">
        `;
        card.addEventListener('click', () => togglePlayerSelect(i));
        el.appendChild(card);
    });
}

function togglePlayerSelect(i) {
    document.getElementById(`psc-${i}`).classList.toggle('selected');
}

async function startGame() {
    const selected = [];

    for (let i = 0; i < playersList.length; i++) {
        const card = document.getElementById(`psc-${i}`);
        if (!card?.classList.contains('selected')) continue;

        const amount = parseFloat(document.getElementById(`psc-amount-${i}`)?.value);
        if (!amount || amount <= 0) return showToast(`Mise manquante pour ${playersList[i]} !`, '#e74c3c');
        selected.push({ name: playersList[i], amount });
    }

    if (selected.length < 2) return showToast('Minimum 2 joueurs !', '#e74c3c');

    const sb = parseFloat(document.getElementById('small-blind').value) || 0.25;
    const bb = parseFloat(document.getElementById('big-blind').value)   || 0.50;

    const res = await fetch(`${API}/games/start`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ players: selected, smallBlind: sb, bigBlind: bb })
    });

    if (!res.ok) return showToast('Erreur démarrage', '#e74c3c');
    showToast('🚀 Partie lancée !');
    await loadCurrentGame();
    showTab('live');
}

// ============================================================
//  EN DIRECT
// ============================================================
let currentGame = null;

async function loadCurrentGame() {
    const res   = await fetch(`${API}/games/current`);
    currentGame = await res.json();
    renderLiveGame();
}

function renderLiveGame() {
    const noGame      = document.getElementById('no-game-msg');
    const liveContent = document.getElementById('live-content');
    const g           = currentGame;

    if (!g) {
        noGame.style.display      = 'block';
        liveContent.style.display = 'none';
        return;
    }

    noGame.style.display      = 'none';
    liveContent.style.display = 'block';

    document.getElementById('live-meta').textContent =
        `📅 ${new Date(g.date).toLocaleDateString('fr-FR', {
            day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit'
        })} · Blinds : ${fmt(g.smallBlind)} / ${fmt(g.bigBlind)}`;

    const total = g.players.reduce((s, p) => s + p.total, 0);
    document.getElementById('total-pot-display').textContent = fmt(total);

    const el = document.getElementById('players-live-grid');
    el.innerHTML = '';

    g.players.forEach(p => {
        const div = document.createElement('div');
        div.className = 'player-live-card';

        const histHtml = p.buyIns.length > 1
            ? `<div class="pbuy-history">
                Recaves : ${p.buyIns.slice(1).map(b => `<span>${fmt(b)}</span>`).join('')}
               </div>`
            : '';

        div.innerHTML = `
            <div class="pname">👤 ${escHtml(p.name)}</div>
            <div class="ptotal">Total misé : <strong>${fmt(p.total)}</strong>
                <span style="color:var(--text-muted); font-size:0.78rem;">
                    (1ère : ${fmt(p.buyIns[0])})
                </span>
            </div>
            ${histHtml}
            <div class="add-buy-row">
                <input type="number" id="rebuy-${p.id}" min="0" step="1"
                    placeholder="Recave (€)"
                    onkeydown="if(event.key==='Enter') addRebuy(${p.id}, '${escHtml(p.name)}')">
                <button class="btn btn-green btn-sm"
                    onclick="addRebuy(${p.id}, '${escHtml(p.name)}')">+ Recave</button>
            </div>
        `;
        el.appendChild(div);
    });
}

async function addRebuy(gpId, name) {
    const inp    = document.getElementById(`rebuy-${gpId}`);
    const amount = parseFloat(inp.value);
    if (!amount || amount <= 0) return showToast('Montant invalide !', '#e74c3c');

    await fetch(`${API}/games/rebuy`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ gamePlayers_id: gpId, amount })
    });

    inp.value = '';
    showToast(`💰 Recave ${fmt(amount)} pour ${name}`);
    await loadCurrentGame();
}

// ============================================================
//  FIN DE PARTIE — ÉTAPE 1
// ============================================================
function openEndModal() {
    const g = currentGame;
    if (!g) return;

    const el = document.getElementById('end-modal-players');
    el.innerHTML = '';

    g.players.forEach((p, i) => {
        const row = document.createElement('div');
        row.className = 'end-player-row';
        row.innerHTML = `
            <div class="ep-info">
                <div class="ep-name">👤 ${escHtml(p.name)}</div>
                <div class="ep-bet">A misé : <strong>${fmt(p.total)}</strong></div>
            </div>
            <div>
                <label>Argent rendu (€)</label>
                <input type="number" id="final-cash-${i}" min="0" step="0.01"
                    placeholder="0.00" oninput="updateStep1Totals()">
            </div>
        `;
        el.appendChild(row);
    });

    document.getElementById('step1-totals').style.display = 'none';
    document.getElementById('step1').style.display        = 'block';
    document.getElementById('step2').style.display        = 'none';
    document.getElementById('end-modal').classList.add('show');
}

function updateStep1Totals() {
    const g = currentGame;
    if (!g) return;

    const totalBet    = g.players.reduce((s, p) => s + p.total, 0);
    let totalReturned = 0;
    let allFilled     = true;

    g.players.forEach((p, i) => {
        const val = parseFloat(document.getElementById(`final-cash-${i}`)?.value);
        if (isNaN(val)) { allFilled = false; return; }
        totalReturned += val;
    });

    if (!allFilled) {
        document.getElementById('step1-totals').style.display = 'none';
        return;
    }

    const flash = +(totalBet - totalReturned).toFixed(2);
    document.getElementById('step1-totals').style.display    = 'block';
    document.getElementById('s1-total-bet').textContent      = fmt(totalBet);
    document.getElementById('s1-total-returned').textContent = fmt(totalReturned);
    document.getElementById('s1-flash').textContent          = fmt(flash);
}

function closeEndModal() {
    document.getElementById('end-modal').classList.remove('show');
}

// ============================================================
//  FIN DE PARTIE — ÉTAPE 2 : flash
// ============================================================
function goToStep2() {
    const g = currentGame;
    if (!g) return;

    const totalBet = g.players.reduce((s, p) => s + p.total, 0);
    let totalReturned = 0;
    let allFilled     = true;

    g.players.forEach((p, i) => {
        const val = parseFloat(document.getElementById(`final-cash-${i}`)?.value);
        if (isNaN(val) || val < 0) { allFilled = false; return; }
        p.finalCash = +val.toFixed(2);
        p.gainLoss  = +(p.finalCash - p.total).toFixed(2);
        totalReturned += val;
    });

    if (!allFilled) return showToast('Remplissez tous les montants !', '#e74c3c');

    const flash = +(totalBet - totalReturned).toFixed(2);
    g.flash     = flash;

    document.getElementById('step1').style.display = 'none';
    document.getElementById('step2').style.display = 'block';
    document.getElementById('flash-total-display').textContent = fmt(flash);

    // Récap
    const rows = g.players.map(p => {
        const cls  = p.gainLoss > 0 ? 'positive' : p.gainLoss < 0 ? 'negative' : 'neutral';
        const sign = p.gainLoss >= 0 ? '+' : '';
        return `<tr>
            <td>👤 ${escHtml(p.name)}</td>
            <td>${fmt(p.total)}</td>
            <td>${fmt(p.finalCash)}</td>
            <td class="${cls}">${sign}${fmt(p.gainLoss)}</td>
        </tr>`;
    }).join('');

    document.getElementById('step2-recap').innerHTML = `
        <div style="overflow-x:auto; margin-bottom:16px;">
            <table class="result-table">
                <thead><tr>
                    <th>Joueur</th><th>Misé</th><th>Rendu</th><th>G/P sans flash</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;

    // Flash attribution
    const assignEl = document.getElementById('flash-assignments');
    assignEl.innerHTML = '';

    g.players.forEach((p, i) => {
        const cls  = p.gainLoss > 0 ? 'positive' : p.gainLoss < 0 ? 'negative' : 'neutral';
        const sign = p.gainLoss >= 0 ? '+' : '';
        const row  = document.createElement('div');
        row.className = 'flash-assign-row';
        row.innerHTML = `
            <div class="fa-info">
                <div class="fa-name">👤 ${escHtml(p.name)}</div>
                <div class="fa-gain ${cls}">G/P : ${sign}${fmt(p.gainLoss)}</div>
            </div>
            <div>
                <label>Flash (€)</label>
                <input type="number" step="0.01" placeholder="0.00"
                    id="flash-adj-${i}" oninput="updateFlashBalance()">
            </div>
        `;
        assignEl.appendChild(row);
    });

    updateFlashBalance();
}

function updateFlashBalance() {
    const g = currentGame;
    if (!g) return;

    const flash  = g.flash || 0;
    let sumAdj   = 0;

    g.players.forEach((p, i) => {
        sumAdj += parseFloat(document.getElementById(`flash-adj-${i}`)?.value) || 0;
    });

    sumAdj          = +sumAdj.toFixed(2);
    const remaining = +(flash - sumAdj).toFixed(2);
    const balanced  = Math.abs(remaining) < 0.01;

    const el  = document.getElementById('balance-status');
    const btn = document.getElementById('confirm-end-btn');

    if (balanced) {
        el.className   = 'balance-ok';
        el.textContent = `✅ Flash distribué (${fmt(flash)})`;
        btn.disabled   = false;
    } else {
        el.className   = 'balance-bad';
        el.textContent = `⚠️ Reste : ${fmt(remaining)} sur ${fmt(flash)}`;
        btn.disabled   = true;
    }
}

function backToStep1() {
    document.getElementById('step1').style.display = 'block';
    document.getElementById('step2').style.display = 'none';
}

async function confirmEndGame() {
    const g = currentGame;
    if (!g) return;

    g.players.forEach((p, i) => {
        const adj    = parseFloat(document.getElementById(`flash-adj-${i}`)?.value) || 0;
        p.flashAdj   = +adj.toFixed(2);
        p.finalValue = +(p.finalCash + adj).toFixed(2);
        p.gainLoss   = +(p.finalValue - p.total).toFixed(2);
    });

    const res = await fetch(`${API}/games/end`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
            gameId:  g.id,
            players: g.players,
            flash:   g.flash
        })
    });

    if (!res.ok) return showToast('Erreur enregistrement !', '#e74c3c');

    currentGame = null;
    closeEndModal();
    renderLiveGame();
    await renderHistory();
    await renderLeaderboard();
    showToast('🏁 Partie enregistrée !');
    showTab('history');
}

// ============================================================
//  HISTORIQUE
// ============================================================
async function renderHistory() {
    const res    = await fetch(`${API}/games`);
    const games  = await res.json();
    const el     = document.getElementById('history-list');
    el.innerHTML = '';

    if (games.length === 0) {
        el.innerHTML = `<div class="empty-state"><div class="icon">📋</div><div>Aucune partie.</div></div>`;
        return;
    }

    games.forEach(game => {
        const totalPot = game.players.reduce((s, p) => s + p.total, 0);
        const sorted   = [...game.players].sort((a, b) => (b.gainLoss || 0) - (a.gainLoss || 0));
        const winner   = sorted[0];

        const rowsHtml = sorted.map(p => {
            const cls      = (p.gainLoss||0) > 0 ? 'positive' : (p.gainLoss||0) < 0 ? 'negative' : 'neutral';
            const sign     = (p.gainLoss||0) >= 0 ? '+' : '';
            const flashStr = (p.flashAdj||0) !== 0
                ? `<small style="color:var(--purple);"> (⚡ ${p.flashAdj > 0 ? '+' : ''}${fmt(p.flashAdj)})</small>`
                : '';
            return `<tr>
                <td>👤 ${escHtml(p.name)}</td>
                <td>${fmt(p.total)}</td>
                <td>${fmt(p.finalCash||0)}${flashStr}</td>
                <td>${fmt(p.finalValue||0)}</td>
                <td class="${cls}">${sign}${fmt(p.gainLoss||0)}</td>
            </tr>`;
        }).join('');

        const div       = document.createElement('div');
        div.className   = 'history-item';
        div.innerHTML   = `
            <div class="h-date">
                📅 ${new Date(game.date).toLocaleDateString('fr-FR', {
                    weekday:'long', day:'numeric', month:'long',
                    year:'numeric', hour:'2-digit', minute:'2-digit'
                })}
            </div>
            <div class="h-meta">
                <span>
                    💰 Pot : <strong>${fmt(totalPot)}</strong>
                    · Blinds : ${fmt(game.smallBlind)}/${fmt(game.bigBlind)}
                    · ⚡ Flash : <span style="color:var(--purple);">${fmt(game.flash||0)}</span>
                    · 🏆 ${escHtml(winner.name)}
                    (<span class="positive">+${fmt(winner.gainLoss||0)}</span>)
                </span>
                <button class="btn btn-red btn-sm" onclick="deleteGame(${game.id})">🗑️</button>
            </div>
            <div style="overflow-x:auto;">
                <table class="result-table">
                    <thead><tr>
                        <th>Joueur</th><th>Misé</th>
                        <th>Rendu (+flash)</th><th>Valeur finale</th><th>Gain/Perte</th>
                    </tr></thead>
                    <tbody>${rowsHtml}</tbody>
                </table>
            </div>
        `;
        el.appendChild(div);
    });
}

async function deleteGame(id) {
    if (!confirm('Supprimer cette partie ?')) return;
    await fetch(`${API}/games/${id}`, { method: 'DELETE' });
    showToast('🗑️ Supprimée', '#e74c3c');
    await renderHistory();
    await renderLeaderboard();
}

async function clearHistory() {
    if (!confirm('Effacer tout l\'historique ?')) return;
    await fetch(`${API}/games`, { method: 'DELETE' });
    showToast('🗑️ Historique effacé', '#e74c3c');
    await renderHistory();
    await renderLeaderboard();
}

// ============================================================
//  CLASSEMENT
// ============================================================
async function renderLeaderboard() {
    const res     = await fetch(`${API}/leaderboard`);
    const stats   = await res.json();
    const el      = document.getElementById('leaderboard-list');
    const summary = document.getElementById('all-games-summary');
    el.innerHTML  = '';

    if (stats.length === 0) {
        el.innerHTML      = `<div class="empty-state"><div class="icon">🏆</div><div>Aucune donnée.</div></div>`;
        summary.innerHTML = '';
        return;
    }

    const totalMoney = stats.reduce((s, p) => s + (p.totalInvested || 0), 0);
    const gamesRes   = await fetch(`${API}/games`);
    const games      = await gamesRes.json();

    summary.innerHTML = `
        <div class="card-title">📊 Statistiques Globales</div>
        <div style="display:grid; grid-template-columns:repeat(auto-fit,minmax(130px,1fr)); gap:10px;">
            <div style="background:rgba(26,122,74,0.15); border:1px solid var(--green);
                        border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:0.72rem; color:var(--green-light); text-transform:uppercase;">Parties</div>
                <div style="font-size:1.6rem; font-weight:900;">${games.length}</div>
            </div>
            <div style="background:rgba(241,196,15,0.1); border:1px solid var(--gold);
                        border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:0.72rem; color:var(--gold); text-transform:uppercase;">Argent joué</div>
                <div style="font-size:1.3rem; font-weight:900;">${fmt(totalMoney)}</div>
            </div>
            <div style="background:rgba(52,152,219,0.15); border:1px solid var(--blue);
                        border-radius:8px; padding:12px; text-align:center;">
                <div style="font-size:0.72rem; color:var(--blue); text-transform:uppercase;">Joueurs</div>
                <div style="font-size:1.6rem; font-weight:900;">${stats.length}</div>
            </div>
        </div>
    `;

    stats.forEach((s, i) => {
        const rank      = i + 1;
        const emoji     = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const cls       = s.totalGain > 0 ? 'positive' : s.totalGain < 0 ? 'negative' : 'neutral';
        const sign      = s.totalGain >= 0 ? '+' : '';
        const rankClass = rank <= 3 ? `rank-${rank}` : 'rank-other';

        const div       = document.createElement('div');
        div.className   = 'leaderboard-item';
        div.innerHTML   = `
            <div class="rank ${rankClass}">${emoji}</div>
            <div class="lb-name">👤 ${escHtml(s.name)}</div>
            <div class="lb-stats">
                <span>${s.games} partie(s) · ${s.wins} victoire(s)</span><br>
                <span>Investi : ${fmt(s.totalInvested)}</span>
                <span class="big ${cls}">${sign}${fmt(s.totalGain)}</span>
            </div>
        `;
        el.appendChild(div);
    });
}

// ============================================================
//  EXPORT CSV
// ============================================================
async function exportCSV() {
    const res   = await fetch(`${API}/games`);
    const games = await res.json();
    if (!games.length) return showToast('Aucune donnée !', '#e74c3c');

    const rows = [[
        'Date','Joueur','Misé (€)','Rendu (€)',
        'Flash attribué (€)','Valeur finale (€)','Gain/Perte (€)',
        'Petite blind (€)','Grosse blind (€)','Flash total (€)'
    ]];

    games.forEach(game => {
        const d = new Date(game.date).toLocaleDateString('fr-FR');
        game.players.forEach(p => {
            rows.push([
                d, p.name,
                (p.total||0).toFixed(2),      (p.finalCash||0).toFixed(2),
                (p.flashAdj||0).toFixed(2),   (p.finalValue||0).toFixed(2),
                (p.gainLoss||0).toFixed(2),   game.smallBlind.toFixed(2),
                game.bigBlind.toFixed(2),     (game.flash||0).toFixed(2)
            ]);
        });
    });

    downloadCSV(rows, 'poker_historique.csv');
    showToast('📥 CSV exporté !', '#3498db');
}

async function exportLeaderboardCSV() {
    const res   = await fetch(`${API}/leaderboard`);
    const stats = await res.json();
    if (!stats.length) return showToast('Aucune donnée !', '#e74c3c');

    const rows = [['Rang','Joueur','Parties','Victoires','Total investi (€)','Gain/Perte (€)']];
    stats.forEach((s, i) => {
        rows.push([i+1, s.name, s.games, s.wins,
            s.totalInvested.toFixed(2), s.totalGain.toFixed(2)]);
    });

    downloadCSV(rows, 'poker_classement.csv');
    showToast('📥 Classement exporté !', '#3498db');
}

function downloadCSV(rows, filename) {
    const bom  = '\uFEFF';
    const csv  = bom + rows.map(r =>
        r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(';')
    ).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
}

// ============================================================
//  UTILS
// ============================================================
function showTab(name) {
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + name).classList.add('active');
    const btns = document.querySelectorAll('.tab-btn');
    const map  = { players:0, game:1, live:2, history:3, leaderboard:4 };
    if (map[name] !== undefined) btns[map[name]].classList.add('active');
    if (name === 'live')        loadCurrentGame();
    if (name === 'history')     renderHistory();
    if (name === 'leaderboard') renderLeaderboard();
    if (name === 'game')        renderGameSetup();
}

function fmt(n) {
    return Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
}

function escHtml(s) {
    return String(s)
        .replace(/&/g,'&amp;').replace(/</g,'&lt;')
        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(msg, color = '#2ecc71') {
    const el       = document.getElementById('toast');
    el.textContent = msg;
    el.style.background = color;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 3000);
}
