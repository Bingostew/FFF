/**
 * socket.test.js
 * Description: will be used to test different socket.io APIs
 */

const request = require('supertest');
const { io: Client } = require('socket.io-client');
const server = require('../server')

describe('Socket.io Game Logic', () => {
    let clientSocket;
    let createGameId;

    beforeAll((done) => {
        if(!server.listening) {
            server.listen(3000, () => {
                request(server)
                    .post('/create-lobby')
                    .end((err, res) => {
                        if (err) return done(err);
                        createdGameId = res.body.gameId;
                        done();
                    });
            })
        } else {
            // Server already running, just create lobby
             request(server)
                .post('/create-lobby')
                .end((err, res) => {
                    if (err) return done(err);
                    createdGameId = res.body.gameId;
                    done();
                });
        }
    });

    afterAll((done) => {
        server.close(done);
    });

    // 3. Before each test: Connect a new client
    beforeEach((done) => {
        // Connect to localhost:3000
        clientSocket = new Client('http://localhost:3000');
        
        clientSocket.on('connect', () => {
            done();
        });
    });

    // 4. After each test: Disconnect
    afterEach(() => {
        if (clientSocket.connected) {
            clientSocket.disconnect();
        }
    });

    // --- THE ACTUAL TESTS ---

    test('should allow a user to join an existing game', (done) => {
        // A. SETUP LISTENER (The "Ear")
        // We must tell the test what to wait for BEFORE we send the message
        clientSocket.on('player_joined', (data) => {
            try {
                expect(data).toHaveProperty('playerId');
                done(); // SUCCESS: Tell Jest the test is finished
            } catch (error) {
                done(error);
            }
        });

        // B. PERFORM ACTION (The "Mouth")
        clientSocket.emit('join_game', { gameId: createdGameId });
    });

    test('should NOT allow joining a fake game', (done) => {
        // We expect an error message back
        clientSocket.on('error', (message) => {
            try {
                expect(message).toBe('Game does not exist');
                done();
            } catch (err) {
                done(err);
            }
        });

        clientSocket.emit('join_game', { gameId: 'fake-id-999' });
    });
});