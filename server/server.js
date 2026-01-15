// the below is straight copy and pasted from gemini. need to 
// go through and see what works and how it works
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameLogic = require('./socketHandler.js');
const { v4: uuidv4 } = require('uuid'); // Library to generate unique IDs

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static('public'));
app.use(express.json());

// --- DATABASE MOCKUP ---
// Each room now tracks specific game data
const lobbies = {}; 

// --- HTTP: LOBBY MANAGEMENT ---

app.post('/create-lobby', (req, res) => {
    const gameId = uuidv4().substring(0, 6); // Shorter ID for easier sharing
    lobbies[gameId] = { 
        players: {}, // Using object keyed by socket.id
        status: 'waiting', 
        turn: 1,
        fleets: {}, // Secret fleet positions { socketId: { alpha: {q,r}, beta: {q,r} } }
        history: []
    };

    res.status(200);
    res.json({ gameId, message: 'Lobby created!' });
});

app.post('/join-lobby', (req, res) => {
    res.status(200);
    res.json({ message: 'Lobby joined!' });
})

// --- SOCKET.IO: GAME LOGIC ---

// socketHandler.js file has functions for game logic
gameLogic(io, lobbies);

if (require.main === module) {
    server.listen(3000, () => {
        console.log('Server running on port 3000');
    });
}

module.exports = server;    // for testing