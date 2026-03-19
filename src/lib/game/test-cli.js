// src/lib/game/test-cli.js
// @ts-nocheck
import readline from 'readline';
import { F3Game } from './F3Game.js';
import MCTS from './MCTS.js';

// Setup Terminal Input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const askQuestion = (query) => new Promise(resolve => rl.question(query, resolve));

// --- ANIMATION HELPER ---
// Creates a fake delay so the terminal doesn't just spit out the answer instantly
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function executeAndAnimate(gameState, moveStr) {
    const isRedTurn = gameState.currentPlayer === 'RED';
    
    // 1. Snapshot: Who is currently hidden?
    const enemyFleetsBefore = isRedTurn ? gameState.blueFleets : gameState.redFleets;
    const hiddenIdsBefore = enemyFleetsBefore.filter(f => f.isHidden).map(f => f.id);

    // 2. Execute the move instantly in the background logic
    const nextState = gameState.makeMove(moveStr);

    // 3. Play the dice roll animation ONLY if it was a radar scan
    if (moveStr.startsWith('ISR_')) {
        const parts = moveStr.split('_');
        // This will dynamically grab the 3 hexes from BOTH ISR_DIR and ISR_FOCUS commands
        const targetHexes = parts.slice(2);
        
        console.log(`\n📡 Initiating Sensor Sweep...`);
        
        for (const hex of targetHexes) {
            process.stdout.write(`  🎲 Scanning ${hex}`);
            await sleep(400); process.stdout.write('.');
            await sleep(400); process.stdout.write('.');
            await sleep(400); 
            
            // Fake a 6-sided dice roll for visual drama
            const roll = Math.floor(Math.random() * 6) + 1; 
            console.log(` [Rolled: ${roll}]`);
        }

        // 4. Snapshot Check: Did anyone lose their cloak?
        const enemyFleetsAfter = isRedTurn ? nextState.blueFleets : nextState.redFleets;
        const newlyRevealed = enemyFleetsAfter.filter(f => hiddenIdsBefore.includes(f.id) && !f.isHidden);

        console.log(""); 
        if (newlyRevealed.length > 0) {
            console.log("🚨 TARGET(S) ACQUIRED!");
            newlyRevealed.forEach(f => {
                console.log(`   >> Hostile fleet ${f.id} spotted at ${f.pos}!`);
            });
        } else {
            console.log("💨 Sensors clear. No signatures detected.");
        }
        console.log("----------------------------------------\n");
        await sleep(1500); // Give the player 1.5 seconds to read the results before the board prints again
    }

    return nextState;
}

// --- 1. INITIALIZATION ---
let game = new F3Game();

// Give Player (RED) 2 Ships
game.redFleets = [
    { id: 'R1', pos: 'A1', hp: 2, fuel: 5, isHidden: true },
    { id: 'R2', pos: 'B1', hp: 2, fuel: 5, isHidden: true },
];

// Give AI (BLUE) 2 Ships
game.blueFleets = [
    { id: 'B1', pos: 'G6', hp: 2, fuel: 5, isHidden: true },
    { id: 'B2', pos: 'F6', hp: 2, fuel: 5, isHidden: true },
];

const aiBot = new MCTS(1000); // 1000 iterations for the AI

// --- 2. DISPLAY HELPER ---
function printDashboard(gameState) {
    console.log("\n========================================");
    console.log(` TURN: ${gameState.turn} | PHASE: ${gameState.phase} | ACTIVE: ${gameState.currentPlayer}`);
    console.log("========================================");
    
    console.log("\n🔴 YOUR FLEETS (RED):");
    gameState.redFleets.forEach(f => {
        const status = f.hp > 0 ? `HP:${f.hp} Fuel:${f.fuel}` : 'DESTROYED';
        console.log(`  > ${f.id} @ ${f.pos} [${status}]`);
    });

    console.log("\n🔵 ENEMY FLEETS (BLUE) - True Positions:");
    // In a real game, you wouldn't print this, but for testing we need to see what the AI is doing!
    gameState.blueFleets.forEach(f => {
        const status = f.hp > 0 ? `HP:${f.hp} Fuel:${f.fuel}` : 'DESTROYED';
        console.log(`  > ${f.id} @ ${f.pos} [${status}] ${f.isHidden ? '(Hidden)' : '(Spotted!)'}`);
    });
    console.log("----------------------------------------\n");
}

// --- 3. MAIN GAME LOOP ---
async function run() {
    console.log("Starting Find, Fix, Finish - Terminal Diagnostics...\n");

    while (!game.isGameOver()) {
        printDashboard(game);

        if (game.currentPlayer === 'RED') {
            // --- PLAYER TURN ---
            const moves = game.getLegalMoves();
            
            console.log("Available Moves (Showing first 10):");
            console.log(moves.slice(0, 10).join(', ') + (moves.length > 10 ? '...' : ''));
            
            let valid = false;
            while (!valid) {
                const rawInput = await askQuestion("Enter your move (e.g., ISR_FOCUS_A1_D4_G6): ");
                let inputStr = rawInput.trim().toUpperCase(); // Forgive lowercase typing
                
                // Custom Validator: Did the human try to pick 3 custom focus hexes?
                let isValidFocus = false;
                if (inputStr.startsWith("ISR_FOCUS_")) {
                    const parts = inputStr.split('_');
                    if (parts.length === 5) { // Needs to be exactly: ISR, FOCUS, H1, H2, H3
                        const hexRegex = /^[A-G][1-6]$/; // Checks if it's a valid board coordinate
                        
                        if (hexRegex.test(parts[2]) && hexRegex.test(parts[3]) && hexRegex.test(parts[4])) {
                            isValidFocus = true;
                            // Alphabetize the user's input so the game engine understands it safely
                            const sortedHexes = [parts[2], parts[3], parts[4]].sort();
                            inputStr = `ISR_FOCUS_${sortedHexes[0]}_${sortedHexes[1]}_${sortedHexes[2]}`;
                        }
                    }
                }

                // Accept the move if it's in the legal list, OR if it's a valid custom Focus command
                if (moves.includes(inputStr) || isValidFocus) {
                    game = await executeAndAnimate(game, inputStr);
                    valid = true;
                } else {
                    console.log("❌ Invalid move or coordinates. Try again.");
                }
            }
        } else {
            // --- AI TURN ---
            console.log("🤖 AI is thinking...");
            
            // Start a stopwatch
            const startTime = performance.now();
            
            // Run the algorithm (This will now print the X-Ray logs)
            const bestMove = aiBot.search(game);
            
            // Stop the stopwatch
            const endTime = performance.now();
            const timeTaken = (endTime - startTime).toFixed(2);
            
            if (bestMove) {
                console.log(`\n>> AI executes: ${bestMove} (Calculated in ${timeTaken} ms) <<\n`);
                // NEW: Replaced standard makeMove with animation wrapper
                game = await executeAndAnimate(game, bestMove);
            } else {
                console.log(`\n>> AI has no valid moves. Passing turn. (Calculated in ${timeTaken} ms) <<\n`);
                game.turnEnd();
            }
        }
    }

    console.log("\n========================================");
    console.log(`GAME OVER! WINNER: ${game.getWinner()}`);
    console.log("========================================");
    rl.close();
}

// Start the loop
run();