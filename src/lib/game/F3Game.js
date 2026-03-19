// @ts-nocheck
import { HexUtils } from './HexUtils.js';

export class F3Game {
    constructor() {
        this.turn = 1;
        this.currentPlayer = 'RED'; // Red moves first usually
        this.phase = 'SELECT_ACTION'; // SELECT_ACTION -> RESOLVE_ISR -> MOVEMENT -> END
        
        // --- 1. BOARD SETUP ---
        // Based on your image (Brown hexes)
        this.landHexes = ['B3', 'C2', 'D5', 'E4', 'F3']; 
        
        // --- 2. UNIT STATE ---
        // { id: 'R1', pos: 'A1', hp: 2, fuel: 3, isHidden: true }
        this.redFleets = []; 
        this.blueFleets = [];
        
        // --- 3. INTELLIGENCE STATE ---
        // What does RED know about BLUE? 
        // '?' = unknown, 'S' = ship found, 'E' = empty
        this.redIntel = new Array(7 * 6).fill('?'); 
        this.blueIntel = new Array(7 * 6).fill('?');
        
        this.winner = null;
    }

    // --- REQUIRED FOR MCTS: DETERMINIZATION ---
    determinize() {
        const copy = this.clone();
        
        // IF I am RED, I don't know where BLUE is exactly.
        // I only know my 'redIntel' board.
        // So I must randomize BLUE's positions to valid spots consistent with my Intel.
        
        const opponentFleets = (this.currentPlayer === 'RED') ? copy.blueFleets : copy.redFleets;
        const myIntel = (this.currentPlayer === 'RED') ? copy.redIntel : copy.blueIntel;

        // Reset opponent fleets to random valid spots
        opponentFleets.forEach(fleet => {
            if (fleet.isHidden) {
                let valid = false;
                while (!valid) {
                    // Pick random hex A1-G6
                    const rCol = Math.floor(Math.random() * 7);
                    const rRow = Math.floor(Math.random() * 6);
                    const posStr = `${String.fromCharCode(65+rCol)}${rRow+1}`;
                    
                    // Check: Is it land? Is it marked 'Empty' on my intel?
                    if (!this.landHexes.includes(posStr) && myIntel[this.posToIndex(posStr)] !== 'E') {
                        fleet.pos = posStr;
                        valid = true;
                    }
                }
            }
        });
        return copy;
    }

    getLegalMoves() {
        const moves = [];
        
        if (this.phase === 'SELECT_ACTION') {
            // 1. Generate Move commands
            const myFleets = (this.currentPlayer === 'RED') ? this.redFleets : this.blueFleets;
            
            myFleets.forEach(fleet => {
                if (fleet.fuel > 0 && fleet.hp > 0) {
                    
                    // FIX: 1. Convert string "A1" to numbers {col: 0, row: 0}
                    const hexCoord = HexUtils.parsePos(fleet.pos);
                    
                    if (hexCoord) {
                        // FIX: 2. Calculate neighbors using those numbers
                        const neighbors = HexUtils.getNeighbors(hexCoord.col, hexCoord.row);
                        
                        neighbors.forEach(n => {
                            // FIX: 3. Convert neighbor math back to a string like "A2"
                            const neighborStr = HexUtils.posToString(n);
                            
                            // 4. Ensure it's not a land hex before allowing movement
                            if (!this.landHexes.includes(neighborStr)) {
                                moves.push(`MOVE_${fleet.id}_${neighborStr}`);
                            }
                        });
                    }
                }
            });

            // 2. Generate ISR commands
            // --- NEW RULE: FOCUS picks 3 specific hexes ---
            // We generate a curated list of 15 random combinations for the AI to simulate,
            // preventing the engine from crashing under the weight of 11,480 total combinations.
            const validTargets = [];
            for (let c = 0; c < 7; c++) {
                for (let r = 0; r < 6; r++) {
                    validTargets.push(HexUtils.posToString({col: c, row: r}));
                }
            }

            for(let i = 0; i < 15; i++) {
                // Shuffle the hexes and pick the first 3
                const shuffled = [...validTargets].sort(() => 0.5 - Math.random());
                const picked = [shuffled[0], shuffled[1], shuffled[2]].sort(); // Alphabetize them
                moves.push(`ISR_FOCUS_${picked[0]}_${picked[1]}_${picked[2]}`);
            }
            
            moves.push(`ISR_AREA_CENTER`);

            // --- NEW RULE: DIR is exactly 3 consecutive hexes in a straight line ---
            // We use Cube Coordinates (x,y,z) because straight lines in offset (col,row) are a nightmare.
            const cubeDirs = [
                {x: 1, y: -1, z: 0},  // East/Diagonal
                {x: 1, y: 0, z: -1},  // North-East
                {x: 0, y: 1, z: -1}   // North-West
                // We only need 3 of the 6 directions, otherwise we generate duplicates (e.g., A1-A2-A3 is the same scan as A3-A2-A1)
            ];

            // Loop through every hex on the 7x6 board
            for (let c = 0; c < 7; c++) {
                for (let r = 0; r < 6; r++) {
                    const startCube = HexUtils.offsetToCube({col: c, row: r});
                    const startStr = HexUtils.posToString({col: c, row: r});

                    // Cast a 3-hex "Ray" in the 3 primary axes
                    for (let i = 0; i < 3; i++) {
                        const dir = cubeDirs[i];
                        
                        // Hex 2 (Middle)
                        const midCube = {x: startCube.x + dir.x, y: startCube.y + dir.y, z: startCube.z + dir.z};
                        const midOffset = HexUtils.cubeToOffset(midCube);
                        
                        // Hex 3 (End)
                        const endCube = {x: startCube.x + (dir.x * 2), y: startCube.y + (dir.y * 2), z: startCube.z + (dir.z * 2)};
                        const endOffset = HexUtils.cubeToOffset(endCube);

                        // If all 3 hexes are safely within the 7x6 board boundaries, it's a valid move
                        if (midOffset.col >= 0 && midOffset.col <= 6 && midOffset.row >= 0 && midOffset.row <= 5 &&
                            endOffset.col >= 0 && endOffset.col <= 6 && endOffset.row >= 0 && endOffset.row <= 5) {
                            
                            const midStr = HexUtils.posToString(midOffset);
                            const endStr = HexUtils.posToString(endOffset);
                            
                            moves.push(`ISR_DIR_${startStr}_${midStr}_${endStr}`);
                        }
                    }
                }
            }
        } // End of if (this.phase === 'SELECT_ACTION')

        return moves;
    }

