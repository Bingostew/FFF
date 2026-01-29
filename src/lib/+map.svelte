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

    let warning = $state({ show: false, x: 0, y: 0, text: '' });
    let warningTimer; // To handle the fading timeout

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
        if (mode === 'focus' || mode === 'area') return [centerHex];

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

            const selection = lineHexes.slice(startIndex, startIndex + 3);
            
            // Only highlight if we have a full line of 3. 
            // If we have 1 or 2 (edge of map), return empty to show no target.
            return selection.length === 3 ? selection : [];
        }
    }

    // Automatically update list as user cursors over hex cells. 
    let highlightedHexes = $derived(getTargetHexes(hoveredHex, targetingMode, rotation));

    function isGroupConnected(group) {
        if (group.length <= 1) return true;

        // Start flood fill from the first hex
        const start = group[0];
        const visited = new Set([start]);
        const queue = [start];

        while (queue.length > 0) {
            const current = queue.shift();
            
            // Find neighbors of 'current' that are also in the 'group'
            const neighbors = group.filter(h => {
                if (visited.has(h)) return false;
                const dist = (Math.abs(h.q - current.q) 
                            + Math.abs(h.r - current.r) 
                            + Math.abs(getS(h) - getS(current))) / 2;
                return dist === 1;
            });

            // Add unvisited neighbors to queue
            for (const neighbor of neighbors) {
                visited.add(neighbor);
                queue.push(neighbor);
            }
        }

        // If we visited every node in the group, it's fully connected
        return visited.size === group.length;
    }

    // Updates selection status if a hex is clicked. 
    function HandleHexClick(event, hex){

        if (targetingMode === 'directional'){
            if (selectedGroup.some(h => highlightedHexes.includes(h))) {
                selectedGroup = [];
            } else {
                selectedGroup = [...highlightedHexes];
            }
            return;
        }

        const index = selectedGroup.indexOf(hex);
        
        // Toggle Off
        if (index > -1) {

            // Prevent splitting the group in Area mode
            if (targetingMode === 'area') {
                // Create a temporary group excluding the hex we want to remove
                const potentialGroup = [...selectedGroup];
                potentialGroup.splice(index, 1);

                // Check if the remaining hexes are still one continuous shape
                if (!isGroupConnected(potentialGroup)) {
                    showWarning(event.clientX, event.clientY, "Cannot split: diselection will cause disconnecting hexes");
                    return; // Stop the deselection
                }
            }

            selectedGroup.splice(index, 1);
            selectedGroup = [...selectedGroup];
            return;
        }

        if(targetingMode === 'focus'){
            // 1. Check Limit
            if (selectedGroup.length >= 3) {
                showWarning(event.clientX, event.clientY, "Can not select more than 3 hexes");
                return;
            }

            // 2. Check Adjacency
            // We compare the clicked 'hex' against every 's' in selectedGroup
            const isAdjacent = selectedGroup.some(s => {
                const dist = (Math.abs(s.q - hex.q) 
                            + Math.abs(s.r - hex.r) 
                            + Math.abs(getS(s) - getS(hex))) / 2;
                return dist === 1; // Distance 1 means they are touching
            });

            if (isAdjacent) {
                showWarning(event.clientX, event.clientY, "Can not select an adjacent hex");
            } else {
                // Valid selection
                selectedGroup = [...selectedGroup, hex];
            }
        }
        
        else if (targetingMode === 'area'){
            if (selectedGroup.length >= 4) {
                showWarning(event.clientX, event.clientY, "Can not select more than 4 hexes");
                return;
            }
            
            // Check Connectivity 
            // If group is empty, the first click is always valid.
            if (selectedGroup.length > 0) {
                const isTouching = selectedGroup.some(s => {
                    const dist = (Math.abs(s.q - hex.q) + Math.abs(s.r - hex.r) + Math.abs(getS(s) - getS(hex))) / 2;
                    return dist === 1;
                });
                
                if (!isTouching) {
                    showWarning(event.clientX, event.clientY, "Hexes must be adjacent");
                    return;
                }
            }
            selectedGroup = [...selectedGroup, hex];
        }
        
    }

    // Helper to show temporary warning
    function showWarning(x, y, text) {
        warning = { show: true, x, y, text, id: Date.now() };
        if (warningTimer) clearTimeout(warningTimer);
        warningTimer = setTimeout(() => {
            warning.show = false;
        }, 1500); // Fades out after 1.5 seconds
    }

    //On right-click with directional scan, selected area will rotate.
    function cycleRotation(e) {
        //Prevents the rightclick menu from popping up.
        if (e) e.preventDefault();

        // If not in directional mode or no hex is hovered, just rotate normally
        if (targetingMode !== 'directional' || !hoveredHex) {
            rotation += 1;
            return;
        }

        // Look ahead at the next 3 possible rotations (1, 2, 3 steps ahead)
        for (let i = 1; i <= 3; i++) {
            const nextRot = rotation + i;
            const predictedHexes = getTargetHexes(hoveredHex, targetingMode, nextRot);
            
            // If this rotation yields a full line (3 hexes) OR we've tried all 3 options, apply it.
            // This effectively skips any rotation that would result in < 3 hexes.
            if (predictedHexes.length === 3 || i === 3) {
                rotation = nextRot;
                break;
            }
        }
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
                    onclick={(e) => HandleHexClick(e, hex)}
                    oncontextmenu={(e) => { e.stopPropagation(); cycleRotation(e); }}
                    onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
                    onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
                    onkeydown={(e) => e.key === 'Enter' && HandleHexClick(e, hex)}
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

      

        {#if warning.show}
            {#key warning.id} <div 
                    class="cursor-warning" 
                    style="top: {warning.y}px; left: {warning.x}px;"
                >
                    {warning.text}
                </div>
            {/key}
        {/if}
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

    .cursor-warning {
        position: fixed; /* Fixed to screen coordinates */
        pointer-events: none; /* Let clicks pass through */
        background: transparent; 
        color: #e45c5c;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 25px; /* Slightly bigger */
        font-weight: 600;
        white-space: nowrap; /* Keep on one line */
        opacity: 0;
        transform: translate(15px, -20px);
        z-index: 1000;
        animation: popAndFade 1.5s forwards;
        text-shadow: 0px 0px 10px rgba(255, 51, 51, 0.6);
        -webkit-text-stroke: 1px black;
    }

@keyframes popAndFade {
        /* 0%: Start small and slightly below cursor */
        0% {
            opacity: 0;
            transform: translate(15px, 0px) scale(0.5);
        }
        
        /* 15%: POP! Snap up and scale up to 120% size */
        15% {
            opacity: 1;
            transform: translate(15px, -25px) scale(1.2);
        }
        
        /* 25%: Settle down to normal size (100%) */
        25% {
            transform: translate(15px, -20px) scale(1);
        }
        
        /* 70%: Hold position (Text is readable here) */
        70% {
            opacity: 1;
            transform: translate(15px, -20px) scale(1);
        }
        
        /* 100%: Fade out and drift upward */
        100% {
            opacity: 0;
            transform: translate(15px, -40px) scale(1);
        }
    }
</style>