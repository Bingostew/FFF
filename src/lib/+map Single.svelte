<!--MAP, INTERACTIVELY DISPLAYS GRIDS, ALL DATA SURROUNDING GRIDS, FLEET LOCATIONS-->
<!--SCRIPTS FOR MAP-->
<script>
    // @ts-nocheck
    import { defineHex, Grid, rectangle, Orientation } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';
    import { getTargetHexes, isGroupConnected, getS } from './gridUtils.js';
    import Sidebar from './Sidebar Single.svelte';
    import StatusBar from './StatusBar Single.svelte';

    // Grid Config
    const Tile = defineHex({ 
        dimensions: 50, 
        origin: 'topLeft', 
        orientation: Orientation.FLAT, 
        offset: 1 
    });
    
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));
    const gridHexes = [...grid];

    // --- GLOBAL STATE ---
    // Moved these to the top so isMyTurn can safely read them!
    let isConfirmed = $state(false);
    let isEnemyTurn = $state(false);
    const isMyTurn = $derived(!isConfirmed || !isEnemyTurn);  

    let hoveredHex = $state(null);
    let selectedGroup = $state([]);
    let targetingMode = $state('focus');
    let fleetSelections = $state([]);
    let rotation = $state(0);
    let warning = $state({ show: false, x: 0, y: 0, text: '', id: 0 });
    
    // Status state
    let health = $state(2);
    let fuel = $state(3);
    let currentTurn = $state(1);
    let friendlySearchedHexes = $state([]);
    let enemySearchedHexes = $state([]);    
    let isRevealed = $state(false);

    // This is the layout of the land tiles
    const specialTiles = [
        { col: 1, row: 2, img: 'single_palm.jpg' },
        { col: 2, row: 1, img: 'double_palm.jpg' },
        { col: 2, row: 4, img: 'tree.jpg' },
        { col: 3, row: 4, img: 'hill.jpg' },
        { col: 4, row: 3, img: 'peak.jpg' },
        { col: 5, row: 2, img: 'mountain.jpg' }
    ];

    // Gets highlighted hexes & automatically filters out land!
    let highlightedHexes = $derived(
        getTargetHexes(hoveredHex, targetingMode, rotation, gridHexes)
        .filter(hex => !specialTiles.some(t => t.col === hex.col && t.row === hex.row))
    );

    // Hex interaction handlers.
    function handleHexClick(event, hex) {
        if (isConfirmed && !isMyTurn) return;

        // GLOBAL LAND CHECK
        const isSpecial = specialTiles.some(t => t.col === hex.col && t.row === hex.row);
        if (isSpecial) {
            showWarning(event.clientX, event.clientY, isConfirmed ? "Cannot select land" : "Cannot place fleet on land");
            return;
        }

        // DEPLOYMENT PHASE
        if (!isConfirmed) {
            const index = fleetSelections.findIndex(h => h.q === hex.q && h.r === hex.r);
            if (index > -1) {
                fleetSelections = fleetSelections.filter(h => h !== fleetSelections[index]);
            } else if (fleetSelections.length < 2) {
                fleetSelections = [...fleetSelections, hex];
            }
            return;
        }

        // TARGETING PHASE
        if (targetingMode === 'directional') {
            // highlightedHexes is already land-free, so we just use it directly!
            selectedGroup = selectedGroup.some(h => highlightedHexes.includes(h)) 
                ? [] 
                : [...highlightedHexes];
            return;
        }

        const idx = selectedGroup.indexOf(hex);
        if (idx > -1) {
            if (targetingMode === 'area') {
                const testGroup = selectedGroup.filter(h => h !== hex);
                if (!isGroupConnected(testGroup)) {
                    showWarning(event.clientX, event.clientY, "Cannot split group");
                    return;
                }
            }
            selectedGroup = selectedGroup.filter(h => h !== hex);
        } else {
            handleNewSelection(event, hex);
        }
    }

    function handleNewSelection(event, hex) {
        if (targetingMode === 'focus') {
            if (selectedGroup.length >= 3) {
                return showWarning(event.clientX, event.clientY, "Limit 3");
            }

            const adjacent = selectedGroup.some(s => {
                const dist = (Math.abs(s.q - hex.q) + Math.abs(s.r - hex.r) + Math.abs(getS(s) - getS(hex))) / 2;
                return dist === 1;
            });

            if (adjacent) {
                showWarning(event.clientX, event.clientY, "No adjacent selection");
            } else {
                selectedGroup = [...selectedGroup, hex];
            }

        } else if (targetingMode === 'area') {
            if (selectedGroup.length >= 4) {
                return showWarning(event.clientX, event.clientY, "Limit 4");
            }

            const touching = selectedGroup.length === 0 || selectedGroup.some(s => {
                const dist = (Math.abs(s.q - hex.q) + Math.abs(s.r - hex.r) + Math.abs(getS(s) - getS(hex))) / 2;
                return dist === 1;
            });

            if (!touching) {
                showWarning(event.clientX, event.clientY, "Must be adjacent");
            } else {
                selectedGroup = [...selectedGroup, hex];
            }
        }
    }

    let warningTimeout;
    function showWarning(x, y, text) {
        clearTimeout(warningTimeout);
        warning = { show: true, x, y, text, id: Date.now() };
        warningTimeout = setTimeout(() => { 
            if (warning.id === warning.id) warning.show = false; 
        }, 1500);
    }

    function confirmFleets() {
        if (fleetSelections.length === 2) {
            console.log("Fleets locked:", fleetSelections.map(f => ({ q: f.q, r: f.r })));
            isConfirmed = true;
            selectedGroup = [];
            targetingMode = 'focus';
        }
    }

    // --- ARTIFICIAL INTELLIGENCE ---

    function triggerEnemyAI() {
        if (gridHexes.length === 0) return;

        const modes = ['focus', 'directional', 'area'];
        const randomMode = modes[Math.floor(Math.random() * modes.length)];
        const randomRotation = Math.floor(Math.random() * 6);
        const randomHex = gridHexes[Math.floor(Math.random() * gridHexes.length)];
        
        const targetHexes = getTargetHexes(randomHex, randomMode, randomRotation, gridHexes);
        
        const newSearches = targetHexes.filter(target => 
            !enemySearchedHexes.some(searched => searched.q === target.q && searched.r === target.r) 
        );
        
        enemySearchedHexes = [...enemySearchedHexes, ...newSearches];
    }

    function executeEnemyTurn() {
        isEnemyTurn = true; // Tells the Status Bar to turn RED

        setTimeout(() => {
            if (gridHexes.length > 0) {
                const modes = ['focus', 'directional', 'area'];
                const randomMode = modes[Math.floor(Math.random() * modes.length)];
                const randomRotation = Math.floor(Math.random() * 6);
                const randomHex = gridHexes[Math.floor(Math.random() * gridHexes.length)];
                
                const targetHexes = getTargetHexes(randomHex, randomMode, randomRotation, gridHexes);
                
                // Filters out hexes already attacked by the AI OR the Player
                const newSearches = targetHexes.filter(target => 
                    !enemySearchedHexes.some(searched => searched.q === target.q && searched.r === target.r) &&
                    !friendlySearchedHexes.some(searched => searched.q === target.q && searched.r === target.r)
                );
                enemySearchedHexes = [...enemySearchedHexes, ...newSearches];
            }
            
            currentTurn += 1;
            isEnemyTurn = false; // Turns the Status Bar back to BLUE
        }, 3000); // 3-second suspense timer!
    }

    function handlePlayerSearch() {
        const newSearches = selectedGroup.filter(selected => 
            !friendlySearchedHexes.some(searched => searched.q === selected.q && searched.r === selected.r)
        );
        
        friendlySearchedHexes = [...friendlySearchedHexes, ...newSearches];
        selectedGroup = []; // Clear selection after activating
    }
