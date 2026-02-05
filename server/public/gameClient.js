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

function submitMoveFleet() {
    const fleetKey = document.getElementById('fleetSelector').value;
    const q = parseInt(document.getElementById('moveQ').value);
    const r = parseInt(document.getElementById('moveR').value);
    moveFleet(fleetKey, q, r);
}

// Example function to move a fleet (to be expanded with UI later) fleetKey is 'alpha' or 'beta'
function moveFleet(fleetKey, q, r) {
    log(`Moving fleet ${fleetKey} to ${q},${r}`);
    socket.emit('move_fleet', { gameId: currentRoom, fleetKey, newPosition: { q, r } });
}

function rollDie() {
    socket.emit('die_roll', { gameId: currentRoom });
}

function submitFocus() {
    const q1 = parseInt(document.getElementById('focusQ1').value);
    const r1 = parseInt(document.getElementById('focusR1').value);
    const q2 = parseInt(document.getElementById('focusQ2').value);
    const r2 = parseInt(document.getElementById('focusR2').value);
    const q3 = parseInt(document.getElementById('focusQ3').value);
    const r3 = parseInt(document.getElementById('focusR3').value);

    const positions = [{ q: q1, r: r1 }, { q: q2, r: r2 }, { q: q3, r: r3 }];
    
    log("Sending Focus:", positions);
    socket.emit('focus', currentRoom, positions);
}

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
socket.on('fleet_moved', (data) => log("Fleet Moved:", data));
socket.on('die_result', (data) => log("Die Result:", data));
socket.on('focus_result', (data) => {
    if (data.revealPos && data.revealPos.length > 0) {
        log('Focus Result: Revealed fleet positions.', data.revealPos);
    } else {
        log('Focus Result: No fleets found at the specified locations.');
    }
});
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