// gameActions.js
import { socket } from './gameStore.js';
import { get } from 'svelte/store';
import { gameState } from './gameStore.js';

// --- ACTION 1: MOVEMENT ---
export function sendMove(shipId, targetHex) {
    // 1. Basic Validation (Optional, for instant UI feedback)
    const state = get(gameState);
    if (state.turn !== socket.id) return alert("Not your turn!");

    // 2. Emit
    socket.emit('action_move', {
        gameId: state.gameId,
        shipId: shipId,
        toHex: targetHex
    });
}

// --- ACTION 2: ISR (SCANNING) ---
export function sendISR(type, selectedHexes) {
    const state = get(gameState);
    
    [cite_start]// PDF Rule Checks [cite: 13, 19, 21]
    if (type === 'focus' && selectedHexes.length !== 3) {
        return alert("Focus ISR requires exactly 3 hexes.");
    }
    if (type === 'directional' && selectedHexes.length !== 3) {
        return alert("Directional ISR requires 3 adjacent hexes.");
    }
    if (type === 'area' && selectedHexes.length !== 4) {
        return alert("Area ISR requires 4 hexes.");
    }

    socket.emit('action_isr', {
        gameId: state.gameId,
        type: type, // 'focus', 'directional', or 'area'
        selectedHexes: selectedHexes // Array of strings ["A-1", "B-2"]
    });
}

// --- ACTION 3: STRIKE (COMBAT) ---
export function sendStrike(myShipId, targetEnemyId) {
    const state = get(gameState);

    if (!targetEnemyId) return alert("You must target a revealed enemy!");

    socket.emit('action_strike', {
        gameId: state.gameId,
        attackerShipId: myShipId,
        targetShipId: targetEnemyId
    });
}