/** socket.io communication functions to talk with server */

// client to server interations


// This file runs in the browser, not on the server!

// 1. Connect to the server
// (Leaving it empty connects to the same URL serving the page)
const socket = io(); 

// 2. DOM Elements (Get references to your HTML tags)
const statusDiv = document.getElementById('game-status');
const joinBtn = document.getElementById('join-btn');

// 3. Game State (Client side memory)
let myPlayerId = null;

// --- LISTENERS (Ears) ---

socket.on('connect', () => {
    statusDiv.innerText = "Connected to Server!";
    myPlayerId = socket.id;
    console.log("My ID:", myPlayerId);
});

socket.on('player_joined', (data) => {
    statusDiv.innerText = `Player ${data.playerId} joined!`;
});

socket.on('update_game_state', (move) => {
    console.log("Opponent moved:", move);
    // Code to update your game board UI goes here
});

// --- EMITTERS (Mouth) ---

joinBtn.addEventListener('click', () => {
    const gameId = prompt("Enter Game ID:");
    if(gameId) {
        socket.emit('join_game', { gameId });
    }
});