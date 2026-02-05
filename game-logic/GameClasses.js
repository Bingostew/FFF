// GameClasses.js

export class Vector2 {
    constructor(x, y) { this.x = x; this.y = y; }
    equals(other) { return this.x === other.x && this.y === other.y; }
}

export class Unit {
    constructor(id, x, y, type) {
        this.id = id;
        this.pos = new Vector2(x, y);
        this.type = type; // 'AI' or 'PLAYER'
        this.isAlive = true;
    }

    clone() {
        let u = new Unit(this.id, this.pos.x, this.pos.y, this.type);
        u.isAlive = this.isAlive;
        return u;
    }
}

export class GameState {
    constructor() {
        this.width = 7;  // A - G
        this.height = 6; // 1 - 6
        this.turn = 'AI';
        this.units = [];
        this.grid = Array(this.height).fill().map(() => Array(this.width).fill(0));
    }

    addUnit(unit) { this.units.push(unit); }

    clone() {
        const newState = new GameState(this.size);
        newState.turn = this.turn;
        newState.grid = this.grid.map(row => [...row]);
        newState.units = this.units.map(u => u.clone());
        return newState;
    }

    getOpponent(type) { return type === 'AI' ? 'PLAYER' : 'AI'; }

    getLegalMoves() {
        const activeUnit = this.units.find(u => u.type === this.turn && u.isAlive);
        if (!activeUnit) return [];

        const moves = [];
        const directions = [[0, 1], [0, -1], [1, 0], [-1, 0]];

        directions.forEach(d => {
            const nx = activeUnit.pos.x + d[0];
            const ny = activeUnit.pos.y + d[1];
            
            // Check boundaries using width and height
            if (nx >= 0 && nx < this.width && ny >= 0 && ny < this.height && this.grid[ny][nx] === 0) {
                moves.push(new Vector2(nx, ny));
            }
        });
        
        return moves;
    }

    applyMove(move) {
        const activeUnit = this.units.find(u => u.type === this.turn && u.isAlive);
        activeUnit.pos = move;
        this.turn = this.getOpponent(this.turn);
    }

    getWinner() {
        const player = this.units.find(u => u.type === 'PLAYER');
        const ai = this.units.find(u => u.type === 'AI');
        if (player.pos.equals(ai.pos)) return 'AI';
        if (player.pos.x === this.size - 1 && player.pos.y === this.size - 1) return 'PLAYER';
        return null;
    }
}


export function toGridRef(vector) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    // X is the letter, Y is the number (inverted because row 0 is usually '1')
    // Typically in grids, 0,0 is top-left. Let's assume A1 is top-left.
    const letter = letters[vector.x];
    const number = vector.y + 1; 
    return `${letter}${number}`;
}

export function fromGridRef(ref) {
    const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const char = ref.charAt(0).toUpperCase();
    const num = parseInt(ref.slice(1)) - 1; // "1" becomes index 0
    
    const x = letters.indexOf(char);
    const y = num;
    
    return new Vector2(x, y);
}