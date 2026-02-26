<script>
    import { gameStore, gameActions } from '$lib/game/gameStore.js';
    import { HexUtils } from '$lib/game/HexUtils.js';

    // --- CONFIGURATION ---
    const HEX_SIZE = 40; // Radius of one hexagon in pixels
    const HEX_WIDTH = Math.sqrt(3) * HEX_SIZE;
    const HEX_HEIGHT = 2 * HEX_SIZE;
    
    // --- STATE ---
    let selectedShipId = null;
    let validMoves = []; // Array of strings like ['B2', 'C3']

    // --- HELPERS ---

    // 1. Calculate pixel (x, y) for a hex based on Odd-Q layout
    // (Columns A, B, C... are shunted up/down)
    function hexToPixel(col, row) {
        const x = HEX_SIZE * 3/2 * col;
        const y = HEX_SIZE * Math.sqrt(3) * (row + 0.5 * (col & 1));
        return { x: x + HEX_SIZE + 20, y: y + HEX_SIZE + 20 }; // +Offset for padding
    }

    // 2. Generate the points string for a pointy-top hexagon
    function getHexPoints() {
        const angles = [0, 60, 120, 180, 240, 300];
        return angles.map(angle => {
            const rad = Math.PI / 180 * angle;
            return `${HEX_SIZE * Math.cos(rad)},${HEX_SIZE * Math.sin(rad)}`;
        }).join(' ');
    }
    const hexPoints = getHexPoints(); // Calculate once

    // 3. Handle Clicks
    function handleHexClick(hexID) {
        const game = $gameStore;
        
        // Only allow interaction on RED turn
        if (game.currentPlayer !== 'RED') return;

        // Check if we clicked a ship
        const clickedShip = game.redFleets.find(f => f.pos === hexID && f.hp > 0);

        if (clickedShip) {
            // SELECT SHIP
            selectedShipId = clickedShip.id;
            // Get valid moves for highlighting
            // Filter global legal moves to just this ship
            validMoves = game.getLegalMoves()
                .filter(m => m.startsWith(`MOVE_${selectedShipId}`))
                .map(m => m.split('_')[2]); // Extract "B2" from "MOVE_R1_B2"
        } 
        else if (selectedShipId && validMoves.includes(hexID)) {
            // MOVE SHIP
            const moveCmd = `MOVE_${selectedShipId}_${hexID}`;
            gameActions.executeMove(moveCmd);
            
            // Cleanup
            selectedShipId = null;
            validMoves = [];
        } else {
            // Deselect
            selectedShipId = null;
            validMoves = [];
        }
    }

    // 4. Generate the Grid (A1 to G6)
    const columns = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const rows = [1, 2, 3, 4, 5, 6];
    
    // Create a flat array of all hex objects to iterate over
    const gridHexes = [];
    columns.forEach((colChar, cIndex) => {
        rows.forEach((rowNum, rIndex) => {
            gridHexes.push({
                id: `${colChar}${rowNum}`,
                col: cIndex,
                row: rIndex - 1 // 0-indexed row
            });
        });
    });

    // 5. Get Ship Data for Rendering
    // We make this reactive $: so it updates when $gameStore changes
    $: getShipAt = (hexID) => {
        // Is there a Red ship?
        const red = $gameStore.redFleets.find(f => f.pos === hexID && f.hp > 0);
        if (red) return { type: 'RED', id: red.id };

        // Is there a Blue ship? (Only show if NOT hidden or found in Intel)
        // For this demo, we show them if 'isHidden' is false OR just for testing
        const blue = $gameStore.blueFleets.find(f => f.pos === hexID && f.hp > 0);
        if (blue && !blue.isHidden) return { type: 'BLUE', id: blue.id };
        
        // Debug: Show blue ghost if hidden (remove this line for real gameplay)
        if (blue && blue.isHidden) return { type: 'GHOST', id: '?' }; 

        return null;
    };

</script>

<div class="hex-map-container">
    <svg viewBox="0 0 600 500" class="map-svg">
        
        {#each gridHexes as hex (hex.id)}
            {@const pixel = hexToPixel(hex.col, hex.row)}
            {@const ship = getShipAt(hex.id)}
            {@const isValidMove = validMoves.includes(hex.id)}
            {@const isSelected = (ship && ship.id === selectedShipId)}

            <g 
                transform="translate({pixel.x}, {pixel.y})"
                onclick={() => handleHexClick(hex.id)}
                class="hex-group"
                role="button" 
                tabindex="0"
                onkeypress={() => {}}
            >
                <polygon 
                    points={hexPoints}
                    class="hex-shape {isValidMove ? 'highlight-move' : ''} {isSelected ? 'highlight-selected' : ''}"
                />
                
                {#if !ship}
                    <text class="coord-label" y="5">{hex.id}</text>
                {/if}

                {#if ship}
                    <circle r="15" class="ship {ship.type === 'RED' ? 'ship-red' : (ship.type === 'GHOST' ? 'ship-ghost' : 'ship-blue')}" />
                    <text class="ship-label" y="5">{ship.id}</text>
                {/if}
            </g>
        {/each}

    </svg>
</div>

<style>
    .hex-map-container {
        width: 100%;
        height: 100%;
        display: flex;
        justify-content: center;
        align-items: center;
        overflow: visible;
    }

    .map-svg {
        width: 100%;
        max-width: 800px;
        overflow: visible;
    }

    .hex-group {
        cursor: pointer;
        transition: transform 0.1s;
    }
    .hex-group:hover {
        /* Slight zoom on hover */
        transform-box: fill-box;
        transform-origin: center;
        transform: scale(1.1) translate(0,0); 
    }

    /* Hexagon visual style */
    .hex-shape {
        fill: rgba(16, 24, 45, 0.9);
        stroke: #3b82f6; /* Blue border */
        stroke-width: 1px;
        transition: fill 0.2s;
    }
    .hex-shape:hover {
        fill: rgba(59, 130, 246, 0.3);
    }

    /* Highlights */
    .highlight-move {
        fill: rgba(0, 255, 0, 0.2) !important;
        stroke: #0f0;
        stroke-width: 2px;
    }
    .highlight-selected {
        stroke: #fff;
        stroke-width: 3px;
        fill: rgba(255, 255, 255, 0.1);
    }

    /* Text Styles */
    .coord-label {
        font-family: 'Courier New', monospace;
        font-size: 10px;
        fill: #3b82f6;
        text-anchor: middle;
        pointer-events: none; /* Let clicks pass through to the polygon */
        opacity: 0.6;
    }

    .ship-label {
        font-family: sans-serif;
        font-size: 10px;
        fill: white;
        font-weight: bold;
        text-anchor: middle;
        pointer-events: none;
    }

    /* Ships */
    .ship { transition: r 0.2s; }
    .ship-red { fill: #ef4444; stroke: white; stroke-width: 1px; }
    .ship-blue { fill: #3b82f6; stroke: white; stroke-width: 1px; }
    .ship-ghost { fill: transparent; stroke: #3b82f6; stroke-dasharray: 4 2; }
</style>