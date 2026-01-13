<script>
  import { Spring } from 'svelte/motion';
  import { isHovering } from '$lib/store'; // Import the shared state
  import { page } from '$app/stores';

  // Cursor Physics
  const coords = new Spring({ x: 0, y: 0 }, { stiffness: 0.1, damping: 0.25 });
  const size = new Spring(4, { stiffness: 0.2, damping: 0.4 });

  // Update cursor position
  /**
     * @param {{ clientX: any; clientY: any; }} e
     */
  function handleMove(e) {
    coords.target = { x: e.clientX, y: e.clientY };
  }

  // React to the shared 'isHovering' store
  // We subscribe to the store value
  $effect(() => {
    size.target = $isHovering ? 8 : 4;
  });
</script>

<svelte:window onmousemove={handleMove} />

<div 
  class="custom-cursor {$isHovering ? 'active' : ''}" 
  style="
    transform: translate({coords.current.x}px, {coords.current.y}px);
    width: {size.current}vh;
    height: {size.current}vh;
  "
>
  <div class="center-dot"></div>
</div>

<div class="global-background"></div>

{#if $page.url.pathname !== '/'}
  <a href="/" 
     class="return-btn"
     onmouseenter={() => $isHovering = true} 
     onmouseleave={() => $isHovering = false}
  >
    [ RETURN TO BASE ]
  </a>
{/if}

<main>
  <slot />
</main>

<style>
  /* Import Fonts Globally */
  @import url('https://fonts.googleapis.com/css2?family=Black+Ops+One&family=Chakra+Petch:wght@400;700&display=swap');

  :global(body) {
    cursor: none;
    background-color: #000;
    margin: 0;
    overflow: hidden;
    width: 100vw;
    height: 100vh;
    font-family: 'Chakra Petch', sans-serif;
  }

  /* --- GLOBAL BACKGROUND --- */
  .global-background {
    position: fixed;
    top: 0; 
    left: 0; 
    width: 100vw; 
    height: 100vh;
    z-index: -1; /* Send to back */
    background-color: #000;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='56' height='100'%3E%3Cpath fill='none' stroke='%232a2a2a' stroke-width='1' d='M28 66L0 50L0 16L28 0L56 16L56 50L28 66L28 100'/%3E%3Cpath fill='none' stroke='%232a2a2a' stroke-width='1' d='M28 0L28 34L0 50L0 84L28 100L56 84L56 50L28 34'/%3E%3C/svg%3E");
    background-repeat: repeat;
    background-size: 11.2vh 20vh;
  }

  /* --- RETURN BUTTON --- */
  .return-btn {
  position: fixed;
  top: 40px;
  left: 40px;
  z-index: 100;
  font-family: 'Chakra Petch', sans-serif;
  font-weight: 700;
  font-size: 2.5vh;
  color: #abbbd1;
  text-decoration: none;
  
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 10px 20px;
  background: rgba(0, 0, 0, 0.8);
  
  transition: all 0.2s ease;
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  }

  .return-btn:hover {
    color: #fff;
    background: rgba(59, 130, 246, 0.2);
    border-color: #3b82f6;
    text-shadow: 0 0 10px #3b82f6;
    transform: translateX(5px); /* Slide slightly right */
  }

  /* --- CURSOR --- */
  .custom-cursor {
    position: fixed; 
    top: 0; 
    left: 0; 
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
    width: 0.4vh; 
    height: 0.4vh; 
    background-color: white; 
    border-radius: 50%;
  }
  .custom-cursor.active { 
    border-color: #e24a4a; 
    background-color: rgba(255, 62, 62, 0.1); 
  }
</style>