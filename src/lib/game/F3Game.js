// @ts-nocheck
import { HexUtils } from './HexUtils.js';

// --- PERFORMANCE CACHE ---
// Calculates the board shapes once so the AI doesn't fry your CPU
let CACHED_ISR_MOVES = null;

function getStaticISRMoves() {
    if (CACHED_ISR_MOVES) return CACHED_ISR_MOVES;
    
    const moves = [];
    const validTargets = [];
    
    for (let c = 0; c < 7; c++) {
        for (let r = 0; r < 6; r++) {
            validTargets.push(HexUtils.posToString({col: c, row: r}));
        }
    }

    // Cache AREA Moves (Tight 4-hex clusters)
    for (let c = 0; c < 7; c++) {
        for (let r = 0; r < 6; r++) {
            const centerStr = HexUtils.posToString({col: c, row: r});
            const neighbors = HexUtils.getNeighbors(c, r);
            if (neighbors.length >= 3) {
                for (let i = 0; i < neighbors.length; i++) {
                    const cluster = [
                        centerStr, 
                        HexUtils.posToString(neighbors[i]), 
                        HexUtils.posToString(neighbors[(i + 1) % neighbors.length]), 
                        HexUtils.posToString(neighbors[(i + 2) % neighbors.length])
                    ].sort();
                    const moveStr = `ISR_AREA_${cluster.join('_')}`;
                    if (!moves.includes(moveStr)) moves.push(moveStr);
                }
            }
        }
    }

    // Cache DIR Moves (3 hexes in a line)
    const cubeDirs = [{x: 1, y: -1, z: 0}, {x: 1, y: 0, z: -1}, {x: 0, y: 1, z: -1}];
    for (let c = 0; c < 7; c++) {
        for (let r = 0; r < 6; r++) {
            const startCube = HexUtils.offsetToCube({col: c, row: r});
            const startStr = HexUtils.posToString({col: c, row: r});
            for (let i = 0; i < 3; i++) {
                const midCube = {x: startCube.x + cubeDirs[i].x, y: startCube.y + cubeDirs[i].y, z: startCube.z + cubeDirs[i].z};
                const midOffset = HexUtils.cubeToOffset(midCube);
                const endCube = {x: startCube.x + (cubeDirs[i].x * 2), y: startCube.y + (cubeDirs[i].y * 2), z: startCube.z + (cubeDirs[i].z * 2)};
                const endOffset = HexUtils.cubeToOffset(endCube);

                if (midOffset.col >= 0 && midOffset.col <= 6 && midOffset.row >= 0 && midOffset.row <= 5 &&
                    endOffset.col >= 0 && endOffset.col <= 6 && endOffset.row >= 0 && endOffset.row <= 5) {
                    moves.push(`ISR_DIR_${startStr}_${HexUtils.posToString(midOffset)}_${HexUtils.posToString(endOffset)}`);
                }
            }
        }
    }
    
    CACHED_ISR_MOVES = { moves, validTargets };
    return CACHED_ISR_MOVES;
}

export class F3Game {
    constructor() {
        this.turn = 1;
        this.currentPlayer = 'RED'; 
        this.phase = 'SELECT_ACTION'; 
        this.landHexes = ['B3', 'C2', 'D5', 'E4', 'F3']; 
        this.redFleets = []; 
        this.blueFleets = [];
        this.redIntel = new Array(7 * 6).fill('?'); 
        this.blueIntel = new Array(7 * 6).fill('?');
        this.winner = null;
    }

