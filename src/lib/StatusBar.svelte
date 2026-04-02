<script>
    /*Import custom cursor*/
    import { isHovering } from '$lib/store';

    /*Game states, will be handled by a server in the future*/
    let { 
        currentTurn = $bindable(1),
        isMyTurn = true,
        isMultiplayer = false,
        fleetSelections = [] /* Now imports the array of ships */
    } = $props();

    /*Methods update the basic health and fuel data for the player*/ 
    /* (Global move/damage test buttons removed: stats are now per-ship!) */
    
</script>

<div class="status-bar">
    
    <div class="turn-tracker" class:enemy-active={!isMyTurn}>
        <div class="turn-info">
            <span class="stat-label turn-label">
                    {isMyTurn ? 'FRIENDLY TURN' : (isMultiplayer ? 'OPPONENT TURN' : 'ENEMY TURN')}            </span>
            <span class="turn-number">{currentTurn}</span>
        </div>
        
        {#if !isMyTurn}
            <div class="processing-bar"></div>
        {/if}
    </div>

    <div class="stat-container">
        {#each fleetSelections as fleet}
            <div class="fleet-card">
                <div class="fleet-header">
                    <span class="fleet-name">{fleet.name}</span>
                </div>
                
                <div class="stat-group">
                    <span class="stat-label">HEALTH</span>
                    <div class="icons">
                        {#each Array(Math.max(0, fleet.health)).fill(0) as _}
                            <img 
                                src="/blue_damage.png" 
                                alt="health" 
                                class="stat-icon" 
                                draggable="false" 
                            />
                        {/each}
                        {#each Array(2 - Math.max(0, fleet.health)).fill(0) as _}
                            <div class="empty-icon hp"></div>
                        {/each}
                    </div>
                </div>
                
                <div class="stat-group">
                    <span class="stat-label">FUEL</span>
                    <div class="icons">
                        {#each Array(Math.max(0, fleet.fuel)).fill(0) as _}
                            <img 
                                src="/fuel.png" 
                                alt="fuel" 
                                class="stat-icon fuel" 
                                draggable="false" 
                            />
                        {/each}
                        {#each Array(3 - Math.max(0, fleet.fuel)).fill(0) as _}
                            <div class="empty-icon"></div>
                        {/each}
                    </div>
                </div>
            </div>
        {/each}
    </div>
</div>

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

    /* Animated loading bar while waiting for enemy AI to make a decision.
    * Remove for multiplayer. 
    */
    .processing-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        height: 3px;
        background: #e24a4a;
        width: 0%;
        animation: process 3s linear forwards;
    }

    /*Helps with the animation of the loading bar*/
    @keyframes process {
        0% { width: 0%; }
        100% { width: 100%; }
    }

    /*Pulses red for enemy decision turn*/
    @keyframes pulseText {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
    }

    /*Holds the health and fuel information*/
    .stat-container {
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        gap: 20px;
        padding: 10px 0px;
    }

    /* Individual Ship Card Layout */
    .fleet-card { 
        background: rgba(0, 0, 0, 0.4); 
        border: 1px solid rgba(59, 130, 246, 0.2); 
        padding: 15px 10px; 
        border-radius: 4px; 
        display: flex; 
        flex-direction: column; 
        gap: 15px; 
    }

    /* Name of the vessel */
    .fleet-header { 
        border-bottom: 1px solid rgba(59, 130, 246, 0.3); 
        padding-bottom: 5px; 
        text-align: center;
    }

    /* Vessel Text Appearance */
    .fleet-name { 
        font-family: 'Chakra Petch', sans-serif; 
        font-size: 1.1rem; 
        color: #4ade80; 
        font-weight: bold; 
        letter-spacing: 2px; 
    }

    /*Group of health and fuel images*/
    .stat-group {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 5px;
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

    /* Empty slots so the UI doesn't collapse when health/fuel drops */
    .empty-icon { 
        width: clamp(30px, 3.5vw, 50px); 
        height: clamp(30px, 3.5vw, 50px); 
        border: 1px dashed rgba(234, 179, 8, 0.3); 
        border-radius: 50%; 
        box-sizing: border-box; 
    }

    /* Square-ish empty slot for health */
    .empty-icon.hp { 
        border-color: rgba(59, 130, 246, 0.3); 
        border-radius: 0; 
    }

    @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(226, 74, 74, 0.4); }
        70% { box-shadow: 0 0 0 10px rgba(226, 74, 74, 0); }
        100% { box-shadow: 0 0 0 0 rgba(226, 74, 74, 0); }
    }
</style>