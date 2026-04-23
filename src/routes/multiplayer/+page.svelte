<script>
    import HexMap from '$lib/+map.svelte';
    import { socket } from '$lib/gameStore';

    // Trigger explosion sound effects on successful hits
    $effect(() => {
        if ($socket) {
            const handleStrikeResult = (data) => {
                if (data.hit) {
                    const sfx = new Audio('/explosion.wav');
                    sfx.volume = 0.6;
                    sfx.play().catch(e => console.log("SFX play prevented:", e));
                }
            };
            $socket.on('strike_result', handleStrikeResult);
            return () => $socket.off('strike_result', handleStrikeResult);
        }
    });
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
    user-select: none;
    -webkit-user-select: none; 
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