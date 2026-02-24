class BotAI {
    static getBestStrikeAction(lobby, botId) {
        const mcts = new MCTS(lobby, botId);
        return mcts.run();
    }
}

class Node {
    constructor(move, parent, availableMoves) {
        this.move = move;
        this.parent = parent;
        this.children = [];
        this.wins = 0;
        this.visits = 0;
        // Shallow copy of available moves to track what hasn't been tried from this state
        this.untriedMoves = [...availableMoves];
    }

    isFullyExpanded() {
        return this.untriedMoves.length === 0;
    }

    getBestChild(explorationParam = 1.41) {
        return this.children.reduce((best, child) => {
            const uctValue = (child.wins / child.visits) + 
                             (explorationParam * Math.sqrt(Math.log(this.visits) / child.visits));
            return uctValue > best.uct ? { node: child, uct: uctValue } : best;
        }, { node: null, uct: -Infinity }).node;
    }
}

class MCTS {
    constructor(lobby, botId) {
        this.lobby = lobby;
        this.botId = botId;
        this.opponentId = Object.keys(lobby.players).find(id => id !== botId);
        this.botMemory = lobby.botMemory || { knownHits: [], firedShots: [] };
        this.allHexes = this.generateHexes();
        
        // Initial valid moves: All hexes minus those we've already shot at
        this.initialMoves = this.allHexes.filter(h => 
            !this.botMemory.firedShots.includes(`${h.q},${h.r}`)
        );
    }

    generateHexes() {
        let hexes = [];
        for (let q = -4; q <= 4; q++) {
            for (let r = -4; r <= 4; r++) {
                if (Math.abs(q + r) <= 4) {
                    hexes.push({q, r});
                }
            }
        }
        return hexes;
    }

    run() {
        const root = new Node(null, null, this.initialMoves);
        const endTime = Date.now() + 200; // 200ms computation budget

        while (Date.now() < endTime) {
            // 1. Determinize: Guess opponent state based on memory
            const simulatedState = this.determinize();
            
            let node = root;
            let state = simulatedState;
            
            // 2. Select
            // Traverse tree until we find a node that isn't fully expanded
            while (node.isFullyExpanded() && node.children.length > 0) {
                node = node.getBestChild();
                this.applyMove(state, node.move);
            }

            // 3. Expand
            if (!node.isFullyExpanded() && node.untriedMoves.length > 0) {
                const moveIndex = Math.floor(Math.random() * node.untriedMoves.length);
                const move = node.untriedMoves.splice(moveIndex, 1)[0];
                
                this.applyMove(state, move);
                
                // Child inherits remaining moves from parent, minus the move just taken
                const childMoves = node.untriedMoves.filter(m => m.q !== move.q || m.r !== move.r);
                const child = new Node(move, node, childMoves);
                node.children.push(child);
                node = child;
            }

            // 4. Simulate (Rollout)
            const winner = this.simulate(state, node.untriedMoves);

            // 5. Backpropagate
            while (node) {
                node.visits++;
                if (winner === this.botId) {
                    node.wins++;
                }
                node = node.parent;
            }
        }

        // Return best move (most visited)
        if (root.children.length === 0) return this.initialMoves[Math.floor(Math.random() * this.initialMoves.length)];
        
        const bestChild = root.children.reduce((a, b) => a.visits > b.visits ? a : b);
        return bestChild.move;
    }

    determinize() {
        // Create a hypothetical opponent fleet configuration
        const opponentFleets = {
            alpha: { hp: 2, isDestroyed: false, q: null, r: null },
            beta: { hp: 2, isDestroyed: false, q: null, r: null }
        };

        // If we have known hits, we MUST place ships there
        const knownHits = [...this.botMemory.knownHits];
        const availableHexes = this.allHexes.filter(h => 
            !this.botMemory.firedShots.includes(`${h.q},${h.r}`) || 
            knownHits.some(kh => kh.q === h.q && kh.r === h.r) // Allow known hits
        );

        // Helper to check overlap
        const isOccupied = (q, r) => (opponentFleets.alpha.q === q && opponentFleets.alpha.r === r) || 
                                     (opponentFleets.beta.q === q && opponentFleets.beta.r === r);

        // Place Alpha
        if (knownHits.length > 0) {
            const hit = knownHits.pop();
            opponentFleets.alpha.q = hit.q;
            opponentFleets.alpha.r = hit.r;
            opponentFleets.alpha.hp = 1; // Assume damaged
        } else {
            const rnd = availableHexes[Math.floor(Math.random() * availableHexes.length)];
            opponentFleets.alpha.q = rnd.q;
            opponentFleets.alpha.r = rnd.r;
        }

        // Place Beta
        if (knownHits.length > 0) {
            const hit = knownHits.pop();
            opponentFleets.beta.q = hit.q;
            opponentFleets.beta.r = hit.r;
            opponentFleets.beta.hp = 1;
        } else {
            let rnd;
            let attempts = 0;
            do {
                rnd = availableHexes[Math.floor(Math.random() * availableHexes.length)];
                attempts++;
            } while (isOccupied(rnd.q, rnd.r) && attempts < 50);
            opponentFleets.beta.q = rnd.q;
            opponentFleets.beta.r = rnd.r;
        }

        return {
            fleets: opponentFleets,
            myFleets: this.lobby.fleets[this.botId] // We know our own fleets
        };
    }

    applyMove(state, move) {
        // Check hit on hypothetical opponent
        const fleets = state.fleets;
        if ((fleets.alpha.q === move.q && fleets.alpha.r === move.r && !fleets.alpha.isDestroyed)) {
            fleets.alpha.hp--;
            if (fleets.alpha.hp <= 0) fleets.alpha.isDestroyed = true;
        } else if ((fleets.beta.q === move.q && fleets.beta.r === move.r && !fleets.beta.isDestroyed)) {
            fleets.beta.hp--;
            if (fleets.beta.hp <= 0) fleets.beta.isDestroyed = true;
        }
    }

    simulate(state, availableMoves) {
        // Random rollout
        const moves = [...availableMoves]; // Copy
        while (moves.length > 0) {
            // Check win condition
            if (state.fleets.alpha.isDestroyed && state.fleets.beta.isDestroyed) return this.botId;
            
            const idx = Math.floor(Math.random() * moves.length);
            const move = moves.splice(idx, 1)[0];
            this.applyMove(state, move);
        }
        return null; // Draw or ran out of moves
    }
}

module.exports = BotAI;