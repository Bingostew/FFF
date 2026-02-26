// @ts-nocheck
// HexUtils.js
// Handles the "Odd-Q" Vertical Layout (Shove Odd columns down)

// Direction offsets for Odd-Q layout
// [0] = Even Columns, [1] = Odd Columns
const DIRECTIONS = [
    // Even cols (A=0, C=2...):
    [ [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [0, 1] ],
    // Odd cols (B=1, D=3...):
    [ [1, 1], [1, 0], [0, -1], [-1, 0], [-1, 1], [0, 1] ]
];

export const HexUtils = {

    // Convert "C3" string to {col: 2, row: 2}
    parsePos: (posStr) => {
        if (!posStr || posStr.length < 2) return null;
        const colChar = posStr.charAt(0).toUpperCase();
        const rowChar = posStr.slice(1); // Use slice to handle "10", "11", etc.
        
        const col = colChar.charCodeAt(0) - 65; // A=0, B=1...
        const row = parseInt(rowChar, 10) - 1;  // 1=0, 2=1...
        
        if (isNaN(col) || isNaN(row)) return null;
        return { col, row };
    },

    // Convert {col: 2, row: 2} back to "C3"
    posToString: (hex) => {
        const colChar = String.fromCharCode(hex.col + 65);
        const rowChar = hex.row + 1;
        return `${colChar}${rowChar}`;
    },

    // Get all 6 neighbors of a hex
    getNeighbors: (col, row) => {
        // Force inputs to numbers to prevent "TypeError"
        const c = Number(col);
        const r = Number(row);

        if (isNaN(c) || isNaN(r)) return [];

        const parity = c & 1; // Safer than % 2
        const validDirs = DIRECTIONS[parity];

        if (!validDirs) return []; // Safety check

        return validDirs
            .map(d => ({ col: c + d[0], row: r + d[1] }))
            // Bounds check (A-G [0-6], 1-6 [0-5])
            .filter(h => h.col >= 0 && h.col <= 6 && h.row >= 0 && h.row <= 5); 
    },

    // Distance between two hexes (Cube coordinate conversion)
    getDistance: (h1, h2) => {
        const c1 = HexUtils.offsetToCube(h1);
        const c2 = HexUtils.offsetToCube(h2);
        return (Math.abs(c1.x - c2.x) + Math.abs(c1.y - c2.y) + Math.abs(c1.z - c2.z)) / 2;
    },

    // Convert Offset (col, row) to Cube (x, y, z)
    offsetToCube: ({col, row}) => {
        const x = col;
        const z = row - (col - (col & 1)) / 2;
        const y = -x - z;
        return { x, y, z };
    },

    // Convert Cube (x, y, z) to Offset (col, row)
    cubeToOffset: ({x, y, z}) => {
        const col = x;
        const row = z + (x - (x & 1)) / 2;
        return { col, row };
    },

    // Round floating point cube coordinates to nearest integer hex
    cubeRound: (fracCube) => {
        let rx = Math.round(fracCube.x);
        let ry = Math.round(fracCube.y);
        let rz = Math.round(fracCube.z);

        const x_diff = Math.abs(rx - fracCube.x);
        const y_diff = Math.abs(ry - fracCube.y);
        const z_diff = Math.abs(rz - fracCube.z);

        // Reset the component with the largest change to ensure x+y+z=0
        if (x_diff > y_diff && x_diff > z_diff) {
            rx = -ry - rz;
        } else if (y_diff > z_diff) {
            ry = -rx - rz;
        } else {
            rz = -rx - ry;
        }

        return { x: rx, y: ry, z: rz };
    },

    // Check if line between A and B crosses specific "blocked" hexes
    // 'obstacles' is an array of objects like [{col:1, row:1}, ...]
    checkLineOfSight: (start, end, obstacles = []) => {
        const N = HexUtils.getDistance(start, end);
        if (N === 0) return true; // Start is End
        
        const c1 = HexUtils.offsetToCube(start);
        const c2 = HexUtils.offsetToCube(end);
        
        // Linear interpolation (Lerp) along the line
        for (let i = 1; i < N; i++) {
            const t = 1.0 / N * i;
            // Lerp
            const cx = c1.x + (c2.x - c1.x) * t;
            const cy = c1.y + (c2.y - c1.y) * t;
            const cz = c1.z + (c2.z - c1.z) * t;
            
            // Round to nearest valid hex
            const cubeHit = HexUtils.cubeRound({x: cx, y: cy, z: cz});
            const offsetHit = HexUtils.cubeToOffset(cubeHit);

            // Check if this hex is in the obstacles list
            // (Using simple string comparison for check)
            const hitStr = HexUtils.posToString(offsetHit);
            const isBlocked = obstacles.some(obs => HexUtils.posToString(obs) === hitStr);
            
            if (isBlocked) {
                return false; // Line of sight blocked
            }
        }
        return true; // Line of sight clear
    }
};