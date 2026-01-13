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

// socketHandler.js file has functions for game logic
gameLogic(io, lobbies);

server.listen(3000, () => {
    console.log('Server running on port 3000');
});