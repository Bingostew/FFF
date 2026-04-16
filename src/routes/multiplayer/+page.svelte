<script>
    import HexMap from '$lib/+map.svelte';
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { PUBLIC_SERVER_URL } from '$env/static/public';

    let customTiles = $state(null);
    let loading = $state(true);

    onMount(async () => {
        const mapName = page.url.searchParams.get('map');
        if (mapName) {
            try {
                const fileName = mapName.endsWith('.json') ? mapName : `${mapName}.json`;
                const res = await fetch(`${PUBLIC_SERVER_URL}/maps/${encodeURIComponent(fileName)}?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    customTiles = Array.isArray(data) ? data : data.tiles;
                }
            } catch (e) {
                console.error("Failed to load custom map", e);
            }
        }
        loading = false;
    });
</script>

<div class="page-content">
  <h1 class="glitch-text">FIND, FIX, & FINISH</h1>
  
  <div class="map-container">
    {#if !loading}
        <HexMap {customTiles} />
    {:else}
        <div class="loading-status">INITIALIZING MULTIPLAYER THEATER...</div>
    {/if}
  </div>
</div>

<style>
  .page-content {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding-top: 2vh;
    width: 100%;
    height: 100%;
    user-select: none;
    -webkit-user-select: none; 
  }

  .map-container {
    width: 70vw;   
    height: 80vh;  
    border: 1px solid #333;
    background: rgba(0, 0, 0, 0.5); 
  }

  .loading-status {
    color: #3b82f6;
    font-family: 'Chakra Petch', sans-serif;
    font-size: 1.5rem;
    text-shadow: 0 0 10px #3b82f6;
  }

  .glitch-text {
    font-family: 'Chakra Petch', sans-serif;
    font-size: 7vh;
    color: #3b82f6;
    margin-bottom: 2vh;
  }
</style>