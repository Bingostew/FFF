/** handle socket.io logic */
// @ts-nocheck

// --- DYNAMICALLY LOAD THE ES MODULE AI FILES INTO NODE.JS ---
let MCTS, F3Game, HexUtils;
const path = require('path');               
const { pathToFileURL } = require('url'); 

(async () => {
    try {
        const aiDir = path.resolve(__dirname, '../src/lib/game');

        const mctsPath = pathToFileURL(path.join(aiDir, 'MCTS.js')).href;
        const f3Path = pathToFileURL(path.join(aiDir, 'F3Game.js')).href;
        const hexPath = pathToFileURL(path.join(aiDir, 'HexUtils.js')).href;

        // Import the modules
        const mctsModule = await import(mctsPath);
        MCTS = mctsModule.default || mctsModule.MCTS; 

        const f3Module = await import(f3Path);
        F3Game = f3Module.F3Game;

        const hexModule = await import(hexPath);
        HexUtils = hexModule.HexUtils;

        console.log("✅ Advanced MCTS Engine successfully wired to the server!");
    } catch (e) {
        console.error("❌ Failed to load AI Modules. Ensure MCTS.js, F3Game.js, and HexUtils.js are in the same folder as this handler.", e);
    }
})();

// game 'brain': will handle socket.io messages
module.exports = (io, lobbies) => {

    const BOT_ID = 'CPU_COMMANDER';

    // --- HEX MATH TRANSLATORS ---
    // The server uses Axial (q,r), but the AI uses Strings ("C3"). These bridge the gap.
    function axialToPosString(q, r) {
        if (!HexUtils) return "A1"; 
        const x = q, z = r, y = -x - z;
        const offset = HexUtils.cubeToOffset({x, y, z});
        return HexUtils.posToString(offset);
    }

    function posStringToAxial(posStr) {
        if (!HexUtils) return { q: 0, r: 0 };
        const offset = HexUtils.parsePos(posStr);
        const cube = HexUtils.offsetToCube(offset);
        return { q: cube.x, r: cube.z };
    }

    // --- AI STATE SYNCHRONIZER ---
    // Packages the server's lobby data into the F3Game format so the MCTS can process it
    function syncLobbyToAI(lobby, botId) {
        const aiGame = new F3Game();
        aiGame.currentPlayer = 'BLUE'; // The Bot is always BLUE in its own head

        const opponentId = Object.keys(lobby.players).find(id => id !== botId);
        const humanFleets = lobby.fleets[opponentId] || {};
        const botFleets = lobby.fleets[botId] || {};

        // 1. Map the Human's Fleets (Hidden)
        aiGame.redFleets = [];
        if (humanFleets.alpha && !humanFleets.alpha.isDestroyed) {
            aiGame.redFleets.push({ id: 'R1', pos: axialToPosString(humanFleets.alpha.q, humanFleets.alpha.r), hp: humanFleets.alpha.hp, fuel: lobby.assets[opponentId]?.fuel || 0, isHidden: true });
        }
        if (humanFleets.beta && !humanFleets.beta.isDestroyed) {
            aiGame.redFleets.push({ id: 'R2', pos: axialToPosString(humanFleets.beta.q, humanFleets.beta.r), hp: humanFleets.beta.hp, fuel: lobby.assets[opponentId]?.fuel || 0, isHidden: true });
        }

        // 2. Map the Bot's Fleets (Visible)
        aiGame.blueFleets = [];
        if (botFleets.alpha && !botFleets.alpha.isDestroyed) {
            aiGame.blueFleets.push({ id: 'B1', pos: axialToPosString(botFleets.alpha.q, botFleets.alpha.r), hp: botFleets.alpha.hp, fuel: lobby.assets[botId]?.fuel || 0, isHidden: false });
        }
        if (botFleets.beta && !botFleets.beta.isDestroyed) {
            aiGame.blueFleets.push({ id: 'B2', pos: axialToPosString(botFleets.beta.q, botFleets.beta.r), hp: botFleets.beta.hp, fuel: lobby.assets[botId]?.fuel || 0, isHidden: false });
        }

        // 3. Rebuild the Bot's Memory (Intel)
        lobby.botMemory.knownHits.forEach(hit => {
            const posStr = axialToPosString(hit.q, hit.r);
            aiGame.blueIntel[aiGame.posToIndex(posStr)] = 'S'; // S = Ship found!
        });

        lobby.botMemory.firedShots.forEach(shotStr => {
            const [q, r] = shotStr.split(',').map(Number);
            const isHit = lobby.botMemory.knownHits.some(h => h.q === q && h.r === r);
            if (!isHit) {
                const posStr = axialToPosString(q, r);
                aiGame.blueIntel[aiGame.posToIndex(posStr)] = 'E'; // E = Empty water
            }
        });

        return aiGame;
    }


    const switchTurn = (gameId) => {
        const lobby = lobbies[gameId];
        if (!lobby) return;
        const playerIds = Object.keys(lobby.players);
        const currentIndex = playerIds.indexOf(lobby.activePlayer);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        lobby.activePlayer = playerIds[nextIndex];
        io.to(gameId).emit('turn_change', { activePlayer: lobby.activePlayer });

        if (lobby.activePlayer === BOT_ID) {
            // Give the human's frontend a moment to breathe before the AI crushes the CPU
            setTimeout(() => processBotTurn(gameId), 1500);
        }
    };

    const validateAction = (lobby, playerId, onError) => {
        if (!lobby) { onError('Game does not exist'); return false; }
        if (lobby.status !== 'active') { onError('Game is not active'); return false; }
        if (lobby.activePlayer !== playerId) { onError('It is not your turn.'); return false; }
        return true;
    };

    const handleStrike = (gameId, playerId, targetHex, dieResult, onError) => {
        const lobby = lobbies[gameId];
        if (!validateAction(lobby, playerId, onError)) return;

        const attackerFleets = lobby.fleets[playerId];
        const distances = [];
        if (attackerFleets.alpha && attackerFleets.alpha.hp > 0) distances.push(calculateHexDistance(attackerFleets.alpha, targetHex));
        if (attackerFleets.beta && attackerFleets.beta.hp > 0) distances.push(calculateHexDistance(attackerFleets.beta, targetHex));
        const shortestDistance = distances.length > 0 ? Math.min(...distances) : Infinity;

        const opponentId = Object.keys(lobby.players).find(id => id !== playerId);
        if (!opponentId) return; 
        const opponentFleets = lobby.fleets[opponentId];

        let hit = false;
        let fleetKey = null;
        let destroyed = false;
        let rollSuccessful = false;

        if (shortestDistance <= 2 && dieResult >= 2) rollSuccessful = true;
        else if (shortestDistance <= 6 && dieResult >= 3) rollSuccessful = true;
        else if (shortestDistance > 6 && dieResult >= 4) rollSuccessful = true;

        if (rollSuccessful) {
            fleetKey = resolveStrikeHit(targetHex, opponentFleets);
            if (fleetKey) {
                hit = true;
                destroyed = opponentFleets[fleetKey].isDestroyed;
            }
        }

        // Update Bot Memory so it doesn't keep shooting dead ships
        if (playerId === BOT_ID) {
            lobby.botMemory.firedShots.push(`${targetHex.q},${targetHex.r}`);
            if (hit && !destroyed) {
                 if (!lobby.botMemory.knownHits.some(h => comparePositions(h, targetHex))) {
                    lobby.botMemory.knownHits.push(targetHex);
                }
            }
        }

        io.to(gameId).emit('strike_result', {
            attacker: playerId,
            hit,
            targetHex,
            fleetKey,
            hpRemaining: hit ? opponentFleets[fleetKey].hp : null,
            isDestroyed: destroyed,
            distance: shortestDistance
        });

        lobby.history.push({
            action: 'strike',
            playerId: playerId,
            targetHex,
            hit,
            fleetKey,
            distance: shortestDistance,
            timestamp: Date.now()
        });

        const allDestroyed = Object.values(opponentFleets).every(f => f.hp <= 0);
        if (allDestroyed) {
            lobby.status = 'game_over';
            io.to(gameId).emit('game_over', { 
                winner: lobby.players[playerId].name,
                winnerId: playerId 
            });
        } else {
            switchTurn(gameId);
        }
    };

    const handleSearch = (gameId, playerId, positions, dieResult, type, onError) => {
        const lobby = lobbies[gameId];
        if (!validateAction(lobby, playerId, onError)) return;

        const opponentId = Object.keys(lobby.players).find(id => id !== playerId);
        const opponentFleets = lobby.fleets[opponentId];
        let revealPos = [];

        const posArray = positions ? (Array.isArray(positions) ? positions : Object.values(positions)) : [];

        let success = true;
        if (type === 'directional' && dieResult > 4) success = false;
        if (type === 'area' && dieResult > 3) success = false;

        if (success) {
            for (const key in opponentFleets) {
                const fleet = opponentFleets[key];
                if (!fleet.isDestroyed) {
                    if (posArray.some(p => comparePositions(p, fleet))) {
                        revealPos.push(fleet);
                        
                        // If the Bot finds you, it logs your position in its memory
                        if (playerId === BOT_ID) {
                            if (!lobby.botMemory.knownHits.some(h => comparePositions(h, fleet))) {
                                lobby.botMemory.knownHits.push({q: fleet.q, r: fleet.r});
                            }
                        }
                    }
                }
            }
        }

        const eventName = type === 'focus' ? 'focus_result' : (type === 'directional' ? 'directional_result' : 'area_result');
        
        io.to(gameId).emit(eventName, {
            playerName: lobby.players[playerId].name,
            revealPos: revealPos.length > 0 ? revealPos : null,
            positions: posArray
        });

        switchTurn(gameId);
    };

    const handleMove = (gameId, playerId, fleetKey, newPosition, onError) => {
        const lobby = lobbies[gameId];
        if (!validateAction(lobby, playerId, onError)) return;
    
        const playerAssets = lobby.assets[playerId];
        if (playerAssets.fuel < 1) {
            onError('Not enough fuel to move.');
            return;
        }
    
        const playerFleets = lobby.fleets[playerId];
        if (playerFleets && playerFleets[fleetKey]) {
            for (const key in playerFleets) {
                const fleet = playerFleets[key];
                if ((key !== fleetKey) && (fleet.hp > 0) && comparePositions(fleet, newPosition)) {
                    onError('Cannot move to a hex occupied by another friendly fleet.');
                    return;
                }
            }
    
            const oldPosition = { q: playerFleets[fleetKey].q, r: playerFleets[fleetKey].r };
    
            playerAssets.fuel -= 1; 
            playerFleets[fleetKey].q = newPosition.q;
            playerFleets[fleetKey].r = newPosition.r;
    
            lobby.history.push({
                action: 'move',
                playerId: playerId,
                fleetKey: fleetKey,
                from: oldPosition,
                to: newPosition,
                timestamp: Date.now()
            });
    
            io.to(gameId).emit('fleet_moved', { playerId, fleetKey, newPosition });
            io.to(playerId).emit('update_assets', playerAssets); 
            switchTurn(gameId);
        } else {
            onError('Invalid fleet move');
        }
    };


    // ==========================================
    // THE NEW BACKEND AI BRAIN
    // ==========================================
    const processBotTurn = async (gameId) => {
        const lobby = lobbies[gameId];
        if (!lobby || lobby.status !== 'active') return;

        // Failsafe in case MCTS hasn't loaded yet
        if (!MCTS || !F3Game) {
            console.error("MCTS Engine is not loaded. Passing turn.");
            switchTurn(gameId);
            return;
        }

        try {
            // 1. Initialize Bot Memory if it's the first turn
            if (!lobby.botMemory) {
                lobby.botMemory = { knownHits: [], firedShots: [] };
            }

            // 2. Clean memory of any ships it already destroyed
            lobby.botMemory.knownHits = lobby.botMemory.knownHits.filter(pos => {
                const opponentId = Object.keys(lobby.players).find(id => id !== BOT_ID);
                return Object.values(lobby.fleets[opponentId]).some(f => f.q === pos.q && f.r === pos.r && !f.isDestroyed);
            });

            // 3. Take a snapshot of the Server Board
            const aiGameState = syncLobbyToAI(lobby, BOT_ID);

            // 4. Run the Monte Carlo Tree Search
            console.log(`[AI] Running 300 simulations for Game ${gameId}...`);
            const mcts = new MCTS(300);
            const bestMove = mcts.search(aiGameState);

            if (!bestMove) {
                console.log("[AI] No valid moves found. Passing turn.");
                switchTurn(gameId);
                return;
            }

            console.log(`[AI] Decided on move: ${bestMove}`);

            // 5. Execute the Output
            const parts = bestMove.split('_');
            const command = parts[0];

            if (command === 'MOVE') {
                const fleetId = parts[1]; // e.g., 'B1'
                const targetPosStr = parts[2];
                const targetAxial = posStringToAxial(targetPosStr);
                const fleetKey = fleetId === 'B1' ? 'alpha' : 'beta';

                handleMove(gameId, BOT_ID, fleetKey, targetAxial, (msg) => console.error(msg));
            }
            else if (command === 'ISR') {
                const scanType = parts[1].toLowerCase(); 
                const hexStrings = parts.slice(2);
                const targetAxials = hexStrings.map(posStringToAxial);

                // Tell the Bot to remember that it searched these hexes so it doesn't search them again
                targetAxials.forEach(hex => {
                    const str = `${hex.q},${hex.r}`;
                    if (!lobby.botMemory.firedShots.includes(str)) {
                        lobby.botMemory.firedShots.push(str);
                    }
                });

                handleSearch(gameId, BOT_ID, targetAxials, dieRoll(), scanType, (msg) => console.error(msg));
            }

        } catch (error) {
            console.error(`[AI CRASH] Bot failed in game ${gameId}:`, error);
            switchTurn(gameId); // Ensure the turn passes back to the human even if the bot dies
        }
    };


    const comparePositions = (pos1, pos2) => {
        return pos1.q === pos2.q && pos1.r === pos2.r;
    };

    function resolveStrikeHit(targetHex, opponentFleets) {
        let fleetKey = null;
        if (comparePositions(targetHex, opponentFleets.alpha) && !opponentFleets.alpha.isDestroyed) {
            fleetKey = 'alpha';
        } else if (comparePositions(targetHex, opponentFleets.beta) && !opponentFleets.beta.isDestroyed) {
            fleetKey = 'beta';
        }


        if (fleetKey) {
            const fleet = opponentFleets[fleetKey];
            fleet.hp -= 1;
            if (fleet.hp <= 0) {
                fleet.isDestroyed = true;
            }
            return fleetKey;
        }
        return null;
    }

    function dieRoll() {
        return Math.floor(Math.random() * 6) + 1;
    }

    function calculateHexDistance(hex1, hex2) {
        const dx = Math.abs(hex1.q - hex2.q);
        const dy = Math.abs(hex1.r - hex2.r);
        const dz = Math.abs(hex1.q + hex1.r - (hex2.q + hex2.r));
    
        return Math.max(dx, dy, dz);
    }

    const handlePlayerLeave = (socketId) => {
        const gameId = Object.keys(lobbies).find(id => lobbies[id].players[socketId]);

        if (gameId) {
            const lobby = lobbies[gameId];
            const playerName = lobby.players[socketId]?.name || 'A player';
            console.log(`${playerName} from game ${gameId} has left or disconnected.`);

            delete lobby.players[socketId];
            delete lobby.fleets[socketId];
            if (lobby.assets) delete lobby.assets[socketId];

            if (lobby.status === 'active' && Object.keys(lobby.players).length > 0) {
                const winnerId = Object.keys(lobby.players)[0];
                lobby.status = 'game_over';
                io.to(gameId).emit('game_over', {
                    winner: lobby.players[winnerId].name,
                    winnerId: winnerId,
                    reason: `${playerName} has left the game.`
                });
            } else {
                io.to(gameId).emit('room_update', {
                    players: lobby.players,
                    status: lobby.status,
                    map: lobby.map
                });
            }

            if (Object.keys(lobby.players).length === 0) {
                console.log(`Deleting empty lobby: ${gameId}`);
                delete lobbies[gameId];
            }
        }
    };

    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

        socket.on('join_game', ({ gameId, playerName }) => {
            const lobby = lobbies[gameId];
            
            if (!lobby) {
                socket.emit('error', 'Game does not exist');
                return;
            }

            if (Object.keys(lobby.players).length >= 2) {
                socket.emit('error', 'Lobby is full');
                return;
            }

            if (lobby.status !== 'waiting') {
                socket.emit('error', 'Game has already started');
                return;
            }

            socket.join(gameId);
            
            lobby.players[socket.id] = {
                name: playerName || 'Unknown Commander',
                ready: false,
                color: Object.keys(lobby.players).length === 0 ? 'Red' : 'Blue'
            };

            console.log(`${playerName} joined room ${gameId}`);
            
            io.to(gameId).emit('room_update', {
                players: lobby.players,
                status: lobby.status,
                map: lobby.map
            });

            if (lobby.mode === 'single' && !lobby.players[BOT_ID]) {
                lobby.players[BOT_ID] = {
                    name: 'CPU Commander',
                    ready: false,
                    color: 'Blue'
                };
            }
        });

        socket.on('place_fleets', ({ gameId, fleetPositions }) => {
            const lobby = lobbies[gameId];
            if (!lobby) {
                socket.emit('error', 'Game does not exist');
                return;
            }
            else if (lobby.fleetPlaced[socket.id])
            {
                socket.emit('error', 'Fleets have already been placed');
                return;
            }

            lobby.fleets[socket.id] = {
                alpha: { 
                    q: fleetPositions.alpha.q, 
                    r: fleetPositions.alpha.r, 
                    hp: 2,  
                    isDestroyed: false
                },
                beta: { 
                    q: fleetPositions.beta.q, 
                    r: fleetPositions.beta.r, 
                    hp: 2,  
                    isDestroyed: false
                }
            };
            lobby.fleetPlaced[socket.id] = true;

            socket.emit('fleets_placed_confirmation');

            if (lobby.mode === 'single' && !lobby.fleetPlaced[BOT_ID]) {
                lobby.fleets[BOT_ID] = {
                    alpha: { q: 5, r: -2, hp: 2, isDestroyed: false },
                    beta: { q: 1, r: 3, hp: 2, isDestroyed: false }
                };
                lobby.fleetPlaced[BOT_ID] = true;
            }
        });

        socket.on('ready_check', ({gameId}) =>{
            const lobby = lobbies[gameId];
            if (!lobby) {
                socket.emit('error', 'Game does not exist');
                return;
            }

            if (!lobby.fleets[socket.id]) {
                socket.emit('error', 'You must place your fleets before readying up.');
                return;
            }

            lobby.players[socket.id].ready = true;

            if (lobby.mode === 'single' && lobby.players[BOT_ID]) {
                lobby.players[BOT_ID].ready = true;
            }

            const allReady = Object.values(lobby.players).every(p => p.ready);

            if (allReady && Object.keys(lobby.players).length === 2) {
                lobby.status = 'active';
                lobby.assets = {};
                Object.keys(lobby.players).forEach(id => {
                    lobby.assets[id] = {
                        fuel: 3,
                        fleetCube: 2
                    };
                });
                
                const redPlayer = Object.entries(lobby.players).find(([, player]) => player.color === 'Red');
                const firstPlayerId = redPlayer ? redPlayer[0] : Object.keys(lobby.players)[0];
                lobby.activePlayer = firstPlayerId;
                io.to(gameId).emit('game_start', { 
                    activePlayer: firstPlayerId 
                });
            }
        });


        // Handle the "Finish" - Strike Logic
        socket.on('execute_strike', ({ gameId, targetHex, dieResult1, dieResult2 }) => {
            const lobby = lobbies[gameId];
            if (checkForActionConditions(lobby, socket) === false) {
                return;
            }

            // Calculate the shortest distance from a living friendly fleet to the target hex
            const attackerFleets = lobby.fleets[socket.id];
            const distances = [];
            if (attackerFleets.alpha && attackerFleets.alpha.hp > 0) {
                distances.push(calculateHexDistance(attackerFleets.alpha, targetHex));
            }

            if (attackerFleets.beta && attackerFleets.beta.hp > 0) {
                distances.push(calculateHexDistance(attackerFleets.beta, targetHex));
            }

            const shortestDistance = distances.length > 0 ? Math.min(...distances) : Infinity;

            // Find the opponent
            const opponentId = Object.keys(lobby.players).find(id => id !== socket.id);
            if (!opponentId) {
                // This can happen if the opponent disconnects at the exact moment of a strike.
                console.log(`Strike by ${socket.id} in game ${gameId} has no opponent.`);
                return;
            }
            const opponentFleets = lobby.fleets[opponentId];

            let hits = 0;
            let fleetKey = null;
            let destroyed = false;

            if (dieResult1 >= shortestDistance) hits++;
            if (dieResult2 >= shortestDistance) hits++;

            for (let i = 0; i < hits; i++) {
                fleetKey = resolveStrikeHit(targetHex, opponentFleets);
                
                if (fleetKey) {
                    destroyed = opponentFleets[fleetKey].isDestroyed;
                }
            }

            // 2. Broadcast result to the room
            io.to(gameId).emit('strike_result', {
                attacker: socket.id,
                hit: hits,
                targetHex: targetHex,
                fleetKey: fleetKey,
                hpRemaining: hits > 0 ? opponentFleets[fleetKey].hp : null,
                isDestroyed: destroyed,
                distance: shortestDistance
            });

            lobby.history.push({
                action: 'strike',
                playerId: socket.id,
                targetHex: targetHex,
                hit: hits,
                fleetKey: fleetKey,
                distance: shortestDistance,
                timestamp: Date.now()
            });

            // 3. Check for Total Victory
            // If all fleets for the opponent have 0 HP, the attacker wins
            const allDestroyed = Object.values(opponentFleets).every(f => f.hp <= 0);
            if (allDestroyed) {
                lobby.status = 'game_over';
                io.to(gameId).emit('game_over', { 
                    winner: lobby.players[socket.id].name,
                    winnerId: socket.id 
                });
            } else {
                switchTurn(gameId);
            }
            // If the Bot is assigned to go first, trigger it!
            if (firstPlayerId === BOT_ID) {
                setTimeout(() => processBotTurn(gameId), 2000);
            }
            
        });

        socket.on('execute_strike', ({ gameId, targetHex, dieResult }) => {
            handleStrike(gameId, socket.id, targetHex, dieResult, (msg) => socket.emit('error', msg));
        });

        socket.on('leave_game', ({ gameId }) => {
            socket.leave(gameId);
            handlePlayerLeave(socket.id);
        });

        socket.on('move_fleet', ({ gameId, fleetKey, newPosition }) => {
            handleMove(gameId, socket.id, fleetKey, newPosition, (msg) => socket.emit('error', msg));
        });

        socket.on('disconnect', () => {
            console.log(`Player disconnected: ${socket.id}`);
            handlePlayerLeave(socket.id);
        });

        socket.on('focus', ({gameId,Positions}) => {
            const lobby = lobbies[gameId];
            let revealPos = [];
            if (!lobby) {
                console.error(`Lobby ${gameId} not found!`);
                return;
            }
            const opponentId = Object.keys(lobby.players).find(id => id !== socket.id);
            const opponentFleets = lobby.fleets[opponentId];
            const player = lobby.players[socket.id];

            if (checkForActionConditions(lobby, socket) === false) {
                return;
            }

            console.log("check");

            for (const key in opponentFleets) {
                const fleet = opponentFleets[key];
                if (!fleet.isDestroyed) {
                    if (comparePositions(Positions[0],fleet)){
                        revealPos.push(fleet);
                    }
                    else if (Positions.length > 1 && comparePositions(Positions[1],fleet)){
                        revealPos.push(fleet);
                    }
                    else if (Positions.length > 2 && comparePositions(Positions[2],fleet)){
                        revealPos.push(fleet);
                    }
                }
            }

            if (revealPos.length > 0) {
                io.to(gameId).emit('focus_result', {
                    playerName: player.name,
                    revealPos: revealPos,
                    positions:Positions,
                    rollSuccess: true
                });
            }
            else {
                io.to(gameId).emit('focus_result', {
                    playerName: player.name,
                    revealPos: null,
                    postitions:Positions,
                    rollSuccess: true

                });
                switchTurn(gameId);
            }
        });

        socket.on('directional', ({gameId, Positions, dieResult}) => {
            const lobby = lobbies[gameId];
            const player = lobby.players[socket.id];
            let revealPos = [];
            const opponentId = Object.keys(lobby.players).find(id => id !== socket.id);
            const opponentFleets = lobby.fleets[opponentId];

            if (checkForActionConditions(lobby, socket) === false) {
                return;
            }
            for (const key in opponentFleets) {
                const fleet = opponentFleets[key];
                if (!fleet.isDestroyed) {
                    console.log(Object.values(Positions));
                    console.log(Positions);
                    if (Positions[0] && comparePositions(Positions[0],fleet)){
                        revealPos.push(fleet);
                    }
                    if (Positions[1] && comparePositions(Positions[1],fleet)){
                        revealPos.push(fleet);
                    }
                    if (Positions[2] && comparePositions(Positions[2],fleet)){
                        revealPos.push(fleet);
                    }
                }
            }

            if(dieResult > 4){
                io.to(gameId).emit('directional_result', {
                    playerName: player.name,
                    revealPos: revealPos,
                    positions: Positions,
                    rollSuccess: false
                });
                switchTurn(gameId);

            }
            else if (revealPos.length > 0) {
                io.to(gameId).emit('directional_result', {
                    playerName: player.name,
                    revealPos: revealPos,
                    positions: Positions,
                    rollSuccess: true

                });
            }
            else {
                io.to(gameId).emit('directional_result', {
                    playerName: player.name,
                    revealPos: null,
                    positions: Positions,
                    rollSuccess: true

                });
                switchTurn(gameId);
            }
        });

        socket.on('area', ({gameId, Positions, dieResult}) => {
            const lobby = lobbies[gameId];
            const player = lobby.players[socket.id];
            let revealPos = [];
            const opponentId = Object.keys(lobby.players).find(id => id !== socket.id);
            const opponentFleets = lobby.fleets[opponentId];

            if (checkForActionConditions(lobby, socket) === false) {
                return;
            }
            for (const key in opponentFleets) {
                const fleet = opponentFleets[key];
                if (!fleet.isDestroyed) {
                    if (comparePositions(Positions[0],fleet)){
                        revealPos.push(fleet);
                    }
                    else if (comparePositions(Positions[1],fleet)){
                        revealPos.push(fleet);
                    }
                    else if (comparePositions(Positions[2],fleet)){
                        revealPos.push(fleet);
                    }
                    else if (comparePositions(Positions[3],fleet)){
                        revealPos.push(fleet);
                    }

                }
            }

            if(dieResult > 3){
                io.to(gameId).emit('area_result', {
                    playerName: player.name,
                    revealPos: revealPos,
                    positions: Positions,
                    rollSuccess: false
                });
                switchTurn(gameId);

            }
            else if ((revealPos.length > 0) && (dieResult <= 3)) {
                io.to(gameId).emit('area_result', {
                    playerName: player.name,
                    revealPos: revealPos,
                    positions: Positions
                });
            }
            else {
                io.to(gameId).emit('area_result', {
                    playerName: player.name,
                    revealPos: null,
                    positions: Positions
                });
                switchTurn(gameId);
            }
        });
            /*
        socket.on('focus', ({gameId, Positions, positions}) => {
            const posToUse = Positions || positions;
            handleSearch(gameId, socket.id, posToUse, 0, 'focus', (msg) => socket.emit('error', msg));
        });

        socket.on('directional', ({gameId, Positions, dieResult}) => {
            handleSearch(gameId, socket.id, Positions, dieResult, 'directional', (msg) => socket.emit('error', msg));
        });

        socket.on('area', ({gameId, Positions, dieResult}) => {
            handleSearch(gameId, socket.id, Positions, dieResult, 'area', (msg) => socket.emit('error', msg));
        });*/

        socket.on('die_roll', ({gameId}) => {
            const lobby = lobbies[gameId];
            if (!validateAction(lobby, socket.id, (msg) => socket.emit('error', msg))) {
                return;
            }
            const die = dieRoll();
            io.to(gameId).emit('die_result', {
                playerId: socket.id,
                number: die 
            });
        });
    });

};