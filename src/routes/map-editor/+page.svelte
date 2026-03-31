<script>
    // @ts-nocheck
    import { defineHex, Grid, rectangle, Orientation } from 'honeycomb-grid';
    import { isHovering } from '$lib/store';

    // Grid Setup (Same dimensions as your game map)
    const Tile = defineHex({ dimensions: 50, origin: 'topLeft', orientation: Orientation.FLAT, offset: 1 });
    const grid = new Grid(Tile, rectangle({ width: 7, height: 6 }));

    // Editor State
    let specialTiles = $state([]);
    let exportedData = $state('[]');
    let isMouseDown = false;
    let mapName = $state('MyMap');
    let showLoadMapModal = $state(false);
    let mapList = $state([]);

    // Available terrain types based on your assets
    const terrainTypes = [
        { name: 'Water (Eraser)', img: 'water2.jpg', type: 'water' },
        { name: 'Single Palm', img: 'single_palm.jpg', type: 'land' },
        { name: 'Double Palm', img: 'double_palm.jpg', type: 'land' },
        { name: 'Tree', img: 'tree.jpg', type: 'land' },
        { name: 'Hill', img: 'hill.jpg', type: 'land' },
        { name: 'Peak', img: 'peak.jpg', type: 'land' },
        { name: 'Mountain', img: 'mountain.jpg', type: 'land' }
    ];

    let selectedTerrain = $state(terrainTypes[1]); // Default to Single Palm

    function getTileConfig(hex) {
        return specialTiles.find(t => t.col === hex.col && t.row === hex.row);
    }

    function handleHexClick(hex) {
        const existingIndex = specialTiles.findIndex(t => t.col === hex.col && t.row === hex.row);

        if (selectedTerrain.type === 'water') {
            // Remove if exists (Water is default state, so we don't save it)
            if (existingIndex > -1) {
                const newTiles = [...specialTiles];
                newTiles.splice(existingIndex, 1);
                specialTiles = newTiles;
            }
        } else {
            // Add or Update
            const newTile = { col: hex.col, row: hex.row, img: selectedTerrain.img };
            if (existingIndex > -1) {
                const newTiles = [...specialTiles];
                newTiles[existingIndex] = newTile;
                specialTiles = newTiles;
            } else {
                specialTiles = [...specialTiles, newTile];
            }
        }
        updateExport();
    }

    function updateExport() {
        // Sort by column then row for cleaner JSON output
        const sorted = [...specialTiles].sort((a, b) => {
            if (a.col === b.col) return a.row - b.row;
            return a.col - b.col;
        });
        exportedData = JSON.stringify(sorted, null, 2);
    }
    
    function copyToClipboard() {
        navigator.clipboard.writeText(exportedData);
        alert('Map configuration copied to clipboard!');
    }

    async function uploadMap() {
        try {
            const payload = {
                name: mapName,
                tiles: JSON.parse(exportedData)
            };

            const res = await fetch(`http://${window.location.hostname}:3000/save-map`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) alert('Map uploaded successfully!');
            else alert('Failed to upload map.');
        } catch (e) {
            alert('Error uploading map.');
        }
    }

    function clearMap() {
        specialTiles = [];
        mapName = 'MyNewMap';
        updateExport();
    }

    async function openLoadMapModal() {
        try {
            const res = await fetch(`http://${window.location.hostname}:3000/list-maps`);
            mapList = await res.json();
        } catch (e) {
            mapList = [];
            alert('Could not fetch map list.');
        }
        showLoadMapModal = true;
    }

    async function loadMap(mapFile) {
        try {
            const res = await fetch(`http://${window.location.hostname}:3000/maps/${encodeURIComponent(mapFile)}?t=` + Date.now());
            if (!res.ok) throw new Error('Map file not found on server.');
            let data = await res.json();

            // Handle legacy array format directly on client if server didn't transform it
            if (Array.isArray(data)) {
                data = { name: mapFile.replace('.json', ''), tiles: data };
            }

            // Validate that the loaded data is an object with a 'tiles' array
            if (typeof data !== 'object' || data === null || !Array.isArray(data.tiles)) {
                throw new Error('Invalid or corrupted map file format.');
            }

            mapName = data.name || mapFile.replace('.json', ''); // Use filename as fallback
            specialTiles = data.tiles; // This is now safe to assign

            updateExport();
            showLoadMapModal = false;
            alert(`Map '${mapName}' loaded successfully!`);
        } catch (e) {
            console.error('Error loading map:', e);
            alert(`Failed to load map. Check the browser console for more details.`);
        }
    }
