// const express = require('express');
// const http = require('http');
// const { Server } = require('socket.io');

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, { cors: {origin: "*"}});

// app.use(express.json());

// // automatic way for server to retrieve and send files based on url
// // if filename exists in public directory, it will send it
// app.use(express.json());
// app.use(express.static('public'));

// app.post('/api/names', (req, res) => {
//   const received = req.body.name;
//   console.log('Server Received:', received);

//   res.json({message: "msg was recieved!"});
// });

// app.listen(port, () => {
//   console.log(`Game server listening on port ${port}`);
// });

// /** Testing Socket.io Server Capabilities */
// io.on('connection', (socket) => {
//   console.log('test complete!');
// })

// the below is straight copy and pasted from gemini. need to 
// go through and see what works and how it works
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { v4: uuidv4 } = require('uuid'); // Library to generate unique IDs

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));

app.use(express.json());

// --- DATABASE MOCKUP ---
// In production, use Redis or a real DB
const lobbies = {}; 

// --- 1. HTTP: LOBBY MANAGEMENT ---

// Create a Lobby
app.post('/create-lobby', (req, res) => {
    const gameId = uuidv4(); // Generate unique ID like '9b1deb4d...'
    lobbies[gameId] = { 
        players: [], 
        status: 'waiting' // waiting -> active
    };
    res.json({ gameId, message: 'Lobby created. Share this ID!' });
});

// Join Check (Just checks if valid, doesn't connect socket yet)
app.post('/join-lobby', (req, res) => {
    const { gameId, userId } = req.body;
    
    if (!lobbies[gameId]) {
        return res.status(404).json({ error: 'Lobby not found' });
    }
    
    // Add logic here to store player info if needed
    res.json({ success: true, gameId });
});

// Start Game Trigger
app.post('/start-game', (req, res) => {
    const { gameId } = req.body;
    if (lobbies[gameId]) {
        lobbies[gameId].status = 'active';
        // Notify everyone to connect to sockets now!
        res.json({ success: true, message: 'Game starting!' });
    } else {
        res.status(404).json({ error: 'Lobby not found' });
    }
});

// --- 2. SOCKET.IO: GAME LOGIC ---

io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Client sends: socket.emit('join_game', { gameId: '...' })
    socket.on('join_game', ({ gameId }) => {
        
        // Security: Only allow joining if the lobby exists in HTTP state
        if (!lobbies[gameId]) {
            socket.emit('error', 'Game does not exist');
            return;
        }

        // MAGIC HAPPENS HERE: Join the "Room"
        socket.join(gameId);
        console.log(`Socket ${socket.id} joined room ${gameId}`);
        
        // Notify others in ONLY this room
        io.to(gameId).emit('player_joined', { playerId: socket.id });
    });

    // Handle Game Moves
    socket.on('game_move', (data) => {
        const { gameId, move } = data;
        // Broadcast move to everyone in the room EXCEPT the sender
        socket.to(gameId).emit('update_game_state', move);
    });
});

server.listen(3000, () => {
    console.log('Server running on port 3000');
});