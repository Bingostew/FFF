<script>
  import { Spring } from 'svelte/motion';
  // 1. Initialize the Spring Class
  // 'coords' will track the mouse position with physics
  const coords = new Spring(
    { x: 0, y: 0 }, 
    { stiffness: 0.1, damping: 0.25 }
  );

  // 'size' will track the circle diameter
  const size = new Spring(20, { stiffness: 0.2, damping: 0.4 });

  let isHovering = $state(false);

  // 2. Update the target when mouse moves
  // @ts-ignore
  function handleMove(e) {
    coords.target = { x: e.clientX, y: e.clientY };
  }

  // 3. React to hover state
  // We use an effect to sync the size Spring with the hover state
  $effect(() => {
    size.target = isHovering ? 50 : 20;
  });
</script>

<!-- svelte-ignore slot_element_deprecated -->
<svelte:window onmousemove={handleMove} />

<div 
  class="custom-cursor {isHovering ? 'active' : ''}" 
  style="
    transform: translate({coords.current.x}px, {coords.current.y}px);
    width: {size.current}px;
    height: {size.current}px;
  "
>
  <div class="center-dot"></div>
</div>

<nav>
  <div class="logo">
    FIND<span class="logo-text2">, FIX, &</span>
    <span class="logo-text1"> FINISH</span>
  </div>  
  <ul class="menu-links">
    <li><a href="/" onmouseenter={() => isHovering = true} onmouseleave={() => isHovering = false}>START GAME</a></li>
    <li><a href="/about" onmouseenter={() => isHovering = true} onmouseleave={() => isHovering = false}>SERVERS</a></li>
    <li><a href="/contact" onmouseenter={() => isHovering = true} onmouseleave={() => isHovering = false}>TUTORIAL</a></li>
    <li><a href="/contact" onmouseenter={() => isHovering = true} onmouseleave={() => isHovering = false}>ABOUT</a></li>
  </ul>
  <img src="/cna.png" alt="cna" class="cna-img" />
  <img src="/CS.png" alt="CS" class="CS-img" />
  <img src="/tacticalmap.jpg" alt="map" class="map-img" />
</nav>

<slot />

<style>
  :global(body) {
    cursor: none;
    background-color: #000;
    margin: 0;
    overflow-x: hidden;
  }

  /* Creates a custom dot reticle cursor */
  .custom-cursor {
    position: fixed;
    top: 0; 
    left: 0;
    /* Center the cursor visually on the coordinates */
    translate: -50% -50%; 
    
    pointer-events: none;
    z-index: 9999;
    border: 2px solid #3b82f6;
    border-radius: 50%;
    
    display: flex;
    justify-content: center;
    align-items: center;
    mix-blend-mode: difference;
  }

  .center-dot {
    width: 4px;
    height: 4px;
    background-color: white;
    border-radius: 50%;
  }

  /* Color change on active, when it hovers it changes */
  .custom-cursor.active {
    border-color: #e24a4a;
    background-color: rgba(255, 62, 62, 0.1);
  }

  .cna-img {
  position: absolute;  /* Allows free movement */
  top: 10%;            /* Move down 50% of screen */
  left: 80%;           /* Move right 50% of screen */
  transform: translate(-50%, -50%); /* Centers it perfectly */
  width: 100px;        /* Resize as needed */
  height: auto;        /* Maintains aspect ratio */
  z-index: 1;          /* 1 = Above background, but below text */
  opacity: 0.8;        /* Fade it out slightly so text is readable */
  filter: grayscale(100%) contrast(120%);
  pointer-events: none; /* Crucial: lets you click links THROUGH the image */
  }

  .CS-img {
  position: absolute;  /* Allows free movement */
  top: 10%;            /* Move down 50% of screen */
  left: 90%;           /* Move right 50% of screen */
  transform: translate(-50%, -50%); /* Centers it perfectly */
  width: 100px;        /* Resize as needed */
  height: auto;        /* Maintains aspect ratio */
  z-index: 1;          /* 1 = Above background, but below text */
  opacity: 0.8;        /* Fade it out slightly so text is readable */
  filter: grayscale(100%) contrast(120%);
  pointer-events: none; /* Crucial: lets you click links THROUGH the image */
  }

  .map-img {
  position: absolute;  /* Allows free movement */
  top: 60%;            /* Move down 50% of screen */
  left: 45%;           /* Move right 50% of screen */
  transform: translate(-50%, -50%); /* Centers it perfectly */
  width: 1500px;        /* Resize as needed */
  height: auto;        /* Maintains aspect ratio */
  z-index: 1;          /* 1 = Above background, but below text */
  opacity: 0.35;        /* Fade it out slightly so text is readable */
  /*filter: grayscale(100%) contrast(120%);*/
  pointer-events: none; /* Crucial: lets you click links THROUGH the image */
  }
  /* Nav Styles, main menu functionality */
  nav {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    padding: 1rem 2rem;
    background-color: #000;
	  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath fill='none' stroke='%232a2a2a' stroke-width='1' d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100'/%3E%3Cpath fill='none' stroke='%232a2a2a' stroke-width='1' d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34'/%3E%3C/svg%3E");
	  background-repeat: repeat;
	  background-size: 84px 150px;
    font-family: Arial, Helvetica, sans-serif;
    color: #fff;
    min-height: 75vh;
  }

  .logo { font-size: 4.5rem; font-weight: bold; color: #3b82f6;}
  .logo-text1 { color: #000; -webkit-text-stroke: 3px #fff; } 
  .logo-text2 { color: #a79d9d; }
  
  .menu-links {
    display: flex; flex-direction: column; gap: 50px; list-style: none; padding: 0;
  }
  a {
    color: #abbbd1; text-decoration: none; font-size: 3.0rem; cursor: none; transition: color 0.2s;
  }
  a:hover {
    color: #3b82f6; text-shadow: 0 0 10px #3b82f6;
  }
</style>