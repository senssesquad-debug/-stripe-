# Living World Simulation

Everything here runs on the server, only in loaded chunks, and is bounded by explicit caps. No chunk
is ever loaded or force-loaded by the mod, nothing is simulated in unloaded chunks, and no animal is
ever removed to "balance" a population.

## 1. Relationship engine

**Code:** `entity/ai/relationship/*`. **Data:** `data/<namespace>/lostfeatures/relationships/*.json`
(any datapack can add, override or neutralise rules).

```json
{
  "subject": "#lostfeatures:dragon_prey",      // entity id or #entity_type tag
  "target": "lostfeatures:red_dragon",         // entity id or #entity_type tag
  "relation": "fear",                          // fear | predator | enemy | protect_owner | support | escort | neutral
  "range": 20, "priority": 1, "speed": 1.4,    // optional
  "condition": "always",                       // always | tamed | untamed | night | day
  "cooldown": 200                              // used by "support"
}
```

How it works:

* On `EntityJoinLevelEvent` (server), a mob whose type matches a rule's *subject* receives **one added
  goal per matching rule**. Vanilla goals are never removed or replaced; mobs that match no rule are
  completely unaffected.
* Goals store only the rule id and re-read the rule every time they evaluate, so `/reload` changes or
  removals apply to mobs already in the world, and `living_world.relationshipsEnabled = false` makes
  every injected goal inert immediately.
* Target searches reuse vanilla targeting (`NearestAttackableTargetGoal` / `AvoidEntityGoal`) with
  their built-in random intervals, so there is **no per-tick all-pairs scan**. Support/escort goals
  query a small AABB at most every 40 ticks per mob.
* `living_world.relationshipIntensity` scales all ranges.

Default rules (all in `data/lostfeatures/lostfeatures/relationships/`):

| Rule | Effect |
|---|---|
| `prey_fear_red_dragon` | Livestock and wild prey flee the Red Dragon |
| `prey_fear_giant` | Prey flee the Giant |
| `wolves_hunt_killer_bunny` | Untamed wolves attack Killer Bunnies |
| `killer_bunny_hunts_foxes` | Killer Bunnies attack foxes (as documented for the historical variant) |
| `foxes_fear_killer_bunny` | Foxes flee Killer Bunnies |
| `tamed_wolves_protect_owner` | Tamed wolves attack Lost Features threats that come near their owner |
| `witches_support_giant` | Witches throw Regeneration at a badly hurt Giant (cooldown 240 ticks) |
| `undead_escort_giant` | At night, zombies/skeletons near a Giant march with it |
| `dragon_giant_rivals` | Red Dragons and Giants are territorial rivals |
| `illusioner_neutral_to_witch` | Documents neutrality explicitly |

Vanilla integrations that do not need injected goals:

* **Iron golems** already target every `Enemy`; all Lost Features creatures are monsters, so golem
  defence uses vanilla behaviour. During *Village Under Threat* idle golems are additionally pointed
  at the nearest threat (event-scoped).
* **Villagers** shelter through their **own** vanilla bell-alarm memory (`HEARD_BELL_TIME`) set by the
  *Village Under Threat* event; their brain is not modified.
* **Illagers** take part in *Illager Expeditions* through vanilla patrol targets.

## 2. Bounded local event memory

**Code:** `world/memory/EventMemory.java` (one `SavedData` per dimension, versioned).

Records are value objects only: `{type, pos, short detail, gameTime}` — never entity references.
Types: predator attack, dragon sighting, village threat, illager expedition, boss encounter,
structure discovery, ancient disturbance. Caps: `living_world.memoryMaxRecords` (default 256, oldest
dropped first) and `living_world.memoryExpiryTicks` (default 7 in-game days). Verified by the GameTest
`event_memory_bounded` and on the dedicated server (records persisted across a restart).

## 3. Regional ecology

**Code:** `world/ecology/RegionalEcology.java`. A read-only snapshot computed on demand from memory
records plus *one* bounded entity query (48-block radius) around a position: predator activity, prey
availability, threat level, recent combat, rare-creature activity. It is used to decide whether an
area suits *Dragon Hunting Grounds* (enough prey, no recent feeding) and whether a village needs rest
before another threat. It does not store anything and never alters populations.

## 4. Encounter director and events

**Code:** `world/event/*`. One `EncounterDirector` `SavedData` per dimension, ticked from
`LevelTickEvent.Post`:

