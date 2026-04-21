// the below is straight copy and pasted from gemini. need to 
// go through and see what works and how it works
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const gameLogic = require('./socketHandler.js');
const { v4: uuidv4 } = require('uuid'); // Library to generate unique IDs

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const cors = require('cors');

const PORT = process.env.PUBLIC_SERVER_PORT;

app.use(express.static('public'));
app.use(express.json());
app.use(cors());

// --- DATABASE MOCKUP ---
// Each room now tracks specific game data
const lobbies = {}; 
const games = {}

// -- MAP EDITOR FUNCTIONALITY ----------------------------------------------------------------------------------

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

// Ensure maps directory exists
const fs = require('fs');
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

/**************************************************************************************************************/
// --- HTTP: LOBBY MANAGEMENT ---


app.post('/create-lobby', (req, res) => {
    const gameId = uuidv4().substring(0, 6); // Shorter ID for easier sharing
    const mode = (req.body && req.body.mode) ? req.body.mode : 'multi';
    lobbies[gameId] = { 
        players: {}, // Using object keyed by socket.id
        status: 'waiting', 
        full: false,
        turn: 1, // Tracks the current round number (starts at 1)
        activePlayer: null, // Tracks whose turn it is
        fleets: {}, // Secret fleet positions { socketId: { alpha: {q,r}, beta: {q,r} } }
        assets: {}, // Tracks assets like fuel, special weapons, etc.
        botMemory: { knownHits: [], firedShots: [] },
        mode: mode,
        history: [], // Stores a log of all moves/strikes for replay or reconnection
        fleetPlaced: {}
    };
    res.json({ gameId, message: 'Lobby created!' });
});

/**
 * Matchmaking: Find a lobby that is 'waiting' and has exactly 1 player.
 */
app.get('/find-lobby', (req, res) => {
    const gameId = Object.keys(lobbies).find(id => {
        const lobby = lobbies[id];
        return (
            lobby.status === 'waiting' &&
            !lobby.full && 
            Object.keys(lobby.players).length === 1 && 
            lobby.mode === 'multi'
        );
    });
    res.json({ gameId: gameId || null });
});


// --- SOCKET.IO: GAME LOGIC ---

// socketHandler.js file has functions for game logic
gameLogic(io, lobbies);

server.listen(PORT, '0.0.0.0', () => console.log(`Listening on port ${PORT}`));