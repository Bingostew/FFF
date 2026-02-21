<script>
    import { isHovering } from '$lib/store';

    let { 
        health = $bindable(2), 
        fuel = $bindable(3),
        currentTurn = $bindable(1),
        isRevealed = $bindable(false),
        onTestSearch = () => {}
    } = $props();

    function move() { if (fuel > 0) fuel -= 1; }
    function damage() { if (health > 0) health -= 1; }
    function nextTurn() { currentTurn += 1; }
    function toggleReveal() { isRevealed = !isRevealed; }
</script>

<div class="status-bar">
    
    <div class="turn-tracker">
        <span class="stat-label">TURN</span>
        <span class="turn-number">{currentTurn}</span>
    </div>

    {#if isRevealed}
        <div class="revealed-warning">
            DETECTED
        </div>
    {/if}

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
        <button class="test-btn" onclick={nextTurn} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>NEXT TURN</button>
        <button class="test-btn warning" onclick={() => onTestSearch()} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>ENEMY SEARCH</button>
        <button class="test-btn danger" onclick={toggleReveal} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>TOGGLE REVEAL</button>
    </div>
</div>

<style>
    .status-bar {
        /* 1. Dock it to the right side */
        position: absolute;
        top: 0; 
        right: 0;
        
        /* 2. Match the Sidebar's exact dimensions */
        height: 100%; 
        width: clamp(200px, 15vw, 300px); 
        padding: 2vw; 
        
        /* 3. Match the Sidebar's background and add an inner border */
        background: rgba(10, 15, 30, 0.95); 
        border-left: 1px solid rgba(59, 130, 246, 0.3);
        
        display: flex; 
        flex-direction: column;
        gap: clamp(10px, 2vh, 20px); 
        z-index: 10; 
        
        /* Optional: Allows scrolling inside the panel if your test buttons get too long on small screens */
        overflow-y: auto; 
    }

    .turn-tracker {
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-bottom: 1px solid rgba(171, 187, 209, 0.3);
        padding-bottom: 10px;
    }

    .turn-number {
        font-family: 'Chakra Petch', sans-serif;
        font-size: clamp(1.5rem, 3.5vh, 2.5rem);
        color: #fff;
        font-weight: bold;
    }

    .revealed-warning {
        background: rgba(226, 74, 74, 0.2);
        color: #e24a4a;
        font-family: 'Chakra Petch', sans-serif;
        font-weight: bold;
        text-align: center;
        padding: 5px;
        border: 1px solid #e24a4a;
        letter-spacing: 2px;
        animation: pulse 1.5s infinite;
    }

    .stat-container {
        display: flex;
        justify-content: space-between;
    }

    .stat-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 10px;
    }

    .stat-label {
        font-family: 'Chakra Petch', sans-serif;
        font-size: clamp(0.9rem, 2vh, 1.2rem);
        color: #abbbd1;
        letter-spacing: 2px;
        font-weight: 700;
    }

    .icons {
        display: flex;
        flex-direction: column;
        gap: clamp(5px, 1vh, 10px);
    }

    .stat-icon {
        width: clamp(30px, 3.5vw, 50px); 
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
    }

    .stat-icon.fuel { filter: drop-shadow(0 0 5px rgba(234, 179, 8, 0.5)); }

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
    
    .test-btn:hover { background: #333; color: white; border-color: white; }
    .test-btn.warning:hover { background: rgba(234, 179, 8, 0.2); border-color: #eab308; color: #eab308; }
    .test-btn.danger:hover { background: rgba(226, 74, 74, 0.2); border-color: #e24a4a; color: #e24a4a; }

    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(226, 74, 74, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(226, 74, 74, 0); }
        100% { box-shadow: 0 0 0 0 rgba(226, 74, 74, 0); }
    }
</style>