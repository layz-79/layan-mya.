// =========================================================================
// 1. DONNÉES GLOBALES & CHIFFREMENT DE LA PHRASE SECRÈTE
// =========================================================================
const SECRET_SENTENCE = "Bravo ma chérie, je suis fière de toi. Sache que je t’aime de toute mon âme. Tu peux enfin accéder à la surprise finale, profite bien.";

function normalizeChar(ch) {
    return ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
}

function charToNumber(ch) {
    const norm = normalizeChar(ch);
    const code = norm.charCodeAt(0);
    if (code >= 65 && code <= 90) {
        return code - 64;
    }
    return null;
}

const cipherTokens = [];
let letterIndexCounter = 0;
for (let i = 0; i < SECRET_SENTENCE.length; i++) {
    const rawChar = SECRET_SENTENCE[i];
    const num = charToNumber(rawChar);
    if (num !== null) {
        cipherTokens.push({
            type: 'letter',
            letterIndex: letterIndexCounter,
            rawChar: rawChar,
            normChar: normalizeChar(rawChar),
            number: num
        });
        letterIndexCounter++;
    } else {
        cipherTokens.push({
            type: 'punct',
            rawChar: rawChar
        });
    }
}
const TOTAL_LETTERS = letterIndexCounter;

const GAMES_META = [
    { id: 1, title: "Mémo des Amoureux", icon: "🃏", desc: "12 cartes sur le thème de notre amour", range: [0, 13] },
    { id: 2, title: "La Devinette", icon: "💭", desc: "Devine ce que j'aime admirer chez toi", range: [13, 26] },
    { id: 3, title: "Mot Mystère", icon: "🟩", desc: "Trouve le mot secret de 5 lettres en 6 essais", range: [26, 39] },
    { id: 4, title: "Pluie de Cœurs", icon: "☁️", desc: "Attrape 16 cœurs et évite les bombes", range: [39, 52] },
    { id: 5, title: "Mots Mêlés", icon: "🔍", desc: "16 mots cachés dans tous les sens", range: [52, 65] },
    { id: 6, title: "Simon des Cœurs", icon: "💖", desc: "Mémorise les 10 séquences lumineuses", range: [65, 78] },
    { id: 7, title: "Mots Fléchés", icon: "✏️", desc: "7 mots croisés sur toi et nous", range: [78, 90] },
    { id: 8, title: "Parcours Mya → Layan", icon: "🎲", desc: "25 cases semées d'embûches et de questions", range: [90, 101] }
];

const STATE_KEY = "mya_layan_8mois_state_v2";
let appState = {
    completedGames: [],
    cipherInputs: {},
   
    
};

function loadState() {
    try {
        const raw = localStorage.getItem(STATE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            appState = { ...appState, ...parsed };
        }
    } catch (e) {}
}

function saveState() {
    try {
        localStorage.setItem(STATE_KEY, JSON.stringify(appState));
    } catch (e) {}
}

// =========================================================================
// 2. AUDIO ROMANTIQUE DOUX (WEB AUDIO API)
// =========================================================================
let audioCtx = null;
let isPlayingMusic = false;
let melodyTimer = null;

function startRomanticMusic() {
    if (isPlayingMusic) return;
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();

        isPlayingMusic = true;
        document.getElementById('music-icon').textContent = '🎶';

        const chords = [
            [261.63, 329.63, 392.00, 493.88],
            [220.00, 261.63, 329.63, 392.00],
            [174.61, 220.00, 261.63, 329.63],
            [196.00, 246.94, 293.66, 329.63]
        ];
        let step = 0;

        function playNextNote() {
            if (!isPlayingMusic || !audioCtx) return;
            const chord = chords[Math.floor(step / 4) % chords.length];
            const freq = chord[step % 4];

            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, audioCtx.currentTime);

            gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.045, audioCtx.currentTime + 0.15);
            gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1.4);

            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 1.45);

            step++;
        }

        playNextNote();
        melodyTimer = setInterval(playNextNote, 650);
    } catch (e) {
        console.warn("Audio non supporté", e);
    }
}

function stopRomanticMusic() {
    isPlayingMusic = false;
    if (melodyTimer) clearInterval(melodyTimer);
    document.getElementById('music-icon').textContent = '🔇';
}

function toggleAudio() {
    if (isPlayingMusic) {
        stopRomanticMusic();
        showToast("Musique en pause");
    } else {
        startRomanticMusic();
        showToast("Douce mélodie activée 🎶");
    }
}

function playTone(freq, duration = 0.25) {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!audioCtx) audioCtx = new AudioContext();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}

// =========================================================================
// 3. NAVIGATION ENTRE ÉCRANS & MOT DE PASSE
// =========================================================================
let activeGameCleanup = null;

function navigateTo(screenName, gameId = null) {
    if (activeGameCleanup) {
        activeGameCleanup();
        activeGameCleanup = null;
    }

    const screens = ['lock', 'spotify', 'intro', 'hub', 'cipher', 'game', 'final'];
    screens.forEach(s => {
        const el = document.getElementById('screen-' + s);
        if (el) el.classList.add('hidden');
    });

    const topbar = document.getElementById('global-topbar');
    const homeBtn = document.getElementById('home-btn');

    if (screenName === 'lock' || screenName === 'spotify') {
        topbar.classList.add('hidden');
    } else {
        topbar.classList.remove('hidden');
        if (screenName === 'hub' || screenName === 'intro') {
            homeBtn.classList.add('hidden');
        } else {
            homeBtn.classList.remove('hidden');
        }
    }

    document.getElementById('screen-' + screenName).classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (screenName === 'hub') {
        renderHub();
    } else if (screenName === 'cipher') {
        renderCipherScreen();
    } else if (screenName === 'game' && gameId) {
        launchGame(gameId);
    } else if (screenName === 'final') {
        launchPetals();
    }
}

function checkPassword(e) {
    e.preventDefault();
    const input = document.getElementById('password-input');
    const err = document.getElementById('password-error');
    const card = document.getElementById('lock-card');
    const val = input.value.trim().replace(/\s+/g, '');

    if (val === '16/03/26' || val === '160326' || val === '16/03/2026') {
        err.classList.add('hidden');
        navigateTo('spotify');
    } else {
        err.classList.remove('hidden');
        card.classList.remove('animate-shake');
        void card.offsetWidth;
        card.classList.add('animate-shake');
    }
}

function startExperienceFromSpotify() {
    startRomanticMusic();
    const bar = document.getElementById('spotify-bar');
    const timeEl = document.getElementById('spotify-time');
    bar.style.width = '100%';
    timeEl.textContent = '0:08';
    setTimeout(() => {
        navigateTo('intro');
    }, 900);
}

// =========================================================================
// 4. RENDU DU HUB
// =========================================================================
function isLetterUnlocked(letterIndex) {
    for (const gId of appState.completedGames) {
        const meta = GAMES_META.find(g => g.id === gId);
        if (meta && letterIndex >= meta.range[0] && letterIndex < meta.range[1]) {
            return true;
        }
    }
    return false;
}

