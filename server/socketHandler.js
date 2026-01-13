/** handle socket.io logic */

// game 'brain': will handle socket.io messages
module.exports = (io, lobbies) => {
    io.on('connection', (socket) => {
        console.log(`Player connected: ${socket.id}`);

        socket.on('join_game', ({gameId}) => {   // listen
            // Security: Only allow joining if the lobby exists in HTTP state
            if (!lobbies[gameId]) {
                socket.emit('error', 'Game does not exist');
                console.log('failure');
                return;
            }
            else
                console.log('success');

            // MAGIC HAPPENS HERE: Join the "Room"
            socket.join(gameId);
            console.log(`Socket ${socket.id} joined room ${gameId}`);
            
            // Notify others in ONLY this room
            io.to(gameId).emit('player_joined', { playerId: socket.id });
        });

        socket.on('game_move', (data) => {
            // do something like update gameState

            const { gameId, move } = data;
            // Broadcast move to everyone in the room EXCEPT the sender
            socket.to(gameId).emit('update_game_state', move);
        });
    });
};