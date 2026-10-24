# Story and Bosses

> All story text is **original Lost Features lore**, not Minecraft canon. In-game it lives under the
> `journal.lostfeatures.*` and `glyph.lostfeatures.*` translation keys.

## The Emberwrights

An ancient people who studied the red, earthbound dragons, tuned machines to the resonance of ruby,
marked their outposts with brick pyramids, glass pillars, obsidian walls and monoliths, and mapped
"the Edge" where the world forgets how to be smooth (the Far Lands). They bound the eldest of the red
dragons beneath an altar in a mountain lair and left a sigil recipe in cipher. The player follows their
trail through the **Ancient Journal**.

## Journal

The Ancient Journal (book + ruby, or found in a Starting House) opens a two-tab screen: **Chronicle**
and **Bestiary**. Locked entries show a hint instead of their text, so players see what remains. The
server is authoritative: the client only receives the list of unlocked ids (`JournalPayload`) on login,
on each unlock and when the journal is opened.

### Milestones (stable ids — never renamed)

| Id | Trigger | Reward (granted once) |
|---|---|---|
| `first_steps` | obtain/use an Ancient Journal | - |
| `ruby_found` | pick up or craft a ruby | - |
| `ancient_site` | stand inside any Lost Features structure (checked every 2 s) | Ancient Key |
| `glyphs_read` | read an Ancient Glyph Brick | - |
| `notes_found` | obtain Encrypted Notes | - |
| `notes_decoded` | craft Decoded Notes | Ancient Smithing Template |
| `locked_chest_opened` | unlock a Locked Chest | - |
| `mechanism_built` | craft or activate an ancient device | - |
| `reactor_awakened` | activate an Ancient Energy Reactor | - |
| `far_lands_reached` | travel with the Edge Compass | - |
| `ender_dragon_victory` | vanilla Ender Dragon defeated (see below) | Music Disc "Dragon's Omen" |
| `wither_victory` | vanilla Wither defeated (see below) | Music Disc "Ruby Resonance" |
| `sigil_forged` | craft the Draconic Sigil | - |
| `altar_awakened` | use the sigil on an Ancient Altar | - |
| `ancestral_defeated` | help defeat the Ancestral Red Dragon | Music Disc "The Last Monolith" + 2 Ancient Smithing Templates |
| `dragon_sighted` | be near a natural Red Dragon when it warns | (bestiary) |
| `dragon_defeated` | help defeat a natural Red Dragon | (bestiary) |
| `giant_defeated` / `illusioner_defeated` / `killer_bunny_defeated` | help defeat one | (bestiary) |

The arc can be explored in any order; the only hard chain is the finale (decoded notes → sigil →
altar → Ancestral dragon), and its inputs come from one Giant, one Red Dragon and one Illusioner-related
find — no grinding and no repeated boss fights.

### Progression integrity

* **Per-player** milestones in a server-wide `SavedData` (`story_progress`, versioned). Each unlock is
  idempotent: the first call returns true and grants the reward; later calls do nothing. Duplicate
  event delivery, reloads, re-kills and re-summons cannot duplicate rewards (GameTest
  `story_idempotent_rewards`).
* **Per-world flag** `ancestral_silenced` records that someone completed the finale; late joiners see a
  note in their journal but can still complete it themselves (the altar can be used again with a new
  sigil).
* **Who is credited for a kill:** the killer plus players who damaged the creature (tracked by UUID,
  capped at 32) and are within 128-192 blocks. Standing nearby is never enough.
* **Creative / admin spawns** (spawn egg, `/summon`, spawner, dispenser) are tagged in the entity's
  persistent data and never grant milestones unless `story.creativeSpawnsGrantProgression = true`
  (GameTest `creative_spawn_no_progress`). Loot still drops.
* `/lostfeatures story unlock` exists for administrators; it uses the same idempotent path.
* Milestone ids are separate from vanilla advancements; no vanilla advancement is read for unlocks
  or modified.

