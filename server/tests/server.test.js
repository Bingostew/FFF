/**
 * server.test.js
 * Description: will be used to test different express server http APIs
 */

const request = require('supertest');   // supertest lib is used for testing http apis
const server = require('../server.js');

describe('API Endpoints', () => {   // label tests as 'API Endpoints'
    // testing /create-lobby
    it('should create a new lobby successfully', async () => {
        // send request
        const res = await request(server)
            .post('/create-lobby')  // url
            .expect('Content-Type', /json/)   // check headers
            .expect(200);  // check status code

        // checks data
        expect(res.body.gameId).toBeDefined();
        expect(res.body.message).toBe('Lobby created!');
    });

    // testing /join-lobby
    it('should join a lobby successfully', async () => {
        // send request
        const res = await request(server)
            .post('/join-lobby') // url
            .expect('Content-Type', /json/)   // check headers
            .expect(200);  // check status code

        // checks data
        expect(res.body.message).toBe('Lobby joined!');
    })

    // testing 'place-fleets'

    // execute_strike

    // leave_game

    // move_fleet

    // 
});