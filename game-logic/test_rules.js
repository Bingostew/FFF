// test_rules.js
import { F3Game } from './F3Game.js';
import { HexUtils } from './HexUtils.js';

// ==========================================
// 1. UNIT TESTS: HEX GEOMETRY
// ==========================================
function testHexMath() {
    console.log("--- TESTING HEX MATH ---");

    // Test 1: Coordinate Parsing
    const pos = HexUtils.parsePos("C3");
    const passed1 = (pos.col === 2 && pos.row === 2);
    console.log(`[${passed1 ? 'PASS' : 'FAIL'}] Parse 'C3' -> {col: 2, row: 2}`);

    // Test 2: Neighbor Calculation
    // C3 (Col 2, Row 2) is an EVEN column. 
    // Neighbors should include C2 (2,1) and C4 (2,3)
    const neighbors = HexUtils.getNeighbors(2, 2); 
    const hasC2 = neighbors.some(n => n.col === 2 && n.row === 1);
    console.log(`[${hasC2 ? 'PASS' : 'FAIL'}] Neighbors of C3 include C2`);

    // Test 3: Distance Calculation
    // A1 to A3 should be distance 2
    const dist = HexUtils.getDistance(HexUtils.parsePos("A1"), HexUtils.parsePos("A3"));
    console.log(`[${dist === 2 ? 'PASS' : 'FAIL'}] Distance A1 -> A3 is 2 (Calculated: ${dist})`);
}

// ==========================================
// 2. UNIT TESTS: GAME RULES
// ==========================================
function testGameRules() {
    console.log("\n--- TESTING GAME RULES ---");
    
    // Setup
    let game = new F3Game();
    // Manually place a Red Fleet at B2 for testing
    game.redFleets = [{ id: 'R1', pos: 'B2', hp: 2, fuel: 3, isHidden: true }];
    game.currentPlayer = 'RED';

    // TEST 1: MOVEMENT & FUEL
    console.log("Test: Moving R1 from B2 to B3...");
    
    // Execute Move
    // Note: In the previous code, logic handled "MOVE_R1_B2". 
    // Let's try moving to a valid neighbor B3.
    const moveCmd = "MOVE_R1_B3";
    let nextState = game.makeMove(moveCmd);

    // Verify Position
    const newFleet = nextState.redFleets.find(f => f.id === 'R1');
    const posCheck = (newFleet.pos === 'B3');
    console.log(`[${posCheck ? 'PASS' : 'FAIL'}] Fleet moved to B3`);

    // Verify Fuel Cost
    const fuelCheck = (newFleet.fuel === 2); // Started at 3
    console.log(`[${fuelCheck ? 'PASS' : 'FAIL'}] Fuel reduced to 2`);

    // Verify Turn Switch
    const turnCheck = (nextState.currentPlayer === 'BLUE');
    console.log(`[${turnCheck ? 'PASS' : 'FAIL'}] Turn switched to BLUE`);
}

// ==========================================
// 3. INTEGRATION TEST: ISR & DICE ROLLS
// ==========================================
function testISR() {
    console.log("\n--- TESTING ISR (DICE ROLLS) ---");
    
    // Since dice are random, how do we test them?
    // TECHNIQUE: "Mocking" or "Statistical Checks"
    // Here we just run it 10 times and ensure it doesn't crash.
    
    let game = new F3Game();
    game.redFleets = [{ id: 'R1', pos: 'A1', hp: 2, fuel: 3, isHidden: true }];
    
    console.log("Running 10 Random ISR Moves...");
    let successes = 0;
    
    for (let i=0; i<10; i++) {
        // Force a specific ISR move
        // Note: The previous logic relied on dice rolls inside makeMove.
        // We are checking that makeMove returns a valid NEW state object.
        const nextState = game.makeMove("ISR_DIR_ROW_1"); // Directional Scan Row 1
        
        if (nextState && nextState.turn !== game.turn) {
            successes++;
        }
    }
    
    console.log(`[${successes === 10 ? 'PASS' : 'FAIL'}] 10/10 ISR moves executed without crashing.`);
}

// RUN ALL
testHexMath();
testGameRules();
testISR();