## Vanilla boss milestones (listen-only)

`story/VanillaBossObserver.java` observes, at the lowest priority and without cancelling anything:

* `LivingDamageEvent.Post` on an Ender Dragon or Wither — records which players dealt damage (≤32 per
  boss, ≤16 bosses tracked);
* `LivingDeathEvent` for those bosses — credits the killer plus recorded participants within 192 blocks.

Existing worlds: on login, the vanilla per-player statistic `minecraft:killed` for the Ender Dragon or
Wither unlocks the milestone retroactively, so players who defeated them before installing the mod are
recognised. Neither boss's behaviour, health, drops, egg, portal, experience, spawning or advancements
is changed (GameTest `vanilla_untouched` checks their default attributes).

## Bosses and encounters

### Red Dragon (natural)
160 HP (config), armor 8, fire immune, no fall damage. Lands and walks (bite, wing buffet when crowded)
and takes off to orbit targets at ~13 blocks, 8-12 blocks above them.
* **Telegraphed fire breath**: a 16-tick charge (roar, jaw opens, smoke at the mouth) before a 40-tick
  cone (12 blocks, ±25°) that deals `breathDamage` every 10 ticks and ignites. The dragon hovers while
  breathing, so the attack is readable and can be dodged sideways. GameTest
  `red_dragon_breath_is_telegraphed` asserts no fire lands before the charge.
* **Territory**: a warning roar when a player comes within 24 blocks; after ~5 seconds of trespass the
  player becomes a valid target. Hunting: preys on `#lostfeatures:dragon_prey`, heals and becomes
  sated for 2-4 minutes after a kill.
* **Stuck recovery**: climbs on collision, re-plans if it makes no progress for 2 seconds, takes off if
  ground pathing stalls; flight targets are clamped inside the world height.
* Loot: 2-4 scales, a fang, 2 wing membranes and a heart (player kill).

### Ancestral Red Dragon (finale boss)
Summoned at an Ancient Altar (dragon lairs) with a Draconic Sigil. 400 HP (config) **+25% per extra
player within 96 blocks (max 5)**, 1.5x scale, red boss bar, its own loot table. Phases by health:
1. **> 66%** — mostly ground fighting (bites, wing buffet), lands after 10 s in the air.
2. **≤ 66%** — takes to the air; strafing fire breath.
3. **≤ 33%** — faster flight, shorter breath cooldown, and a shockwave each time it lands.
Phase changes play a dedicated cue and a roar. Only one Ancestral dragon may exist within 160 blocks
of an altar. Victory credits damaging players (see above) and plays a victory cue.

### Giant
220 HP (config), knockback immune, step height 2. Swipes up close and performs a **telegraphed ground
slam**: it raises both arms for 30 ticks (synched for the animation, with a windup sound) before a
5-block radial impact (`slamDamage`, falloff with distance) that knocks targets back and may knock
loose up to 8 plants/leaves (config + mobGriefing). GameTest `giant_slam_after_windup`.

### Illusioner
48 HP (config). Keeps the vanilla Illusioner's bow, mirror images with invisibility and Hard-only
Blindness, and adds: a **Disorientation** spell (Nausea + Slowness, configurable cooldown, any
difficulty) and a **blink** (6-10 blocks away when a target closes within 5 blocks; cooldown).
Counterplay: casts are announced by sound and animation; blink is on a long cooldown.

### Killer Bunny
14 HP, 8 attack (config), armor 4. Hops relentlessly, growls when it picks a target, leaps at close
range; hunts players, wolves and foxes.

## Spawn eggs

All four creatures have spawn eggs in the Lost Features creative tab. Eggs create fully initialised
creatures with the same AI and attributes as natural ones. The Ancestral variant has no egg (it only
comes from the altar), so creative players cannot accidentally create a "boss defeated" story state.
