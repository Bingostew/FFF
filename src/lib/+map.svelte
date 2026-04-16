<script>
    // @ts-nocheck
    import { onDestroy } from 'svelte';
    import { defineHex, Grid, rectangle, Orientation, line } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';
    import { socket, gameId, activePlayerId, playerName, isMultiplayer } from '$lib/gameStore';   
    import { getTargetHexes, isGroupConnected, getS } from './gridUtils.js';
    import Sidebar from './Sidebar.svelte';
    import StatusBar from './StatusBar.svelte';
    import { goto } from '$app/navigation';
    import GameLog from './GameLog.svelte';

    // --- BRINGING THE AI BACK HOME FOR SINGLEPLAYER ---
    import MCTS from './game/MCTS.js';
    import { F3Game } from './game/F3Game.js';
    import { HexUtils } from './game/HexUtils.js';

    // Grid Config
    let { customTiles = null } = $props();

    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: Orientation.FLAT, offset: 1 });
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));
    const gridHexes = [...grid];

    // --- UNIFIED GAME STATE ---
    let isConfirmed = $state(false);
    let isEnemyTurn = $state(false); 
    let isMyTurn = $derived(!isConfirmed || ($isMultiplayer ? ($activePlayerId === $socket?.id) : !isEnemyTurn));
    let hoveredHex = $state(null);
    let selectedGroup = $state([]);
    let lockedSelectionForSocket = $state([]); 
    let targetingMode = $state('focus');
    let fleetSelections = $state([]);
    let rotation = $state(0);
    let selectedFleetToMove = $state(null);
    let warning = $state({ show: false, x: 0, y: 0, text: '', id: 0 });
    
    // AI Memory for Hunt & Seek logic
    let aiMemory = $state({
        knownTargets: [],     // Hexes where we know a ship is sitting
        suspectedHexes: []    // Adjacent hexes to search if the ship fled
    });
    
    let currentTurn = $state(1);
    let mousePos = $state({ x: 0, y: 0 }); 
    let friendlySearchedHexes = $state([]);
    let enemySearchedHexes = $state([]);    
    let isRevealed = $state(false);
    
    // Added AI-required properties (id, fuel) that were missing in the UI branch
    let enemyFleets = $state([ 
        { id: 'B1', q: 4, r: -1, name: "IJN Yamato", health: 2, fuel: 3 }, 
        { id: 'B2', q: 2, r: 1, name: "IJN Musashi", health: 2, fuel: 3 }
    ]);
    
    let gameOver = $state(false);
    let gameResult = $state("");
    let globalDice = $state({ show: false, val1: 0, val2: null, text: '', isStopping: false });
    let playerFinalStats = $state({ health: 0, fuel: 0, fleets: 0 });
    let enemyFinalStats = $state({ health: 0, fuel: 0, fleets: 0 });
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
            if (specialTiles.some(t => t.col === hex.col && t.row === hex.row)) landPenalty += 1; 
        });
        return landPenalty + dist;
    });

    let hoveredAttackStats = $derived.by(() => {
        // We only care about this if an enemy is already targeted
        if (!targetEnemy || !hoveredHex) return null;

        // Check if the hex we are hovering over contains one of our fleets
        const hoveredFriendly = fleetSelections.find(f => f.q === hoveredHex.q && f.r === hoveredHex.r);
        if (!hoveredFriendly) return null;

        // Calculate distance (Reuse your existing distance logic)
        const dist = (Math.abs(hoveredFriendly.q - targetEnemy.q) + 
                    Math.abs(hoveredFriendly.r - targetEnemy.r) + 
                    Math.abs((-hoveredFriendly.q - hoveredFriendly.r) - (-targetEnemy.q - targetEnemy.r))) / 2;
        
        // Calculate required roll
        const roll = dist <= 2 ? 2 : dist <= 6 ? 3 : 4;

        return { range: dist, roll: roll, name: hoveredFriendly.name };
    });

    let requiredRoll = $derived(
        attackRange === null ? null : attackRange <= 2 ? 2 : attackRange <= 6 ? 3 : 4
    );

    const specialTiles = $derived(customTiles || [
        { col: 1, row: 2, img: 'single_palm.jpg' }, { col: 2, row: 1, img: 'double_palm.jpg' },
        { col: 2, row: 4, img: 'tree.jpg' }, { col: 3, row: 4, img: 'hill.jpg' },
        { col: 4, row: 3, img: 'peak.jpg' }, { col: 5, row: 2, img: 'mountain.jpg' }
    ]);

    function checkWinCondition() {
        // Always check player and enemy stats to display. 
        playerFinalStats = {
            fleets: fleetSelections.length,
            health: fleetSelections.reduce((acc, f) => acc + Math.max(0, f.health), 0),
            fuel: fleetSelections.reduce((acc, f) => acc + Math.max(0, f.fuel), 0)
        };
        
        enemyFinalStats = {
            fleets: enemyFleets.length,
            health: enemyFleets.reduce((acc, f) => acc + Math.max(0, f.health), 0),
            fuel: enemyFleets.reduce((acc, f) => acc + Math.max(0, f.fuel), 0)
        };

        // 1. Standard Win/Loss (Annihilation)
        if (enemyFleets.length === 0) {
            gameOver = true;
            gameResult = "VICTORY";
            return;
        } else if (fleetSelections.length === 0) {
            gameOver = true;
            gameResult = "DEFEAT";
            return;
        }

        // 2. Turn 10 Time Limit & Tiebreaker
        if (currentTurn > 10) {
            gameOver = true;
            
            // Calculate total points based on surviving assets
            const playerPoints = playerFinalStats.health + playerFinalStats.fuel;
            const enemyPoints = enemyFinalStats.health + enemyFinalStats.fuel;

            if (playerPoints > enemyPoints) {
                gameResult = "VICTORY";
            } else if (enemyPoints > playerPoints) {
                gameResult = "DEFEAT";
            } else {
                gameResult = "DRAW";
            }
        }
    }

    function rollUniversalDice(text, numDice, callback) {
        if (globalDice.show) return;

        globalDice.show = true;
        globalDice.text = text;
        globalDice.isStopping = false;
        globalDice.val1 = Math.floor(Math.random() * 6) + 1;
        globalDice.val2 = numDice === 2 ? Math.floor(Math.random() * 6) + 1 : null;
        
        // 2. Generate the Cryptographically Secure final results
        const cryptoVals = new Uint32Array(2);
        window.crypto.getRandomValues(cryptoVals);
        const final1 = (cryptoVals[0] % 6) + 1;
        const final2 = numDice === 2 ? (cryptoVals[1] % 6) + 1 : null;
        
        let iterations = 0;
        const maxIterations = 15; // 15 frames
        
        function animate() {
            iterations++; 
            
            // 3. Prevent duplicate frames so it visually spins every time
            let next1, next2;
            do { next1 = Math.floor(Math.random() * 6) + 1; } while (next1 === globalDice.val1);
            globalDice.val1 = next1;

            if (numDice === 2) {
                do { next2 = Math.floor(Math.random() * 6) + 1; } while (next2 === globalDice.val2);
                globalDice.val2 = next2;
            }
            
            if (iterations < maxIterations) {
                // 50ms provides a buttery-smooth 20 FPS blur without stuttering
                setTimeout(animate, 50); 
            } else {
                // Lock in the cryptographically secure result
                globalDice.val1 = final1;
                if (numDice === 2) globalDice.val2 = final2;
                globalDice.isStopping = true;
                
                setTimeout(() => {
                    globalDice.show = false;
                    callback(final1, final2);
                }, 2000); 
            }
        }
        animate();
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

            $socket.on('turn_change', ({ activePlayer }) => {
                activePlayerId.set(activePlayer);
                targetEnemy = null;
                sourceFleet = null;
                selectedGroup = [];
            });

            $socket.on('die_result', ({playerId, die}) => {
                if(!isMyTurn){
                    // Coming soon: rollUniversalDice("OPPONENT SCANNING", 1, () => {});
                }
            });

            $socket.on('strike_result', ({attacker, hit, targetHex, fleetKey, hpRemaining, isDetroyed, distance}) => {
                
                if(isMyTurn){

                    enemyFleets = enemyFleets.map(f => {
                        const idMatch = fleetKey === 'alpha' ? 'B1' : 'B2';
                        if (f.id === idMatch) {
                            return { ...f, health: hpRemaining };
                        }
                        return f;
                    }).filter(f => f.health > 0); // Remove if destroyed

                    if (hit === 2) {
                        triggerOverlay("TARGET DESTROYED: 2 HITS", "success");
                    } else if (hit === 1) {
                        triggerOverlay("TARGET HIT", "success");
                    } else {
                        triggerOverlay("TARGET MISSED: 0 HITS", "fail");
                    }
                }
                else{
                    fleetSelections = fleetSelections.map(f => {
                        if (f.q === targetHex.q && f.r === targetHex.r) {
                            return { ...f, health: hpRemaining };
                        }
                        return f;
                    }).filter(f => f.health > 0);

                    if (hit > 0) triggerOverlay("HULL BREACH DETECTED", "fail");

                    setTimeout(() => {
                        if (gameOver) return;
                        rollUniversalDice("--TRACING SIGNAL--", 1, (counterRoll) => {
                            addLog(`Trace attempt rolled a ${counterRoll}.`, "enemy"); // <-- Added Trace Dice Log
                            $socket.emit('counter', { gameId: $gameId, counterResult: counterRoll });
                        });
                    }, 2000);
                }
            });

            $socket.on("counter_result", ({success}) => {
                
                console.log("COUNTTEERRRR RESULTTTTTT");
                if(isMyTurn){
                    if (success) {
                        enemySearchedHexes = [...enemySearchedHexes, { q: sourceFleet.q, r: sourceFleet.r }];
                        triggerOverlay("WARNING: LOCATION COMPROMISED!", "fail");
                        addLog("WARNING: Enemy traced your firing signal!", "enemy");
                        setTimeout(() => handleTurnEnd(), 2000);
                    } else {
                        addLog("Enemy failed to trace your firing signal.", "system");
                    }
                }
                else{
                    console.log("not my turn");
                    if (success) {
                        const attacker = enemyFleets[Math.floor(Math.random() * enemyFleets.length)];
                        friendlySearchedHexes = [...friendlySearchedHexes, { q: attacker.q, r: attacker.r }];
                        triggerOverlay("ENEMY SIGNAL TRACED!", "success");
                    } else {
                        triggerOverlay("SIGNAL TRACE FAILED!", "fail");
                    }
                }
            });
        
            $socket.on('fleet_moved', ({playerId, fleetKey, newPosition}) =>{
                handleTurnEnd();
            });

            $socket.on('error', (message) => {
                console.error("Server Error:", message);
                alert(message); // This will show "Game does not exist"
            });

            // Map.svelte -> inside socket listeners effect
            const ISREvents = ['focus_result', 'directional_result', 'area_result'];

            const onISRResult = (data) => {

                const { playerName, revealPos, positions, rollSuccess } = data;
                
                const scannedCoords = positions ? (Array.isArray(positions) ? positions : Object.values(positions)) : [];

                if (isMyTurn) {

                    // Handle hits/failures as usual
                    if (!rollSuccess) {
                        triggerOverlay("SCAN FAILED: ROLL FAILURE", 'fail');
                        handleTurnEnd();
                        return;
                    }

                    let updatedSearches = [...friendlySearchedHexes];
                    scannedCoords.forEach(coord => {
                        const hex = grid.getHex({ q: coord.q, r: coord.r });
                        if (hex && !updatedSearches.some(s => s.q === hex.q && s.r === hex.r)) {
                            updatedSearches.push(hex);
                        }
                    });
                    friendlySearchedHexes = updatedSearches;


                    if (!revealPos || revealPos.length === 0) {
                        triggerOverlay("AREA CLEAR", 'success');
                        handleTurnEnd();
                        return;
                    }
                    
                    // Target Acquisition logic
                    revealPos.forEach(hit => {
                        const hex = grid.getHex({ q: hit.q, r: hit.r });
                        if (hex && !hit.isDestroyed && !targetEnemy) {
                            targetEnemy = hex;
                            sourceFleet = null;
                            triggerOverlay("TARGET ACQUIRED", 'success');
                        }
                    });

                } else {
                    if (rollSuccess) {
                        let incomingScans = [...enemySearchedHexes];
                        scannedCoords.forEach(coord => {
                            const hex = grid.getHex({ q: coord.q, r: coord.r });
                            if (hex && !incomingScans.some(s => s.q === hex.q && s.r === hex.r)) {
                                incomingScans.push(hex);
                            }
                        });
                        enemySearchedHexes = incomingScans;
                        triggerOverlay("INCOMING SCAN DETECTED", "fail");
                    }
                    else{
                        triggerOverlay("OPPONENT SCAN FAILED", 'success');
                    }
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
                        addLog("Enemy fleet detected moving in sector.", 'enemy');
                    }
                }
            });


            return () => {
                $socket.off("room_update");
                $socket.off('game_start');
                $socket.off('turn_change');
                $socket.off('die_result');
            };
        }
    });

    function handleHexClick(event, hex) {
        if (isConfirmed && !isMyTurn) return;

        const coordStr = `${String.fromCharCode(65 + hex.col)}-${hex.row + 1}`; // e.g., "A-1"

        if(targetEnemy){
            const friendlyFleet = fleetSelections.find(f => f.q === hex.q && f.r === hex.r);
            if(friendlyFleet){
                sourceFleet = friendlyFleet; showWarning(event.clientX, event.clientY, `ATTACKER: ${sourceFleet.name}`);
            } else { showWarning(event.clientX, event.clientY, "Select a friendly fleet to engage!"); }
            return;
        }

        const isSpecial = specialTiles.some(t => t.col === hex.col && t.row === hex.row);
        if (isSpecial) { showWarning(event.clientX, event.clientY, isConfirmed ? "Cannot select land" : "Cannot place fleet on land"); return; }

        // --- PLACEMENT LOGIC ---
        if (!isConfirmed) {
            const tacticalNames = [$playerName + " I", $playerName + " II"] 
            const index = fleetSelections.findIndex(h => h.q === hex.q && h.r === hex.r);
            if (index > -1) {
                const removedName = fleetSelections[index].name;
                fleetSelections = fleetSelections.filter(h => h !== fleetSelections[index]);
                fleetSelections = fleetSelections.map((f, i) => ({ ...f, name: tacticalNames[i], id: i + 1 }));
                addLog(`Recalled ${removedName} from ${coordStr}.`, 'player');
            } else if (fleetSelections.length < 2) {
                const newName = tacticalNames[fleetSelections.length];
                fleetSelections = [...fleetSelections, { q: hex.q, r: hex.r, name: newName, id: fleetSelections.length + 1, health: 2, fuel: 3 }];
                addLog(`Deployed ${newName} to ${coordStr}.`, 'player');
            }
            return;
        }

        // --- MOVEMENT LOGIC ---
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
                    const fleetName = selectedFleetToMove.name;
                    fleetSelections = fleetSelections.map(f => 
                        (f.q === selectedFleetToMove.q && f.r === selectedFleetToMove.r) 
                            ? { ...f, q: hex.q, r: hex.r, fuel: f.fuel - 1 } 
                            : f
                    );
                    enemySearchedHexes = enemySearchedHexes.filter(h => 
                        !(h.q === selectedFleetToMove.q && h.r === selectedFleetToMove.r) &&
                        !(h.q === hex.q && h.r === hex.r)
                    );
                    
                    if ($isMultiplayer) {
                        const fleetIndex = fleetSelections.findIndex(f => 
                            f.q === hex.q && f.r === hex.r
                        );
                        let fleetStr = fleetIndex === 0 ? 'alpha' : 'beta';
                        addLog(`[${fleetName}] repositioned to ${coordStr}.`, 'player');
                        $socket.emit('move_fleet', { gameId: $gameId, fleetKey: fleetStr, newPosition: {q: hex.q, r: hex.r} });
                    } else {
                        selectedFleetToMove = null; targetingMode = 'focus'; 
                        triggerOverlay("FLEET REPOSITIONED", "success");
                        addLog(`[${fleetName}] repositioned to ${coordStr}.`, 'player');
                        setTimeout(() => executeEnemyTurn(), 2000); 
                    }
                } else { showWarning(event.clientX, event.clientY, `${selectedFleetToMove.name} is out of fuel!`); }
            } else { showWarning(event.clientX, event.clientY, "Select a fleet to jump first!"); }
            return;
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


    function confirmFleets() {
        if (fleetSelections.length === 2) {
            addLog("All fleets are positioned!", "system");
            
            if ($isMultiplayer) {
                const fleetPositions = { alpha: { q: fleetSelections[0].q, r: fleetSelections[0].r }, beta: { q: fleetSelections[1].q, r: fleetSelections[1].r } };
                $socket.emit('place_fleets', { gameId: $gameId, fleetPositions });
                $socket.once('fleets_placed_confirmation', () => { $socket.emit('ready_check', {gameId: $gameId}); });
            } else {
                isConfirmed = true; 
                addLog("--- Turn 1 Start ---", "system");
                addLog("---> YOUR TURN", "player");
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


    // search logic
    function handlePlayerSearch(die=0) {

        if (selectedGroup.length === 0) return;

        const needsRoll = targetingMode === 'directional' || targetingMode === 'area';
        const threshold = targetingMode === 'directional' ? 4 : 3;


        if ($isMultiplayer) {
            console.log("SUUUUUUUUUUUUUUUUUUUUUU");
            if (selectedGroup.length === 0) return false;
            const rawPos = selectedGroup;
            const formattedPositions = {};
            selectedGroup.forEach((h, index) => { formattedPositions[index] = { q: h.q, r: h.r }; });

            addLog(`Initiating ${targetingMode.toUpperCase()} scan...`, "player");
            if (die > 0) addLog(`Sensor sweep rolled a ${die}.`, "player");
            
            rollUniversalDice("--SCANNING--", 1, (roll1) => {
                $socket.emit(targetingMode, { gameId: $gameId, Positions: formattedPositions, dieResult: roll1 });
                selectedGroup = []; 
            });
        } else {
            if (selectedGroup.length === 0) return false;

            addLog(`Initiating ${targetingMode.toUpperCase()} scan...`, "player");
            
            rollUniversalDice("--SCANNING--", 1, (roll1) => {
                addLog(`Sensor sweep rolled a ${roll1}.`, "player");
                
                const newSearches = selectedGroup.filter(selected => !friendlySearchedHexes.some(searched => searched.q === selected.q && searched.r === selected.r));
                const detected = selectedGroup.find(hex => enemyFleets.some(e => e.q === hex.q && e.r === hex.r));
                friendlySearchedHexes = [...friendlySearchedHexes, ...newSearches];
                selectedGroup = [];

                if (detected) {
                    triggerOverlay("TARGET FOUND - AUTO-ENGAGING", "success");
                    addLog("Target found! Auto-engaging...", "success");
                    targetEnemy = detected;
                    sourceFleet = fleetSelections.reduce((prev, curr) => {
                        const d1 = (Math.abs(prev.q - detected.q) + Math.abs(prev.r - detected.r) + Math.abs((-prev.q - prev.r) - (-detected.q - detected.r))) / 2;
                        const d2 = (Math.abs(curr.q - detected.q) + Math.abs(curr.r - detected.r) + Math.abs((-curr.q - curr.r) - (-detected.q - detected.r))) / 2;
                        return d2 < d1 ? curr : prev;
                    });
                    
                    setTimeout(() => resolveAttack(), 2000); 
                } else {
                    triggerOverlay("AREA CLEAR", "success");
                    addLog("Scan complete. Area clear.", "system");
                    handleTurnEnd();
                }
            });
        }
    }

    function handleTurnEnd() {
        targetEnemy = null; sourceFleet = null; selectedGroup = [];
        if (!$isMultiplayer){
            turnTimeout = setTimeout(() => { executeEnemyTurn(); }, 1500);
        } 
    }

    /* attack logic
    function resolveAttack() {
        if (!sourceFleet || !targetEnemy) return;

        // Find the coordinates for the log
        const targetCoord = `${String.fromCharCode(65 + targetEnemy.col)}-${targetEnemy.row + 1}`;
        addLog(`[${sourceFleet.name}] firing on coordinates ${targetCoord}...`, "player");

        rollUniversalDice("--FIRING WEAPONS--", 2, (roll1, roll2) => {
            if ($isMultiplayer) {
                $socket.emit('execute_strike', { 
                    gameId: $gameId, 
                    targetHex: { q: targetEnemy.q, r: targetEnemy.r },
                    dieResult1 :roll1,
                    dieResult2: roll2
                });
                targetEnemy = null;
                sourceFleet = null;
            } else {
                let hits = 0;
                if (roll1 >= requiredRoll) hits++;
                if (roll2 >= requiredRoll) hits++;
                
                const enemyIndex = enemyFleets.findIndex(e => e.q === targetEnemy.q && e.r === targetEnemy.r);
                
                if (enemyIndex !== -1 && totalHits > 0){
                    enemyFleets[enemyIndex].health -= totalHits;
                    if(enemyFleets[enemyIndex].health <= 0) enemyFleets = enemyFleets.filter((_, i) => i !== enemyIndex);
                    checkWinCondition(); 
                }

                let hitMsg = hits === 2 ? "CRITICAL STRIKE: 2 DMG" : (hits === 1 ? "TARGET HIT: 1 DMG" : "MISSED");
                triggerOverlay(hitMsg, hits > 0 ? "success" : "fail");

                setTimeout(() => {
                    if (gameOver) return;
                    // ENEMY COUNTER BATTERY: 1 Die, 3+ Traces Signal, Hand Turn Over
                    rollUniversalDice("--ENEMY TRACING SIGNAL--", 1, (counterRoll) => {
                        if (counterRoll >= 3) {
                            enemySearchedHexes = [...enemySearchedHexes, { q: sourceFleet.q, r: sourceFleet.r }];
                            triggerOverlay("WARNING: LOCATION COMPROMISED!", "fail");
                            addLog("WARNING: Enemy traced your firing signal!", "enemy");
                            setTimeout(() => handleTurnEnd(), 2000);
                        } else {
                            addLog("Enemy failed to trace your firing signal.", "system");
                            handleTurnEnd();
                        }
                    });
                }, 2000);
            }
        });
    }
    */

    function resolveAttack() {
        if (!sourceFleet || !targetEnemy) return;

        const targetCoord = `${String.fromCharCode(65 + targetEnemy.col)}-${targetEnemy.row + 1}`;
        addLog(`[${sourceFleet.name}] firing on coordinates ${targetCoord}...`, "player");

        rollUniversalDice("--FIRING WEAPONS--", 2, (roll1, roll2) => {
            
            addLog(`Firing solution rolled: ${roll1} and ${roll2}.`, "player"); 

            if ($isMultiplayer) {
                $socket.emit('execute_strike', { 
                    gameId: $gameId, 
                    targetHex: { q: targetEnemy.q, r: targetEnemy.r },
                    dieResult1 :roll1,
                    dieResult2: roll2
                });
                targetEnemy = null;
                sourceFleet = null;
            } else {
                let hits = 0;
                if (roll1 >= requiredRoll) hits++;
                if (roll2 >= requiredRoll) hits++;
                
                const enemyIndex = enemyFleets.findIndex(e => e.q === targetEnemy.q && e.r === targetEnemy.r);
                
                if (enemyIndex !== -1 && hits > 0){
                    enemyFleets[enemyIndex].health -= hits;
                    if(enemyFleets[enemyIndex].health <= 0) enemyFleets = enemyFleets.filter((_, i) => i !== enemyIndex);
                    checkWinCondition(); 
                }

                if (hits === 2) {
                    triggerOverlay(`CRITICAL HIT AT ${targetCoord}: 2 DMG`, "success");
                    addLog(`Direct hit! Enemy fleet destroyed at ${targetCoord}.`, "success");
                } else if (hits === 1) {
                    triggerOverlay(`HIT AT ${targetCoord}: 1 DMG`, "success");
                    addLog(`Enemy fleet hit at ${targetCoord} (1 DMG).`, "success");
                } else {
                    triggerOverlay(`MISSED ${targetCoord}`, "fail");
                    addLog(`Attack on ${targetCoord} missed.`, "player");
                }

                setTimeout(() => {
                    if (gameOver) return;
                    rollUniversalDice("--ENEMY TRACING SIGNAL--", 1, (counterRoll) => {
                        
                        addLog(`Enemy trace attempt rolled a ${counterRoll}.`, "enemy"); 

                        if (counterRoll >= 3) {
                            enemySearchedHexes = [...enemySearchedHexes, { q: sourceFleet.q, r: sourceFleet.r }];
                            triggerOverlay("WARNING: LOCATION COMPROMISED!", "fail");
                            addLog("WARNING: Enemy traced your firing signal!", "enemy");
                            setTimeout(() => handleTurnEnd(), 2000);
                        } else {
                            addLog("Enemy failed to trace your firing signal.", "system");
                            handleTurnEnd();
                        }
                    });
                }, 2000);
            }
        });
    }
    function endAiTurn() {
        currentTurn += 1;
        checkWinCondition();
        if (!gameOver) isEnemyTurn = false;
    }

    let overlayTimeout; //
    let aiTimeout;
    let turnTimeout;

    function triggerOverlay(message, mode = 'fail'){
        clearTimeout(overlayTimeout);
        overlay = {show: true, text:message, mode};
        setTimeout(() => { overlay.show = false; }, 2000);
    }

    // Board state sent to AI brain
    function syncStateToAI() {
        const aiGame = new F3Game();
        aiGame.currentPlayer = 'BLUE'; 

        aiGame.redFleets = fleetSelections.map((f, i) => {
            const hex = gridHexes.find(h => h.q === f.q && h.r === f.r);
            return { id: `R${i + 1}`, pos: HexUtils.posToString({ col: hex.col, row: hex.row }), hp: f.health, fuel: f.fuel, isHidden: !isRevealed };
        });

        aiGame.blueFleets = enemyFleets.map(f => {
            const hex = gridHexes.find(h => h.q === f.q && h.r === f.r);
            // Check if the player has successfully scanned this hex
            const isRevealedToPlayer = friendlySearchedHexes.some(s => s.q === f.q && s.r === f.r);
            return { id: f.id, pos: HexUtils.posToString({ col: hex.col, row: hex.row }), hp: f.health, fuel: f.fuel, isHidden: !isRevealedToPlayer };
        });

        // 1. Sync standard searched hexes
        enemySearchedHexes.forEach(hex => {
            const idx = aiGame.posToIndex(HexUtils.posToString({ col: hex.col, row: hex.row }));
            const hit = fleetSelections.some(f => f.q === hex.q && f.r === hex.r);
            aiGame.blueIntel[idx] = hit ? 'S' : 'E';
        });

        // 2. THE FIX: Trick the AI into thinking land hexes are already "Empty"
        specialTiles.forEach(tile => {
            const posStr = HexUtils.posToString({ col: tile.col, row: tile.row });
            const idx = aiGame.posToIndex(posStr);
            if (idx !== -1) {
                aiGame.blueIntel[idx] = 'E'; 
            }
        });

        aiGame.landHexes.posToString = specialTiles.map(tile => 
            HexUtils.posToString({ col: tile.col, row: tile.row })
        );

        return aiGame;
    }

    function executeEnemyTurn() {
        if (gameOver) return; 
        isEnemyTurn = true; 
        addLog(`---> ENEMY TURN`, 'system');
        const aiGameState = syncStateToAI();

        aiTimeout = setTimeout(() => {
            try {
                let forcedMove = null;

                aiMemory.knownTargets = aiMemory.knownTargets.filter(targetHex => 
                    fleetSelections.some(f => f.q === targetHex.q && f.r === targetHex.r)
                );

                if (aiMemory.knownTargets.length > 0) {
                    const target = aiMemory.knownTargets[0];
                    const posStr = HexUtils.posToString({ col: target.col, row: target.row });
                    forcedMove = `ISR_focus_${posStr}`;
                } else if (aiMemory.suspectedHexes.length > 0) {
                    const suspect = aiMemory.suspectedHexes.shift(); 
                    const posStr = HexUtils.posToString({ col: suspect.col, row: suspect.row });
                    forcedMove = `ISR_focus_${posStr}`;
                }

                let bestMove = forcedMove;
                if (!bestMove) {
                    const mcts = new MCTS(300); 
                    bestMove = mcts.search(aiGameState);
                }

                if (!bestMove) {
                    triggerOverlay("AI PASSED TURN", "success");
                    addLog("AI PASSED TURN", "success");
                    endEnemyTurn(); return;
                }

                const parts = bestMove.split('_');
                const command = parts[0]; 

                if (command === "MOVE") {
                    const fleetId = parts[1];
                    const targetOffset = HexUtils.parsePos(parts[2]); 
                    let targetHex = gridHexes.find(h => h.col === targetOffset.col && h.row === targetOffset.row);

                    // --- IRONCLAD ANTI-LAND FAILSAFE ---
                    // If the AI math glitches and picks land, Svelte intercepts it here!
                    const isLand = specialTiles.some(t => t.col === targetHex.col && t.row === targetHex.row);
                    if (isLand) {
                        const fleet = enemyFleets.find(f => f.id === fleetId);
                        const s1 = -fleet.q - fleet.r;
                        
                        // Force the AI to pick an adjacent water hex instead
                        const safeNeighbors = gridHexes.filter(h => {
                            const s2 = -h.q - h.r;
                            const dist = (Math.abs(fleet.q - h.q) + Math.abs(fleet.r - h.r) + Math.abs(s1 - s2)) / 2;
                            const notLand = !specialTiles.some(t => t.col === h.col && t.row === h.row);
                            return dist === 1 && notLand;
                        });
                        
                        if (safeNeighbors.length > 0) {
                            targetHex = safeNeighbors[Math.floor(Math.random() * safeNeighbors.length)];
                        }
                    }
                    // -----------------------------------

                    enemyFleets = enemyFleets.map(f => (f.id === fleetId) ? { ...f, q: targetHex.q, r: targetHex.r, fuel: f.fuel - 1 } : f);
                    triggerOverlay(`ENEMY MOVED`, "fail");

                    const isRevealedToPlayer = friendlySearchedHexes.some(s => s.q === targetHex.q && s.r === targetHex.r);
                    if (isRevealedToPlayer || isRevealed) {
                        const coordStr = `${String.fromCharCode(65 + targetHex.col)}-${targetHex.row + 1}`;
                        addLog(`Enemy fleet repositioned to ${coordStr}.`, "enemy");
                    } else {
                        addLog("Enemy fleet movement detected in the shadows.", "enemy");
                    }

                    endEnemyTurn();
                } 
                else if (command === "ISR") {
                    const scanType = parts[1]; 

                    let scannedHexes = parts.slice(2).map(posStr => {
                        const offset = HexUtils.parsePos(posStr);
                        return offset ? gridHexes.find(h => h.col === offset.col && h.row === offset.row) : null;
                    }).filter(Boolean);
                    
                    const targetOffset = HexUtils.parsePos(parts[2]);
                    const centerHex = targetOffset ? gridHexes.find(h => h.col === targetOffset.col && h.row === targetOffset.row) : null;


                    if (scannedHexes.length === 0) {
                        scannedHexes = parts.slice(2).map(posStr => {
                            const offset = HexUtils.parsePos(posStr);
                            return offset ? gridHexes.find(h => h.col === offset.col && h.row === offset.row) : null;
                        }).filter(Boolean); 
                    }

                    rollUniversalDice(`--ENEMY SCANNING (${scanType.toUpperCase()})--`, 1, (aiScanRoll) => {
                        
                        addLog(`Enemy rolled a ${aiScanRoll}.`, "enemy");

                        if (aiScanRoll <= 3) {
                            enemySearchedHexes = [...enemySearchedHexes, ...scannedHexes];
                            const detectedFriendly = scannedHexes.find(hex => fleetSelections.some(f => f.q === hex.q && f.r === hex.r));

                            if (detectedFriendly) {
                                aiMemory.knownTargets = [{ q: detectedFriendly.q, r: detectedFriendly.r, col: detectedFriendly.col, row: detectedFriendly.row }];
                                aiMemory.suspectedHexes = []; 
                                triggerOverlay("ENEMY LOCK DETECTED!", "fail");
                                addLog(`WARNING: Enemy scan detected your fleet!`, 'enemy');

                                setTimeout(() => {
                                    rollUniversalDice("--INCOMING--", 2, (r1, r2) => {
                                        const targetCoord = `${String.fromCharCode(65 + detectedFriendly.col)}-${detectedFriendly.row + 1}`;
                                        
                                        addLog(`Enemy firing on ${targetCoord}. Rolled: ${r1} and ${r2}.`, "enemy"); 

                                        let hits = 0;
                                        if (r1 >= 3) hits++;
                                        if (r2 >= 3) hits++;
                                        
                                        if (hits > 0) {
                                            fleetSelections = fleetSelections.map(f => {
                                                if (f.q === detectedFriendly.q && f.r === detectedFriendly.r) return { ...f, health: f.health - hits };
                                                return f;
                                            }).filter(f => f.health > 0);
                                        }
                                        checkWinCondition();

                                        let hitMsg = hits === 2 ? `CRITICAL HIT AT ${targetCoord}: 2 DMG` : (hits === 1 ? `HIT AT ${targetCoord}: 1 DMG` : `ENEMY MISSED ${targetCoord}`);
                                        triggerOverlay(hitMsg, hits > 0 ? "fail" : "success");
                                        addLog(hitMsg, hits > 0 ? "enemy" : "success");
                                        
                                        setTimeout(() => {
                                            if(gameOver || enemyFleets.length === 0) return endEnemyTurn();
                                            
                                            rollUniversalDice("--TRACING ENEMY SIGNAL--", 1, (counterRoll) => {
                                                addLog(`Counter-trace attempt rolled a ${counterRoll}.`, "player"); 

                                                if (counterRoll >= 3) {
                                                    const attacker = enemyFleets[Math.floor(Math.random() * enemyFleets.length)];
                                                    friendlySearchedHexes = [...friendlySearchedHexes, { q: attacker.q, r: attacker.r }];
                                                    triggerOverlay("ENEMY SIGNAL TRACED!", "success");
                                                    addLog(`Enemy fired on ${targetCoord}. We traced their firing signal!`, "success");
                                                } else {
                                                    triggerOverlay("SIGNAL TRACE FAILED!", "fail");
                                                    addLog(`Enemy fired on ${targetCoord}. Trace failed.`, "system");
                                                }
                                                endEnemyTurn(); 
                                            });
                                        }, 2000);
                                    });
                                }, 2000);

                            } else { 
                                const missedKnown = aiMemory.knownTargets.find(t => scannedHexes.some(s => s.q === t.q && s.r === t.r));
                                if (missedKnown) {
                                    aiMemory.knownTargets = [];
                                    aiMemory.suspectedHexes = getTargetHexes(missedKnown, 'area', 0, gridHexes)
                                        .filter(h => !specialTiles.some(t => t.col === h.col && t.row === h.row))
                                        .filter(h => !enemySearchedHexes.some(s => s.q === h.q && s.r === h.r));
                                }
                                triggerOverlay(`ENEMY SCAN DETECTED NOTHING!`, "success");
                                addLog(`Enemy conducted a ${scanType} scan. No detection.`, "enemy"); 
                                endEnemyTurn();
                            }
                        } else {
                            triggerOverlay(`ENEMY SCAN FAILED!`, "success");
                            addLog(`Enemy scan failed.`, "system"); 
                            endEnemyTurn();
                        }
                    });
                }
            } catch (error) {
                console.error("AI Crash:", error);
                endEnemyTurn(); 
            }
        }, 1500); 
    }

    function endEnemyTurn() {
        setTimeout(() => {
            currentTurn += 1;
            checkWinCondition();
            if (!gameOver) 
                isEnemyTurn = false; 
                addLog(`--- Turn ${currentTurn} Start ---`, 'system');
                addLog(`---> YOUR TURN`, 'player');
        }, 2500);
    }

    function handleDevShortcut(e) {
        if (e.ctrlKey && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
            isRevealed = !isRevealed;
            showWarning(mousePos.x || window.innerWidth/2, mousePos.y || window.innerHeight/2, 
                isRevealed ? "DEV MODE: ENEMY REVEALED" : "DEV MODE: HIDDEN");
        }
    }

    // --- GAME LOG STATE ---
    let gameLogs = $state([]);

    function addLog(message, type = 'system') {
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        // Keep only the last 50 logs to prevent memory bloat
        if (gameLogs.length > 50) gameLogs.shift();
        gameLogs.push({ time, message, type });
    }

    onDestroy(() => {
        clearTimeout(overlayTimeout);
        clearTimeout(warningTimeout);
        clearTimeout(aiTimeout);
        clearTimeout(turnTimeout);
    });
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
                    {@const isSelectedToMove = selectedFleetToMove && selectedFleetToMove.q === hex.q && selectedFleetToMove.r === hex.r} 
                    {@const pointsStr = hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                    
                    <g 
                        class="hex-cell" role="button" tabindex="0" onclick={(e) => handleHexClick(e, hex)}
                        onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
                        onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
                        onkeydown={(e) => (e.key === 'Enter' || e.key === ' ') && handleHexClick(e, hex)}
                        style="cursor: none; outline: none;"
                    >
                        <polygon points={pointsStr} fill={config ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"} stroke="black" stroke-width="0.5"/>
                        
                        {#if isEnemyFleet && !isFleet && (isRevealed || isFriendlySearched)}
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

        {#if targetEnemy}
            {#if hoveredAttackStats}
                <div class="fleet-tooltip attack-mode" style="top: {mousePos.y - 120}px; left: {mousePos.x}px; border-color: #3b82f6;">
                    <div class="tooltip-header" style="color: #e24a4a;">FIRING SOLUTION: {hoveredAttackStats.name}</div>
                    <div class="tooltip-stat">TARGET RANGE: <span style="color: #fff">{hoveredAttackStats.range} HEXES</span></div>
                    <div class="tooltip-stat">ROLL NEEDED: <span style="color: #e24a4a; font-weight: bold;">{hoveredAttackStats.roll}+</span></div>
                    <div class="tooltip-stat" style="font-size: 0.7rem; opacity: 0.7;">[CLICK TO SELECT AS SOURCE]</div>
                </div>
            {/if}
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
            <div class="sub-text">{overlay.mode === 'success' ? 'COLLECTING DATA...' : 'RECALIBRATING SENSORS...'}</div>
        </div>
    </div>
    {/if}

    {#if gameOver}
    <div class="fullscreen-lock-overlay" style="background: rgba(10, 15, 30, 0.95); flex-direction: column; animation: fadeInStay 0.5s forwards; opacity: 1;"> 
        <div class="failure-content" style="text-align: center;">
            <div class="glitch-text" style="color: {gameResult === 'VICTORY' ? '#4ade80' : gameResult === 'DEFEAT' ? '#e24a4a' : '#eab308'}; animation: none;">
                {gameResult}
            </div>
            
            <div class="sub-text" style="color: #abbbd1; margin-bottom: 40px; font-size: 1.5rem; letter-spacing: 5px;">
                {#if gameResult === 'VICTORY'}
                    {enemyFleets.length === 0 ? 'ALL ENEMY FLEETS DESTROYED' : 'STRATEGIC VICTORY: SUPERIOR ASSETS'}
                {:else if gameResult === 'DEFEAT'}
                    {fleetSelections.length === 0 ? 'ALL FRIENDLY FLEETS LOST' : 'TACTICAL DEFEAT: INSUFFICIENT ASSETS'}
                {:else}
                    HOSTILITIES CEASED: STALEMATE
                {/if}
            </div>

            <div style="display: flex; gap: 40px; justify-content: center; margin-bottom: 40px; font-family: 'Chakra Petch'; color: #fff;">
                <div style="background: rgba(59,130,246,0.2); border: 1px solid #3b82f6; padding: 15px; border-radius: 4px;">
                    <h3 style="margin: 0 0 10px 0; color: #3b82f6;">FRIENDLY ASSETS</h3>
                    <div>FLEETS: {playerFinalStats.fleets}</div>
                    <div>HULL INT.: {playerFinalStats.health}</div>
                    <div>FUEL: {playerFinalStats.fuel}</div>
                </div>
                <div style="background: rgba(226,74,74,0.2); border: 1px solid #e24a4a; padding: 15px; border-radius: 4px;">
                    <h3 style="margin: 0 0 10px 0; color: #e24a4a;">ENEMY ASSETS</h3>
                    <div>FLEETS: {enemyFinalStats.fleets}</div>
                    <div>HULL INT.: {enemyFinalStats.health}</div>
                    <div>FUEL: {enemyFinalStats.fuel}</div>
                </div>
            </div>
            
            <div style="display: flex; gap: 20px; justify-content: center;">
                <button class="nav-btn" onclick={() => { $isHovering = false; goto('/');}} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>
                    MAIN MENU
                </button>
                <button class="nav-btn" onclick={() => { $isHovering = false; window.location.reload(); }} onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>
                    PLAY AGAIN
                </button>
            </div>
        </div>
    </div>
    {/if}

    {#if globalDice.show}
        <div class="dice-popup-overlay" style="position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.6); display: flex; justify-content: center; align-items: center; z-index: 10000; backdrop-filter: blur(2px);">
            <div class="dice-box {globalDice.isStopping ? 'is-stopping' : ''}" style="background: #0a0f1e; border: 2px solid {globalDice.isStopping ? '#22c55e' : '#3b82f6'}; padding: 40px; text-align: center; box-shadow: 0 0 30px {globalDice.isStopping ? 'rgba(34,197,94,0.4)' : 'rgba(59,130,246,0.4)'}; clip-path: polygon(10% 0, 100% 0, 100% 90%, 90% 100%, 0 100%, 0 10%);">
                <span style="font-family: 'Chakra Petch'; color: #abbbd1; letter-spacing: 3px;">{globalDice.text}</span>
                <div style="display: flex; gap: 20px; justify-content: center; margin: 20px 0;">
                    <div style="width: 100px; height: 100px; background: #000; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 4rem; font-weight: bold; color: {globalDice.isStopping ? '#22c55e' : '#3b82f6'}; font-family: 'Chakra Petch';">{globalDice.val1}</div>
                    {#if globalDice.val2 !== null}
                        <div style="width: 100px; height: 100px; background: #000; border: 2px solid currentColor; display: flex; align-items: center; justify-content: center; font-size: 4rem; font-weight: bold; color: {globalDice.isStopping ? '#22c55e' : '#3b82f6'}; font-family: 'Chakra Petch';">{globalDice.val2}</div>
                    {/if}
                </div>
                {#if globalDice.isStopping}<div style="font-size: 0.8rem; color: #22c55e; letter-spacing: 5px; font-weight: bold;">RESULT LOCKED</div>{/if}
            </div>
        </div>
    {/if}

    <GameLog logs={gameLogs} />

    <StatusBar 
        bind:currentTurn
        bind:isRevealed
        {isMyTurn}
        {$isMultiplayer}
        {fleetSelections}
    />
</div>

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
    
    .tactical-grid { 
        width: 100%; 
        height: 100%; 
        filter: drop-shadow(0 0 20px rgba(0,0,0,0.5)); 
    }

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

    @keyframes popAndFade {
        0% { opacity: 0; transform: translate(15px, 0) scale(0.5); }
        15% { opacity: 1; transform: translate(15px, -25px) scale(1.1); }
        100% { opacity: 0; transform: translate(15px, -40px); }
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

    .glitch-text {
        font-size: 4rem;
        font-weight: 900;
        color: #e24a4a; 
        text-shadow: 0 0 20px rgba(226, 74, 74, 0.5);
        text-transform: uppercase;
        letter-spacing: 10px;
    }

    .overlay-success .glitch-text {
        color: #4ade80; 
        text-shadow: 0 0 20px rgba(74, 222, 128, 0.5);
    }

    .overlay-success .sub-text {
        color: #4ade80;
        opacity: 1;
    }

    .nav-btn {
        background: transparent;
        border: 2px solid #3b82f6;
        color: #3b82f6;
        padding: 15px 30px;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 1.2rem;
        font-weight: bold;
        cursor: none;
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
