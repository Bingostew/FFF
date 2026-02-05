<script>
    import { defineHex, Grid, rectangle } from 'honeycomb-grid'

    // 1. Create a hex class:
    const Tile = defineHex({ dimensions: 50 })

    // 2. Create a grid by passing the class and a "traverser" for a rectangular-shaped grid:
    const grid = new Grid(Tile, rectangle({ width: 10, height: 10 }))

</script>

<svg width="1000" height="1000">
  <g transform="translate(50, 50)">
    
    {#each grid as hex}
      <polygon
        points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
        fill="blue"
        stroke="white"
        stroke-width="2"
      />
    {/each}

  </g>
</svg>