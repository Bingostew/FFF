<script>
    // @ts-nocheck
    import { defineHex, Grid, rectangle, Orientation, line } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';
    import { socket, gameId, activePlayerId } from '$lib/gameStore';   
    import { getTargetHexes, isGroupConnected, getS } from './gridUtils.js';
    import Sidebar from './Sidebar.svelte';
    import StatusBar from './StatusBar.svelte';

    // --- BRINGING THE AI BACK HOME FOR SINGLEPLAYER ---
    import MCTS from './game/MCTS.js';
    import { F3Game } from './game/F3Game.js';
    import { HexUtils } from './game/HexUtils.js';

    // Grid Config
    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: Orientation.FLAT, offset: 1 });
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));
    const gridHexes = [...grid];

    // --- UNIFIED GAME STATE ---
    let isMultiplayer = $derived(!!$socket && !!$gameId); 
    let isConfirmed = $state(false);
    let isEnemyTurn = $state(false); 
    let isMyTurn = $derived(!isConfirmed || (isMultiplayer ? ($activePlayerId === $socket?.id) : !isEnemyTurn));
    let hoveredHex = $state(null);
    let selectedGroup = $state([]);
    let lockedSelectionForSocket = $state([]); 
    let targetingMode = $state('focus');
    let fleetSelections = $state([]);
    let rotation = $state(0);
    let selectedFleetToMove = $state(null);
    let warning = $state({ show: false, x: 0, y: 0, text: '', id: 0 });
    
    let currentTurn = $state(1);
    let mousePos = $state({ x: 0, y: 0 }); 
    let friendlySearchedHexes = $state([]);
    let enemySearchedHexes = $state([]);    
    let isRevealed = $state(false);
    
    let enemyFleets = $state([]);
    let gameOver = $state(false);
    let gameResult = $state("");
    let overlay = $state({ show : false, text:'', mode: 'fail'});

    let sourceFleet = $state(null);
    let targetEnemy = $state(null);
    let attackRange = $derived.by(() => {
        if (!sourceFleet || !targetEnemy) return null;
        let dist = (Math.abs(sourceFleet.q - targetEnemy.q) + Math.abs(sourceFleet.r - targetEnemy.r) + Math.abs((-sourceFleet.q - sourceFleet.r) - (-targetEnemy.q - targetEnemy.r))) / 2;
        const lineOfSight = grid.traverse(line({ start: sourceFleet, stop: targetEnemy }));
        let landPenalty = 0;
        const pathArray = [...lineOfSight].slice(1, -1);
        pathArray.forEach(hex => {
            if (specialTiles.some(t => t.col === hex.col && t.row === hex.row)) landPenalty += 1; 
        });
        return landPenalty + dist;
    });

    let requiredRoll = $derived(
        attackRange === null ? null : attackRange <= 2 ? 2 : attackRange <= 6 ? 3 : 4
    );

    const specialTiles = [
        { col: 1, row: 2, img: 'single_palm.jpg' }, { col: 2, row: 1, img: 'double_palm.jpg' },
        { col: 2, row: 4, img: 'tree.jpg' }, { col: 3, row: 4, img: 'hill.jpg' },
        { col: 4, row: 3, img: 'peak.jpg' }, { col: 5, row: 2, img: 'mountain.jpg' }
    ];

    function checkWinCondition() {
        if (enemyFleets.length === 0) {
            gameOver = true;
            gameResult = "VICTORY";
        } else if (fleetSelections.length === 0) {
            gameOver = true;
            gameResult = "DEFEAT";
        }
    }

    let highlightedHexes = $derived.by(() => {
        if (!hoveredHex || targetingMode === 'move') return [];
        if (targetEnemy) {
            const isLand = specialTiles.some(t => t.col === hoveredHex.col && t.row === hoveredHex.row);
            return isLand ? [] : [hoveredHex];
        }
        return getTargetHexes(hoveredHex, targetingMode, rotation, gridHexes)
        .filter(hex => !specialTiles.some(t => t.col === hex.col && t.row === hex.row))
    });

    // --- SOCKET LISTENERS (ONLY FOR MULTIPLAYER) ---
    $effect(() => {
        if ($socket) {
            $socket.on('game_start', ({ activePlayer }) => {
                activePlayerId.set(activePlayer);
                isConfirmed = true; 
                selectedGroup = [];
                targetingMode = 'focus';
            });
            $socket.on('turn_change', ({ activePlayer }) => { activePlayerId.set(activePlayer); });
            $socket.on('die_result', ({playerId, number}) => {
                if(isMyTurn){
                    const formattedPositions = {};
                    lockedSelectionForSocket.forEach((h, index) => { formattedPositions[index] = { q: h.q, r: h.r }; });
                    $socket.emit(targetingMode, { gameId: $gameId, Positions: formattedPositions, dieResult: number });
                    lockedSelectionForSocket = []; 
                    selectedGroup = [];
                }
            });
            const ISREvents = ['focus_result', 'directional_result', 'area_result'];
            const onISRResult = ({playerName, revealPos, positions}) => {
                let posArray = Object.values(positions);
                const scannedHexes = posArray.map(p => gridHexes.find(h => h.q === p.q && h.r === p.r)).filter(Boolean);
                if (isMyTurn) {
                    friendlySearchedHexes = [...friendlySearchedHexes, ...scannedHexes];
                    if (revealPos) triggerOverlay("TARGET FOUND", 'success');
                    else triggerOverlay("AREA CLEAR", 'success');
                } else {
                    enemySearchedHexes = [...enemySearchedHexes, ...scannedHexes];
                    triggerOverlay(`ENEMY CONDUCTED SCAN`, "fail");
                    if (revealPos) { isRevealed = true; triggerOverlay(`WARNING: YOU WERE DETECTED!`, "fail"); }
                }
            };
            ISREvents.forEach(evt => $socket.on(evt, onISRResult));
            $socket.on('fleet_moved', ({ playerId, fleetKey, newPosition }) => {
                if (playerId !== $socket.id) {
                    const targetHex = gridHexes.find(h => h.q === newPosition.q && h.r === newPosition.r);
                    if (targetHex) {
                        enemyFleets = enemyFleets.map(f => {
                            const idMatch = fleetKey === 'alpha' ? 'B1' : 'B2';
                            if (f.id === idMatch) return { ...f, q: targetHex.q, r: targetHex.r, fuel: f.fuel - 1 };
                            return f;
                        });
                        triggerOverlay(`ENEMY MOVED`, "fail");
                    }
                }
            });
            $socket.on('strike_result', ({ attacker, hit, targetHex, fleetKey, hpRemaining, isDestroyed }) => {
                if (attacker !== $socket.id) {
                    if (hit) {
                        triggerOverlay("WARNING: YOU HAVE BEEN HIT!", "fail");
                        fleetSelections = fleetSelections.map((f, i) => {
                            const isTarget = (fleetKey === 'alpha' && i === 0) || (fleetKey === 'beta' && i === 1);
                            if (isTarget) return { ...f, health: hpRemaining };
                            return f;
                        });
                    } else { triggerOverlay("ENEMY STRIKE MISSED", "success"); }
                }
            });
            return () => {
                $socket.off("room_update"); $socket.off('game_start'); $socket.off('turn_change');
                $socket.off('die_result'); $socket.off('fleet_moved'); $socket.off('strike_result');
                ISREvents.forEach(evt => $socket.off(evt));
            };
        }
    });

    function handleHexClick(event, hex) {
        if (isConfirmed && !isMyTurn) return;

        if(targetEnemy){
            const friendlyFleet = fleetSelections.find(f => f.q === hex.q && f.r === hex.r);
            if(friendlyFleet){
                sourceFleet = friendlyFleet; showWarning(event.clientX, event.clientY, `ATTACKER: ${sourceFleet.name}`);
            } else { showWarning(event.clientX, event.clientY, "Select a friendly fleet to engage!"); }
            return;
        }

        const isSpecial = specialTiles.some(t => t.col === hex.col && t.row === hex.row);
        if (isSpecial) { showWarning(event.clientX, event.clientY, isConfirmed ? "Cannot select land" : "Cannot place fleet on land"); return; }

        if (!isConfirmed) {
            const tacticalNames = ["USS Gentile", "USS Maroon"]; 
            const index = fleetSelections.findIndex(h => h.q === hex.q && h.r === hex.r);
            if (index > -1) {
                fleetSelections = fleetSelections.filter(h => h !== fleetSelections[index]);
                fleetSelections = fleetSelections.map((f, i) => ({ ...f, name: tacticalNames[i], id: i + 1 }));
            } else if (fleetSelections.length < 2) {
                fleetSelections = [...fleetSelections, { q: hex.q, r: hex.r, name: tacticalNames[fleetSelections.length], id: fleetSelections.length + 1, health: 2, fuel: 3 }];
            }
            return;
        }

        if (targetingMode === 'move') {
            const isFleet = fleetSelections.find(h => h.q === hex.q && h.r === hex.r);
            if (isFleet) {
                selectedFleetToMove = (selectedFleetToMove && selectedFleetToMove.q === isFleet.q && selectedFleetToMove.r === isFleet.r) ? null : isFleet;
                return;
            }
            if (selectedFleetToMove) {
                const s1 = -selectedFleetToMove.q - selectedFleetToMove.r;
                const s2 = -hex.q - hex.r;
                if ((Math.abs(selectedFleetToMove.q - hex.q) + Math.abs(selectedFleetToMove.r - hex.r) + Math.abs(s1 - s2)) / 2 !== 1) {
                    showWarning(event.clientX, event.clientY, "Must jump to an adjacent hex!"); return;
                }
                if (selectedFleetToMove.fuel > 0) {
                    fleetSelections = fleetSelections.map(f => (f.q === selectedFleetToMove.q && f.r === selectedFleetToMove.r) ? { ...f, q: hex.q, r: hex.r, fuel: f.fuel - 1 } : f);
                    if (isMultiplayer) {
                        const fleetKey = selectedFleetToMove.id === 1 ? 'alpha' : 'beta';
                        $socket.emit('move_fleet', { gameId: $gameId, fleetKey: fleetKey, newPosition: {q: hex.q, r: hex.r} });
                    }
                    selectedFleetToMove = null; targetingMode = 'focus'; 
                    if (!isMultiplayer) handleTurnEnd(); // Switch turn to AI after moving
                } else { showWarning(event.clientX, event.clientY, `${selectedFleetToMove.name} is out of fuel!`); }
            } else { showWarning(event.clientX, event.clientY, "Select a fleet to jump first!"); }
            return;
        }

        if (isConfirmed) {
            const friendlyFleet = fleetSelections.find(f => f.q === hex.q && f.r === hex.r);
            const isDetectedEnemy = enemySearchedHexes.some(e => e.q === hex.q && e.r === hex.r);
            if (friendlyFleet) { sourceFleet = friendlyFleet; showWarning(event.clientX, event.clientY, `Source: ${sourceFleet.name}`); }
            if (isDetectedEnemy) targetEnemy = hex;
        }

        if (targetingMode === 'directional') {
            const isAlreadySelected = selectedGroup.length > 0 && selectedGroup.some(s => s.q === highlightedHexes[0]?.q && s.r === highlightedHexes[0]?.r);
            selectedGroup = isAlreadySelected ? [] : [...highlightedHexes]; 
            return;
        }

        const idx = selectedGroup.findIndex(s => s.q === hex.q && s.r === hex.r);
        if (idx > -1) {
            if (targetingMode === 'area' && !isGroupConnected(selectedGroup.filter(h => h !== hex))) {
                showWarning(event.clientX, event.clientY, "Cannot split group"); return;
            }
            selectedGroup = selectedGroup.filter(h => h !== hex);
        } else {
            handleNewSelection(event, hex);
        }
    }

    function handleNewSelection(event, hex) {
        if (targetingMode === 'focus') {
            if (selectedGroup.length >= 3) return showWarning(event.clientX, event.clientY, "Limit 3");
            const adjacent = selectedGroup.some(s => ((Math.abs(s.q - hex.q) + Math.abs(s.r - hex.r) + Math.abs(getS(s) - getS(hex))) / 2) === 1);
            if (adjacent) showWarning(event.clientX, event.clientY, "No adjacent selection");
            else selectedGroup = [...selectedGroup, hex];
        } else if (targetingMode === 'area') {
            if (selectedGroup.length >= 4) return showWarning(event.clientX, event.clientY, "Limit 4");
            const touching = selectedGroup.length === 0 || selectedGroup.some(s => ((Math.abs(s.q - hex.q) + Math.abs(s.r - hex.r) + Math.abs(getS(s) - getS(hex))) / 2) === 1);
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

    $effect(() => { if (targetingMode !== 'move') selectedFleetToMove = null; });

    // --- RESTORED: LOCAL SINGLEPLAYER CONFIRMATION ---
    function confirmFleets() {
        if (fleetSelections.length === 2) {
            if (isMultiplayer) {
                const fleetPositions = { alpha: { q: fleetSelections[0].q, r: fleetSelections[0].r }, beta: { q: fleetSelections[1].q, r: fleetSelections[1].r } };
                $socket.emit('place_fleets', { gameId: $gameId, fleetPositions });
                $socket.once('fleets_placed_confirmation', () => { $socket.emit('ready_check', {gameId: $gameId}); });
            } else {
                isConfirmed = true; 
                // Randomize Local AI Fleets
                const waterHexes = gridHexes.filter(h => !specialTiles.some(t => t.col === h.col && t.row === h.row));
                const r1 = waterHexes[Math.floor(Math.random() * waterHexes.length)];
                let r2 = waterHexes[Math.floor(Math.random() * waterHexes.length)];
                while (r1.q === r2.q && r1.r === r2.r) { r2 = waterHexes[Math.floor(Math.random() * waterHexes.length)]; }

                enemyFleets = [ 
                    { id: 'B1', q: r1.q, r: r1.r, name: "IJN Yamato", health: 2, fuel: 3 }, 
                    { id: 'B2', q: r2.q, r: r2.r, name: "IJN Musashi", health: 2, fuel: 3 }
                ];
            }
            selectedGroup = [];
            targetingMode = 'focus';
        }
    }

    function handlePlayerSearch() {
        if (isMultiplayer) {
            lockedSelectionForSocket = [...selectedGroup];
            $socket.emit('die_roll', { gameId: $gameId });
            return false; 
        } else {
            // Local Search Logic
            if (selectedGroup.length === 0) return false;
            const newSearches = selectedGroup.filter(selected => !friendlySearchedHexes.some(searched => searched.q === selected.q && searched.r === selected.r));
            const detected = selectedGroup.find(hex => enemyFleets.some(e => e.q === hex.q && e.r === hex.r));
            friendlySearchedHexes = [...friendlySearchedHexes, ...newSearches];

            if(detected){
                targetEnemy = detected;
                sourceFleet = null;
                selectedGroup = []; targetingMode = 'focus'; return true; 
            }
            selectedGroup = []; targetingMode = 'focus'; return false;
        }
    }

    function handleTurnEnd() {
        targetEnemy = null; sourceFleet = null; selectedGroup = []; targetingMode = 'focus';
        if (!isMultiplayer) setTimeout(() => { executeEnemyTurn(); }, 1500); 
    }

    function resolveAttack(roll1, roll2) {
        if (!sourceFleet || !targetEnemy) return;

        if (isMultiplayer) {
            $socket.emit('execute_strike', { gameId: $gameId, targetHex: targetEnemy, dieResult: roll1 });
        } else {
            // Local Attack Logic
            const hit1 = roll1 >= requiredRoll; const hit2 = roll2 >= requiredRoll;
            const totalHits = (hit1 ? 1 : 0) + (hit2 ? 1 : 0);
            
            if (totalHits === 2) triggerOverlay("TARGET DESTROYED: 2 HITS", "success");
            else if (totalHits === 1) triggerOverlay("TARGET HIT", "success");
            else triggerOverlay("TARGET MISSED: 0 HITS", "fail");
            
            const enemyIndex = enemyFleets.findIndex(e => e.q === targetEnemy.q && e.r === targetEnemy.r);
            if (enemyIndex !== -1 && totalHits > 0){
                enemyFleets[enemyIndex].health -= totalHits;
                if(enemyFleets[enemyIndex].health <= 0) enemyFleets = enemyFleets.filter((_, i) => i !== enemyIndex);
                checkWinCondition(); 
            }
            setTimeout(() => { targetEnemy = null; sourceFleet = null; selectedGroup = []; executeEnemyTurn(); }, 2000);
        }
    }

    function triggerOverlay(message, mode = 'fail'){
        overlay = {show: true, text:message, mode};
        setTimeout(() => { overlay.show = false; }, 2000);
    }

    // --- RESTORED: LOCAL AI BRAIN ---
    function syncStateToAI() {
        const aiGame = new F3Game();
        aiGame.currentPlayer = 'BLUE'; 

        aiGame.redFleets = fleetSelections.map((f, i) => {
            const hex = gridHexes.find(h => h.q === f.q && h.r === f.r);
            return { id: `R${i + 1}`, pos: HexUtils.posToString({ col: hex.col, row: hex.row }), hp: f.health, fuel: f.fuel, isHidden: !isRevealed };
        });

        aiGame.blueFleets = enemyFleets.map(f => {
            const hex = gridHexes.find(h => h.q === f.q && h.r === f.r);
            return { id: f.id, pos: HexUtils.posToString({ col: hex.col, row: hex.row }), hp: f.health, fuel: f.fuel, isHidden: false };
        });

        enemySearchedHexes.forEach(hex => {
            const idx = aiGame.posToIndex(HexUtils.posToString({ col: hex.col, row: hex.row }));
            const hit = fleetSelections.some(f => f.q === hex.q && f.r === hex.r);
            aiGame.blueIntel[idx] = hit ? 'S' : 'E';
        });

        return aiGame;
    }

    function executeEnemyTurn() {
        isEnemyTurn = true; 
        const aiGameState = syncStateToAI();

        setTimeout(() => {
            try {
                const mcts = new MCTS(300); 
                const bestMove = mcts.search(aiGameState);

                if (!bestMove) {
                    triggerOverlay("AI PASSED TURN", "success");
                    endEnemyTurn(); return;
                }

                const parts = bestMove.split('_');
                const command = parts[0]; 

                if (command === "MOVE") {
                    const fleetId = parts[1];
                    const targetOffset = HexUtils.parsePos(parts[2]); 
                    const targetHex = gridHexes.find(h => h.col === targetOffset.col && h.row === targetOffset.row);

                    enemyFleets = enemyFleets.map(f => (f.id === fleetId) ? { ...f, q: targetHex.q, r: targetHex.r, fuel: f.fuel - 1 } : f);
                    triggerOverlay(`ENEMY MOVED`, "fail");
                } 
                else if (command === "ISR") {
                    const scanType = parts[1]; 
                    let scannedHexes = parts.slice(2).map(posStr => {
                        const offset = HexUtils.parsePos(posStr);
                        return offset ? gridHexes.find(h => h.col === offset.col && h.row === offset.row) : null;
                    }).filter(Boolean); 

                    enemySearchedHexes = [...enemySearchedHexes, ...scannedHexes];
                    
                    const detectedFriendly = scannedHexes.find(hex => fleetSelections.some(f => f.q === hex.q && f.r === hex.r));

                    if (detectedFriendly) {
                        isRevealed = true; 
                        triggerOverlay(`WARNING: YOU WERE DETECTED!`, "fail");
                        fleetSelections = fleetSelections.map(f => (f.q === detectedFriendly.q && f.r === detectedFriendly.r) ? { ...f, health: f.health - 1 } : f);
                        checkWinCondition();
                    } else { triggerOverlay(`ENEMY CONDUCTED ${scanType} SCAN`, "fail"); }
                }
                endEnemyTurn();
            } catch (error) {
                console.error("AI Crash:", error);
                endEnemyTurn(); 
            }
        }, 300); 
    }

    function endEnemyTurn() {
        setTimeout(() => {
            currentTurn += 1;
            isEnemyTurn = false; 
        }, 2500); 
    }

    function handleDevShortcut(e) {
        if (e.ctrlKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
            isRevealed = !isRevealed;
            showWarning(mousePos.x || window.innerWidth/2, mousePos.y || window.innerHeight/2, 
                isRevealed ? "DEV MODE: ENEMY REVEALED" : "DEV MODE: HIDDEN");
        }
    }
</script>

<svelte:window onkeydown={handleDevShortcut} />
<div class="layout-container" class:not-my-turn={isConfirmed && !isMyTurn}>
    
    <Sidebar 
        bind:targetingMode 
        bind:isConfirmed 
        bind:rotation
        bind:targetEnemy
        bind:sourceFleet
        {fleetSelections} 
        {selectedGroup} 
        {attackRange}
        {requiredRoll}
        {isMyTurn}
        onScanResult={triggerOverlay}
        onConfirm={confirmFleets}
        onSearch={handlePlayerSearch} 
        onTurnEnd={handleTurnEnd} 
        onFireResolve={resolveAttack}
    />

    <div 
        class="map-area"
        role="application"
        onmousemove={(e) => { mousePos.x = e.clientX; mousePos.y = e.clientY; }}
        oncontextmenu={(e) => {
            if (targetingMode === 'directional') { e.preventDefault(); rotation++; }
        }}
    >
        <svg viewBox="-10 -10 602 620" class="tactical-grid" preserveAspectRatio="xMidYMid meet">
            <defs>
                <pattern id="water-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                    <image href="/water2.jpg" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid slice"/>
                </pattern>
                <pattern id="ship-pattern" patternUnits="objectBoundingBox" width="1" height="1">
                    <image href="ship.png" x="15.0" y="0.1" width="10%" height="10%" preserveAspectRatio="xMidYMid meet"/>
                </pattern>
                {#each specialTiles as tile}
                    <pattern id={`pattern-${tile.col}-${tile.row}`} patternUnits="objectBoundingBox" patternContentUnits="objectBoundingBox" width="1" height="1">
                        <image href={`/${tile.img}`} x="0" y="0" width="1" height="1" preserveAspectRatio="xMidYMid slice"/>
                    </pattern>
                {/each}    
            </defs>

            <g transform="translate(30, 40)"> 
                {#each grid as hex}
                    {@const isEnemyFleet = enemyFleets.some(e => e.q === hex.q && e.r === hex.r)}
                    {@const config = specialTiles.find(t => t.col === hex.col && t.row === hex.row)}
                    {@const isFleet = fleetSelections.some(f => f.q === hex.q && f.r === hex.r)}
                    {@const isFriendlySearched = friendlySearchedHexes.some(s => s.q === hex.q && s.r === hex.r)}
                    {@const isEnemySearched = enemySearchedHexes.some(s => s.q === hex.q && s.r === hex.r)}
                    {@const isSelectedToMove = selectedFleetToMove && selectedFleetToMove.q === hex.q && selectedFleetToMove.r === hex.r} {@const pointsStr = hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                    
                    <g 
                        class="hex-cell" role="button" tabindex="0" onclick={(e) => handleHexClick(e, hex)}
                        onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
                        onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
                        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleHexClick(e, hex)}
                        style="cursor: none; outline: none;"
                    >
                        <polygon points={pointsStr} fill={config ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"} stroke="black" stroke-width="0.5"/>
                        
                        {#if isEnemyFleet && isRevealed}
                            <polygon points={pointsStr} fill="#000000" fill-opacity="0.6" stroke="#4ade80" stroke-width="2" pointer-events="none" />
                            <text x={hex.x} y={hex.y} dy="5" text-anchor="middle" fill="#4ade80" font-family="'Chakra Petch', sans-serif" font-size="12" font-weight="bold" pointer-events="none">ENEMY</text>
                        {/if}

                        <polygon points={pointsStr} fill="url(#ship-pattern)" style="opacity: {isFleet ? 1 : 0}; transition: opacity 0.2s;" pointer-events="none"/>

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
                                <polygon points="{hex.x},{hex.y - 15} {hex.x + 15},{hex.y} {hex.x},{hex.y + 15} {hex.x - 15},{hex.y}" fill="rgba(234, 179, 8, 0.2)" stroke="#e24a4a" stroke-width="2" />
                                <circle cx={hex.x} cy={hex.y} r="4" fill="#e24a4a" />
                            </g>
                        {/if}
                    </g>
                {/each}

                {#each grid as hex}
                    {@const isActive = highlightedHexes.some(h => h.q === hex.q && h.r === hex.r)}
                    {@const isSelected = selectedGroup.some(s => s.q === hex.q && s.r === hex.r)}
                    {@const isSelectedToMove = selectedFleetToMove && selectedFleetToMove.q === hex.q && selectedFleetToMove.r === hex.r}
                    {@const isFleet = fleetSelections.some(f => f.q === hex.q && f.r === hex.r)}
                    
                    {#if isFleet || (isConfirmed && (isActive || isSelected || isSelectedToMove))}
                        <g pointer-events="none">
                            <polygon points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                                fill={isSelectedToMove ? 'rgba(59, 130, 246, 0.3)' : isSelected ? 'rgba(226, 74, 74, 0.6)' : isActive ? 'rgba(59, 130, 246, 0.4)' : 'transparent'}
                                stroke={isSelectedToMove ? "#3b82f6" : (isConfirmed && isSelected ? "#e24a4a" : (isConfirmed && isActive ? "#3b82f6" : (isFleet ? "#22c55e" : "transparent")))}
                                stroke-width={isSelectedToMove ? 4 : (isConfirmed && isSelected ? 5 : (isConfirmed && isActive ? 2 : (isFleet ? 4 : 0)))}
                            />
                            {#if isConfirmed && (isActive || isSelected) && !isSelectedToMove}
                                <text x={hex.x} y={hex.y} dy="25" text-anchor="middle" fill="white" font-size="20" font-weight="bold" style="text-shadow: 0 0 4px #000;">
                                    {String.fromCharCode(65 + hex.col)}-{hex.row + 1}
                                </text>
                            {/if}
                        </g>
                    {/if}
                {/each}
            </g>
        </svg>

        {#if targetEnemy && sourceFleet}
            <div class="fleet-tooltip attack-mode" style="top: {mousePos.y - 100}px; left: {mousePos.x}px; border-color: #e24a4a;">
                <div class="tooltip-header" style="color: #e24a4a;">FIRE CONTROL</div>
                <div class="tooltip-stat">TARGET RANGE: <span style="color: #fff">{attackRange} HEXES</span></div>
                <div class="tooltip-stat">ROLL NEEDED: <span style="color: #e24a4a; font-weight: bold;">{requiredRoll}+</span></div>
                <div class="tooltip-stat" style="font-size: 0.7rem; opacity: 0.7;">(Land Penalty Included)</div>
            </div>
        {/if}

        {#if hoveredHex && isConfirmed}
            {@const hoveredFleet = fleetSelections.find(f => f.q === hoveredHex.q && f.r === hoveredHex.r)}
            {#if hoveredFleet}
                <div class="fleet-tooltip" style="top: {mousePos.y + 15}px; left: {mousePos.x + 15}px;">
                    <div class="tooltip-header">{hoveredFleet.name}</div>
                    <div class="tooltip-stat">HEALTH: <span style="color: #4ade80">{hoveredFleet.health} / 2</span></div>
                    <div class="tooltip-stat">FUEL: <span style="color: #eab308">{hoveredFleet.fuel} / 3</span></div>
                </div>
            {/if}
        {/if}

        {#if warning.show}
            {#key warning.id}
                <div class="cursor-warning" style="top: {warning.y}px; left: {warning.x}px;">{warning.text}</div>
            {/key}
        {/if}
    </div>

    {#if overlay.show}
    <div class="fullscreen-lock-overlay" class:overlay-success={overlay.mode === 'success'}>
        <div class="failure-content">
            <div class="glitch-text">{overlay.text}</div>
            <div class="sub-text">{overlay.mode === 'success' ? 'FIRE CONTROL INITIALIZED...' : 'RECALIBRATING SENSORS...'}</div>
        </div>
    </div>
    {/if}

    <StatusBar bind:currentTurn bind:isRevealed {isMyTurn} {isMultiplayer} {fleetSelections} />
</div>

<style>
    .layout-container { display: flex; flex-direction: row; width: 100%; height: 100%; overflow: hidden; background: #0b0e14; }
    .layout-container.not-my-turn :global(.sidebar_targeting) { pointer-events: none; user-select: none; opacity: 0.5; transition: all 0.4s ease; }
    .map-area { flex: 1; display: flex; justify-content: center; align-items: center; position: relative; padding: 1vw; min-width: 0; min-height: 0; }
    .tactical-grid { width: 100%; height: 100%; filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); }
    .cursor-warning { position: fixed; pointer-events: none; color: #e45c5c; font-family: 'Chakra Petch', sans-serif; font-size: 24px; font-weight: 600; text-shadow: 0 0 10px black; animation: popAndFade 1.5s forwards; }
    @keyframes popAndFade { 0% { opacity: 0; transform: translate(15px, 0) scale(0.5); } 15% { opacity: 1; transform: translate(15px, -25px) scale(1.1); } 100% { opacity: 0; transform: translate(15px, -40px); } }
    .fleet-tooltip { position: fixed; background: rgba(10, 15, 30, 0.95); border: 1px solid #4ade80; padding: 10px 15px; color: white; font-family: 'Chakra Petch', sans-serif; pointer-events: none; z-index: 100; box-shadow: 0 0 15px rgba(74, 222, 128, 0.2); border-radius: 4px; }
    .tooltip-header { font-weight: bold; color: #4ade80; border-bottom: 1px solid rgba(74, 222, 128, 0.3); margin-bottom: 5px; padding-bottom: 5px; letter-spacing: 1px; }
    .tooltip-stat { font-size: 0.9rem; color: #abbbd1; margin-top: 2px; }
    .hex-cell polygon { transition: fill 0.1s ease, stroke 0.1s ease; }
    [fill*="rgba(200, 74, 74, 0.6)"] { stroke-width: 5px !important; filter: drop-shadow(0 0 5px rgba(226, 74, 74, 0.5)); }
    .fullscreen-lock-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(15, 20, 30, 0.7); backdrop-filter: blur(4px); display: flex; justify-content: center; align-items: center; z-index: 9999; pointer-events: all; animation: fadeInOut 2s forwards; }
    .glitch-text { font-size: 4rem; font-weight: 900; color: #e24a4a; text-shadow: 0 0 20px rgba(226, 74, 74, 0.5); text-transform: uppercase; letter-spacing: 10px; }
    .overlay-success .glitch-text { color: #4ade80; text-shadow: 0 0 20px rgba(74, 222, 128, 0.5); }
    .overlay-success .sub-text { color: #4ade80; opacity: 1; }
    @keyframes fadeInOut { 0% { opacity: 0; transform: scale(1.1); } 15% { opacity: 1; transform: scale(1); } 85% { opacity: 1; transform: scale(1); } 100% { opacity: 0; transform: scale(0.9); } }
</style>