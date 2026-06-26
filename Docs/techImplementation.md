# Technical Implementation Plan

## Phase 1 — Project Scaffolding

### 1.1 Initialize project
- `npm init` with project name `brickblaze`
- Install dev dependencies: `typescript`, `vite`
- Create `tsconfig.json` (strict mode, ES2020 target, module ESNext)
- Create `vite.config.ts` (dev server with hot reload)
- Create `index.html` with a single `<canvas>` element, viewport meta for mobile

### 1.2 Create directory structure
```
src/
  main.ts
  game.ts
  constants.ts
  types.ts
  entities/
    Paddle.ts
    Ball.ts
    Brick.ts
    PowerUp.ts
  systems/
    InputSystem.ts
    PhysicsSystem.ts
    CollisionSystem.ts
    Renderer.ts
    AudioSystem.ts
  levels/
    index.ts
    level01.ts ... level10.ts
  screens/
    TitleScreen.ts
    LevelSelectScreen.ts
    GameScreen.ts
    PauseOverlay.ts
    LevelCompleteScreen.ts
    GameOverScreen.ts
  storage/
    SaveManager.ts
assets/
  sounds/
```

---

## Phase 2 — Core Engine

### 2.1 Canvas & Scaling (`main.ts`)
- Create canvas at base resolution 450×800 (9:16 portrait)
- On `resize` event: scale canvas via CSS `transform` to fit viewport while preserving aspect ratio (letterbox with black bars)
- Expose `canvasScale` factor for input coordinate translation
- Call `game.init()` after setup

### 2.2 Game Loop (`game.ts`)
- Fixed timestep: `dt = 1/60` (16.67ms per tick)
- Accumulator pattern: accumulate real elapsed time, consume in fixed `dt` steps
- Interpolation factor passed to render for smooth visuals between ticks
- State machine enum: `TITLE | LEVEL_SELECT | PLAYING | PAUSED | LEVEL_COMPLETE | GAME_OVER`
- Each state delegates `update(dt)` and `render(ctx, alpha)` to the active screen

### 2.3 Types & Constants (`types.ts`, `constants.ts`)
- `types.ts`: interfaces for `Vec2`, `Rect`, `BrickType` enum, `PowerUpType` enum, `GameState` enum, `LevelData`, `SaveData`
- `constants.ts`: all tunable values:
  - `CANVAS_WIDTH = 450`, `CANVAS_HEIGHT = 800`
  - `PADDLE_WIDTH = 80`, `PADDLE_HEIGHT = 14`, `PADDLE_SPEED = 500`
  - `BALL_RADIUS = 8`, `BALL_BASE_SPEED = 400`
  - `BRICK_COLS = 9`, `BRICK_ROWS = 12`, `BRICK_WIDTH = 46`, `BRICK_HEIGHT = 20`, `BRICK_GAP = 2`
  - `INITIAL_LIVES = 3`
  - `COMBO_TIMEOUT = 1500` (ms)
  - `COMBO_MULTIPLIER_STEP = 0.5`
  - `POWERUP_DURATION = 8000` (ms)
  - `POWERUP_DROP_CHANCE = 0.15`
  - `POWERUP_FALL_SPEED = 150`
  - `LASER_FIRE_INTERVAL = 700` (ms)
  - `LASER_SPEED = 500`
  - `MULTIBALL_COUNT = 2` (extra balls spawned)
  - `LEVELS_UNLOCKED_AHEAD = 5`

---

## Phase 3 — Entities

### 3.1 Paddle (`entities/Paddle.ts`)
- Properties: `x`, `y` (fixed near bottom), `width`, `height`, `speed`
- Methods: `update(dt, inputX)`, `render(ctx)`, `reset()`
- Width is mutable (for wide/narrow power-ups)
- Clamp to canvas bounds

### 3.2 Ball (`entities/Ball.ts`)
- Properties: `x`, `y`, `vx`, `vy`, `radius`, `speed`, `attached` (to paddle), `fireball`
- Methods: `update(dt)`, `render(ctx)`, `launch(angle)`, `reset(paddle)`
- When `attached`: position tracks paddle center-top
- Launch angle: straight up (slight random offset ±10°)
- Speed increases slightly per level (multiplied by level factor from constants)

### 3.3 Brick (`entities/Brick.ts`)
- Properties: `row`, `col`, `type`, `hp`, `rect`, `alive`
- Methods: `hit()` → returns `{ destroyed, points, spawnPowerUp }`, `render(ctx)`
- Color/appearance changes based on `hp` remaining
- Explosive brick: on destroy, call `hit()` on all adjacent bricks (8-connected)