</script>

<!--MAP HTML-->
<div class="layout-container">
    <!--LEFT-->
    <Sidebar 
        bind:targetingMode 
        bind:isConfirmed 
        bind:rotation
        bind:isEnemyTurn
        {fleetSelections} 
        {selectedGroup} onConfirm={confirmFleets}
        onSearch={handlePlayerSearch} 
        onTurnEnd={executeEnemyTurn} 
    />

    <!--MIDDLE-->
    <div 
        class="map-area"
        role="application"
        oncontextmenu={(e) => {
            if (targetingMode === 'directional') {
                e.preventDefault();
                rotation++;
            }
        }}
    >
        <svg viewBox="-10 -10 602 620" class="tactical-grid" preserveAspectRatio="xMidYMid meet">
            <defs>
                <pattern id="water-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                    <image 
                        href="/water2.jpg" 
                        x="0" 
                        y="0" 
                        width="200" 
                        height="200" 
                        preserveAspectRatio="xMidYMid slice"
                    />
                </pattern>
                
                <pattern id="ship-pattern" patternUnits="objectBoundingBox" width="1" height="1">
                    <image 
                        href="ship.png" 
                        x="0.1" 
                        y="0.1" 
                        width="10%" 
                        height="10%" 
                        preserveAspectRatio="xMidYMid meet"
                    />
                </pattern>

                {#each specialTiles as tile}
                    <pattern 
                        id={`pattern-${tile.col}-${tile.row}`} 
                        patternUnits="objectBoundingBox" 
                        patternContentUnits="objectBoundingBox" 
                        width="1" 
                        height="1"
                    >
                        <image 
                            href={`/${tile.img}`} 
                            x="0" 
                            y="0" 
                            width="1" 
                            height="1" 
                            preserveAspectRatio="xMidYMid slice"
                        />
                    </pattern>
                {/each}    
            </defs>

            <g transform="translate(30, 40)"> 
                {#each grid as hex}
                    {@const config = specialTiles.find(t => t.col === hex.col && t.row === hex.row)}
                    {@const isFleet = fleetSelections.some(f => f.q === hex.q && f.r === hex.r)}
                    
                    {@const isFriendlySearched = friendlySearchedHexes.some(s => s.q === hex.q && s.r === hex.r)}
                    {@const isEnemySearched = enemySearchedHexes.some(s => s.q === hex.q && s.r === hex.r)}
                    
                    {@const pointsStr = hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                    
                    <g 
                        class="hex-cell"
                        role="button"
                        tabindex="0"
                        onclick={(e) => handleHexClick(e, hex)}
                        onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
                        onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
                        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleHexClick(e, hex)}
                        style="cursor: none; outline: none;"
                    >
                        <polygon
                            points={pointsStr}
                            fill={config ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"}
                            stroke={isFleet ? "#4ade80" : "black"} 
                            stroke-width={isFleet ? 2 : 0.5}
                        />
                        
                        {#if isFleet && isRevealed}
                            <polygon
                                points={pointsStr}
                                fill="rgba(226, 74, 74, 0.3)"
                                stroke="#e24a4a"
                                stroke-width="4"
                                stroke-dasharray="8,4"
                                pointer-events="none"
                            >
                                <animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" repeatCount="indefinite" />
                            </polygon>
                        {/if}

                        <polygon
                            points={pointsStr}
                            fill="url(#ship-pattern)"
                            style="opacity: {isFleet ? 1 : 0}; transition: opacity 0.2s;"
                            pointer-events="none"
                        />

                        {#if isFriendlySearched}
                            <g pointer-events="none" opacity="1">
                                <circle cx={hex.x} cy={hex.y} r="12" fill="none" stroke="#000" stroke-width="3" />
                                <circle cx={hex.x} cy={hex.y} r="3" fill="#000" />
                                <line x1={hex.x - 20} y1={hex.y} x2={hex.x + 20} y2={hex.y} stroke="#000" stroke-width="1.5" stroke-dasharray="4,4" />
                                <line x1={hex.x} y1={hex.y - 20} x2={hex.x} y2={hex.y + 20} stroke="#000" stroke-width="1.5" stroke-dasharray="4,4" />
                            </g>
                        {/if}

                        {#if isEnemySearched}
                            <g pointer-events="none" opacity="1">
                                <polygon 
                                    points="{hex.x},{hex.y - 15} {hex.x + 15},{hex.y} {hex.x},{hex.y + 15} {hex.x - 15},{hex.y}" 
                                    fill="rgba(234, 179, 8, 0.2)" 
                                    stroke="#e24a4a" 
                                    stroke-width="2" 
                                />
                                <circle cx={hex.x} cy={hex.y} r="4" fill="#e24a4a" />
                            </g>
                        {/if}
                    </g>
                {/each}

                {#each grid as hex}
                    {@const isActive = highlightedHexes.includes(hex)}
                    {@const isSelected = selectedGroup.includes(hex)}
                    
                    {#if isConfirmed && (isActive || isSelected)}
                        <g pointer-events="none">
                            <polygon
                                points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                                fill={isSelected ? 'rgba(200, 74, 74, 0.6)' : 'rgba(59, 130, 246, 0.4)'}
                                stroke={isSelected ? "#e24a4a" : "#3b82f6"}
                                stroke-width={isSelected ? 4 : 2}
                            />
                            <text 
                                x={hex.x} 
                                y={hex.y} 
                                dy="25" 
                                text-anchor="middle" 
                                fill="white" 
                                font-size="20" 
                                font-weight="bold" 
                                style="text-shadow: 0 0 4px #000;"
                            >
                                {String.fromCharCode(65 + hex.col)}-{hex.row + 1}
                            </text>
                        </g>
                    {/if}
                {/each}
            </g>
        </svg>

        {#if warning.show}
            {#key warning.id}
                <div 
                    class="cursor-warning" 
                    style="top: {warning.y}px; left: {warning.x}px;"
                >
                    {warning.text}
                </div>
            {/key}
        {/if}
    </div>

    <!--RIGHT-->
    <StatusBar 
        bind:health 
        bind:fuel 
        bind:currentTurn
        bind:isRevealed
        bind:isEnemyTurn
    />
</div>

<!--MAP HTML APPEARANCE-->
<style>
    /*General layout for the contents of the map*/ 
    .layout-container { 
        display: flex; 
        flex-direction: row; 
        width: 100%; 
        height: 100%; 
        overflow: hidden; 
        background: #0b0e14; 
    }
    
    /*Layout of the map*/
    .map-area { 
        flex: 1;
        display: flex; 
        justify-content: center; 
        align-items: center; 
        position: relative; 
        padding: 1vw; 
        min-width: 0; 
        min-height: 0;
    }
    
    /*Map sizing along with the SVG viewbox*/ 
    .tactical-grid { 
        width: 100%; 
        height: 100%; 
        filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); 
    }

    /*Appearance of the warnings for land, # of selected hexes.*/
    .cursor-warning {
        position: fixed; 
        pointer-events: none; 
        color: #e45c5c; 
        font-family: 'Chakra Petch', sans-serif;
        font-size: 24px; 
        font-weight: 600; 
        text-shadow: 0 0 10px black; 
        animation: popAndFade 1.5s forwards;
    }

    /*Animation for cursor-warnings*/
    @keyframes popAndFade {
        0% { 
            opacity: 0; 
            transform: translate(15px, 0) scale(0.5); 
        }
        15% { 
            opacity: 1; 
            transform: translate(15px, -25px) scale(1.1); 
        }
        100% { 
            opacity: 0; 
            transform: translate(15px, -40px); 
        }
    }
</style>