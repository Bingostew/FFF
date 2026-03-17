/**
 * socket.test.js
 * Description: will be used to test different socket.io APIs
 */

const request = require('supertest');
const { io: Client } = require('socket.io-client');
const server = require('../server');

describe('Socket.io Game Logic', () => {
    let clientA, clientB;
    let gameId;
    const port = 3000;
    const socketUrl = `http://localhost:${port}`;

    beforeAll((done) => {
        if(!server.listening) {
            server.listen(port, () => {
                done();
            });
        } else {
            done();
        }
    });

    afterAll((done) => {
        if (clientA) clientA.close();
        if (clientB) clientB.close();
        server.close(done);
    });

    test('Complete Game Flow Integration Test', async () => {
        // 1. Create Lobby via HTTP
        const res = await request(socketUrl).post('/create-lobby');
        gameId = res.body.gameId;
        expect(gameId).toBeDefined();

        // 2. Connect Two Clients
        clientA = new Client(socketUrl);
        clientB = new Client(socketUrl);

        await new Promise(resolve => {
            let connected = 0;
            const check = () => { if (++connected === 2) resolve(); };
            clientA.on('connect', check);
            clientB.on('connect', check);
        });

        // 3. Join Game
        const joinPromiseA = new Promise(resolve => clientA.once('room_update', resolve));
        clientA.emit('join_game', { gameId, playerName: 'Commander A' });
        await joinPromiseA;

        const joinPromiseB = new Promise(resolve => clientA.once('room_update', resolve)); // Wait for update on A
        clientB.emit('join_game', { gameId, playerName: 'Commander B' });
        const roomUpdate = await joinPromiseB;
        expect(Object.keys(roomUpdate.players).length).toBe(2);

        // 4. Place Fleets
        const fleetsA = { alpha: { q: 0, r: 0 }, beta: { q: 1, r: 1 } };
        const fleetsB = { alpha: { q: 5, r: 5 }, beta: { q: 6, r: 6 } };

        const placePromiseA = new Promise(resolve => clientA.once('fleets_placed_confirmation', resolve));
        clientA.emit('place_fleets', { gameId, fleetPositions: fleetsA });
        await placePromiseA;

        const placePromiseB = new Promise(resolve => clientB.once('fleets_placed_confirmation', resolve));
        clientB.emit('place_fleets', { gameId, fleetPositions: fleetsB });
        await placePromiseB;

        // 5. Ready Up & Start Game
        const startPromise = new Promise(resolve => clientA.once('game_start', resolve));
        clientA.emit('ready_check', { gameId });
        clientB.emit('ready_check', { gameId });
        const startData = await startPromise;
        expect(startData.activePlayer).toBeDefined();

        // Identify Active Player
        const activeClient = clientA.id === startData.activePlayer ? clientA : clientB;
        const passiveClient = clientA.id === startData.activePlayer ? clientB : clientA;

        // 6. Active Player Moves Fleet
        // Determine move based on who is active (A is at 0,0; B is at 5,5)
        const moveData = (activeClient === clientA) 
            ? { gameId, fleetKey: 'alpha', newPosition: { q: 0, r: 1 } }
            : { gameId, fleetKey: 'alpha', newPosition: { q: 5, r: 6 } };

        const movePromise = new Promise(resolve => activeClient.once('fleet_moved', resolve));
        const turnPromise = new Promise(resolve => activeClient.once('turn_change', resolve));
        
        activeClient.emit('move_fleet', moveData);
        
        const moveResult = await movePromise;
        expect(moveResult.newPosition.q).toBe(moveData.newPosition.q);
        
        const turnData = await turnPromise;
        expect(turnData.activePlayer).toBe(passiveClient.id);

        // 7. New Active Player (was passive) Executes Strike
        const strikeData = { gameId, targetHex: { q: 10, r: 10 }, dieResult: 6 };
        const strikePromise = new Promise(resolve => passiveClient.once('strike_result', resolve));
        const turnPromise2 = new Promise(resolve => passiveClient.once('turn_change', resolve));
        
        passiveClient.emit('execute_strike', strikeData);
        const strikeResult = await strikePromise;
        expect(strikeResult.hit).toBe(false);

        await turnPromise2;

        // 8. Original Active Player performs Focus ISR
        // A's fleets: alpha(0,1), beta(1,1) | B's fleets: alpha(5,5), beta(6,6)
        const opponentFleetPos = (activeClient === clientA) ? { q: 5, r: 5 } : { q: 0, r: 1 };
        
        const focusPositions = [
            opponentFleetPos,
            { q: -10, r: -10 },
            { q: -11, r: -11 }
        ];

        const focusPromise = new Promise(resolve => activeClient.once('focus_result', resolve));
        activeClient.emit('focus', gameId, focusPositions);
        
        const focusResult = await focusPromise;
        expect(focusResult.revealPos).toBeTruthy();
        expect(focusResult.revealPos.length).toBe(1);
    }, 10000);
});