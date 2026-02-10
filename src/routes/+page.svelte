<script>
  import { isHovering } from '$lib/store'; // Import shared state
  import { io } from "socket.io-client";
  import { goto } from '$app/navigation';

  let showMultiplayerModal = false; //Toggles multiplayer modal.
  let showSingleplayerModal = false; //Toggles singleplayer modal.

  let nickname = '';
  let lobbyCode = '';
  const socket = io();

  // 0 = Name Input, 1 = Selection, 2 = Create Lobby, 3 = Join Lobby
  let modalStep = 0;

  /** * @param {String} gamemode 
  */
  function toggleModal(gamemode) {
    // 1. Update the state based on the button clicked
    if (gamemode == 'singleplayer') {
      showSingleplayerModal = true;
      showMultiplayerModal = false; 
    }
    else if (gamemode == 'multiplayer') {
      showMultiplayerModal = true;
      showSingleplayerModal = false;
    }
    else if (gamemode == 'close') {
      showMultiplayerModal = false;
      showSingleplayerModal = false;
      
      //Reset data
      setTimeout(() => {
        modalStep = 0;
        nickname = '';
        lobbyCode = '';
      }, 200);
      return
    }
  }

  /**
   * @param {{ preventDefault: () => void; }} event
   * Opens a modal for the multiplayer experience. 
   */
  function openMultiplayerModal(event) {
    event.preventDefault();
    toggleModal('multiplayer'); //Toggles multiplayer modal to switch on. 
  }

  /**
   * @param {{ preventDefault: () => void; }} event
   * Opens a modal for the singleplayer experience.
   */
  function openSingleplayerModal(event) {
    event.preventDefault();
    toggleModal('singleplayer'); // Toggles singleplayer modal to switch on.
  }

  function confirmName() {
    if (nickname.trim().length > 0) modalStep = 1;
  }

  async function goToCreate() {
    try {
      const res = await fetch('/create-lobby', {method: 'POST'});
      const data = await res.json();
      lobbyCode = data.gameId;
      modalStep = 2;
    } catch (e) {
      console.error("Failed to create lobby", e);
    }
  }

  function goToGame() {
    goto('/singleplayer');
  }

  function goToJoin() {
    socket.emit('join_game', {lobbyCode, nickname});
    modalStep = 3;
  }
  
  function goBack() {
    // If in Create/Join, go back to Selection (1). If in Selection, go back to Name (0).
    if (modalStep > 1) modalStep = 1;
    else modalStep = 0;
  }
</script>

