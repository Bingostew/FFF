<script>
    // @ts-nocheck
    // Import the hex grid and custom cursor. 
    import { defineHex, Grid, rectangle, Orientation } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';

    // 1. Setup Grid
    // Hex Tile class.
    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: Orientation.FLAT, offset: 1 });
    // Grid that takes the Hex Tiles and turns it into the working map
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));
    const gridHexes = [...grid];

    // 2. State, reactions to cursor movements, hovering, selecting, and ISR options. 
    let hoveredHex = $state(null);
    let selectedGroup = $state([]);
    let targetingMode = $state('focus'); // Options: 'focus', 'directional', 'area'

    // Rotation enables us to make directional focus more dynamic. getS is a helper function.
    let rotation = $state(0);
    const getS = (h) => -h.q - h.r;

    // Configuration: Map coordinates to specific image files,by default all tiles
    // appear as water tiles. This adds land objects. 
    const specialTiles = [
        { col: 1, row: 2, img: 'single_palm.jpg' },
        { col: 2, row: 1, img: 'double_palm.jpg' },
        { col: 2, row: 4, img: 'tree.jpg' },
        { col: 3, row: 4, img: 'hill.jpg' },
        { col: 4, row: 3, img: 'peak.jpg' },
        { col: 5, row: 2, img: 'mountain.jpg' }
    ];

    // Checks if the tile is a non default tile
    function getTileConfig(hex) {
        return specialTiles.find(t => t.col === hex.col && t.row === hex.row);
    }

    // Returns the column and row of the hex cell. 
    function getLabel(hex) {
        return `${String.fromCharCode(65 + hex.col)}-${hex.row + 1}`;
    }

    // Set the mode for specific targeting 
    function setMode(mode) {
        targetingMode = mode;
        selectedGroup = []; // Clear selection on mode switch
    }

    // Calculate Neighbors (Targeting Logic)
    function getTargetHexes(centerHex, mode, rot) {
        if (!centerHex) return [];
        
        // Focus (Single Cell)
        if (mode === 'focus') return [centerHex];

        // Directional (3 in a line)
        if (mode === 'directional') {
            const rotIndex = rot % 3;
            let lineHexes = [];

            //Gather all hexes on the specific line
            if (rotIndex === 0) {
                // Axis 0: Vertical (Same Column)
                lineHexes = gridHexes.filter(h => h.col === centerHex.col);
                // Sort by Row so they are in order top-to-bottom
                lineHexes.sort((a, b) => a.row - b.row);
            } 
            else if (rotIndex === 1) {
                // Axis 1: Slant Right (Same R)
                lineHexes = gridHexes.filter(h => h.r === centerHex.r);
                // Sort by Q (Column) to ensure order
                lineHexes.sort((a, b) => a.q - b.q);
            } 
            else if (rotIndex === 2) {
                // Axis 2: Slant Left (Same S)
                const centerS = getS(centerHex);
                lineHexes = gridHexes.filter(h => getS(h) === centerS);
                // Sort by Q to ensure order
                lineHexes.sort((a, b) => a.q - b.q);
            }

            // Find where the cursor is in that line
            const index = lineHexes.indexOf(centerHex);
            
            // Calculate the "Window" start point and center selection
            let startIndex = index - 1;

            // (index 0), remain at 0.
            if (startIndex < 0) startIndex = 0;
            
            if (startIndex > lineHexes.length - 3) {
                startIndex = Math.max(0, lineHexes.length - 3);
            }

            // Return the 3 hexes
            return lineHexes.slice(startIndex, startIndex + 3);
        }
        
        if (mode === 'area') {
            // Get all immediate neighbors
            const neighbors = gridHexes.filter((/** @type {any} */ h) => {
                if (h === centerHex) return false;
                const dist = (Math.abs(h.q - centerHex.q) 
                            + Math.abs(h.r - centerHex.r) 
                            + Math.abs(getS(h) - getS(centerHex))) / 2;
                return dist === 1; 
            });

            // This ensures the selected hexes are always touching each other
            neighbors.sort((a, b) => {
                const angA = Math.atan2(a.y - centerHex.y, a.x - centerHex.x);
                const angB = Math.atan2(b.y - centerHex.y, b.x - centerHex.x);
                return angA - angB;
            });

            // 3. Slice the first 3 (Edge Safety)
            return [centerHex, ...neighbors.slice(0, 3)];
        }
    }

    // Automatically update list as user cursors over hex cells. 
    let highlightedHexes = $derived(getTargetHexes(hoveredHex, targetingMode, rotation));

    // Updates selection status if a hex is clicked. 
    function HandleHexClick(hex){
        if (selectedGroup.includes(hex)) {
            selectedGroup = [];
        } else {
            selectedGroup = [...highlightedHexes];
        }
    }

    //On right-click with directional scan, selected area will rotate.
    function cycleRotation(e) {
        //Prevents the rightclick menu from popping up.
        if (e) e.preventDefault();
        rotation += 1;
    }
</script>

<div class="layout-container">
    
    <div class="sidebar_targeting">
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
                
                oncontextmenu={cycleRotation}
                
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
                <span class="btn-hint" style="font-size: 1.5vh; color: #555;">[R-CLICK TO ROTATE]</span>
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
            oncontextmenu={cycleRotation}
            role="application" 
            aria-label="Tactical Map"
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
                
                <g 
                    class="hex-cell"
                    role="button" 
                    tabindex="0"
                    onclick={() => HandleHexClick(hex)}
                    oncontextmenu={(e) => { e.stopPropagation(); cycleRotation(e); }}
                    onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
                    onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
                    onkeydown={(e) => e.key === 'Enter' && HandleHexClick(hex)}
                >
                    <polygon
                        points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                        fill={specialConfig ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"}
                        stroke="black"
                        stroke-width="0.5"
                    />
                </g>
            {/each}

            {#each grid as hex}
                {@const isActive = highlightedHexes.includes(hex)}
                {@const isSelected = selectedGroup.includes(hex)}
                
                {#if isActive || isSelected}
                    <g pointer-events="none">
                        <polygon
                            points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                            fill={
                                isSelected ? 'rgba(200, 74, 74, 0.6)' : 
                                isActive   ? 'rgba(59, 130, 246, 0.4)' : 'none'
                            }
                            stroke={isSelected ? "#e24a4a" : "#3b82f6"}
                            stroke-width={isSelected ? 4 : 2}
                            stroke-linejoin="round"
                        />

                        <text 
                            x={hex.x} y={hex.y} dy="25" 
                            text-anchor="middle" 
                            fill="white" font-size="20" font-weight="bold"
                            style="text-shadow: 0px 0px 4px #000;"
                        >
                            {getLabel(hex)}
                        </text>
                    </g>
                {/if}
            {/each}

        </g>

        </svg>
    </div>
</div>

<style>
    /* --- LAYOUT --- */
    .layout-container {
        display: flex;
        flex-direction: row;
        width: 100vw;
        height: 100vh;
        overflow: hidden; /* Prevent scrolling */
        background: transparent; /* Let layout background show through */
    }

    /* --- sidebar_targeting --- */
    .sidebar_targeting {
        width: 13vw; 
        height: 13vh;
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

    /* --- BUTTONS--- */
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
</style>