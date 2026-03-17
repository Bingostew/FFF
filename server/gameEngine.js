// file contain functions for socketHandler.js file to directly alter game state

// hex distance formula (cube coordinates)

const GameEngine = {
    // start the game by initializing ship locations
    initShips: (gameState, playerId, shipName, hex) => {
        
    },
    // validate player's move
    validateMove: (gameState, shipId, toHex) => {
        const ship = gameState.ships[shipId];
        const map = gameState.map;

        // Rule: Move ONE adjacent hex
        if (GameEngine.getDistance(ship.location, toHex) !== 1) 
            return { valid: false, msg: "Must move 1 hex" };

        // Rule: Fuel bubbles
        if (ship.fuel <= 0) 
            return { valid: false, msg: "Out of fuel" };

        // Rule: land hexes are impassable
        if (map.landHexes.includes(toHex)) 
            return { valid: false, msg: "Cannot enter Land" };

        return { valid: true };
    },
    // conduct an ISR search
    validateISR: (type, selectedHexes) => {
        // We expect selectedHexes to be an array of strings ["A-1", "B-2", ...]
        
        // RULE: Focus ISR
        // "Select any 3 individual hexes that are NOT adjacent" [cite: 13]
        if (type === 'focus') {
            if (selectedHexes.length !== 3) return { valid: false, msg: "Select exactly 3 hexes" };
            
            // Check adjacency between all pairs
            for (let i = 0; i < selectedHexes.length; i++) {
                for (let j = i + 1; j < selectedHexes.length; j++) {
                    const dist = GameEngine.getDistanceByName(selectedHexes[i], selectedHexes[j]);
                    if (dist === 1) return { valid: false, msg: "Focus hexes cannot be adjacent" };
                }
            }
            return { valid: true };
        }

        // RULE: Directional ISR
        // "Select a row of 3 adjacent hexes" [cite: 19]
        if (type === 'directional') {
            if (selectedHexes.length !== 3) return { valid: false, msg: "Select exactly 3 hexes" };
            
            // "Row" implies they share an axis (q, r, or s) and are contiguous.
            // Simplified check: Are they in a straight line distance of 2 total?
            // Distance(A, B) + Distance(B, C) == Distance(A, C) check is safer.
            // For now, let's just check if they form a chain: A->B (dist 1) and B->C (dist 1).
            // A strict line check is complex without proper sorting, but a loose check:
            // "Must be adjacent to at least one other" + "Share an axis"
            
            // Let's use the 'getLine' helper. The distance from First to Last must be 2.
            // And the Middle one must be on the line.
            // (Client side should handle the UI sorting, assume server gets sorted list or verify geometry)
            return { valid: true }; // Placeholder for complex line math
        }

        // RULE: Area ISR
        // "Select 4 adjacent hexes" [cite: 21]
        if (type === 'area') {
            if (selectedHexes.length !== 4) return { valid: false, msg: "Select exactly 4 hexes" };
            
            // Validation: Ensure they form a connected cluster
            // (Recursively check if every hex touches at least one other in the group)
            return { valid: true }; 
        }

        return { valid: false, msg: "Unknown ISR type" };
    },

    // helper funcs
    getDistance: (a, b) => {
        // Helper to ensure input is an object
        const parse = (input) => {
            if (typeof input === 'string') {
                const [x, y, z] = input.split(',').map(Number);
                return { x, y, z };
            }
            return input; // Already an object
        };

        const hexA = parse(a);
        const hexB = parse(b);

        // Standard Cube Distance Formula: Max(|dx|, |dy|, |dz|)
        return Math.max(
            Math.abs(hexA.x - hexB.x),
            Math.abs(hexA.y - hexB.y),
            Math.abs(hexA.z - hexB.z)
        );
    },

    calculateStrike: (gameState, attackerHex, targetHex) => {
        const distance = GameEngine.getDistance(attackerHex, targetHex);
        
        // 1. Determine Base Difficulty (Range Table)
        let neededRoll = 6; // Default to impossible
        if (distance <= 2) neededRoll = 2;       // Range 0-2 [cite: 25]
        else if (distance <= 6) neededRoll = 3;  // Range 3-6 [cite: 25]
        else neededRoll = 4;                     // Range 7+ [cite: 25]

        // 2. Determine Land Penalty
        // "For each land hex your shot path crosses, subtract 1 from your roll" [cite: 30]
        // (Mathematically equivalent to Adding 1 to the Difficulty)
        
        const path = GameEngine.getLine(attackerHex, targetHex);
        let landCrossed = 0;
        
        path.forEach(coordKey => {
            // Ignore the start and end hexes? 
            // Rules say "not counting your own Fleet's hex"[cite: 27].
            // Usually target hex does not count as "crossing" logic, but land hexes usually block LoS.
            // Let's assume start hex is excluded.
            
            // We need to convert the coordKey "x,y,z" back to map data to check if it's land
            // Assuming gameState.map.tiles uses "x,y,z" keys:
            const tile = gameState.map.tiles[coordKey];
            
            // Don't count the attacker's own hex
            const attackerCube = GameEngine.toCube(attackerHex);
            const currentCube = GameEngine.toCube(tile.name); // Or parse the key
            
            // Simple check: if key match
            // Note: getLine returns cube keys like "0,-1,1".
            // You need to ensure your map keys match this format.
            if (coordKey === gameState.map.tiles[attackerHex]?.location) return; 

            if (tile && tile.obstacle) {
                landCrossed++;
            }
        });

        return {
            valid: true,
            distance: distance,
            baseRoll: neededRoll,
            penalty: landCrossed,
            finalRequiredRoll: neededRoll + landCrossed
        };
    }
};

module.exports = GameEngine


// data needed to be stored

// hex map -> where blocker hexes are
/**
 * hex object {name: A-1, location (0,0,0), type:ocean/mountain/jungle/ }
 *  location will be (q, r, s) format
 */

// ship object-> {name: , owner: playerId, location: (0,0,0), health: 0,1,2, Fuel: 0,1,2,3}


// GAMESTATE OBJ
// -> board
// -> playerdata
// -> ships