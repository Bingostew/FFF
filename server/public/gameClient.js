const socket = io();
let currentRoom = '';

// --- Logging ---
function log(msg, obj = '') {
    const logDiv = document.getElementById('eventLog');
    logDiv.innerHTML += `<div>[${new Date().toLocaleTimeString()}] ${msg} ${obj ? JSON.stringify(obj) : ''}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
}

// --- HTTP Actions ---
async function createLobby() {
    const res = await fetch('/create-lobby', { method: 'POST' });
    const data = await res.json();
    document.getElementById('roomIdInput').value = data.gameId;
    log("Lobby Created:", data);
}

// --- Socket Actions ---
function joinGame() {
    const gameId = document.getElementById('roomIdInput').value;
    const playerName = document.getElementById('nameInput').value || 'Tester';
    currentRoom = gameId;
    socket.emit('join_game', { gameId, playerName });
    document.getElementById('connStatus').innerText = `Connected to ${gameId}`;
}

function placeFleets() {
    const fleetPositions = {
        alpha: { q: 0, r: 0 }, // Example positions it will change in the future when the hexes are selectable
        beta: { q: 1, r: 1 } // Example positions it will change in the future when the hexes are selectable
    };
    socket.emit('place_fleets', { gameId: currentRoom, fleetPositions });
    log("Fleets sent to server.");
}

function executeStrike() {
    const q = parseInt(document.getElementById('targetQ').value);
    const r = parseInt(document.getElementById('targetR').value);
    socket.emit('execute_strike', { gameId: currentRoom, targetHex: { q, r } });
    log(`Striking hex: ${q},${r}`);
}

function readyCheck() {
    socket.emit('ready_check', { gameId: currentRoom});
    log("Player marked as ready.");
}

// function move_fleet(fleetName, newPosition) {
    
//     log(`Moving fleet ${fleetName} to ${newPosition}`);

//     socket.emit('move_fleet', { gameId: currentRoom, fleetName, newPosition });
// }

// --- Listeners ---
socket.on('room_update', (data) => log("Room Update:", data));
socket.on('opponent_ready', () => log("Alert: Opponent has placed ships!"));
socket.on('game_start', (data) => {
    log("GAME START! Active Player:", data);
    const statusDiv = document.getElementById('connStatus');
    if (data.activePlayer === socket.id) {
        statusDiv.innerText = "It's your turn!";
    } else {
        statusDiv.innerText = "Opponent's turn";
    }
});
socket.on('strike_result', (data) => {
    const color = data.hit ? 'red' : 'green';
    if(data.isdestroyed){
        log(`<span style="color:${orange}">💥 FLEET DESTROYED!</span>`, data);
    }else{
        log(`<span style="color:${color}">${data.hit ? '💥 HIT!' : '🌊 MISS!'}</span>`, data);
    }
    
});
socket.on('game_over', (data) => log("GAME OVER!", data));
socket.on('move_fleet', (data) => log("Fleet Moved:", data));
socket.on('error', (msg) => log("ERROR:", msg));
socket.on('turn_change', ({ activePlayer }) => {
    const statusDiv = document.getElementById('connStatus');
    if (activePlayer === socket.id) {
        statusDiv.innerText = "It's your turn!";
        // TODO: Enable buttons/interactions (e.g., enable move/strike buttons)
    } else {
        statusDiv.innerText = "Opponent's turn";
        // TODO: Disable buttons/interactions to prevent actions out of turn
    }
});