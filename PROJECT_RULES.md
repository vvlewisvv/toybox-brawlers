# PROJECT_RULES.md

## Purpose

This document is the hard guardrail for building **Plushdown** in Cursor. Follow these rules unless a change is clearly necessary.

## Product definition

Plushdown is an **instant-load browser-based 1v1 fighting game** with:

* 2D gameplay on a 3D rendered stage
* online multiplayer via room codes
* vs bot mode
* five plush-animal fighters
* keyboard controls
* one polished arena at launch
* a Soft / Chaos violence presentation toggle

## Non-negotiable design constraints

1. **Gameplay is 2D only**

   * No lane movement
   * No sidestep system
   * No gameplay depth movement
   * Visuals may be 3D, but all combat occurs on a fixed horizontal fighting plane

2. **Instant first impression**

   * Menu should appear almost immediately
   * No heavy startup loads
   * No splash videos
   * No account system or login friction

3. **Polish beats scope**

   * One excellent arena is better than multiple weak arenas
   * Five distinct characters are enough
   * Prefer fewer mechanics with better feel

4. **Multiplayer matters**

   * Online 1v1 is a priority feature
   * Implement rough but working multiplayer earlier than feels comfortable
   * Vs Bot must still exist as a fallback mode

5. **Browser-first performance**

   * Keep startup tiny
   * Lazy load non-essential assets
   * Avoid massive textures and oversized dependencies

## Final control scheme

* **Left / Right Arrow:** move
* **Down Arrow:** crouch
* **Space:** jump
* **A:** block
* **F:** light attack
* **D:** heavy attack
* **S:** special attack

Do not change the control scheme unless explicitly requested.

## Combat philosophy

* grounded footsies
* short satisfying combos
* strong hit stop and impact
* clear anti-airs
* clear punish windows
* readable spacing game
* no giant unreadable move lists
* no long floaty air-combo focus

## Required combat features

* move left and right
* crouch
* jump
* block
* light attack
* heavy attack
* special attack
* hit detection
* health bars
* round timer
* best-of-3 rounds
* KO flow
* rematch flow

## Character roster

### 1. Bramble

Big light brown bear

* bruiser
* slow, heavy, strong normals

### 2. Bibi

Little blue bear

* fast all-rounder
* easiest starter character

### 3. Chomp

Green dinosaur

* grappler / pressure character

### 4. Gloom

Short fat black cat

* trickster / evasive punish character

### 5. Emberclaw

Red dragon

* flashy specialist
* fire-themed visuals

## Character implementation rules

* shared core controller logic wherever possible
* distinct silhouette for each character
* distinct animation timing and effects language
* each character must feel different within the first 10 seconds of use
* do not overcomplicate move lists during the initial build

## Violence toggle rules

Two presentation modes only:

### Soft

* stuffing bursts
* fabric debris
* confetti
* plush-safe impact feedback

### Chaos

* stronger red hit splashes
* slash effects
* darker impact particles
* still stylized, not realistic gore

Important:

* This toggle is **visual only**
* No gameplay or balance changes between modes

## Visual style rules

* premium plush / fabric toy look
* stylized 3D visuals
* strong lighting
* readable silhouettes
* dramatic but controlled VFX
* no realistic humans
* no realistic gore

## Arena rules

* build **one arena first**
* arena should look premium, not just functional
* keep geometry lightweight for browser performance
* do not create extra stages until the first one is polished and stable

## Camera rules

* fixed fighting-game readability first
* cinematic framing second
* both fighters always readable
* subtle zoom and shake only
* do not let camera style hurt gameplay clarity

## Architecture rules

Use modular systems and keep logic separated:

* input
* fighter controller
* combat / hit detection
* UI
* scene management
* asset loading
* netcode
* AI
* VFX / audio

## Coding rules

* keep files modular
* use clear naming
* avoid giant god-classes
* avoid unnecessary refactors once a system works
* add comments where logic is not obvious
* prefer small targeted changes over broad rewrites

## Asset loading rules

* keep boot path tiny
* only load minimum menu assets at startup
* defer fighter and stage-heavy assets
* use character select and countdown to hide warmup
* avoid blocking loads during first interaction

## Performance rules

* optimize for browser first
* compress textures
* minimize draw calls
* cap particle counts when needed
* keep shader complexity reasonable
* avoid unnecessary libraries

## Multiplayer rules

* keep create/join flow dead simple
* room code based
* sync only what matters
* prioritize responsiveness and stability over feature bloat
* if a netcode feature is unstable, simplify rather than layering hacks

## AI rules

* bot should be good enough to be fun, not perfect
* must move, attack, block, and punish sometimes
* should never feel psychic or unfair

## Scope guardrails

### Must-have

* instant boot to menu
* main menu
* online room flow
* vs bot mode
* 5 characters
* 1 polished arena
* combat core
* violence toggle
* character select
* countdown
* health UI and round flow

### Nice-to-have

* supers
* announcer voice
* replay highlight
* extra skins
* move list panel

### Not in initial scope

* multiple arenas
* story mode
* advanced progression
* giant move lists
* realistic gore
* complex account systems

## Cursor behavior guidance

When implementing a prompt:

1. preserve existing working systems
2. do not silently remove features
3. do not replace stable architecture unless necessary
4. do not add unrelated features
5. keep changes scoped to the prompt
6. prefer completing one clean system before starting another

## North star

Build the most polished, instantly fun browser fighter possible for the jam — not the largest fighter.
