// ====================================================
// КОНФИГУРАЦИЯ FIREBASE
// ====================================================
const firebaseConfig = {
    apiKey: "AIzaSyCqn7RelJeecLp2mk4fY12FRyjWF_52QUY",
    authDomain: "online-checkers-game-9dd2e.firebaseapp.com",
    databaseURL: "https://online-checkers-game-9dd2e-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "online-checkers-game-9dd2e",
    storageBucket: "online-checkers-game-9dd2e.firebasestorage.app",
    messagingSenderId: "498294214984",
    appId: "1:498294214984:web:ff6004a535d144ce93e37d"
};

// ====================================================
// ГЛОБАЛЬНЫЕ ПЕРЕМЕННЫЕ
// ====================================================
let auth = null;
let database = null;
let currentUser = null;
let selectedChecker = null;
let availableMoves = [];
let boardState = [];
let currentPlayer = 1;
let gameActive = true;
let botThinking = false;
let moveCount = 0;
let chatRef = null;
let chatListener = null;
let lastMessageTime = 0;
let chatCooldown = 10;

// Размеры досок
const BOARD_SIZE_NORMAL = 8;
const BOARD_SIZE_GLADIATOR = 32;
let currentBoardSize = BOARD_SIZE_NORMAL;

// Режимы игры
let gameMode = 'normal';
let gladiatorMode = false;

// Гладиаторский режим
let dangerZoneLevel = 0;
let dangerZoneTimer = 3;
let gladiatorRound = 1;
let gladiatorTurn = 1;
let playerAlive = true;
let botsAlive = 23;
let gladiatorBoard = [];
let isPlayerTurn = true;
let hasContinuingCapture = false;

// Система баффов
let greenSupplies = 0;
let hasPurpleSupply = false;
let trophies = 0;
let redZoneImmunity = false;

let botBuffs = {};
let activeSupplies = [];
let supplySpawnCounter = 0;

// Администраторы
const ADMIN_USERS = ['admin', 'administrator', 'супервайзер'];

// ====================================================
// ИНИЦИАЛИЗАЦИЯ ПРИ ЗАГРУЗКЕ
// ====================================================
document.addEventListener('DOMContentLoaded', function() {
    console.log('🔄 Инициализация приложения...');
    
    try {
        firebase.initializeApp(firebaseConfig);
        auth = firebase.auth();
        database = firebase.database();
        
        console.log('✅ Firebase инициализирован');
        document.getElementById('loading').style.display = 'none';
        
        auth.onAuthStateChanged((user) => {
            if (user) {
                console.log('✅ Пользователь авторизован:', user.uid);
                loadUserData(user.uid);
            } else {
                console.log('🔒 Пользователь не авторизован');
                showAuthScreen();
            }
        });
        
        setupEventListeners();
        
    } catch (error) {
        console.error('❌ Ошибка инициализации Firebase:', error);
        document.getElementById('loading').style.display = 'none';
        showFirebaseError('Ошибка инициализации Firebase: ' + error.message);
    }
});

function setupEventListeners() {
    document.getElementById('password')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') login();
    });
    
    document.getElementById('message')?.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
}

function handleMessageKeyPress(event) {
    if (event.key === 'Enter') {
        sendMessage();
    }
}

// ====================================================
// АУТЕНТИФИКАЦИЯ
// ====================================================
async function register() {
    const username = document.getElementById('login').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        showAuthMessage('Введите имя пользователя и пароль');
        return;
    }
    
    if (username.length < 3) {
        showAuthMessage('Имя пользователя должно быть не менее 3 символов');
        return;
    }
    
    if (password.length < 6) {
        showAuthMessage('Пароль должен быть не менее 6 символов');
        return;
    }
    
    showAuthMessage('Регистрация...', 'info');
    
    try {
        const email = username.toLowerCase() + '@checkers.game';
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        console.log('✅ Пользователь создан:', userId);
        
        const isAdmin = ADMIN_USERS.includes(username.toLowerCase());
        
        const userData = {
            username: username,
            email: email,
            rating: 1000,
            wins: 0,
            losses: 0,
            draws: 0,
            calibrationGames: 0,
            calibrationCompleted: true,
            ratingHistory: [],
            isAdmin: isAdmin,
            createdAt: firebase.database.ServerValue.TIMESTAMP,
            lastOnline: firebase.database.ServerValue.TIMESTAMP,
            lastRatingReset: null,
            status: 'online'
        };
        
        await database.ref('users/' + userId).set(userData);
        
        currentUser = {
            uid: userId,
            ...userData
        };
        
        showGameScreen();
        showNotification('✅ Регистрация успешна!' + (isAdmin ? ' Вы администратор!' : ''));
        
    } catch (error) {
        console.error('❌ Ошибка регистрации:', error);
        showAuthMessage(getFirebaseErrorMessage(error));
    }
}

async function login() {
    const username = document.getElementById('login').value.trim();
    const password = document.getElementById('password').value.trim();
    
    if (!username || !password) {
        showAuthMessage('Введите имя пользователя и пароль');
        return;
    }
    
    showAuthMessage('Вход...', 'info');
    
    try {
        const email = username.toLowerCase() + '@checkers.game';
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        const userId = userCredential.user.uid;
        
        console.log('✅ Пользователь вошел:', userId);
        
        await loadUserData(userId);
        
    } catch (error) {
        console.error('❌ Ошибка входа:', error);
        showAuthMessage(getFirebaseErrorMessage(error));
    }
}

async function loadUserData(userId) {
    try {
        const snapshot = await database.ref('users/' + userId).once('value');
        const userData = snapshot.val();
        
        if (userData) {
            currentUser = {
                uid: userId,
                ...userData
            };
            
            await database.ref('users/' + userId).update({
                lastOnline: firebase.database.ServerValue.TIMESTAMP,
                status: 'online'
            });
            
            showGameScreen();
            showNotification('✅ Вход выполнен!' + (currentUser.isAdmin ? ' Вы вошли как администратор!' : ''));
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки данных пользователя:', error);
        showAuthMessage('Ошибка загрузки данных пользователя');
    }
}

async function logout() {
    try {
        if (chatListener) {
            chatRef.off('value', chatListener);
            chatListener = null;
        }
        
        if (currentUser && auth.currentUser) {
            await database.ref('users/' + currentUser.uid).update({
                status: 'offline',
                lastOnline: firebase.database.ServerValue.TIMESTAMP
            });
        }
        
        await auth.signOut();
        
        currentUser = null;
        gameActive = false;
        selectedChecker = null;
        boardState = [];
        
        showAuthScreen();
        showNotification('✅ Вы вышли из системы');
        
    } catch (error) {
        console.error('❌ Ошибка выхода:', error);
        showNotification('❌ Ошибка выхода из системы', 'error');
        showAuthScreen();
    }
}

// ====================================================
// АДМИН-ФУНКЦИИ И ЛИДЕРБОРД
// ====================================================
function toggleAdminPanel() {
    const panel = document.getElementById('admin-panel');
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function toggleLeaderboard() {
    const panel = document.getElementById('leaderboard-panel');
    if (panel.style.display === 'none') {
        panel.style.display = 'block';
        updateLeaderboard();
    } else {
        panel.style.display = 'none';
    }
}

async function updateLeaderboard() {
    try {
        const snapshot = await database.ref('users').once('value');
        const users = snapshot.val();
        const leaderboard = [];
        
        for (const uid in users) {
            const user = users[uid];
            if (user.username && user.rating !== undefined && user.calibrationCompleted) {
                leaderboard.push({
                    username: user.username,
                    rating: user.rating || 1000,
                    wins: user.wins || 0,
                    losses: user.losses || 0,
                    draws: user.draws || 0
                });
            }
        }
        
        leaderboard.sort((a, b) => b.rating - a.rating);
        
        const leaderboardContent = document.getElementById('leaderboard-content');
        leaderboardContent.innerHTML = '';
        
        if (leaderboard.length === 0) {
            leaderboardContent.innerHTML = '<p style="text-align: center; color: #aaa;">Нет данных о рейтинге</p>';
            return;
        }
        
        leaderboard.slice(0, 20).forEach((user, index) => {
            const row = document.createElement('div');
            row.className = 'leaderboard-row';
            let medal = '';
            if (index === 0) medal = '🥇';
            else if (index === 1) medal = '🥈';
            else if (index === 2) medal = '🥉';
            
            row.innerHTML = `
                <div class="leaderboard-rank">${index + 1} ${medal}</div>
                <div class="leaderboard-name">${user.username}</div>
                <div class="leaderboard-rating">${user.rating}</div>
            `;
            leaderboardContent.appendChild(row);
        });
        
    } catch (error) {
        console.error('❌ Ошибка загрузки лидерборда:', error);
        document.getElementById('leaderboard-content').innerHTML = 
            '<p style="color: #ff6b6b; text-align: center;">Ошибка загрузки лидерборда</p>';
    }
}

async function clearChat() {
    if (!currentUser?.isAdmin) {
        showNotification('❌ У вас нет прав администратора', 'error');
        return;
    }
    
    if (confirm('Вы уверены, что хотите очистить весь чат? Это действие нельзя отменить.')) {
        try {
            await database.ref('chat').remove();
            showNotification('✅ Чат очищен');
        } catch (error) {
            console.error('❌ Ошибка очистки чата:', error);
            showNotification('❌ Ошибка очистки чата', 'error');
        }
    }
}

async function deleteMessage(messageId) {
    if (!currentUser?.isAdmin) {
        showNotification('❌ У вас нет прав администратора', 'error');
        return;
    }
    
    try {
        await database.ref('chat/' + messageId).remove();
        console.log('✅ Сообщение удалено:', messageId);
    } catch (error) {
        console.error('❌ Ошибка удаления сообщения:', error);
        showNotification('❌ Ошибка удаления сообщения', 'error');
    }
}

async function viewAllUsers() {
    if (!currentUser?.isAdmin) {
        showNotification('❌ У вас нет прав администратора', 'error');
        return;
    }
    
    try {
        const snapshot = await database.ref('users').once('value');
        const users = snapshot.val();
        let userList = '👥 Все пользователи:\n\n';
        
        Object.keys(users || {}).forEach(uid => {
            const user = users[uid];
            const ratingDisplay = user.calibrationCompleted ? user.rating : 'калибровка';
            userList += `${user.username} (Рейтинг: ${ratingDisplay})${user.isAdmin ? ' 👑 Админ' : ''}\n`;
        });
        
        alert(userList);
    } catch (error) {
        console.error('❌ Ошибка загрузки пользователей:', error);
        showNotification('❌ Ошибка загрузки пользователей', 'error');
    }
}

async function resetAllUsersRating() {
    if (!currentUser?.isAdmin) {
        showNotification('❌ У вас нет прав администратора', 'error');
        return;
    }
    
    if (confirm('ВНИМАНИЕ! Вы уверены, что хотите сбросить рейтинг ВСЕМ пользователям? Это действие нельзя отменить.')) {
        try {
            const snapshot = await database.ref('users').once('value');
            const users = snapshot.val();
            const updates = {};
            
            Object.keys(users || {}).forEach(uid => {
                updates[`${uid}/rating`] = 1000;
                updates[`${uid}/calibrationGames`] = 0;
                updates[`${uid}/calibrationCompleted`] = true;
                updates[`${uid}/ratingHistory`] = [];
                updates[`${uid}/lastRatingReset`] = firebase.database.ServerValue.TIMESTAMP;
            });
            
            await database.ref('users').update(updates);
            showNotification('✅ Рейтинг всех пользователей сброшен к 1000!');
            
            if (currentUser) {
                currentUser.rating = 1000;
                currentUser.calibrationGames = 0;
                currentUser.calibrationCompleted = true;
                updateUserUI();
            }
            
            // Обновляем лидерборд
            updateLeaderboard();
            
        } catch (error) {
            console.error('❌ Ошибка сброса рейтинга:', error);
            showNotification('❌ Ошибка сброса рейтинга', 'error');
        }
    }
}

// ====================================================
// УПРАВЛЕНИЕ РЕЖИМАМИ ИГРЫ
// ====================================================
function setGameMode(mode) {
    if (gameMode === 'rating' && gameActive) {
        if (!confirm('Вы находитесь в рейтинговой игре. Если вы смените режим, текущая игра будет засчитана как поражение. Продолжить?')) {
            return;
        }
        endGame(2, true); // поражение при смене режима
    }
    
    if (gameMode === mode) return;
    
    gameMode = mode;
    gladiatorMode = (mode === 'gladiator');
    
    // Сбрасываем состояние доски
    currentBoardSize = gladiatorMode ? BOARD_SIZE_GLADIATOR : BOARD_SIZE_NORMAL;
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active', 'rating-active', 'gladiator-active');
    });
    
    let activeClass = 'active';
    if (mode === 'rating') activeClass = 'rating-active';
    if (mode === 'gladiator') activeClass = 'gladiator-active';
    
    const modeButtons = document.querySelectorAll('.mode-btn');
    for (let btn of modeButtons) {
        if (btn.textContent.includes(getModeName(mode))) {
            btn.classList.add(activeClass);
            break;
        }
    }
    
    const modeNames = {
        'normal': 'Обычные шашки 8x8',
        'giveaway': 'Поддавки 8x8',
        'rating': 'Рейтинговая игра 8x8',
        'gladiator': 'Гладиаторский режим 32x32'
    };
    
    document.getElementById('game-mode-display').textContent = modeNames[mode];
    
    if (mode === 'rating') {
        document.getElementById('bot-controls').style.display = 'none';
        document.getElementById('player2-rating').textContent = 'Уровень: 👑 Эксперт';
        document.getElementById('botDifficulty').value = 'expert';
        document.getElementById('gladiator-controls').style.display = 'none';
        document.getElementById('gladiator-info').style.display = 'none';
        document.getElementById('gladiator-stats').style.display = 'none';
        document.getElementById('buffs-panel').style.display = 'none';
        document.getElementById('leaderboard-panel').style.display = 'none';
        showNotification('🏆 Рейтинговая игра! Сложность: эксперт');
    } else if (mode === 'gladiator') {
        document.getElementById('bot-controls').style.display = 'none';
        document.getElementById('gladiator-controls').style.display = 'block';
        document.getElementById('gladiator-info').style.display = 'block';
        document.getElementById('gladiator-stats').style.display = 'block';
        document.getElementById('buffs-panel').style.display = 'block';
        document.getElementById('leaderboard-panel').style.display = 'none';
        
        document.getElementById('player2-name').textContent = '23 бота';
        document.getElementById('player2-rating').textContent = 'Королевская битва';
        showNotification('⚔️ Гладиаторский режим 32x32! Битва до последнего выжившего');
    } else {
        document.getElementById('bot-controls').style.display = 'block';
        document.getElementById('gladiator-controls').style.display = 'none';
        document.getElementById('gladiator-info').style.display = 'none';
        document.getElementById('gladiator-stats').style.display = 'none';
        document.getElementById('buffs-panel').style.display = 'none';
        document.getElementById('leaderboard-panel').style.display = 'none';
        document.getElementById('player2-name').textContent = 'Бот';
        updateBotLevel();
    }
    
    // ОЧЕНЬ ВАЖНО: Сбрасываем состояние игры и перерисовываем доску
    gameActive = false;
    selectedChecker = null;
    availableMoves = [];
    
    // Переинициализируем доску с правильным размером
    startNewGame();
    
    showNotification(`✅ Режим изменен: ${modeNames[mode]}`);
}

