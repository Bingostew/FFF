<script>
    import { isHovering } from '$lib/store';

    let { 
        health = $bindable(2), 
        fuel = $bindable(3),
        currentTurn = $bindable(1),
        isRevealed = $bindable(false),
        isEnemyTurn = $bindable(false) // <-- Now controlled by the map!
    } = $props();

    function move() { if (fuel > 0) fuel -= 1; }
    function damage() { if (health > 0) health -= 1; }
    function toggleReveal() { isRevealed = !isRevealed; }
</script>

<div class="status-bar">
    
    <div class="turn-tracker" class:enemy-active={isEnemyTurn}>
        <div class="turn-info">
            <span class="stat-label turn-label">
                {isEnemyTurn ? 'ENEMY TURN' : 'FRIENDLY TURN'}
            </span>
            <span class="turn-number">{currentTurn}</span>
        </div>
        
        {#if isEnemyTurn}
            <div class="processing-bar"></div>
        {/if}
    </div>

    <div class="stat-container">
        <div class="stat-group">
            <span class="stat-label">HEALTH</span>
            <div class="icons">
                {#each Array(health) as _}
                    <img src="/blue_damage.png" alt="health" class="stat-icon" draggable="false" />
                {/each}
            </div>
        </div>
        
        <div class="stat-group">
            <span class="stat-label">FUEL</span>
            <div class="icons">
                {#each Array(fuel) as _}
                    <img src="/fuel.png" alt="fuel" class="stat-icon fuel" draggable="false" />
                {/each}
            </div>
        </div>
    </div>

    <div class="test-controls">
        <span class="test-header">// SIMULATOR</span>

        <button class="test-btn" onclick={move} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>- FUEL</button>
        <button class="test-btn" onclick={damage} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>- HP</button>
        <button class="test-btn danger" onclick={toggleReveal} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>TOGGLE REVEAL</button>
    </div>
</div>

<style>
    .status-bar {
        /* Sizing and Flexbox rules */
        height: 100%; 
        width: clamp(200px, 15vw, 300px); 
        padding: clamp(15px, 2vw, 25px); 
        box-sizing: border-box; /* Keeps padding inside the width constraints */
        
        /* Tactical Theme */
        background: rgba(10, 15, 30, 0.95); 
        border-left: 1px solid rgba(59, 130, 246, 0.3);
        
        display: flex; 
        flex-direction: column;
        gap: clamp(10px, 2vh, 20px); 
        z-index: 10; 
        
        overflow-y: auto; 
        overflow-x: hidden;
    }

    /* --- NEW TURN TRACKER STYLES --- */
    .turn-tracker {
        display: flex;
        flex-direction: column;
        justify-content: center;
        border: 1px solid rgba(59, 130, 246, 0.4);
        background: rgba(59, 130, 246, 0.1); /* Blue background */
        padding: 10px 15px;
        border-radius: 4px;
        transition: all 0.3s ease;
        position: relative;
        overflow: none;
    }

    .turn-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        overflow: none;

    }

    /* When it is the Enemy's Turn */
    .turn-tracker.enemy-active {
        border-color: rgba(226, 74, 74, 0.8);
        background: rgba(226, 74, 74, 0.15); /* Red background */
        box-shadow: 0 0 15px rgba(226, 74, 74, 0.3) inset;
    }

    .turn-tracker.enemy-active .turn-label {
        color: #e24a4a;
        animation: pulseText 1.5s infinite;
    }

    .turn-tracker.enemy-active .turn-number {
        color: #e24a4a;
    }

    .turn-number {
        color: #ffffff;
    }



    /* A little animated loading bar while waiting */
    .processing-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: #e24a4a;
        width: 0%;
        animation: process 3s linear forwards;
    }

    @keyframes process {
        0% { width: 0%; }
        100% { width: 100%; }
    }

    @keyframes pulseText {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    .stat-container {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 30px;

    }

    .stat-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }

    .stat-label {
        font-family: 'Chakra Petch', sans-serif;
        font-size: clamp(0.9rem, 3vh, 1.2rem);
        color: #abbbd1;
        letter-spacing: 2px;
        font-weight: 700;
    }

    .icons {
        display: flex;
        flex-direction: row;
        gap: clamp(5px, 1vh, 10px);
    }

    .stat-icon {
        width: clamp(30px, 3.5vw, 50px); 
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
    }

    .stat-icon.fuel { 
        filter: drop-shadow(0 0 5px rgba(234, 179, 8, 0.5)); 
    }

    /* Test Controls Section */
    .test-controls {
        margin-top: 20px;
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-top: 1px dashed #555;
        padding-top: 10px;
    }

    .test-header {
        font-family: 'Chakra Petch', sans-serif;
        color: #555;
        font-size: 0.8rem;
        margin-bottom: 5px;
    }

    .test-btn {
        background: transparent;
        border: 1px solid #555;
        color: #abbbd1;
        padding: 8px;
        font-family: 'Chakra Petch', sans-serif;
        font-size: clamp(0.7rem, 1.2vh, 0.9rem);
        cursor: none;
        transition: all 0.2s;
    }
    
    .test-btn:hover { 
        background: #333; 
        color: white; 
        border-color: white; 
    }
    .test-btn.danger:hover { 
        background: rgba(226, 74, 74, 0.2); 
        border-color: #e24a4a; 
        color: #e24a4a; 
    }

    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(226, 74, 74, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(226, 74, 74, 0); }
        100% { box-shadow: 0 0 0 0 rgba(226, 74, 74, 0); }
    }

    .status-bar {
        scrollbar-width: thin;
        scrollbar-color: rgba(59, 130, 246, 0.6) rgba(10, 15, 30, 0.5);
    }

    /* For Chrome, Edge, and Safari */
    ::-webkit-scrollbar {
        width: 6px; /* Super thin, sleek profile */
    }

    ::-webkit-scrollbar-track {
        background: rgba(10, 15, 30, 0.5); /* Blends into your panel background */
        border-left: 1px solid rgba(59, 130, 246, 0.1); /* Faint track line */
    }

    ::-webkit-scrollbar-thumb {
        background: rgba(59, 130, 246, 0.5); /* Tactical blue */
        border-radius: 0px; /* Square edges for that blocky, HUD feel */
    }

    ::-webkit-scrollbar-thumb:hover {
        background: rgba(59, 130, 246, 0.9); /* Lights up when you grab it */
    }
</style>