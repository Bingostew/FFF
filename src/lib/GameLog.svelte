<script>
    let { logs = [] } = $props();
    let isOpen = $state(false);
    let logContainer;

    // Auto-scroll to bottom whenever logs change
    $effect(() => {
        if (logs.length && logContainer) {
            // Small timeout ensures the DOM has updated before scrolling
            setTimeout(() => {
                logContainer.scrollTop = logContainer.scrollHeight;
            }, 10);
        }
    });

    function toggleLog() {
        isOpen = !isOpen;
    }
</script>

<div class="log-wrapper" class:open={isOpen}>
    <button class="toggle-btn" onclick={toggleLog}>
        <span class="icon">{isOpen ? '▶' : '◀'}</span>
        <span class="text">COMBAT LOG</span>
    </button>

    <div class="log-panel">
        <div class="log-header">ACTION FEED</div>
        <div class="log-content" bind:this={logContainer}>
            {#if logs.length === 0}
                <div class="empty-log">AWAITING ORDERS...</div>
            {/if}
            
            {#each logs as log}
                <div class="log-entry {log.type}">
                    <span class="timestamp">[{log.time}]</span>
                    <span class="message">{log.message}</span>
                </div>
            {/each}
        </div>
    </div>
</div>

<style>
    .log-wrapper {
        position: absolute;
        top: 20%;
        right: -300px; /* Hidden off-screen by default */
        width: 300px;
        height: 60%;
        display: flex;
        align-items: flex-start;
        z-index: 1000;
        transition: right 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        font-family: 'Chakra Petch', sans-serif;
    }

    .log-wrapper.open {
        right: 0; /* Slides in */
    }

    .toggle-btn {
        position: absolute;
        left: -40px; /* Sticks out to the left of the panel */
        top: 20px;
        width: 40px;
        height: 120px;
        background: rgba(15, 20, 30, 0.95);
        border: 1px solid #3b82f6;
        border-right: none;
        color: #3b82f6;
        cursor: none;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        border-radius: 8px 0 0 8px;
        box-shadow: -5px 0 15px rgba(0,0,0,0.5);
    }

    .toggle-btn:hover {
        background: rgba(59, 130, 246, 0.2);
        color: white;
    }

    .toggle-btn .text {
        writing-mode: vertical-rl;
        text-orientation: mixed;
        transform: rotate(180deg);
        letter-spacing: 2px;
        font-weight: bold;
        margin-top: 10px;
    }

    .log-panel {
        width: 100%;
        height: 100%;
        background: rgba(10, 15, 30, 0.95);
        border: 1px solid #3b82f6;
        border-right: none;
        display: flex;
        flex-direction: column;
        box-shadow: -5px 0 20px rgba(0,0,0,0.7);
    }

    .log-header {
        padding: 10px;
        background: rgba(59, 130, 246, 0.2);
        color: #3b82f6;
        font-weight: bold;
        text-align: center;
        border-bottom: 1px solid #3b82f6;
        letter-spacing: 2px;
    }

    .log-content {
        flex: 1;
        overflow-y: auto;
        padding: 10px;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    /* Custom Scrollbar for the log */
    .log-content::-webkit-scrollbar { width: 6px; }
    .log-content::-webkit-scrollbar-track { background: rgba(0,0,0,0.2); }
    .log-content::-webkit-scrollbar-thumb { background: #3b82f6; border-radius: 3px; }

    .empty-log {
        color: #abbbd1;
        opacity: 0.5;
        text-align: center;
        margin-top: 20px;
        font-style: italic;
    }

    .log-entry {
        font-size: 0.85rem;
        line-height: 1.4;
        padding: 4px;
        border-left: 2px solid transparent;
        background: rgba(255,255,255,0.02);
    }

    .timestamp {
        color: #64748b;
        margin-right: 5px;
        font-size: 0.75rem;
    }

    /* Color coding based on who took the action */
    .log-entry.player { border-left-color: #3b82f6; }
    .log-entry.player .message { color: #93c5fd; }

    .log-entry.enemy { border-left-color: #e24a4a; }
    .log-entry.enemy .message { color: #fca5a5; }

    .log-entry.system { border-left-color: #eab308; }
    .log-entry.system .message { color: #fde047; }
    
    .log-entry.success { border-left-color: #4ade80; }
    .log-entry.success .message { color: #86efac; font-weight: bold; }
</style>