/** handle socket.io logic */

const BotAI = require('./botAI');

// game 'brain': will handle socket.io messages
module.exports = (io, lobbies) => {

    const BOT_ID = 'CPU_COMMANDER';

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


    const processBotTurn = (gameId) => {
        const lobby = lobbies[gameId];
        if (!lobby || lobby.status !== 'active') return;

        // Initialize Bot Memory
        if (!lobby.botMemory) {
            lobby.botMemory = {
                knownHits: [], 
                firedShots: [] 
            };
        }

        const opponentId = Object.keys(lobby.players).find(id => id !== BOT_ID);
        const opponentFleets = lobby.fleets[opponentId];
        const attackerFleets = lobby.fleets[BOT_ID];

        // 1. Update Memory: Remove destroyed fleets from knownHits
        lobby.botMemory.knownHits = lobby.botMemory.knownHits.filter(pos => {
             return Object.values(opponentFleets).some(f => f.q === pos.q && f.r === pos.r && !f.isDestroyed);
        });

        // 2. Decide Action
        // Priority 2: Search (Focus/Directional/Area) or Random Strike
        const actionRoll = Math.random();
        if (actionRoll < 0.1) {
            const positions = [];
            for(let i=0; i<3; i++) positions.push({ q: Math.floor(Math.random()*9)-4, r: Math.floor(Math.random()*9)-4 });
            handleSearch(gameId, BOT_ID, positions, 0, 'focus', () => {});
        } else if (actionRoll < 0.2) {
            const q = Math.floor(Math.random() * 9) - 4;
            const r = Math.floor(Math.random() * 9) - 4;
            const directions = [[1,0], [1,-1], [0,-1], [-1,0], [-1,1], [0,1]];
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const positions = [];
            for(let i=0; i<3; i++) positions.push({ q: q + (dir[0]*i), r: r + (dir[1]*i) });
            handleSearch(gameId, BOT_ID, positions, dieRoll(), 'directional', () => {});
        } else if (actionRoll < 0.3) {
            const q = Math.floor(Math.random() * 9) - 4;
            const r = Math.floor(Math.random() * 9) - 4;
            const directions = [[1,0], [1,-1], [0,-1], [-1,0], [-1,1], [0,1]];
            const shuffled = directions.sort(() => 0.5 - Math.random());
            const positions = [{q, r}];
            for(let i=0; i<3; i++) positions.push({ q: q + shuffled[i][0], r: r + shuffled[i][1] });
            handleSearch(gameId, BOT_ID, positions, dieRoll(), 'area', () => {});
        } else {
            // Use MCTS for Strike Decision
            const targetHex = BotAI.getBestStrikeAction(lobby, BOT_ID);
            handleStrike(gameId, BOT_ID, targetHex, dieRoll(), () => {});
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
                    alpha: { q: 3, r: -1, hp: 2, isDestroyed: false },
                    beta: { q: -2, r: 2, hp: 2, isDestroyed: false }
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
            handleStrike(gameId, socket.id, targetHex, dieResult, (msg) => socket.emit('error', msg));
        });

        // Handle player leaving the game

        socket.on('leave_game', ({ gameId }) => {
            const lobby = lobbies[gameId];
            if (lobby && lobby.players[socket.id]) {
                const playerName = lobby.players[socket.id].name || 'A player';
                delete lobby.players[socket.id];
                delete lobby.fleets[socket.id];
                if (lobby.assets) delete lobby.assets[socket.id];
                socket.leave(gameId);
                
                // If game was in progress, the other player wins.
                if (lobby.status === 'active' && Object.keys(lobby.players).length > 0) {
                    const winnerId = Object.keys(lobby.players)[0];
                    lobby.status = 'game_over';
                    io.to(gameId).emit('game_over', {
                        winner: lobby.players[winnerId].name,
                        winnerId: winnerId,
                        reason: `${playerName} left the game.`
                    });
                } else {
                    // Otherwise, just update the waiting room
                    io.to(gameId).emit('room_update', {
                        players: lobby.players,
                        status: lobby.status
                    });
                }

                if (Object.keys(lobby.players).length === 0) {
                    console.log(`Deleting empty lobby: ${gameId}`);
                    delete lobbies[gameId];
                }
            }
        });

        /**
         * move fleet handles client request to move one or both fleets. It takes 
         * gameId which should be defined at the client side, fleetkey which is the name of the fleet
         * you want to move, eg. alpha or beta. new position is also set by the client.
         * I recommend that a user can only make a move after they are ready and the game has started.
         * This sh
         */
        socket.on('move_fleet', ({ gameId, fleetKey, newPosition }) => {
            const lobby = lobbies[gameId];
            if (!validateAction(lobby, socket.id, (msg) => socket.emit('error', msg))) {
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
        });
        // Handle disconnection

        socket.on('disconnect', () => {
            console.log(`Player disconnected: ${socket.id}`);
            // Find which game the player was in and handle their departure.
            const gameId = Object.keys(lobbies).find(id => lobbies[id].players[socket.id]);

            if (gameId) {
                const lobby = lobbies[gameId];
                const playerName = lobby.players[socket.id]?.name || 'A player';
                console.log(`${playerName} from game ${gameId} disconnected.`);

                // Remove player from the lobby state
                delete lobby.players[socket.id];
                delete lobby.fleets[socket.id];
                if (lobby.assets) delete lobby.assets[socket.id];

                // If the game was in progress, end it and declare the other player the winner.
                if (lobby.status === 'active' && Object.keys(lobby.players).length > 0) {
                    const winnerId = Object.keys(lobby.players)[0];
                    lobby.status = 'game_over';
                    io.to(gameId).emit('game_over', {
                        winner: lobby.players[winnerId].name,
                        winnerId: winnerId,
                        reason: `${playerName} has disconnected.`
                    });
                } else {
                    // If game wasn't active, just update the lobby for any remaining player.
                    io.to(gameId).emit('room_update', {
                        players: lobby.players,
                        status: lobby.status
                    });
                }

                // If the lobby is now empty, delete it.
                if (Object.keys(lobby.players).length === 0) {
                    console.log(`Deleting empty lobby: ${gameId}`);
                    delete lobbies[gameId];
                }
            }
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


    });

};