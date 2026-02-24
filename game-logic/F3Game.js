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
        
        // RULE: "Conduct ONE of the following... ISR OR Move"
        
        // --- OPTION A: ISR (Focus, Directional, Area) ---
        // Generating EVERY possible ISR combination is too big. 
        // We optimize by generating only "sensible" ISR moves (e.g., targeting unknown areas).
        
        if (this.phase === 'SELECT_ACTION') {
            // 1. Generate Move commands (If fuel > 0)
            const myFleets = (this.currentPlayer === 'RED') ? this.redFleets : this.blueFleets;
            myFleets.forEach(fleet => {
                if (fleet.fuel > 0 && fleet.hp > 0) {
                    const neighbors = HexUtils.getNeighbors(fleet.pos); // Implement logic to get string neighbors
                    neighbors.forEach(n => {
                        if (!this.landHexes.includes(n)) {
                            moves.push(`MOVE_${fleet.id}_${n}`);
                        }
                    });
                }
            });

            // 2. Generate ISR commands
            // Focus: Pick 3 random unknown hexes (simplified for MCTS performance)
            moves.push("ISR_FOCUS_RANDOM"); 
            // Directional: Scan Row 1-6
            for (let r=1; r<=6; r++) moves.push(`ISR_DIR_ROW_${r}`);
            // Area: Scan a cluster (e.g., around C3)
            moves.push(`ISR_AREA_CENTER`);
        }

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