// the below is straight copy and pasted from gemini. need to 
// go through and see what works and how it works
const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');
const gameLogic = require('./socketHandler.js');
const { v4: uuidv4 } = require('uuid'); // Library to generate unique IDs

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- DATABASE MOCKUP ---
// Each room now tracks specific game data
const lobbies = {}; 

const games = {}

// --- HTTP: LOBBY MANAGEMENT ---

app.post('/create-lobby', (req, res) => {
    const gameId = uuidv4().substring(0, 6); // Shorter ID for easier sharing
    lobbies[gameId] = { 
        players: {}, // Using object keyed by socket.id
        status: 'waiting', 
        turn: 1, // Tracks the current round number (starts at 1)
        activePlayer: null, // Tracks whose turn it is
        fleets: {}, // Secret fleet positions { socketId: { alpha: {q,r}, beta: {q,r} } }
        assets: {}, // Tracks assets like fuel, special weapons, etc.
        history: [] // Stores a log of all moves/strikes for replay or reconnection
    };
    res.json({ gameId, message: 'Lobby created!' });
});

// --- SOCKET.IO: GAME LOGIC ---

// socketHandler.js file has functions for game logic
gameLogic(io, lobbies);

server.listen(3000, () => console.log('Server running on port 3000'));