    determinize() {
        const copy = this.clone();
        const opponentFleets = (this.currentPlayer === 'RED') ? copy.blueFleets : copy.redFleets;
        const myIntel = (this.currentPlayer === 'RED') ? copy.redIntel : copy.blueIntel;

        opponentFleets.forEach(fleet => {
            if (fleet.isHidden) {
                let valid = false;
                while (!valid) {
                    const rCol = Math.floor(Math.random() * 7);
                    const rRow = Math.floor(Math.random() * 6);
                    const posStr = `${String.fromCharCode(65+rCol)}${rRow+1}`;
                    
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
            const myFleets = (this.currentPlayer === 'RED') ? this.redFleets : this.blueFleets;
            
            myFleets.forEach(fleet => {
                if (fleet.fuel > 0 && fleet.hp > 0) {
                    const hexCoord = HexUtils.parsePos(fleet.pos);
                    if (hexCoord) {
                        const neighbors = HexUtils.getNeighbors(hexCoord.col, hexCoord.row);
                        neighbors.forEach(n => {
                            const neighborStr = HexUtils.posToString(n);
                            if (!this.landHexes.includes(neighborStr)) {
                                moves.push(`MOVE_${fleet.id}_${neighborStr}`);
                            }
                        });
                    }
                }
            });

            const staticISR = getStaticISRMoves();
            
            for(let i = 0; i < 5; i++) {
                const shuffled = [...staticISR.validTargets].sort(() => 0.5 - Math.random());
                const picked = [shuffled[0], shuffled[1], shuffled[2]].sort();
                moves.push(`ISR_FOCUS_${picked[0]}_${picked[1]}_${picked[2]}`);
            }
            
            moves.push(...staticISR.moves);
        }
        return moves;
    }

    getFleetById(id) {
        let fleet = this.redFleets.find(f => f.id === id);
        if (fleet) return fleet;
        return this.blueFleets.find(f => f.id === id);
    }

    makeMove(moveStr) {
        const nextState = this.clone();
        const parts = moveStr.split('_');
        const command = parts[0];
        
        if (command === "MOVE") {
            const fleetId = parts[1];
            const fleet = nextState.getFleetById(fleetId);
            if (fleet) {
                fleet.pos = parts[2];
                fleet.fuel -= 1;
            }
            nextState.turnEnd();
        } 
        else if (command === "ISR") {
            const scanType = parts[1];
            const targetHexes = parts.slice(2); 
            
            const roll = Math.floor(Math.random() * 6) + 1;
            let success = false;
            
            if (scanType === "DIR" && roll <= 4) success = true;
            if (scanType === "AREA" && roll <= 3) success = true;
            if (scanType === "FOCUS") success = true; 
            
            if (success) {
                const opponentFleets = (this.currentPlayer === 'RED') ? nextState.blueFleets : nextState.redFleets;
                const myIntel = (this.currentPlayer === 'RED') ? nextState.redIntel : nextState.blueIntel;
                
                opponentFleets.forEach(fleet => {
                    if (targetHexes.includes(fleet.pos)) {
                        fleet.hp -= 1; 
                        myIntel[this.posToIndex(fleet.pos)] = 'S'; 
                    }
                });
            }
            nextState.turnEnd();
        }
        
        return nextState;
    }
    
    turnEnd() {
        if (this.currentPlayer === 'BLUE') {
            this.turn += 1; 
        }
        this.currentPlayer = (this.currentPlayer === 'RED') ? 'BLUE' : 'RED';
    }

    posToIndex(posStr) {
        const hex = HexUtils.parsePos(posStr);
        if (!hex) return 0; 
        return (hex.row * 7) + hex.col;
    }
    
    clone() {
        const copy = new F3Game();
        copy.turn = this.turn;
        copy.currentPlayer = this.currentPlayer;
        copy.phase = this.phase;
        copy.redFleets = JSON.parse(JSON.stringify(this.redFleets));
        copy.blueFleets = JSON.parse(JSON.stringify(this.blueFleets));
        copy.redIntel = [...this.redIntel];
        copy.blueIntel = [...this.blueIntel];
        return copy;
    }

    isGameOver() {
        const redAlive = this.redFleets.some(f => f.hp > 0);
        const blueAlive = this.blueFleets.some(f => f.hp > 0);
        
        if (!redAlive) { this.winner = 'BLUE'; return true; }
        if (!blueAlive) { this.winner = 'RED'; return true; }
        if (this.turn > 20) { this.winner = 'DRAW'; return true; }
        
        return false;
    }
    
    getWinner() {
        return this.winner;
    }
}