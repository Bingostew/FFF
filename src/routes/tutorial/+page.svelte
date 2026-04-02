

<img 
    src="/Find-Fix-and-Finish-1.jpg" 
    alt="Rules Reference" 
    class="floating-rules" 
/>

<style>
  .page-content { 
    padding: 100px 50px; 
    color: #fff; 
    font-family: 'Chakra Petch', sans-serif; 
    z-index: 10; 
    position: relative; 
    user-select: none; 
    -webkit-user-select: none;  
  }

  .section-header { 
    color: #3b82f6; 
    font-size: 2.5rem; 
  }

  .step { 
    margin-bottom: 30px; 
    border-left: 2px solid #555; 
    padding-left: 20px; 
    transition: border-color 0.3s; 
  }

  .step:hover { 
    border-color: #3b82f6; 
  }

  .floating-rules {
    /* 1. THE CENTERING MAGIC */
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      z-index: 1000;
      
      /* 2. THE DYNAMIC SIZING MAGIC */
      max-width: 85vw;  /* Never take up more than 85% of the screen width */
      max-height: 85vh; /* Never take up more than 85% of the screen height */
      width: auto;      /* Keeps the image proportions from getting stretched */
      height: auto;     /* Keeps the image proportions from getting squished */

      /* 3. VISUAL POLISH */
      opacity: 0.95; 
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8); /* Strong shadow to pop off the background */
      border-radius: 8px; /* Slightly rounds the corners of the image */
  }
      
</style>