const gameEngine = require('../gameEngine.js')

// test for distance calculator in gameEngine.js
describe("Testing Get Distance from 1", () => {
    it("Distances should be 1", () => {
        hex1 = "0,0,0"
        hex2 = "1, -1, 0"
        hex3 = "1, 0, -1"
        hex4 = "0, -1, 1"

        expect(gameEngine.getDistance(hex1, hex2)).toBe(1);
        expect(gameEngine.getDistance(hex1, hex3)).toBe(1);
        expect(gameEngine.getDistance(hex2, hex3)).toBe(1);
    });
});

describe("Testing Get Distance from 2", () => {
    it("Distances should be 1", () => {
        hex1 = "0,0,0"
        hex2 = "2, -2, 0"
        hex3 = "-2, 2, 0"

        expect(gameEngine.getDistance(hex1, hex2)).toBe(2);
        expect(gameEngine.getDistance(hex1, hex3)).toBe(2);
        // this one should be 4
        expect(gameEngine.getDistance(hex2, hex3)).toBe(4);
    });
});