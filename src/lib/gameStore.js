// gameStore.js
import { writable } from 'svelte/store';
import { io } from 'socket.io-client';

// A. REACTIVE STATE (The data your pages will display)
export const gameState = writable({
    gameId: null,
    playerId: null, // "p1" or "p2"
    turn: null,     // Who is playing now?
    myShips: [],    // Array of your ship objects
    enemyShips: [], // Array of known enemy ships (or ghosts)
    map: {},        // The grid data
    logs: []        // Combat logs ("Player 1 fired at B-2!")
});

// B. THE SOCKET CONNECTION
// We create the socket once and export it
export const socket = io('http://localhost:3000', {
    autoConnect: false // We connect manually when the user hits "Join"
});

// --- LISTENER SETUP ---
// Call this function once when the game component mounts
export function setupGameListeners() {
    
    // 1. GAME START
    socket.on('game_start', (data) => {
        console.log("Game Started!", data);
        gameState.update(state => ({
            ...state,
            gameId: data.gameId,
            playerId: socket.id,
            turn: data.turn,
            map: data.map,
            myShips: data.ships.filter(s => s.owner === socket.id),
            // Enemies are hidden initially in Fog of War
            enemyShips: [] 
        }));
    });

    // 2. ISR RESULT (Scanning)
    socket.on('isr_result', (data) => {
        // data = { player, type, roll, success, hits: [{hex, shipId}] }
        
        const logMsg = `ISR (${data.type}) rolled ${data.roll}: ${data.success ? "SUCCESS" : "FAIL"}`;
        
        // If WE scanned and found something, update the UI
        if (data.player === socket.id && data.success) {
            data.hits.forEach(hit => {
                alert(`Enemy found at ${hit.hex}!`);
                // Add a visual marker to the map store
            });
        }
        
        // addLog(logMsg);
    });

    // 3. STRIKE RESULT (Combat)
    socket.on('strike_result', (data) => {
        // data = { damage, attackerRevealed, rolls: [4, 5], counterRoll: 2 }
        
        const hitMsg = data.damage > 0 
            ? `DIRECT HIT! Dealt ${data.damage} damage.` 
            : `Missed (Rolls: ${data.rolls.join(',')})`;

        const revealMsg = data.attackerRevealed 
            ? "ATTACKER REVEALED by counter-detection!" 
            : "Attacker remained hidden.";

        // addLog(`Strike: ${hitMsg} ${revealMsg}`);

        // Update ship health in state if needed
        // (Usually you'd request a full state sync here to be safe)
    });

    // 4. TURN CHANGE
    socket.on('turn_change', (newTurnId) => {
        gameState.update(state => ({ ...state, turn: newTurnId }));
    });
}

// // Helper to add logs
// function addLog(msg) {
//     gameState.update(s => ({ ...s, logs: [...s.logs, msg] }));
// }