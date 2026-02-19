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
        fleetSelections = [], 
        onConfirm = () => {} 
    } = $props();

    // Simulates a D6 dice roll.
    function diceRoll() {
        if (isRolling) return; 

        isRolling = true;
        const finalResult1 = Math.floor(Math.random() * 6) + 1;
        const finalResult2 = Math.floor(Math.random() * 6) + 1;
        
        // Animate BOTH dice independently
        const interval = setInterval(() => {
            currentRollDisplay1 = Math.floor(Math.random() * 6) + 1;
            currentRollDisplay2 = Math.floor(Math.random() * 6) + 1;
        }, 50);

        setTimeout(async () => {
            clearInterval(interval);
            // Set BOTH final numbers
            currentRollDisplay1 = finalResult1;
            currentRollDisplay2 = finalResult2;
            isRolling = false;

            // Send BOTH to your server terminal
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
            onclick={onConfirm}
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
                    style="margin-top: 20px; border-color: #e24a4a; color: #e24a4a;"
                    onclick={() => {/*isSubmitted = true;*/ diceRoll()}}   
                    disabled={isRolling}                 
                    onmouseenter={() => $isHovering = true} 
                    onmouseleave={() => $isHovering = false}
                >
                <span class="btn-text">ACTIVATE</span>
                    <span class="btn-sub">CONFIRM SELECTION AND ROLL</span>
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
    /*Sidebar button display*/
    .sidebar_targeting {
        width: 13vw; 
        padding: 1vw; 
        display: flex; 
        flex-direction: column; 
        gap: 0.5vh; 
        z-index: 10;
    }
    .panel-header {
        font-family: 'Chakra Petch', sans-serif; 
        color: #abbbd1; 
        font-size: 3vh;
        border-bottom: 1px solid rgba(171, 187, 209, 0.3); 
        padding-bottom: 10px; 
        letter-spacing: 2px;
    }
    .button-group { 
        display: flex; 
        flex-direction: column; 
        gap: 1vh; 
    }
    button {
        font-family: 'Chakra Petch', sans-serif; 
        color: #abbbd1; 
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(59, 130, 246, 0.3); 
        padding: 15px 20px; 
        cursor: none;
        text-align: left; 
        transition: all 0.2s ease;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        display: flex; 
        flex-direction: column; 
        width: 100%;
    }
    button:hover:not(:disabled) { 
        background: rgba(59, 130, 246, 0.2); 
        color: #fff; 
        border-color: #3b82f6; 
    }
    button.active { 
        background: rgba(59, 130, 246, 0.4); 
        border-color: #3b82f6; 
        color: white; 
        transform: translateX(5px); 
    }
    button:disabled { 
        opacity: 0.5; 
        cursor: not-allowed; 
        filter: grayscale(1); 
    }
    .btn-text { 
        font-size: 2.5vh; 
        font-weight: 700; 
    }
    .btn-sub { 
        font-size: 1.4vh; 
        opacity: 0.7; 
    }
    .btn-hint { 
        font-size: 1.2vh; 
        color: #555; 
        margin-top: 4px; 
    }

    /* Dice rolling display*/
    .roll-display {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        background: rgba(0, 0, 0, 0.8);
        border: 1px solid #22c55e;
        padding: 10px;
        margin-top: 10px;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        transition: all 0.2s ease;
    }
    .roll-label {
        font-family: 'Chakra Petch', sans-serif;
        font-size: 1.4vh;
        color: #abbbd1;
        letter-spacing: 2px;
    }
    .roll-number {
        font-family: 'Chakra Petch', sans-serif;
        font-size: 8vh;
        font-weight: 700;
        color: #22c55e;
    }
    /* Adds a subtle pulse effect while the numbers are rapidly changing */
    .is-rolling .roll-number {
        color: #e24a4a;
        opacity: 0.8;
        transform: scale(1.5);
        transition: transform 0.10s ease;
    }
</style>