//Dice roll test printing functionality
export async function POST({ request }) {
    const data = await request.json();
    
    // This prints perfectly in VS Code
    console.log(`Dice Roll, number is [${data.result1}]`);
    console.log(`Dice Roll, number is [${data.result2}]`);
    
    return new Response(JSON.stringify({ success: true }));
}