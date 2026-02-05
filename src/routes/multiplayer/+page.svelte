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
    align-items: center;
    padding-top: 2vh;
    width: 100%;
    height: 100%;
  }

  .map-container {
    width: 70vw;   
    height: 80vh;  
    border: 1px solid #333;
    background: rgba(0, 0, 0, 0.5); 
  }

  .glitch-text {
    font-family: 'Chakra Petch', sans-serif;
    font-size: 7vh;
    color: #3b82f6;
    margin-bottom: 2vh;
  }
</style>