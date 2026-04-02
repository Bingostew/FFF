<script>
    let imageUrl = "/Find-Fix-and-Finish-2.jpg"; 

    // Store your paragraph text here
    let missionText = "Find, Fix, Finish is a capstone project designed by CNA and developed by 5 midshipmen from the United States Naval Academy. Midshipmen developers are listed below, and designer notes and credits can be found in the image to the right.";
    
    // Split the text into an array of words
    let words = missionText.split(" ");
</script>

<div class="split-container">
    
    <div class="left-pane">
        <div class="content-wrapper">
            <h1 class="typewriter" style="--delay: 0.2s; --duration: 1s;">FIND FIX FINISH CREDITS</h1>
            
            <h2 class="typewriter" style="--delay: 1.2s; --duration: 1s;"><a href="https://www.cna.org/centers-and-divisions/cna/ow/gaming-and-integration" target="_blank">Center for Naval Analyses</a></h2>
            
            <p class="animated-paragraph">
                {#each words as word, i}
                    <span class="word" style="--delay: {2.2 + (i * 0.08)}s">{word}</span>
                {/each}
            </p>
            
            <ul>
                <li class="typewriter" style="--delay: 5.2s; --duration: 0.5s;"><strong>Developer 1: </strong> MIDN Tristen Alvis</li>
                <li class="typewriter" style="--delay: 5.7s; --duration: 0.5s;"><strong>Developer 2: </strong> MIDN Johnson Ampofo</li>
                <li class="typewriter" style="--delay: 6.2s; --duration: 0.5s;"><strong>Developer 3: </strong> MIDN Ana Gafton</li>
                <li class="typewriter" style="--delay: 6.7s; --duration: 0.5s;"><strong>Developer 4: </strong> MIDN Ziming Huang</li>
                <li class="typewriter" style="--delay: 7.2s; --duration: 0.5s;"><strong>Developer 5: </strong> MIDN Nick Smith</li>
            </ul>
        </div>
    </div>

    <div class="right-pane">
        <img src={imageUrl} alt="Mission Objective" class="intel-image boot-up" />
    </div>

</div>

<style>
    a:link, a:visited, a:hover, a:active {
    color: #fff;
    text-decoration: none; /* Optional: removes the default underline */
    }

    /* --- LAYOUT STYLES --- */
    .split-container {
        display: flex;
        width: 100vw;
        height: 100vh;
        color: #abbbd1;
        font-family: 'Chakra Petch', sans-serif;
        overflow: hidden;
    }

    .left-pane {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 2rem;
        box-sizing: border-box;
    }

    .content-wrapper {
        max-width: 800px;
        width: 100%;
    }

    .right-pane {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        border-left: 2px solid #3b82f6;
        padding: 2rem;
        box-sizing: border-box;
    }

    .intel-image {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    /* Text Polish */
    h1 {
        color: #3b82f6;
        font-size: clamp(1.5rem, 3.5vw, 4rem);
        margin-bottom: 0.5rem;
        text-shadow: 0 0 10px rgba(59, 130, 246, 0.3);
        white-space: nowrap; /* Ensures the title stays on one line */
    }

    h2 { 
      color: #fff; 
      font-size: 2.2rem;
      margin-bottom: 2rem; 
    }
    
    p, li { 
        font-size: clamp(1.2rem, 2vw, 1.6rem); 
        line-height: 1.6; 
        margin-bottom: 1rem; 
    }

    /* --- THE UNIFIED TYPEWRITER EFFECT --- */
    .typewriter {
        clip-path: inset(0 100% 0 0);
        animation: wipeReveal var(--duration, 1s) linear forwards;
        animation-delay: var(--delay, 0s);
    }

    @keyframes wipeReveal {
        to { clip-path: inset(0 0 0 0); }
    }

    /* --- THE IMAGE BOOT-UP EFFECT --- */
    .boot-up {
        opacity: 0;
        filter: brightness(2) contrast(1.5) blur(5px);
        animation: bootUpAnim 1.5s ease-out forwards;
        animation-delay: 0.2s;
    }

    @keyframes bootUpAnim {
        to {
            opacity: .8;
            filter: brightness(1) contrast(1) blur(0);
        }
    }

    /* 1. Ensure the paragraph is allowed to wrap */
    .animated-paragraph {
        white-space: normal; /* Forces text to drop to a new line when it hits the edge */
        margin-bottom: 2rem;
    }

    /* 2. The Word Fix */
    .word {
        opacity: 0; 
        animation: typeWord 0.01s forwards;
        animation-delay: var(--delay);
        
        /* THE MAGIC: inline-block treats each word like a tiny, unbreakable box */
        display: inline-block; 
        
        /* This guarantees a perfect mathematical space between every word */
        margin-right: 0.35rem; 
    }

    @keyframes typeWord {
        to { opacity: 1; } 
    }
</style>