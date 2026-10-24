# Testing

Everything below was actually executed in the development container on 2026-10-24 against the code in
this repository. Things that could not be executed are listed at the end — they are **not** claimed.

## 1. Automated GameTests

```
./gradlew runGameTestServer
```

Source: `src/gameTest/java/com/lostfeatures/test/LostFeaturesGameTests.java` (a separate source set,
not shipped in the JAR). Last result: **`All 25 required tests passed :)`** — 24 Lost Features tests plus
vanilla's built-in `minecraft:always_pass`.

| Test | What it proves |
|---|---|
| `registries_complete` | Every block, item, entity, block entity, sound, painting and jukebox song is registered |
| `recipes_namespaced_and_valid` | At least 40 `lostfeatures:` recipes load and vanilla recipes are still present (e.g. `minecraft:diamond_pickaxe`) |
| `loot_tables_resolve` | Every entity/chest/block loot table exists and rolls without error |
| `vanilla_untouched` | `minecraft:giant`, `minecraft:illusioner`, rabbits, Ender Dragon and Wither keep vanilla attributes |
| `sensor_detects_creature` | Event Sensor (creature filter) emits a signal when a Lost Features creature is in range |
| `sensor_mechanism_pulse` | Sensor reacts to mechanism signals |
| `reactor_finite_charge` | Reactor accepts only fuel items, spends charge per pulse, stops when empty |
| `runic_and_gate` | Runic Logic Device AND mode |
| `runic_sequence` | Sequence mode accepts the right order within the timeout (this test found a real timing bug, now fixed) |
| `secret_door_group` | Secret door blocks open/close as one connected group |
| `dart_trap_fires_once` | One dart per rising edge |
| `spike_trap_damages` | Extended spikes damage an entity standing on them |
| `locked_chest_unlocks` | Ancient Key turns a Locked Chest into a vanilla chest with a loot table |
| `quiver_supplies_bow` | A bow draws from the quiver when the player has no loose arrows; count decreases |
| `story_idempotent_rewards` | Repeated unlocks grant a milestone reward exactly once |
| `creative_spawn_no_progress` | Spawn-egg/command creatures never grant story progress |
| `red_dragon_flight_and_persistence` | The dragon takes off, stays in the world height, and its state survives save/load |
| `relationship_goals_injected` | Relationship rules load; a cow receives the fear goal; unrelated mobs are untouched |
| `event_memory_bounded` | Memory never exceeds its configured record cap |
| `ancient_disturbance_lifecycle` | Event runs STARTING → ACTIVE → RESOLVING → DONE |
| `far_lands_density_bounded` | The Far Lands density function stays finite and bounded over a large sample |
| `structures_build_signature_blocks` | Each structure piece builds its signature blocks |
| `red_dragon_breath_is_telegraphed` | No breath fire appears before the 16-tick charge completes |
| `giant_slam_after_windup` | The Giant slam only lands after its 30-tick windup |

## 2. Static resource validation

```
python3 tools/validate_resources.py
```
Result: `blocks=22 items=63 entities=4 recipes=44 sounds=108 lang=305` — `all resource checks passed`.
It checks that JSON parses, blockstate → model → texture chains resolve, item models exist, every
`sounds.json` file exists, every id has a translation, recipe/loot references exist and recipe ids are
unique and namespaced, and painting textures match their declared size.

## 3. Dedicated-server smoke test (real NeoForge 26.2 server)

```
python3 tools/servertest/run_server_test.py build/server_test.log full
```
This starts `./gradlew runServer` and drives it over RCON (the Gradle run does not forward stdin). It
requires `run/server.properties` with `enable-rcon=true`, `rcon.port=25575`,
`rcon.password=lostfeatures-test` and `pause-when-empty-seconds=0` (otherwise an empty server pauses
and nothing ticks), plus `eula=true`.

Results of the latest run (after the final code change):

* Server started with **0 ERROR lines** from the mod or the game.
* Spawned all four creatures; Red Dragon 160 HP as configured.
* `dragon_hunting_grounds` was **refused with the exact reason** "population cap: 1 Red Dragon(s)
  within 256 blocks" while a dragon existed, then started after it was killed.
* All four events started and resolved: `ancient_disturbance` → `guardian_awakened` (an earlier run
  ended `clue_surfaced`), `village_under_threat` → `repelled` (Killer Bunny variant), dragon event →
  `slain`, `illager_expedition` → `leader_lost`.
* Event memory grew and persisted across server restarts (25 → 35 records in one session, carried
  into the next).
* An event started in one session resolved in the next (earlier run), proving event persistence.
* `/place structure` succeeded for `starting_house`, `brick_pyramid`, `glass_pillar`, `dragon_lair`.
  `obsidian_wall`, `monolith` and `ancient_ruins` reported "Failed to place structure" at the test
  coordinates because their biome / terrain checks reject that spot — expected. `locate` found
  natural `ancient_ruins` and `brick_pyramid`, so they generate in real worlds.
* `lostfeatures:far_lands` chunks generated; block probes show solid walls and air gaps at
  different heights (tunnels/walls), as designed.

### All-features-disabled run
`run_server_test.py <log> disabled` with every toggle set to `false` in `lostfeatures-common.toml`:
world loaded with 0 errors, no Lost Features structures generated (`locate` finds none), dragon events
are refused ("dragon spawning disabled or not the Overworld"), creatures can still be summoned by
command (registries stay present so existing worlds keep loading).

### Known vanilla diagnostic
On the very first generation of a new world, NeoForge's development environment logged 27 lines of
`Detected unsafe terrain read during worldgen ... minecraft:sculk_patch_deep_dark`. They come from the
**vanilla** deep-dark sculk feature (a dev-time diagnostic), not from Lost Features code; later runs on
the same world logged none.

## 4. Build

```
./gradlew build sourceArchive
```
produces `build/libs/lostfeatures-0.1.0.jar` and `build/libs/lostfeatures-0.1.0-project-src.zip`.

## 5. Not tested (could not be executed here)

* **Client**: no display or GPU in the container, so rendering, models, animations, the journal
  screen, situational music, sound playback and texture appearance were **not** seen or heard.
  They compile, and their resources pass static validation.
* **Multiplayer with real players**: no player ever joined. Multiplayer logic (participant credit,
  boss scaling, per-player progress, server-authoritative sync) is implemented and partly covered by
  GameTests with mock players only.
* Player-driven boss fights (Ancestral Red Dragon), copper horn playback, armor appearance.

## How to test manually

1. `./gradlew runClient`, create a creative world.
2. Open the *Lost Features* creative tab; place spawn eggs.
3. `/lostfeatures event start dragon_hunting_grounds` (operator) and watch for the warning roar and
   telegraphed breath.
4. `/locate structure lostfeatures:brick_pyramid`, `/lostfeatures story list @s`.
5. Set `general.debugLogging = true` to see `[director]` / `[memory]` log lines.