* every 20 ticks: advance active events (only if any exist);
* every `events.checkIntervalTicks` (default 1200): for each non-spectator player, roll natural
  appearances and, if allowed, try one new event near that player.

Bounds: `events.maxActiveEventsPerDimension` (2), `events.globalCooldownTicks` (24000), a per-type
cooldown (36000), `events.maxDurationTicks` (12000) after which an event resolves itself. Participants
are stored as UUIDs and looked up each tick; if they are unloaded the event simply pauses. Events
persist across restarts (verified: an event started in one server session resolved in the next).

State machine for every event: **STARTING → ACTIVE → RESOLVING (200 ticks) → DONE** (removed).
RESOLVING performs cleanup: event creatures that no player can see (no player within 48 blocks, not
named) are removed; anything near a player stays and finishes naturally.

| Event | Trigger (natural) | Behaviour | Resolution |
|---|---|---|---|
| **Dragon Hunting Grounds** | Overworld, player in a `dragon_habitat` biome (config list), ≥512 blocks from world spawn, chance `red_dragon.spawnChance` (0.004/check), dragon cooldown (72000), ≤ `maxNearby` dragons within 256, ≥2 prey near the spot, no beds within 48 (config) | A natural Red Dragon arrives airborne over a spot 48-96 blocks away and is periodically pointed at prey in its territory; feeding leaves charred remains and scorched (regrowing) grass; distant roar cue | `slain` / dragon gone, or `timed_out` |
| **Village Under Threat** | Overworld, night, bell POI within 64 blocks, chance 0.03, not another threat within 128, village not recently threatened | A Giant with two zombie escorts (70%) or two Killer Bunnies march on the bell; villagers shelter (bell memory), golems engage; alarm cue | `repelled` when all threats are gone, else `timed_out` |
| **Illager Expedition** | A structure the player discovered ≥6000 ticks ago within 160 blocks, chance 0.03, no expedition there in 3 days | Illusioner leader + 2-3 pillagers/vindicators patrol to the site and survey it for 60 s | `leader_lost` (leader always drops Encrypted Notes), `survey_complete`, or `timed_out` |
| **Ancient Disturbance** | A discovered site within 96 blocks (≥1200 ticks old), chance 0.05, none there in the last day | 5 s tremor (sound, ash, enchant particles, sensor pulses), then one outcome: a clue (Encrypted Notes), a guardian (Killer Bunny or Illusioner) or a revealed Locked Chest placed only into air on ancient masonry | after 20 s settle |

Natural appearances (not events): a night-time Giant march (chance 0.006/check, none within 128) and a
Killer Bunny beside a wild rabbit at least 16 blocks from the player (chance 0.01/check, none within 64).

Discoverability: events post signals that Ancient Event Sensors in *encounters* mode react to, play
distinct audio cues, write memory records and (for creatures) unlock bestiary entries.

Debugging: `general.debugLogging = true` logs `[director]` and `[memory]` lines;
`/lostfeatures event list|start <type> [pos]|stop <id>` and `/lostfeatures encounter giant|killer_bunny`
(operators only). Forced starts skip chance and cooldowns but **never** safety checks, and report the
exact refusal reason (e.g. *"population cap: 1 Red Dragon(s) within 256 blocks"*).

## 5. Natural creature lifecycle

Naturally placed creatures (events/appearances) use `LostCreatureLifecycle`: if no player has been
within 160 blocks for 6000 ticks *of the creature ticking*, it leaves. Named, leashed, persistent,
creative-spawned and boss creatures are never removed this way. Lair dragons are persistent.

## 6. Performance budget summary

| System | Worst-case work |
|---|---|
| Event Sensor | one AABB query (≤32 radius) per sensor every 10 ticks, staggered by position |
| Signals | ≤128 transient signals per dimension, pruned after 100 ticks |
| Relationship goals | vanilla targeting intervals; escort/support ≤ 1 small query / 40 ticks / mob |
| Director | ≤ 1 evaluation per 1200 ticks per dimension; ≤ 2 active events |
| Story discovery | 1 structure lookup per player per 40 ticks until the site milestone is unlocked |
| Situational music (client) | one 48-block entity query + 9x5x9 block scan per second |
| Dragon breath scorch | ≤ `maxScorchBlocksPerBreath` (6) blocks per breath |
| Giant slam terrain | ≤ 8 plant/leaf blocks per slam |