### 3.4 PowerUp (`entities/PowerUp.ts`)
- Properties: `x`, `y`, `type`, `active`
- Methods: `update(dt)`, `render(ctx)`
- Falls from destroyed brick position at `POWERUP_FALL_SPEED`
- Collected when overlapping paddle rect

### 3.5 Power-up Behaviors
- **Single-active rule**: applies **only to paddle modifiers** (wide, narrow, laser, sticky). Activating a new paddle modifier clears the current one and its timer. Slow/fast ball, fireball, multi-ball, and extra life are NOT paddle modifiers.
- **Wide / Narrow paddle**: scale `paddle.width` up/down; revert on timeout.
- **Laser paddle**: auto-fires `Laser` projectiles upward from the paddle at a slow fire rate (`LASER_FIRE_INTERVAL`). Projectiles travel up, damage the first brick hit (calls `brick.hit()`), then despawn. Active until paddle modifier replaced or timer expires.
- **Sticky paddle**: on ball-paddle contact, set `ball.attached = true` and store offset; ball re-launches on the launch input (tap/click/space). Active until paddle modifier replaced or timer expires.
- **Slow / Fast ball**: multiply all active balls' speed by a factor; revert on timeout.
- **Fireball**: balls pass through bricks (destroy without reflecting); revert on timeout.
- **Multi-ball**: spawn 2 extra balls from the current ball position with spread angles. Independent/instant (not a paddle modifier). A life is lost only when the LAST ball falls (see 4.2).
- **Extra life**: increment lives immediately; instant effect.

---

## Phase 4 — Systems

### 4.1 Input System (`systems/InputSystem.ts`)
- Unified interface: `getTargetX(): number | null`, `isLaunchPressed(): boolean`, `isPausePressed(): boolean`
- Keyboard: track `ArrowLeft`/`ArrowRight`/`a`/`d` held state → compute target X relative to current paddle position
- Mouse: `mousemove` → store X (translated by canvas scale/offset)
- Touch: `touchmove` / `touchstart` → store X (translated)
- Priority: touch > mouse > keyboard (last active input wins)
- All coordinates normalized to game-space (divide by `canvasScale`)

### 4.2 Physics System (`systems/PhysicsSystem.ts`)
- Move ball by `(vx, vy) * dt`
- Wall bounce: reflect `vx` on left/right walls, reflect `vy` on top wall
- Bottom boundary: ball lost → remove that ball; a life is lost only when the balls list becomes empty (last ball fell). Then reset a single ball attached to the paddle.
- Move paddle toward target X at `PADDLE_SPEED * dt` (or snap to mouse/touch X)
- Move power-up items downward
- Move laser projectiles upward at `LASER_SPEED`; despawn off-screen or on brick hit

### 4.3 Collision System (`systems/CollisionSystem.ts`)
- **Ball ↔ Paddle**: AABB test; on hit, reflect `vy` and adjust `vx` based on hit offset from paddle center (normalized −1 to +1 → angle range ±60°)
- **Ball ↔ Bricks**: for each alive brick, AABB test; on hit:
  - Determine collision side (compare overlap on each axis) to decide `vx`/`vy` reflection
  - If fireball: don't reflect, just destroy brick
  - Call `brick.hit()`; accumulate score; check combo timer
  - If explosive: cascade `hit()` on neighbors
  - Roll power-up drop chance
- **PowerUp ↔ Paddle**: AABB test; on collect, activate effect
- Process collisions in order: paddle first, then bricks (closest first to avoid tunneling)

### 4.4 Renderer (`systems/Renderer.ts`)
- `clear(ctx)`: fill background
- `drawBricks(ctx, bricks[])`: draw colored rects with border; color mapped by type & HP
- `drawPaddle(ctx, paddle)`
- `drawBall(ctx, ball)`: filled circle; glow effect if fireball
- `drawPowerUps(ctx, powerUps[])`
- `drawHUD(ctx, score, lives, level, combo, activePowerUp)`
- `drawParticles(ctx, particles[])` — simple particle burst on brick destroy (array of {x, y, vx, vy, life, color})
- All positions interpolated by `alpha` for smoothness

### 4.5 Audio System (`systems/AudioSystem.ts`)
- Preload sounds via `AudioContext` + `fetch` → `decodeAudioData`
- Pool approach: create `AudioBufferSourceNode` per play call
- Exposed methods: `play(soundId)`, `setMute(bool)`, `getMute()`
- Sound IDs: `'paddleHit' | 'brickHit' | 'brickDestroy' | 'powerUp' | 'lifeLost' | 'levelComplete' | 'gameOver'`
- Mute state persisted to `localStorage`

---

## Phase 5 — Screens & State Management

