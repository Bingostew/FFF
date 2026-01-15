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

            // Store positions privately on server
            lobby.fleets[socket.id] = fleetPositions;
            lobby.players[socket.id].ready = true;

            // Check if both players are ready
            const allReady = Object.values(lobby.players).every(p => p.ready);
            if (allReady && Object.keys(lobby.players).length === 2) {
                lobby.status = 'active';
                io.to(gameId).emit('game_start', { activePlayer: Object.keys(lobby.players)[0] });
            } else {
                // Tell the other player someone is ready (without showing where they placed ships)
                socket.to(gameId).emit('opponent_ready');
            }
        });

        // Handle the "Finish" - Strike Logic
        socket.on('execute_strike', ({ gameId, targetHex }) => {
            const lobby = lobbies[gameId];
            const opponentId = Object.keys(lobby.players).find(id => id !== socket.id);
            const opponentFleets = lobby.fleets[opponentId];

            // SERVER-SIDE VALIDATION
            // Check if opponent has a fleet at targetHex
            let hit = false;
            let fleetKey = null;

            for (const key in opponentFleets) {
                if (opponentFleets[key].q === targetHex.q && opponentFleets[key].r === targetHex.r) {
                    hit = true;
                    fleetKey = key;
                    break;
                }
            }

            // Broadcast ONLY the result, not the full map
            io.to(gameId).emit('strike_result', {
                attacker: socket.id,
                hit: hit,
                targetHex: targetHex,
                fleetKey: fleetKey // null if miss
            });
        });

        socket.on('disconnect', () => {
            // Optional: Cleanup empty lobbies
            console.log('User disconnected');
        });


    });

    
};