function getModeName(mode) {
    switch(mode) {
        case 'normal': return 'Обычные';
        case 'giveaway': return 'Поддавки';
        case 'rating': return 'Рейтинг';
        case 'gladiator': return 'Гладиатор';
        default: return '';
    }
}

// ====================================================
// ГЛАДИАТОРСКИЙ РЕЖИМ 32x32 С БАФФАМИ
// ====================================================
function initGladiatorBoard() {
    gladiatorBoard = Array(BOARD_SIZE_GLADIATOR).fill().map(() => Array(BOARD_SIZE_GLADIATOR).fill(0));
    activeSupplies = [];
    botBuffs = {};
    greenSupplies = 0;
    hasPurpleSupply = false;
    trophies = 0;
    redZoneImmunity = false;
    supplySpawnCounter = 0;
    
    updateBuffsUI();
    
    // Получаем все черные клетки на границах доски
    const borderCells = [];
    
    for (let col = 0; col < BOARD_SIZE_GLADIATOR; col++) {
        if ((0 + col) % 2 === 1) {
            borderCells.push({row: 0, col: col});
        }
    }
    
    for (let col = 0; col < BOARD_SIZE_GLADIATOR; col++) {
        if (((BOARD_SIZE_GLADIATOR-1) + col) % 2 === 1) {
            borderCells.push({row: BOARD_SIZE_GLADIATOR-1, col: col});
        }
    }
    
    for (let row = 1; row < BOARD_SIZE_GLADIATOR-1; row++) {
        if ((row + 0) % 2 === 1) {
            borderCells.push({row: row, col: 0});
        }
    }
    
    for (let row = 1; row < BOARD_SIZE_GLADIATOR-1; row++) {
        if ((row + (BOARD_SIZE_GLADIATOR-1)) % 2 === 1) {
            borderCells.push({row: row, col: BOARD_SIZE_GLADIATOR-1});
        }
    }
    
    const shuffledCells = [...borderCells].sort(() => Math.random() - 0.5);
    
    let placedPlayer = false;
    let placedBots = 0;
    const placedPositions = [];
    
    for (let i = 0; i < shuffledCells.length && !placedPlayer; i++) {
        const pos = shuffledCells[i];
        let canPlace = true;
        
        for (const placedPos of placedPositions) {
            const rowDist = Math.abs(placedPos.row - pos.row);
            const colDist = Math.abs(placedPos.col - pos.col);
            
            if (rowDist + colDist < 5) {
                canPlace = false;
                break;
            }
        }
        
        if (canPlace) {
            gladiatorBoard[pos.row][pos.col] = 1;
            placedPositions.push(pos);
            placedPlayer = true;
            break;
        }
    }
    
    for (let i = 0; i < shuffledCells.length && placedBots < 23; i++) {
        const pos = shuffledCells[i];
        if (gladiatorBoard[pos.row][pos.col] !== 0) continue;
        
        let canPlace = true;
        
        for (const placedPos of placedPositions) {
            const rowDist = Math.abs(placedPos.row - pos.row);
            const colDist = Math.abs(placedPos.col - pos.col);
            
            if (rowDist + colDist < 5) {
                canPlace = false;
                break;
            }
        }
        
        if (canPlace) {
            gladiatorBoard[pos.row][pos.col] = 2;
            placedPositions.push(pos);
            placedBots++;
            botBuffs[`${pos.row}-${pos.col}`] = {green: 0, trophy: 0, purple: false};
        }
    }
    
    spawnGreenSupplies();
    
    dangerZoneLevel = 0;
    dangerZoneTimer = 3;
    gladiatorRound = 1;
    gladiatorTurn = 1;
    playerAlive = true;
    botsAlive = 23;
    isPlayerTurn = true;
    hasContinuingCapture = false;
    
    updateGladiatorUI();
    boardState = gladiatorBoard;
    initBoard();
    updateDangerZoneDisplay();
}

function spawnGreenSupplies() {
    const supplyCount = 40 + Math.floor(Math.random() * 11);
    
    for (let i = 0; i < supplyCount; i++) {
        let attempts = 0;
        let placed = false;
        
        while (attempts < 100 && !placed) {
            const row = Math.floor(Math.random() * BOARD_SIZE_GLADIATOR);
            const col = Math.floor(Math.random() * BOARD_SIZE_GLADIATOR);
            
            if ((row + col) % 2 === 1 && gladiatorBoard[row][col] === 0) {
                let tooClose = false;
                for (let r = Math.max(0, row-3); r <= Math.min(BOARD_SIZE_GLADIATOR-1, row+3); r++) {
                    for (let c = Math.max(0, col-3); c <= Math.min(BOARD_SIZE_GLADIATOR-1, col+3); c++) {
                        if (gladiatorBoard[r][c] !== 0) {
                            tooClose = true;
                            break;
                        }
                    }
                    if (tooClose) break;
                }
                
                if (!tooClose) {
                    activeSupplies.push({
                        row: row,
                        col: col,
                        type: 'green',
                        id: `green-${i}`
                    });
                    placed = true;
                }
            }
            attempts++;
        }
    }
}

function spawnPurpleSupply() {
    let attempts = 0;
    let placed = false;
    
    while (attempts < 50 && !placed) {
        const row = Math.floor(Math.random() * BOARD_SIZE_GLADIATOR);
        const col = Math.floor(Math.random() * BOARD_SIZE_GLADIATOR);
        
        if ((row + col) % 2 === 1 && gladiatorBoard[row][col] === 0) {
            const hasBuff = activeSupplies.some(s => s.row === row && s.col === col);
            if (!hasBuff && !isInDangerZone(row, col) && !isInWarningZone(row, col)) {
                activeSupplies.push({
                    row: row,
                    col: col,
                    type: 'purple',
                    id: `purple-${Date.now()}`
                });
                placed = true;
                showNotification('💜 На карте появилось фиолетовое снабжение!');
            }
        }
        attempts++;
    }
}

function checkAndPickupBuff(row, col, player) {
    const supplyIndex = activeSupplies.findIndex(s => s.row === row && s.col === col);
    
    if (supplyIndex !== -1) {
        const supply = activeSupplies[supplyIndex];
        
        if (player === 1) {
            switch(supply.type) {
                case 'green':
                    greenSupplies++;
                    showNotification('💚 Вы подобрали зеленый припас! +1 к пропускам взятия');
                    break;
                case 'purple':
                    if (!hasPurpleSupply) {
                        hasPurpleSupply = true;
                        showNotification('💜 Вы подобрали фиолетовое снабжение! Следующий ход будет двойным');
                    }
                    break;
            }
        } else {
            const botKey = findBotAt(row, col);
            if (botKey && botBuffs[botKey]) {
                switch(supply.type) {
                    case 'green':
                        botBuffs[botKey].green++;
                        break;
                    case 'purple':
                        if (!botBuffs[botKey].purple) {
                            botBuffs[botKey].purple = true;
                        }
                        break;
                }
            }
        }
        
        activeSupplies.splice(supplyIndex, 1);
        updateBoardUI();
        updateBuffsUI();
        return true;
    }
    
    return false;
}

function findBotAt(row, col) {
    for (const key in botBuffs) {
        const [botRow, botCol] = key.split('-').map(Number);
        if (botRow === row && botCol === col) {
            return key;
        }
    }
    return null;
}

function awardTrophy(toPlayer, toRow, toCol) {
    if (toPlayer === 1) {
        trophies++;
        showNotification('🏆 Вы получили трофей! +1 к иммунитету красной зоны');
    } else {
        const botKey = findBotAt(toRow, toCol);
        if (botKey) {
            botBuffs[botKey].trophy++;
        }
    }
    updateBuffsUI();
}

function useGreenSupply() {
    if (greenSupplies > 0) {
        greenSupplies--;
        updateBuffsUI();
        return true;
    }
    return false;
}

function usePurpleSupply() {
    if (hasPurpleSupply) {
        hasPurpleSupply = false;
        updateBuffsUI();
        return true;
    }
    return false;
}

function useTrophy() {
    if (trophies > 0) {
        trophies--;
        redZoneImmunity = true;
        updateBuffsUI();
        showNotification('🛡️ Активирован иммунитет к красной зоне на 1 ход!');
        return true;
    }
    return false;
}

function botUseGreenSupply(botKey) {
    if (botBuffs[botKey] && botBuffs[botKey].green > 0) {
        botBuffs[botKey].green--;
        return true;
    }
    return false;
}

function botUsePurpleSupply(botKey) {
    if (botBuffs[botKey] && botBuffs[botKey].purple) {
        botBuffs[botKey].purple = false;
        return true;
    }
    return false;
}

function botUseTrophy(botKey) {
    if (botBuffs[botKey] && botBuffs[botKey].trophy > 0) {
        botBuffs[botKey].trophy--;
        return true;
    }
    return false;
}

function updateBuffsUI() {
    document.getElementById('green-supply-count').textContent = greenSupplies;
    document.getElementById('purple-supply-count').textContent = hasPurpleSupply ? '1' : '0';
    document.getElementById('trophy-count').textContent = trophies;
}

