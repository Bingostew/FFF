<script>
    import { onMount } from 'svelte';
    import HexMap from '$lib/+map.svelte';
    import { gameActions, gameStore } from '$lib/game/gameStore.js'; // Import store

    import { gameStore } from "$lib/gameStore.js"; // Adjust path if needed

// --- LISTEN FOR SERVER ACTIONS ---

// 1. Listen for ANY ship moving (Human or AI)
socket.on('fleet_moved', (data) => {
    console.log("Fleet moved on server:", data);
    const { playerId, fleetKey, newPosition } = data;
    
    // Update the local Svelte store so the map redraws!
    gameStore.update(currentLocalGame => {
        // Find if this was a red or blue fleet
        const isPlayer = playerId === socket.id;
        const targetFleets = isPlayer ? currentLocalGame.redFleets : currentLocalGame.blueFleets;
        
        // Find the specific ship (alpha/beta or R1/B1) and update its coordinates
        const ship = targetFleets.find(f => f.id === fleetKey || f.id.toLowerCase() === fleetKey.toLowerCase());
        if (ship) {
            ship.pos = newPosition; // OR ship.q = newPosition.q; ship.r = newPosition.r; (depending on your store setup)
        }
        
        return currentLocalGame;
    });
});

// 2. Listen for AI Strikes
socket.on('strike_result', (data) => {
    console.log("Strike result:", data);
    const { attacker, hit, targetHex, fleetKey, hpRemaining, isDestroyed } = data;
    
    // If the AI hit YOU, update your local HP!
    if (attacker !== socket.id && hit) {
        gameStore.update(currentLocalGame => {
            const myShip = currentLocalGame.redFleets.find(f => f.id === fleetKey);
            if (myShip) {
                myShip.hp = hpRemaining;
                if (isDestroyed) {
                    alert(`WARNING: Your ship ${fleetKey} was destroyed!`);
                }
            }
            return currentLocalGame;
        });
    }
});

// 3. Listen for Turn Changes
socket.on('turn_change', (data) => {
    gameStore.update(game => {
        // If the activePlayer ID matches the socket ID, it's RED's turn, else BLUE's turn.
        game.currentPlayer = data.activePlayer === socket.id ? 'RED' : 'BLUE';
        return game;
    });
});

    onMount(() => {
        gameActions.init(); // Reset board and AI
    });
</script>

<div class="page-content">
    <h1 class="glitch-text">FIND, FIX, & FINISH</h1>
    
    <div style="color: white; margin-bottom: 10px; font-family: 'Chakra Petch'">
        CURRENT TURN: <span style="color: {$gameStore.currentPlayer === 'RED' ? 'red' : 'cyan'}">
            {$gameStore.currentPlayer}
        </span>
    </div>

    <div class="map-container">
        <HexMap />
    </div>
</div>