<script>
    import { defineHex, Grid, rectangle } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';

    // 1. Setup Grid
    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: 'flat', offset: 1 });
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));

    const gridHexes = [...grid];

    // 2. State
    let hoveredHex = $state(null);
    let selectedGroup = $state([]);
    let targetingMode = $state('focus'); // Options: 'focus', 'directional', 'area'

    // 3. Configuration: Map coordinates to specific image files
    const specialTiles = [
        { col: 1, row: 2, img: 'single_palm.jpg' },
        { col: 2, row: 1, img: 'double_palm.jpg' },
        { col: 2, row: 4, img: 'tree.jpg' },
        { col: 3, row: 4, img: 'hill.jpg' },
        { col: 4, row: 3, img: 'peak.jpg' },
        { col: 5, row: 2, img: 'mountain.jpg' }
    ];

    function getTileConfig(hex) {
        return specialTiles.find(t => t.col === hex.col && t.row === hex.row);
    }

    function getLabel(hex) {
        return `${String.fromCharCode(65 + hex.col)}-${hex.row + 1}`;
    }

    function setMode(mode) {
        targetingMode = mode;
        selectedGroup = []; // Clear selection on mode switch
    }

    // 4. LOGIC: Calculate Neighbors (Targeting Logic)
    function getTargetHexes(centerHex, mode) {
        if (!centerHex) return [];
        
        // Focus: Just the center
        if (mode === 'focus') return [centerHex];

        // Find neighbors (Distance = 1)
        const neighbors = gridHexes.filter(h => {
            if (h === centerHex) return false;
            const dist = (Math.abs(h.q - centerHex.q) 
                        + Math.abs(h.r - centerHex.r) 
                        + Math.abs(h.s - centerHex.s)) / 2;
            return dist === 1; 
        });

        // Directional: Center + 2 neighbors
        if (mode === 'directional') return [centerHex, ...neighbors.slice(0, 2)];

        // Area: Center + 3 neighbors
        if (mode === 'area') return [centerHex, ...neighbors.slice(0, 3)];
        
        return [centerHex];
    }

    // 5. REACTIVITY: Automatically update list
    let highlightedHexes = $derived(getTargetHexes(hoveredHex, targetingMode));

    function HandleHexClick(hex){
        // FIXED: Now uses 'selectedGroup' consistently
        if (selectedGroup.includes(hex)) {
            selectedGroup = [];
        } else {
            selectedGroup = [...highlightedHexes];
        }
    }
</script>