<div class="home-container">
  
  <div class="logo">
    FIND<span class="logo-teTUTORIALxt2">, FIX, &</span>
    <span class="logo-text1"> FINISH</span>
  </div>  

  <ul class="menu-links">
    <li>
      <a href="/singleplayer"
        onclick={openSingleplayerModal} 
        onmouseenter={() => $isHovering = true}
        onmouseleave={() => $isHovering = false}>
        SINGLEPLAYER</a></li>
    <li>
      <a href="/multiplayer" 
        onclick={openMultiplayerModal} 
        onmouseenter={() => $isHovering = true} 
        onmouseleave={() => $isHovering = false}>
        MULTIPLAYER
      </a></li>    
    <li>
      <a href="/tutorial" 
        onmouseenter={() => $isHovering = true} 
        onmouseleave={() => $isHovering = false}>
        TUTORIAL</a></li>
    <li>
      <a href="/credits" 
        onmouseenter={() => $isHovering = true} 
        onmouseleave={() => $isHovering = false}>
        CREDITS</a></li>
  </ul>


  {#if showSingleplayerModal}
    <div class="modal-backdrop">
      
      <div class="modal-content" role="document">
        {#if modalStep === 0}
          <h2>IDENTIFICATION</h2>
          
          <input 
            type="text" 
            placeholder="ENTER SHIP NAME..." 
            bind:value={nickname} 
            class="tactical-input"
            maxlength="18"
          />

          <div 
              class="button-group"
              role="group"
              onmouseenter={() => $isHovering = true}
              onmouseleave={() => $isHovering = false}
          >
              <button class="action-btn" onclick={confirmName}>CONFIRM</button>
              <button class="close-btn" onclick={() => toggleModal('close')}>CANCEL</button>
          </div>

        {:else if modalStep === 1}
          <h2>WELCOME, <span class="highlight">{nickname}</span></h2>
          
          <div class="vertical-stack">
            <button class="action-btn wide" onclick={goToGame}>START GAME</button>
          </div>
          
          <button class="close-btn" onclick={goBack}>&lt; BACK</button>
        {/if}

      </div>
    </div>
  {/if}

  {#if showMultiplayerModal}
    <div class="modal-backdrop">
      
      <div class="modal-content" role="document">
        {#if modalStep === 0}
          <h2>IDENTIFICATION</h2>
          
          <input 
            type="text" 
            placeholder="ENTER SHIP NAME..." 
            bind:value={nickname} 
            class="tactical-input"
            maxlength="12"
          />

          <div class="button-group">
            <button class="action-btn" onclick={confirmName}>CONFIRM</button>
            <button class="close-btn" onclick={() => toggleModal('close')}>CANCEL</button>
          </div>

        {:else if modalStep === 1}
          <h2>WELCOME, <span class="highlight">{nickname}</span></h2>
          
          <div class="vertical-stack">
            <button class="action-btn wide" onclick={goToCreate}>CREATE LOBBY</button>
            <button class="action-btn wide" onclick={goToJoin}>JOIN LOBBY</button>
          </div>
          
          <button class="close-btn" onclick={goBack}>&lt; BACK</button>
        
        {:else if modalStep === 2}
          <h2>LOBBY CREATED</h2>
          <p class="status-text">{lobbyCode}</p>
          
          <div class="button-group">
            <button class="close-btn" onclick={() => toggleModal('close')}>CANCEL</button>
            <button class="close-btn" onclick={goBack}>BACK</button>
          </div>
        
        {:else if modalStep === 3}
          <h2>JOIN GAME</h2>
          <input type="text" placeholder="ENTER LOBBY CODE..." bind:value={lobbyCode} class="tactical-input" maxlength="6"/>
          
          <div class="button-group">
            <button class="action-btn">CONNECT</button>
            <button class="close-btn" onclick={goBack}>BACK</button>
          </div>
        {/if}

      </div>
    </div>
  {/if}

  

  <img src="/cna.png" alt="cna" class="cna-img" />
  <img src="/CS.png" alt="CS" class="CS-img" />
  <img src="/tacticalmap.jpg" alt="map" class="map-img" />
</div>


<style>
  /* General layout styles, USE clamp for sizes so different window sizes scale properly. */
  .vertical-stack { 
    display: flex; 
    flex-direction: column;
    gap: clamp(1rem, 2vh, 1.5rem);
    align-items: center;    
    margin-bottom: 1.5rem; 
    width: 100%;
  }
  .tactical-input {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid #3b82f6;
    color: #fff;
    font-family: 'Chakra Petch', sans-serif;
    font-size: clamp(1rem, 2.5vw, 1.5rem);
    padding: 15px;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 2rem;
    text-align: center;
    outline: none;
    cursor: none;
    transition: box-shadow 0.3s;
  }
  .tactical-input:focus {
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
  }
  .tactical-input::placeholder {
    color: #5a6b8c;
  }
  .button-group {
    display: flex;
    gap: 1rem;
    justify-content: center;
    width: 100%;
  }
  .action-btn {
    background: #3b82f6;
    color: #000;
    border: 1px solid #3b82f6;
    padding: clamp(12px, 1.5vh, 20px) clamp(20px, 4vw, 50px);    
    font-family: 'Chakra Petch', sans-serif;
    font-size: clamp(0.9rem, 2vw, 1.2rem);
    font-weight: bold;
    cursor: none;
    transition: all 0.3s;
    white-space: nowrap;
  }
  .action-btn.wide { 
    width: 100%; 
    max-width: 500px;      
    display: block;
  }
  .action-btn:hover {
    background: #fff;
    box-shadow: 0 0 15px #fff;
  }
  .highlight {
    color: #fff;
    text-decoration: underline decoration-blue-500;
  }
  .status-text {
    color: #abbbd1;
    margin-bottom: 2rem;
    font-size: clamp(1.5rem, 4vw, 3rem);
    letter-spacing: 2px;
  }
  
  /* Modal styles */ 
  .modal-backdrop {
    position: fixed;
    top: 0; left: 0; width: 100vw; height: 100vh;
    background: rgba(0, 0, 0, 0.85);
    backdrop-filter: blur(5px);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .modal-content {
    width: min(90%, 500px);
    
    /* Add Sci-Fi Border & Background */
    background: rgba(10, 15, 30, 0.95);
    border: 1px solid #3b82f6;
    box-shadow: 0 0 30px rgba(59, 130, 246, 0.2);
    
    padding: clamp(20px, 5vw, 40px);
    
    display: flex;
    flex-direction: column;
    gap: 25px;
    text-align: center;
    align-items: center;
    justify-content: center;
    
    /* Corner Cut Effect */
    clip-path: polygon(
        20px 0, 100% 0, 
        100% calc(100% - 20px), calc(100% - 20px) 100%, 
        0 100%, 0 20px
    );
  }
  .modal-content h2 {
    font-size: clamp(1.5rem, 5vw, 2.5rem);
    margin-bottom: 2rem;
    color: #3b82f6;
    text-shadow: 0 0 5px #3b82f6;
    line-height: 1.2;
    width: 100%
  }
  .close-btn {
    background: transparent;
    border: 1px solid #abbbd1;
    color: #abbbd1;
    padding: 0.8rem 2rem;
    font-size: clamp(0.9rem, 2.5vw, 1.1rem);
    font-family: 'Chakra Petch', sans-serif;
    font-size: 2vh;
    cursor: none;
    transition: all 0.3s;
    white-space: nowrap;
  }
  .close-btn:hover {
    background: #3b82f6;
    color: #000;
    border-color: #3b82f6;
    box-shadow: 0 0 10px #3b82f6;
  }

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
    font-size: clamp(40px, 9vw, 100px);
    font-weight: bold; 
    color: #3b82f6;
    line-height: 1.2;
  }
  .logo-text1 { 
    color: #000; 
    -webkit-text-stroke: 3px #fff;
    }

  /* LINK STYLES */
  .menu-links { 
    display: flex; 
    flex-direction: column; 
    margin-top: clamp(20px, 5vh, 50px);
    gap: clamp(15px, 4vh, 40px);
    list-style: none; 
    padding: 0; 
  } 
  a {
    font-family: 'Chakra Petch', sans-serif;
    color: #abbbd1; 
    text-decoration: none; 
    font-size: clamp(20px, 4vw, 50px); 
    cursor: none; 
    transition: color 0.8s;
  }
  a:hover { 
    color: #3b82f6; 
    text-shadow: 0 0 10px #3b82f6; 
  }

  /* IMAGE STYLES */
  .cna-img {
    position: absolute; 
    top: 4vh; 
    right: 14vw;
    transform: none;
    width: clamp(60px, 12vh, 120px);
    height: auto; 
    z-index: 1; 
    opacity: 0.8; 
    filter: grayscale(100%) contrast(120%); 
    pointer-events: none;
  }
  .CS-img {
    position: absolute; 
    top: 4vh; 
    right: 4vw;
    width: clamp(60px, 12vh, 120px);    
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
    min-width: 100vw;
    min-height: 100vh;
    width: 110vmax;
    height: auto;
    z-index: -1;
    opacity: 0.35; 
    pointer-events: none;
  }
</style>