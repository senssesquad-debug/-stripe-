# Historical Research

Sources were read from the Minecraft Wiki (raw wikitext fetched during development on 2026-10-23)
and the NeoForge 26.2 primer. Nothing below invents historical evidence: where Lost Features goes
beyond the record, the entry says so and the in-game content is labelled as original mod lore.

Primary references:

* https://minecraft.wiki/w/Java_Edition_removed_features
* https://minecraft.wiki/w/Java_Edition_unused_features
* https://minecraft.wiki/w/Ruby
* https://minecraft.wiki/w/Mentioned_features/Red_Dragon (the `Red_Dragon` page redirects here)
* https://minecraft.wiki/w/Giant
* https://minecraft.wiki/w/Illusioner
* https://minecraft.wiki/w/Quiver
* https://minecraft.wiki/w/Copper_Horn
* https://minecraft.wiki/w/Studded_Armor
* https://minecraft.wiki/w/Locked_chest
* https://minecraft.wiki/w/Rabbit#The_Killer_Bunny (the `Killer_Bunny` page redirects here)
* https://minecraft.wiki/w/Brick_Pyramid
* https://minecraft.wiki/w/Far_Lands
* https://github.com/neoforged/.github/blob/main/primers/26.2/index.md
* https://github.com/McJty/Tutorial_26.2_neoforge (used to confirm toolchain versions)

## Classification key

| Code | Meaning |
|---|---|
| **HI** | Historically implemented (shipped in some version) |
| **HU** | Historically unused or incomplete (in game files, not normally reachable) |
| **RM** | Removed |
| **DI** | Officially discussed, never implemented |
| **AF** | Experimental / April Fools |
| **OR** | Original Lost Features invention (may be *inspired by* history) |

## Findings

### Ruby — HU / RM (and AF)
Planned as the villager currency for Java Edition 1.3.1 and replaced by emeralds. A ruby texture sat in
`items.png` in 12w21a; translation strings `item.ruby.name` / `tile.oreRuby.name` existed; 12w21a briefly
gave emerald ore a texture apparently meant for ruby ore. Dinnerbone cited red-green colour blindness
(ruby ore vs redstone ore). The unused texture was removed in 21w13a. Rubies returned as a joke option
in the 23w13a_or_b April Fools snapshot. **Lost Features**: rubies are a mechanism/crafting gem, *not* a
currency and not a diamond replacement (OR interpretation). Our ruby ore uses a sparkling crystal
pattern distinct from redstone ore in shape as well as hue.

### Red Dragon — DI
Mentioned by Notch in 2010 and, on 12 Oct 2011, described as "slightly less dangerous" than the ender
dragon, able to land and not destroying terrain. Jeb (2012) and Dinnerbone (2013) later said it was
shelved; on 24 Feb 2026 Jeb said it is occasionally discussed but not as development. **Lost Features**:
an OR implementation following the stated design points: it lands, and its terrain effect is limited
to bounded, self-healing scorch traces on natural vegetation (config + mobGriefing).

### Giant — HU
An oversized zombie-model mob that exists in the game with **no AI**, no natural spawning, no spawn egg;
12 blocks tall, 100 HP, 50 attack, not undead. **Lost Features** adds a *separate* entity type
`lostfeatures:giant` with full AI; the vanilla `minecraft:giant` is untouched (verified by GameTest).

### Illusioner — HU
An illager with a bow, mirror-image duplicates with invisibility, and a Blindness spell (only when
regional difficulty > 2, once per new target). No natural spawning, no spawn egg; can join raids/patrols
if near. **Lost Features** adds `lostfeatures:illusioner`, a separate entity type built on the vanilla
class (so its mirror images and bow AI behave identically), plus a configurable Disorientation spell
and a cooldown-limited blink (OR additions). The vanilla `minecraft:illusioner` is untouched.

### Killer Bunny — HU
Listed on the *unused features* page: a rabbit variant (`RabbitType:99`) obtainable only with
`/summon`, hostile to players, wolves (tamed or not) and foxes, hopping toward players much faster than
a rabbit and lunging when close. **Lost Features** adds an OR separate creature (`lostfeatures:killer_bunny`)
with its own model, texture, sounds and loot that follows those behaviours (players and wolves through
its own goals, foxes through the data-driven rule `killer_bunny_hunts_foxes`); vanilla rabbits,
including the vanilla variant, are not changed.

### Quiver — RM
An Indev 2009-2010 test item (texture from *Legend of the Chambered*), unobtainable after two weeks; the
texture stayed until 15w31a. During 1.9 development Dinnerbone showed a functional quiver with its own
slot, then scrapped it (off-hand arrows felt more natural). **Lost Features**: a functional quiver as an
inventory item (no extra slot, no inventory rewrite) that bows/crossbows draw from only when the player
has no loose arrows (OR mechanic).

