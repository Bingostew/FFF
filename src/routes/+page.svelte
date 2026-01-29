<script>
  import { isHovering } from '$lib/store'; // Import shared state
  import { io } from "socket.io-client";

  let showMultiplayerModal = false;

  let nickname = '';
  let lobbyCode = '';
  const socket = io();

  // 0 = Name Input, 1 = Selection, 2 = Create Lobby, 3 = Join Lobby
  let modalStep = 0;

  function toggleModal() {
    showMultiplayerModal = !showMultiplayerModal;

    if (!showMultiplayerModal) {
      setTimeout(() => {
        modalStep = 0;
        nickname = '';
        lobbyCode = '';
      }, 200);
    }
  }

  function openModal(event) {
    event.preventDefault();
    toggleModal();
  }

  function confirmName() {
    if (nickname.trim().length > 0) modalStep = 1;
  }

  async function goToCreate() {
    const res = await fetch('/create-lobby', {method: 'POST'});
    const data = await res.json();
    lobbyCode = data.gameId;
    modalStep = 2;
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
    FIND<span class="logo-text2">, FIX, &</span>
    <span class="logo-text1"> FINISH</span>
  </div>  

  <ul class="menu-links">
    <li><a href="/singleplayer" onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>SINGLEPLAYER</a></li>
    <li>
      <a href="/multiplayer" 
        onclick={openModal} 
        onmouseenter={() => $isHovering = true} 
        onmouseleave={() => $isHovering = false}>
        MULTIPLAYER
      </a>
    </li>    
    <li><a href="/tutorial" onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>TUTORIAL</a></li>
    <li><a href="/credits" onmouseenter={() => $isHovering = true} onmouseleave={() => $isHovering = false}>CREDITS</a></li>
  </ul>

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
          <button class="close-btn" onclick={toggleModal}>CANCEL</button>
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
            <button class="close-btn" onclick={toggleModal}>CLOSE</button>
            <button class="close-btn" onclick={goBack}>BACK</button>
          </div>
        
        {:else if modalStep === 3}
          <h2>JOIN FREQUENCY</h2>
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
  .vertical-stack { 
    display: flex; 
    flex-direction: column;
    gap: 1.5rem;           
    align-items: center;    
    margin-bottom: 1.5rem; 
    width: 100%;
  }



.tactical-input {
    background: rgba(0, 0, 0, 0.5);
    border: 1px solid #3b82f6;
    color: #fff;
    font-family: 'Chakra Petch', sans-serif;
    font-size: 2.5vh;
    padding: 10px;
    width: 80%;
    margin-bottom: 2rem;
    text-align: center;
    outline: none;
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
  }

  .action-btn {
    background: #3b82f6;
    color: #000;
    border: 1px solid #3b82f6;
    padding: 1rem 3rem;
    font-family: 'Chakra Petch', sans-serif;
    font-size: 2vh;
    font-weight: bold;
    cursor: pointer;
    transition: all 0.3s;
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
    font-size: 2vh;
    letter-spacing: 2px;
  }
  
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7); /* Dim the background */
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 100; /* Ensure it sits on top of everything */
    backdrop-filter: blur(4px); /* Optional: blur the map behind it */
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

  .close-btn {
    background: transparent;
    border: 1px solid #abbbd1;
    color: #abbbd1;
    padding: 0.5rem 2rem;
    font-family: 'Chakra Petch', sans-serif;
    font-size: 2vh;
    cursor: pointer; /* Or cursor: none if you are using custom cursor */
    transition: all 0.3s;
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