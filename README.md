# Find Fix & Finish
Find, Fix, & Finish is a 2-player “Micro wargame” in which players wrestle with important information as they hunt for the opposing fleets. The game aims to familiarize players with the tense back and forth as each fleet simultaneously tries to find their targets while concealing their own fleets. Each of the ISR capabilities within the game broadly represents different means to find the enemy. “Focus ISR” represents imagery intelligence such as unmanned aerial systems. “Directional ISR” represents techniques like combat directional finding. “Area ISR” represents signals intelligence that covers a large area. 

Although immensely simplified, the game aims to highlight how different capabilities have comparative advantages, represented by a tradeoff between probability of success and area of coverage. The map and game are specifically designed so that no singular method is guaranteed or supreme. Each mechanic has its specific value and contextual application. Similarly, the simple combat mechanic aims to highlight key factors- such as distance and terrain - in maritime combat. In the spirit of Wayne Hugh’s Fleet Tactics, each player must strive to find the enemy first and strike decisively. If unsuccessful, the enemy fleet may surmise your own position or detect your position from our attack and respond with a counterattack of their own.

## Goal
The endstate of this project is publicize a completely digitized version of Find Fix & Finish. 

## Feature Highlights
- Responsive UI based on screen size
- Multi-player authoratative room-based game server
- Map randomization
- Single-player reinforcement learning agent

## Setup
The following instructions install npm and svelte with TLS bypass. This is necessary for hosts behind a proxy network.
### Installation
1. First, create a new folder at the directory `~/.local/bin`
2. Install n, the Node.js package manager
   
   `curl -fsSL -o ~/.local/bin/n https://raw.githubusercontent.com/tj/n/master/bin/n`

3. Change permissions:

    `chmod 0755 ~/.local/bin/n`

4. Setup environmental variables:

   `export N_PREFIX="$HOME/.local"`
   
   `export PATH="$N_PREFIX/bin:$PATH"`
5. Install npm:

    `n install lts`

6. Bypass TLS certification check:

   `export NODE_TLS_REJECT_UNAUTHORIZED=0`

   `npm config set strict-ssl false`

7. Install Svelte:

    `npm install svelte vite @sveltejs/vite-plugin-svelte`

### Build and Run
Run `npm run dev`. Copy and paste the output link in the browser to visualize app.

## Tools and Frameworks
<img width="150" height="168" alt="image" src="https://github.com/user-attachments/assets/a8e74586-a23d-43a2-a342-3e09b26ee75c" />
<img width="150" height="141" alt="image" src="https://github.com/user-attachments/assets/1d32a06b-9a23-42c9-803f-39bc0ef0d110" />
<img width="150" height="168" alt="image" src="https://github.com/user-attachments/assets/31c3badf-9235-4f22-be5b-9dec69805664" />
<img width="150" height="154" alt="image" src="https://github.com/user-attachments/assets/87bca5dc-49fe-4571-9fd6-242397194c51" />
<img width="150" height="150" alt="image" src="https://github.com/user-attachments/assets/b49d28b4-d16c-4529-8dd4-c1b9aae5f033" />

## References
The full Find Fix & Finish game can be found [here](https://drive.google.com/file/d/1vMZVPX84xQhFhvrUCxqcdzzP6NC3f45j/view) on the official CNA site.






