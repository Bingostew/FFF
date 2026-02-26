<script>
    import { onMount } from 'svelte';
    import HexMap from '$lib/+map.svelte';
    import { gameActions, gameStore } from '$lib/game/gameStore.js'; // Import store

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