const fs = require('fs');

// CONFIG: Your exact setup
const LAND_HEXES = ["B-3", "C-2", "C-5", "D-5", "E-4", "F-3"];
const COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const ROWS = [1, 2, 3, 4, 5, 6];

// ANCHORS
const CENTER_COL_CHAR = 'D'; // Index 3
const CENTER_ROW_NUM = 4;

function generateMap() {
    const tiles = {};

    COLS.forEach((colChar, colIdx) => {
        ROWS.forEach((rowNum) => {
            
            // 1. Calculate X (Column Offset)
            // D=0. A=-3.
            // A(0) - D(3) = -3.
            const centerColIdx = COLS.indexOf(CENTER_COL_CHAR);
            const x = colIdx - centerColIdx;

            // 2. Calculate Z (Row + Stagger Logic)
            // Based on your data point A-1 = (-3, -1, 4)
            // Row 1 is "Up" from Row 4, so base diff is +3.
            // We apply a stagger offset: Floor(Distance from Center / 2)
            
            const rowDiff = CENTER_ROW_NUM - rowNum; // 4 - 1 = 3
            
            // Calculate Stagger
            // Logic: For every 2 columns left of center, Z increases by 1 extra point
            // Col D (0) -> Stagger 0
            // Col C (-1) -> Stagger 0
            // Col B (-2) -> Stagger 1
            // Col A (-3) -> Stagger 1
            
            let stagger = 0;
            if (x < 0) {
                stagger = Math.floor(Math.abs(x + 1) / 2); // Shift logic to pair A-B
                // Actually, let's reverse engineer your specific A-1
                // x=-3. rowDiff=3. Target=4. So Stagger=1.
                stagger = Math.floor(Math.abs(x) / 2); // floor(1.5) = 1.
                
                // Let's check B-1 (x=-2). Stagger = floor(1) = 1.
                // Result B-1: z = 3 + 1 = 4. (Shares Z with A-1. Valid neighbor).
                
            } else if (x > 0) {
                stagger = -Math.ceil(x / 2); // Mirror for right side
            }

            const z = rowDiff + stagger;

            // 3. Calculate Y (Constraint)
            const y = -x - z;

            // 4. Create Entry
            const name = `${colChar}-${rowNum}`;
            const key = `${x},${y},${z}`;
            
            const isLand = LAND_HEXES.includes(name);

            tiles[key] = {
                name: name,
                location: key,
                type: isLand ? "land" : "water",
                obstacle: isLand
            };
        });
    });

    return {
        mapId: "fff_custom_coords",
        landHexes: LAND_HEXES,
        center: "D-4",
        tiles: tiles
    };
}

const mapData = generateMap();

// DEBUG: Verify A-1 matches your requirement
console.log("Check A-1:", mapData.tiles["-3,-1,4"]); 
// Should print the object for A-1. If undefined, math is wrong.

fs.writeFileSync('map.json', JSON.stringify(mapData, null, 2));
console.log("Map generated with Custom Coordinates.");