    getFleetById(id) {
        // Search Red fleets first
        let fleet = this.redFleets.find(f => f.id === id);
        if (fleet) return fleet;
        
        // If not found, search Blue fleets
        return this.blueFleets.find(f => f.id === id);
    }

    makeMove(moveStr) {
        const nextState = this.clone();
        
        if (moveStr.startsWith("MOVE")) {
            // Parse: MOVE_R1_B2
            const parts = moveStr.split('_');
            const fleet = nextState.getFleetById(parts[1]);
            fleet.pos = parts[2];
            fleet.fuel -= 1;
            nextState.turnEnd();
        } 
        else if (moveStr.startsWith("ISR")) {
            // Logic: Perform the dice roll checks from your rules
            // Focus: Auto reveal? 
            // Directional: Roll 1d6, if <=4 reveal.
            // Area: Roll 1d6, if <=3 reveal.
            
            const roll = Math.floor(Math.random() * 6) + 1;
            let success = false;
            
            if (moveStr.includes("DIR") && roll <= 4) success = true;
            if (moveStr.includes("AREA") && roll <= 3) success = true;
            
            if (success) {
                // UPDATE INTEL
                // Reveal ships in the target area.
                // CHECK COMBAT TRIGGER:
                // "If successfully detected... immediately conduct a STRIKE"
                // In MCTS, we can simplify: Instant damage if found.
                // Calculate Range -> Roll To Hit -> Deduct HP
            }
            nextState.turnEnd();
        }
        
        return nextState;
    }
    
    // Helper to switch turns
    turnEnd() {
        this.currentPlayer = (this.currentPlayer === 'RED') ? 'BLUE' : 'RED';
    }

    // Helper: Converts a string like "C3" into a flat array index for the Intel maps
    posToIndex(posStr) {
        const hex = HexUtils.parsePos(posStr);
        if (!hex) return 0; // Safety fallback
        
        // 7 columns (A-G). Index = (Row * Width) + Column
        return (hex.row * 7) + hex.col;
    }
    
    clone() {
        const copy = new F3Game();
        
        // 1. Copy simple variables
        copy.turn = this.turn;
        copy.currentPlayer = this.currentPlayer;
        copy.phase = this.phase;
        
        // 2. Deep Copy Fleets (Critical!)
        // We use JSON parse/stringify to break references so modifying 
        // the clone doesn't hurt the original.
        copy.redFleets = JSON.parse(JSON.stringify(this.redFleets));
        copy.blueFleets = JSON.parse(JSON.stringify(this.blueFleets));
        
        // 3. Copy Intel Arrays
        copy.redIntel = [...this.redIntel];
        copy.blueIntel = [...this.blueIntel];
        
        return copy;
    }

    // inside F3Game class
    isGameOver() {
        // Game ends if one side has no ships left
        const redAlive = this.redFleets.some(f => f.hp > 0);
        const blueAlive = this.blueFleets.some(f => f.hp > 0);
        
        if (!redAlive) { this.winner = 'BLUE'; return true; }
        if (!blueAlive) { this.winner = 'RED'; return true; }
        
        // OR turn limit
        if (this.turn > 20) { this.winner = 'DRAW'; return true; }
        
        return false;
    }
    
    getWinner() {
        return this.winner;
    }
}