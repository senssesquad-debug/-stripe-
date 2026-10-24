# Compatibility

Lost Features is **additive**. It uses no mixins, no access transformers and no coremods, does not
replace any vanilla registry entry and does not cancel any vanilla event.

## What touches vanilla, and how

| Area | Mechanism | Effect on vanilla |
|---|---|---|
| Tags under `data/minecraft/tags/` (mineable, needs_iron_tool, small_flowers, armor/sword item tags, `is_fire`, `no_knockback`, painting `placeable`, wandering trader `uncommon` trades) | All use `"replace": false` | Mod entries are **appended**; vanilla entries stay |
| Ruby ore, extra ruby ore, roses | NeoForge biome modifiers with `lostfeatures:config_enabled` conditions | Adds features in new chunks only; nothing removed |
| Structures | New structures + structure sets, condition-gated | Vanilla structures, spacing and villages untouched |
| Far Lands | Separate dimension `lostfeatures:far_lands` | Overworld generation untouched |
| Wandering trader | One extra offer through the data-driven trade tag | Existing offers unchanged |
| Mob behaviour | `EntityJoinLevelEvent` *adds* goals per data-driven rule | No vanilla goal removed or replaced; mobs matching no rule are unaffected |
| Villagers | Vanilla bell-alarm memory set during *Village Under Threat* | Brain not modified |
| Ender Dragon / Wither | Listen-only `LivingDamageEvent.Post` / `LivingDeathEvent` at lowest priority | Behaviour, drops, egg, portal, XP and advancements unchanged |
| Bow / crossbow ammo | `LivingGetProjectileEvent`, only when vanilla found **no** ammo and the player carries a quiver | Vanilla ammo selection unchanged |
| Music (client) | `SelectMusicEvent`: replaces the background track only near Lost Features creatures, in the Far Lands, ancient sites or active mechanisms; config `audio.situationalMusic` | Elsewhere vanilla music plays normally; jukeboxes unaffected |
| `minecraft:giant`, `minecraft:illusioner`, rabbits | Not touched — Lost Features creatures are separate entity types | Verified by GameTest `vanilla_untouched` |

## Disabling features

Every content system has a toggle in `config/lostfeatures-common.toml`. Disabled features stop
generating or spawning but **registries stay**, so worlds that already contain Lost Features blocks,
items or creatures still load. Worldgen toggles are read through datapack conditions when the world
loads; they affect newly generated chunks.

## Other mods and datapacks

* Relationship rules, loot tables, recipes, tags, structures and trades are ordinary data files — any
  datapack can override or neutralise them.
* Entity type tags (`#lostfeatures:dragon_prey`, ...) let other mods' animals join relationships.
* The Ancient Energy Reactor exposes the NeoForge item capability, so hoppers and pipe mods can fuel it.
* Recipe ids are all `lostfeatures:` and the mod ships no file under `data/minecraft/recipe/`, so no
  vanilla recipe is overridden (static validation checks the namespaces; GameTest
  `recipes_namespaced_and_valid` checks that vanilla recipes still load).

## Requirements

Minecraft Java Edition 26.2, NeoForge 26.2.0.75 or newer in the 26.2 line, Java 25. Required on both
client and server (it adds blocks, items and entities).

## Known limitations

* Client-side rendering and multiplayer with real players are untested (see TESTING.md).
* Situational music competes with other mods that also set music through `SelectMusicEvent`; the last
  listener wins. Disable `audio.situationalMusic` if that conflicts.
