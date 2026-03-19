// src/lib/game/gameStore.js
import { writable, get } from 'svelte/store';
import { F3Game } from './F3Game.js';
import MCTS from './MCTS.js'; // 1. Import the AI

export const gameStore = writable(new F3Game());

// 2. Initialize the AI (Drop iterations to 500 so it doesn't freeze the browser!)
const aiBot = new MCTS(500); 

export const gameActions = {
    init: () => {
        const newGame = new F3Game();
        
        newGame.redFleets = [
            { id: 'R1', pos: 'A1', hp: 2, fuel: 5, isHidden: true },
            { id: 'R2', pos: 'B1', hp: 2, fuel: 5, isHidden: true }
        ];
        newGame.blueFleets = [
            { id: 'B1', pos: 'G6', hp: 2, fuel: 5, isHidden: true },
            { id: 'B2', pos: 'F6', hp: 2, fuel: 5, isHidden: true }
        ];
        
        gameStore.set(newGame);
    },

    executeMove: (moveCmd) => {
        // 1. Apply the human's move
        gameStore.update(game => {
            return game.makeMove(moveCmd);
        });

        // 2. Check if it is now the AI's turn
        const currentGame = get(gameStore);
        if (currentGame.currentPlayer === 'BLUE' && !currentGame.isGameOver()) {
            
            // 3. CRITICAL: Use setTimeout so the browser can visually draw the human's move 
            // BEFORE the AI completely hogs the CPU to think.
            setTimeout(() => {
                console.log("🤖 AI is thinking...");
                
                // Read the current state directly from the store
                const latestGame = get(gameStore);
                const bestMove = aiBot.search(latestGame);
                
                if (bestMove) {
                    console.log(`>> AI executes: ${bestMove}`);
                    // Recursively call executeMove to apply the AI's choice!
                    gameActions.executeMove(bestMove);
                } else {
                    console.log(">> AI passes turn.");
                    gameStore.update(g => {
                        g.turnEnd();
                        return g;
                    });
                }
            }, 100); // 100ms delay
        }
    }
};