### 5.1 Screen Interface
```typescript
interface Screen {
  enter(ctx: GameContext): void;
  exit(): void;
  update(dt: number): void;
  render(ctx: CanvasRenderingContext2D, alpha: number): void;
  handleInput(input: InputSystem): void;
}
```

### 5.2 Title Screen
- Render game title, "Play" button, high score (from `localStorage`)
- On play: transition to `LEVEL_SELECT`

### 5.3 Level Select Screen
- Grid layout (e.g. 3×4 or scrollable)
- Each cell shows level number + best score
- States: locked (greyed), unlocked (normal), completed (checkmark + score)
- Unlock rule: levels 1–5 always unlocked; completing level N unlocks up to N+5
- On tap/click level: transition to `PLAYING` with that level loaded

### 5.4 Game Screen (PLAYING state)
- Instantiate paddle, balls list (single ball), bricks from level data, empty power-up list, empty laser list
- Run physics + collision each tick
- Ball list supports multi-ball; life lost only when list empties
- On level clear (all breakable bricks destroyed, no score minimum) → `LEVEL_COMPLETE`
- On lives = 0 → `GAME_OVER`
- On pause input → `PAUSED`

### 5.5 Pause Overlay
- Semi-transparent overlay
- "Resume" and "Quit" buttons
- Resume → back to `PLAYING`; Quit → `LEVEL_SELECT`

### 5.6 Level Complete Screen
- Show score breakdown, combo stats
- Save best score to `localStorage` if higher
- Unlock next levels
- "Next Level" button (or "You Win!" if last level)

### 5.7 Game Over Screen
- Final score, "Retry" (same level) and "Menu" buttons

---

## Phase 6 — Persistence (`storage/SaveManager.ts`)

- `SaveData` interface:
  ```typescript
  interface SaveData {
    highestUnlocked: number;   // highest level index unlocked
    bestScores: Record<number, number>;  // levelIndex → best score
    muted: boolean;
  }
  ```
- `load(): SaveData` — read from `localStorage`, return defaults if missing/corrupt
- `save(data: SaveData): void` — serialize to JSON, write to `localStorage`
- `resetProgress(): void` — clear save data
- Key: `"brickblaze_save_v1"` with migration from the legacy `"brickBreaker_save_v1"` key

---

## Phase 7 — Level Data (`levels/`)

### 7.1 Format
```typescript
// Each level is a 2D array: rows × BRICK_COLS
// Values: 0 = empty, 1 = standard, 2 = tough, 3 = armored, 4 = unbreakable, 5 = explosive
type LevelData = {
  grid: number[][];
  ballSpeedMultiplier: number;  // e.g. 1.0 for level 1, 1.5 for level 10
};
```

### 7.2 Level design guidelines
- Levels 1–3: mostly standard bricks, simple layouts, speed ×1.0
- Levels 4–6: introduce tough bricks, some unbreakable walls, speed ×1.1–1.2
- Levels 7–8: armored + explosive bricks, creative patterns, speed ×1.3
- Levels 9–10: dense layouts mixing all types, speed ×1.4–1.5

---

## Phase 8 — Polish & Particles

- Brick destroy particles: 6–10 small squares in brick color, random velocity, fade over 0.4s
- Ball trail: last 5 positions rendered as fading circles
- Power-up item: pulsing glow / icon label
- Screen transitions: quick fade (150ms)

---

## Implementation Order (Build Sequence)

| Step | Deliverable | Dependencies |
|------|-------------|--------------|
| 1 | Project scaffold + Vite + TS config | None |
| 2 | Canvas setup + scaling + game loop shell | Step 1 |
| 3 | Types, constants, input system | Step 2 |
| 4 | Paddle + ball + basic physics (bounce off walls) | Step 3 |
| 5 | Brick grid rendering + ball-brick collision | Step 4 |
| 6 | Scoring + combo system + HUD | Step 5 |
| 7 | Lives system + ball reset | Step 6 |
| 8 | State machine + title/game-over screens | Step 7 |
| 9 | Level data (10 levels) + level select screen | Step 8 |
| 10 | localStorage persistence | Step 9 |
| 11 | Power-up system (drop, collect, effects) | Step 7 |
| 12 | Explosive brick cascade | Step 5 |
| 13 | Audio system + SFX | Step 8 |
| 14 | Particles + visual polish | Step 5 |
| 15 | Touch input + mobile testing | Step 3 |
| 16 | Final tuning + play-testing | All |

---

## Testing Strategy

- **Manual play-testing** at each step (browser hot reload via Vite)
- **Unit-testable** logic: collision math, combo calculator, save/load serialization
- Optional: add Vitest for critical math utilities
- Cross-browser check: Chrome, Firefox, Safari (mobile Safari for touch)
- Performance target: 60 FPS on mid-range mobile devices
