const map = { tiles: {} };
const cols = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
const centerColIndex = 3; // 'D' is index 3 (0,1,2,3)
const centerRow = 4;

cols.forEach((colChar, colIndex) => {
    // 1. Calculate X (Column Offset)
    const x = colIndex - centerColIndex; 

    for (let row = 1; row <= 6; row++) {
        // 2. Calculate Z (Row Offset)
        const z = row - centerRow;
        
        // 3. Calculate Y (Constraint)
        const y = -x - z;
        
        // 4. Build String Key
        const loc = `${x},${y},${z}`;
        
        map.tiles[loc] = {
            name: `${colChar}-${row}`,
            type: "ocean"
        };
    }
});

console.log(JSON.stringify(map, null, 2));