function updateGladiatorUI() {
    document.getElementById('danger-zone-timer').textContent = dangerZoneTimer;
    document.getElementById('danger-zone-level').textContent = dangerZoneLevel;
    document.getElementById('survivors-count').textContent = (playerAlive ? 1 : 0) + botsAlive;
    
    document.getElementById('gladiator-player-count').textContent = playerAlive ? 1 : 0;
    document.getElementById('gladiator-bot-count').textContent = botsAlive;
    document.getElementById('gladiator-round').textContent = gladiatorRound;
    document.getElementById('gladiator-turn').textContent = gladiatorTurn;
    
    document.getElementById('game-status').textContent = playerAlive ? 
        (isPlayerTurn ? 'Ваш ход в гладиаторской битве!' : 'Ход ботов...') : 'Вы выбыли из битвы!';
    
    const warningInfo = document.getElementById('warning-zone-info');
    if (dangerZoneTimer === 1) {
        warningInfo.style.display = 'block';
        showNotification('⚠️ Внимание! Следующим ходом расширится красная зона!', 'warning');
    } else {
        warningInfo.style.display = 'none';
    }
    
    // ТЕПЕРЬ СНАБЖЕНИЕ ПОЯВЛЯЕТСЯ ТОЛЬКО КАЖДЫЕ 3 ХОДА
    // (логика перенесена в makeGladiatorMove)
}

function updateDangerZoneDisplay() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        cell.classList.remove('danger-zone', 'warning-zone');
        
        if (dangerZoneLevel > 0) {
            if (row < dangerZoneLevel || row >= BOARD_SIZE_GLADIATOR - dangerZoneLevel || 
                col < dangerZoneLevel || col >= BOARD_SIZE_GLADIATOR - dangerZoneLevel) {
                cell.classList.add('danger-zone');
            }
        }
        
        if (dangerZoneTimer === 1) {
            const warningLevel = dangerZoneLevel + 1;
            if (row < warningLevel || row >= BOARD_SIZE_GLADIATOR - warningLevel || 
                col < warningLevel || col >= BOARD_SIZE_GLADIATOR - warningLevel) {
                if (!cell.classList.contains('danger-zone')) {
                    cell.classList.add('warning-zone');
                }
            }
        }
    });
}

function expandDangerZone() {
    dangerZoneLevel++;
    dangerZoneTimer = 3;
    
    let removedPlayer = false;
    let removedBots = 0;
    
    for (let row = 0; row < BOARD_SIZE_GLADIATOR; row++) {
        for (let col = 0; col < BOARD_SIZE_GLADIATOR; col++) {
            if (gladiatorBoard[row][col] !== 0) {
                if (row < dangerZoneLevel || row >= BOARD_SIZE_GLADIATOR - dangerZoneLevel || 
                    col < dangerZoneLevel || col >= BOARD_SIZE_GLADIATOR - dangerZoneLevel) {
                    
                    const player = gladiatorBoard[row][col];
                    
                    if (player === 1) {
                        if (!redZoneImmunity) {
                            removedPlayer = true;
                            playerAlive = false;
                            gladiatorBoard[row][col] = 0;
                            showNotification('🔥 ВАША ШАШКА УНИЧТОЖЕНА КРАСНОЙ ЗОНОЙ!', 'error');
                        } else {
                            redZoneImmunity = false;
                            showNotification('🛡️ Ваш иммунитет защитил шашку от красной зоны!');
                        }
                    } else if (player === 2) {
                        const botKey = findBotAt(row, col);
                        const hasImmunity = botKey && botBuffs[botKey] && botBuffs[botKey].trophy > 0;
                        
                        if (!hasImmunity) {
                            removedBots++;
                            if (botsAlive > 0) botsAlive--;
                            gladiatorBoard[row][col] = 0;
                            if (botKey) delete botBuffs[botKey];
                        } else {
                            botUseTrophy(botKey);
                        }
                    }
                }
            }
        }
    }
    
    activeSupplies = activeSupplies.filter(supply => {
        const inRedZone = supply.row < dangerZoneLevel || 
                         supply.row >= BOARD_SIZE_GLADIATOR - dangerZoneLevel || 
                         supply.col < dangerZoneLevel || 
                         supply.col >= BOARD_SIZE_GLADIATOR - dangerZoneLevel;
        return !inRedZone;
    });
    
    boardState = gladiatorBoard;
    updateBoardUI();
    updateGladiatorUI();
    updateDangerZoneDisplay();
    
    if (removedBots > 0) {
        showNotification(`🔥 Красная зона уничтожила ${removedBots} ботов!`);
    }
    
    showNotification(`🔥 Красная зона расширилась! Уровень: ${dangerZoneLevel}`);
    
    if (removedPlayer) {
        endGladiatorGame('🔥 Вы погибли в красной зоне! Игра окончена.');
        return;
    }
    
    checkGladiatorGameEnd();
}

function getGladiatorAvailableMoves(row, col, player, ignoreMustCapture = false) {
    const moves = [];
    const directions = [
        { dr: -1, dc: -1 },
        { dr: -1, dc: 1 },
        { dr: 1, dc: -1 },
        { dr: 1, dc: 1 }
    ];
    
    let hasCaptures = false;
    
    for (const dir of directions) {
        const captureRow = row + dir.dr;
        const captureCol = col + dir.dc;
        const jumpRow = row + dir.dr * 2;
        const jumpCol = col + dir.dc * 2;
        
        if (isValidGladiatorPosition(captureRow, captureCol) && 
            isValidGladiatorPosition(jumpRow, jumpCol) &&
            gladiatorBoard[captureRow][captureCol] !== 0 &&
            gladiatorBoard[jumpRow][jumpCol] === 0) {
            
            if (player === 1) {
                if (gladiatorBoard[captureRow][captureCol] === 2) {
                    moves.push({
                        row: jumpRow,
                        col: jumpCol,
                        isCapture: true,
                        captureRow: captureRow,
                        captureCol: captureCol,
                        direction: dir
                    });
                    hasCaptures = true;
                }
            } else if (player === 2) {
                if (gladiatorBoard[captureRow][captureCol] === 1 || gladiatorBoard[captureRow][captureCol] === 2) {
                    moves.push({
                        row: jumpRow,
                        col: jumpCol,
                        isCapture: true,
                        captureRow: captureRow,
                        captureCol: captureCol,
                        direction: dir
                    });
                    hasCaptures = true;
                }
            }
        }
    }
    
    if (hasCaptures && !ignoreMustCapture) {
        return moves;
    }
    
    for (const dir of directions) {
        const newRow = row + dir.dr;
        const newCol = col + dir.dc;
        
        if (isValidGladiatorPosition(newRow, newCol) && 
            gladiatorBoard[newRow][newCol] === 0) {
            
            if (!isInDangerZone(newRow, newCol) && !isInWarningZone(newRow, newCol)) {
                moves.push({
                    row: newRow,
                    col: newCol,
                    isCapture: false,
                    direction: dir
                });
            }
        }
    }
    
    return moves;
}

function isInDangerZone(row, col) {
    return dangerZoneLevel > 0 && 
           (row < dangerZoneLevel || row >= BOARD_SIZE_GLADIATOR - dangerZoneLevel || 
            col < dangerZoneLevel || col >= BOARD_SIZE_GLADIATOR - dangerZoneLevel);
}

function isInWarningZone(row, col) {
    return dangerZoneTimer === 1 && 
           (row < dangerZoneLevel + 1 || row >= BOARD_SIZE_GLADIATOR - 1 - dangerZoneLevel || 
            col < dangerZoneLevel + 1 || col >= BOARD_SIZE_GLADIATOR - 1 - dangerZoneLevel);
}

function canPlayerMakeAnyMove() {
    if (!playerAlive) return false;
    
    for (let row = 0; row < BOARD_SIZE_GLADIATOR; row++) {
        for (let col = 0; col < BOARD_SIZE_GLADIATOR; col++) {
            if (gladiatorBoard[row][col] === 1) {
                const moves = getGladiatorAvailableMoves(row, col, 1);
                if (moves.length > 0) {
                    return true;
                }
            }
        }
    }
    return false;
}

function makeGladiatorMove(toRow, toCol) {
    if (!selectedChecker) return false;
    
    const { row: fromRow, col: fromCol } = selectedChecker;
    const move = availableMoves.find(m => m.row === toRow && m.col === toCol);
    if (!move) return false;
    
    const player = gladiatorBoard[fromRow][fromCol];
    gladiatorBoard[fromRow][fromCol] = 0;
    gladiatorBoard[toRow][toCol] = player;
    
    if (player === 2) {
        const oldKey = `${fromRow}-${fromCol}`;
        const newKey = `${toRow}-${toCol}`;
        if (botBuffs[oldKey]) {
            botBuffs[newKey] = {...botBuffs[oldKey]};
            delete botBuffs[oldKey];
        }
    }
    
    checkAndPickupBuff(toRow, toCol, player);
    
    if (move.isCapture) {
        const captured = gladiatorBoard[move.captureRow][move.captureCol];
        gladiatorBoard[move.captureRow][move.captureCol] = 0;
        
        if (captured === 1) {
            playerAlive = false;
            showNotification('⚔️ Ваша шашка была взята ботом!', 'error');
        } else if (captured === 2) {
            if (botsAlive > 0) botsAlive--;
            const botKey = `${move.captureRow}-${move.captureCol}`;
            if (botBuffs[botKey]) delete botBuffs[botKey];
            
            awardTrophy(player, toRow, toCol);
        }
        
        const nextCaptures = getGladiatorAvailableMoves(toRow, toCol, player)
            .filter(m => m.isCapture);
        
        if (nextCaptures.length > 0) {
            selectedChecker = { row: toRow, col: toCol };
            availableMoves = nextCaptures;
            updateBoardUI();
            highlightAvailableMoves();
            hasContinuingCapture = true;
            showNotification('⚔️ Продолжайте взятие! Боты не ходят пока вы не закончите.');
            return true;
        }
    }
    
    if (isInDangerZone(toRow, toCol)) {
        if (player === 1) {
            if (!redZoneImmunity) {
                playerAlive = false;
                gladiatorBoard[toRow][toCol] = 0;
                showNotification('🔥 ВАША ШАШКА УНИЧТОЖЕНА КРАСНОЙ ЗОНОЙ!', 'error');
                endGladiatorGame('🔥 Вы погибли в красной зоне! Игра окончена.');
                return false;
            } else {
                redZoneImmunity = false;
                showNotification('🛡️ Ваш иммунитет защитил шашку от красной зоны!');
            }
        } else if (player === 2) {
            const botKey = findBotAt(toRow, toCol);
            const hasImmunity = botKey && botBuffs[botKey] && botBuffs[botKey].trophy > 0;
            
            if (!hasImmunity) {
                if (botsAlive > 0) botsAlive--;
                gladiatorBoard[toRow][toCol] = 0;
                if (botKey) delete botBuffs[botKey];
                showNotification(`🔥 Бот уничтожен красной зоной!`);
            } else {
                botUseTrophy(botKey);
            }
        }
    }
    
    boardState = gladiatorBoard;
    updateBoardUI();
    clearSelection();
    
    dangerZoneTimer--;
    if (dangerZoneTimer <= 0) {
        expandDangerZone();
        if (!playerAlive) {
            return false;
        }
    } else {
        updateGladiatorUI();
        updateDangerZoneDisplay();
    }
    
    gladiatorTurn++;
    if (gladiatorTurn > 7) {
        gladiatorRound++;
        gladiatorTurn = 1;
    }
    
    hasContinuingCapture = false;
    
    // ТЕПЕРЬ СНАБЖЕНИЕ ПОЯВЛЯЕТСЯ КАЖДЫЕ 3 ХОДА ИГРОКА
    if (player === 1) {
        supplySpawnCounter++;
        if (supplySpawnCounter >= 3) {
            spawnPurpleSupply();
            supplySpawnCounter = 0;
        }
    }
    
    updateGladiatorUI();
    checkGladiatorGameEnd();
    return true;
}

