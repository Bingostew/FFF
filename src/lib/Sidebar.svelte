<script>
    import { isHovering } from '$lib/store';
    
    // Props using Svelte 5 syntax
    let { 
        targetingMode = $bindable(), 
        isConfirmed = $bindable(), 
        fleetSelections, 
        rotation, 
        onConfirm, 
        onCycleRotation 
    } = $props();

    function setMode(mode) {
        targetingMode = mode;
    }
</script>

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
            class="action-btn" 
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
                oncontextmenu={onCycleRotation}
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
        </div>
    {/if}
</div>

<style>
    .sidebar_targeting {
        width: 13vw; padding: 1vw; display: flex; flex-direction: column; gap: 2vh; z-index: 10;
    }
    .panel-header {
        font-family: 'Chakra Petch', sans-serif; color: #abbbd1; font-size: 3vh;
        border-bottom: 1px solid rgba(171, 187, 209, 0.3); padding-bottom: 10px; letter-spacing: 2px;
    }
    .button-group { display: flex; flex-direction: column; gap: 20px; }
    .fleet-panel { padding: 1vw; border: 1px dashed rgba(59, 130, 246, 0.5); background: rgba(0, 0, 0, 0.4); margin-bottom: 2vh; }
    .status-text { font-family: 'Chakra Petch', sans-serif; color: #abbbd1; }
    .status-text.ready { color: #22c55e; }
    
    button {
        font-family: 'Chakra Petch', sans-serif; color: #abbbd1; background: rgba(0, 0, 0, 0.8);
        border: 1px solid rgba(59, 130, 246, 0.3); padding: 15px 20px; cursor: pointer;
        text-align: left; transition: all 0.2s ease;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        display: flex; flex-direction: column; width: 100%;
    }
    button:hover:not(:disabled) { background: rgba(59, 130, 246, 0.2); color: #fff; border-color: #3b82f6; }
    button.active { background: rgba(59, 130, 246, 0.4); border-color: #3b82f6; color: white; transform: translateX(5px); }
    button:disabled { opacity: 0.5; cursor: not-allowed; filter: grayscale(1); }
    .btn-text { font-size: 2.5vh; font-weight: 700; }
    .btn-sub { font-size: 1.4vh; opacity: 0.7; }
    .btn-hint { font-size: 1.2vh; color: #555; margin-top: 4px; }
</style>