// file contain functions for socketHandler.js file to directly alter game state

// hex distance formula (cube coordinates)

const GameEngine = {
    // start the game by initializing ship locations
    initShips: (gameState, playerId, shipName, hex) => {
        
    },
    // move a player's ships
    processMove: (gameState, playerId, shipName, fromHex, toHex) => {
        // verify player is able to move
        player = gameState.playerId;
        ship = player.shipName;

        // check to make sure ship has enough fuel to move
        if(ship.fuel > 0) {
            // check to verify ship's current position matches fromHex
            if(ship.location == fromHex) {
                // check to verify ship is moving to legal hex
                board = gameState.board;
                // does hex exist in map?
                board.tiles;
                // is toHex within 1 hex of the fromHex?
                // is the toHex not blocked?
                
                if() {
                    // TODO
                }
                else {
                    // ERROR: 
                }
            }
            else {
                // TODO: LOCATION MISMATCH
            }
        }
        else {
            // TODO: ERROR NO FUEL
        }
        
    },
    // conduct an ISR search
    processISR: (gameState, playerId, hexes, capability) => {
        if(capability == "focus") {
            // check and see if enemy ships exist in focus spot

            for(ship in gameState.ships) {
                
            }
        }
        else if(capability == "directional") {
            // TODO: verify hexes passed in are allowed
        }
        else if(capability == "area") {
            // TODO: verify hexes passed in are allowed
        }
        else {
            // TODO: ERROR
        }
    },
    // roll and attack
    processAttack: (gameState, playerId) => {

    }
    // check if game is over based on win condition
    checkWin: (gameState) => {
        // TODO
    }
};

module.exports = gameEngine


// data needed to be stored

// hex map -> where blocker hexes are
/**
 * hex object {name: A-1, location (0,0,0), type:ocean/mountain/jungle/ }
 *  location will be (q, r, s) format
 */

// ship object-> {name: , owner: playerId, location: (0,0,0), health: 0,1,2, Fuel: 0,1,2,3}


// GAMESTATE OBJ
// -> board
// -> playerdata
// -> ships