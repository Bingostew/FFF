<!--SINGLEPLAYER PAGE-->
<!--SCRIPTS FOR SINGEPLAYER PAGE-->
<script>
    import HexMap from '$lib/+map.svelte';
    import { page } from '$app/state';
    import { onMount } from 'svelte';
    import { PUBLIC_SERVER_URL, PUBLIC_SERVER_PORT } from '$env/static/public';

    const PORT = PUBLIC_SERVER_PORT;
    let customTiles = $state(null);
    let loading = $state(true);

    onMount(async () => {
        const mapName = page.url.searchParams.get('map');
        if (mapName) {
            try {
                const fileName = mapName.endsWith('.json') ? mapName : `${mapName}.json`;
                const res = await fetch(`http://${window.location.hostname}:${PORT}/maps/${encodeURIComponent(fileName)}?t=${Date.now()}`);
                if (res.ok) {
                    const data = await res.json();
                    customTiles = Array.isArray(data) ? data : data.tiles;
                }
                else {
                    console.error("Failed to load custom map", e);
                }
            } catch (e) {
                console.error("Failed to load custom map", e);
            }
        }
        loading = false;
    });
</script>

<!--SINGLEPLAYER HTML-->
<!--Possibly consier adding more features to the top part of the page-->
<div class="page-content">
    <h1 class="glitch-text">FIND, FIX, & FINISH</h1>
    
    <div class="map-container">
        {#if !loading}
            <HexMap {customTiles} />
        {:else}
            <div class="loading-status">INITIALIZING THEATER OF OPERATIONS...</div>
        {/if}
    </div>
</div>

<!--SINGLEPLAYER HTML APPEARANCE-->
<style>
    /*Overall layout specification of the page*/
    .page-content {
        display: flex;
        flex-direction: column;
        align-items: center;
        padding-top: clamp(10px, 2vh, 40px);
        width: 100vw;
        height: 100vh;
        box-sizing: border-box;
        overflow: hidden;
        user-select: none; 
        -webkit-user-select: none; 
    }

    /*How the container of the map, sidebar, and statusbar looks*/
    .map-container {
        width: clamp(300px, 95vw, 1100px);   
        height: clamp(400px, 80vh, 800px);  
        
        display: flex;
        justify-content: center;
        align-items: center;
        
        background: rgba(10, 15, 30, 0.6);
        border: 1px solid rgba(59, 130, 246, 0.4); 
        box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(59, 130, 246, 0.1) inset;
        border-radius: 8px;
        
        overflow: hidden; 
    }

    .loading-status {
        color: #3b82f6;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 1.5rem;
        text-shadow: 0 0 10px #3b82f6;
    }

    /*Appearance of the logo at the top*/
    .glitch-text {
        font-family: 'Chakra Petch', sans-serif;     
        font-size: clamp(2rem, 3vw, 4.5rem); 
        color: #3b82f6;
        margin-bottom: clamp(10px, 2vh, 30px);
        text-shadow: 0 0 10px rgba(59, 130, 246, 0.6); 
        text-align: center;
        letter-spacing: 2px;
    }
</style>