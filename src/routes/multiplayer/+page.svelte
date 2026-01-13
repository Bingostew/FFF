<div class="page-content">
  <h1 class="section-header">GAMES</h1>
  
  <div class="server-grid">
    <div class="server-card online">
      <div class="card-header">
        <h3>US-EAST-1</h3>
        <span class="ping">24ms</span>
      </div>
      <div class="card-body">
        <p>STATUS: <span class="green">ONLINE</span></p>
        <p>POPULATION: 12/24</p>
      </div>
    </div>

    <div class="server-card offline">
      <div class="card-header">
        <h3>EU-WEST-1</h3>
        <span class="ping">--</span>
      </div>
      <div class="card-body">
        <p>STATUS: <span class="red">OFFLINE</span></p>
        <p>MAINTENANCE MODE</p>
      </div>
    </div>
  </div>
</div>

<style>
  .page-content { padding: 100px 50px; color: #fff; font-family: 'Chakra Petch', sans-serif; z-index: 10; position: relative; }
  .section-header { border-bottom: 2px solid #3b82f6; display: inline-block; margin-bottom: 2rem; font-size: 2rem; }
  
  .server-grid { display: flex; gap: 20px; flex-wrap: wrap; }
  
  .server-card {
    background: rgba(0, 0, 0, 0.7);
    border: 1px solid #333;
    width: 300px;
    padding: 1rem;
    clip-path: polygon(0 0, 100% 0, 100% 85%, 90% 100%, 0 100%);
  }
  
  .server-card.online { border-left: 4px solid #00ff00; }
  .server-card.offline { border-left: 4px solid #ff0000; opacity: 0.6; }
  
  .card-header { display: flex; justify-content: space-between; border-bottom: 1px solid #333; margin-bottom: 10px; }
  .green { color: #00ff00; }
  .red { color: #ff0000; }
</style>