<div class="layout-container">
    
    <div class="sidebar">
        <h3 class="panel-header">TARGETING</h3>
        
        <div class="button-group">
            <button 
                class:active={targetingMode === 'focus'} 
                onclick={() => setMode('focus')}
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
            >
                <span class="btn-text">FOCUS</span>
                <span class="btn-sub">SINGLE CELL</span>
            </button>

            <button 
                class:active={targetingMode === 'directional'} 
                onclick={() => setMode('directional')}
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
            >
                <span class="btn-text">DIRECTIONAL</span>
                <span class="btn-sub">ADJACENT ROW</span>
            </button>

            <button 
                class:active={targetingMode === 'area'} 
                onclick={() => setMode('area')}
                onmouseenter={() => $isHovering = true} 
                onmouseleave={() => $isHovering = false}
            >
                <span class="btn-text">AREA</span>
                <span class="btn-sub">4 ADJACENT CELLS</span>
            </button>
        </div>
    </div>

    <div class="map-area">
        <svg 
            viewBox="0 0 1000 600"
            preserveAspectRatio="xMidYMid meet"
            class="tactical-grid"
        >
        <defs>
            <pattern id="water-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                <image href="water2.jpg" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid slice"/>
            </pattern>
            
            {#each specialTiles as tile}
                <pattern 
                    id={`pattern-${tile.col}-${tile.row}`} 
                    patternUnits="objectBoundingBox" 
                    width="1" height="1" 
                    viewBox="0 0 1 1"
                >
                    <image 
                        href={tile.img} 
                        x="-0.1" y="-0.1" 
                        width="1.2" height="1.2" 
                        preserveAspectRatio="xMidYMid slice"
                    />
                </pattern>
            {/each}
        </defs>

        <g transform="translate(55, 10)"> 
            {#each grid as hex}
                {@const specialConfig = getTileConfig(hex)}
                {@const isActive = highlightedHexes.includes(hex)}
                
                <g 
                    class="hex-group"
                    role="button" 
                    tabindex="0"
                    onclick={() => HandleHexClick(hex)}
                    onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
                    onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
                    onkeydown={(e) => e.key === 'Enter' && HandleHexClick(hex)}
                >
                    <polygon
                        points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                        fill={specialConfig ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"}
                        stroke="black"
                        stroke-width="1"
                    />

                    <polygon
                        points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                        stroke="black"
                        stroke-width={hex === selectedGroup ? 4 : 0} 
                        fill={
                            hex === selectedGroup ? 'rgba(226, 74, 74, 0.6)' : 
                            isActive            ? 'rgba(59, 130, 246, 0.4)' : 
                            'rgba(0, 0, 0, 0.05)'
                        }
                        style="pointer-events: none;" 
                    />
                    
                    {#if isActive || hex === selectedGroup}
                        <text 
                            x={hex.x} y={hex.y} dy="25" 
                            text-anchor="middle" 
                            fill="white" font-size="20" font-weight="bold" pointer-events="none"
                            style="text-shadow: 0px 0px 4px #000;"
                        >
                            {getLabel(hex)}
                        </text>
                    {/if}
                </g>
            {/each}
        </g>
        </svg>
    </div>
</div>

<style>
    /* --- LAYOUT --- */
    .layout-container {
        display: flex;
        width: 100vw;
        height: 100vh;
        overflow: hidden; /* Prevent scrolling */
        background: transparent; /* Let layout background show through */
    }

    /* --- SIDEBAR --- */
    .sidebar {
        width: 13vw; /* Fixed width for stability */
        padding: 1vw;
        display: flex;
        flex-direction: column;
        gap: 2vh;
        z-index: 10;
    }

    .panel-header {
        font-family: 'Chakra Petch', sans-serif;
        color: #abbbd1;
        font-size: 3vh;
        border-bottom: 1px solid rgba(171, 187, 209, 0.3);
        padding-bottom: 10px;
        margin-bottom: 20px;
        letter-spacing: 2px;
    }

    .button-group {
        display: flex;
        flex-direction: column;
        gap: 20px;
    }

    /* --- BUTTONS (Matched to +layout.svelte Return Button) --- */
    button {
        font-family: 'Chakra Petch', sans-serif;
        color: #abbbd1;
        background: rgba(0, 0, 0, 0.8); /* Match layout button background */
        border: 1px solid rgba(59, 130, 246, 0.3); /* Match layout button border */
        padding: 15px 20px;
        cursor: none; /* Custom cursor handling */
        text-align: left;
        transition: all 0.2s ease;
        
        /* The Sci-Fi Corner Cut - Matching +layout.svelte [cite: 73] */
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        
        display: flex;
        flex-direction: column;
    }

    .btn-text {
        font-size: 3.5vh;
        font-weight: 700;
    }

    .btn-sub {
        font-size: 1.7vh;
        opacity: 0.7;
        margin-top: 2px;
    }

    button:hover {
        color: #fff;
        background: rgba(59, 130, 246, 0.2);
        border-color: #3b82f6;
        text-shadow: 0 0 10px #3b82f6;
        transform: translateX(5px);
    }

    /* Active State (Selected Mode) */
    button.active {
        background: rgba(59, 130, 246, 0.4);
        border-color: #3b82f6;
        color: white;
        text-shadow: 0 0 10px #3b82f6;
        transform: translateX(10px);
    }

    /* --- MAP AREA --- */
    .map-area {
        flex-grow: 1;
        display: flex;
        justify-content: flex-start;
        align-items: center;
        position: relative;
    }

    .tactical-grid {
        width:70%;
        height: 80%;
        user-select: none;
        /* Slight drop shadow to separate map from global background */
        filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); 
    }

    .hex-group {
        transition: all 0.2s ease;
        cursor: none; /* Ensure custom cursor is visible */
    }

    .hex-group:hover polygon {
        filter: drop-shadow(0 0 8px rgba(255, 255, 255, 0.6));
        z-index: 10; 
    }
</style>