/** handle socket.io logic */

// game 'brain': will handle socket.io messages
module.exports = (io, lobbies) => {
    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

    //     // test 
    //     socket.on('join_game', ({gameId}) => {   // listen
    //         // Security: Only allow joining if the lobby exists in HTTP state
    //         if (!lobbies[gameId]) {
    //             socket.emit('error', 'Game does not exist');
    //             console.log('failure');
    //             return;
    //         }
    //         else
    //             console.log('success');

    //         // MAGIC HAPPENS HERE: Join the "Room"
    //         socket.join(gameId);
    //         console.log(`Socket ${socket.id} joined room ${gameId}`);
            
    //         // Notify others in ONLY this room
    //         io.to(gameId).emit('player_joined', { playerId: socket.id });
    //     });

    //     // test
    //     socket.on('game_move', (data) => {
    //         // do something like update gameState

    //         const { gameId, move } = data;
    //         // Broadcast move to everyone in the room EXCEPT the sender
    //         socket.to(gameId).emit('update_game_state', move);
    //     });

    //     /**************************************************************/
    //     // server to client interactions 

    //     // init_game
    //     socket.on('init_game', (data) => {
    //         // TODO: send initialized game information back 
    //     })

    //     // 
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
        });

        // Handle Secret Fleet Placement
        socket.on('place_fleets', ({ gameId, fleetPositions }) => {
            const lobby = lobbies[gameId];
            if (!lobby) return;

            // We restructure the incoming data to add server-side HP
            // This prevents players from trying to start with extra health
            lobby.fleets[socket.id] = {
                alpha: { 
                    q: fleetPositions.alpha.q, 
                    r: fleetPositions.alpha.r, 
                    hp: 2  //Health Initialized here
                },
                beta: { 
                    q: fleetPositions.beta.q, 
                    r: fleetPositions.beta.r, 
                    hp: 2  // Initialized here
                }
            };

            lobby.players[socket.id].ready = true;

            const allReady = Object.values(lobby.players).every(p => p.ready);
            
            if (allReady && Object.keys(lobby.players).length === 2) {
                lobby.status = 'active';
                // Red is usually the first player in the lobby
                io.to(gameId).emit('game_start', { 
                    activePlayer: Object.keys(lobby.players)[0] 
                });
            } else {
                socket.to(gameId).emit('opponent_ready');
            }
        });

        // Handle the "Finish" - Strike Logic
        socket.on('execute_strike', ({ gameId, targetHex }) => {
            const lobby = lobbies[gameId];
            if (!lobby || lobby.status !== 'active') return;

            // Find the opponent
            const opponentId = Object.keys(lobby.players).find(id => id !== socket.id);
            const opponentFleets = lobby.fleets[opponentId];

            let hit = false;
            let fleetKey = null;
            let destroyed = false;

            // 1. Check for Hit & Subtract HP
            for (const key in opponentFleets) {
                const fleet = opponentFleets[key];
                // Ensure we only hit a fleet that is still "alive" (hp > 0)
                if (fleet.q === targetHex.q && fleet.r === targetHex.r && fleet.hp > 0) {
                    hit = true;
                    fleetKey = key;
                    fleet.hp -= 1; // Persistent HP deduction on server
                    
                    if (fleet.hp <= 0) {
                        destroyed = true;
                    }
                    break; 
                }
            }

            // 2. Broadcast result to the room
            io.to(gameId).emit('strike_result', {
                attacker: socket.id,
                hit: hit,
                targetHex: targetHex,
                fleetKey: fleetKey,
                hpRemaining: hit ? opponentFleets[fleetKey].hp : null,
                isDestroyed: destroyed
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
            }
        });

        socket.on('disconnect', () => {
            // Optional: Cleanup empty lobbies
            console.log('User disconnected');
        });


    });

    
};