function renderHub() {
    const doneCount = appState.completedGames.length;
    document.getElementById('topbar-progress').textContent = `${doneCount}/8 défis`;
    document.getElementById('hub-games-done').textContent = `${doneCount}/8`;
    document.getElementById('hub-total-letters').textContent = TOTAL_LETTERS;

    let unlockedLettersCount = 0;
    const previewContainer = document.getElementById('hub-numbers-preview');
    previewContainer.innerHTML = '';

    cipherTokens.forEach(tok => {
        if (tok.type === 'letter') {
            const unlocked = isLetterUnlocked(tok.letterIndex);
            if (unlocked) unlockedLettersCount++;
            const badge = document.createElement('span');
            badge.className = unlocked
                ? 'px-1.5 py-0.5 rounded bg-gold-400 text-bordeaux-900 font-bold'
                : 'px-1.5 py-0.5 rounded bg-white/10 text-white/40';
            badge.textContent = unlocked ? tok.number : '?';
            previewContainer.appendChild(badge);
        } else if (tok.rawChar === ' ') {
            const spacer = document.createElement('span');
            spacer.className = 'w-2';
            previewContainer.appendChild(spacer);
        }
    });

    document.getElementById('hub-unlocked-count').textContent = unlockedLettersCount;

    const grid = document.getElementById('games-grid');
    grid.innerHTML = '';
    GAMES_META.forEach(game => {
        const isDone = appState.completedGames.includes(game.id);
        const card = document.createElement('button');
        card.onclick = () => navigateTo('game', game.id);
        card.className = `text-left p-5 rounded-3xl border transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer flex flex-col justify-between ${
            isDone
                ? 'bg-gradient-to-br from-cream-50 to-poudre-100 border-gold-400 shadow-sm'
                : 'bg-cream-50/95 border-poudre-200 hover:border-bordeaux-600/40'
        }`;

        card.innerHTML = `
            <div>
                <div class="flex items-center justify-between mb-3">
                    <span class="w-12 h-12 rounded-2xl bg-poudre-100 flex items-center justify-center text-2xl shadow-2xs">${game.icon}</span>
                    <span class="px-2.5 py-1 rounded-full text-[11px] font-bold ${
                        isDone
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                            : 'bg-bordeaux-700/10 text-bordeaux-700'
                    }">
                        ${isDone ? 'Réussi ✓' : `Défi #${game.id}`}
                    </span>
                </div>
                <h3 class="font-serif font-bold text-lg text-bordeaux-800">${game.title}</h3>
                <p class="font-soft text-xs text-bordeaux-700/80 mt-1 leading-relaxed">${game.desc}</p>
            </div>
            <div class="mt-4 pt-3 border-t border-poudre-200/60 flex items-center justify-between text-xs font-semibold text-bordeaux-700">
                <span>${game.range[1] - game.range[0]} numéros à gagner</span>
                <span>Jouer →</span>
            </div>
        `;
        grid.appendChild(card);
    });

    renderPlaylist();
    renderMemories();
}

function renderPlaylist() {
    const list = document.getElementById('playlist-list');
    list.innerHTML = '';
    appState.playlist.forEach((song, idx) => {
        const row = document.createElement('div');
        row.className = 'flex items-center justify-between p-3 rounded-2xl bg-poudre-100/50 border border-poudre-200/70 hover:bg-poudre-100 transition-colors';
        row.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <span class="w-7 h-7 rounded-full bg-bordeaux-700 text-white text-xs font-bold flex items-center justify-center shrink-0">${idx + 1}</span>
                <div class="truncate">
                    <p class="font-semibold text-sm text-bordeaux-900 truncate">${escapeHTML(song.title)}</p>
                    <p class="text-xs text-bordeaux-700/75 truncate">${escapeHTML(song.artist)} ${song.note ? '• ' + escapeHTML(song.note) : ''}</p>
                </div>
            </div>
            <button onclick="removeSong(${song.id})" class="text-bordeaux-700/40 hover:text-red-600 text-xs px-2 cursor-pointer" title="Retirer">✕</button>
        `;
        list.appendChild(row);
    });
}

function openPlaylistModal() {
    document.getElementById('playlist-modal').classList.remove('hidden');
    document.getElementById('playlist-modal').classList.add('flex');
}
function closePlaylistModal() {
    document.getElementById('playlist-modal').classList.add('hidden');
    document.getElementById('playlist-modal').classList.remove('flex');
}
function addSongToPlaylist(e) {
    e.preventDefault();
    const title = document.getElementById('song-title').value.trim();
    const artist = document.getElementById('song-artist').value.trim();
    const note = document.getElementById('song-note').value.trim();
    if (!title || !artist) return;
    appState.playlist.push({ id: Date.now(), title, artist, note });
    saveState();
    renderPlaylist();
    e.target.reset();
    closePlaylistModal();
    showToast("Son ajouté à la playlist 🎧");
}
function removeSong(id) {
    appState.playlist = appState.playlist.filter(s => s.id !== id);
    saveState();
    renderPlaylist();
}

function renderMemories() {
    const box = document.getElementById('memories-chat');
    box.innerHTML = '';
    appState.memories.forEach((m, index) => {
        const card = document.createElement('div');
        card.className = 'bg-white rounded-3xl p-4 border border-poudre-200 shadow-sm space-y-3 group relative';

        const headerBar = `
            <div class="flex items-center justify-between px-1">
                <span class="text-xs font-bold uppercase tracking-wider text-bordeaux-700">Souvenir Snapchat #${index + 1}</span>
                <button onclick="removeMemory(${m.id})" class="text-xs text-bordeaux-700/40 hover:text-red-600 cursor-pointer" title="Supprimer">✕</button>
            </div>
        `;

        const visualContent = `
            <div class="rounded-2xl overflow-hidden border border-poudre-200 bg-neutral-950 flex items-center justify-center p-2">
                <img src="${m.imageUrl}" alt="Capture Snapchat ${index + 1}" class="w-full max-h-[500px] object-contain rounded-xl mx-auto shadow-md" onerror="this.src='https://placehold.co/400x700/222/fff?text=Capture+Snapchat'">
            </div>
        `;

        const noteFooter = m.note ? `
            <div class="px-4 py-3 rounded-2xl bg-poudre-100/80 border border-poudre-200 text-sm text-bordeaux-900 font-soft italic flex items-center gap-2">
                <span class="text-lg">💌</span>
                <span>${escapeHTML(m.note)}</span>
            </div>
        ` : '';

        card.innerHTML = headerBar + visualContent + noteFooter;
        box.appendChild(card);
    });
    document.getElementById('memories-count-label').textContent = `${appState.memories.length} souvenirs affichés`;
}

function openMemoryModal() {
    document.getElementById('memory-modal').classList.remove('hidden');
    document.getElementById('memory-modal').classList.add('flex');
}
function closeMemoryModal() {
    document.getElementById('memory-modal').classList.add('hidden');
    document.getElementById('memory-modal').classList.remove('flex');
}
function addMemoryItem(e) {
    e.preventDefault();
    const note = document.getElementById('mem-note').value.trim();
    const fileInput = document.getElementById('mem-image-file');

    if (fileInput.files && fileInput.files[0]) {
        const reader = new FileReader();
        reader.onload = (evt) => {
            appState.memories.push({ id: Date.now(), note, imageUrl: evt.target.result });
            saveState();
            renderMemories();
            e.target.reset();
            closeMemoryModal();
            showToast("Souvenir ajouté 📸❤️");
        };
        reader.readAsDataURL(fileInput.files[0]);
    } else {
        showToast("Veuillez sélectionner une image de capture d'écran");
    }
}
function removeMemory(id) {
    appState.memories = appState.memories.filter(m => m.id !== id);
    saveState();
    renderMemories();
}

