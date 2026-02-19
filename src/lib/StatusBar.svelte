<script>
    let { health = 2, fuel = 3 } = $props();

    function move(){
        fuel -= 1
    }

    function damage(){
        health -= 1
    }
</script>

<div class="status-bar">
    <div class="stat-group">
        <span class="stat-label">HEALTH</span>
        <div class="icons">
            {#each Array(health) as _}
                <img src="/blue_damage.png" alt="health" class="stat-icon" />
            {/each}
        </div>
    </div>
    
    <div class="stat-group">
        <span class="stat-label">FUEL</span>
        <div class="icons">
            {#each Array(fuel) as _}
                <img src="/fuel.png" alt="fuel" class="stat-icon fuel" />
            {/each}
        </div>
    </div>

    <div class="button-group">
                <button 
                    style="margin-top: 20px; border-color: #e24a4a; color: #e24a4a;"
                    onclick={() => {/*isSubmitted = true;*/ move()}}
                   >
                <span class="btn-text">TEST MOVE</span>
                </button>
                <button 
                    style="margin-top: 20px; border-color: #e24a4a; color: #e24a4a;"
                    onclick={() => {/*isSubmitted = true;*/ damage()}}
                   >
                <span class="btn-text">TEST DAMAGE</span>
                </button>
    </div>


</div>

<style>
    .status-bar {
        position: absolute;
        top: 2vh; 
        right: 20vw; /* Adjust this value if you need to slide it further left/right */
        display: flex; 
        flex-direction: column;
        gap: 2vh; 
        background: rgba(0, 0, 0, 0); /* Matched to sidebar dark aesthetic */
        padding: 1vw; /* Matched padding to sidebar */
        /*border: 1px solid rgba(59, 130, 246, 0.3);*/
        /* Matched exactly to the sidebar's button/panel clip-path */
        clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
        z-index: 100; 
        width: 13vw; /* Adjusted from 18vw to closely match sidebar width */
        min-width: 200px;
    }

    .stat-group {
        display: flex;
        flex-direction: column;
        align-items: center; /* Changed to left-align to match sidebar text flow */
        gap: 5px;
    }

    .stat-label {
        font-family: 'Chakra Petch', sans-serif;
        font-size: 3vh; /* Standardized to match the roll-label size */
        color: #abbbd1;
        letter-spacing: 2px; /* Matched letter spacing */
        font-weight: 700;
    }

    .icons {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
    }

    .stat-icon {
        width: 5vw; /* Scaled down slightly to fit the new layout better */
        height: auto;
        object-fit: contain;
        filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));
    }

    .stat-icon.fuel {
        filter: drop-shadow(0 0 5px rgba(234, 179, 8, 0.5));
    }
</style>