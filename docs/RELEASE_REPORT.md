# Release Report — Lost Features 0.1.0

Date: 2026-10-24. Target: Minecraft Java Edition 26.2, NeoForge 26.2.0.75, Java 25.

## Artifacts (produced by `./gradlew build sourceArchive`)

| File | Size | Notes |
|---|---|---|
| `build/libs/lostfeatures-0.1.0.jar` | ≈ 8.9 MB, 843 entries | Mod JAR: classes, 101 textures, 101 audio files (108 sound events), data |
| `build/libs/lostfeatures-0.1.0-project-src.zip` | ≈ 8.9 MB | Full source project (code, resources, tools, docs, Gradle wrapper) |

The `build/` folder is not committed; rebuild with the command above. The source is also on the
branch `claude/lost-features-living-world`.

## Status summary

| Status | Scope |
|---|---|
| **Implemented** | Everything in FEATURE_CATALOG.md except the "Deferred" list |
| **Compiled** | Whole project, 0 compile errors |
| **Automated tests passed** | 24 Lost Features GameTests (+ vanilla `always_pass`): "All 25 required tests passed"; static resource validation passed |
| **Runtime-tested (dedicated server)** | Startup with 0 errors; all 4 creatures; all 4 events start and resolve; refusal reasons; memory and event persistence across restarts; 4 structures placed by command and 2 found by `locate`; Far Lands chunks generate; all-features-disabled world loads cleanly |
| **Client-tested** | **No** — no display/GPU in the build environment |
| **Multiplayer-tested** | **No** — no real players joined |
| **Deferred** | Dragon taming/riding/breeding, Far Lands anomalies, piglin ruby interactions, per-team progression |
| **Blocked** | Client visual/audio review and real multiplayer testing (environment) |

## Fixes found during testing

* Runic Logic Device sequence mode: vanilla de-duplicates scheduled ticks per position, so sequence
  timeouts were lost. Timing moved to the block entity ticker. (Found by GameTest `runic_sequence`.)
* Story sync and announcements crashed for players without a network connection (mock players).
  Guarded.
* Several sound effects were too loud; all audio re-rendered with peak ≤ -1.5 dBFS.
* *Village Under Threat* could fail when no clear spot for a Giant existed; it now falls back to
  Killer Bunnies and reports a precise refusal reason.
* Mod display name was mis-encoded in `neoforge.mods.toml` (properties files are ISO-8859-1); fixed
  with a Unicode escape.

## Known issues / risks

* Models, animations, GUI and audio have never been seen or heard in a running client; expect visual
  tuning to be needed (proportions, animation timing, texture readability).
* Boss balance (Ancestral Red Dragon) is untested with real players.
* `obsidian_wall`, `monolith` and `ancient_ruins` are biome/terrain checked; `/place` at an unsuitable
  spot fails by design.
* A vanilla dev-environment diagnostic (`unsafe terrain read ... sculk_patch_deep_dark`) can appear on
  first world generation; it is not caused by this mod.

## Recommended next steps

1. Launch `./gradlew runClient`, review every creature, block, item, the journal screen and music.
2. Run a multiplayer session (2-5 players) through the finale.
3. Then consider the deferred features.
