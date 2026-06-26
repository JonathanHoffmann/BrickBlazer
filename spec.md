# Brickblaze Game — `spec.md`

Write a comprehensive game specification document at `/BrickBreakerClone/spec.md`.

**Decisions**
- **Tech**: Vanilla HTML5 Canvas + TypeScript (no framework)
- **Platform**: Browser-first; desktop wrapper deferred to later
- **Input**: Keyboard + mouse + touch
- **Scope**: Standard (multiple levels, power-ups, sound, varied bricks)

**Spec sections**

1. **Overview** — game concept, goals, target audience
2. **Core Mechanics**
   - Paddle: moves horizontally at screen bottom; controlled by all 3 input methods
   - Ball: launches from paddle, bounces off walls/paddle/bricks; angle varies based on hit position on paddle
   - Lives: start with 3; lose one when the last active ball falls below the paddle; game over at 0
   - Scoring: points per brick (varies by type), combo multiplier for rapid breaks (time-based; resets if no brick hit within configurable timeout)
3. **Brick Types**
   - *Standard* — 1 hit, 10 pts
   - *Tough* — 2 hits (visual change on hit), 25 pts
   - *Armored* — 3 hits, 50 pts
   - *Unbreakable* — indestructible obstacle
   - *Explosive* — 1 hit, destroys adjacent bricks, 15 pts
4. **Power-ups** (drop from destroyed bricks with configurable probability)
   - Multi-ball, Wide paddle, Laser paddle, Slow ball, Fireball (pass-through), Sticky paddle, Extra life
   - *Debuffs*: Narrow paddle, Fast ball
   - Power-ups are timed (except extra life); "only one active at a time" rule applies **only to paddle modifiers** (wide, narrow, laser, sticky) — a new paddle modifier replaces the current one
   - Multi-ball and Extra life are instant/independent effects (not subject to the single-active rule)
   - **Laser paddle**: auto-fires projectiles upward at a slow fire rate; projectiles damage bricks on hit
   - **Sticky paddle**: ball sticks to paddle on contact and re-launches on tap/launch input
   - **Multi-ball**: spawns extra balls; a life is lost only when the *last* ball falls below the paddle
5. **Levels**
   - Level data as grid arrays (rows × columns of brick type IDs)
   - Progressive difficulty: more tough/armored bricks, faster base ball speed, tighter layouts
   - Level cleared when all breakable bricks destroyed (no minimum score required)
   - Minimum 10 levels in initial release
   - Unlock logic: next 5 levels available at any time (player can skip ahead if stuck)
   - Persistence: progress (unlocked levels, best scores) saved to `localStorage`
6. **Screens & UI**
   - Title screen (start button, high score)
   - Level select screen (grid of levels; locked/unlocked/completed states; best score per level)
   - HUD (score, lives, level number, active power-up indicator)
   - Pause overlay (resume / quit)
   - Level complete screen (score summary, next level)
   - Game over screen (final score, restart)
7. **Input Handling**
   - Keyboard: Left/Right or A/D to move paddle; Space to launch/pause
   - Mouse: paddle follows cursor X; click to launch
   - Touch: paddle follows touch X; tap to launch
8. **Audio**
   - SFX: ball-paddle hit, ball-brick hit, brick destroy, power-up collect, life lost, level complete, game over
   - Optional background music (loop)
   - Web Audio API; mute toggle in UI
9. **Technical Architecture**
   - Game loop via `requestAnimationFrame` with fixed-timestep update + interpolated render
   - AABB collision detection (paddle ↔ ball, ball ↔ bricks, ball ↔ walls)
   - Base resolution: 9:16 portrait (e.g. 450×800); responsive canvas scales to fit viewport while maintaining aspect ratio
   - Project structure:
     ```
     src/
       main.ts          — entry point, canvas setup
       game.ts          — game loop, state machine (menu/play/pause/gameover)
       entities/        — Paddle, Ball, Brick, PowerUp classes
       systems/         — input, physics, collision, renderer, audio
       levels/          — level data arrays
       types.ts         — shared interfaces & enums
       constants.ts     — tuning values (speeds, sizes, probabilities)
     assets/
       sounds/          — SFX files
       sprites/         — (optional) sprite sheets
     index.html
     tsconfig.json
     package.json       — Vite dev server + build
     ```
10. **Future Considerations** (out of scope for v1)
    - Desktop wrapper (Electron/Tauri)
    - Native mobile (Capacitor)
    - Level editor
    - Online leaderboard
    - Multiplayer (co-op or versus)

**Verification**
1. Review `spec.md` for completeness and internal consistency
2. User approval before implementation begins
