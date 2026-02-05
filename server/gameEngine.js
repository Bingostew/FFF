// file contain functions for socketHandler.js file to directly alter game state

// hex distance formula (cube coordinates)

const GameEngine = {
    // start the game by initializing ship locations
    initShips: (gameState, playerId, shipName, hex) => {
        
    },
    // validate player's move
    validateMove: (gameState, shipId, toHex) => {
        const ship = gameState.ships[shipId];
        const map = gameState.map;

        // Rule: Move ONE adjacent hex
        if (GameEngine.getDistance(ship.location, toHex) !== 1) 
            return { valid: false, msg: "Must move 1 hex" };

        // Rule: Fuel bubbles
        if (ship.fuel <= 0) 
            return { valid: false, msg: "Out of fuel" };

        // Rule: land hexes are impassable
        if (map.landHexes.includes(toHex)) 
            return { valid: false, msg: "Cannot enter Land" };

        return { valid: true };
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