function makeGladiatorBotMoves() {
    if (!playerAlive || botsAlive === 0 || !gameActive) {
        checkGladiatorGameEnd();
        return;
    }
    
    if (hasContinuingCapture) {
        showNotification('⚔️ Завершите взятие! Боты ждут.');
        return;
    }
    
    const bots = [];
    for (let row = 0; row < BOARD_SIZE_GLADIATOR; row++) {
        for (let col = 0; col < BOARD_SIZE_GLADIATOR; col++) {
            if (gladiatorBoard[row][col] === 2) {
                bots.push({ row, col });
            }
        }
    }
    
    if (bots.length === 0) {
        isPlayerTurn = true;
        updateGladiatorUI();
        updateDangerZoneDisplay();
        checkGladiatorGameEnd();
        return;
    }
    
    // Перемешиваем ботов для случайного порядка хода
    bots.sort(() => Math.random() - 0.5);
    
    let botIndex = 0;
    let movesMade = 0;
    
    function makeNextBotMove() {
        if (botIndex >= bots.length || movesMade >= 5 || !playerAlive || botsAlive === 0) {
            isPlayerTurn = true;
            updateGladiatorUI();
            updateDangerZoneDisplay();
            checkGladiatorGameEnd();
            return;
        }
        
        const bot = bots[botIndex];
        const botKey = `${bot.row}-${bot.col}`;
        
        let moves = getGladiatorAvailableMoves(bot.row, bot.col, 2);
        
        // Проверяем, есть ли обязательное взятие
        if (moves.some(m => m.isCapture) && botBuffs[botKey] && botBuffs[botKey].green > 0) {
            const normalMoves = getGladiatorAvailableMoves(bot.row, bot.col, 2, true);
            if (normalMoves.length > 0 && Math.random() < 0.3) {
                botUseGreenSupply(botKey);
                moves = normalMoves;
            }
        }
        
        if (moves.length > 0) {
            const bestMove = selectBestBotMove(moves, bot.row, bot.col, botKey);
            
            if (bestMove) {
                // Сохраняем состояние баффов перед ходом
                const hadPurpleBuff = botBuffs[botKey] && botBuffs[botKey].purple;
                
                gladiatorBoard[bot.row][bot.col] = 0;
                gladiatorBoard[bestMove.row][bestMove.col] = 2;
                
                const newKey = `${bestMove.row}-${bestMove.col}`;
                if (botBuffs[botKey]) {
                    botBuffs[newKey] = { ...botBuffs[botKey] };
                    delete botBuffs[botKey];
                }
                
                checkAndPickupBuff(bestMove.row, bestMove.col, 2);
                
                if (bestMove.isCapture) {
                    const captured = gladiatorBoard[bestMove.captureRow][bestMove.captureCol];
                    gladiatorBoard[bestMove.captureRow][bestMove.captureCol] = 0;
                    
                    if (captured === 1) {
                        playerAlive = false;
                        showNotification('⚔️ Ваша шашка была взята ботом!', 'error');
                    } else if (captured === 2) {
                        if (botsAlive > 0) botsAlive--;
                        const capturedKey = `${bestMove.captureRow}-${bestMove.captureCol}`;
                        if (botBuffs[capturedKey]) delete botBuffs[capturedKey];
                        
                        awardTrophy(2, bestMove.row, bestMove.col);
                    }
                    
                    // БОТ МОЖЕТ ПРОДОЛЖИТЬ ВЗЯТИЕ!
                    const nextCaptures = getGladiatorAvailableMoves(bestMove.row, bestMove.col, 2)
                        .filter(m => m.isCapture);
                    
                    if (nextCaptures.length > 0) {
                        // Бот продолжает взятие немедленно
                        const nextMove = selectBestBotMove(nextCaptures, bestMove.row, bestMove.col, newKey);
                        if (nextMove) {
                            setTimeout(() => {
                                // Имитируем еще один ход бота с взятием
                                gladiatorBoard[bestMove.row][bestMove.col] = 0;
                                gladiatorBoard[nextMove.row][nextMove.col] = 2;
                                
                                const nextKey = `${nextMove.row}-${nextMove.col}`;
                                if (botBuffs[newKey]) {
                                    botBuffs[nextKey] = { ...botBuffs[newKey] };
                                    delete botBuffs[newKey];
                                }
                                
                                const captured2 = gladiatorBoard[nextMove.captureRow][nextMove.captureCol];
                                gladiatorBoard[nextMove.captureRow][nextMove.captureCol] = 0;
                                
                                if (captured2 === 1) {
                                    playerAlive = false;
                                    showNotification('⚔️ Ваша шашка была взята ботом повторно!', 'error');
                                } else if (captured2 === 2) {
                                    if (botsAlive > 0) botsAlive--;
                                    const capturedKey2 = `${nextMove.captureRow}-${nextMove.captureCol}`;
                                    if (botBuffs[capturedKey2]) delete botBuffs[capturedKey2];
                                    
                                    awardTrophy(2, nextMove.row, nextMove.col);
                                }
                                
                                boardState = gladiatorBoard;
                                updateBoardUI();
                                movesMade++;
                                botIndex++;
                                setTimeout(() => {
                                    makeNextBotMove();
                                }, 200);
                            }, 200);
                            return;
                        }
                    }
                }
                
                if (isInDangerZone(bestMove.row, bestMove.col)) {
                    const hasImmunity = botBuffs[newKey] && botBuffs[newKey].trophy > 0;
                    
                    if (!hasImmunity) {
                        if (botsAlive > 0) botsAlive--;
                        gladiatorBoard[bestMove.row][bestMove.col] = 0;
                        if (botBuffs[newKey]) delete botBuffs[newKey];
                        showNotification(`🔥 Бот уничтожен красной зоной! Осталось ботов: ${botsAlive}`);
                    } else {
                        botUseTrophy(newKey);
                    }
                }
                
                boardState = gladiatorBoard;
                updateBoardUI();
                movesMade++;
                
                // Если у бота был фиолетовый бафф, он может сделать дополнительный ход
                if (hadPurpleBuff && botUsePurpleSupply(newKey)) {
                    // Остаемся на том же боте для дополнительного хода
                    setTimeout(() => {
                        makeNextBotMove();
                    }, 200);
                    return;
                } else {
                    botIndex++;
                    setTimeout(() => {
                        makeNextBotMove();
                    }, 200);
                }
            } else {
                botIndex++;
                setTimeout(() => {
                    makeNextBotMove();
                }, 100);
            }
        } else {
            botIndex++;
            setTimeout(() => {
                makeNextBotMove();
            }, 100);
        }
    }
    
    makeNextBotMove();
}

function selectBestBotMove(moves, fromRow, fromCol, botKey) {
    if (moves.length === 0) return null;
    
    let bestMove = moves[0];
    let bestScore = -Infinity;
    
    moves.forEach(move => {
        let score = 0;
        
        if (move.isCapture) {
            score += 100;
            
            if (gladiatorBoard[move.captureRow] && 
                gladiatorBoard[move.captureRow][move.captureCol] === 1) {
                score += 200;
            }
            else if (gladiatorBoard[move.captureRow] && 
                     gladiatorBoard[move.captureRow][move.captureCol] === 2) {
                score += 50;
                
                const targetKey = `${move.captureRow}-${move.captureCol}`;
                if (botBuffs[targetKey] && botBuffs[targetKey].trophy > 0) {
                    score += 30;
                }
            }
        }
        
        if (!move.isCapture) {
            if (isInDangerZone(move.row, move.col) || isInWarningZone(move.row, move.col)) {
                score -= 100;
            }
        }
        
        const center = (BOARD_SIZE_GLADIATOR - 1) / 2;
        const distanceToCenter = Math.abs(move.row - center) + Math.abs(move.col - center);
        score += (BOARD_SIZE_GLADIATOR * 2 - distanceToCenter) * 2;
        
        const distanceToDanger = Math.min(
            move.row,
            BOARD_SIZE_GLADIATOR - 1 - move.row,
            move.col,
            BOARD_SIZE_GLADIATOR - 1 - move.col
        );
        score += distanceToDanger * 5;
        
        const hasBuff = activeSupplies.some(s => s.row === move.row && s.col === move.col);
        if (hasBuff) {
            const buff = activeSupplies.find(s => s.row === move.row && s.col === move.col);
            if (buff.type === 'green') score += 40;
            if (buff.type === 'purple') score += 60;
        }
        
        if (isVulnerableGladiator(move.row, move.col, 2)) {
            score -= 80;
        }
        
        // Предпочитаем ходы, которые ведут к дальнейшим взятиям
        if (move.isCapture) {
            const tempBoard = JSON.parse(JSON.stringify(gladiatorBoard));
            tempBoard[fromRow][fromCol] = 0;
            tempBoard[move.row][move.col] = 2;
            tempBoard[move.captureRow][move.captureCol] = 0;
            
            const nextCaptures = [];
            for (const dir of [{ dr: -1, dc: -1 }, { dr: -1, dc: 1 }, { dr: 1, dc: -1 }, { dr: 1, dc: 1 }]) {
                const nextCaptureRow = move.row + dir.dr;
                const nextCaptureCol = move.col + dir.dc;
                const nextJumpRow = move.row + dir.dr * 2;
                const nextJumpCol = move.col + dir.dc * 2;
                
                if (isValidGladiatorPosition(nextCaptureRow, nextCaptureCol) && 
                    isValidGladiatorPosition(nextJumpRow, nextJumpCol) &&
                    tempBoard[nextCaptureRow][nextCaptureCol] !== 0 &&
                    tempBoard[nextJumpRow][nextJumpCol] === 0) {
                    score += 30;
                }
            }
        }
        
        if (score > bestScore) {
            bestScore = score;
            bestMove = move;
        }
    });
    
    return bestMove;
}

function isVulnerableGladiator(row, col, player) {
    const enemyPlayer = player === 1 ? 2 : 1;
    const directions = [
        { dr: -1, dc: -1 },
        { dr: -1, dc: 1 },
        { dr: 1, dc: -1 },
        { dr: 1, dc: 1 }
    ];
    
    for (const dir of directions) {
        const attackRow = row - dir.dr;
        const attackCol = col - dir.dc;
        const jumpRow = row + dir.dr;
        const jumpCol = col + dir.dc;
        
        if (isValidGladiatorPosition(attackRow, attackCol) && 
            isValidGladiatorPosition(jumpRow, jumpCol) &&
            gladiatorBoard[attackRow][attackCol] === enemyPlayer &&
            gladiatorBoard[jumpRow][jumpCol] === 0) {
            return true;
        }
    }
    return false;
}

function checkGladiatorGameEnd() {
    if (!playerAlive) {
        endGladiatorGame('Вы проиграли в гладиаторской битве!');
        return;
    }
    
    if (botsAlive <= 0) {
        endGladiatorGame('🎉 Вы победили в гладиаторской битве!');
        return;
    }
    
    // Проверяем, есть ли у игрока хоть один ход
    let playerCanMove = false;
    for (let row = 0; row < BOARD_SIZE_GLADIATOR; row++) {
        for (let col = 0; col < BOARD_SIZE_GLADIATOR; col++) {
            if (gladiatorBoard[row][col] === 1) {
                const moves = getGladiatorAvailableMoves(row, col, 1);
                if (moves.length > 0) {
                    playerCanMove = true;
                    break;
                }
            }
        }
        if (playerCanMove) break;
    }
    
    if (!playerCanMove) {
        endGladiatorGame('😞 У вас не осталось ходов! Вы проиграли.');
        return;
    }
    
    // Проверяем, есть ли хоть один живой бот с ходами
    let anyBotCanMove = false;
    for (let row = 0; row < BOARD_SIZE_GLADIATOR; row++) {
        for (let col = 0; col < BOARD_SIZE_GLADIATOR; col++) {
            if (gladiatorBoard[row][col] === 2) {
                const moves = getGladiatorAvailableMoves(row, col, 2);
                if (moves.length > 0) {
                    anyBotCanMove = true;
                    break;
                }
            }
        }
        if (anyBotCanMove) break;
    }
    
    if (!anyBotCanMove && botsAlive > 0) {
        endGladiatorGame('🎉 Все оставшиеся боты заблокированы! Вы победили!');
        return;
    }
    
    updateGladiatorUI();
}

function startGladiatorRound() {
    console.log('⚔️ Начало гладиаторского раунда 32x32');
    initGladiatorBoard();
    gameActive = true;
    isPlayerTurn = true;
    hasContinuingCapture = false;
    updatePlayerCards();
    showNotification('⚔️ Гладиаторская битва 32x32 началась! Ваш ход.');
}

function endGladiatorGame(message = '') {
    gameActive = false;
    if (message) {
        document.getElementById('game-status').textContent = message;
        showNotification(message);
    }
}

