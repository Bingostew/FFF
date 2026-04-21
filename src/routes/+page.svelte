<!--MAIN MENU PAGE-->
<!--SCRIPTS FOR MAIN MENU PAGE-->
<script>
  import { isHovering } from '$lib/store';
  import { goto } from '$app/navigation';
  import { initSocket, gameId, socket, playerName, isMultiplayer } from '$lib/gameStore';
  import { PUBLIC_SERVER_URL, PUBLIC_SERVER_PORT } from '$env/static/public';
  import { onMount } from 'svelte';

  let showMultiplayerModal = $state(false);
  let showSingleplayerModal = $state(false);
  let nickname = $state('');
  let lobbyCode = $state('');
  let dotCount = $state(0);
  let serverError = $state('');
  let dots = $derived('.'.repeat(dotCount));
  const PORT = PUBLIC_SERVER_PORT
  /** 0 = Name Input, 1 = Selection, 2 = Create Lobby, 3 = Join Lobby; multiplayer
   * 0 = Name Input, 1 = Start Game; Singleplayer
  */ 
  let modalStep = $state(0);
  let mapList = $state([]);
  let selectedMap = $state('');

  onMount(() => {
      initSocket();
  });

  
  

  /*****************FRONTEND METHODS******************/
  /** * @param {String} gamemode 
   * Modal chooses between showing the singleplayer or multiplayer information. 
  */
  function toggleModal(gamemode) {
    // Update the state based on the button clicked
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
      
    //Reset modal data
    setTimeout(() => {
      modalStep = 0;
      nickname = '';
      lobbyCode = '';
      selectedMap = '';
      }, 200);
      return
    }
  }

  $effect(() => {
    if (!$socket) return;

    const handleRoomUpdate = ({ players, map }) => {
        if (Object.keys(players).length === 2) {
          let url = "/multiplayer";
          if (map) url += `?map=${encodeURIComponent(map)}`;
          goto(url);
        }
      };

    const handleError = (msg) => {
      serverError = msg;
    };

    $socket.on("room_update", handleRoomUpdate);
    $socket.on("error", handleError);
   return () => {
      $socket.off("room_update", handleRoomUpdate);
      $socket.off("error", handleError);
    };
  });

  $effect(() => {
    if (modalStep === 2) {
      const interval = setInterval(() => {
        dotCount = (dotCount + 1) % 4;
      }, 500);
      return () => clearInterval(interval);
    } else {
      dotCount = 0; 
    }
  });

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

  /** Confirms the nickname for the player*/
  function confirmName() {
    if (nickname.trim().length > 0){
        modalStep = 1;
        playerName.set(nickname);
        }
    }

  /*****************BACKEND METHODS******************/
  /**
   * Sends a POST request to the server to create a multiplayer lobby.
   */
  async function goToCreate() {
    try {
      isMultiplayer.set(true);
      modalStep = 2;
      const payload = selectedMap ? { map: selectedMap.replace('.json', '') } : {};
      const res = await fetch(`${PUBLIC_SERVER_URL}/create-lobby`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      lobbyCode = data.gameId;

      gameId.set(lobbyCode);
      $socket.emit('join_game', {gameId: lobbyCode, playerName: nickname});
    } catch (e) {
      console.error("Failed to create lobby", e);
    }
  }

  async function fetchMaps() {
    try {
      const res = await fetch(`http://${window.location.hostname}:${PORT}/list-maps`);
      if (res.ok) {
        mapList = await res.json();
        modalStep = 4; // Map selection step
      }
    } catch (e) {
      console.error("Failed to fetch maps", e);
    }
  }

  /**
   * Helps for TESTING. Navigates to the singleplayer page, method made for
   * ease of singleplayer testing. However server may not be needed for singleplayer. 
   */
  function goToGame() {
    let url = '/singleplayer';
    if (selectedMap) {
      url += `?map=${encodeURIComponent(selectedMap.replace('.json', ''))}`;
    }
    goto(url);
  }

  /**
   * Changes the modal to 3 in order to support multiplayer join lobby functionality. 
   */
  function goToJoin() {
    modalStep = 3;
    serverError = '';
  }
  
  /**
   * Sends API request using the lobby code and nickname to join another multiplayer 
   * lobby. 
   */
  function connect(){
    isMultiplayer.set(true);
    gameId.set(lobbyCode);

    $socket.emit('join_game', {gameId: lobbyCode, playerName: nickname});
    //$socket.onAny((eventName, ...args) => {
    //alert(`[SOCKET INBOUND] Event: ${eventName} and ${args}`);
    }
  
  

  /**
   * Revert Modal Step by one. 
   */
  function goBack() {
    if (modalStep > 1) modalStep = 1;
    else modalStep = 0;
  }
</script>

<!--PAGE HTML-->
<!--Describes the "look" of the main menu-->
<div class="mainmenu-container">

  <!--Main menu logo for Find, Fix, & Finish-->
  <div class="logo">
    FIND
    <span class="logo-text2">, FIX, &</span>
    <span class="logo-text1"> FINISH</span>
  </div>

  <!--Clickable links for the different parts of the game-->
  <ul class="menu-links">
    <li>
        <a 
            href="/singleplayer"
            class ="select-link"
            draggable="false"
            onclick={(e) => { openSingleplayerModal(e); $isHovering = false; }}
            onmouseenter={() => $isHovering = true}
            onmouseleave={() => $isHovering = false}
        >
            SINGLEPLAYER
        </a>
    </li>

    <li>
        <a 
            href="/multiplayer"
            class ="select-link"
            draggable="false" 
            onclick={(e) => { openMultiplayerModal(e); $isHovering = false; }} 
            onmouseenter={() => $isHovering = true} 
            onmouseleave={() => $isHovering = false}
        >
            MULTIPLAYER
        </a>
    </li>    

    <li>
        <a 
            href="/map-editor"
            class ="select-link"
            draggable="false" 
            onclick={(e) => { $isHovering = false; }} 
            onmouseenter={() => $isHovering = true} 
            onmouseleave={() => $isHovering = false}
        >
            MAP EDITOR
        </a>
    </li>   

    <li>
        <a 
            href="/tutorial"
            class ="select-link"
            draggable="false" 
            onclick={() => $isHovering = false}
            onmouseenter={() => $isHovering = true} 
            onmouseleave={() => $isHovering = false}
        >
            TUTORIAL
        </a>
    </li>

    <li>
        <a 
            href="/credits"
            class ="select-link"
            draggable="false" 
            onclick={() => $isHovering = false}
            onmouseenter={() => $isHovering = true} 
            onmouseleave={() => $isHovering = false}
        >
            CREDITS
        </a>
    </li>
  </ul>

  <!--Singplayer Modal-->
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
                      spellcheck="false"
                      autocomplete="off"
                      autocorrect="off"
                      autocapitalize="off"
                  />

                  <div class="button-group" role="group">
                      <button 
                          class="action-btn" 
                          draggable="false"
                          onclick={() => { confirmName(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CONFIRM
                      </button>
                      
                      <button 
                          class="close-btn" 
                          onclick={() => { toggleModal('close'); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CANCEL
                      </button>
                  </div>

              {:else if modalStep === 1}
                  <h2>WELCOME</h2>
                  
                  <div class="vertical-stack" role="group">
                      <button 
                          class="action-btn wide" 
                          onclick={() => { selectedMap = ''; goToGame(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          START (DEFAULT MAP)
                      </button>
                      <button 
                          class="action-btn wide" 
                          onclick={() => { fetchMaps(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CHOOSE CUSTOM MAP
                      </button>
                  </div>
                  
                  <button 
                      class="close-btn" 
                      onclick={() => { goBack(); $isHovering = false; }} 
                      onmouseenter={() => $isHovering = true}
                      onmouseleave={() => $isHovering = false}
                  >
                      &lt; BACK
                  </button>

              {:else if modalStep === 4}
                  <h2>SELECT OPERATION AREA</h2>
                  <div class="map-list-container">
                      {#if mapList.length > 0}
                          {#each mapList as map}
                              <button 
                                  class="action-btn wide map-btn" 
                                  onclick={() => { selectedMap = map; goToGame(); $isHovering = false; }}
                                  onmouseenter={() => $isHovering = true}
                                  onmouseleave={() => $isHovering = false}
                              >
                                  {map.replace('.json', '')}
                              </button>
                          {/each}
                      {:else}
                          <p class="status-text" style="font-size: 1rem;">NO CUSTOM MAPS DETECTED</p>
                      {/if}
                  </div>
                  <button 
                      class="close-btn" 
                      onclick={() => { modalStep = 1; $isHovering = false; }} 
                      onmouseenter={() => $isHovering = true}
                      onmouseleave={() => $isHovering = false}
                  >
                      &lt; BACK
                  </button>
              {/if}

          </div>
      </div>
  {/if}

  <!--Multiplayer Modal-->
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
                      maxlength="18"
                      spellcheck="false"
                      autocomplete="off"
                      autocorrect="off"
                      autocapitalize="off"
                  />

                  <div class="button-group" role="group">
                      <button 
                          class="action-btn" 
                          draggable="false"
                          onclick={() => { confirmName(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CONFIRM
                      </button>
                      
                      <button 
                          class="close-btn" 
                          onclick={() => { toggleModal('close'); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CANCEL
                      </button>
                  </div>

              {:else if modalStep === 1}
                  <h2>WELCOME</h2>
                  
                  <div class="vertical-stack" role="group">
                      <button 
                          class="action-btn wide" 
                          onclick={() => { selectedMap = ''; goToCreate(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CREATE (DEFAULT MAP)
                      </button>
                      
                      <button 
                          class="action-btn wide" 
                          onclick={() => { fetchMaps(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CHOOSE CUSTOM MAP
                      </button>
                      
                      <button 
                          class="action-btn wide" 
                          onclick={() => { goToJoin(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          JOIN LOBBY
                      </button>
                  </div>
                  
                  <button 
                      class="close-btn" 
                      onclick={() => { goBack(); $isHovering = false; }}
                      onmouseenter={() => $isHovering = true}
                      onmouseleave={() => $isHovering = false}
                  >
                      &lt; BACK
                  </button>
              
              {:else if modalStep === 4}
                  <h2>SELECT OPERATION AREA</h2>
                  <div class="map-list-container">
                      {#if mapList.length > 0}
                          {#each mapList as map}
                              <button 
                                  class="action-btn wide map-btn" 
                                  onclick={() => { selectedMap = map; goToCreate(); $isHovering = false; }}
                                  onmouseenter={() => $isHovering = true}
                                  onmouseleave={() => $isHovering = false}
                              >
                                  {map.replace('.json', '')}
                              </button>
                          {/each}
                      {:else}
                          <p class="status-text" style="font-size: 1rem;">NO CUSTOM MAPS DETECTED</p>
                      {/if}
                  </div>
                  <button 
                      class="close-btn" 
                      onclick={() => { modalStep = 1; $isHovering = false; }} 
                      onmouseenter={() => $isHovering = true}
                      onmouseleave={() => $isHovering = false}
                  >
                      &lt; BACK
                  </button>
              
              {:else if modalStep === 2}
                  <h2>LOBBY CREATED</h2>
                  <p class="status-text">{lobbyCode}</p>
                  
                  <p class="waiting-msg">
                    WAITING FOR OPPONENT<span class="dots">{dots}</span>
                  </p>
                  
                  <div class="button-group" role="group">
                      <button 
                          class="close-btn" 
                          draggable="false"
                          onclick={() => { toggleModal('close'); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CANCEL
                      </button>
                  </div>
              
              {:else if modalStep === 3}
                  <h2>JOIN GAME</h2>
                  
                  <input 
                      type="text" 
                      placeholder="ENTER LOBBY CODE..." 
                      bind:value={lobbyCode} 
                      class="tactical-input" 
                      maxlength="6"
                      spellcheck="false"
                      autocomplete="off"
                      autocorrect="off"
                      autocapitalize="off"
                      oninput={() => serverError = ''}
                  />

                  {#if serverError}
                    <p class="error-text">{serverError}</p>
                {/if}
                  
                  <div class="button-group" role="group">
                      <button 
                          class="action-btn" 
                          draggable="false"
                          onclick={() => { connect(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          CONNECT
                      </button>
                      
                      <button 
                          class="close-btn" 
                          onclick={() => { goBack(); $isHovering = false; }}
                          onmouseenter={() => $isHovering = true}
                          onmouseleave={() => $isHovering = false}
                      >
                          BACK
                      </button>
                  </div>
              {/if}

          </div>
      </div>
  {/if}

  <!--Main Menu images:CNA logo, CS Dept logo, background world map image-->
  <img src="/cna.png" alt="cna" class="cna-img" />
  <img src="/CS.png" alt="CS" class="CS-img" />
  <img src="/tacticalmap.jpg" alt="map" class="map-img" />
</div>

<!--PAGE HTML STYLES-->
<style>
    /*MODALS*/
    .map-list-container {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 10px;
        align-items: center;
        margin-top: 1rem;
        max-height: 30vh;
        overflow-y: auto;
    }

    .map-btn {
        font-size: clamp(0.8rem, 1.5vh, 1rem) !important;
        padding: 0.8rem !important;
    }

    /*Modal layout, provides a vertical look to the modal*/
    .vertical-stack { 
        display: flex; 
        flex-direction: column;
        gap: clamp(1rem, 2vh, 1.5rem);
        align-items: center;    
        margin-bottom: 1.5rem; 
        width: 100%;
    }

    /*Handles the input look for names and lobbies*/
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

    /*Gives a blue glow to the input box when selected*/
    .tactical-input:focus {
        box-shadow: 0 0 15px rgba(59, 130, 246, 0.6);
    }

    /*Placeholder to indicate to input a ship name*/ 
    .tactical-input::placeholder {
        color: #5a6b8c;
    }

    /*Background of the modal*/
    .modal-backdrop {
        position: fixed;
        top: 0; 
        left: 0; 
        width: 100vw; 
        height: 100vh;
        background: rgba(0, 0, 0, 0.85);
        backdrop-filter: blur(5px);
        z-index: 1000;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    /*Layout of the modal*/
    .modal-content {
        width: min(90%, 500px);
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
        width: 100%;
    }

    /*Back or Cancel button*/
    .close-btn {
        background: transparent;
        border: 1px solid #abbbd1;
        color: #abbbd1;
        padding: 0.8rem 2rem;
        font-size: clamp(0.9rem, 2.5vw, 1.1rem);
        font-family: 'Chakra Petch', sans-serif;
        cursor: none;
        transition: all 0.3s;
        white-space: nowrap;
    }

    /*How the back or cancel button responds when a user hovers over it*/
    .close-btn:hover {
        background: #3b82f6;
        color: #000;
        border-color: #3b82f6;
        box-shadow: 0 0 10px #3b82f6;
    }

    /*BUTTONS*/ 
    /*Handles layout of multiple buttons, specifically main menu*/ 
    .button-group {
        display: flex;
        gap: 1rem;
        justify-content: center;
        width: 100%;
    }

    /*Handles appearance of Modal buttons*/
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

    /*Reacts when a user hovers over the button*/
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

        user-select: text !important;
        -webkit-user-select: text !important;
        cursor: text; /* Changes cursor so user knows they can highlight */
        position: relative;
        z-index: 1010;
    }
  
    /* MAIN MENU */ 
    /*Layout for the Main Menu content, prevents zooming in and out, dragging, highlighting*/
    .mainmenu-container {
        position: relative;
        width: 100%;
        height: 100vh;
        padding: 1rem 2rem;
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: flex-start;
        user-select: none; 
        -webkit-user-select: none;
        z-index: 0; /* Ensures the -1 z-index map doesn't fall behind the page body */
        overflow: hidden; /* Prevents scrollbars from the oversized map image */
    }

    /*Menu link styles*/ 
    .menu-links { 
        display: flex; 
        flex-direction: column; 
        margin-top: clamp(20px, 5vh, 50px);
        gap: clamp(15px, 4vh, 40px);
        list-style: none; 
        padding: 0; 
    } 

    .select-link {
        font-family: 'Chakra Petch', sans-serif;
        color: #abbbd1; 
        text-decoration: none; 
        font-size: clamp(20px, 4vw, 50px); 
        cursor: none; 
        transition: color 0.8s;
    }

    .select-link:hover { 
        color: #3b82f6; 
        text-shadow: 0 0 10px #3b82f6; 
    }

    /* FF&F LOGO STYLES */
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

    /* CUSTOMER IMAGE STYLES */
    .cna-img {
        position: absolute; 
        top: 4vh; 
        right: 14vw;
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

    /* Background world map*/
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

    .waiting-msg {
        color: #3b82f6;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 1rem;
        letter-spacing: 2px;
        margin-bottom: 1rem;
        font-weight: bold;
    }

    .dots {
        display: inline-block;
        width: 30px; 
        text-align: left;
    }

    .error-text {
        color: #e24a4a;
        font-family: 'Chakra Petch', sans-serif;
        font-size: 0.9rem;
        font-weight: bold;
        margin-top: -1.5rem; 
        margin-bottom: 1.5rem;
        text-transform: uppercase;
        animation: shake 0.4s ease-in-out;
    }

    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        25% { transform: translateX(-5px); }
        75% { transform: translateX(5px); }
    }
</style>