### Copper Horn — RM (experimental snapshots)
Added in 22w13a, removed during 1.19 development. Crafted from a goat horn and copper ingots; found in
pillager outposts (25%); ten variants each with melody / harmony (looking up) / bass (sneaking): thirty
sounds; one second to play, four second cooldown. Removed for not meeting design goals ("more of a
social feature"). **Lost Features** restores the 10 x 3 structure, use time and cooldown with 30 original
tunes and the historical variant names; acquisition is crafting (random tune) and Lost Features chests.

### Studded Armor — RM
Four Indev item textures (studded helmet/chestplate/leggings/boots) from *Legend of the Chambered 2*,
present from 31 Dec 2009 to early Feb 2010, never functional. **Lost Features**: functional OR armor
tier between chainmail and iron.

### Locked chest — AF / RM
Beta 1.4 April Fools 2011 "Steve Co. Supply Crate", linked to a joke store; later versions made it
decay. **Lost Features** reinterprets it (OR) as an unbreakable ancient strongbox opened with an
Ancient Key; unlocking converts it into a vanilla chest with a loot table.

### Rose / Cyan flower — RM
(Source: https://minecraft.wiki/w/Poppy#History, where both "Rose" and "Cyan Flower" redirect.) The rose
was added in Classic 0.0.20a and was retextured and renamed to the poppy during the 1.7 snapshots
(old roses convert automatically). Pocket Edition's original "rose" was blue/cyan because the Xperia
Play could not display the intended red; it was replaced by the poppy in PE v0.9.0. **Lost Features**
adds a red Rose and a Cyan Rose as decorative flowers and dye sources — names reused, textures original.

### Brick Pyramid — RM
Infdev (20100227-1414 to 20100327) solid brick pyramids, one per 1024x1024 area in the +X/+Z quadrant,
built from the build limit down onto terrain; no rooms. **Lost Features**: a bounded 31x17x31 brick
pyramid on the surface with an *added* hidden chamber (OR addition, clearly not historical).

### Starting House — RM
Indev house at the map centre: first mossy cobblestone with two torches, later (Indev 20100213) stone
floor and oak plank walls; early versions held chests of items. **Lost Features**: the later design
(stone floor, oak walls, two-block doorway, two torches) with a modest chest.

### Obsidian Wall — RM
Infdev 20100227-1414 debug walls along X=0 and Z=0. **Lost Features**: weathered wall segments as rare
ruins (OR; not at the axes, not infinite).

### Glass Pillars — RM (accidental release)
Beta 1.9 Prerelease 3 left debug glass pillars above stronghold entrances/portal rooms to the build
limit; removed in Prerelease 4. **Lost Features**: a bounded glass pillar that marks an underground
research lab (OR reinterpretation; strongholds untouched).

### Monoliths — RM (terrain bug)
Infdev 20100611 to Alpha 1.1.2_01 inverted-terrain regions: sheer stone cliffs to the top of the world,
empty underneath. **Lost Features**: an 11x36x11 stone monolith with a hollow base, ore and a glyph (OR
reinterpretation of the silhouette; not an inversion of real terrain).

### Far Lands — RM (bug), now a debug property
A terrain generation breakdown from noise overflow (~12.55 million blocks), fixed in Beta 1.8 Pre-release;
the wiki notes a 26.3 pre-release debug property `ENABLE_FARLANDS`. Types: edge, corner, "farther lands"
etc. **Lost Features**: a separate dimension whose custom density function recreates the *look*
(tall flat-topped walls with long tunnels, ordinary terrain between, water below sea level) as a stable,
bounded function. It does not overflow anything and does not touch Overworld generation.

### Other candidates reviewed and not implemented
From https://minecraft.wiki/w/Java_Edition_removed_entities and the unused-features page:
* **Beast Boy, Black Steve, Steve and Rana** — Indev MD3 human test mobs. No gameplay design existed;
  adding them would be reskins, which the brief rules out.
* **Mob / Human** (pre-Classic to early Survival Test) and **Builders** (private Beta 1.2_02 build) —
  human clones; same reason.
* **Baby Camel Husk** — a 26.1 model removal; vanilla content, out of scope.
* **Minecart with monster spawner** — an unused vanilla entity that still exists; not a lost *creature*.
* **Unused paintings (Earth, Fire, Water, Wind)** — already restored in vanilla since 22w16a, so our
  painting collection is entirely new art instead.

## Version facts verified for the build

* Minecraft 26.2, NeoForge **26.2.0.75**, ModDevGradle **2.0.144**, Gradle **9.2.1**, **Java 25**
  (from McJty/Tutorial_26.2_neoforge; the toolchain resolved and compiled in this environment).
* 26.2 API changes used: `Identifier` (was ResourceLocation), `EntityTypes`/`ItemIds` constants, data-driven
  villager trades, `GuiGraphicsExtractor` screens, submit-based entity rendering, `ValueInput/ValueOutput`
  persistence, `SavedDataType`, new transfer API (`ItemStacksResourceHandler`), `EntitySpawnReason`,
  spawn eggs via the `entity_data` component with per-egg textures.