// ====================================================
// ОСНОВНАЯ ИГРОВАЯ ЛОГИКА (8x8)
// ====================================================
function initBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';
    
    if (gladiatorMode) {
        currentBoardSize = BOARD_SIZE_GLADIATOR;
        boardState = gladiatorBoard;
        board.className = 'gladiator-board';
    } else {
        currentBoardSize = BOARD_SIZE_NORMAL;
        boardState = getInitialBoard();
        board.className = '';
    }
    
    for (let row = 0; row < currentBoardSize; row++) {
        for (let col = 0; col < currentBoardSize; col++) {
            const cell = document.createElement('div');
            
            let cellClass = `cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
            if (gladiatorMode) {
                if (isInDangerZone(row, col)) {
                    cellClass += ' danger-zone';
                } else if (isInWarningZone(row, col)) {
                    cellClass += ' warning-zone';
                }
            }
            
            cell.className = cellClass;
            cell.dataset.row = row;
            cell.dataset.col = col;
            
            cell.addEventListener('click', function() {
                const row = parseInt(this.dataset.row);
                const col = parseInt(this.dataset.col);
                handleCellClick(row, col);
            });
            
            const piece = boardState[row][col];
            if (piece !== 0 && (row + col) % 2 === 1) {
                const checker = document.createElement('div');
                let checkerClass = 'checker ';
                if (gladiatorMode) {
                    checkerClass += piece === 1 ? 'player1' : 'gladiator-bot';
                } else {
                    checkerClass += `player${piece === 1 || piece === 3 ? '1' : '2'}${piece > 2 ? ' king' : ''}`;
                }
                
                checker.className = checkerClass;
                checker.dataset.row = row;
                checker.dataset.col = col;
                cell.appendChild(checker);
            }
            
            board.appendChild(cell);
        }
    }
    
    if (gladiatorMode) {
        activeSupplies.forEach(supply => {
            const cell = document.querySelector(`.cell[data-row="${supply.row}"][data-col="${supply.col}"]`);
            if (cell) {
                const buff = document.createElement('div');
                buff.className = `buff ${supply.type}-supply`;
                buff.dataset.type = supply.type;
                cell.appendChild(buff);
                
                const tooltip = document.createElement('div');
                tooltip.className = 'buff-tooltip';
                if (supply.type === 'green') {
                    tooltip.textContent = 'Зеленый припас: позволяет пропустить обязательное взятие';
                } else if (supply.type === 'purple') {
                    tooltip.textContent = 'Фиолетовое снабжение: дает дополнительный ход';
                }
                buff.appendChild(tooltip);
            }
        });
    }
    
    updateGameStats();
}

function getInitialBoard() {
    const board = Array(BOARD_SIZE_NORMAL).fill().map(() => Array(BOARD_SIZE_NORMAL).fill(0));
    
    for (let row = 5; row < BOARD_SIZE_NORMAL; row++) {
        for (let col = 0; col < BOARD_SIZE_NORMAL; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = 1;
            }
        }
    }
    
    for (let row = 0; row < 3; row++) {
        for (let col = 0; col < BOARD_SIZE_NORMAL; col++) {
            if ((row + col) % 2 === 1) {
                board[row][col] = 2;
            }
        }
    }
    
    return board;
}

function handleCellClick(row, col) {
    if (!gameActive || botThinking) return;
    
    if (gladiatorMode) {
        handleGladiatorCellClick(row, col);
    } else {
        handleNormalCellClick(row, col);
    }
}

function handleGladiatorCellClick(row, col) {
    if (hasContinuingCapture) {
        if (selectedChecker && isAvailableMove(row, col)) {
            if (makeGladiatorMove(row, col)) {
                if (!hasContinuingCapture && playerAlive && botsAlive > 0) {
                    if (hasPurpleSupply && usePurpleSupply()) {
                        showNotification('💜 Вы используете фиолетовое снабжение для дополнительного хода!');
                        return;
                    }
                    isPlayerTurn = false;
                    setTimeout(() => {
                        makeGladiatorBotMoves();
                    }, 1000);
                }
            }
        } else if (gladiatorBoard[row][col] === 1) {
            showNotification('⚠️ Завершите взятие текущей шашкой!');
        }
        return;
    }
    
    if (!playerAlive || !isPlayerTurn) return;
    
    const piece = gladiatorBoard[row][col];
    
    if (piece === 1) {
        const allCaptures = [];
        
        for (let r = 0; r < BOARD_SIZE_GLADIATOR; r++) {
            for (let c = 0; c < BOARD_SIZE_GLADIATOR; c++) {
                if (gladiatorBoard[r][c] === 1) {
                    const captures = getGladiatorAvailableMoves(r, c, 1).filter(m => m.isCapture);
                    if (captures.length > 0) {
                        allCaptures.push({ row: r, col: c, captures: captures });
                    }
                }
            }
        }
        
        if (allCaptures.length > 0) {
            const capturesForThisChecker = getGladiatorAvailableMoves(row, col, 1).filter(m => m.isCapture);
            if (capturesForThisChecker.length > 0) {
                selectChecker(row, col);
            } else {
                if (greenSupplies > 0) {
                    const normalMoves = getGladiatorAvailableMoves(row, col, 1, true);
                    if (normalMoves.length > 0) {
                        if (confirm('У вас есть обязательное взятие. Использовать зеленый припас для обычного хода?')) {
                            useGreenSupply();
                            selectChecker(row, col);
                        }
                    } else {
                        showNotification('⚠️ Вы должны бить другой шашкой!');
                    }
                } else {
                    showNotification('⚠️ Вы должны бить другой шашкой!');
                }
            }
        } else {
            selectChecker(row, col);
        }
    }
    else if (selectedChecker && isAvailableMove(row, col)) {
        if (makeGladiatorMove(row, col)) {
            if (!hasContinuingCapture && playerAlive && botsAlive > 0) {
                if (hasPurpleSupply && usePurpleSupply()) {
                    showNotification('💜 Вы используете фиолетовое снабжение для дополнительного хода!');
                    return;
                }
                isPlayerTurn = false;
                setTimeout(() => {
                    makeGladiatorBotMoves();
                }, 1000);
            }
        }
    }
}

function handleNormalCellClick(row, col) {
    if (!gameActive || botThinking || currentPlayer !== 1) return;
    
    const piece = boardState[row][col];
    
    if (piece === 1 || piece === 3) {
        const allCaptures = getAllCapturesForPlayer(1);
        
        if (allCaptures.length > 0) {
            const capturesForChecker = getCapturesForChecker(row, col);
            if (capturesForChecker.length > 0) {
                selectChecker(row, col);
            } else {
                showNotification('⚠️ Вы должны бить другой шашкой!');
            }
        } else {
            selectChecker(row, col);
        }
    }
    else if (selectedChecker && isAvailableMove(row, col)) {
        makeMove(row, col);
    }
}

function selectChecker(row, col) {
    clearSelection();
    selectedChecker = { row, col };
    
    if (gladiatorMode) {
        availableMoves = getGladiatorAvailableMoves(row, col, gladiatorBoard[row][col]);
    } else {
        availableMoves = getAvailableMoves(row, col);
    }
    
    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (cell) cell.classList.add('selected');
    
    availableMoves.forEach(move => {
        const targetCell = document.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
        if (targetCell) {
            targetCell.classList.add('available');
            if (move.isCapture) targetCell.classList.add('capture');
        }
    });
}

function clearSelection() {
    document.querySelectorAll('.cell.selected').forEach(cell => cell.classList.remove('selected'));
    document.querySelectorAll('.cell.available').forEach(cell => cell.classList.remove('available', 'capture'));
    selectedChecker = null;
    availableMoves = [];
}

function getAvailableMoves(row, col) {
    const piece = boardState[row][col];
    const moves = [];
    if (piece === 0) return moves;
    
    const isKing = piece > 2;
    const player = piece === 1 || piece === 3 ? 1 : 2;
    const allCaptures = getAllCapturesForPlayer(player);
    
    if (allCaptures.length > 0) return getCapturesForChecker(row, col);
    
    if (isKing) {
        const directions = [
            { dr: -1, dc: -1 },
            { dr: -1, dc: 1 },
            { dr: 1, dc: -1 },
            { dr: 1, dc: 1 }
        ];
        
        for (const dir of directions) {
            let newRow = row + dir.dr;
            let newCol = col + dir.dc;
            
            while (isValidPosition(newRow, newCol) && boardState[newRow][newCol] === 0) {
                moves.push({ 
                    row: newRow, 
                    col: newCol, 
                    isCapture: false,
                    direction: dir
                });
                newRow += dir.dr;
                newCol += dir.dc;
            }
        }
    } else {
        const directions = [];
        if (player === 1) {
            directions.push({ dr: -1, dc: -1 });
            directions.push({ dr: -1, dc: 1 });
        } else {
            directions.push({ dr: 1, dc: -1 });
            directions.push({ dr: 1, dc: 1 });
        }
        
        for (const dir of directions) {
            const newRow = row + dir.dr;
            const newCol = col + dir.dc;
            
            if (isValidPosition(newRow, newCol) && boardState[newRow][newCol] === 0) {
                moves.push({ 
                    row: newRow, 
                    col: newCol, 
                    isCapture: false,
                    direction: dir
                });
            }
        }
    }
    
    return moves;
}

function getAllCapturesForPlayer(player) {
    const captures = [];
    
    for (let row = 0; row < currentBoardSize; row++) {
        for (let col = 0; col < currentBoardSize; col++) {
            const piece = boardState[row][col];
            if ((player === 1 && (piece === 1 || piece === 3)) || 
                (player === 2 && (piece === 2 || piece === 4))) {
                const checkerCaptures = getCapturesForChecker(row, col);
                if (checkerCaptures.length > 0) {
                    captures.push({
                        from: { row, col },
                        captures: checkerCaptures
                    });
                }
            }
        }
    }
    
    return captures;
}

function getCapturesForChecker(row, col) {
    const piece = boardState[row][col];
    const captures = [];
    if (piece === 0) return captures;
    
    const isKing = piece > 2;
    const player = piece === 1 || piece === 3 ? 1 : 2;
    const enemyPieces = player === 1 ? [2, 4] : [1, 3];
    
    if (isKing) {
        const directions = [
            { dr: -1, dc: -1 },
            { dr: -1, dc: 1 },
            { dr: 1, dc: -1 },
            { dr: 1, dc: 1 }
        ];
        
        for (const dir of directions) {
            let currentRow = row + dir.dr;
            let currentCol = col + dir.dc;
            let foundEnemy = false;
            let enemyRow = -1;
            let enemyCol = -1;
            
            while (isValidPosition(currentRow, currentCol)) {
                if (boardState[currentRow][currentCol] === 0) {
                    if (foundEnemy) {
                        captures.push({
                            row: currentRow,
                            col: currentCol,
                            isCapture: true,
                            captureRow: enemyRow,
                            captureCol: enemyCol,
                            isKingCapture: true,
                            direction: dir
                        });
                    }
                } else if (enemyPieces.includes(boardState[currentRow][currentCol])) {
                    if (!foundEnemy) {
                        foundEnemy = true;
                        enemyRow = currentRow;
                        enemyCol = currentCol;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
                currentRow += dir.dr;
                currentCol += dir.dc;
            }
        }
    } else {
        const directions = [
            { dr: -1, dc: -1 },
            { dr: -1, dc: 1 },
            { dr: 1, dc: -1 },
            { dr: 1, dc: 1 }
        ];
        
        for (const dir of directions) {
            const jumpRow = row + dir.dr * 2;
            const jumpCol = col + dir.dc * 2;
            const middleRow = row + dir.dr;
            const middleCol = col + dir.dc;
            
            if (isValidPosition(jumpRow, jumpCol) && 
                boardState[jumpRow][jumpCol] === 0 &&
                isValidPosition(middleRow, middleCol)) {
                
                const middlePiece = boardState[middleRow][middleCol];
                if (enemyPieces.includes(middlePiece)) {
                    captures.push({ 
                        row: jumpRow, 
                        col: jumpCol, 
                        isCapture: true,
                        captureRow: middleRow,
                        captureCol: middleCol,
                        direction: dir
                    });
                }
            }
        }
    }
    
    return captures;
}

function isAvailableMove(row, col) {
    return availableMoves.some(move => move.row === row && move.col === col);
}

function isValidPosition(row, col) {
    return row >= 0 && row < currentBoardSize && col >= 0 && col < currentBoardSize;
}

function isValidGladiatorPosition(row, col) {
    return row >= 0 && row < BOARD_SIZE_GLADIATOR && col >= 0 && col < BOARD_SIZE_GLADIATOR;
}

function makeMove(toRow, toCol) {
    if (!selectedChecker) return;
    
    const move = availableMoves.find(m => m.row === toRow && m.col === toCol);
    if (!move) return;
    
    const { row: fromRow, col: fromCol } = selectedChecker;
    const piece = boardState[fromRow][fromCol];
    
    boardState[fromRow][fromCol] = 0;
    boardState[toRow][toCol] = piece;
    
    if (move.isCapture) {
        boardState[move.captureRow][move.captureCol] = 0;
        
        const newCaptures = getCapturesForChecker(toRow, toCol);
        const canContinueCapture = newCaptures.length > 0;
        
        if (canContinueCapture) {
            selectedChecker = { row: toRow, col: toCol };
            availableMoves = newCaptures;
            updateBoardUI();
            highlightAvailableMoves();
            showNotification('⚠️ Продолжайте взятие!');
            
            // Если это бот, то он должен продолжить взятие
            if (currentPlayer === 2 && gameActive && !botThinking) {
                setTimeout(() => {
                    makeBotMove();
                }, 300);
            }
            return;
        }
    }
    
    if (piece === 1 && toRow === 0) {
        boardState[toRow][toCol] = 3;
        showNotification('👑 Ваша шашка стала дамкой!');
    } else if (piece === 2 && toRow === currentBoardSize - 1) {
        boardState[toRow][toCol] = 4;
    }
    
    addMoveToHistory(fromRow, fromCol, toRow, toCol, move.isCapture);
    updateBoardUI();
    clearSelection();
    
    currentPlayer = currentPlayer === 1 ? 2 : 1;
    moveCount++;
    updateGameStats();
    updatePlayerCards();
    
    if (currentPlayer === 2 && gameActive) {
        setTimeout(makeBotMove, 500);
    }
    
    checkGameEnd();
}

function highlightAvailableMoves() {
    if (!selectedChecker) return;
    
    const { row, col } = selectedChecker;
    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
    if (cell) cell.classList.add('selected');
    
    availableMoves.forEach(move => {
        const targetCell = document.querySelector(`.cell[data-row="${move.row}"][data-col="${move.col}"]`);
        if (targetCell) {
            targetCell.classList.add('available');
            if (move.isCapture) targetCell.classList.add('capture');
        }
    });
}

function updateBoardUI() {
    const cells = document.querySelectorAll('.cell');
    cells.forEach(cell => {
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        const piece = boardState[row][col];
        
        let cellClass = `cell ${(row + col) % 2 === 0 ? 'light' : 'dark'}`;
        if (gladiatorMode) {
            if (isInDangerZone(row, col)) {
                cellClass += ' danger-zone';
            } else if (isInWarningZone(row, col)) {
                cellClass += ' warning-zone';
            }
        }
        cell.className = cellClass;
        
        const oldChecker = cell.querySelector('.checker');
        if (oldChecker) oldChecker.remove();
        
        const oldBuff = cell.querySelector('.buff');
        if (oldBuff) oldBuff.remove();
        
        if (piece !== 0 && (row + col) % 2 === 1) {
            const checker = document.createElement('div');
            if (gladiatorMode) {
                checker.className = `checker ${piece === 1 ? 'player1' : 'gladiator-bot'}`;
            } else {
                const isKing = piece > 2;
                checker.className = `checker player${piece === 1 || piece === 3 ? '1' : '2'}${isKing ? ' king' : ''}`;
            }
            
            checker.dataset.row = row;
            checker.dataset.col = col;
            cell.appendChild(checker);
        }
    });
    
    if (gladiatorMode) {
        activeSupplies.forEach(supply => {
            const cell = document.querySelector(`.cell[data-row="${supply.row}"][data-col="${supply.col}"]`);
            if (cell && !cell.querySelector('.checker')) {
                const buff = document.createElement('div');
                buff.className = `buff ${supply.type}-supply`;
                buff.dataset.type = supply.type;
                cell.appendChild(buff);
                
                const tooltip = document.createElement('div');
                tooltip.className = 'buff-tooltip';
                if (supply.type === 'green') {
                    tooltip.textContent = 'Зеленый припас: позволяет пропустить обязательное взятие';
                } else if (supply.type === 'purple') {
                    tooltip.textContent = 'Фиолетовое снабжение: дает дополнительный ход';
                }
                buff.appendChild(tooltip);
            }
        });
    }
}

function updateGameStats() {
    if (gladiatorMode) {
        updateGladiatorUI();
        return;
    }
    
    let player1Pieces = 0;
    let player2Pieces = 0;
    let kingsCount = 0;
    
    for (let row = 0; row < currentBoardSize; row++) {
        for (let col = 0; col < currentBoardSize; col++) {
            const piece = boardState[row][col];
            if (piece === 1 || piece === 3) {
                player1Pieces++;
                if (piece === 3) kingsCount++;
            }
            if (piece === 2 || piece === 4) {
                player2Pieces++;
                if (piece === 4) kingsCount++;
            }
        }
    }
    
    document.getElementById('move-count').textContent = moveCount;
    document.getElementById('player1-pieces').textContent = player1Pieces;
    document.getElementById('player2-pieces').textContent = player2Pieces;
    document.getElementById('kings-count').textContent = kingsCount;
}

function addMoveToHistory(fromRow, fromCol, toRow, toCol, isCapture) {
    const movesHistory = document.getElementById('moves-history');
    const player = (currentPlayer === 1) ? 'Игрок' : 'Бот'; 
    const moveNumber = Math.ceil((moveCount + 1) / 2);
    const fromNotation = `${String.fromCharCode(97 + fromCol)}${currentBoardSize - fromRow}`;
    const toNotation = `${String.fromCharCode(97 + toCol)}${currentBoardSize - toRow}`;
    
    const moveElement = document.createElement('div');
    moveElement.className = 'move-item';
    moveElement.innerHTML = `
        <strong>${moveNumber}. ${player}:</strong> ${fromNotation} → ${toNotation} ${isCapture ? '✗' : ''}
    `;
    
    movesHistory.appendChild(moveElement);
    movesHistory.scrollTop = movesHistory.scrollHeight;
}

function updatePlayerCards() {
    const player1Card = document.getElementById('player1-card');
    const player2Card = document.getElementById('player2-card');
    
    player1Card.classList.remove('active');
    player2Card.classList.remove('active');
    
    if (gladiatorMode) {
        if (isPlayerTurn && playerAlive) {
            player1Card.classList.add('active');
            document.getElementById('game-status').textContent = hasContinuingCapture ? 'Продолжайте взятие!' : 'Ваш ход';
        } else {
            player2Card.classList.add('active');
            document.getElementById('game-status').textContent = 'Ход ботов...';
        }
    } else {
        if (currentPlayer === 1) {
            player1Card.classList.add('active');
            document.getElementById('game-status').textContent = 'Ваш ход';
        } else {
            player2Card.classList.add('active');
            document.getElementById('game-status').textContent = 'Ход бота...';
        }
    }
}

function startNewGame() {
    if (gameMode === 'rating' && gameActive) {
        if (!confirm('Вы находитесь в рейтинговой игре. Если вы начнете новую игру, текущая игра будет засчитана как поражение. Продолжить?')) {
            return;
        }
        endGame(2, true); // поражение при начале новой игры
    }
    
    console.log('🆕 Начало новой игры');
    
    if (gladiatorMode) {
        startGladiatorRound();
        return;
    }
    
    boardState = getInitialBoard();
    currentPlayer = 1;
    gameActive = true;
    selectedChecker = null;
    availableMoves = [];
    moveCount = 0;
    
    updatePlayerCards();
    updateGameStats();
    document.getElementById('moves-history').innerHTML = '';
    document.getElementById('game-status').textContent = 'Игра началась! Ваш ход';
    initBoard();
    
    if (Math.random() < 0.5) {
        currentPlayer = 2;
        updatePlayerCards();
        document.getElementById('game-status').textContent = 'Бот ходит первым...';
        setTimeout(makeBotMove, 1000);
    }
}

function makeBotMove() {
    if (!gameActive || currentPlayer !== 2 || botThinking) return;
    
    botThinking = true;
    
    // Если есть продолжение взятия, используем доступные ходы
    if (selectedChecker && availableMoves.length > 0) {
        const difficulty = document.getElementById('botDifficulty').value;
        const move = getBestContinueMove(availableMoves, difficulty);
        setTimeout(() => {
            makeMove(move.row, move.col);
            botThinking = false;
        }, 300);
        return;
    }
    
    const difficulty = document.getElementById('botDifficulty').value;
    
    const allMoves = [];
    const allCaptures = getAllCapturesForPlayer(2);
    
    if (allCaptures.length > 0) {
        allCaptures.forEach(captureData => {
            captureData.captures.forEach(capture => {
                allMoves.push({
                    from: captureData.from,
                    to: { row: capture.row, col: capture.col },
                    isCapture: true,
                    captureData: capture,
                    score: 0
                });
            });
        });
    } else {
        for (let row = 0; row < currentBoardSize; row++) {
            for (let col = 0; col < currentBoardSize; col++) {
                if (boardState[row][col] === 2 || boardState[row][col] === 4) {
                    const moves = getAvailableMoves(row, col);
                    moves.forEach(move => {
                        allMoves.push({
                            from: { row, col },
                            to: { row: move.row, col: move.col },
                            isCapture: move.isCapture,
                            moveData: move,
                            score: 0
                        });
                    });
                }
            }
        }
    }
    
    if (allMoves.length === 0) {
        botThinking = false;
        currentPlayer = 1;
        updatePlayerCards();
        document.getElementById('game-status').textContent = 'У бота нет ходов! Ваш ход';
        checkGameEnd();
        return;
    }
    
    let selectedMove;
    switch(difficulty) {
        case 'easy': selectedMove = getEasyMove(allMoves); break;
        case 'medium': selectedMove = getMediumMove(allMoves); break;
        case 'hard': selectedMove = getHardMove(allMoves); break;
        case 'expert': selectedMove = getExpertMove(allMoves); break;
    }
    
    setTimeout(() => {
        selectChecker(selectedMove.from.row, selectedMove.from.col);
        setTimeout(() => {
            makeMove(selectedMove.to.row, selectedMove.to.col);
            botThinking = false;
        }, 300);
    }, 500);
}

function getBestContinueMove(moves, difficulty) {
    // Для продолжения взятия выбираем лучший ход
    // Бот должен брать максимальное количество шашек
    
    if (moves.length === 0) return null;
    
    let bestMove = moves[0];
    let maxChainLength = 0;
    
    // Проверяем, какой ход ведет к самой длинной цепочке взятий
    for (const move of moves) {
        // Создаем временную доску для симуляции
        const tempBoard = JSON.parse(JSON.stringify(boardState));
        const tempSelectedChecker = { row: selectedChecker.row, col: selectedChecker.col };
        
        // Выполняем текущий ход
        tempBoard[tempSelectedChecker.row][tempSelectedChecker.col] = 0;
        tempBoard[move.row][move.col] = boardState[tempSelectedChecker.row][tempSelectedChecker.col];
        if (move.isCapture) {
            tempBoard[move.captureRow][move.captureCol] = 0;
        }
        
        // Рекурсивно ищем дальнейшие взятия
        function findCaptureChain(row, col, depth) {
            const captures = getCapturesForCheckerFromBoard(tempBoard, row, col, boardState[row][col]);
            if (captures.length === 0) return depth;
            
            let maxDepth = depth;
            for (const capture of captures) {
                // Сохраняем состояние
                const savedBoard = JSON.parse(JSON.stringify(tempBoard));
                
                // Выполняем взятие
                tempBoard[row][col] = 0;
                tempBoard[capture.row][capture.col] = savedBoard[row][col];
                tempBoard[capture.captureRow][capture.captureCol] = 0;
                
                // Рекурсивно продолжаем
                const chainDepth = findCaptureChain(capture.row, capture.col, depth + 1);
                maxDepth = Math.max(maxDepth, chainDepth);
                
                // Восстанавливаем состояние для проверки следующего варианта
                for (let r = 0; r < currentBoardSize; r++) {
                    for (let c = 0; c < currentBoardSize; c++) {
                        tempBoard[r][c] = savedBoard[r][c];
                    }
                }
            }
            return maxDepth;
        }
        
        const chainLength = findCaptureChain(move.row, move.col, 1);
        
        if (chainLength > maxChainLength) {
            maxChainLength = chainLength;
            bestMove = move;
        }
    }
    
    return bestMove;
}

function getCapturesForCheckerFromBoard(board, row, col, piece) {
    const captures = [];
    if (piece === 0) return captures;
    
    const isKing = piece > 2;
    const player = piece === 1 || piece === 3 ? 1 : 2;
    const enemyPieces = player === 1 ? [2, 4] : [1, 3];
    
    if (isKing) {
        const directions = [
            { dr: -1, dc: -1 },
            { dr: -1, dc: 1 },
            { dr: 1, dc: -1 },
            { dr: 1, dc: 1 }
        ];
        
        for (const dir of directions) {
            let currentRow = row + dir.dr;
            let currentCol = col + dir.dc;
            let foundEnemy = false;
            let enemyRow = -1;
            let enemyCol = -1;
            
            while (isValidPosition(currentRow, currentCol)) {
                if (board[currentRow][currentCol] === 0) {
                    if (foundEnemy) {
                        captures.push({
                            row: currentRow,
                            col: currentCol,
                            isCapture: true,
                            captureRow: enemyRow,
                            captureCol: enemyCol,
                            isKingCapture: true,
                            direction: dir
                        });
                    }
                } else if (enemyPieces.includes(board[currentRow][currentCol])) {
                    if (!foundEnemy) {
                        foundEnemy = true;
                        enemyRow = currentRow;
                        enemyCol = currentCol;
                    } else {
                        break;
                    }
                } else {
                    break;
                }
                currentRow += dir.dr;
                currentCol += dir.dc;
            }
        }
    } else {
        const directions = [
            { dr: -1, dc: -1 },
            { dr: -1, dc: 1 },
            { dr: 1, dc: -1 },
            { dr: 1, dc: 1 }
        ];
        
        for (const dir of directions) {
            const jumpRow = row + dir.dr * 2;
            const jumpCol = col + dir.dc * 2;
            const middleRow = row + dir.dr;
            const middleCol = col + dir.dc;
            
            if (isValidPosition(jumpRow, jumpCol) && 
                board[jumpRow][jumpCol] === 0 &&
                isValidPosition(middleRow, middleCol)) {
                
                const middlePiece = board[middleRow][middleCol];
                if (enemyPieces.includes(middlePiece)) {
                    captures.push({ 
                        row: jumpRow, 
                        col: jumpCol, 
                        isCapture: true,
                        captureRow: middleRow,
                        captureCol: middleCol,
                        direction: dir
                    });
                }
            }
        }
    }
    
    return captures;
}

function getEasyMove(moves) {
    return moves[Math.floor(Math.random() * moves.length)];
}

function getMediumMove(moves) {
    moves.forEach(move => {
        let score = 0;
        if (move.isCapture) {
            score += 15;
            const capturedPiece = boardState[move.captureData.captureRow][move.captureData.captureCol];
            if (capturedPiece === 3 || capturedPiece === 4) score += 10;
        }
        
        if (boardState[move.from.row][move.from.col] === 2) {
            if (move.to.row > move.from.row) score += 5;
            if (move.to.row === currentBoardSize - 1) score += 20;
        }
        
        const centerDistance = Math.abs(move.to.col - (currentBoardSize-1)/2) + Math.abs(move.to.row - (currentBoardSize-1)/2);
        score += (currentBoardSize - centerDistance) * 0.5;
        move.score = score;
    });
    
    return moves.reduce((best, current) => current.score > best.score ? current : best, moves[0]);
}

function getHardMove(moves) {
    moves.forEach(move => {
        let score = 0;
        const piece = boardState[move.from.row][move.from.col];
        
        if (move.isCapture) {
            score += 20;
            const capturedPiece = boardState[move.captureData.captureRow][move.captureData.captureCol];
            if (capturedPiece === 3 || capturedPiece === 4) score += 15;
            
            const tempBoard = JSON.parse(JSON.stringify(boardState));
            tempBoard[move.from.row][move.from.col] = 0;
            tempBoard[move.to.row][move.to.col] = piece;
            tempBoard[move.captureData.captureRow][move.captureData.captureCol] = 0;
            
            const nextCaptures = getCapturesForChecker(move.to.row, move.to.col);
            if (nextCaptures.length > 0) score += 25;
        }
        
        if (piece === 2 && move.to.row === currentBoardSize - 1) score += 30;
        if (piece === 4) {
            const centerDistance = Math.abs(move.to.col - (currentBoardSize-1)/2) + Math.abs(move.to.row - (currentBoardSize-1)/2);
            score += (currentBoardSize - centerDistance) * 2;
        } else {
            if (move.to.row > move.from.row) score += 8;
        }
        
        if (isVulnerable(move.to.row, move.to.col, 2)) score -= 15;
        if (checkProtection(boardState, move.to.row, move.to.col, 2)) score += 5;
        move.score = score;
    });
    
    return moves.reduce((best, current) => current.score > best.score ? current : best, moves[0]);
}

function getExpertMove(moves) {
    moves.forEach(move => {
        let score = 0;
        const piece = boardState[move.from.row][move.from.col];
        
        if (move.isCapture) {
            score += 25;
            const capturedPiece = boardState[move.captureData.captureRow][move.captureData.captureCol];
            if (capturedPiece === 3 || capturedPiece === 4) score += 20;
            
            const tempBoard = JSON.parse(JSON.stringify(boardState));
            tempBoard[move.from.row][move.from.col] = 0;
            tempBoard[move.to.row][move.to.col] = piece;
            tempBoard[move.captureData.captureRow][move.captureData.captureCol] = 0;
            
            const nextCaptures = getCapturesForChecker(move.to.row, move.to.col);
            if (nextCaptures.length > 0) {
                score += 35;
                let maxCaptureScore = 0;
                nextCaptures.forEach(capture => {
                    let captureScore = 10;
                    if (tempBoard[capture.captureRow] && tempBoard[capture.captureRow][capture.captureCol]) {
                        const captured = tempBoard[capture.captureRow][capture.captureCol];
                        if (captured === 3 || captured === 4) captureScore += 15;
                    }
                    maxCaptureScore = Math.max(maxCaptureScore, captureScore);
                });
                score += maxCaptureScore;
            }
        }
        
        if (piece === 2 && move.to.row === currentBoardSize - 1) score += 40;
        if (piece === 4) {
            const centerDistance = Math.abs(move.to.col - (currentBoardSize-1)/2) + Math.abs(move.to.row - (currentBoardSize-1)/2);
            score += (currentBoardSize - centerDistance) * 3;
            if (Math.abs(move.to.row - (currentBoardSize-1)/2) <= 2 && Math.abs(move.to.col - (currentBoardSize-1)/2) <= 2) score += 15;
        } else {
            if (move.to.row > move.from.row) score += 10;
            if (checkProtection(boardState, move.to.row, move.to.col, 2)) score += 8;
        }
        
        if (isVulnerable(move.to.row, move.to.col, 2)) score -= 25;
        if (gameMode === 'normal' || gameMode === 'rating') {
            for (let dr = -1; dr <= 1; dr += 2) {
                for (let dc = -1; dc <= 1; dc += 2) {
                    const checkRow = move.to.row + dr;
                    const checkCol = move.to.col + dc;
                    if (isValidPosition(checkRow, checkCol)) {
                        if (boardState[checkRow][checkCol] === 1) score += 5;
                    }
                }
            }
        }
        move.score = score;
    });
    
    return moves.reduce((best, current) => current.score > best.score ? current : best, moves[0]);
}

function checkProtection(board, row, col, player) {
    const directions = [
        { dr: -1, dc: -1 },
        { dr: -1, dc: 1 },
        { dr: 1, dc: -1 },
        { dr: 1, dc: 1 }
    ];
    const pieceType = player === 2 ? [2, 4] : [1, 3];
    
    for (const dir of directions) {
        const backRow = row - dir.dr;
        const backCol = col - dir.dc;
        if (isValidPosition(backRow, backCol) && pieceType.includes(board[backRow][backCol])) {
            return true;
        }
    }
    return false;
}

function isVulnerable(row, col, player) {
    const enemyPlayer = player === 1 ? 2 : 1;
    const enemyPieces = enemyPlayer === 1 ? [1, 3] : [2, 4];
    const directions = [
        { dr: -1, dc: -1 },
        { dr: -1, dc: 1 },
        { dr: 1, dc: -1 },
        { dr: 1, dc: 1 }
    ];
    
    for (const dir of directions) {
        const attackRow = row - dir.dr;
        const attackCol = col - dir.dc;
        const jumpRow = row + dir.dr;
        const jumpCol = col + dir.dc;
        
        if (isValidPosition(attackRow, attackCol) && 
            isValidPosition(jumpRow, jumpCol) &&
            enemyPieces.includes(boardState[attackRow][attackCol]) &&
            boardState[jumpRow][jumpCol] === 0) {
            return true;
        }
    }
    return false;
}

function checkGameEnd() {
    let playerHasMoves = false;
    let enemyHasMoves = false;
    let playerHasPieces = false;
    let enemyHasPieces = false;
    
    const currentPlayerPieces = (currentPlayer === 1) ? [1, 3] : [2, 4];
    const enemyPlayerPieces = (currentPlayer === 1) ? [2, 4] : [1, 3];
    
    for (let row = 0; row < currentBoardSize; row++) {
        for (let col = 0; col < currentBoardSize; col++) {
            const piece = boardState[row][col];
            if (currentPlayerPieces.includes(piece)) {
                playerHasPieces = true;
                if (getAvailableMoves(row, col).length > 0) {
                    playerHasMoves = true;
                }
            }
            if (enemyPlayerPieces.includes(piece)) {
                enemyHasPieces = true;
                const moves = getAvailableMoves(row, col);
                if (moves.length > 0) {
                    enemyHasMoves = true;
                }
            }
        }
    }
    
    if (gameMode === 'giveaway') {
        if (!playerHasPieces) endGame(currentPlayer);
        else if (!enemyHasPieces) endGame(currentPlayer === 1 ? 2 : 1);
        else if (!playerHasMoves) endGame(currentPlayer);
        else if (!enemyHasMoves) endGame(currentPlayer === 1 ? 2 : 1);
    } else {
        if (!playerHasPieces || !playerHasMoves) endGame(currentPlayer === 1 ? 2 : 1);
        else if (!enemyHasPieces || !enemyHasMoves) endGame(currentPlayer);
    }
}

function endGame(result, manualEnd = false) {
    gameActive = false;
    let message = '';
    let gameResult = '';
    
    if (gameMode === 'giveaway') {
        if (result === 1) {
            message = '🎉 Вы отдали все шашки первым! Победа в поддавки!';
            gameResult = 'win';
        } else {
            message = '😞 Бот отдал все шашки первым! Вы проиграли в поддавки.';
            gameResult = 'loss';
        }
    } else if (gameMode === 'rating') {
        if (result === 1) {
            message = '🎉 Вы победили в рейтинговой игре!';
            gameResult = 'win';
        } else {
            message = manualEnd ? '⚠️ Вы сдались или прервали рейтинговую игру!' : '😞 Вы проиграли в рейтинговой игре';
            gameResult = 'loss';
        }
    } else {
        if (result === 1) {
            message = '🎉 Вы победили!';
            gameResult = 'win';
        } else {
            message = '😞 Бот победил';
            gameResult = 'loss';
        }
    }
    
    document.getElementById('game-status').textContent = message;
    if (currentUser) updateUserStats(gameResult);
    if (currentUser && gameMode === 'rating') updateRating(gameResult);
    showNotification(message);
}

function surrender() {
    if (!gameActive) return;
    if (confirm('Вы уверены, что хотите сдаться?')) endGame(2, true);
}

function showRules() {
    const rules = `
        📜 Правила русских шашек:
        
        8x8 режимы (Обычные, Поддавки, Рейтинг):
        1. Шашки ходят по диагонали на одну клетку вперед
        2. Дамки ходят на любое количество клеток по диагонали
        3. Если есть возможность бить - вы обязаны бить
        4. Бить можно и вперед, и назад
        5. Дамка может бить на любое расстояние
        6. При достижении последней горизонтали шашка становится дамкой
        7. При взятии можно продолжать бить дальше
        8. Шашки стоят только на черных клетках!
        
        Режим "Поддавки":
        - Цель игры - избавиться от ВСЕХ своих шашек ПЕРВЫМ
        - Побеждает тот, кто первым остался без шашек
        
        ⚔️ Гладиаторский режим 32x32:
        - 1 игрок против 23 ботов по краям доски
        - Все шашки спавнятся на черных клетках границ
        - Между шашками расстояние минимум 5 клеток
        - Все ходят только по диагонали (как обычные шашки)
        - Боты могут бить друг друга
        - Каждые 3 хода красная зона расширяется от границ к центру
        - За 1 ход до расширения зона становится желтой (предупреждение)
        - В красную и желтую зоны нельзя заходить (НО можно бить через них!)
        - Если зайти в красную зону - шашка немедленно уничтожается
        - Если игрок/бот не может ходить - пропускает ход
        - Побеждает последний выживший
        
        🎁 Система баффов в гладиаторском режиме:
        
        1. 💚 Зеленый припас (40-50 штук на карте):
           - Позволяет пропустить обязательное взятие
           - Можно копить несколько штук
           - Подбирается при заходе на клетку
        
        2. 💜 Фиолетовое снабжение (появляется каждые 3 хода игрока):
           - Дает возможность сделать два хода подряд
           - Не копится (можно иметь только одно)
           - Автоматически используется при получении
        
        3. 🏆 Трофей (автоматически за взятие врага):
           - Дает иммунитет к красной зоне на 1 ход
           - Автоматически активируется при опасности
           - Можно копить несколько штук
        
        🤖 ИИ ботов:
        - Боты также подбирают и используют баффы
        - Стремятся к зеленым и фиолетовым баффам
        - Используют трофеи для защиты от красной зоны
        - Могут пропустить взятие, если есть зеленый припас
        - Могут продолжать взятие несколько раз подряд
        
        Рейтинговая система:
        - Начальный рейтинг: 1000
        - Рейтинг меняется ТОЛЬКО в рейтинговом режиме
        - В рейтинговом режиме всегда игра против эксперта
        - При смене режима или начале новой игры до окончания партии засчитается поражение
        
        🏆 Лидерборд:
        - Отображает топ-20 игроков по рейтингу
        - Обновляется автоматически
        
        Удачи в игре! 🎮
    `;
    alert(rules);
}

function updateBotLevel() {
    const difficulty = document.getElementById('botDifficulty').value;
    let levelName = '';
    switch(difficulty) {
        case 'easy': levelName = 'Легкий'; break;
        case 'medium': levelName = 'Средний'; break;
        case 'hard': levelName = 'Сложный'; break;
        case 'expert': levelName = 'Эксперт'; break;
    }
    document.getElementById('player2-rating').textContent = `Уровень: ${levelName}`;
    showNotification(`✅ Уровень бота изменен на: ${levelName}`);
}

// ====================================================
// ЧАТ
// ====================================================
async function sendMessage() {
    const messageInput = document.getElementById('message');
    const message = messageInput.value.trim();
    
    if (!message) {
        showNotification('⚠️ Введите сообщение');
        return;
    }
    
    if (!currentUser) {
        showNotification('⚠️ Сначала войдите в систему');
        return;
    }
    
    if (message.length > 200) {
        showNotification('⚠️ Сообщение слишком длинное (макс. 200 символов)');
        return;
    }
    
    const now = Date.now();
    const timeSinceLastMessage = (now - lastMessageTime) / 1000;
    
    if (timeSinceLastMessage < chatCooldown && lastMessageTime !== 0) {
        const timeLeft = Math.ceil(chatCooldown - timeSinceLastMessage);
        messageInput.placeholder = `Подождите ${timeLeft} секунд...`;
        messageInput.style.borderColor = '#ffcc00';
        messageInput.style.boxShadow = '0 0 0 3px rgba(255, 204, 0, 0.2)';
        
        const cooldownMsg = document.getElementById('chat-cooldown');
        const cooldownTimer = document.getElementById('cooldown-timer');
        if (cooldownMsg && cooldownTimer) {
            cooldownMsg.style.display = 'block';
            cooldownTimer.textContent = timeLeft;
        }
        
        const sendBtn = document.querySelector('#message-input button');
        sendBtn.style.background = 'linear-gradient(90deg, #666, #888)';
        sendBtn.style.cursor = 'not-allowed';
        
        const interval = setInterval(() => {
            const currentTimeLeft = Math.ceil(chatCooldown - ((Date.now() - lastMessageTime) / 1000));
            if (currentTimeLeft > 0) {
                messageInput.placeholder = `Подождите ${currentTimeLeft} секунд...`;
                if (cooldownTimer) cooldownTimer.textContent = currentTimeLeft;
            } else {
                clearInterval(interval);
                messageInput.placeholder = 'Напишите сообщение...';
                messageInput.style.borderColor = '#444';
                messageInput.style.boxShadow = 'none';
                sendBtn.style.background = '';
                sendBtn.style.cursor = '';
                if (cooldownMsg) cooldownMsg.style.display = 'none';
            }
        }, 1000);
        return;
    }
    
    try {
        await database.ref('chat').push().set({
            senderId: currentUser.uid,
            senderName: currentUser.username,
            message: message,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            type: 'user',
            isAdmin: currentUser.isAdmin || false
        });
        
        messageInput.value = '';
        messageInput.placeholder = 'Напишите сообщение...';
        messageInput.style.borderColor = '#444';
        messageInput.style.boxShadow = 'none';
        lastMessageTime = now;
        document.getElementById('chat-cooldown').style.display = 'none';
    } catch (error) {
        console.error('❌ Ошибка отправки сообщения:', error);
        showNotification('❌ Ошибка отправки сообщения');
    }
}

function updateChat(messages) {
    const chatMessages = document.getElementById('chat-messages');
    if (!chatMessages) return;
    
    const messagesArray = Object.entries(messages || {})
        .map(([id, msg]) => ({ id, ...msg }))
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    
    chatMessages.innerHTML = '';
    
    messagesArray.forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message' + (msg.isAdmin ? ' admin' : '');
        
        const time = msg.timestamp ? new Date(msg.timestamp) : new Date();
        const timeString = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let senderName = msg.senderName || 'Неизвестный';
        if (msg.isAdmin) senderName += ' 👑';
        
        messageDiv.innerHTML = `
            <div class="sender">${senderName}:</div>
            <span>${msg.message || ''}</span>
            <span class="time">${timeString}</span>
            ${currentUser?.isAdmin ? `<button class="delete-btn" onclick="deleteMessage('${msg.id}')">×</button>` : ''}
        `;
        
        chatMessages.appendChild(messageDiv);
    });
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// ====================================================
// РЕЙТИНГОВАЯ СИСТЕМА
// ====================================================
async function updateRating(gameResult) {
    if (!currentUser) return;
    
    try {
        const userRef = database.ref('users/' + currentUser.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};
        
        let userRating = userData.rating || 1000;
        let userCalibrationGames = userData.calibrationGames || 0;
        let userCalibrationCompleted = userData.calibrationCompleted || true;
        let userRatingHistory = userData.ratingHistory || [];
        let userLastRatingReset = userData.lastRatingReset || null;
        
        let result = 0;
        if (gameResult === 'win') result = 1;
        else if (gameResult === 'draw') result = 0.5;
        
        let newRating;
        let ratingChange;
        
        // Все пользователи теперь начинают с рейтинга 1000 и калибровка завершена
        const expectedScore = 1 / (1 + Math.pow(10, (2000 - userRating) / 400));
        const kFactor = calculateKFactor(userRating);
        ratingChange = Math.round(kFactor * (result - expectedScore));
        newRating = userRating + ratingChange;
        if (newRating < 1000) newRating = 1000;
        if (newRating > 4000) newRating = 4000;
        
        userRatingHistory.push({
            rating: Math.round(newRating),
            change: ratingChange,
            timestamp: firebase.database.ServerValue.TIMESTAMP,
            result: gameResult,
            mode: gameMode
        });
        
        if (userRatingHistory.length > 100) userRatingHistory = userRatingHistory.slice(-100);
        
        await userRef.update({
            rating: Math.round(newRating),
            ratingHistory: userRatingHistory
        });
        
        currentUser.rating = Math.round(newRating);
        updateUserUI();
        
        if (ratingChange > 0) {
            showNotification(`📈 Рейтинг +${ratingChange} = ${Math.round(newRating)}`);
        } else if (ratingChange < 0) {
            showNotification(`📉 Рейтинг ${ratingChange} = ${Math.round(newRating)}`);
        } else {
            showNotification(`📊 Рейтинг не изменился: ${Math.round(newRating)}`);
        }
        
        // Обновляем лидерборд после изменения рейтинга
        updateLeaderboard();
        
    } catch (error) {
        console.error('❌ Ошибка обновления рейтинга:', error);
    }
}

function calculateKFactor(currentRating) {
    if (currentRating < 1500) return 32;
    if (currentRating < 2000) return 24;
    if (currentRating < 2500) return 16;
    return 8;
}

function updateCalibrationInfo() {
    if (!currentUser) return;
    const calibrationInfo = document.getElementById('calibrationInfo');
    if (!calibrationInfo) return;
    
    if (!currentUser.calibrationCompleted && currentUser.calibrationGames < 3) {
        calibrationInfo.textContent = `Калибровка: ${currentUser.calibrationGames || 0}/3 игр`;
        calibrationInfo.style.display = 'block';
    } else if (!currentUser.calibrationCompleted) {
        calibrationInfo.textContent = 'Калибровка завершена';
        calibrationInfo.style.display = 'block';
    } else {
        calibrationInfo.style.display = 'none';
    }
}

// ====================================================
// ИНТЕРФЕЙС ПОЛЬЗОВАТЕЛЯ
// ====================================================
function showAuthScreen() {
    gameActive = false;
    botThinking = false;
    
    if (chatListener) {
        chatRef.off('value', chatListener);
        chatListener = null;
    }
    
    document.getElementById('auth').style.display = 'block';
    document.getElementById('user-info-panel').style.display = 'none';
    document.getElementById('game').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'none';
    document.getElementById('buffs-panel').style.display = 'none';
    document.getElementById('leaderboard-panel').style.display = 'none';
    
    document.getElementById('login').value = '';
    document.getElementById('password').value = '';
    document.getElementById('authMessage').textContent = '';
    document.getElementById('chat-messages').innerHTML = '';
}

function showGameScreen() {
    document.getElementById('auth').style.display = 'none';
    document.getElementById('user-info-panel').style.display = 'flex';
    document.getElementById('game').style.display = 'grid';
    
    updateUserUI();
    startNewGame();
    
    if (currentUser?.isAdmin) {
        document.getElementById('adminPanelBtn').style.display = 'inline-block';
        document.getElementById('adminBadge').style.display = 'inline-block';
    }
    
    document.getElementById('message').disabled = false;
    document.querySelector('#message-input button').disabled = false;
    
    chatRef = database.ref('chat').limitToLast(50);
    chatListener = (snapshot) => {
        const messages = snapshot.val();
        updateChat(messages);
    };
    chatRef.on('value', chatListener);
}

function updateUserUI() {
    if (!currentUser) return;
    
    document.getElementById('currentUserName').textContent = currentUser.username;
    
    if (currentUser.calibrationCompleted) {
        document.getElementById('currentUserRating').textContent = currentUser.rating || 1000;
        document.getElementById('player1-rating').textContent = `Рейтинг: ${currentUser.rating || 1000}`;
    } else {
        document.getElementById('currentUserRating').textContent = 'калибровка';
        document.getElementById('player1-rating').textContent = 'Рейтинг: калибровка';
    }
    
    document.getElementById('userWins').textContent = currentUser.wins || 0;
    document.getElementById('userLosses').textContent = currentUser.losses || 0;
    document.getElementById('userDraws').textContent = currentUser.draws || 0;
    updateCalibrationInfo();
    document.getElementById('player1-name').textContent = currentUser.username;
}

async function updateUserStats(result) {
    if (!currentUser) return;
    
    try {
        const userRef = database.ref('users/' + currentUser.uid);
        const snapshot = await userRef.once('value');
        const userData = snapshot.val() || {};
        const updates = {};
        
        if (result === 'win') {
            updates.wins = (userData.wins || 0) + 1;
        } else if (result === 'loss') {
            updates.losses = (userData.losses || 0) + 1;
        } else {
            updates.draws = (userData.draws || 0) + 1;
        }
        
        await userRef.update(updates);
        Object.assign(currentUser, updates);
        
        document.getElementById('userWins').textContent = currentUser.wins || 0;
        document.getElementById('userLosses').textContent = currentUser.losses || 0;
        document.getElementById('userDraws').textContent = currentUser.draws || 0;
    } catch (error) {
        console.error('❌ Ошибка обновления статистики:', error);
    }
}

//