// =========================================================================
// 5. VICTOIRE D'UN MINI-JEU & ATTRIBUTION DES NUMÉROS
// =========================================================================
function completeGame(gameId) {
    const meta = GAMES_META.find(g => g.id === gameId);
    if (!meta) return;

    if (!appState.completedGames.includes(gameId)) {
        appState.completedGames.push(gameId);
        saveState();
    }

    playTone(523.25, 0.2);
    setTimeout(() => playTone(659.25, 0.2), 150);
    setTimeout(() => playTone(783.99, 0.35), 300);

    const nums = [];
    for (let idx = meta.range[0]; idx < meta.range[1]; idx++) {
        const tok = cipherTokens.find(t => t.type === 'letter' && t.letterIndex === idx);
        if (tok) nums.push(tok.number);
    }

    const numContainer = document.getElementById('win-modal-numbers');
    numContainer.innerHTML = nums.map(n => `<span class="px-2.5 py-1 rounded-lg bg-white border border-gold-400 shadow-2xs">${n}</span>`).join('');

    const modal = document.getElementById('win-modal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeWinModal() {
    const modal = document.getElementById('win-modal');
    modal.classList.add('hidden');
    modal.classList.remove('flex');
    navigateTo('hub');
}

// =========================================================================
// 6. ÉCRAN DU CADENAS CŒUR
// =========================================================================
function renderCipherScreen() {
    const guide = document.getElementById('cipher-guide');
    guide.innerHTML = '';
    for (let n = 1; n <= 26; n++) {
        const letter = String.fromCharCode(64 + n);
        const cell = document.createElement('div');
        cell.className = 'bg-white rounded-lg py-1 px-1 border border-poudre-200 shadow-2xs';
        cell.innerHTML = `<span class="font-bold text-bordeaux-800">${n}</span>=<span class="text-gold-600 font-bold">${letter}</span>`;
        guide.appendChild(cell);
    }

    const container = document.getElementById('cipher-words-container');
    container.innerHTML = '';

    let currentWordDiv = document.createElement('div');
    currentWordDiv.className = 'flex items-end gap-1';

    cipherTokens.forEach(tok => {
        if (tok.type === 'punct' && tok.rawChar === ' ') {
            container.appendChild(currentWordDiv);
            currentWordDiv = document.createElement('div');
            currentWordDiv.className = 'flex items-end gap-1';
        } else if (tok.type === 'punct') {
            const pSpan = document.createElement('span');
            pSpan.className = 'font-serif font-bold text-xl text-bordeaux-800 pb-1 px-0.5';
            pSpan.textContent = tok.rawChar;
            currentWordDiv.appendChild(pSpan);
        } else {
            const unlocked = isLetterUnlocked(tok.letterIndex);
            const savedVal = appState.cipherInputs[tok.letterIndex] || '';
            const isCorrect = savedVal.toUpperCase() === tok.normChar;

            const unit = document.createElement('div');
            unit.className = 'flex flex-col items-center';

            const numTag = document.createElement('span');
            numTag.className = `text-[11px] font-mono font-bold px-1.5 py-0.5 rounded mb-1 ${
                unlocked ? 'bg-gold-300/70 text-bordeaux-900' : 'bg-stone-200 text-stone-400'
            }`;
            numTag.textContent = unlocked ? tok.number : '?';

            const inp = document.createElement('input');
            inp.type = 'text';
            inp.maxLength = 1;
            inp.disabled = !unlocked;
            inp.value = savedVal;
            inp.dataset.lidx = tok.letterIndex;
            inp.className = `w-7 h-8 sm:w-8 sm:h-9 text-center font-bold uppercase rounded-lg border text-sm transition-all focus:outline-none ${
                !unlocked
                    ? 'bg-stone-100 border-stone-200 text-stone-300 cursor-not-allowed'
                    : isCorrect
                        ? 'bg-emerald-100 border-emerald-500 text-emerald-900'
                        : 'bg-cream-50 border-poudre-300 text-bordeaux-900 focus:border-bordeaux-600'
            }`;

            inp.addEventListener('input', (e) => {
                const val = normalizeChar(e.target.value).slice(0, 1);
                e.target.value = val;
                appState.cipherInputs[tok.letterIndex] = val;
                saveState();

                if (val === tok.normChar) {
                    e.target.classList.remove('border-poudre-300', 'bg-cream-50');
                    e.target.classList.add('bg-emerald-100', 'border-emerald-500', 'text-emerald-900');
                } else {
                    e.target.classList.remove('bg-emerald-100', 'border-emerald-500', 'text-emerald-900');
                    e.target.classList.add('bg-cream-50', 'border-poudre-300');
                }

                if (val) {
                    const allInputs = Array.from(container.querySelectorAll('input:not([disabled])'));
                    const pos = allInputs.indexOf(e.target);
                    if (pos >= 0 && pos < allInputs.length - 1) {
                        allInputs[pos + 1].focus();
                    }
                }
                checkCipherCompletionSilent();
            });

            unit.appendChild(numTag);
            unit.appendChild(inp);
            currentWordDiv.appendChild(unit);
        }
    });
    container.appendChild(currentWordDiv);
    checkCipherCompletionSilent();
}

function checkCipherCompletionSilent() {
    const letterTokens = cipherTokens.filter(t => t.type === 'letter');
    const allSolved = letterTokens.every(t => (appState.cipherInputs[t.letterIndex] || '').toUpperCase() === t.normChar);
    const banner = document.getElementById('final-unlock-banner');
    if (allSolved) {
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
    return allSolved;
}

function checkCipherProgress() {
    const letterTokens = cipherTokens.filter(t => t.type === 'letter');
    let correctCount = 0;
    letterTokens.forEach(t => {
        if ((appState.cipherInputs[t.letterIndex] || '').toUpperCase() === t.normChar) {
            correctCount++;
        }
    });
    if (checkCipherCompletionSilent()) {
        showToast("Félicitations mon amour ! La surprise finale est ouverte ❤️");
    } else {
        showToast(`${correctCount} / ${TOTAL_LETTERS} lettres correctement déchiffrées !`);
    }
}

function fillUnlockedHint() {
    const letterTokens = cipherTokens.filter(t => t.type === 'letter' && isLetterUnlocked(t.letterIndex));
    const unsolved = letterTokens.find(t => (appState.cipherInputs[t.letterIndex] || '').toUpperCase() !== t.normChar);
    if (!unsolved) {
        showToast("Toutes tes lettres débloquées sont déjà remplies !");
        return;
    }
    appState.cipherInputs[unsolved.letterIndex] = unsolved.normChar;
    saveState();
    renderCipherScreen();
}

// =========================================================================
// 7. LES 8 MINI-JEUX INTERACTIFS
// =========================================================================
function launchGame(gameId) {
    const wrapper = document.getElementById('game-wrapper');
    wrapper.innerHTML = '';

    switch (gameId) {
        case 1: initMemoryGame(wrapper); break;
        case 2: initRiddleGame(wrapper); break;
        case 3: initWordleGame(wrapper); break;
        case 4: initCatchHeartsGame(wrapper); break;
        case 5: initWordSearchGame(wrapper); break;
        case 6: initSimonGame(wrapper); break;
        case 7: initCrosswordGame(wrapper); break;
        case 8: initMazeBoardGame(wrapper); break;
    }
}

// MINI-JEU 1 : MÉMO
function initMemoryGame(container) {
    const pairs = [
        { id: 'heart', emoji: '❤️', label: 'Cœur' },
        { id: 'kiss', emoji: '💋', label: 'Bisous' },
        { id: 'hug', emoji: '🤗', label: 'Câlin' },
        { id: 'laugh', emoji: '😂', label: 'Fous rires' },
        { id: 'letter', emoji: '💌', label: 'Mots doux' },
        { id: 'sparkle', emoji: '✨', label: 'Magie' }
    ];
    let cards = [...pairs, ...pairs]
        .map((item, idx) => ({ ...item, uid: idx }))
        .sort(() => Math.random() - 0.5);

    let flipped = [];
    let matched = [];
    let lockBoard = false;

    container.innerHTML = `
        <div class="text-center mb-6">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 1 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800">Mémo des Amoureux</h2>
            <p class="text-sm text-bordeaux-700/80 mt-1">Retrouve les 6 paires de notre relation pour débloquer tes premiers numéros !</p>
        </div>
        <div id="memo-grid" class="grid grid-cols-3 sm:grid-cols-4 gap-3 sm:gap-4 max-w-lg mx-auto"></div>
    `;

    const grid = document.getElementById('memo-grid');

    function renderCards() {
        grid.innerHTML = '';
        cards.forEach((card, index) => {
            const isFlipped = flipped.includes(index) || matched.includes(card.id);
            const btn = document.createElement('button');
            btn.className = `aspect-square rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-sm ${
                isFlipped
                    ? 'bg-white border-gold-400 scale-100'
                    : 'bg-gradient-to-br from-bordeaux-700 to-poudre-500 border-bordeaux-800 text-white hover:scale-105'
            }`;

            if (isFlipped) {
                btn.innerHTML = `<span class="text-3xl sm:text-4xl mb-1">${card.emoji}</span><span class="text-[11px] font-semibold text-bordeaux-800">${card.label}</span>`;
            } else {
                btn.innerHTML = `<span class="text-2xl opacity-80">♥</span>`;
            }

            btn.onclick = () => {
                if (lockBoard || isFlipped) return;
                playTone(440, 0.12);
                flipped.push(index);
                renderCards();

                if (flipped.length === 2) {
                    lockBoard = true;
                    const [i1, i2] = flipped;
                    if (cards[i1].id === cards[i2].id) {
                        matched.push(cards[i1].id);
                        flipped = [];
                        lockBoard = false;
                        renderCards();
                        if (matched.length === pairs.length) {
                            setTimeout(() => completeGame(1), 500);
                        }
                    } else {
                        setTimeout(() => {
                            flipped = [];
                            lockBoard = false;
                            renderCards();
                        }, 800);
                    }
                }
            };
            grid.appendChild(btn);
        });
    }
    renderCards();
}

// MINI-JEU 2 : DEVINETTE
function initRiddleGame(container) {
    container.innerHTML = `
        <div class="max-w-xl mx-auto text-center py-4">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 2 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800 mb-6">La Devinette</h2>

            <div class="bg-poudre-100/80 border border-poudre-300 rounded-3xl p-6 sm:p-8 mb-6 relative">
                <p class="font-serif italic text-xl sm:text-2xl text-bordeaux-900 leading-relaxed">
                    « Tu peux me faire perdre mes mots sans même parler. Et je pourrais passer des heures à regarder ça. »
                </p>

                <button id="riddle-hint-btn" class="mt-4 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-white text-gold-600 border border-gold-300 text-xs font-semibold hover:bg-gold-300/20 transition-colors cursor-pointer">
                    <span>💡</span>
                    <span>Besoin d'un indice ?</span>
                </button>
                <p id="riddle-hint-text" class="hidden mt-3 text-sm font-medium text-bordeaux-700 bg-white/80 px-4 py-2 rounded-xl">
                    Indice : « Une des choses que je préfère le plus chez toi »
                </p>
            </div>

            <form id="riddle-form" class="space-y-4">
                <input type="text" id="riddle-input" placeholder="Écris ta réponse ici..." autocomplete="off"
                    class="w-full text-center py-3.5 px-4 rounded-2xl border-2 border-poudre-300 bg-white text-bordeaux-900 font-semibold focus:outline-none focus:border-bordeaux-600">
                <p id="riddle-feedback" class="text-xs text-red-600 hidden font-medium">Ce n'est pas tout à fait ça mon amour, réessaie ❤️</p>
                <button type="submit" class="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-bordeaux-700 to-poudre-500 text-white font-semibold shadow-md hover:opacity-95 cursor-pointer">
                    Valider ma réponse ✨
                </button>
            </form>
        </div>
    `;

    document.getElementById('riddle-hint-btn').onclick = () => {
        document.getElementById('riddle-hint-text').classList.remove('hidden');
    };

    document.getElementById('riddle-form').onsubmit = (e) => {
        e.preventDefault();
        const ans = normalizeChar(document.getElementById('riddle-input').value).trim();
        if (ans === 'TES YEUX' || ans === 'YEUX' || ans === 'MES YEUX') {
            completeGame(2);
        } else {
            document.getElementById('riddle-feedback').classList.remove('hidden');
        }
    };
}

// MINI-JEU 3 : MOT MYSTÈRE
function initWordleGame(container) {
    const targetWord = "LOVEU";
    const maxRows = 6;
    let currentRow = 0;
    let currentGuess = "";
    let board = Array.from({ length: maxRows }, () => Array(5).fill(""));
    let statuses = Array.from({ length: maxRows }, () => Array(5).fill(""));
    let gameOver = false;

    container.innerHTML = `
        <div class="max-w-md mx-auto text-center">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 3 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800">Le Mot Secret</h2>
            <p class="text-xs sm:text-sm text-bordeaux-700/80 mt-1 mb-5">
                Devine le mot caché de 5 lettres en 6 essais (Vert = bien placé, Jaune = mal placé).
            </p>

            <div id="wordle-grid" class="grid grid-rows-6 gap-2 max-w-[270px] mx-auto mb-6"></div>
            <div id="wordle-keyboard" class="space-y-1.5 select-none"></div>
            <div class="mt-4">
                <button id="wordle-reset-btn" class="hidden px-4 py-2 rounded-xl bg-poudre-200 text-bordeaux-800 text-xs font-semibold cursor-pointer">Réessayer une grille</button>
            </div>
        </div>
    `;

    const gridEl = document.getElementById('wordle-grid');
    const kbEl = document.getElementById('wordle-keyboard');

    function renderBoard() {
        gridEl.innerHTML = '';
        for (let r = 0; r < maxRows; r++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'grid grid-cols-5 gap-2';
            for (let c = 0; c < 5; c++) {
                const letter = r === currentRow ? (currentGuess[c] || "") : board[r][c];
                const st = statuses[r][c];
                const cell = document.createElement('div');
                let cls = 'aspect-square rounded-xl border-2 flex items-center justify-center font-bold text-xl uppercase transition-all ';
                if (st === 'green') cls += 'bg-emerald-500 border-emerald-600 text-white';
                else if (st === 'yellow') cls += 'bg-amber-400 border-amber-500 text-white';
                else if (st === 'gray') cls += 'bg-stone-300 border-stone-400 text-stone-700';
                else cls += letter ? 'bg-white border-bordeaux-600 text-bordeaux-900' : 'bg-white/70 border-poudre-300';

                cell.className = cls;
                cell.textContent = letter;
                rowDiv.appendChild(cell);
            }
            gridEl.appendChild(rowDiv);
        }
    }

    const kbRows = [
        ["A","Z","E","R","T","Y","U","I","O","P"],
        ["Q","S","D","F","G","H","J","K","L","M"],
        ["ENTRER","W","X","C","V","B","N","⌫"]
    ];

    function renderKeyboard() {
        kbEl.innerHTML = '';
        kbRows.forEach(row => {
            const rDiv = document.createElement('div');
            rDiv.className = 'flex justify-center gap-1';
            row.forEach(key => {
                const btn = document.createElement('button');
                const isSpecial = key.length > 1;
                btn.className = `${isSpecial ? 'px-2.5 text-[11px]' : 'w-8 sm:w-9 text-xs'} h-10 rounded-lg font-bold bg-poudre-100 hover:bg-poudre-200 text-bordeaux-900 border border-poudre-300 active:scale-95 transition-all cursor-pointer`;
                btn.textContent = key;
                btn.onclick = () => handleKey(key);
                rDiv.appendChild(btn);
            });
            kbEl.appendChild(rDiv);
        });
    }

    function handleKey(key) {
        if (gameOver) return;
        if (key === '⌫' || key === 'BACKSPACE') {
            currentGuess = currentGuess.slice(0, -1);
            renderBoard();
        } else if (key === 'ENTRER' || key === 'ENTER') {
            if (currentGuess.length < 5) {
                showToast("Il faut 5 lettres !");
                return;
            }
            submitGuess();
        } else if (/^[A-Z]$/.test(key) && currentGuess.length < 5) {
            currentGuess += key;
            renderBoard();
        }
    }

    function submitGuess() {
        const guessArr = currentGuess.split('');
        const targetArr = targetWord.split('');
        const rowStatus = Array(5).fill('gray');
        const usedTarget = Array(5).fill(false);

        for (let i = 0; i < 5; i++) {
            if (guessArr[i] === targetArr[i]) {
                rowStatus[i] = 'green';
                usedTarget[i] = true;
            }
        }
        for (let i = 0; i < 5; i++) {
            if (rowStatus[i] === 'green') continue;
            const foundIdx = targetArr.findIndex((ch, idx) => !usedTarget[idx] && ch === guessArr[i]);
            if (foundIdx !== -1) {
                rowStatus[i] = 'yellow';
                usedTarget[foundIdx] = true;
            }
        }

        board[currentRow] = guessArr;
        statuses[currentRow] = rowStatus;
        const won = currentGuess === targetWord;
        currentRow++;
        currentGuess = "";
        renderBoard();

        if (won) {
            gameOver = true;
            setTimeout(() => completeGame(3), 500);
        } else if (currentRow >= maxRows) {
            gameOver = true;
            showToast("Presque ! Réessaie une nouvelle grille ❤️");
            document.getElementById('wordle-reset-btn').classList.remove('hidden');
        }
    }

    document.getElementById('wordle-reset-btn').onclick = () => initWordleGame(container);

    const keyListener = (e) => {
        if (document.getElementById('screen-game').classList.contains('hidden')) return;
        const k = e.key.toUpperCase();
        if (k === 'BACKSPACE' || k === 'ENTER' || /^[A-Z]$/.test(k)) {
            handleKey(k);
        }
    };
    window.addEventListener('keydown', keyListener);
    activeGameCleanup = () => window.removeEventListener('keydown', keyListener);

    renderBoard();
    renderKeyboard();
}

// MINI-JEU 4 : PLUIE DE CŒURS
function initCatchHeartsGame(container) {
    container.innerHTML = `
        <div class="max-w-lg mx-auto text-center">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 4 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800">Pluie de Cœurs</h2>
            <p class="text-xs sm:text-sm text-bordeaux-700/80 mt-1 mb-3">
                Attrape <strong>16 cœurs</strong> qui tombent des nuages et évite les bombes 💣 !
            </p>

            <div class="flex items-center justify-between px-4 py-2 rounded-2xl bg-poudre-100 border border-poudre-300 mb-3 font-bold text-sm text-bordeaux-800">
                <span>Cœurs attrapés : <span id="catch-score" class="text-red-600 text-lg">0</span> / 16</span>
                <span class="text-xs font-normal">Glisse ton doigt ou ta souris</span>
            </div>

            <div id="catch-arena" class="relative w-full h-[380px] rounded-3xl overflow-hidden bg-gradient-to-b from-sky-100 via-poudre-100 to-cream-50 border-2 border-poudre-300 shadow-inner touch-none select-none">
                <div class="absolute top-1 left-2 text-5xl opacity-90 pointer-events-none">☁️</div>
                <div class="absolute top-0 left-1/3 text-6xl opacity-95 pointer-events-none">☁️</div>
                <div class="absolute top-1 right-3 text-5xl opacity-90 pointer-events-none">☁️</div>

                <div id="catch-basket" class="absolute bottom-3 left-1/2 -translate-x-1/2 w-16 h-12 rounded-2xl bg-bordeaux-700 text-white flex items-center justify-center text-2xl shadow-lg border-2 border-gold-300">
                    🧺
                </div>
            </div>
        </div>
    `;

    const arena = document.getElementById('catch-arena');
    const basket = document.getElementById('catch-basket');
    const scoreEl = document.getElementById('catch-score');

    let score = 0;
    let basketX = arena.clientWidth / 2;
    let items = [];
    let running = true;
    let spawnTimer = null;
    let animId = null;

    function moveBasket(clientX) {
        const rect = arena.getBoundingClientRect();
        let x = clientX - rect.left;
        x = Math.max(32, Math.min(rect.width - 32, x));
        basketX = x;
        basket.style.left = `${basketX}px`;
    }

    arena.addEventListener('mousemove', (e) => moveBasket(e.clientX));
    arena.addEventListener('touchmove', (e) => {
        if (e.touches[0]) moveBasket(e.touches[0].clientX);
    }, { passive: true });

    function spawnItem() {
        if (!running) return;
        const isBomb = Math.random() < 0.26;
        const el = document.createElement('div');
        el.className = 'absolute text-2xl sm:text-3xl pointer-events-none';
        el.textContent = isBomb ? '💣' : (Math.random() > 0.5 ? '❤️' : '💖');
        const x = Math.random() * (arena.clientWidth - 40) + 20;
        const y = 38;
        el.style.left = `${x}px`;
        el.style.top = `${y}px`;
        arena.appendChild(el);
        items.push({ el, x, y, speed: 2.3 + Math.random() * 1.6, isBomb });
    }

    function loop() {
        if (!running) return;
        const arenaH = arena.clientHeight;
        for (let i = items.length - 1; i >= 0; i--) {
            const it = items[i];
            it.y += it.speed;
            it.el.style.top = `${it.y}px`;

            if (it.y >= arenaH - 60 && it.y <= arenaH - 15 && Math.abs(it.x - basketX) < 38) {
                it.el.remove();
                items.splice(i, 1);
                if (it.isBomb) {
                    score = Math.max(0, score - 2);
                    playTone(160, 0.25);
                    showToast("Oups une bombe ! -2 cœurs 💣");
                } else {
                    score++;
                    playTone(580, 0.12);
                    if (score >= 16) {
                        scoreEl.textContent = "16";
                        running = false;
                        clearInterval(spawnTimer);
                        setTimeout(() => completeGame(4), 350);
                        return;
                    }
                }
                scoreEl.textContent = score;
                continue;
            }

            if (it.y > arenaH) {
                it.el.remove();
                items.splice(i, 1);
            }
        }
        animId = requestAnimationFrame(loop);
    }

    spawnTimer = setInterval(spawnItem, 700);
    animId = requestAnimationFrame(loop);

    activeGameCleanup = () => {
        running = false;
        clearInterval(spawnTimer);
        cancelAnimationFrame(animId);
    };
}

// MINI-JEU 5 : MOTS MÊLÉS
function initWordSearchGame(container) {
    const words = [
        "NYX", "MARS", "RAIPONCE", "CHERIE",
        "LIVRE", "NUGGETS", "POMPOM", "LYS",
        "DRAGIBUS", "VAIA", "CLOCHARDE", "OASIS",
        "KROKMOU", "DANSE", "ROSE", "SIXSEVEN"
    ];
    const size = 15;
    const grid = Array.from({ length: size }, () => Array(size).fill(''));
    const directions = [
        [0, 1], [0, -1], [1, 0], [-1, 0],
        [1, 1], [-1, -1], [1, -1], [-1, 1]
    ];

    function generateGrid() {
        for (let r = 0; r < size; r++) grid[r].fill('');
        const sorted = [...words].sort((a, b) => b.length - a.length);
        for (const w of sorted) {
            let placed = false;
            for (let attempt = 0; attempt < 300 && !placed; attempt++) {
                const [dr, dc] = directions[Math.floor(Math.random() * directions.length)];
                const r0 = Math.floor(Math.random() * size);
                const c0 = Math.floor(Math.random() * size);
                const rEnd = r0 + dr * (w.length - 1);
                const cEnd = c0 + dc * (w.length - 1);
                if (rEnd < 0 || rEnd >= size || cEnd < 0 || cEnd >= size) continue;

                let ok = true;
                for (let i = 0; i < w.length; i++) {
                    const cell = grid[r0 + dr * i][c0 + dc * i];
                    if (cell !== '' && cell !== w[i]) { ok = false; break; }
                }
                if (ok) {
                    for (let i = 0; i < w.length; i++) {
                        grid[r0 + dr * i][c0 + dc * i] = w[i];
                    }
                    placed = true;
                }
            }
            if (!placed) return false;
        }
        const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                if (grid[r][c] === '') {
                    grid[r][c] = alphabet[Math.floor(Math.random() * alphabet.length)];
                }
            }
        }
        return true;
    }

    while (!generateGrid()) {}

    let foundWords = new Set();
    let foundCells = new Set();
    let startCell = null;

    container.innerHTML = `
        <div class="text-center">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 5 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800">Mots Mêlés Difficile</h2>
            <p class="text-xs sm:text-sm text-bordeaux-700/80 mt-1 mb-4">
                Clique sur la <strong>première lettre</strong> puis sur la <strong>dernière lettre</strong> d'un mot.
            </p>

            <div class="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
                <div id="ws-grid" class="grid gap-0.5 sm:gap-1 bg-poudre-200 p-2 rounded-2xl border border-poudre-300 no-select" style="grid-template-columns: repeat(${size}, minmax(0, 1fr));"></div>

                <div class="w-full lg:w-60 bg-white rounded-2xl p-4 border border-poudre-200 text-left">
                    <p class="text-xs font-bold uppercase tracking-wider text-bordeaux-700 mb-2">
                        Mots trouvés : <span id="ws-count">0</span> / 16
                    </p>
                    <div id="ws-word-list" class="grid grid-cols-2 gap-1.5 text-xs font-semibold"></div>
                </div>
            </div>
        </div>
    `;

    const gridEl = document.getElementById('ws-grid');
    const listEl = document.getElementById('ws-word-list');

    function renderWordList() {
        document.getElementById('ws-count').textContent = foundWords.size;
        listEl.innerHTML = words.map(w => {
            const isFound = foundWords.has(w);
            return `<span class="px-2 py-1 rounded-lg ${isFound ? 'bg-emerald-100 text-emerald-800 line-through' : 'bg-poudre-100/70 text-bordeaux-900'}">${w}</span>`;
        }).join('');
    }

    function renderGrid() {
        gridEl.innerHTML = '';
        for (let r = 0; r < size; r++) {
            for (let c = 0; c < size; c++) {
                const key = `${r},${c}`;
                const isStart = startCell && startCell.r === r && startCell.c === c;
                const isFound = foundCells.has(key);
                const btn = document.createElement('button');
                btn.className = `w-5 h-5 sm:w-7 sm:h-7 text-[11px] sm:text-xs font-bold rounded flex items-center justify-center transition-colors cursor-pointer ${
                    isStart
                        ? 'bg-bordeaux-700 text-white scale-110'
                        : isFound
                            ? 'bg-emerald-400 text-white'
                            : 'bg-cream-50 hover:bg-poudre-100 text-bordeaux-900'
                }`;
                btn.textContent = grid[r][c];
                btn.onclick = () => handleCellClick(r, c);
                gridEl.appendChild(btn);
            }
        }
    }

    function handleCellClick(r, c) {
        if (!startCell) {
            startCell = { r, c };
            renderGrid();
            return;
        }

        const dr = Math.sign(r - startCell.r);
        const dc = Math.sign(c - startCell.c);
        const diffR = Math.abs(r - startCell.r);
        const diffC = Math.abs(c - startCell.c);

        if ((diffR === 0 || diffC === 0 || diffR === diffC) && (diffR > 0 || diffC > 0)) {
            const steps = Math.max(diffR, diffC);
            let built = "";
            const coords = [];
            for (let i = 0; i <= steps; i++) {
                const nr = startCell.r + dr * i;
                const nc = startCell.c + dc * i;
                built += grid[nr][nc];
                coords.push(`${nr},${nc}`);
            }
            const reversed = built.split('').reverse().join('');
            const matchedWord = words.find(w => !foundWords.has(w) && (w === built || w === reversed));

            if (matchedWord) {
                foundWords.add(matchedWord);
                coords.forEach(k => foundCells.add(k));
                playTone(620, 0.15);
                showToast(`Mot trouvé : ${matchedWord} ✨`);
                if (foundWords.size === words.length) {
                    setTimeout(() => completeGame(5), 500);
                }
            }
        }
        startCell = null;
        renderWordList();
        renderGrid();
    }

    renderWordList();
    renderGrid();
}

