<script>
    import HexMap from '$lib/+map.svelte';
</script>

<div class="page-content">
  <h1 class="glitch-text">FIND, FIX, & FINISH</h1>
  
  <div class="map-container">
    <HexMap />
  </div>
</div>

<style>
  .page-content {
    display: flex;
    flex-direction: column;
    align-items: center; /* This horizontally centers the glitch text and the map container */
    
    /* Use clamp for padding so it doesn't push the map off-screen on short monitors */
    padding-top: clamp(10px, 2vh, 40px);
    
    width: 100vw;
    height: 100vh;
    box-sizing: border-box;
    overflow: hidden; /* Prevents scrollbars from appearing */
    
    user-select: none; 
    -webkit-user-select: none; 
  }

  .map-container {
    /* 1. Fluid scaling for the container */
    width: clamp(300px, 75vw, 1100px);   
    height: clamp(400px, 65vh, 800px);  
    
    /* 2. Center the <HexMap /> INSIDE this box */
    display: flex;
    justify-content: center;
    align-items: center;
    
    /* 3. Tactical Themeing */
    background: rgba(10, 15, 30, 0.6); /* Slight dark blue/black tint */
    border: 1px solid rgba(59, 130, 246, 0.4); /* Faint blue border instead of #333 */
    box-shadow: 0 0 30px rgba(0, 0, 0, 0.8), 0 0 15px rgba(59, 130, 246, 0.1) inset;
    
    border-radius: 8px; /* Optional: slight rounding for a polished screen look */
    overflow: hidden; /* Ensures the hex map doesn't bleed out of the box */
  }

  .glitch-text {
    font-family: 'Chakra Petch', sans-serif;
    
    /* Replaced rigid 7vh with fluid clamp so it scales well on all devices */
    font-size: clamp(2rem, 3vw, 4.5rem); 
    
    color: #3b82f6;
    margin-bottom: clamp(10px, 2vh, 30px);
    text-shadow: 0 0 10px rgba(59, 130, 246, 0.6); /* Adds a nice glow */
    text-align: center;
    letter-spacing: 2px;
  }
</style>