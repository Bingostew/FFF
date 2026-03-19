class BotAI {
    static getBestAction(lobby, botId) {
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
        this.initialMoves = this.generateAllPossibleMoves();
    }

    generateHexes() {
        let hexes = [];
        for (let q = 0; q <= 6; q++) {
            for (let r = -3; r <= 5; r++) {
                hexes.push({q, r});
            }
        }
        return hexes;
    }

    generateAllPossibleMoves() {
        const moves = [];
        const attackerFleets = this.lobby.fleets[this.botId];
        const playerAssets = this.lobby.assets[this.botId];

        // 1. Generate Strike moves
        const strikeMoves = this.allHexes
            .filter(h => !this.botMemory.firedShots.includes(`${h.q},${h.r}`))
            .map(hex => ({ type: 'strike', hex }));
        moves.push(...strikeMoves);

        // 2. Generate Move moves
        if (playerAssets && playerAssets.fuel > 0) {
            for (const fleetKey of ['alpha', 'beta']) {
                const fleet = attackerFleets[fleetKey];
                if (fleet && fleet.hp > 0) {
                    const directions = [[1,0], [1,-1], [0,-1], [-1,0], [-1,1], [0,1]];
                    directions.forEach(dir => {
                        const newPosition = { q: fleet.q + dir[0], r: fleet.r + dir[1] };
                        // Boundary check
                        if (newPosition.q >= 0 && newPosition.q <= 6 && newPosition.r >= -3 && newPosition.r <= 5) {
                            const otherFleetKey = fleetKey === 'alpha' ? 'beta' : 'alpha';
                            const otherFleet = attackerFleets[otherFleetKey];
                            if (!otherFleet || otherFleet.hp <= 0 || !(otherFleet.q === newPosition.q && otherFleet.r === newPosition.r)) {
                                moves.push({ type: 'move', fleetKey, newPosition });
                            }
                        }
                    });
                }
            }
        }

        // 3. Generate a sample of Search moves to keep the action space manageable
        for (let i = 0; i < 5; i++) { // Sample 5 of each search type
            // Focus
            const focusPositions = [];
            for(let j=0; j<3; j++) focusPositions.push({ q: Math.floor(Math.random() * 7), r: Math.floor(Math.random() * 9) - 3 });
            moves.push({ type: 'search', searchType: 'focus', positions: focusPositions });

            // Directional
            const q = Math.floor(Math.random() * 7);
            const r = Math.floor(Math.random() * 9) - 3;
            const directions = [[1,0], [1,-1], [0,-1], [-1,0], [-1,1], [0,1]];
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const directionalPositions = [];
            for(let j=0; j<3; j++) directionalPositions.push({ q: q + (dir[0]*j), r: r + (dir[1]*j) });
            moves.push({ type: 'search', searchType: 'directional', positions: directionalPositions });

            // Area
            const area_q = Math.floor(Math.random() * 7);
            const area_r = Math.floor(Math.random() * 9) - 3;
            const area_directions = [[1,0], [1,-1], [0,-1], [-1,0], [-1,1], [0,1]];
            const shuffled_directions = area_directions.sort(() => 0.5 - Math.random());
            const areaPositions = [{q: area_q, r: area_r}];
            for(let j=0; j<3; j++) {
                areaPositions.push({ q: area_q + shuffled_directions[j][0], r: area_r + shuffled_directions[j][1] });
            }
            moves.push({ type: 'search', searchType: 'area', positions: areaPositions });
        }
        return moves;
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
        if (root.children.length === 0) {
            const randomMove = this.initialMoves[Math.floor(Math.random() * this.initialMoves.length)];
            return {
                bestAction: randomMove,
                debugInfo: [{ action: randomMove, visits: 1, wins: 0, winRate: '0.0%' }]
            };
        }
        
        const sortedChildren = [...root.children].sort((a, b) => b.visits - a.visits);
        const bestChild = sortedChildren[0];

        const debugInfo = sortedChildren.slice(0, 5).map(child => {
            let moveDescription;
            const action = child.move;
            if (action.type === 'strike') {
                moveDescription = `Strike at {q:${action.hex.q}, r:${action.hex.r}}`;
            } else if (action.type === 'move') {
                moveDescription = `Move ${action.fleetKey} to {q:${action.newPosition.q}, r:${action.newPosition.r}}`;
            } else if (action.type === 'search') {
                moveDescription = `Search (${action.searchType}) at ${JSON.stringify(action.positions[0])}`;
            }

            return {
                action: moveDescription,
                visits: child.visits,
                wins: child.wins,
                winRate: child.visits > 0 ? `${((child.wins / child.visits) * 100).toFixed(1)}%` : '0.0%'
            };
        });

        return {
            bestAction: bestChild.move,
            debugInfo
        };
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
        if (move.type === 'strike') {
            const targetHex = move.hex;
            const fleets = state.fleets;
            if ((fleets.alpha.q === targetHex.q && fleets.alpha.r === targetHex.r && !fleets.alpha.isDestroyed)) {
                fleets.alpha.hp--;
                if (fleets.alpha.hp <= 0) fleets.alpha.isDestroyed = true;
            } else if ((fleets.beta.q === targetHex.q && fleets.beta.r === targetHex.r && !fleets.beta.isDestroyed)) {
                fleets.beta.hp--;
                if (fleets.beta.hp <= 0) fleets.beta.isDestroyed = true;
            }
        } else if (move.type === 'move') {
            state.myFleets[move.fleetKey].q = move.newPosition.q;
            state.myFleets[move.fleetKey].r = move.newPosition.r;
        }
    }

    simulate(state, availableMoves) {
        // Random rollout using only strike actions for simplicity
        const strikeMoves = availableMoves.filter(m => m.type === 'strike');
        const moves = [...strikeMoves];
        const simState = JSON.parse(JSON.stringify(state)); // Deep copy for simulation

        while (moves.length > 0) {
            // Check win condition
            if (simState.fleets.alpha.isDestroyed && simState.fleets.beta.isDestroyed) return this.botId;
            
            const idx = Math.floor(Math.random() * moves.length);
            const move = moves.splice(idx, 1)[0];
            this.applyMove(simState, move);
        }
        return null; // Draw or ran out of moves
    }
}

module.exports = BotAI;