// MINI-JEU 6 : SIMON
function initSimonGame(container) {
    const totalSteps = 10;
    const pads = [
        { id: 0, name: 'Rouge', color: 'text-red-500', active: 'scale-115 drop-shadow-[0_0_25px_rgba(239,68,68,0.95)] brightness-125', freq: 329.63 },
        { id: 1, name: 'Rose', color: 'text-pink-400', active: 'scale-115 drop-shadow-[0_0_25px_rgba(244,114,182,0.95)] brightness-125', freq: 392.00 },
        { id: 2, name: 'Bleu', color: 'text-sky-500', active: 'scale-115 drop-shadow-[0_0_25px_rgba(14,165,233,0.95)] brightness-125', freq: 440.00 },
        { id: 3, name: 'Doré', color: 'text-amber-400', active: 'scale-115 drop-shadow-[0_0_25px_rgba(251,191,36,0.95)] brightness-125', freq: 523.25 }
    ];

    let sequence = [];
    let userStep = 0;
    let isPlayback = false;
    let active = true;

    container.innerHTML = `
        <div class="max-w-md mx-auto text-center py-2">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 6 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800">Simon des Cœurs</h2>
            <p class="text-xs sm:text-sm text-bordeaux-700/80 mt-1 mb-4">
                Observe les cœurs clignoter et reproduis la séquence pendant <strong>10 étapes</strong> !
            </p>

            <div class="inline-block px-4 py-1.5 rounded-full bg-poudre-100 border border-poudre-300 text-sm font-bold text-bordeaux-800 mb-6">
                Étape : <span id="simon-step">0</span> / ${totalSteps}
            </div>

            <div class="grid grid-cols-2 gap-6 max-w-xs mx-auto my-4">
                ${pads.map(p => `
                    <button id="simon-pad-${p.id}" class="aspect-square rounded-3xl bg-white border-2 border-poudre-200 shadow-md flex items-center justify-center transition-all duration-150 cursor-pointer">
                        <svg class="w-20 h-20 ${p.color} transition-all duration-150" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                        </svg>
                    </button>
                `).join('')}
            </div>

            <p id="simon-status" class="text-sm font-semibold text-bordeaux-700 mt-4">Appuie sur Démarrer pour commencer ✨</p>
            <button id="simon-start-btn" class="mt-4 px-7 py-3 rounded-2xl bg-gradient-to-r from-bordeaux-700 to-poudre-500 text-white font-semibold shadow-md cursor-pointer">
                Démarrer les 10 étapes 💖
            </button>
        </div>
    `;

    function flashPad(id, duration = 380) {
        const btn = document.getElementById(`simon-pad-${id}`);
        if (!btn) return;
        const svg = btn.querySelector('svg');
        const classes = pads[id].active.split(' ');
        svg.classList.add(...classes);
        btn.classList.add('bg-poudre-100', 'border-bordeaux-600');
        playTone(pads[id].freq, duration / 1000);
        setTimeout(() => {
            svg.classList.remove(...classes);
            btn.classList.remove('bg-poudre-100', 'border-bordeaux-600');
        }, duration);
    }

    async function playSequence() {
        isPlayback = true;
        document.getElementById('simon-status').textContent = "Observe bien la séquence… 👀";
        const speed = Math.max(240, 520 - sequence.length * 26);
        await new Promise(r => setTimeout(r, 450));
        for (const id of sequence) {
            if (!active) return;
            flashPad(id, speed * 0.75);
            await new Promise(r => setTimeout(r, speed));
        }
        isPlayback = false;
        userStep = 0;
        if (active) document.getElementById('simon-status').textContent = "À ton tour mon cœur ! ❤️";
    }

    function nextRound() {
        sequence.push(Math.floor(Math.random() * 4));
        document.getElementById('simon-step').textContent = sequence.length;
        playSequence();
    }

    pads.forEach(p => {
        document.getElementById(`simon-pad-${p.id}`).onclick = () => {
            if (isPlayback || sequence.length === 0) return;
            flashPad(p.id, 220);
            if (p.id === sequence[userStep]) {
                userStep++;
                if (userStep === sequence.length) {
                    if (sequence.length >= totalSteps) {
                        document.getElementById('simon-status').textContent = "10/10 réussi ! Incroyable ❤️";
                        setTimeout(() => completeGame(6), 500);
                    } else {
                        isPlayback = true;
                        setTimeout(nextRound, 600);
                    }
                }
            } else {
                showToast("Oups ! On recommence depuis l'étape 1 ❤️");
                sequence = [];
                document.getElementById('simon-step').textContent = "0";
                document.getElementById('simon-start-btn').classList.remove('hidden');
                document.getElementById('simon-status').textContent = "Clique sur Démarrer pour retenter !";
            }
        };
    });

    document.getElementById('simon-start-btn').onclick = (e) => {
        e.target.classList.add('hidden');
        sequence = [];
        nextRound();
    };

    activeGameCleanup = () => { active = false; };
}

