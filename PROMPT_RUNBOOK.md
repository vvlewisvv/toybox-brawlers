# PROMPT_RUNBOOK.md

## How to use this runbook

* Send **one prompt at a time** to Cursor
* Do not skip the test points
* If a test fails, stop and fix before moving on
* Do not ask Cursor to massively refactor working systems unless necessary
* Keep a backup or checkpoint after each successful phase

## Build philosophy

The goal is to build **Plushdown** from startup shell to playable browser fighter with the least rework possible.

Priority order:

1. instant boot
2. responsive movement
3. combat feel
4. roster framework
5. bot
6. multiplayer
7. visual polish
8. audio
9. optimization

---

# PHASE 1 — FOUNDATION

## Goal

Project boots instantly, renders cleanly, and shows a fast menu.

### Prompt 1

Create a browser-based game project called Plushdown using Vite and Three.js. Use a clean modular structure with folders for engine, gameplay, rendering, UI, characters, netcode, assets, audio, and scenes. Keep the startup path extremely light so the app can render a main menu almost instantly.

### Prompt 2

Create a minimal Three.js scene with a camera, renderer, and simple background. Render a placeholder stage floor or backdrop so the app displays something immediately without errors.

### Prompt 3

Build a lightweight HTML/CSS main menu overlay with buttons for Play Online, Vs Bot, Settings, and Quit to Menu flow support. Ensure the UI appears instantly without waiting for heavy asset loading.

## Test point 1

Pass only if:

* app loads with no console errors
* menu appears nearly instantly
* buttons are clickable
* a basic rendered scene is visible behind the UI

---

# PHASE 2 — INPUT AND MOVEMENT CORE

## Goal

A placeholder fighter can move, crouch, jump, and stay grounded.

### Prompt 4

Implement keyboard input with the final control scheme: Left and Right Arrow to move, Down Arrow to crouch, Space to jump, A to block, F for light attack, D for heavy attack, and S for special attack. Keep input handling modular and responsive.

### Prompt 5

Create a placeholder fighter object using simple geometry and a base fighter controller. Implement left and right movement, grounded state, gravity, crouch, and jump using Space.

### Prompt 6

Add a ground plane and collision handling so the fighter lands cleanly after jumping and cannot fall through the world.

## Test point 2

Pass only if:

* left and right movement works
* crouch works and visually reads clearly
* jump works and lands cleanly
* movement feels responsive, not floaty
* no console errors

---

# PHASE 3 — TWO-FIGHTER SETUP

## Goal

Two fighters exist on a fixed 2D fighting plane and always face each other.

### Prompt 7

Create a second placeholder fighter using the same core controller framework. Place both fighters on a fixed 2D fighting plane and ensure they always face each other correctly.

### Prompt 8

Constrain gameplay to a 2D fighting plane while keeping the visuals rendered in 3D. Do not allow any gameplay depth movement.

### Prompt 9

Add spacing logic and pushbox behavior so fighters cannot overlap unrealistically and maintain readable fighting distance.

## Test point 3

Pass only if:

* both fighters face each other correctly
* fighters stay on a single fighting plane
* fighters do not overlap badly
* stage reads as 3D while gameplay remains 2D

---

# PHASE 4 — COMBAT CORE

## Goal

Basic attacks, hit detection, damage, and impact feedback work.

### Prompt 10

Implement a basic combat system with F as light attack, D as heavy attack, and S as special attack. Use simple startup, active, and recovery timings even if the animations are placeholder.

### Prompt 11

Add hitboxes, hurtboxes, and pushboxes using simple debug-friendly shapes. Build a debug toggle so hit areas can be visualized during testing.

### Prompt 12

Implement hit detection, damage, hitstun, blockstun, and whiff recovery. Keep the system readable and easy to tune.

### Prompt 13

Add health bars for both fighters and a simple round timer UI.

### Prompt 14

Add hit feel polish with short hit stop, quick camera shake, screen feedback, and placeholder particle bursts.

## Test point 4

