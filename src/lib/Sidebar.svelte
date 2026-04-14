<!--SIDEBAR, DISPLAYS DEPLOYMENT, ATTACK, ROLL INFORMATION-->
<!--SCRIPTS FOR THE SIDEBAR-->
<script>
    // @ts-nocheck

    // Import custom cursor
    import { isHovering } from '$lib/store';
    import { socket, gameId, activePlayerId } from '$lib/gameStore';   
    // Used for API calls to server
    let isSubmitted = $state(false);

    // Standard JS props (using defaults to prevent crashes)
    let { 
        targetingMode = $bindable(), 
        isConfirmed = $bindable(), 
        rotation = $bindable(),
        sourceFleet = $bindable(),
        isMultiplayer = $bindable(),
        fleetSelections = [], 
        onConfirm,
        isMyTurn = true,
        onSearch,
        onTurnEnd,
        onScanResult,
        selectedGroup = [],
        targetEnemy = $bindable(null),
        attackRange = null,
        requiredRoll = null,
        onFireResolve
    } = $props();

    let totalFuel = $derived(fleetSelections.reduce((acc, f) => acc + (f.fuel || 0), 0));
</script>

<!--SIDEBAR CONTENT-->
<!--Will not appear until fleets are deployed-->
{#if !isSubmitted}
    <div class="sidebar_targeting">        
        {#if !isConfirmed}
            <h3 class="panel-header">DEPLOYMENT</h3>
                
            <div class="status-panel">
                <span>FLEETS:</span>
                <span class:ready={fleetSelections.length === 2}>
                    {fleetSelections.length} / 2
                </span>
            </div>

            <button 
                class="button" 
                disabled={fleetSelections.length !== 2}
                onclick={() => onConfirm()} 
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
            >
                CONFIRM COORDINATES
            </button>

        {:else}
            {#if !targetEnemy}
                <h3 class="panel-header">TARGETING</h3>
               
                <div class="button-group">
                    <button 
                        class:active={targetingMode === 'focus'} 
                        onclick={() => targetingMode = 'focus'}
                    >
                        <span class="btn-text">FOCUS</span>
                        <span class="btn-sub">SINGLE CELL</span>
                    </button>

                    <button 
                        class:active={targetingMode === 'directional'} 
                        onclick={() => targetingMode = 'directional'}
                    >
                        <span class="btn-text">DIRECTIONAL</span>
                        <span class="btn-sub">
                            {#if rotation % 3 === 0} VERTICAL
                            {:else if rotation % 3 === 1} SLANT RIGHT
                            {:else} SLANT LEFT
                            {/if}
                        </span>
                        <span class="btn-hint">[R-CLICK TO ROTATE]</span>
                    </button>

                    <button 
                        class:active={targetingMode === 'area'} 
                        onclick={() => targetingMode = 'area'}
                    >
                        <span class="btn-text">AREA</span>
                        <span class="btn-sub">4 ADJACENT CELLS</span>
                    </button>

                    <button 
                        class:active={targetingMode === 'move'} 
                        onclick={() => targetingMode = 'move'}
                        disabled={totalFuel <= 0}
                    >
                        <span class="btn-text">MOVE</span>
                        <span class="btn-sub">{totalFuel > 0 ? "MOVE FLEET (COST: 1 FUEL)" : "NO FUEL REMAINING"}</span>
                    </button>

                    <button style="margin-top: 10px; border-color: #3b82f6; color: #3b82f6;"
                        onclick={() => onSearch()} disabled={!isMyTurn || selectedGroup.length === 0}>
                        <span class="btn-text">ACTIVATE SCAN</span>
                        <span class="btn-sub">CONFIRM AND SEARCH</span>
                    </button>
                </div>

            {:else}
                {#if isMyTurn}
                    <h3 class="panel-header" style="color: #e24a4a; border-color: #e24a4a;">FIRE MISSION</h3>
                    
                    {#if !sourceFleet}
                        <div class="status-panel" style="border-color: #e24a4a; animation: pulse 2s infinite;">
                            <span style="color: #e24a4a; font-weight: bold;">SELECT SOURCE FLEET</span>
                        </div>
                        <p class="btn-sub" style="text-align: center; margin-top: 10px;">Click one of your ships on the map to calculate firing solution.</p>
                    {:else}
                        <div class="attack-stats">
                            <div class="stat-row">
                                <span>SOURCE:</span>
                                <span class="val">{sourceFleet.name}</span>
                            </div>
                            <div class="stat-row">
                                <span>RANGE:</span>
                                <span class="val">{attackRange} HEXES</span>
                            </div>
                            <div class="stat-row">
                                <span>DIFFICULTY:</span>
                                <span class="val" style="color: #e24a4a;">{requiredRoll}+ NEEDED</span>
                            </div>
                        </div>
                    {/if}

                    <div class="button-group">
                        <button 
                            class="fire-button"
                            onclick={() => onFireResolve()}
                            disabled={!sourceFleet}
                        >
                            <span class="btn-text">ENGAGE</span>
                            <span class="btn-sub">{sourceFleet ? "EXECUTE ATTACK VECTOR" : "WAITING FOR SOURCE..."}</span>
                        </button>

                        <button 
                            class="cancel-btn"
                            onclick={() => { targetEnemy = null; sourceFleet = null; }}
                        >
                            <span class="btn-text" style="font-size: 0.8rem; text-align: center;">ABORT MISSION</span>
                        </button>
                    </div>

                {:else}
                    <h3 class="panel-header" style="color: #abbbd1; opacity: 0.5;">SENSORS JAMMED</h3>
                    
                    <div class="status-panel" style="border-color: #e24a4a; background: rgba(226, 74, 74, 0.1);">
                        <span style="color: #e24a4a; font-weight: bold; animation: pulse 1s infinite;">
                            ⚠️ INCOMING FIRE DETECTED
                        </span>
                    </div>
                    
                    <div class="attack-stats" style="border-style: dashed; opacity: 0.6;">
                        <p class="btn-sub" style="text-align: center;">
                            An enemy fleet has established a target lock on your position. 
                            Awaiting resolution of hostile action...
            </p>
        </div>
    {/if}
{/if}
        {/if}
    </div>
{/if}

<!--SIDEBAR APPEARANCE-->
<style>
    /* Sizing and Flexbox rules */
    .sidebar_targeting {
        height: 100%;
        width: clamp(200px, 15vw, 300px); 
        padding: clamp(15px, 2vw, 25px); 
        box-sizing: border-box; 
        
        /* Tactical Theme */
        background: rgba(10, 15, 30, 0.95);
        border-right: 1px solid rgba(59, 130, 246, 0.3);
        
        display: flex; 
        flex-direction: column; 
        gap: clamp(10px, 2vh, 20px);
        z-index: 10;
        
        /*The display will be able to scroll*/
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-width: none;
    }
    
    /*TARGETING*/
    .panel-header {
        font-family: 'Chakra Petch', sans-serif; 
        color: #abbbd1; 
        font-size: clamp(1.2rem, 3vh, 1.8rem);
        border-bottom: 1px solid rgba(171, 187, 209, 0.3); 
        padding-bottom: 10px; 
        letter-spacing: 2px;
    }
    
    /*Focus, Directional, Area, Activate*/
    .button-group { 
        display: flex; 
        flex-direction: column; 
        gap: 10px; 
    }
    
    /*Layout and structure of the content inside the button*/
    button {
        font-family: 'Chakra Petch', sans-serif; 
        color: #abbbd1; 
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(59, 130, 246, 0.3); 
        padding: clamp(10px, 1vh, 15px); 
        cursor: none;
        text-align: left; 
        transition: all 0.2s ease;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        display: flex; 
        flex-direction: column; 
        width: 100%;
    }

    /*Look of the targeting buttons when in use.*/
    button.active { 
        background: rgba(59, 130, 246, 0.4); 
        border-color: #3b82f6; 
        color: white; 
        transform: translateX(5px); 
    }

    /*Look of the targeting buttons when not in use.*/
    button:disabled { 
        opacity: 0.5; 
        cursor: not-allowed; 
        filter: grayscale(1); 
    }

    button:hover:not(:disabled) { 
        background: rgba(59, 130, 246, 0.2); 
        color: #fff; 
        border-color: #3b82f6; 
    }
    
    /*Handles the look of the text inside the targeting buttons*/
    .btn-text { 
        font-size: clamp(1rem, 2.5vh, 1.5rem); 
        font-weight: 700; 
    }

    /*Handles the look of the subtext inside the targeting buttons*/
    .btn-sub { 
        font-size: clamp(0.7rem, 1.4vh, 0.9rem); 
        opacity: 0.7; 
    }

    /*This is for directional search to indicate use of right click to switch directions*/
    .btn-hint { 
        font-size: 0.7rem; 
        color: #a4afae; 
        margin-top: 4px; 
    }

    .attack-stats {
        background: rgba(226, 74, 74, 0.1);
        border: 1px solid rgba(226, 74, 74, 0.3);
        padding: 15px;
        margin-bottom: 10px;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
    }

    .stat-row {
        display: flex;
        justify-content: space-between;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 0.9rem;
        color: #abbbd1;
        margin-bottom: 5px;
    }

    .val { font-weight: bold; color: white; }

    .fire-button {
        border-color: #e24a4a !important;
        background: rgba(226, 74, 74, 0.2) !important;
        box-shadow: 0 0 15px rgba(226, 74, 74, 0.2);
    }

    .cancel-btn {
        margin-top: 5px;
        opacity: 0.6;
        border: none;
        background: transparent;
        align-items: center;
    }

    @keyframes pulse {
        0% { opacity: 1; }
        50% { opacity: 0.5; }
        100% { opacity: 1; }
    }

    @keyframes popIn {
        0% { transform: scale(0.8); opacity: 0; }
        100% { transform: scale(1); opacity: 1; }
    }

</style>