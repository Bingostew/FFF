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
        // 1. DETERMINIZE
        // We do not start with the real state because it contains hidden info.
        // We create a "Guessed State" where hidden enemies are placed randomly
        // but validly (according to our Intel).
        const determinizedState = realGameState.determinize();

        // 2. ROOT CREATION
        let root = new Node(determinizedState);

        // 3. MAIN LOOP
        for (let i = 0; i < this.iterations; i++) {
            // A. SELECT: Drill down to a node that needs expanding
            let node = this.select(root);
            
            // B. EXPAND: Add one new child node from that position
            node = this.expand(node);
            
            // C. SIMULATE: Play random moves until the game ends
            let winner = this.simulate(node);
            
            // D. BACKPROPAGATE: Update scores up the tree
            this.backpropagate(node, winner);
        }

        // 4. RESULT
        // If we found no moves (game over), return null
        if (root.children.length === 0) return null;

        // Return the move from the child with the MOST VISITS.
        // (Robust Child criteria is better than highest win-rate for MCTS)
        const bestChild = root.children.reduce((a, b) => (a.visits > b.visits ? a : b));
        return bestChild.move;
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