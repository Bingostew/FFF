// server/botAI.js
const { F3Game } = require('../src/lib/game/F3Game.js'); // Point this to your actual file
const MCTS = require('../src/lib/game/MCTS.js');         // Point this to your actual file

class BotAI {
    /**
     * @param {Object} lobby - The current server room/lobby state
     * @param {string} botTeam - 'BLUE' or 'RED'
     */
    static getBestAction(lobby, botTeam = 'BLUE') {
        console.log(`🤖 BotAI activating for team ${botTeam}...`);

        // 1. Create a fresh instance of your awesome game engine
        const game = new F3Game();

        // 2. Sync the engine with the server's current lobby state
        // (You will need to map your server's lobby data to the game's arrays)
        game.turn = lobby.turn;
        game.phase = lobby.phase || 'SELECT_ACTION';
        game.currentPlayer = botTeam; 
        
        // Example: Converting lobby fleets to the format F3Game expects
        // You may need to tweak this depending on exactly how 'lobby.fleets' is structured!
        game.redFleets = lobby.redFleets;   
        game.blueFleets = lobby.blueFleets; 

        // 3. Initialize your existing MCTS Brain (500 iterations is safe for a server)
        const aiBrain = new MCTS(500);

        // 4. Let the brain think using YOUR game rules
        const bestMoveStr = aiBrain.search(game);

        if (bestMoveStr) {
            console.log(`🤖 BotAI decided to execute: ${bestMoveStr}`);
            return bestMoveStr; // Returns a string like "STRIKE_A1" or "ISR_DIR_A1_B2_C3"
        } else {
            console.log(`🤖 BotAI found no valid moves. Passing.`);
            return "PASS";
        }
    }
}

module.exports = BotAI;