// tests/gameIntegration.test.js

const { createServer } = require("http");
const { Server } = require('socket.io');
const Client = require("socket.io-client");
const socketHandler = require("../server/socketHandler"); // Point this to your actual file

describe("Socket Handler Integration", () => {
  let io, serverSocket, clientSocket, httpServer;
  let lobbies = {}; // We simulate the in-memory database here

  // 1. SETUP: Spin up a real server before tests start
  beforeAll((done) => {
    httpServer = createServer();
    io = new Server(httpServer);
    
    // ATTACH YOUR EXISTING HANDLER
    // We pass our local 'lobbies' object so we can inspect it during tests
    socketHandler(io, lobbies);

    httpServer.listen(() => {
      const port = httpServer.address().port;
      clientSocket = new Client(`http://localhost:${port}`);
      
      io.on("connection", (socket) => {
        serverSocket = socket;
      });
      
      clientSocket.on("connect", done);
    });
  });

  // 2. TEARDOWN: Close connections after tests
  afterAll(() => {
    io.close();
    clientSocket.close();
    httpServer.close();
  });

  // 3. RESET: Clear lobbies between tests
  beforeEach(() => {
    for (const key in lobbies) delete lobbies[key];
  });

  // --- TEST CASES ---

  test("Client can create and join a lobby", (done) => {
    const gameId = "test_game_1";
    
    // Manually create the lobby since your handler expects it to exist
    lobbies[gameId] = { 
        players: {}, 
        status: 'waiting',
        fleets: {}, 
        history: [] 
    };

    clientSocket.emit("join_game", { gameId, playerName: "Commander Shepard" });

    // Listen for the success response
    clientSocket.on("room_update", (data) => {
      try {
        expect(data.status).toBe("waiting");
        // Verify the player was actually added to the 'database'
        const playerIds = Object.keys(lobbies[gameId].players);
        expect(playerIds.length).toBe(1);
        expect(lobbies[gameId].players[playerIds[0]].name).toBe("Commander Shepard");
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test("Client can place fleets", (done) => {
    const gameId = "setup_test";
    
    // Mock a lobby where the user has already joined
    lobbies[gameId] = { 
        players: { [clientSocket.id]: { name: "Test", ready: false, color: "Red" } }, 
        status: 'waiting',
        fleets: {},
        assets: {},
        history: []
    };

    // The data structure YOUR server expects
    const fleetData = {
        alpha: { q: 0, r: 0 },
        beta: { q: 1, r: -1 }
    };

    clientSocket.emit("place_fleets", { gameId, fleetPositions: fleetData });

    clientSocket.on("fleets_placed_confirmation", () => {
      try {
        // Check server state
        const pFleets = lobbies[gameId].fleets[clientSocket.id];
        expect(pFleets).toBeDefined();
        expect(pFleets.alpha.hp).toBe(2); // Server should have added HP
        expect(pFleets.alpha.q).toBe(0);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test("Client can execute a strike and hit an enemy", (done) => {
    const gameId = "combat_test";
    const enemyId = "enemy_socket_id";

    // Mock an Active Game with two players
    lobbies[gameId] = { 
        status: 'active',
        activePlayer: clientSocket.id, // It is OUR turn
        players: { 
            [clientSocket.id]: { color: "Red" },
            [enemyId]: { color: "Blue" }
        },
        fleets: {
            // WE have a fleet nearby
            [clientSocket.id]: { 
                alpha: { q: 0, r: 0, hp: 2 } 
            },
            // ENEMY is at 1,1
            [enemyId]: { 
                alpha: { q: 1, r: 1, hp: 2 } // Target
            }
        },
        assets: { [clientSocket.id]: { fuel: 3 }, [enemyId]: { fuel: 3 } },
        history: []
    };

    // ACTION: We fire at 1,1
    clientSocket.emit("execute_strike", { 
        gameId, 
        targetHex: { q: 1, r: 1 } 
    });

    clientSocket.on("strike_result", (data) => {
      try {
        expect(data.attacker).toBe(clientSocket.id);
        expect(data.hit).toBe(true);
        expect(data.hpRemaining).toBe(1); // Should drop from 2 to 1
        
        // Check server state persistence
        expect(lobbies[gameId].fleets[enemyId].alpha.hp).toBe(1);
        done();
      } catch (error) {
        done(error);
      }
    });
  });

  test("Client cannot move if they have no fuel", (done) => {
    const gameId = "fuel_test";
    
    lobbies[gameId] = { 
        status: 'active',
        activePlayer: clientSocket.id,
        players: { [clientSocket.id]: {} },
        fleets: { [clientSocket.id]: { alpha: { q: 0, r: 0, hp: 2 } } },
        assets: { [clientSocket.id]: { fuel: 0 } }, // NO FUEL
        history: []
    };

    clientSocket.emit("move_fleet", { 
        gameId, 
        fleetKey: "alpha", 
        newPosition: { q: 0, r: 1 } 
    });

    clientSocket.on("error", (msg) => {
      try {
        expect(msg).toBe("Not enough fuel to move.");
        done();
      } catch (error) {
        done(error);
      }
    });
  });

});