// MCTS.js
// @ts-nocheck
/**
 * Monte Carlo Tree Search Engine
 * * USAGE:
 * import MCTS from './MCTS.js';
 * const mcts = new MCTS(1000); // 1000 iterations
 * const bestMove = mcts.search(myGameState);
 */
export default class MCTS {
    constructor(iterations = 1000) {
        this.iterations = iterations;
        this.explorationConstant = 1.41; // Sqrt(2) is standard
    }

    search(realGameState) {
        // Store the combined results of all simulated games here
        const aggregatedMoves = {};

        // Instead of 1 universes with 1000 iterations, we do 20 universes with 50 iterations each.
        // This forces the AI to pick new random spots for the player 20 different times.
        const numUniverses = 20;
        const iterationsPerUniverse = Math.floor(this.iterations / numUniverses);

        // 2. MAIN LOOP: Cycle through the parallel universes
        for (let u = 0; u < numUniverses; u++) {
            
            // A. DETERMINIZE: Pick random spots for the hidden enemies for THIS universe
            const determinizedState = realGameState.determinize();
            let root = new Node(determinizedState);

            // B. MCTS LOOP: Run the simulations for this specific layout
            for (let i = 0; i < iterationsPerUniverse; i++) {
                let node = this.select(root);
                node = this.expand(node);
                let winner = this.simulate(node);
                this.backpropagate(node, winner);
            }

            // C. AGGREGATE: Collect the results from this universe
            for (const child of root.children) {
                if (!aggregatedMoves[child.move]) {
                    aggregatedMoves[child.move] = { move: child.move, visits: 0, score: 0 };
                }
                aggregatedMoves[child.move].visits += child.visits;
                aggregatedMoves[child.move].score += child.score;
            }
        }

        // 3. RESULT EVALUATION
        const sortedMoves = Object.values(aggregatedMoves).sort((a, b) => b.visits - a.visits);

        if (sortedMoves.length === 0) return null;

        // --- X-RAY DEBUG OUTPUT ---
        console.log("\n--- AI INTERNAL THOUGHT PROCESS (MULTI-UNIVERSE) ---");
        console.log(`Universes Simulated: ${numUniverses}`);
        console.log(`Total Simulations Run: ${numUniverses * iterationsPerUniverse}`);
        console.log("Top 5 Evaluated Moves Across All Universes:");
        
        sortedMoves.slice(0, 5).forEach((moveData, index) => {
            // Calculate win probability for this specific move
            const winRate = ((moveData.score / moveData.visits) * 100).toFixed(1);
            
            // Format the text so it lines up nicely in the terminal
            const moveStr = moveData.move.padEnd(18);
            const visitsStr = moveData.visits.toString().padStart(4);
            const scoreStr = moveData.score.toFixed(1).padStart(6);
            
            console.log(`  ${index + 1}. ${moveStr} | Visits: ${visitsStr} | Score: ${scoreStr} | Win Rate: ${winRate}%`);
        });
        console.log("-------------------------------------------------------\n");

        // The move with the most visits across ALL universes is statistically the safest bet
        return sortedMoves[0].move;
    }

    // --- PHASE 1: SELECTION ---
    select(node) {
        // Keep going down until we hit a terminal state (Game Over)
        while (!node.isTerminal()) {
            // If this node still has moves we haven't tried yet, 
            // stop here and let 'expand()' handle it.
            if (!node.isFullyExpanded()) {
                return node;
            }

            // If it IS fully expanded, use UCT math to pick the best existing child
            // and keep drilling down.
            node = node.bestChild(this.explorationConstant);
            
            // Safety check (should rarely happen unless no moves available)
            if (!node) break;
        }
        return node;
    }

    // --- PHASE 2: EXPANSION ---
    expand(node) {
        // If the game is already over at this node, we can't expand further.
        if (node.isTerminal()) return node;

        // 1. Get the list of moves we haven't tried yet from this state
        const moves = node.untriedMoves;
        
        // 2. Pick one at random
        const index = Math.floor(Math.random() * moves.length);
        const move = moves[index];
        
        // 3. Remove it from the list so we don't try it again later
        moves.splice(index, 1);

        // 4. Create the new state and the new Node
        const newState = node.state.makeMove(move);
        const newChild = new Node(newState, node, move);

        // 5. Link it to the tree
        node.children.push(newChild);

        return newChild;
    }

    // --- PHASE 3: SIMULATION (ROLLOUT) ---
    simulate(node) {
        let currentState = node.state.clone();
        let depth = 0;

        // Play randomly until Game Over or Depth Limit (prevent infinite loops)
        while (!currentState.isGameOver() && depth < 50) {
            const moves = currentState.getLegalMoves();
            if (moves.length === 0) break;
            
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            currentState = currentState.makeMove(randomMove);
            depth++;
        }

        return currentState.getWinner();
    }

    // --- PHASE 4: BACKPROPAGATION ---
    backpropagate(node, winner) {
        while (node) {
            node.visits++;

            // Scoring Logic:
            // If the winner is 'RED', and this node represents a state where
            // it is 'BLUE's turn, that means the Move that got us here (Red's move)
            // was a GOOD move.
            
            // Simple check: If the player whose turn it is at this node 
            // is NOT the winner, then the previous move was a winning move.
            if (node.state.currentPlayer !== winner && winner !== 'DRAW') {
                node.score += 1;
            } 
            else if (winner === 'DRAW') {
                node.score += 0.5;
            }

            // Climb up the tree
            node = node.parent;
        }
    }
}

/**
 * Helper Class: MCTS Node
 * Represents a single circle in the game tree.
 */
class Node {
    constructor(state, parent = null, move = null) {
        this.state = state;
        this.parent = parent;
        this.move = move; // The move that led to this state
        
        this.children = [];
        this.visits = 0;
        this.score = 0;

        // OPTIMIZATION: Calculate legal moves once upon creation.
        // We use this array to track which moves we have NOT tried yet.
        this.untriedMoves = state.getLegalMoves();
    }

    // A node is fully expanded if we have tried every possible move from here
    isFullyExpanded() {
        return this.untriedMoves.length === 0;
    }

    isTerminal() {
        return this.state.isGameOver();
    }

    // UCT FORMULA (Upper Confidence Bound 1 applied to Trees)
    // Balances Exploitation (Win Rate) vs Exploration (Visits)
    bestChild(c_param = 1.41) {
        let bestScore = -Infinity;
        let bestNodes = [];
        
        // Log of the PARENT's visits (this node)
        const logN = Math.log(this.visits);

        for (const child of this.children) {
            // Protect against division by zero (though visits should be >= 1)
            if (child.visits === 0) continue;

            const exploitation = child.score / child.visits;
            const exploration = c_param * Math.sqrt(logN / child.visits);
            const uctValue = exploitation + exploration;

            if (uctValue > bestScore) {
                bestScore = uctValue;
                bestNodes = [child];
            } else if (uctValue === bestScore) {
                bestNodes.push(child);
            }
        }

        // Return a random child if there's a tie, otherwise the best one
        if (bestNodes.length === 0) return null; // Should not happen if children exist
        return bestNodes[Math.floor(Math.random() * bestNodes.length)];
    }
}