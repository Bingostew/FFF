<script>
    import { defineHex, Grid, rectangle } from 'honeycomb-grid'
    import { isHovering } from '$lib/store'; 

    // 1. Create a hex class, this defines what a single hex looks like:
    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: 'flat'})

    // 2. Create a grid by passing the class and a "traverser" for a rectangular-shaped grid:
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }))

    // 3. Svelte 5 Runes are used to track user actions.
    let hoveredHex = $state(null)
    let selectedHex = $state(null)

    //Function to handle hex clicks.
    function HandleHexClick(hex){
      //If clicking the currently selected hex, deselect it
      if (selectedHex == hex){
        selectedHex = null
      } else {
        selectedHex = hex
      }
    }
    
</script>

<svg 
    viewBox="0 0 1000 600"
    preserveAspectRatio="xMidYMid meet"
    class="tactical-grid"
>
  <g transform="translate(170, 50)"> 

    {#each grid as hex}
        <g 
            class="hex-group"
            role="button" 
            tabindex="0"
            onclick={() => HandleHexClick(hex)}
            onmouseenter={() => {
                hoveredHex = hex;
                $isHovering = true;  // Grow cursor
            }}
            onmouseleave={() => {
                hoveredHex = null;
                $isHovering = false; // Shrink cursor
            }}
            onkeydown={(e) => e.key === 'Enter' && HandleHexClick(hex)}
        >
            <polygon
                points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                stroke="#3b82f6"
                stroke-width={hex === selectedHex ? 3 : 1}
                
                fill={
                    hex === selectedHex ? 'rgba(226, 74, 74, 0.6)' :  /* Red (Selected) */
                    hex === hoveredHex  ? 'rgba(59, 130, 246, 0.4)' : /* Blue (Hover) */
                    'rgba(59, 130, 246, 0.1)'                         /* Transparent blue(Default) */
                }
            />
            
            {#if hex === hoveredHex || hex === selectedHex}
                <text 
                    x={hex.x} y={hex.y} dy="25" 
                    text-anchor="middle" 
                    fill="white" font-size="15" pointer-events="none"
                >
                    {hex.q}-{hex.r}
                </text>
            {/if}
        </g>
    {/each}

  </g>
</svg>

<style>
    /*Controls the size of the map for the user.*/
    .tactical-grid {
        width: 110%;
        height: 90%;
        overflow: visible; 
        user-select: none; 
    }

    .hex-group {
        transition: all 0.2s ease;
    }

    /* Glow effect on hover */
    .hex-group:hover polygon {
        filter: drop-shadow(0 0 8px #3b82f6);
        transition: all 0.4s ease;

    }
</style>