Pass only if:

* all three attack buttons produce distinct actions
* hits only land at proper range
* blocking reduces or prevents damage
* health bars update correctly
* hits feel noticeable, not empty

---

# PHASE 5 — ROUND FLOW

## Goal

Playable rounds with reset logic and basic match structure.

### Prompt 15

Implement best-of-3 rounds, KO state, round reset flow, and winner tracking. Keep the round loop simple and stable.

### Prompt 16

Add a 3-second countdown before each round and use the countdown to finish scene warmup and state reset.

## Test point 5

Pass only if:

* rounds start cleanly
* countdown displays properly
* KO triggers round end
* match resets without bugs

---

# PHASE 6 — CHARACTER FRAMEWORK

## Goal

Shared character logic exists and is ready for the five-fighter roster.

### Prompt 17

Refactor the placeholder fighters into a shared character framework where logic, stats, attacks, animations, and visuals can be swapped per character without duplicating the full controller.

### Prompt 18

Create a clean data-driven character definition structure covering movement speed, jump arc, health, attack timings, damage, hitbox presets, and visual identity hooks.

## Test point 6

Pass only if:

* new fighters can be created from shared logic
* tuning values are not hardcoded everywhere
* the controller still works after refactor

---

# PHASE 7 — ROSTER IMPLEMENTATION

## Goal

All five characters exist and feel different.

### Prompt 19

Create Bramble, the big light brown bear. Make Bramble a bruiser with slower movement, heavier attacks, larger range on big swings, and a premium plush silhouette.

### Prompt 20

Create Bibi, the little blue bear. Make Bibi a fast all-rounder with quick normals, easy combo flow, and a smaller, energetic silhouette.

### Prompt 21

Create Chomp, the green dinosaur. Make Chomp a grappler-pressure character with chunky body language, command-grab energy, and strong close-range threat.

### Prompt 22

Create Gloom, the short fat black cat. Make Gloom an evasive trickster with a low stance, fast recovery, mischievous attitude, and slippery punish-focused gameplay.

### Prompt 23

Create Emberclaw, the red dragon. Make Emberclaw a flashy specialist with fire-themed effects, dramatic silhouette, and higher-reward special moves.

## Test point 7

Pass only if:

* all 5 characters are selectable or swappable
* each character feels different within seconds
* silhouettes are clearly distinct
* no character breaks the shared framework

---

# PHASE 8 — CHARACTER SELECT

## Goal

Character select feels premium and hides background loading.

### Prompt 24

Create a character select screen showing all five fighters with strong visual presentation, hover feedback, select states, and clear identity cues.

### Prompt 25

Use the character select screen to preload character-specific assets, materials, and effects in the background without showing a traditional blocking loading screen.

## Test point 8

Pass only if:

* character select is smooth
* selected character loads into match cleanly
* no visible heavy loading screen appears

---

# PHASE 9 — VIOLENCE TOGGLE

## Goal

Soft and Chaos modes swap presentation only.

### Prompt 26

Add a settings menu option called Violence Mode with two choices: Soft and Chaos. Store the setting globally and make it accessible by VFX systems.

### Prompt 27

Implement Soft mode visuals using stuffing bursts, fabric debris, confetti, and plush-safe impact effects.

### Prompt 28

Implement Chaos mode visuals using stronger red slash effects and more intense impact particles while keeping the style stylized and not realistic.

### Prompt 29

Ensure Violence Mode only changes visuals and never changes gameplay timing, damage, hitboxes, or balance.

## Test point 9

Pass only if:

* mode can be changed easily
* effects visibly swap between modes
* gameplay remains identical in both modes

---

# PHASE 10 — BOT MODE

## Goal

Offline play is fun and usable.

### Prompt 30

Create a basic bot opponent that can move, attack, block, and react to distance. The bot should feel playable, not perfect.

### Prompt 31

Improve the bot with simple decision logic for pressure, backing off, punishing obvious mistakes, and anti-air attempts. Keep it fair rather than psychic.

## Test point 10

