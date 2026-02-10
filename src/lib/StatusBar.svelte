
<script>
    let { health = 2, fuel = 3 } = $props();
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
</div>

<style>
    .status-bar {position: absolute; top: 2vh; right: 20vw; display: flex; flex-direction: column;
    gap: 2vh; background: rgba(40, 38, 38, 0.8); padding: 15px; border: 1px solid rgba(59, 130, 246, 0.3);
    clip-path: polygon(0 0, 100% 0, 100% 100%, 30px 100%, 0 calc(100% - 30px));
    z-index: 100; width: 18vw; min-width: 220px;
    }

    .stat-group {display: flex;flex-direction: column;align-items: flex-end;gap: 5px;}

    .stat-label {font-family: 'Chakra Petch', sans-serif;font-size: 25px;color: #abbbd1;letter-spacing: 1px;}

    .icons {display: flex;gap: 8px;}

    .stat-icon {width: 4vw;height: 4vh;object-fit: contain;filter: drop-shadow(0 0 5px rgba(59, 130, 246, 0.5));}

    .stat-icon.fuel {filter: drop-shadow(0 0 5px rgba(234, 179, 8, 0.5));}
</style>