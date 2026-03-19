// src/lib/game/test-auto.js
import { F3Game } from './F3Game.js';
import MCTS from './MCTS.js';

// --- YOUR PLAYBOOK ---
// The script will execute these moves in order for the RED player.
const scriptedMoves = [
    "ISR_AREA_CENTER",        // Turn 1: Scan the middle
    "MOVE_R2_C1",             // Turn 2: Move ship R2 East
    "ISR_DIR_E4_F5_G6",       // Turn 3: Diagonal scan aimed at Blue's starting corner
    "MOVE_R1_B1",             // Turn 4: Move ship R1 East
    "ISR_FOCUS_F4_F5_F6"      // Turn 5: Focus scan a specific cluster
];

// --- ANIMATION HELPER ---
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * @param {F3Game} gameState 
 * @param {string} moveStr 
 */
async function executeAndAnimate(gameState, moveStr) {
    const isRedTurn = gameState.currentPlayer === 'RED';
    const enemyFleetsBefore = isRedTurn ? gameState.blueFleets : gameState.redFleets;
    const hiddenIdsBefore = enemyFleetsBefore.filter(f => f.isHidden).map(f => f.id);

    const nextState = gameState.makeMove(moveStr);

    if (moveStr.startsWith('ISR_')) {
        const parts = moveStr.split('_');
        const targetHexes = parts.slice(2); 
        const isFocus = moveStr.startsWith('ISR_FOCUS');
        
        console.log(`\n📡 Initiating Sensor Sweep...`);
        
        for (const hex of targetHexes) {
            if (hex === 'CENTER') {
                console.log(`  🎯 Scanning Area: CENTER [Locked]`);
                await sleep(800);
                continue;
            }
            if (hex === 'RANDOM') {
                console.log(`  🎲 Scanning Random Sectors...`);
                await sleep(800);
                continue;
            }

            process.stdout.write(`  ${isFocus ? '🎯' : '🎲'} Scanning ${hex}`);
            await sleep(400); process.stdout.write('.');
            await sleep(400); process.stdout.write('.');
            await sleep(400); 
            
            if (isFocus) {
                console.log(` [Locked]`); 
            } else {
                const roll = Math.floor(Math.random() * 6) + 1; 
                console.log(` [Rolled: ${roll}]`);
            }
        }

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
        await sleep(1500); 
    }

    return nextState;
}

// --- INITIALIZATION ---
let game = new F3Game();

game.redFleets = [
    { id: 'R1', pos: 'A1', hp: 2, fuel: 5, isHidden: true },
    { id: 'R2', pos: 'B1', hp: 2, fuel: 5, isHidden: true },
];

game.blueFleets = [
    { id: 'B1', pos: 'G6', hp: 2, fuel: 5, isHidden: true },
    { id: 'B2', pos: 'F6', hp: 2, fuel: 5, isHidden: true },
];

const aiBot = new MCTS(1000);

// --- DISPLAY HELPER ---
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
    gameState.blueFleets.forEach(f => {
        const status = f.hp > 0 ? `HP:${f.hp} Fuel:${f.fuel}` : 'DESTROYED';
        console.log(`  > ${f.id} @ ${f.pos} [${status}] ${f.isHidden ? '(Hidden)' : '(Spotted!)'}`);
    });
    console.log("----------------------------------------\n");
}

// --- MAIN GAME LOOP ---
async function run() {
    console.log("Starting AUTOPILOT Terminal Diagnostics...\n");

    while (!game.isGameOver()) {
        printDashboard(game);

        if (game.currentPlayer === 'RED') {
            // Check if we have scripted moves left
            if (scriptedMoves.length === 0) {
                console.log("🛑 Playbook empty! The scripted sequence has finished.");
                break; 
            }

            // Grab the next move from the array
            const nextMove = scriptedMoves.shift();
            console.log(`\n>> AUTO-PLAYER executes: ${nextMove} <<\n`);
            
            // Wait 1.5 seconds so you have time to read what the auto-player is doing
            await sleep(1500); 

            // Execute the move
            game = await executeAndAnimate(game, nextMove);

        } else {
            console.log("🤖 AI is thinking...");
            const startTime = performance.now();
            const bestMove = aiBot.search(game);
            const endTime = performance.now();
            const timeTaken = (endTime - startTime).toFixed(2);
            
            if (bestMove) {
                console.log(`\n>> AI executes: ${bestMove} (Calculated in ${timeTaken} ms) <<\n`);
                game = await executeAndAnimate(game, bestMove);
            } else {
                console.log(`\n>> AI has no valid moves. Passing turn. (Calculated in ${timeTaken} ms) <<\n`);
                game.turnEnd();
            }
        }
    }

    console.log("\n========================================");
    if (game.isGameOver()) {
        console.log(`GAME OVER! WINNER: ${game.getWinner()}`);
    } else {
        console.log(`SIMULATION PAUSED (Ran out of scripted moves).`);
    }
    console.log("========================================");
    process.exit(0);
}

run();