// MINI-JEU 7 : MOTS FLÉCHÉS
function initCrosswordGame(container) {
    const placements = [
        { num: 3, word: "HELLOKITTY", dir: "H", r: 4, c: 0, clue: "On va corda sur ce thème quand on se verra" },
        { num: 4, word: "RAIPONCE", dir: "V", r: 2, c: 6, clue: "Une princesse qu'elle aime bien" },
        { num: 7, word: "SHOPPING", dir: "H", r: 5, c: 3, clue: "Une activité que tu aimes par-dessus tout et plus tard je serai là pour t'accompagner" },
        { num: 1, word: "NEWYORK", dir: "H", r: 7, c: 6, clue: "Un de tes voyages de rêve" },
        { num: 2, word: "SUSHIS", dir: "V", r: 5, c: 3, clue: "Un de tes plats préférés" },
        { num: 6, word: "ROUSSE", dir: "H", r: 9, c: 1, clue: "Sa couleur de cheveux" },
        { num: 5, word: "CHAT", dir: "V", r: 3, c: 0, clue: "L'animal qu'elle préfère" }
    ];

    const rows = 11, cols = 13;
    const solutionGrid = Array.from({ length: rows }, () => Array(cols).fill(null));
    const numMarkers = {};

    placements.forEach(p => {
        numMarkers[`${p.r},${p.c}`] = p.num;
        for (let i = 0; i < p.word.length; i++) {
            const rr = p.dir === 'V' ? p.r + i : p.r;
            const cc = p.dir === 'H' ? p.c + i : p.c;
            solutionGrid[rr][cc] = p.word[i];
        }
    });

    container.innerHTML = `
        <div class="text-center">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 7 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800">Mots Fléchés de Mya</h2>
            <p class="text-xs sm:text-sm text-bordeaux-700/80 mt-1 mb-5">
                Complète les 7 mots croisés à l'aide des définitions ci-dessous !
            </p>

            <div class="flex flex-col lg:flex-row items-center lg:items-start justify-center gap-6">
                <div class="overflow-x-auto max-w-full pb-2">
                    <div id="cw-grid" class="grid gap-1 bg-bordeaux-900/10 p-2 rounded-2xl border border-poudre-300" style="grid-template-columns: repeat(${cols}, minmax(26px, 32px));"></div>
                </div>

                <div class="w-full lg:w-80 bg-white rounded-2xl p-4 border border-poudre-200 text-left space-y-2.5">
                    <p class="text-xs font-bold uppercase tracking-wider text-bordeaux-700">Indices :</p>
                    ${[...placements].sort((a, b) => a.num - b.num).map(p => `
                        <div class="text-xs leading-relaxed border-b border-poudre-100 pb-1.5">
                            <span class="inline-block w-5 h-5 rounded-full bg-bordeaux-700 text-white text-center font-bold mr-1">${p.num}</span>
                            <span class="font-semibold text-bordeaux-800">(${p.dir === 'H' ? 'Horizontal' : 'Vertical'})</span> :
                            <span class="text-bordeaux-900/85">${p.clue}</span>
                        </div>
                    `).join('')}
                </div>
            </div>

            <button id="cw-check-btn" class="mt-6 px-7 py-3 rounded-2xl bg-gradient-to-r from-bordeaux-700 to-poudre-500 text-white font-semibold shadow-md cursor-pointer">
                Vérifier la grille ✨
            </button>
        </div>
    `;

    const gridEl = document.getElementById('cw-grid');
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const sol = solutionGrid[r][c];
            if (!sol) {
                const empty = document.createElement('div');
                empty.className = 'aspect-square';
                gridEl.appendChild(empty);
            } else {
                const wrap = document.createElement('div');
                wrap.className = 'relative aspect-square';
                const m = numMarkers[`${r},${c}`];
                if (m) {
                    const badge = document.createElement('span');
                    badge.className = 'absolute top-0.5 left-1 text-[9px] font-bold text-bordeaux-700 pointer-events-none';
                    badge.textContent = m;
                    wrap.appendChild(badge);
                }
                const inp = document.createElement('input');
                inp.type = 'text';
                inp.maxLength = 1;
                inp.dataset.r = r;
                inp.dataset.c = c;
                inp.className = 'w-full h-full text-center font-bold uppercase text-xs sm:text-sm rounded-md bg-white border border-poudre-300 text-bordeaux-900 focus:outline-none focus:border-bordeaux-600 focus:bg-poudre-100';
                inp.addEventListener('input', (e) => {
                    e.target.value = normalizeChar(e.target.value).slice(0, 1);
                });
                wrap.appendChild(inp);
                gridEl.appendChild(wrap);
            }
        }
    }

    document.getElementById('cw-check-btn').onclick = () => {
        const inputs = Array.from(gridEl.querySelectorAll('input'));
        let allOk = true;
        inputs.forEach(inp => {
            const r = parseInt(inp.dataset.r);
            const c = parseInt(inp.dataset.c);
            if (inp.value.toUpperCase() === solutionGrid[r][c]) {
                inp.classList.remove('bg-red-100', 'border-red-400');
                inp.classList.add('bg-emerald-100', 'border-emerald-500');
            } else {
                allOk = false;
                inp.classList.remove('bg-emerald-100', 'border-emerald-500');
                inp.classList.add('bg-red-100', 'border-red-400');
            }
        });

        if (allOk) {
            setTimeout(() => completeGame(7), 400);
        } else {
            showToast("Certaines lettres sont incorrectes (en rouge) ❤️");
        }
    };
}

