# Feature Catalog

Classification codes are defined in [RESEARCH.md](RESEARCH.md): **HI** historically implemented,
**HU** historically unused, **RM** removed, **DI** discussed only, **AF** April Fools/experimental,
**OR** original Lost Features invention.

Status columns use the strict vocabulary from the brief:

* **Impl** — code/data exists in the repository.
* **Build** — compiles and is packaged in the JAR.
* **Auto** — covered by a passing automated GameTest (`./gradlew runGameTestServer`: 24 Lost Features tests plus vanilla's built-in `minecraft:always_pass`; "All 25 required tests passed").
* **Server** — exercised on a real NeoForge 26.2 *dedicated server* (RCON-driven smoke test; see TESTING.md).
* **Client** — exercised in a game client. **No client run was possible in this environment** (no
  display/GPU), so rendering, GUI, situational music and sound playback are compiled but not visually
  verified. They are marked "-".
* **MP** — multiplayer-tested with several real players: **not done** for any feature (marked "-");
  multiplayer rules are implemented and server-side only.

| Feature | Class | Impl | Build | Auto | Server | Client | Notes |
|---|---|---|---|---|---|---|---|
| Ruby ore / deepslate ore, ruby, ruby block, ruby bricks | HU/RM → OR role | ✔ | ✔ | ✔ (recipes, loot) | ✔ (worldgen loaded) | - | Fortune/Silk Touch via vanilla ore loot functions |
| Ruby worldgen (config-gated biome modifiers) | OR | ✔ | ✔ | - | ✔ (on/off verified) | - | Only new chunks |
| Red Dragon (ground/flight AI, breath, hunting, territory) | DI → OR | ✔ | ✔ | ✔ (flight+persistence, breath telegraph) | ✔ (spawn, kill, event) | - | Taming/riding/breeding deferred |
| Ancestral Red Dragon boss (phases, boss bar, MP scaling) | OR | ✔ | ✔ | ✔ (ancestral flag persists) | partial (no player fight) | - | Summoned at Ancient Altar |
| Giant (AI, telegraphed slam, escort, terrain rules) | HU → OR | ✔ | ✔ | ✔ (windup before slam) | ✔ | - | Vanilla `minecraft:giant` untouched |
| Illusioner (vanilla mirror images + blink + disorientation) | HU → OR | ✔ | ✔ | ✔ (registration, loot) | ✔ (spawn, expedition) | - | Vanilla `minecraft:illusioner` untouched |
| Killer Bunny (hop AI, warning, wolves/foxes) | HU → OR | ✔ | ✔ | ✔ (sensor detection) | ✔ | - | Vanilla rabbits untouched |
| Spawn eggs (4) + creative tab | OR | ✔ | ✔ | ✔ (eggs target our types) | - | - | Creative spawns never grant story progress |
| Trophy materials (scale, fang, heart, membrane, bone, shard, dust, lens, notes, vorpal fang, trophies) | OR | ✔ | ✔ | ✔ (loot tables resolve) | ✔ (kills drop loot) | - | Every drop has a use or is documented as a trophy |
| Quiver | RM → OR | ✔ | ✔ | ✔ (bow draws, count decreases) | - | - | No inventory rewrite |
| Studded armor | RM → OR | ✔ | ✔ | - | - | - | Between chain and iron |
| Dragonscale chestplate, Fang Blade | OR | ✔ | ✔ | - | - | - | Smithing / crafting |
| Copper horn (10 tunes x 3 parts) | RM | ✔ | ✔ | - | - | - | 30 original tunes |
| Locked chest + Ancient Key | AF/RM → OR | ✔ | ✔ | ✔ (unlock → vanilla chest) | - | - | Unbreakable in survival |
| Rose, Cyan Rose (+ worldgen) | RM | ✔ | ✔ | - | ✔ (feature loaded) | - | Dye sources |
| Ancient Event Sensor | OR | ✔ | ✔ | ✔ (creature + mechanism pulse) | - | - | Bounded AABB queries, staggered |
| Ancient Energy Reactor | OR | ✔ | ✔ | ✔ (fuel filter, finite spend) | - | - | Hopper input via capability |
| Runic Logic Device (AND, majority, sequence, latch) | OR | ✔ | ✔ | ✔ (AND, sequence) | - | - | Timing bug found by tests and fixed |
| Ancient Secret Door, Illusory Wall | OR | ✔ | ✔ | ✔ (door group) | - | - | |
| Dart Trap, Spike Trap | OR | ✔ | ✔ | ✔ (one dart per edge, spikes hurt) | - | - | Darts cannot be picked up |
| Ancient Altar | OR | ✔ | ✔ | - | - | - | Boss cannot be stacked (160-block exclusion) |
| Relationship engine (data-driven, 10 default rules) | OR | ✔ | ✔ | ✔ (rules load, cow gets fear goal) | ✔ (rules loaded) | - | Reload-safe |
| Bounded event memory | OR | ✔ | ✔ | ✔ (cap enforced) | ✔ (records grow, persist) | - | |
| Regional ecology | OR | ✔ | ✔ | - | ✔ (used by event checks) | - | Loaded chunks only |
| Event: Dragon Hunting Grounds | OR | ✔ | ✔ | - | ✔ (start, refusal reason, slain) | - | |
| Event: Village Under Threat | OR | ✔ | ✔ | - | ✔ (start, repelled, restart persistence) | - | Uses vanilla bell-alarm memory |
| Event: Illager Expedition | OR | ✔ | ✔ | - | ✔ (start, leader_lost) | - | Leader always drops notes |
| Event: Ancient Disturbance | OR | ✔ | ✔ | ✔ (full lifecycle to DONE) | ✔ (clue/guardian outcomes) | - | |
| Natural Giant / Killer Bunny appearances | OR | ✔ | ✔ | - | - | - | Commands provided for testing |
| Brick Pyramid | RM → reinterpretation | ✔ | ✔ | ✔ (builds, loot) | ✔ (/place, locate) | - | Hidden chamber is an OR addition |
| Starting House | RM | ✔ | ✔ | ✔ | ✔ (/place) | - | |
| Obsidian Wall | RM → reinterpretation | ✔ | ✔ | ✔ | - (biome-checked /place) | - | |
| Glass Pillar + lab | RM → reinterpretation | ✔ | ✔ | ✔ | ✔ (/place) | - | |
| Monolith | RM → reinterpretation | ✔ | ✔ | ✔ | - (biome-checked /place) | - | |
| Ancient Ruins (runic puzzle vault) | OR | ✔ | ✔ | ✔ | ✔ (locate) | - | |
| Dragon Lair (altar + resident dragon) | OR | ✔ | ✔ | ✔ | ✔ (/place) | - | |
| Far Lands dimension (custom density) + Edge Compass | RM → recreation | ✔ | ✔ | ✔ (density bounded) | ✔ (chunks generate; walls probed) | - | Anomalies deferred |
| Story: journal, bestiary, 20 milestones, rewards | OR | ✔ | ✔ | ✔ (idempotent rewards, creative guard) | ✔ (saved data loads) | - | Journal screen not visually tested |
| Ender Dragon / Wither milestone observers | OR | ✔ | ✔ | - | - | - | Listen-only; stats-based recovery |
| Paintings (13) | OR art | ✔ | ✔ | ✔ (variant registered) | ✔ (registry loaded) | - | Added to `#placeable` additively |
| Music discs (7, distinct tracks) | OR | ✔ | ✔ | ✔ (jukebox song registered) | ✔ (registry loaded) | - | Playback not heard |
| Sound events (108) | OR | ✔ | ✔ | - | - | - | All files exist and were loudness-checked |
| Situational music | OR | ✔ | ✔ | - | - | - | Client-only |
| Config + datapack conditions | OR | ✔ | ✔ | - | ✔ (all-disabled world loads cleanly) | - | |
| Wandering trader ruby offer | OR | ✔ | ✔ | - | ✔ (trade data loads) | - | Appended to vanilla tag |
| Admin commands `/lostfeatures` | OR | ✔ | ✔ | - | ✔ | - | Permission level 2 |

## Deferred (not implemented)

* Red Dragon taming / riding / breeding (the brief allows these only if core behaviour is complete;
  core is complete but these need client input handling and multiplayer testing that could not be
  done here).
* Far Lands "anomalies" (optional per the brief).
* Piglin ruby interactions (optional; skipped to avoid touching vanilla bartering).
* Per-team progression (milestones are per-player; see STORY_AND_BOSSES.md).
* Additional removed mobs (see RESEARCH.md: test mobs only, no gameplay design to restore).

## Blocked in this environment

* Client launch (rendering, GUI, audio playback, visual animation review): no display/GPU.
* Real multiplayer testing with several human clients.
