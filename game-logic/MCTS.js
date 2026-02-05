// MCTS.js
import { GameState, Unit, Vector2 } from './GameClasses.js'; // Note the .js extension!

class Node {
    constructor(state, parent = null, move = null) {
        this.state = state;
        this.parent = parent;
        this.move = move;
        this.children = [];
        this.visits = 0;
        this.score = 0;
    }

    isFullyExpanded() {
        return this.children.length === this.state.getLegalMoves().length;
    }

    isTerminal() {
        return this.state.getWinner() !== null;
    }
}

export default class MCTS {
    constructor(iterations = 1000) {
        this.iterations = iterations;
        this.explorationConstant = 1.41;
    }

    search(initialState) {
        let root = new Node(initialState);

        for (let i = 0; i < this.iterations; i++) {
            let node = this.select(root);
            node = this.expand(node);
            let result = this.simulate(node);
            this.backpropagate(node, result);
        }

        if (root.children.length === 0) return null;

        const bestChild = root.children.reduce((a, b) => a.visits > b.visits ? a : b);
        return bestChild.move;
    }

    select(node) {
        while (!node.isTerminal() && node.isFullyExpanded()) {
            node = this.getBestChild(node);
        }
        return node;
    }

    getBestChild(node) {
        let bestValue = -Infinity;
        let bestNodes = [];

        for (let child of node.children) {
            const ucb1 = (child.score / child.visits) + 
                         (this.explorationConstant * Math.sqrt(Math.log(node.visits) / child.visits));

            if (ucb1 > bestValue) {
                bestValue = ucb1;
                bestNodes = [child];
            } else if (ucb1 === bestValue) {
                bestNodes.push(child);
            }
        }
        return bestNodes[Math.floor(Math.random() * bestNodes.length)];
    }

    expand(node) {
        if (node.isTerminal()) return node;

        const legalMoves = node.state.getLegalMoves();
        const triedMoves = node.children.map(c => c.move);
        const untriedMoves = legalMoves.filter(m => 
            !triedMoves.some(tm => tm.x === m.x && tm.y === m.y)
        );

        if (untriedMoves.length > 0) {
            const move = untriedMoves[Math.floor(Math.random() * untriedMoves.length)];
            const newState = node.state.clone();
            newState.applyMove(move);
            
            const childNode = new Node(newState, node, move);
            node.children.push(childNode);
            return childNode;
        }

        return node;
    }

    simulate(node) {
        let currentState = node.state.clone();
        let depth = 0;

        while (currentState.getWinner() === null && depth < 50) {
            const moves = currentState.getLegalMoves();
            if (moves.length === 0) break;
            const randomMove = moves[Math.floor(Math.random() * moves.length)];
            currentState.applyMove(randomMove);
            depth++;
        }

        return currentState.getWinner();
    }

    backpropagate(node, winner) {
        while (node !== null) {
            node.visits++;
            if (winner === 'AI') {
                node.score += 1;
            } 
            node = node.parent;
        }
    }
}