// MINI-JEU 8 : LABYRINTHE
function initMazeBoardGame(container) {
    const totalTiles = 25;
    const tileTypes = Array(totalTiles).fill('normal');
    tileTypes[0] = 'start';
    tileTypes[totalTiles - 1] = 'end';

    [4, 12, 19].forEach(i => tileTypes[i] = 'broken');
    [7, 16].forEach(i => tileTypes[i] = 'red');
    [2, 5, 9, 11, 14, 18, 21, 22].forEach(i => tileTypes[i] = 'question');

    const questionsPool = [
        { q: "À quelle date a commencé notre relation ?", answers: ["16 mars 2026", "le 16 mars 2026", "16/03/2026", "16/03/26"], displayAns: "Le 16 mars 2026" },
        { q: "Quelle est ma date de naissance ?", answers: ["28 janvier 2009", "le 28 janvier 2009", "28/01/2009", "28/01/09"], displayAns: "Le 28 janvier 2009" },
        { q: "Quel est mon super-héros préféré ?", answers: ["spider man", "spider-man", "spiderman"], displayAns: "Spider-Man" },
        { q: "Quelle est la chose que tu me dis et que je trouve tellement mignonne ?", answers: ["je suis fiere de toi", "je suis fière de toi"], displayAns: "Je suis fière de toi" },
        { q: "Quelle est ma couleur préférée ?", answers: ["bleu", "bleue", "le bleu", "c'est le bleu", "cest le bleu"], displayAns: "Le bleu" },
        { q: "Quel type d'animé je regarde le plus en ce moment ?", answers: ["romance", "les animes de romance", "animes de romance", "anime de romance", "romantique"], displayAns: "Les animés de romance" },
        { q: "Comment s'appelle mon chat noir ?", answers: ["raven", "c'est raven", "cest raven"], displayAns: "Raven" },
        { q: "Quelle est ma saveur de Red Bull préférée ?", answers: ["rose", "la rose", "peche blanche", "pêche blanche", "la peche blanche", "la pêche blanche"], displayAns: "La rose ou Pêche blanche" }
    ];

    let remainingQuestions = [...questionsPool].sort(() => Math.random() - 0.5);
    let pos = 0;
    let isRolling = false;

    container.innerHTML = `
        <div class="text-center">
            <span class="text-xs uppercase tracking-widest text-gold-600 font-bold">Mini-Jeu 8 / 8</span>
            <h2 class="font-serif text-2xl sm:text-3xl font-bold text-bordeaux-800">Le Chemin de Mya vers Layan</h2>
            <p class="text-xs sm:text-sm text-bordeaux-700/80 mt-1 mb-4">
                Lance le dé pour avancer sur les <strong>25 cases</strong> et rejoindre Layan à l'arrivée !
            </p>

            <div class="flex flex-wrap justify-center gap-3 text-[11px] font-semibold mb-4">
                <span class="px-2.5 py-1 rounded-full bg-poudre-100 text-bordeaux-800">👧🏻 Mya (Toi)</span>
                <span class="px-2.5 py-1 rounded-full bg-gold-300/60 text-bordeaux-900">👦🏻 Layan (Arrivée)</span>
                <span class="px-2.5 py-1 rounded-full bg-red-100 text-red-700">💔 Recule (-1 ou -2)</span>
                <span class="px-2.5 py-1 rounded-full bg-pink-100 text-pink-700">❤️ Avance (+1 ou +2)</span>
                <span class="px-2.5 py-1 rounded-full bg-amber-100 text-amber-800">❓ Question surprise</span>
            </div>

            <div id="board-grid" class="grid grid-cols-5 gap-2 max-w-lg mx-auto mb-6"></div>

            <div class="flex flex-col items-center gap-3">
                <div id="dice-display" class="w-16 h-16 rounded-2xl bg-white border-2 border-bordeaux-700 shadow-md flex items-center justify-center text-3xl font-bold text-bordeaux-800">
                    🎲
                </div>
                <button id="roll-dice-btn" class="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-bordeaux-700 to-poudre-500 text-white font-bold shadow-lg hover:opacity-95 active:scale-95 transition-all cursor-pointer">
                    Lancer le dé 🎲
                </button>
                <p id="board-log" class="text-xs sm:text-sm font-medium text-bordeaux-800 min-h-[24px]">
                    Case 1 / 25 • Lance le dé pour commencer !
                </p>
            </div>
        </div>

        <div id="board-q-modal" class="fixed inset-0 z-50 hidden items-center justify-center p-4 bg-bordeaux-900/60 backdrop-blur-xs">
            <div class="bg-cream-50 rounded-3xl max-w-md w-full p-6 text-center shadow-2xl border-2 border-gold-400">
                <span class="text-3xl">❓❤️</span>
                <h3 class="font-serif text-xl font-bold text-bordeaux-800 mt-2 mb-3">Question Surprise !</h3>
                <p id="board-q-text" class="font-soft text-base font-semibold text-bordeaux-900 mb-4"></p>
                <form id="board-q-form" class="space-y-3">
                    <input type="text" id="board-q-input" required placeholder="Ta réponse..." autocomplete="off"
                        class="w-full text-center py-3 px-4 rounded-2xl border-2 border-poudre-300 bg-white text-sm font-semibold focus:outline-none focus:border-bordeaux-600">
                    <button type="submit" class="w-full py-3 rounded-2xl bg-bordeaux-700 text-white font-semibold text-sm cursor-pointer">
                        Valider
                    </button>
                </form>
            </div>
        </div>
    `;

    const boardEl = document.getElementById('board-grid');
    const logEl = document.getElementById('board-log');
    const diceEl = document.getElementById('dice-display');
    const rollBtn = document.getElementById('roll-dice-btn');

    function renderBoard() {
        boardEl.innerHTML = '';
        for (let i = 0; i < totalTiles; i++) {
            const type = tileTypes[i];
            const tile = document.createElement('div');
            let bg = 'bg-white border-poudre-300';
            let icon = `<span class="text-[11px] text-bordeaux-700/50 font-bold">${i + 1}</span>`;

            if (type === 'broken') { bg = 'bg-red-50 border-red-300'; icon = '💔'; }
            else if (type === 'red') { bg = 'bg-pink-50 border-pink-400'; icon = '❤️'; }
            else if (type === 'question') { bg = 'bg-amber-50 border-amber-300'; icon = '❓'; }
            else if (type === 'end') { bg = 'bg-gold-300/50 border-gold-500'; icon = '👦🏻'; }

            tile.className = `aspect-square rounded-2xl border-2 ${bg} flex flex-col items-center justify-center relative shadow-2xs transition-all`;
            tile.innerHTML = icon;

            if (i === pos) {
                const myaPin = document.createElement('div');
                myaPin.className = 'absolute inset-0 bg-bordeaux-700/90 text-white rounded-xl flex flex-col items-center justify-center shadow-md animate-pulse';
                myaPin.innerHTML = `<span class="text-lg leading-none">👧🏻</span><span class="text-[9px] font-bold">Mya</span>`;
                tile.appendChild(myaPin);
            }
            boardEl.appendChild(tile);
        }
    }

    function triggerQuestion() {
        if (remainingQuestions.length === 0) {
            remainingQuestions = [...questionsPool].sort(() => Math.random() - 0.5);
        }
        const qObj = remainingQuestions.pop();
        const qModal = document.getElementById('board-q-modal');
        const qText = document.getElementById('board-q-text');
        const qInput = document.getElementById('board-q-input');

        qText.textContent = qObj.q;
        qInput.value = '';
        qModal.classList.remove('hidden');
        qModal.classList.add('flex');
        setTimeout(() => qInput.focus(), 50);

        document.getElementById('board-q-form').onsubmit = (e) => {
            e.preventDefault();
            const userAns = normalizeChar(qInput.value).toLowerCase().trim();
            const accepted = qObj.answers.map(a => normalizeChar(a).toLowerCase().trim());

            qModal.classList.add('hidden');
            qModal.classList.remove('flex');

            if (accepted.includes(userAns)) {
                playTone(600, 0.2);
                logEl.textContent = "Bonne réponse mon cœur ! Tu es sauvée et restes sur ta case ❤️";
            } else {
                playTone(200, 0.25);
                pos = Math.max(0, pos - 1);
                logEl.textContent = `Oups ! La réponse était "${qObj.displayAns}". Tu recules d'une case !`;
                renderBoard();
            }
            isRolling = false;
        };
    }

    rollBtn.onclick = () => {
        if (isRolling) return;
        isRolling = true;
        playTone(400, 0.1);

        const roll = Math.floor(Math.random() * 4) + 1;
        diceEl.textContent = roll;
        pos = Math.min(totalTiles - 1, pos + roll);
        renderBoard();

        if (pos >= totalTiles - 1) {
            logEl.textContent = "Tu as rejoint Layan ! ❤️🎉";
            setTimeout(() => completeGame(8), 500);
            return;
        }

        const landedType = tileTypes[pos];
        if (landedType === 'broken') {
            const back = Math.random() < 0.5 ? 1 : 2;
            setTimeout(() => {
                pos = Math.max(0, pos - back);
                logEl.textContent = `💔 Cœur brisé ! Tu recules de ${back} case${back > 1 ? 's' : ''}.`;
                renderBoard();
                isRolling = false;
            }, 550);
        } else if (landedType === 'red') {
            const fwd = Math.random() < 0.5 ? 1 : 2;
            setTimeout(() => {
                pos = Math.min(totalTiles - 1, pos + fwd);
                logEl.textContent = `❤️ Cœur rouge bonus ! Tu avances de ${fwd} case${fwd > 1 ? 's' : ''} !`;
                renderBoard();
                if (pos >= totalTiles - 1) {
                    setTimeout(() => completeGame(8), 500);
                } else {
                    isRolling = false;
                }
            }, 550);
        } else if (landedType === 'question') {
            setTimeout(triggerQuestion, 450);
        } else {
            logEl.textContent = `Tu as fait ${roll} • Case ${pos + 1} / 25`;
            isRolling = false;
        }
    };

    renderBoard();
}

