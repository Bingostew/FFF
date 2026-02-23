<script>
// @ts-nocheck

    import { isHovering } from '$lib/store';
    
    //Will be used for API calls to server
    let isSubmitted = $state(false);
    
    // State variables for dice rolling functionality.
    let currentRollDisplay1 = $state(0);
    let currentRollDisplay2 = $state(0);    
    let isRolling = $state(false);

    // Standard JS props (using defaults to prevent crashes)
    let { 
        targetingMode = $bindable('focus'), 
        isConfirmed = $bindable(false), 
        rotation = $bindable(0),
        isEnemyTurn = $bindable(false), // <-- Add this
        fleetSelections = [], 
        onConfirm = () => {},
        onSearch = () => {},
        onTurnEnd = () => {} // <-- Add this
    } = $props();

    // Simulates a D6 dice roll.
    function diceRoll() {
        if (isRolling || isEnemyTurn) return; 

        isRolling = true;
        onSearch(); // 1. Instantly paint the player's blue radar crosshairs

        const finalResult1 = Math.floor(Math.random() * 6) + 1;
        const finalResult2 = Math.floor(Math.random() * 6) + 1;
        
        const interval = setInterval(() => {
            currentRollDisplay1 = Math.floor(Math.random() * 6) + 1;
            currentRollDisplay2 = Math.floor(Math.random() * 6) + 1;
        }, 50);

        setTimeout(async () => {
            clearInterval(interval);
            currentRollDisplay1 = finalResult1;
            currentRollDisplay2 = finalResult2;
            isRolling = false;

            // 2. DICE FINISHED. KICK OFF THE ENEMY TURN!
            onTurnEnd(); 

            try {
                await fetch('/api/roll', {
                    method: 'POST',
                    body: JSON.stringify({ result1: finalResult1, result2: finalResult2 })
                });
            } catch (e) {
                console.log(`Dice Rolls, numbers are [${finalResult1}, ${finalResult2}]`);
            }
        }, 3000);
    }
</script>


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
        <h3 class="panel-header">TARGETING</h3>
        
        <div class="button-group">
            <button 
                class:active={targetingMode === 'focus'} 
                onclick={() => targetingMode = 'focus'}
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
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
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
            >
                <span class="btn-text">AREA</span>
                <span class="btn-sub">4 ADJACENT CELLS</span>
            </button>

            <div class="button-group">
                <button 
                    style="margin-top: 10px; border-color: #e24a4a; color: #e24a4a;"
                    onclick={() => diceRoll()}   
                    disabled={isRolling || isEnemyTurn}                
                    onmouseenter={() => $isHovering = true} 
                    onmouseleave={() => $isHovering = false}
                >
                <span class="btn-text">ACTIVATE</span>
                    <span class="btn-sub">CONFIRM AND ROLL</span>
                </button>

                {#if currentRollDisplay1 !== null && currentRollDisplay2 !== null}
                    <div class="roll-display" class:is-rolling={isRolling}>
                        <span class="roll-label">ROLL RESULT</span>
                        <span class="roll-number">{currentRollDisplay1}</span>
                        <span class="roll-number">{currentRollDisplay2}</span>
                    </div>
                {/if}
            </div>
      
        </div>
    {/if}
</div>
{/if}

<style>
    .sidebar_targeting {
        /* Sizing and Flexbox rules matched to Status Bar */
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
        
        overflow-y: auto;
        overflow-x: hidden;
    }
    
    .panel-header {
        font-family: 'Chakra Petch', sans-serif; 
        color: #abbbd1; 
        font-size: clamp(1.2rem, 3vh, 1.8rem);
        border-bottom: 1px solid rgba(171, 187, 209, 0.3); 
        padding-bottom: 10px; 
        letter-spacing: 2px;
    }
    
    .button-group { display: flex; flex-direction: column; gap: 10px; }
    
    button {
        font-family: 'Chakra Petch', sans-serif; 
        color: #abbbd1; 
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(59, 130, 246, 0.3); 
        padding: clamp(10px, 2vh, 15px); 
        cursor: none;
        text-align: left; 
        transition: all 0.2s ease;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        display: flex; 
        flex-direction: column; 
        width: 100%;
    }
    
    button:hover:not(:disabled) { background: rgba(59, 130, 246, 0.2); color: #fff; border-color: #3b82f6; }
    button.active { background: rgba(59, 130, 246, 0.4); border-color: #3b82f6; color: white; transform: translateX(5px); }
    button:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }
    
    .btn-text { font-size: clamp(1rem, 2.5vh, 1.5rem); font-weight: 700; }
    .btn-sub { font-size: clamp(0.7rem, 1.4vh, 0.9rem); opacity: 0.7; }
    .btn-hint { font-size: 0.7rem; color: #555; margin-top: 4px; }

    /* Dice rolling display */
    .roll-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid #22c55e;
        padding: clamp(5px, 1.5vh, 15px);
        margin-top: 10px;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        transition: all 0.2s ease;
    }
    
    .roll-label { 
        font-family: 'Chakra Petch', sans-serif; 
        font-size: clamp(0.7rem, 1.4vh, 1rem); 
        color: #abbbd1; 
        letter-spacing: 2px; 
        margin-bottom: 5px;
    }    
    .roll-number { 
        font-family: 'Chakra Petch', sans-serif; 
        /* FIX: Slightly scaled down to accommodate horizontal layout */
        font-size: clamp(2.5rem, 6vh, 4.5rem); 
        font-weight: 700; 
        color: #22c55e; 
    }
    
    .is-rolling .roll-number { 
        color: #e24a4a; 
        opacity: 0.8; 
        transform: scale(1.2); 
        transition: transform 0.10s ease; 
    }

    .sidebar_targeting {
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