</script>

<svelte:window onmouseup={() => isMouseDown = false} />

<div class="editor-container">
    <div class="sidebar">
        <h2>MAP EDITOR</h2>
        <p class="instructions">Select a terrain type and click on the grid to paint. Selecting Water removes special tiles.</p>
        
        <div class="terrain-palette">
            {#each terrainTypes as terrain}
                <button 
                    class:active={selectedTerrain === terrain}
                    onclick={() => selectedTerrain = terrain}
                    onmouseenter={() => $isHovering = true}
                    onmouseleave={() => $isHovering = false}
                >
                    <img src={`/${terrain.img}`} alt={terrain.name} class="preview-icon" />
                    <span>{terrain.name}</span>
                </button>
            {/each}
        </div>

        <div class="export-section">
            <h3>EXPORT DATA</h3>
            <input type="text" bind:value={mapName} placeholder="Map Name" class="map-name-input" />
            <textarea readonly value={exportedData}></textarea>
            <button class="action-btn" onclick={copyToClipboard}>COPY TO CLIPBOARD</button>
            <button class="action-btn" onclick={uploadMap}>UPLOAD TO SERVER</button>
            <button class="action-btn" onclick={openLoadMapModal}>LOAD SAVED MAP</button>
            <button class="action-btn" onclick={clearMap}>NEW/CLEAR MAP</button>
        </div>
        
        <a href="/" class="back-link">RETURN TO BASE</a>
    </div>

    <div class="map-area">
        <svg viewBox="0 0 1000 600" class="tactical-grid">
            <defs>
                <pattern id="water-pattern" x="0" y="0" width="200" height="200" patternUnits="userSpaceOnUse">
                    <image href="/water2.jpg" x="0" y="0" width="200" height="200" preserveAspectRatio="xMidYMid slice"/>
                </pattern>
                
                {#each specialTiles as tile}
                     <pattern 
                        id={`pattern-${tile.col}-${tile.row}`} 
                        patternUnits="objectBoundingBox" 
                        width="1" height="1" 
                        viewBox="0 0 1 1"
                    >
                        <image 
                            href={`/${tile.img}`} 
                            x="-0.1" y="-0.1" 
                            width="1.2" height="1.2" 
                            preserveAspectRatio="xMidYMid slice"
                        />
                    </pattern>
                {/each}
            </defs>

            <g transform="translate(50, 50)">
                {#each grid as hex}
                    {@const config = getTileConfig(hex)}
                    <g 
                        class="hex-cell" 
                        onmousedown={(e) => { e.preventDefault(); isMouseDown = true; handleHexClick(hex); }}
                        onmouseenter={() => { $isHovering = true; if (isMouseDown) handleHexClick(hex); }}
                        onmouseleave={() => $isHovering = false}
                        role="button" 
                        tabindex="0"
                        onkeydown={(e) => e.key === 'Enter' && handleHexClick(hex)}
                    >
                        <polygon
                            points={hex.corners.map(({ x, y }) => `${x},${y}`).join(' ')}
                            fill={config ? `url(#pattern-${hex.col}-${hex.row})` : "url(#water-pattern)"}
                            stroke="black"
                            stroke-width="0.5"
                        />
                    </g>
                {/each}
            </g>
        </svg>
    </div>
</div>

{#if showLoadMapModal}
    <div class="modal-backdrop">
      <div class="modal-content">
        <h2>LOAD CUSTOM MAP</h2>
        <div class="vertical-stack">
            {#if mapList.length > 0}
              <div class="map-list-container">
                {#each mapList as map}
                  <button class="action-btn wide map-btn" onclick={() => loadMap(map)}>{map.replace('.json', '')}</button>
                {/each}
              </div>
            {:else}
                <p>No custom maps found on server.</p>
            {/if}
        </div>
        <button class="close-btn" onclick={() => showLoadMapModal = false}>CANCEL</button>
      </div>
    </div>
{/if}

<style>
  .editor-container {
    display: flex;
    width: 100vw;
    height: 100vh;
    background: #0f0f1a;
    color: #fff;
    font-family: 'Chakra Petch', sans-serif;
    overflow: hidden;
  }

  .sidebar {
    width: 350px;
    padding: 20px;
    background: rgba(20, 20, 30, 0.95);
    border-right: 2px solid #3b82f6;
    display: flex;
    flex-direction: column;
    gap: 20px;
    overflow-y: auto;
    z-index: 10;
    box-shadow: 5px 0 15px rgba(0,0,0,0.5);
  }

  h2 {
    color: #3b82f6;
    margin: 0;
    font-size: 2rem;
    text-shadow: 0 0 5px #3b82f6;
  }

  h3 {
    color: #abbbd1;
    font-size: 1.2rem;
    margin-bottom: 5px;
  }

  .instructions {
    color: #abbbd1;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .terrain-palette {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .terrain-palette button {
    display: flex;
    align-items: center;
    gap: 15px;
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid #555;
    color: #abbbd1;
    padding: 10px;
    cursor: pointer;
    font-family: inherit;
    font-size: 1rem;
    transition: all 0.2s;
    text-align: left;
  }

  .terrain-palette button:hover {
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    color: white;
  }

  .terrain-palette button.active {
    background: rgba(59, 130, 246, 0.6);
    border-color: #3b82f6;
    color: white;
    box-shadow: 0 0 10px rgba(59, 130, 246, 0.4);
  }

  .preview-icon {
    width: 40px;
    height: 40px;
    object-fit: cover;
    border-radius: 4px;
    border: 1px solid #000;
  }

  .export-section {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(0,0,0,0.3);
    padding: 15px;
    border: 1px solid #333;
  }

  .map-name-input {
    background: #050505;
    border: 1px solid #3b82f6;
    color: #fff;
    padding: 8px;
    font-family: 'Chakra Petch', sans-serif;
    margin-bottom: 5px;
    outline: none;
  }

  textarea {
    height: 120px;
    background: #050505;
    border: 1px solid #333;
    color: #0f0;
    font-family: monospace;
    font-size: 11px;
    padding: 10px;
    resize: none;
    outline: none;
  }

  .action-btn {
    background: #3b82f6;
    color: black;
    border: none;
    padding: 12px;
    font-weight: bold;
    font-family: 'Chakra Petch', sans-serif;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: white;
    box-shadow: 0 0 10px white;
  }

  .map-area {
    flex-grow: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    background-image: url('/tacticalmap.jpg');
    background-size: cover;
    background-position: center;
    position: relative;
  }

  .map-area::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.4); /* Dim the background image slightly */
    pointer-events: none;
  }

  .tactical-grid {
    width: 80%;
    height: 80%;
    filter: drop-shadow(0 0 20px rgba(0,0,0,0.8));
    z-index: 1;
  }

  .hex-cell polygon {
    transition: stroke 0.1s, stroke-width 0.1s, fill-opacity 0.2s;
    cursor: pointer;
  }
  
  .hex-cell:hover polygon {
    stroke: white;
    stroke-width: 3;
    fill-opacity: 0.8;
  }
  
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100;
    backdrop-filter: blur(4px);
  }

  .modal-content {
    background: rgba(20, 20, 30, 0.95);
    border: 2px solid #3b82f6;
    padding: 3rem;
    text-align: center;
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.5);
    font-family: 'Chakra Petch', sans-serif;
    color: #fff;
    width: 60vw;        
    max-width: 800px;   
    min-width: 500px;   
  }

  .modal-content h2 {
    font-size: 4vh;
    margin-bottom: 2rem;
    color: #3b82f6;
    text-shadow: 0 0 5px #3b82f6;
  }

  .vertical-stack { 
    display: flex; 
    flex-direction: column;
    gap: 1.5rem;           
    align-items: center;    
    margin-bottom: 1.5rem; 
    width: 100%;
  }

  .map-list-container {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 10px;
    align-items: center;
    margin-top: 1rem;
    max-height: 30vh;
    overflow-y: auto;
  }

  .action-btn.wide { 
    width: 100%; 
    max-width: 500px;      
    display: block;
  }

  .map-btn {
    font-size: 1.5vh;
    padding: 0.8rem;
  }

  .close-btn {
    background: transparent;
    border: 1px solid #abbbd1;
    color: #abbbd1;
    padding: 0.5rem 2rem;
    font-size: 2vh;
    cursor: pointer;
    transition: all 0.3s;
  }

  .close-btn:hover {
    background: #3b82f6;
    color: #000;
    border-color: #3b82f6;
    box-shadow: 0 0 10px #3b82f6;
  }

  .back-link {
    color: #555;
    text-decoration: none;
    margin-top: 10px;
    display: block;
    text-align: center;
    font-size: 0.9rem;
    transition: color 0.2s;
  }
  .back-link:hover {
    color: #3b82f6;
  }
</style>
