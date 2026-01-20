<script>
    import { defineHex, Grid, rectangle } from 'honeycomb-grid'
    import { isHovering } from '$lib/store'; 

    // 1. Setup Grid
    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: 'flat', offset: 1 })
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }))

    // 2. State
    let hoveredHex = $state(null)
    let selectedHex = $state(null)

    // 3. Configuration: Map coordinates to specific image files
    // You can change the 'img' property to any file in your static folder.
    const specialTiles = [
        { col: 1, row: 2, img: 'single_palm.jpg' },      // B-3
        { col: 2, row: 1, img: 'double_palm.jpg' },  // C-2 (Example: different image)
        { col: 2, row: 4, img: 'tree.jpg' },     // C-5
        { col: 3, row: 4, img: 'hill.jpg' },   // D-5
        { col: 4, row: 3, img: 'peak.jpg' },    // E-4
        { col: 5, row: 2, img: 'mountain.jpg' }     // F-3
    ];

    // Helper: Find if the current hex has a special image assigned
    function getTileConfig(hex) {
        return specialTiles.find(t => t.col === hex.col && t.row === hex.row);
    }

    function HandleHexClick(hex){
      if (selectedHex == hex) selectedHex = null;
      else selectedHex = hex;
    }

    function getLabel(hex) {
        return `${String.fromCharCode(65 + hex.col)}-${hex.row + 1}`;
    }
</script>

<svg 
    viewBox="0 0 1000 600"
    preserveAspectRatio="xMidYMid meet"
    class="tactical-grid"
>
  <defs>
    <pattern id="water-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
      <image href="water2.jpg" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid slice"/>
    </pattern>
    
    {#each specialTiles as tile}
        <pattern 
            id={`pattern-${tile.col}-${tile.row}`} 
            patternUnits="objectBoundingBox" 
            width="1" height="1" 
            viewBox="0 0 1 1"
        >
            <image 
                href={tile.img} 
                x="-0.1" y="-0.1" 
                width="1.2" height="1.2" 
                preserveAspectRatio="xMidYMid slice"
            />
        </pattern>
    {/each}
  </defs>

  <g transform="translate(170, 80)"> 
    {#each grid as hex}
        {@const specialConfig = getTileConfig(hex)}
        
        <g 
            class="hex-group"
            role="button" 
            tabindex="0"
            onclick={() => HandleHexClick(hex)}
            onmouseenter={() => { hoveredHex = hex; $isHovering = true; }}
            onmouseleave={() => { hoveredHex = null; $isHovering = false; }}
            onkeydown={(e) => e.key === 'Enter' && HandleHexClick(hex)}
        >
            <polygon
                points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                fill={specialConfig ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"}
                stroke="black"
                stroke-width="1"
            />

            <polygon
                points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                stroke="black"
                stroke-width={hex === selectedHex ? 4 : 0} 
                fill={
                    hex === selectedHex ? 'rgba(226, 74, 74, 0.6)' : 
                    hex === hoveredHex  ? 'rgba(59, 130, 246, 0.4)' : 
                    'rgba(0, 0, 0, 0.05)' /* Very subtle shadow for contrast against black lines */
                }
                style="pointer-events: none;" 
            />
            
            {#if hex === hoveredHex || hex === selectedHex}
                <text 
                    x={hex.x} y={hex.y} dy="25" 
                    text-anchor="middle" 
                    fill="white" font-size="20" font-weight="bold" pointer-events="none"
                    style="text-shadow: 0px 0px 4px #000;"
                >
                    {getLabel(hex)}
                </text>
            {/if}
        </g>
    {/each}
  </g>
</svg>

<style>
    .tactical-grid {
        width: 110%;
        height: 90%;
        overflow: visible; 
        user-select: none; 
    }

    .hex-group {
        cursor: pointer;
        transition: all 0.2s ease;
    }

    .hex-group:hover polygon {
        /* Changed glow to white/gold to contrast better with black outlines */
        filter: drop-shadow(0 0 5px rgba(255, 255, 255, 0.8));
        z-index: 10; 
    }
</style>