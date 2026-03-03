// the below is straight copy and pasted from gemini. need to 
// go through and see what works and how it works
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameLogic = require('./socketHandler.js');
const { v4: uuidv4 } = require('uuid'); // Library to generate unique IDs
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

// Enable CORS for development so the frontend (port 5173) can talk to the backend (port 3000)
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

app.use(express.static('public'));

app.use(express.json());

// Ensure maps directory exists
const mapsDir = path.join(__dirname, '../static/maps');
if (!fs.existsSync(mapsDir)) {
    fs.mkdirSync(mapsDir, { recursive: true });
}

// This endpoint reads a map file and ensures it's in the correct format for the editor.
// It handles legacy maps that might just be an array of tiles.
app.get('/maps/:mapFile', (req, res) => {
    const { mapFile } = req.params;
    // Sanitize filename to prevent directory traversal attacks
    const safeName = path.basename(mapFile);
    const filePath = path.join(mapsDir, safeName);

    fs.readFile(filePath, 'utf8', (err, fileContent) => {
        if (err) return res.status(404).json({ error: 'Map not found' });

        try {
            const data = JSON.parse(fileContent);
            // Handle legacy format (just an array of tiles)
            if (Array.isArray(data)) {
                return res.json({ name: safeName.replace('.json', ''), tiles: data });
            }
            // For new format { name, tiles }, just return it
            res.json(data);
        } catch (e) {
            res.status(500).json({ error: 'Could not parse map file.' });
        }
    });
});

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


// list-maps API
app.get('/list-maps', (req, res) => {
    fs.readdir(mapsDir, (err, files) => {
        if (err) {
            return res.status(500).json([]);
        }
        const jsonFiles = files.filter(f => f.endsWith('.json'));
        res.json(jsonFiles);
    });
});

// save-map API for map editor
app.post('/save-map', (req, res) => {
    const { name, tiles } = req.body;
    if (!name || !tiles) return res.status(400).json({ success: false, error: 'Missing name or data' });
    
    // Sanitize name to prevent directory traversal
    const safeName = name.replace(/[^a-z0-9-_]/gi, '_');
    const filePath = path.join(mapsDir, `${safeName}.json`);
    
    const mapData = {
        name: name,
        tiles: tiles
    };

    fs.writeFile(filePath, JSON.stringify(mapData, null, 2), (err) => {
        if (err) {
            console.error('Error saving map:', err);
            return res.status(500).json({ success: false, error: 'Failed to save map' });
        }
        console.log('Map saved successfully to:', filePath);
        res.json({ success: true });
    });
});

// --- 2. SOCKET.IO: GAME LOGIC ---

// socketHandler.js file has functions for game logic
gameLogic(io, lobbies);

server.listen(3000, () => {
    console.log('Server running on port 3000');
});