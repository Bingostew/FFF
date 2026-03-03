<!--SIDEBAR, DISPLAYS DEPLOYMENT, ATTACK, ROLL INFORMATION-->
<!--SCRIPTS FOR THE SIDEBAR-->
<script>
    // @ts-nocheck

    // Import custom cursor
    import { isHovering } from '$lib/store';
    
    // Used for API calls to server
    let isSubmitted = $state(false);
    
    // State variables for dice rolling functionality.
    let currentRollDisplay1 = $state(0);
    let currentRollDisplay2 = $state(0);    
    let isRolling = $state(false);

    // Standard JS props (using defaults to prevent crashes)
    let { 
        targetingMode = $bindable(), 
        isConfirmed = $bindable(), 
        rotation = $bindable(),
        fleetSelections, 
        onConfirm,
        onActivate,
        isEnemyTurn = $bindable(false),
        onSearch
    } = $props();

    // Simulates 2 D6 dice roll, does two simultaneous calculations.
    function diceRoll() {
        if (isRolling || isEnemyTurn) return; 

        isRolling = true;
        onSearch(); 

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

        }, 3000); //Roll for 3 seconds.
    }
</script>

<!--SIDEBAR CONTENT-->
<!--Will not appear until fleets are deployed-->
{#if !isSubmitted}
    <div class="sidebar_targeting">
        <!--<div class="lock-overlay">SYSTEM LOCKED: WAITING FOR ENEMY</div>-->
        
        <div class="button-group">
            <button 
                class:active={targetingMode === 'focus'} 
                onclick={() => {targetingMode === 'focus'}}
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
            >
                <span class="btn-text">FOCUS</span>
                <span class="btn-sub">SINGLE CELL</span>
            </button>

            <button 
                class:active={targetingMode === 'directional'} 
                onclick={() => targetingMode = 'directional'}
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
            >
                <span class="btn-text">DIRECTIONAL</span>
                <span class="btn-sub">
                    {#if rotation % 3 === 0} VERTICAL
                    {:else if rotation % 3 === 1} SLANT RIGHT
                    {:else} SLANT LEFT
                    {/if}
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
                    style="margin-top: 10px; border-color: #e24a4a; color: #e24a4a;"
                    onclick={() => { onActivate();} }   
                    disabled={isRolling || isEnemyTurn}                
                    onmouseenter={() => $isHovering = true} 
                    onmouseleave={() => $isHovering = false}
                >
                    <span class="btn-text">FOCUS</span>
                    <span class="btn-sub">SINGLE CELL</span>
                </button>

                <button 
                    class:active={targetingMode === 'directional'} 
                    onclick={() => targetingMode = 'directional'}
                    onmouseenter={() => $isHovering = true} 
                    onmouseleave={() => $isHovering = false}
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
                        disabled={isRolling}                
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

    /*DICE ROLLING DISPLAY*/
    /*Layout and organization of dice roll display content*/
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
    
    /*Roll Result*/
    .roll-label { 
        font-family: 'Chakra Petch', sans-serif; 
        font-size: clamp(0.7rem, 1.4vh, 1rem); 
        color: #abbbd1; 
        letter-spacing: 2px; 
        margin-bottom: 5px;
    }    

    /*Appearance of the rolled number*/
    .roll-number { 
        font-family: 'Chakra Petch', sans-serif; 
        font-size: clamp(2.5rem, 6vh, 4.5rem); 
        font-weight: 700; 
        color: #22c55e; 
    }
    
    /*Appearance of the number while it is rolling, enable a reactive sizing change*/ 
    .is-rolling .roll-number { 
        color: #e24a4a; 
        opacity: 0.8; 
        transform: scale(1.2); 
        transition: transform 0.10s ease; 
    }

    /* Custom scrollbars, might be removed in pursuit of better scaling */
    /*::-webkit-scrollbar {
        width: 6px; 
        cursor: none;
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