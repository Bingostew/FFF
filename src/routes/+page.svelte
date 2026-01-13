<script>
  import { isHovering } from '$lib/store'; // Import shared state
</script>

<div class="home-container">
  
  <div class="logo">
    FIND<span class="logo-text2">, FIX, &</span>
    <span class="logo-text1"> FINISH</span>
  </div>  

  <ul class="menu-links">
    <li><a href="/singleplayer" onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>SINGLEPLAYER</a></li>
    <li><a href="/multiplayer" onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>MULTIPLAYER</a></li>
    <li><a href="/tutorial" onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>TUTORIAL</a></li>
    <li><a href="/credits" onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>CREDITS</a></li>
  </ul>

  <img src="/cna.png" alt="cna" class="cna-img" />
  <img src="/CS.png" alt="CS" class="CS-img" />
  <img src="/tacticalmap.jpg" alt="map" class="map-img" />

</div>

<style>
  /* Layout for the Home Page content */
  .home-container {
    position: relative;
    width: 100%;
    height: 100vh;
    padding: 1rem 2rem;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
  }

  /* LOGO STYLES */
  .logo { 
    font-family: 'Chakra Petch', sans-serif;
    font-size: 10vh; 
    font-weight: bold; 
    color: #3b82f6;
    line-height: 2;
  }
  .logo-text1 { 
    color: #000; 
    -webkit-text-stroke: 3px #fff;
    } 
  .logo-text2 { 
    color: #a79d9d; 
    }

  /* LINK STYLES */
  .menu-links { 
    display: flex; 
    flex-direction: column; 
    margin-top: 5vh;
    gap: 6vh; 
    list-style: none; 
    padding: 0; 
  }
  
  a {
    font-family: 'Chakra Petch', sans-serif;
    color: #abbbd1; 
    text-decoration: none; 
    font-size: 5vh; 
    cursor: none; 
    transition: color 0.8s;
  }
  a:hover { color: #3b82f6; text-shadow: 0 0 10px #3b82f6; }

  /* IMAGE STYLES */
  .cna-img {
    position: absolute; 
    top: 10%; 
    left: 80%; 
    transform: translate(-50%, -50%);
    width: 12vh;
    height: auto; 
    z-index: 1; 
    opacity: 0.8; 
    filter: grayscale(100%) contrast(120%); 
    pointer-events: none;
  }

  .CS-img {
    position: absolute; 
    top: 10%; 
    left: 90%; 
    transform: translate(-50%, -50%);
    width: 12vh;    
    height: auto; 
    z-index: 1; 
    opacity: 0.8; 
    filter: grayscale(100%) contrast(120%); 
    pointer-events: none;
  }

  .map-img {
    position: absolute; 
    top: 50%; 
    left: 50%; 
    transform: translate(-50%, -50%);
    width: 130vw;
    height: auto;
    z-index: -1;
    opacity: 0.35; 
    pointer-events: none;
  }
</style>