<!--MAP, INTERACTIVELY DISPLAYS GRIDS, ALL DATA SURROUNDING GRIDS, FLEET LOCATIONS-->
<!--SCRIPTS FOR MAP-->
<script>
    // @ts-nocheck
    import { onDestroy } from 'svelte';
    import { defineHex, Grid, rectangle, Orientation, line } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';
    import { socket, gameId, activePlayerId } from '$lib/gameStore';   
    import { getTargetHexes, isGroupConnected, getS } from './gridUtils.js';
    import Sidebar from './Sidebar.svelte';
    import StatusBar from './StatusBar.svelte';
    import { goto } from '$app/navigation';

    // Grid Config
    const Tile = defineHex({ 
        dimensions: 50, 
        origin: 'topLeft', 
        orientation: Orientation.FLAT, 
        offset: 1 
    });
    
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));
    const gridHexes = [...grid];

    // --- UNIFIED GAME STATE ---
    let isMultiplayer = $derived(!!$socket && !!$gameId); // <-- Checks if the game is in multiplayer or singleplayer
    let isConfirmed = $state(false);
    let isEnemyTurn = $state(false); // Used strictly for local AI
    let isMyTurn = $derived(!isConfirmed || (isMultiplayer ? ($activePlayerId === $socket?.id) : !isEnemyTurn));
    let hoveredHex = $state(null);
    let selectedGroup = $state([]);
    let targetingMode = $state('focus');
    let fleetSelections = $state([]);
    let rotation = $state(0);
    let selectedFleetToMove = $state(null);
    let warning = $state({ show: false, x: 0, y: 0, text: '', id: 0 });
    
    // Status state
    let currentTurn = $state(1);
    let mousePos = $state({ x: 0, y: 0 }); // Tracks cursor for the tooltip
    let friendlySearchedHexes = $state([]);
    let enemySearchedHexes = $state([]);    
    let isRevealed = $state(false);
    let enemyFleets = $state([ 
        { q: 4, r: -1, name: "IJN Yamato", health: 2 }, { q: 2, r: 1, name: "IJN Musashi", health: 2 }]);
    let gameOver = $state(false);
    let gameResult = $state("");
    let overlay = $state({ show : false, text:'', mode: 'fail'});

    let sourceFleet = $state(null);
    let targetEnemy = $state(null);
    let attackRange = $derived.by(() => {
        if (!sourceFleet || !targetEnemy) return null;
        

        let dist = (Math.abs(sourceFleet.q - targetEnemy.q) + 
                    Math.abs(sourceFleet.r - targetEnemy.r) + 
                    Math.abs((-sourceFleet.q - sourceFleet.r) - (-targetEnemy.q - targetEnemy.r))) / 2;

        const lineOfSight = grid.traverse(line({ start: sourceFleet, stop: targetEnemy }));
        let landPenalty = 0;
        
        const pathArray = [...lineOfSight].slice(1, -1);

        pathArray.forEach(hex => {
            if (specialTiles.some(t => t.col === hex.col && t.row === hex.row)) {
                landPenalty += 1; 
            }
        });

        return landPenalty + dist;
    });

    let requiredRoll = $derived(
        attackRange === null ? null : 
        attackRange <= 2 ? 2 : 
        attackRange <= 6 ? 3 : 4
    );

    // This is the layout of the land tiles
    const specialTiles = [
        { col: 1, row: 2, img: 'single_palm.jpg' },
        { col: 2, row: 1, img: 'double_palm.jpg' },
        { col: 2, row: 4, img: 'tree.jpg' },
        { col: 3, row: 4, img: 'hill.jpg' },
        { col: 4, row: 3, img: 'peak.jpg' },
        { col: 5, row: 2, img: 'mountain.jpg' }
    ];

    //Checks the state of the game, presents Victory or Defeat screen. 
    function checkWinCondition() {
        if (enemyFleets.length === 0) {
            gameOver = true;
            gameResult = "VICTORY";
        } else if (fleetSelections.length === 0) {
            gameOver = true;
            gameResult = "DEFEAT";
        }
    }

    // Gets highlighted hexes & automatically filters out land!
    let highlightedHexes = $derived.by(() => {
        if (!hoveredHex || targetingMode === 'move') return [];

        if (targetEnemy) {
            const isLand = specialTiles.some(t => t.col === hoveredHex.col && t.row === hoveredHex.row);
            return isLand ? [] : [hoveredHex];
        }

        return getTargetHexes(hoveredHex, targetingMode, rotation, gridHexes)
        .filter(hex => !specialTiles.some(t => t.col === hex.col && t.row === hex.row))
    });

    // --- SOCKET LISTENERS (Only runs if Multiplayer) ---
    $effect(() => {
        if ($socket) {
            $socket.on('game_start', ({ activePlayer }) => {
                activePlayerId.set(activePlayer);
                isConfirmed = true; 
                selectedGroup = [];
                targetingMode = 'focus';
            });

            $socket.on('turn_change', ({ activePlayer }) => {
                activePlayerId.set(activePlayer);
            });

            $socket.on('die_result', ({playerId, number}) => {
                if(isMyTurn){
                    let rawPos = selectedGroup;
                    const formattedPositions = {};
                    rawPos.forEach((h, index) => { formattedPositions[index] = { q: h.q, r: h.r }; });
                    $socket.emit(targetingMode, { gameId: $gameId, Positions: formattedPositions, dieResult: number });
                    selectedGroup = [];
                }
            });

            const ISREvents = ['focus_result', 'directional_result', 'area_result'];
            const onISRResult = ({playerName, revealPos, positions}) => {
                let posArray = Object.values(positions);
                if(isMyTurn){
                    const newSearches = posArray.map(p => grid.getHex(p)).filter(Boolean);
                    friendlySearchedHexes = [...friendlySearchedHexes, ...newSearches];
                } else {
                    const scannedHexes = posArray.map(p => grid.getHex(p)).filter(Boolean);
                    enemySearchedHexes = [...enemySearchedHexes, ...scannedHexes];
                }
            };

            ISREvents.forEach(evt => $socket.on(evt, onISRResult));

            return () => {
                $socket.off("room_update");
                $socket.off('game_start');
                $socket.off('turn_change');
                $socket.off('die_result');
                ISREvents.forEach(evt => $socket.off(evt));
            };
        }
    });

    // Hex interaction handlers.
    function handleHexClick(event, hex) {
        if (isConfirmed && !isMyTurn) return;

        // TARGET ACQUIRED 
        if(targetEnemy){
            const friendlyFleet = fleetSelections.find(f => f.q === hex.q && f.r === hex.r);

            if(friendlyFleet){
                sourceFleet = friendlyFleet;
                showWarning(event.clientX, event.clientY, `ATTACKER: ${sourceFleet.name}`);
            }else {
            showWarning(event.clientX, event.clientY, "Select a friendly fleet to engage!");
            }

            return;
        }
        // GLOBAL LAND CHECK
        const isSpecial = specialTiles.some(t => t.col === hex.col && t.row === hex.row);
        if (isSpecial) {
            showWarning(event.clientX, event.clientY, isConfirmed ? "Cannot select land" : "Cannot place fleet on land");
            return;
        }

        // DEPLOYMENT PHASE
        if (!isConfirmed) {
            const tacticalNames = ["USS Gentile", "USS Maroon"]; 

            const index = fleetSelections.findIndex(h => h.q === hex.q && h.r === hex.r);
            
            if (index > -1) {
                // Remove ship and re-assign names to the remaining ones based on their new index
                fleetSelections = fleetSelections.filter(h => h !== fleetSelections[index]);
                fleetSelections = fleetSelections.map((f, i) => ({ 
                    ...f, 
                    name: tacticalNames[i], 
                    id: i + 1 
                }));
            } else if (fleetSelections.length < 2) {
                // Add new ship with distinct stats and a custom name
                const newId = fleetSelections.length + 1;
                const newName = tacticalNames[fleetSelections.length]; // Grabs the name from the array

                fleetSelections = [...fleetSelections, { 
                    q: hex.q, 
                    r: hex.r, 
                    name: newName, 
                    id: newId, 
                    health: 2, 
                    fuel: 3 
                }];
            }
            return;
        }

        // MOVE LOGIC
        if (targetingMode === 'move') {
            const isFleet = fleetSelections.find(h => h.q === hex.q && h.r === hex.r);
            
            // 1. Did they click an existing fleet?
            if (isFleet) {
                if (selectedFleetToMove && selectedFleetToMove.q === isFleet.q && selectedFleetToMove.r === isFleet.r) {
                    selectedFleetToMove = null;
                } else {
                    selectedFleetToMove = isFleet;
                }
                return;
            }

            // 2. If a fleet is selected, attempt the jump
            if (selectedFleetToMove) {
                // Calculate distance using raw q/r coordinates to prevent prototype errors
                const s1 = -selectedFleetToMove.q - selectedFleetToMove.r;
                const s2 = -hex.q - hex.r;
                const isAdjacent = (Math.abs(selectedFleetToMove.q - hex.q) + Math.abs(selectedFleetToMove.r - hex.r) + Math.abs(s1 - s2)) / 2 === 1;

                if (!isAdjacent) {
                    showWarning(event.clientX, event.clientY, "Must jump to an adjacent hex!");
                    return;
                }

                if (selectedFleetToMove.fuel > 0) {
                    // Update ONLY the moving ship's location and fuel
                    fleetSelections = fleetSelections.map(f => 
                        (f.q === selectedFleetToMove.q && f.r === selectedFleetToMove.r) 
                            ? { ...f, q: hex.q, r: hex.r, fuel: f.fuel - 1 } 
                            : f
                    );
                    selectedFleetToMove = null; 
                    targetingMode = 'focus'; 
                    if (isMultiplayer) {
                        $socket.emit('move_fleet', { gameId: $gameId, fleet: selectedFleetToMove, target: hex });
                    } else {
                        triggerOverlay("FLEET REPOSITIONED", "success");
                        // Wait 2 seconds for the overlay to clear, THEN start the AI
                        setTimeout(() => executeEnemyTurn(), 2000); 
                    }
                } else {
                    showWarning(event.clientX, event.clientY, `${selectedFleetToMove.name} is out of fuel!`);
                }
            } else {
                showWarning(event.clientX, event.clientY, "Select a fleet to jump first!");
            }
            return;
        }
        // --- END MOVE LOGIC ---

        if (isConfirmed) {
            const friendlyFleet = fleetSelections.find(f => f.q === hex.q && f.r === hex.r);
            const isDetectedEnemy = enemyFleets.some(e => e.q === hex.q && e.r === hex.r) && 
                                    friendlySearchedHexes.some(s => s.q === hex.q && s.r === hex.r);

            // 1. Select Source (Your Fleet)
            if (friendlyFleet) {
                sourceFleet = friendlyFleet;
                showWarning(event.clientX, event.clientY, `Source: ${sourceFleet.name}`);
            }

            // 2. Select Target (Detected Enemy)
            if (isDetectedEnemy) {
                targetEnemy = hex;
            }
        }

        // TARGETING PHASE
        if (targetingMode === 'directional') {
            // highlightedHexes is already land-free, so we just use it directly!
            const isAlreadySelected = selectedGroup.length > 0 && 
                selectedGroup.some(s => s.q === highlightedHexes[0]?.q && s.r === highlightedHexes[0]?.r);
            if (isAlreadySelected) {
                selectedGroup = []; 
            } else {
                selectedGroup = [...highlightedHexes]; 
            }
            return;
        }

        const idx = selectedGroup.findIndex(s => s.q === hex.q && s.r === hex.r);
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

    //Automatically deselect ship if a different targeting button is selected.
    $effect(() => {
        if (targetingMode !== 'move') {
            selectedFleetToMove = null;
        }
    });

    function confirmFleets() {
        if (fleetSelections.length === 2) {
            if (isMultiplayer) {
                const fleetPositions = { alpha: { q: fleetSelections[0].q, r: fleetSelections[0].r }, beta: { q: fleetSelections[1].q, r: fleetSelections[1].r } };
                $socket.emit('place_fleets', { gameId: $gameId, fleetPositions });
                $socket.once('fleets_placed_confirmation', () => { $socket.emit('ready_check', {gameId: $gameId}); });
            } else {
                isConfirmed = true;

                // Randomize Enemy Fleets
                const waterHexes = gridHexes.filter(h => !specialTiles.some(t => t.col === h.col && t.row === h.row));
                
                const r1 = waterHexes[Math.floor(Math.random() * waterHexes.length)];
                let r2 = waterHexes[Math.floor(Math.random() * waterHexes.length)];
                while (r1.q === r2.q && r1.r === r2.r) {
                    r2 = waterHexes[Math.floor(Math.random() * waterHexes.length)];
                }

                enemyFleets = [ 
                    { q: r1.q, r: r1.r, name: "IJN Yamato", health: 2 }, 
                    { q: r2.q, r: r2.r, name: "IJN Musashi", health: 2 }
                ];
            }
            selectedGroup = [];
            targetingMode = 'focus';
        }
    }

    function handlePlayerSearch() {
        if (isMultiplayer) {
            const rawPos = selectedGroup;
            const formattedPositions = {};
            rawPos.forEach((h, index) => { 
                formattedPositions[index] = { q: h.q, r: h.r }; 
            });

            $socket.emit('die_roll', { gameId: $gameId });
            return false; 
        } else {
            if (selectedGroup.length === 0) return false;

            const newSearches = selectedGroup.filter(selected => !friendlySearchedHexes.some(searched => searched.q === selected.q && searched.r === selected.r));
            const detected = selectedGroup.find(hex => enemyFleets.some(e => e.q === hex.q && e.r === hex.r));
            friendlySearchedHexes = [...friendlySearchedHexes, ...newSearches];

            if(detected){
                selectedGroup = []; 
                return true; 
            }
            selectedGroup = []; 
            return false;
        }
    }

    function handleTurnEnd() {

        targetEnemy = null;
        sourceFleet = null;
        selectedGroup = [];

        if (!isMultiplayer){
            turnTimeout = setTimeout(() => { // <-- Assign to turnTimeout
                executeEnemyTurn(); 
            }, 1500);
        } 
    }

    function resolveAttack(roll1, roll2) {
        if (!sourceFleet || !targetEnemy) return;

        if (isMultiplayer) {
            $socket.emit('attack', { 
                gameId: $gameId, 
                source: sourceFleet, 
                target: targetEnemy,
                roll1: roll1,
                roll2: roll2
            });
            targetEnemy = null;
        } else {
            const hit1 = roll1 >= requiredRoll;
            const hit2 = roll2 >= requiredRoll;
            const totalHits = (hit1 || hit2) ? 1 : 0;
            
            let overlayMsg = "";
            if (totalHits > 0) {
                overlayMsg = "TARGET HIT: 1 DAMAGE";
            } else {
                overlayMsg = "TARGET MISSED: 0 DAMAGE";
            }
            
            const enemyIndex = enemyFleets.findIndex(e => e.q === targetEnemy.q && e.r === targetEnemy.r);
            if (enemyIndex !== -1 && totalHits > 0){
                enemyFleets[enemyIndex].health -= totalHits;
                if(enemyFleets[enemyIndex].health <= 0){
                    enemyFleets = enemyFleets.filter((_, i) => i !== enemyIndex);
                }
                checkWinCondition(); //Check if all enemy vessels are destroyed. 
            }

            // Counter detection roll. 
            const counterRoll = Math.floor(Math.random() * 6) + 1;
            if (counterRoll >= 3) {
                // The enemy successfully traced your attack! Add your ship to their radar.
                enemySearchedHexes = [...enemySearchedHexes, { q: sourceFleet.q, r: sourceFleet.r }];
                triggerOverlay(`${overlayMsg} | WARNING: LOCATION COMPROMISED!`, "fail");
            } else {
                triggerOverlay(overlayMsg, totalHits > 0 ? "success" : "fail");
            }

            setTimeout(() => {
                targetEnemy = null;
                sourceFleet = null;
                selectedGroup = [];
                executeEnemyTurn();
            }, 2000);
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
        if (gameOver) return; // Stop the AI if the game is over!
        isEnemyTurn = true; 

        aiTimeout = setTimeout(() => {
            if (gridHexes.length > 0 && !gameOver) {
                const modes = ['focus', 'directional', 'area'];
                const randomMode = modes[Math.floor(Math.random() * modes.length)];
                const randomRotation = Math.floor(Math.random() * 6);
                
                // Pick a random WATER hex for the scan epicenter
                const waterHexes = gridHexes.filter(h => h && !specialTiles.some(t => t.col === h.col && t.row === h.row));
                const randomHex = waterHexes[Math.floor(Math.random() * waterHexes.length)];
                
                if (randomHex) {
                    const targetHexes = getTargetHexes(randomHex, randomMode, randomRotation, gridHexes) || [];
                    
                    // FIX 1: Added 'target &&' to prevent crashes if the scan goes off the edge of the map!
                    const newSearches = targetHexes.filter(target => 
                        target && 
                        !specialTiles.some(t => t.col === target.col && t.row === target.row) &&
                        !enemySearchedHexes.some(searched => searched.q === target.q && searched.r === target.r) &&
                        !friendlySearchedHexes.some(searched => searched.q === target.q && searched.r === target.r)
                    );
                    
                    enemySearchedHexes = [...enemySearchedHexes, ...newSearches];

                    // Did the AI hit a player ship? (Added 's &&' safety check here too)
                    let hitFriendlyFleet = fleetSelections.find(f => newSearches.some(s => s && s.q === f.q && s.r === f.r));
                    
                    if (hitFriendlyFleet) {
                        // AI Rolls 2 Dice (Assume AI hits on 3+ for standard difficulty)
                        const roll1 = Math.floor(Math.random() * 6) + 1;
                        const roll2 = Math.floor(Math.random() * 6) + 1;
                        const aiRequiredRoll = 3; 
                        const hits = (roll1 >= aiRequiredRoll || roll2 >= aiRequiredRoll) ? 1 : 0;
                        
                        // Update Player Health
                        if (hits > 0) {
                            fleetSelections = fleetSelections.map(f => {
                                if (f.id === hitFriendlyFleet.id) {
                                    return { ...f, health: f.health - hits };
                                }
                                return f;
                            }).filter(f => f.health > 0); 
                        }

                        // --- NEW: PLAYER COUNTER-DETECTION ROLL ---
                        const counterRoll = Math.floor(Math.random() * 6) + 1;
                        
                        // Only trace if we rolled 3+ AND the enemy actually has ships left to trace!
                        if (counterRoll >= 3 && enemyFleets.length > 0) {
                            // Randomly pick which enemy ship fired the shot
                            const attacker = enemyFleets[Math.floor(Math.random() * enemyFleets.length)];
                            
                            // Add it to friendlySearchedHexes so it pops up on your radar!
                            friendlySearchedHexes = [...friendlySearchedHexes, { q: attacker.q, r: attacker.r }];
                            
                            triggerOverlay(`ENEMY ROLLED ${roll1} & ${roll2}. WE TRACED THEIR SIGNAL!`, hits > 0 ? "fail" : "success");
                        } else {
                            triggerOverlay(`ENEMY ROLLED ${roll1} & ${roll2}. ${hits} HITS!`, hits > 0 ? "fail" : "success");
                        }
                        
                        checkWinCondition();
                    } else {
                        triggerOverlay("ENEMY SCAN DETECTED NOTHING", "success");
                    }
                }
            }
            
            currentTurn += 1;
            isEnemyTurn = false; 
        }, 3000); 
    }

    let overlayTimeout; // [cite: 853]
    let aiTimeout;
    let turnTimeout;

    function triggerOverlay(message, mode = 'fail'){
        clearTimeout(overlayTimeout);
        overlay = {show: true, text:message, mode};

        setTimeout(() => {
            overlay.show = false;
        }, 2000);
    }

    // --- DEV TOOLS ---
    function handleDevShortcut(e) {
        // Press Ctrl + Shift + E to toggle the enemy reveal!
        if (e.ctrlKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
            isRevealed = !isRevealed;
            showWarning(mousePos.x || window.innerWidth/2, mousePos.y || window.innerHeight/2, 
                isRevealed ? "DEV MODE: ENEMY REVEALED" : "DEV MODE: HIDDEN");
        }
    }

    onDestroy(() => {
        clearTimeout(overlayTimeout);
        clearTimeout(warningTimeout);
        clearTimeout(aiTimeout);
        clearTimeout(turnTimeout);
    });

</script>

<!--MAP HTML-->
<svelte:window onkeydown={handleDevShortcut} />
<div class="layout-container" class:not-my-turn={isConfirmed && !isMyTurn}>
    
    <!--LEFT-->
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

    <!--MIDDLE-->
    <div 
        class="map-area"
        role="application"
        onmousemove={(e) => { mousePos.x = e.clientX; mousePos.y = e.clientY; }}
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
                        x="15.0" 
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
                    <!-- CHEAT MODE: SHOWS ENEMEY LOCATION -->
                    {@const isEnemyFleet = enemyFleets.some(e => e.q === hex.q && e.r === hex.r)}

                    {@const config = specialTiles.find(t => t.col === hex.col && t.row === hex.row)}
                    {@const isFleet = fleetSelections.some(f => f.q === hex.q && f.r === hex.r)}
                    
                    {@const isFriendlySearched = friendlySearchedHexes.some(s => s.q === hex.q && s.r === hex.r)}
                    {@const isEnemySearched = enemySearchedHexes.some(s => s.q === hex.q && s.r === hex.r)}
                    {@const isSelectedToMove = selectedFleetToMove && selectedFleetToMove.q === hex.q && selectedFleetToMove.r === hex.r} {@const pointsStr = hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                    
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
                            stroke="black" 
                            stroke-width="0.5"
                        />
                        
                        {#if isEnemyFleet && (isRevealed || isFriendlySearched)}
                            <polygon
                                points={pointsStr}
                                fill="#000000" 
                                fill-opacity="0.6" 
                                stroke="#4ade80" 
                                stroke-width="2"
                                pointer-events="none" 
                            />
                            
                            <text 
                                x={hex.x} 
                                y={hex.y} 
                                dy="5" 
                                text-anchor="middle" 
                                fill="#4ade80" 
                                font-family="'Chakra Petch', sans-serif"
                                font-size="12" 
                                font-weight="bold" 
                                pointer-events="none"
                            >
                                ENEMY
                            </text>
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
                    {@const isActive = highlightedHexes.some(h => h.q === hex.q && h.r === hex.r)}
                    {@const isSelected = selectedGroup.some(s => s.q === hex.q && s.r === hex.r)}
                    {@const isSelectedToMove = selectedFleetToMove && selectedFleetToMove.q === hex.q && selectedFleetToMove.r === hex.r}
                    {@const isFleet = fleetSelections.some(f => f.q === hex.q && f.r === hex.r)}
                    
                    {#if isFleet || (isConfirmed && (isActive || isSelected || isSelectedToMove))}
                        <g pointer-events="none">
                            <polygon
                                points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                                fill={
                                    isSelectedToMove ? 'rgba(59, 130, 246, 0.3)' : 
                                    isSelected ? 'rgba(226, 74, 74, 0.6)' :   /* Red takes priority */
                                    isActive ? 'rgba(59, 130, 246, 0.4)' : 'transparent'
                                }
                                stroke={
                                    isSelectedToMove ? "#3b82f6" : 
                                    (isConfirmed && isSelected ? "#e24a4a" :                 /* PRIORITY 1: RED */
                                    (isConfirmed && isActive ? "#3b82f6" :                   /* PRIORITY 2: BLUE */
                                    (isFleet ? "#22c55e" : "transparent")))
                                }
                                stroke-width={
                                    isSelectedToMove ? 4 : 
                                    (isConfirmed && isSelected ? 5 :                         /* BOLDER FOR SELECTION */
                                    (isConfirmed && isActive ? 2 : 
                                    (isFleet ? 4 : 0)))
                                }
                            />
                            
                            {#if isConfirmed && (isActive || isSelected) && !isSelectedToMove}
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
                <div 
                    class="cursor-warning" 
                    style="top: {warning.y}px; left: {warning.x}px;"
                >
                    {warning.text}
                </div>
            {/key}
        {/if}
    </div>

    {#if overlay.show}
    <div class="fullscreen-lock-overlay" class:overlay-success={overlay.mode === 'success'}>
        <div class="failure-content">
            <div class="glitch-text">
                {overlay.text}
            </div>
            <div class="sub-text">
                {overlay.mode === 'success' ? 'FIRE CONTROL INITIALIZED...' : 'RECALIBRATING SENSORS...'}
            </div>
        </div>
    </div>
    {/if}

    {#if gameOver}
    <div class="fullscreen-lock-overlay" style="background: rgba(10, 15, 30, 0.95); flex-direction: column; animation: fadeInStay 0.5s forwards; opacity: 1;">        <div class="failure-content" style="text-align: center;">
            <div class="glitch-text" style="color: {gameResult === 'VICTORY' ? '#4ade80' : '#e24a4a'}; animation: none;">
                {gameResult}
            </div>
            <div class="sub-text" style="color: #abbbd1; margin-bottom: 40px; font-size: 1.5rem; letter-spacing: 5px;">
                {gameResult === 'VICTORY' ? 'ALL ENEMY FLEETS DESTROYED' : 'ALL FRIENDLY FLEETS LOST'}
            </div>
            
            <div style="display: flex; gap: 20px; justify-content: center;">
                <button 
                    class="nav-btn" 
                    onclick={() => { $isHovering = false; goto('/');}}
                    onmouseenter={() => $isHovering = true} 
                    onmouseleave={() => $isHovering = false}
                >
                    MAIN MENU
                </button>
                <button 
                    class="nav-btn" 
                    onclick={() => { $isHovering = false; window.location.reload(); }}
                    onmouseenter={() => $isHovering = true} 
                    onmouseleave={() => $isHovering = false}
                >
                    PLAY AGAIN
                </button>
            </div>
        </div>
    </div>
    {/if}

 

    <!--RIGHT-->
    <StatusBar 
        bind:currentTurn
        bind:isRevealed
        {isMyTurn}
        {isMultiplayer}
        {fleetSelections}
    />
</div>

<!--MAP HTML APPEARANCE-->
<style>
    .layout-container {     
        display: flex; 
        flex-direction: row; 
        width: 100%; 
        height: 100%; 
        overflow: hidden; 
        background: #0b0e14; 
    }

    .layout-container.not-my-turn :global(.sidebar_targeting) {
        pointer-events: none;
        user-select: none;
        opacity: 0.5;
        transition: all 0.4s ease;
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

    .fleet-tooltip {
        position: fixed;
        background: rgba(10, 15, 30, 0.95);
        border: 1px solid #4ade80;
        padding: 10px 15px;
        color: white;
        font-family: 'Chakra Petch', sans-serif;
        pointer-events: none;
        z-index: 100;
        box-shadow: 0 0 15px rgba(74, 222, 128, 0.2);
        border-radius: 4px;
    }
    .tooltip-header {
        font-weight: bold;
        color: #4ade80;
        border-bottom: 1px solid rgba(74, 222, 128, 0.3);
        margin-bottom: 5px;
        padding-bottom: 5px;
        letter-spacing: 1px;
    }
    .tooltip-stat {
        font-size: 0.9rem;
        color: #abbbd1;
        margin-top: 2px;
    }

    .hex-cell polygon {
        transition: fill 0.1s ease, stroke 0.1s ease;
    }

    [fill*="rgba(200, 74, 74, 0.6)"] {
        stroke-width: 5px !important;
        filter: drop-shadow(0 0 5px rgba(226, 74, 74, 0.5));
    }

    .fullscreen-lock-overlay {
        position: fixed;
        top: 0; left: 0;
        width: 100vw; height: 100vh;
        background: rgba(15, 20, 30, 0.7);
        backdrop-filter: blur(4px);
        display: flex; justify-content: center; align-items: center;
        z-index: 9998;
        pointer-events: all;
        animation: fadeInOut 2s forwards;
        cursor: none; 
    }

    /* Default (Fail) Color */
    .glitch-text {
        font-size: 4rem;
        font-weight: 900;
        color: #e24a4a; /* Red */
        text-shadow: 0 0 20px rgba(226, 74, 74, 0.5);
        text-transform: uppercase;
        letter-spacing: 10px;
    }

    /* Success Mode Override */
    .overlay-success .glitch-text {
        color: #4ade80; /* Tactical Green */
        text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
    }

    .overlay-success .sub-text {
        color: #4ade80;
        opacity: 1;
    }

    /* Navigation buttons on game over screen */
    .nav-btn {
        background: transparent;
        border: 2px solid #3b82f6;
        color: #3b82f6;
        padding: 15px 30px;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 1.2rem;
        font-weight: bold;
        cursor: none; /* <-- CHANGE THIS FROM 'pointer' TO 'none' */
        transition: all 0.2s;
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
    }

    .nav-btn:hover {
        background: rgba(59, 130, 246, 0.2);
        color: white;
        border-color: white;
        transform: translateY(-2px);
    }

    @keyframes fadeInOut {
        0% { opacity: 0; transform: scale(1.1); }
        15% { opacity: 1; transform: scale(1); }
        85% { opacity: 1; transform: scale(1); }
        100% { opacity: 0; transform: scale(0.9); }
    }

    @keyframes fadeInStay {
        0% { opacity: 0; transform: scale(1.05); }
        100% { opacity: 1; transform: scale(1); }
    }
    
</style>