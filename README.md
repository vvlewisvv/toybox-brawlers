🎮 Toybox Brawlers
Fast-paced, chaotic online arena fighter where toys come to life and throw down.
🚀 Overview
Toybox Brawlers is a browser-based multiplayer fighting game built with Phaser and WebGL. Players battle in a stylised arena using unique characters, abilities, and fast movement mechanics.
Designed for quick matches, smooth rematches, and competitive chaos.
🎯 Core Features
⚔️ Real-time online multiplayer (1v1)
🤖 AI bots (adjustable difficulty coming)
🔁 Instant rematch system
🎮 Smooth movement + dash mechanics
💥 Abilities & attack effects
🗺️ Arena-based combat (King of the Hill mode)
🔄 Random respawn system (anti spawn-camping)
🎭 Unique 3D character skins (GLB models)
🧠 Gameplay Loop
Match starts (online or vs bot)
3-second countdown
Fight begins
Score via eliminations / objectives
Player dies → random respawn
Match ends → rematch or return to menu
🕹️ Controls
Action	Input
Move	WASD / Arrow Keys
Attack	Click / Tap
Ability	Keybind (TBD)
Dash	Shift
🌐 Multiplayer Flow
Auto matchmaking (planned / in progress)
Host syncs match state
Both players must signal fight_ready
Countdown only starts when both are ready
Guest follows host state (no local countdown)
🔁 Rematch System
Keeps same fighters
Resets state cleanly
Reuses match-start pipeline
Shows:
✅ Accepted (green)
❌ Declined (red)
Returns to character select if declined
🏗️ Tech Stack
Phaser 3 – game engine
Three.js – model handling
WebSockets – multiplayer sync
GLB models – characters & animations
Vercel – deployment
📦 Project Structure
/src
  /game
  /network
  /assets
  /ui
/server
  roomServer.mjs
⚙️ Setup
git clone https://github.com/your-username/toybox-brawlers.git
cd toybox-brawlers
npm install
npm run dev
🌍 Deployment
Frontend: Vercel
Backend: Node server (WebSocket)
🧪 Current Focus
Improve animations (attacks feel more impactful)
Better 3D character visuals
Matchmaking (auto join)
Performance optimisation (GLB + poly count)
UI polish + game feel
🏆 Vision
Create a simple to play, hard to master online fighter that feels:
fast
smooth
competitive
and addictive
