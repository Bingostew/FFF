<!--STATUSBAR, DISPLAYS HEALTH, FUEL, TURN, AND TESTING BUTTONS-->
<!--SCRIPTS FOR STATUSBAR-->
<script>
    /*Import custom cursor*/
    import { isHovering } from '$lib/store';

    /*Game states, will be handled by a server in the future*/
    let { 
        health = $bindable(2), 
        fuel = $bindable(3),
        currentTurn = $bindable(1),
        isRevealed = $bindable(false),
        isConfirmed = false,
        isMyTurn = true
    } = $props();

    let showEnemyVisuals = $derived(isConfirmed && !isMyTurn);

    /*Methods update the basic health and fuel data for the player*/ 
    function move() { if (fuel > 0) fuel -= 1; }
    function damage() { if (health > 0) health -= 1; }
    function toggleReveal() { isRevealed = !isRevealed; }
</script>

<!--HTML FOR STATUSBAR-->
<div class="status-bar">
    
    <div class="turn-tracker" class:enemy-active={showEnemyVisuals}>
        <div class="turn-info">
            <span class="stat-label turn-label">
                {showEnemyVisuals ? 'ENEMY TURN' : 'FRIENDLY TURN'}
            </span>
            <span class="turn-number">{currentTurn}</span>
        </div>
    </div>

    <div class="stat-container">
        <div class="stat-group">
            <span class="stat-label">HEALTH</span>
            <div class="icons">
                {#each Array(health) as _}
                    <img 
                        src="/blue_damage.png" 
                        alt="health" 
                        class="stat-icon" 
                        draggable="false" 
                    />
                {/each}
            </div>
        </div>
        
        <div class="stat-group">
            <span class="stat-label">FUEL</span>
            <div class="icons">
                {#each Array(fuel) as _}
                    <img 
                        src="/fuel.png" 
                        alt="fuel" 
                        class="stat-icon fuel" 
                        draggable="false" 
                    />
                {/each}
            </div>
        </div>
    </div>

    <div class="test-controls">
        <span class="test-header">// TESTING SPACE</span>

        <button 
            class="test-btn" 
            onclick={move} 
            onmouseenter={() => $isHovering = true} 
            onmouseleave={() => $isHovering = false}
        >
            SIMULATE MOVE - FUEL
        </button>
        
        <button 
            class="test-btn" 
            onclick={damage} 
            onmouseenter={() => $isHovering = true} 
            onmouseleave={() => $isHovering = false}
        >
            SIMULATE DAMAGE - HP
        </button>
        
        <button 
            class="test-btn danger" 
            onclick={toggleReveal} 
            onmouseenter={() => $isHovering = true} 
            onmouseleave={() => $isHovering = false}
        >
            TOGGLE REVEAL
        </button>
    </div>
</div>

<!--STATUSBAR HTML APPEARANCE-->
<style>
    /*General layout of the statusbar and its content*/
    .status-bar {
        height: 100%; 
        width: clamp(200px, 15vw, 300px); 
        padding: clamp(15px, 2vw, 25px); 
        box-sizing: border-box; 
        background: rgba(10, 15, 30, 0.95); 
        border-left: 1px solid rgba(59, 130, 246, 0.3);
        display: flex; 
        flex-direction: column;
        gap: clamp(10px, 2vh, 20px); 
        z-index: 10; 
        overflow-y: auto; 
        overflow-x: hidden;
        scrollbar-width: none;
    }

    /*Turn tracker layout and general appearance*/
    .turn-tracker {
        display: flex;
        flex-direction: column;
        justify-content: center;
        border: 1px solid rgba(59, 130, 246, 0.4);
        background: rgba(59, 130, 246, 0.1);
        padding: 10px 15px;
        border-radius: 4px;
        transition: all 0.3s ease;
        position: relative;
        overflow: visible; 
    }

    /*Turn number*/
    .turn-info {
        display: flex;
        justify-content: space-between;
        align-items: center;
        overflow: visible; 
    }

    /* When it is the Enemy's Turn, turns red */
    .turn-tracker.enemy-active {
        border-color: rgba(226, 74, 74, 0.8);
        background: rgba(226, 74, 74, 0.15);
        box-shadow: 0 0 15px rgba(226, 74, 74, 0.3) inset;
    }

    /*Change label color*/
    .turn-tracker.enemy-active .turn-label {
        color: #e24a4a;
        animation: pulseText 1.5s infinite;
    }

    /*Change enemy turn number color red */
    .turn-tracker.enemy-active .turn-number {
        color: #e24a4a;
    }

    /*Friendly turn number is white*/
    .turn-number {
        color: #ffffff;
    }

    /*Holds the health and fuel information*/
    .stat-container {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 30px;
        padding: 10px;
    }

    /*Group of health and fuel images*/
    .stat-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }

    /*HEALTH and FUEL*/ 
    .stat-label {
        font-family: 'Chakra Petch', sans-serif;
        font-size: clamp(0.9rem, 3vh, 1.2rem);
        color: #abbbd1;
        letter-spacing: 2px;
        font-weight: 700;
    }

    /*Health and fuel icon layout*/
    .icons {
        display: flex;
        flex-direction: row;
        gap: clamp(5px, 1vh, 10px);
    }

    /*Health icon appearance*/ 
    .stat-icon {
        width: clamp(30px, 3.5vw, 50px); 
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
    }

    /*Fuel icon appearance*/
    .stat-icon.fuel { 
        filter: drop-shadow(0 0 5px rgba(234, 179, 8, 0.5)); 
    }

    /* TEST CONTROLS*/
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

    /* For Chrome, Edge, and Safari */
    /*::-webkit-scrollbar {
        width: 6px; 
    }

    ::-webkit-scrollbar-track {
        background: rgba(10, 15, 30, 0.5); 
        border-left: 1px solid rgba(59, 130, 246, 0.1); 
    }

    ::-webkit-scrollbar-thumb {
        background: rgba(59, 130, 246, 0.5);
        border-radius: 0px; 
    }

    ::-webkit-scrollbar-thumb:hover {
        background: rgba(59, 130, 246, 0.9); 
    }*/
</style>