// @ts-nocheck
export const getS = (h) => -h.q - h.r;

/**
 * Calculates which hexes should be highlighted based on mode and rotation
 */
export function getTargetHexes(centerHex, mode, rot, gridHexes) {
    if (!centerHex) return [];
    
    // Focus or Area start with the single hex under the cursor
    if (mode === 'focus' || mode === 'area') return [centerHex];

    if (mode === 'directional') {
        const rotIndex = rot % 3;
        let lineHexes = [];

        if (rotIndex === 0) {
            // Vertical
            lineHexes = gridHexes.filter(h => h.col === centerHex.col)
                                .sort((a, b) => a.row - b.row);
        } else if (rotIndex === 1) {
            // Slant Right
            lineHexes = gridHexes.filter(h => h.r === centerHex.r)
                                .sort((a, b) => a.q - b.q);
        } else if (rotIndex === 2) {
            // Slant Left
            const centerS = getS(centerHex);
            lineHexes = gridHexes.filter(h => getS(h) === centerS)
                                .sort((a, b) => a.q - b.q);
        }

        const index = lineHexes.indexOf(centerHex);
        let startIndex = Math.max(0, Math.min(index - 1, lineHexes.length - 3));
        const selection = lineHexes.slice(startIndex, startIndex + 3);
        
        return selection.length === 3 ? selection : [];
    }
    return [];
}

/**
 * Flood fill algorithm to ensure a group of hexes is contiguous
 */
export function isGroupConnected(group) {
    if (group.length <= 1) return true;

    const start = group[0];
    const visited = new Set([`${start.q},${start.r}`]);
    const queue = [start];

    while (queue.length > 0) {
        const current = queue.shift();
        
        const neighbors = group.filter(h => {
            const key = `${h.q},${h.r}`;
            if (visited.has(key)) return false;
            
            const dist = (Math.abs(h.q - current.q) 
                        + Math.abs(h.r - current.r) 
                        + Math.abs(getS(h) - getS(current))) / 2;
            return dist === 1;
        });

        for (const neighbor of neighbors) {
            visited.add(`${neighbor.q},${neighbor.r}`);
            queue.push(neighbor);
        }
    }

    return visited.size === group.length;
}