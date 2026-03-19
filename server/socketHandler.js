/** handle socket.io logic */

const BotAI = require('./botAI');

// game 'brain': will handle socket.io messages
module.exports = (io, lobbies) => {

<<<<<<< HEAD
    const BOT_ID = 'CPU_COMMANDER';

=======
>>>>>>> origin/ui
    //function to ensure that each player can perform an action only when it is its turn
    const switchTurn = (gameId) => {
        const lobby = lobbies[gameId];
        if (!lobby) return;
        const playerIds = Object.keys(lobby.players);
        const currentIndex = playerIds.indexOf(lobby.activePlayer);
        const nextIndex = (currentIndex + 1) % playerIds.length;
        lobby.activePlayer = playerIds[nextIndex];
        io.to(gameId).emit('turn_change', { activePlayer: lobby.activePlayer });

        if (lobby.activePlayer === BOT_ID) {
            setTimeout(() => processBotTurn(gameId), 2000);
        }
    };

    // --- SHARED ACTION HANDLERS (Used by both Socket Clients and Bot) ---

    const validateAction = (lobby, playerId, onError) => {
        if (!lobby) {
            onError('Game does not exist');
            return false;
        }
        if (lobby.status !== 'active') {
            onError('Game is not active');
            return false;
        }
        if (lobby.activePlayer !== playerId) {
            onError('It is not your turn.');
            return false;
        }
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

        // Bot Memory Update
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

        // Check die roll conditions based on type
        let success = true;
        if (type === 'directional' && dieResult > 4) success = false;
        if (type === 'area' && dieResult > 3) success = false;
        // Focus (type === 'focus') is always successful if ships are there

        if (success) {
            for (const key in opponentFleets) {
                const fleet = opponentFleets[key];
                if (!fleet.isDestroyed) {
                    if (positions.some(p => comparePositions(p, fleet))) {
                        revealPos.push(fleet);
                        // Bot Memory Update
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
            revealPos: revealPos.length > 0 ? revealPos : null
        });

        switchTurn(gameId);
    };

    const handleMove = (gameId, playerId, fleetKey, newPosition, onError) => {
        const lobby = lobbies[gameId];
        if (!validateAction(lobby, playerId, onError)) {
            return;
        }
    
        const playerAssets = lobby.assets[playerId];
        if (playerAssets.fuel < 1) {
            onError('Not enough fuel to move.');
            return;
        }
    
        const playerFleets = lobby.fleets[playerId];
        if (playerFleets && playerFleets[fleetKey]) {
            // Check for collision with own fleets
            for (const key in playerFleets) {
                const fleet = playerFleets[key];
                if ((key !== fleetKey) && (fleet.hp > 0) && comparePositions(fleet, newPosition)) {
                    onError('Cannot move to a hex occupied by another friendly fleet.');
                    return;
                }
            }
    
            const oldPosition = { q: playerFleets[fleetKey].q, r: playerFleets[fleetKey].r };
    
            playerAssets.fuel -= 1; // Consume fuel
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
            io.to(playerId).emit('update_assets', playerAssets); // Notify client of new fuel amount
            switchTurn(gameId);
        } else {
            onError('Invalid fleet move');
        }
    };

    const processBotTurn = (gameId) => {
        const lobby = lobbies[gameId];
        if (!lobby || lobby.status !== 'active') return;

        if (!lobby.botMemory) {
            lobby.botMemory = {
                knownHits: [], 
                firedShots: [] 
            };
        }

        // Update Memory: Remove destroyed fleets from knownHits before making a decision
        lobby.botMemory.knownHits = lobby.botMemory.knownHits.filter(pos => {
             const opponentId = Object.keys(lobby.players).find(id => id !== BOT_ID);
             return Object.values(lobby.fleets[opponentId]).some(f => f.q === pos.q && f.r === pos.r && !f.isDestroyed);
        });

        // Use MCTS to decide the best action
        const { bestAction, debugInfo } = BotAI.getBestAction(lobby, BOT_ID);
        io.to(gameId).emit('bot_thinking', { debugInfo });

        if (!bestAction) {
            console.log("MCTS returned no action, ending turn.");
            switchTurn(gameId);
            return;
        }

        switch (bestAction.type) {
            case 'strike':
                handleStrike(gameId, BOT_ID, bestAction.hex, dieRoll(), () => {});
                break;
            case 'move':
                handleMove(gameId, BOT_ID, bestAction.fleetKey, bestAction.newPosition, () => {});
                break;
            case 'search':
                handleSearch(gameId, BOT_ID, bestAction.positions, dieRoll(), bestAction.searchType, () => {});
                break;
            default:
                console.log(`Unknown MCTS action type: ${bestAction.type}`);
                switchTurn(gameId);
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
        // Find which game the player was in and handle their departure.
        const gameId = Object.keys(lobbies).find(id => lobbies[id].players[socketId]);

        if (gameId) {
            const lobby = lobbies[gameId];
            const playerName = lobby.players[socketId]?.name || 'A player';
            console.log(`${playerName} from game ${gameId} has left or disconnected.`);

            // Remove player from the lobby state
            delete lobby.players[socketId];
            delete lobby.fleets[socketId];
            if (lobby.assets) delete lobby.assets[socketId];

            // If the game was in progress, end it and declare the other player the winner.
            if (lobby.status === 'active' && Object.keys(lobby.players).length > 0) {
                const winnerId = Object.keys(lobby.players)[0];
                lobby.status = 'game_over';
                io.to(gameId).emit('game_over', {
                    winner: lobby.players[winnerId].name,
                    winnerId: winnerId,
                    reason: `${playerName} has left the game.`
                });
            } else {
                // If game wasn't active, just update the lobby for any remaining player.
                io.to(gameId).emit('room_update', {
                    players: lobby.players,
                    status: lobby.status
                });
            }

            // If the lobby is now empty, delete it to prevent memory leaks.
            if (Object.keys(lobby.players).length === 0) {
                console.log(`Deleting empty lobby: ${gameId}`);
                delete lobbies[gameId];
            }
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

    function dieResult(die1, die2) {
        return die1 + die2;
    }

    function checkForActionConditions(lobby, socket){
        let result = true;

        if (!lobby ) {
            socket.emit('error', 'Game does not exist');
            result = false;
        }

        else if (lobby.status !== 'active') {
            socket.emit('error', 'Game is not active');
            result = false;
        }

        else if (lobby.activePlayer !== socket.id) {
            socket.emit('error', 'It is not your turn.');
            result = false;
        }

        return result;
    }

    function calculateHexDistance(hex1, hex2) {

        const dx = Math.abs(hex1.q - hex2.q);
        const dy = Math.abs(hex1.r - hex2.r);
        const dz = Math.abs(hex1.q + hex1.r - (hex2.q + hex2.r));
    
        return Math.max(dx, dy, dz);
    }

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
            
            // Add player to lobby state
            lobby.players[socket.id] = {
                name: playerName || 'Unknown Commander',
                ready: false,
                color: Object.keys(lobby.players).length === 0 ? 'Red' : 'Blue'
            };

            console.log(`${playerName} joined room ${gameId}`);
            
            // Broadcast updated player list to the room
            io.to(gameId).emit('room_update', {
                players: lobby.players,
                status: lobby.status
            });

            // If single player, add Bot immediately
            if (lobby.mode === 'single' && !lobby.players[BOT_ID]) {
                lobby.players[BOT_ID] = {
                    name: 'CPU Commander',
                    ready: false,
                    color: 'Blue'
                };
            }
        });

        // Handle Secret Fleet Placement
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

            // We restructure the incoming data to add server-side HP
            // This prevents players from trying to start with extra health
            lobby.fleets[socket.id] = {
                alpha: { 
                    q: fleetPositions.alpha.q, // Position data. It will be automatically set when the player places their fleets in the future
                    r: fleetPositions.alpha.r, 
                    hp: 2,  //Health Initialized here
                    isDestroyed: false
                },
                beta: { 
                    q: fleetPositions.beta.q, // Position data. It will be automatically set when the player places their fleets in the future
                    r: fleetPositions.beta.r, 
                    hp: 2,  // Initialized here
                    isDestroyed: false
                }
            };
            lobby.fleetPlaced[socket.id] = true;

            socket.emit('fleets_placed_confirmation');

            // If single player, place Bot fleets immediately
            if (lobby.mode === 'single' && !lobby.fleetPlaced[BOT_ID]) {
                lobby.fleets[BOT_ID] = {
                    alpha: { q: 5, r: -2, hp: 2, isDestroyed: false },
                    beta: { q: 1, r: 3, hp: 2, isDestroyed: false }
                };
                lobby.fleetPlaced[BOT_ID] = true;
            }
        });

        // Handle Ready Check to Start Game
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

            const allReady = Object.values(lobby.players).every(p => p.ready);//checks if all players are ready

            if (allReady && Object.keys(lobby.players).length === 2) {
                lobby.status = 'active';
                lobby.assets = {};
                Object.keys(lobby.players).forEach(id => {
                    lobby.assets[id] = {
                        fuel: 3,
                        fleetCube: 2
                    };
                });
                // Determine the first player. The 'Red' player is designated to go first.
                const redPlayer = Object.entries(lobby.players).find(([, player]) => player.color === 'Red');
                // Fallback to the first player in the list if 'Red' player isn't found for some reason.
                const firstPlayerId = redPlayer ? redPlayer[0] : Object.keys(lobby.players)[0];
                lobby.activePlayer = firstPlayerId;
                io.to(gameId).emit('game_start', { 
                    activePlayer: firstPlayerId 
                });
            }
        });


        // Handle the "Finish" - Strike Logic
        socket.on('execute_strike', ({ gameId, targetHex, dieResult }) => {
<<<<<<< HEAD
            handleStrike(gameId, socket.id, targetHex, dieResult, (msg) => socket.emit('error', msg));
=======
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

            let hit = false;
            let fleetKey = null;
            let destroyed = false;

            let rollSuccessful = false;
            if (shortestDistance <= 2 && dieResult >= 2) {
                rollSuccessful = true;
            } else if ((shortestDistance >= 3 && shortestDistance <= 6) && dieResult >= 3) {
                rollSuccessful = true;
            } else if (shortestDistance > 6 && dieResult >= 4) {
                rollSuccessful = true;
            }

            if (rollSuccessful) {
                fleetKey = resolveStrikeHit(targetHex, opponentFleets);
                if (fleetKey) {
                    hit = true;
                    destroyed = opponentFleets[fleetKey].isDestroyed;
                }
            }

            // 2. Broadcast result to the room
            io.to(gameId).emit('strike_result', {
                attacker: socket.id,
                hit: hit,
                targetHex: targetHex,
                fleetKey: fleetKey,
                hpRemaining: hit ? opponentFleets[fleetKey].hp : null,
                isDestroyed: destroyed,
                distance: shortestDistance
            });

            lobby.history.push({
                action: 'strike',
                playerId: socket.id,
                targetHex: targetHex,
                hit: hit,
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
>>>>>>> origin/ui
        });

        // Handle player leaving the game

        socket.on('leave_game', ({ gameId }) => {
            socket.leave(gameId);
            handlePlayerLeave(socket.id);
        });

        /**
         * move fleet handles client request to move one or both fleets. It takes 
         * gameId which should be defined at the client side, fleetkey which is the name of the fleet
         * you want to move, eg. alpha or beta. new position is also set by the client.
         * I recommend that a user can only make a move after they are ready and the game has started.
         * This sh
         */
        socket.on('move_fleet', ({ gameId, fleetKey, newPosition }) => {
<<<<<<< HEAD
            handleMove(gameId, socket.id, fleetKey, newPosition, (msg) => socket.emit('error', msg));
=======
            const lobby = lobbies[gameId];
            if (checkForActionConditions(lobby, socket) === false) {
                return;
            }

            const playerAssets = lobby.assets[socket.id];
            if (playerAssets.fuel < 1) {
                socket.emit('error', 'Not enough fuel to move.');
                return;
            }

            const playerFleets = lobby.fleets[socket.id];
            if (playerFleets && playerFleets[fleetKey]) {
                // Check for collision with own fleets
                for (const key in playerFleets) {
                    const fleet = playerFleets[key];
                    if ((key !== fleetKey) && (fleet.hp > 0) && ((fleet.q === newPosition.q) && (fleet.r === newPosition.r))) {
                        socket.emit('error', 'Cannot move to a hex occupied by another friendly fleet.');
                        return;
                    }
                }

                const oldPosition = { q: playerFleets[fleetKey].q, r: playerFleets[fleetKey].r };

                playerAssets.fuel -= 1; // Consume fuel
                // Update fleet position
                playerFleets[fleetKey].q = newPosition.q;
                playerFleets[fleetKey].r = newPosition.r;

                lobby.history.push({
                    action: 'move',
                    playerId: socket.id,
                    fleetKey: fleetKey,
                    from: oldPosition,
                    to: newPosition,
                    timestamp: Date.now()
                });

                // Notify all players in the room about the move
                io.to(gameId).emit('fleet_moved', {
                    playerId: socket.id,
                    fleetKey: fleetKey,
                    newPosition: newPosition
                });
                socket.emit('update_assets', playerAssets); // Notify client of new fuel amount
                switchTurn(gameId);
            } else {
                socket.emit('error', 'Invalid fleet move');
            }
>>>>>>> origin/ui
        });
        // Handle disconnection

        socket.on('disconnect', () => {
            console.log(`Player disconnected: ${socket.id}`);
            handlePlayerLeave(socket.id);
        });

        socket.on('focus', (gameId,Positions) => {
            handleSearch(gameId, socket.id, Positions, 0, 'focus', (msg) => socket.emit('error', msg));
        });

        socket.on('directional', (gameId, Positions, dieResult) => {
            handleSearch(gameId, socket.id, Positions, dieResult, 'directional', (msg) => socket.emit('error', msg));
        });

        socket.on('area', (gameId, Positions, dieResult) => {
            handleSearch(gameId, socket.id, Positions, dieResult, 'area', (msg) => socket.emit('error', msg));
        });


        socket.on('die_roll', ({gameId}) => {
            const lobby = lobbies[gameId];
            if (!validateAction(lobby, socket.id, (msg) => socket.emit('error', msg))) {
                return;
            }

            const die = dieRoll();
            
            io.to(gameId).emit('die_result', {
                playerId: socket.id,
                die: die
            });
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
                    else if (comparePositions(Positions[1],fleet)){
                        revealPos.push(fleet);
                    }
                    else if (comparePositions(Positions[2],fleet)){
                        revealPos.push(fleet);
                    }
                }
            }

            if (revealPos.length > 0) {
                io.to(gameId).emit('focus_result', {
                    playerName: player.name,
                    revealPos: revealPos,
                    positions:Positions
                });
            }
            else {
                io.to(gameId).emit('focus_result', {
                    playerName: player.name,
                    revealPos: null,
                    postitions:Positions
                });
            }
            switchTurn(gameId);
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

            if ((revealPos.length > 0) && (dieResult <= 4)) {
                io.to(gameId).emit('directional_result', {
                    playerName: player.name,
                    revealPos: revealPos,
                    positions: Positions
                });
            }
            else {
                io.to(gameId).emit('directional_result', {
                    playerName: player.name,
                    revealPos: null,
                    positions: Positions
                });
            }
            switchTurn(gameId);
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

            if ((revealPos.length > 0) && (dieResult <= 3)) {
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
            }
            switchTurn(gameId);
        });


        socket.on('die_roll', ({gameId}) => {
            const lobby = lobbies[gameId];
            if (checkForActionConditions(lobby, socket) === false) {
                return;
            }

            const die = dieRoll();
            
            io.to(gameId).emit('die_result', {
                playerId: socket.id,
                die: die
            });
        });


    });

};