Pass only if:

* bot can complete a full round
* bot is active and interesting
* bot does not cheat or soft-lock the match

---

# PHASE 11 — ONLINE MULTIPLAYER

## Goal

Two players can connect and play 1v1 online.

### Prompt 32

Implement a lightweight online multiplayer architecture for browser-based 1v1 matches with simple room code create and join flows. Keep the UX fast and minimal.

### Prompt 33

Sync player movement, attacks, health, round state, and rematch flow between two connected clients. Prioritize responsiveness, readability, and stability.

### Prompt 34

Add a simple online ready-up state before match start and ensure the countdown begins only when both players are ready and game state is synchronized.

## Test point 11

Pass only if:

* two clients can connect
* both players can move and attack
* health and rounds stay in sync
* match flow works from join to rematch

---

# PHASE 12 — VISUAL POLISH

## Goal

The game stops looking like placeholders and starts feeling premium.

### Prompt 35

Upgrade the character visuals with plush-inspired materials including fabric texture response, seam detail, subtle rim lighting, and a soft premium toy look suitable for real-time browser rendering.

### Prompt 36

Improve attack effects with stronger hit flashes, directional streaks, impact bursts, and better timing around hit stop and camera shake.

### Prompt 37

Add clear jump arcs, anti-air readability, landing feedback, and stronger pose language so combat reads well from a glance.

## Test point 12

Pass only if:

* game visually reads as plush fighting game
* hits feel more premium than placeholder
* character readability improves, not worsens

---

# PHASE 13 — ARENA

## Goal

One beautiful browser-friendly stage.

### Prompt 38

Create a single polished toybox-themed arena with oversized toy props, strong depth, dramatic but readable lighting, and efficient geometry for browser performance.

### Prompt 39

Tune the arena camera framing, shadows, backdrop, and foreground elements so the game looks expensive while preserving fighting-game readability.

## Test point 13

Pass only if:

* stage looks memorable
* both fighters remain easy to read
* framerate remains stable

---

# PHASE 14 — AUDIO

## Goal

The game feels alive.

### Prompt 40

Implement lightweight sound support for menu clicks, movement, attacks, impacts, blocks, jump, land, KO, and countdown cues.

### Prompt 41

Add simple music support with a menu loop and match loop that are lightweight, energetic, and easy to swap later.

## Test point 14

Pass only if:

* sound effects are responsive
* menu and match feel more alive
* audio does not noticeably hurt load time

---

# PHASE 15 — FINAL UX AND OPTIMIZATION

## Goal

Make it submission-ready.

### Prompt 42

Optimize startup performance by minimizing bundle size, deferring non-essential assets, compressing textures, and removing blocking work from first load.

### Prompt 43

Optimize runtime performance by reducing draw calls, capping particles where needed, simplifying heavy effects, and exposing quality settings if necessary.

### Prompt 44

Polish the UI and transitions across menu, settings, character select, countdown, match, KO, and rematch flow so the whole product feels cohesive.

### Prompt 45

Run a codebase cleanup pass that removes dead code, improves naming, tightens architecture, and preserves all working systems without feature regressions.

## Final test point

Pass only if:

* menu appears quickly
* controls feel responsive
* all 5 characters work
* bot mode works
* online works
* violence toggle works
* stage looks polished
* audio works
* no major console spam or crash paths remain

---

# OPTIONAL POLISH AFTER CORE IS STABLE

Only do these after the full game works.

### Prompt 46

Add one cinematic super or ultra-finisher system per character with a short high-impact presentation that is memorable but not too expensive for browser performance.

### Prompt 47

Add victory poses and winner presentation screens for each character.

### Prompt 48

Add a move list panel in the menu or character select so players can learn the basic attacks and special moves.

### Prompt 49

Add a simple replay-ready highlight buffer so dramatic KOs can be replayed locally after a round.

### Prompt 50

Do a jam-submission readiness pass to confirm the game launches fast, the UX is clear, the match loop works, and the project is fit for deployment.
