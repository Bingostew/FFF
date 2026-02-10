<script>
    // @ts-nocheck
    import { defineHex, Grid, rectangle, Orientation } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';
    import { getTargetHexes, isGroupConnected, getS } from './gridUtils.js';
    import Sidebar from './Sidebar.svelte';
    import StatusBar from './StatusBar.svelte';
    // 1. Grid Config
    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: Orientation.FLAT, offset: 1 });
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));
    const gridHexes = [...grid];

    // 2. Global State
    let hoveredHex = $state(null);
    let selectedGroup = $state([]);
    let targetingMode = $state('focus');
    let isConfirmed = $state(false);
    let fleetSelections = $state([]);
    let rotation = $state(0);
    let warning = $state({ show: false, x: 0, y: 0, text: '', id: 0 });
    let health = $state(2);
    let fuel = $state(3);

    const specialTiles = [
        { col: 1, row: 2, img: 'single_palm.jpg' },
        { col: 2, row: 1, img: 'double_palm.jpg' },
        { col: 2, row: 4, img: 'tree.jpg' },
        { col: 3, row: 4, img: 'hill.jpg' },
        { col: 4, row: 3, img: 'peak.jpg' },
        { col: 5, row: 2, img: 'mountain.jpg' }
    ];

    // Derived values
    let highlightedHexes = $derived(getTargetHexes(hoveredHex, targetingMode, rotation, gridHexes));

    // Interaction Handlers
    function handleHexClick(event, hex) {
        if (!isConfirmed) {
            const isSpecial = specialTiles.some(t => t.col === hex.col && t.row === hex.row);

            if (isSpecial){
                showWarning(event.clientX, event.clientY, "Cannot place fleet on land");
                return;
            }

            const index = fleetSelections.findIndex(h => h.q === hex.q && h.r === hex.r);
            if (index > -1) {
                fleetSelections = fleetSelections.filter(h => h !== fleetSelections[index]);
            } else if (fleetSelections.length < 2) {
                fleetSelections = [...fleetSelections, hex];
            }
            return;
        }

        // Targeting Logic
        if (targetingMode === 'directional') {
            selectedGroup = selectedGroup.some(h => highlightedHexes.includes(h)) ? [] : [...highlightedHexes];
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
            if (selectedGroup.length >= 3) return showWarning(event.clientX, event.clientY, "Limit 3");
            const adjacent = selectedGroup.some(s => {
                const dist = (Math.abs(s.q - hex.q) + Math.abs(s.r - hex.r) + Math.abs(getS(s) - getS(hex))) / 2;
                return dist === 1;
            });
            if (adjacent) showWarning(event.clientX, event.clientY, "No adjacent selection");
            else selectedGroup = [...selectedGroup, hex];
        } else if (targetingMode === 'area') {
            if (selectedGroup.length >= 4) return showWarning(event.clientX, event.clientY, "Limit 4");
            const touching = selectedGroup.length === 0 || selectedGroup.some(s => {
                const dist = (Math.abs(s.q - hex.q) + Math.abs(s.r - hex.r) + Math.abs(getS(s) - getS(hex))) / 2;
                return dist === 1;
            });
            if (!touching) showWarning(event.clientX, event.clientY, "Must be adjacent");
            else selectedGroup = [...selectedGroup, hex];
        }
    }

    let warningTimeout;
    function showWarning(x, y, text) {
        clearTimeout(warningTimeout);
        warning = { show: true, x, y, text, id: Date.now() };
        warningTimeout = setTimeout(() => { if (warning.id === warning.id) warning.show = false; }, 1500);
    }

    function confirmFleets() {
        if (fleetSelections.length === 2) {
            console.log("Fleets locked:", fleetSelections.map(f => ({ q: f.q, r: f.r })));
            isConfirmed = true;
            // Clear any previous selections and default to focus mode
            selectedGroup = [];
            targetingMode = 'focus';
        }
    }
</script>

<div class="layout-container">
    <Sidebar 
        bind:targetingMode 
        bind:isConfirmed 
        bind:rotation
        {fleetSelections} 
        onConfirm={confirmFleets}
    />

    <div class="map-area"
        role="application"
        oncontextmenu={(e) => {
            if (targetingMode === 'directional') {e.preventDefault();rotation++;}
        }}>
        <StatusBar {health} {fuel} />

        <svg viewBox="0 0 1000 600" class="tactical-grid">
            <defs>
                <pattern id="water-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                    <image href="/water2.jpg" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid slice"/>
                </pattern>
                
                <pattern id="ship-pattern" patternUnits="objectBoundingBox" width="1" height="1">
                    <image 
                        href="ship.png" 
                        x="0.1" y="0.1" 
                        width="10%" height="10%" 
                        preserveAspectRatio="xMidYMid meet"
                    />
                </pattern>

                {#each specialTiles as tile}
                    <pattern id={`pattern-${tile.col}-${tile.row}`} patternUnits="objectBoundingBox" width="1" height="1">
                        <image href={`/${tile.img}`} x="0" y="0" width="10%" height="15%" preserveAspectRatio="xMidYMid slice"/>
                    </pattern>
            {/each}
            </defs>

            <g transform="translate(55, 10)"> 
                {#each grid as hex}
                    {@const config = specialTiles.find(t => t.col === hex.col && t.row === hex.row)}
                    {@const isFleet = fleetSelections.some(f => f.q === hex.q && f.r === hex.r)}
                    {@const pointsStr = hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}

                    <g 
                        class="hex-cell"
                        role="button"
                        tabindex="0"
                        onclick={(e) => handleHexClick(e, hex)}
                        onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
                        onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
                        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleHexClick(e, hex)}
                        style="cursor: pointer; outline: none;"
                    >
                        <polygon
                            points={pointsStr}
                            fill={config ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"}
                            stroke={isFleet ? "#4ade80" : "black"} 
                            stroke-width={isFleet ? 2 : 0.5}
                        />

                        <polygon
                            points={pointsStr}
                            fill="url(#ship-pattern)"
                            style="opacity: {isFleet ? 1 : 0}; transition: opacity 0.2s;"
                            pointer-events="none"
                        />
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
                            <text x={hex.x} y={hex.y} dy="25" text-anchor="middle" fill="white" font-size="20" font-weight="bold" style="text-shadow: 0 0 4px #000;">
                                {String.fromCharCode(65 + hex.col)}-{hex.row + 1}
                            </text>
                        </g>
                    {/if}
                {/each}
            </g>
        </svg>

        {#if warning.show}
            {#key warning.id}
                <div class="cursor-warning" style="top: {warning.y}px; left: {warning.x}px;">{warning.text}</div>
            {/key}
        {/if}
    </div>
</div>

<style>
    .layout-container { display: flex; width: 100vw; height: 100vh; overflow: hidden; background: #0b0e14; }
    .map-area { flex-grow: 1; display: flex; justify-content: center; align-items: center; position: relative; }
    .tactical-grid { width: 80%; height: 80%; filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); }
    .cursor-warning {
        position: fixed; pointer-events: none; color: #e45c5c; font-family: 'Chakra Petch', sans-serif;
        font-size: 24px; font-weight: 600; text-shadow: 0 0 10px black; animation: popAndFade 1.5s forwards;
    }
    

    @keyframes popAndFade {
        0% { opacity: 0; transform: translate(15px, 0) scale(0.5); }
        15% { opacity: 1; transform: translate(15px, -25px) scale(1.1); }
        100% { opacity: 0; transform: translate(15px, -40px); }
    }
</style>