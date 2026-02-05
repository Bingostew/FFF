// GameEngine.js
import { GameState, Unit, toGridRef, fromGridRef } from './GameClasses.js'; // Import helpers
import MCTS from './MCTS.js';

// 1. Setup Game
const game = new GameState(); // Defaults to 7x6

// Place AI at "A1" (Top-Left)
const startAI = fromGridRef("A1"); 
game.addUnit(new Unit(1, startAI.x, startAI.y, 'AI'));

// Place Player at "G6" (Bottom-Right)
const startPlayer = fromGridRef("G6");
game.addUnit(new Unit(2, startPlayer.x, startPlayer.y, 'PLAYER'));

// 2. Setup AI
const aiBot = new MCTS(2000);

console.log("--- START TACTICAL SIMULATION ---");
console.log(`AI Starting Position: ${toGridRef(game.units[0].pos)}`); // Prints "A1"

// 3. Execute AI Turn
console.log("AI is calculating optimal move...");
const bestMove = aiBot.search(game);

if (bestMove) {
    const moveName = toGridRef(bestMove);
    console.log(`AI executes move to: ${moveName}`); // Prints e.g., "B1" or "A2"
    
    game.applyMove(bestMove);
} else {
    console.log("AI holds position (No valid moves).");
}