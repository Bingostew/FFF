// main.js
import readline from 'readline';
import { F3Game } from '../src/lib/game/F3Game.js';
import MCTS from '../src/lib/game/MCTS.js';

// Setup Command Line Input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Helper: Ask user for input (Promise-based)
function askQuestion(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function runGame() {
    console.log("=================================");
    console.log("   F3: FLEET COMMANDER (CLI)   ");
    console.log("=================================");

    // 1. Initialize Game
    let game = new F3Game();
    
    // SETUP: Let's give you some ships to start with
    game.redFleets = [
        { id: 'R1', pos: 'A1', hp: 2, fuel: 5, isHidden: true },
        { id: 'R2', pos: 'B1', hp: 2, fuel: 5, isHidden: true }
    ];
    
    game.blueFleets = [
        { id: 'B1', pos: 'G6', hp: 2, fuel: 5, isHidden: true },
        { id: 'B2', pos: 'F6', hp: 2, fuel: 5, isHidden: true }
    ];

    // Initialize AI
    const mcts = new MCTS(2000); // 2000 iterations per move

    // 2. Game Loop
    while (!game.isGameOver()) { // Ensure you have isGameOver() in F3Game!
        printBoardState(game);

        if (game.currentPlayer === 'RED') {
            // --- HUMAN TURN ---
            console.log("\n🔴 YOUR TURN (RED)");
            
            // Show valid moves to help the user
            const legalMoves = game.getLegalMoves();
            console.log("Legal Moves:", legalMoves.slice(0, 5), "..."); // Show first 5

            let validMove = false;
            while (!validMove) {
                const moveStr = await askQuestion("Enter Move (e.g., MOVE_R1_B2): ");
                
                if (legalMoves.includes(moveStr)) {
                    game = game.makeMove(moveStr);
                    validMove = true;
                } else {
                    console.log("❌ Invalid move! Check spelling or fuel.");
                }
            }
        } else {
            // --- AI TURN ---
            console.log("\n🔵 AI TURN (BLUE)");
            console.log("Thinking...");
            
            // Run MCTS to find the best move
            const bestMove = mcts.search(game);
            
            if (bestMove) {
                console.log(`AI plays: ${bestMove}`);
                game = game.makeMove(bestMove);
            } else {
                console.log("AI has no moves! (Pass)");
                game.turnEnd(); // Force switch if stuck
            }
        }
    }

    console.log("\nGAME OVER! Winner: " + game.getWinner());
    rl.close();
}

// Helper: Print a simple text dashboard
function printBoardState(game) {
    console.log("\n---------------------------------");
    console.log(`Turn: ${game.turn} | Phase: ${game.phase}`);
    console.log("---------------------------------");
    
    console.log("YOUR FLEETS (RED):");
    game.redFleets.forEach(f => {
        console.log(`  ${f.id} @ ${f.pos} [HP:${f.hp} Fuel:${f.fuel}]`);
    });

    console.log("\nKNOWN ENEMY INTEL (BLUE):");
    // Only show what you can see!
    const visibleBlue = game.blueFleets.filter(f => !f.isHidden);
    if (visibleBlue.length === 0) console.log("  (No enemies detected)");
    visibleBlue.forEach(f => {
        console.log(`  ${f.id} @ ${f.pos} [DETECTED!]`);
    });
    console.log("---------------------------------");
}

// Start!
runGame();