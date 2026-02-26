// @ts-nocheck
import { writable, get } from 'svelte/store';
import { F3Game } from './F3Game.js';
import MCTS from './MCTS.js';

// 1. The Reactive Store
// We initialize with a fresh game
export const gameStore = writable(new F3Game());

// 2. The AI Instance
// We keep this outside the store since it doesn't change, it just "thinks"
const ai = new MCTS(1000); // 1000 iterations for speed

// 3. Game Actions
export const gameActions = {
    
    // Reset Game
    init: () => {
        const newGame = new F3Game();
        // Setup default ships (Copying your main.js setup)
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

    // Human Move
    executeMove: (moveStr) => {
        gameStore.update(currentGame => {
            const nextState = currentGame.makeMove(moveStr);
            
            // Check if turn switched to AI
            if (nextState.currentPlayer === 'BLUE' && !nextState.isGameOver()) {
                // Use setTimeout to let the UI render the player's move 
                // BEFORE the AI freezes the browser to think
                setTimeout(() => gameActions.triggerAI(), 100);
            }
            return nextState;
        });
    },

    // AI Move
    triggerAI: () => {
        const currentGame = get(gameStore);
        console.log("AI Thinking...");
        
        // Run MCTS
        const bestMove = ai.search(currentGame);
        
        if (bestMove) {
            console.log("AI Move:", bestMove);
            gameStore.update(g => g.makeMove(bestMove));
        } else {
            console.log("AI Passes");
            gameStore.update(g => {
                const next = g.clone();
                next.turnEnd();
                return next;
            });
        }
    }
};