// =========================================================================
// 8. UTILITAIRES, MODALES & PÉTALES FINAUX
// =========================================================================
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function showToast(msg) {
    const toast = document.getElementById('toast');
    document.getElementById('toast-msg').textContent = msg;
    toast.classList.remove('opacity-0', 'translate-y-3');
    toast.classList.add('opacity-100', 'translate-y-0');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-3');
        toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2600);
}

function openResetModal() {
    document.getElementById('reset-modal').classList.remove('hidden');
    document.getElementById('reset-modal').classList.add('flex');
}
function closeResetModal() {
    document.getElementById('reset-modal').classList.add('hidden');
    document.getElementById('reset-modal').classList.remove('flex');
}
function confirmFullReset() {
    appState.completedGames = [];
    appState.cipherInputs = {};
    saveState();
    closeResetModal();
    renderHub();
    showToast("Progression réinitialisée");
}

function launchPetals() {
    const layer = document.getElementById('particles-layer');
    const symbols = ['🌸', '❤️', '✨', '🌹'];
    for (let i = 0; i < 24; i++) {
        setTimeout(() => {
            const el = document.createElement('div');
            el.className = 'floating-petal text-xl';
            el.textContent = symbols[i % symbols.length];
            el.style.left = `${Math.random() * 95 + 2}vw`;
            el.style.animationDuration = `${6 + Math.random() * 5}s`;
            layer.appendChild(el);
            setTimeout(() => el.remove(), 11000);
        }, i * 300);
    }
}

window.addEventListener('DOMContentLoaded', () => {
    loadState();
});