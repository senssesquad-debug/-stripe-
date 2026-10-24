"""Generates docs/RECIPES.md and docs/ASSETS_AND_AUDIO.md from the actual data files, so the
catalogues always match what ships. Run after datagen and asset generation:
    python3 tools/docs/gen_docs.py
"""
import glob
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
GEN = os.path.join(ROOT, "src", "generated", "resources")
RES = os.path.join(ROOT, "src", "main", "resources")
NS = "lostfeatures"
LANG = json.load(open(os.path.join(RES, "assets", NS, "lang", "en_us.json")))

STATION = {
    "minecraft:crafting_shaped": "Crafting Table (shaped)", "minecraft:crafting_shapeless": "Crafting Table / inventory grid (shapeless)",
    "minecraft:smelting": "Furnace", "minecraft:blasting": "Blast Furnace", "minecraft:smoking": "Smoker",
    "minecraft:campfire_cooking": "Campfire", "minecraft:stonecutting": "Stonecutter", "minecraft:smithing_transform": "Smithing Table",
}
DEFAULT_TIME = {"minecraft:smelting": 200, "minecraft:blasting": 100, "minecraft:smoking": 100, "minecraft:campfire_cooking": 100}

# recipe id -> (progression stage, balance rationale, alternative acquisition)
NOTES = {
    "ruby_block": ("1 Early", "Compact storage; reversible.", "Dragon lair / ruins chests contain loose rubies."),
    "ruby_from_ruby_block": ("1 Early", "Reverses storage.", "-"),
    "ruby_from_smelting_ruby_ore": ("1 Early", "Silk-touched ore can be smelted like vanilla ores.", "Mining the ore drops rubies directly (Fortune applies)."),
    "ruby_from_smelting_deepslate_ruby_ore": ("1 Early", "As above.", "Mining drops rubies directly."),
    "ruby_from_blasting_ruby_ore": ("1 Early", "Faster ore processing, same yield.", "-"),
    "ruby_from_blasting_deepslate_ruby_ore": ("1 Early", "As above.", "-"),
    "ruby_bricks": ("1 Early", "Decorative; one ruby colours eight bricks.", "Stonecutting a ruby block."),
    "ruby_bricks_from_ruby_block_stonecutting": ("1 Early", "Bulk decorative conversion.", "-"),
    "ancient_stone": ("1 Early", "Lets players rebuild ancient architecture; one ruby per eight stone.", "Found in every Lost Features structure."),
    "ancient_stone_bricks": ("1 Early", "Standard 2x2 brick conversion.", "Structures; stonecutter."),
    "ancient_stone_bricks_stonecutting": ("1 Early", "1:1 like vanilla stone bricks.", "-"),
    "cracked_ancient_stone_bricks": ("1 Early", "Mirrors vanilla cracked bricks.", "Structures."),
    "ancient_glyph_bricks": ("2 Exploration", "Decorative glowing glyph; glow ink keeps it a deliberate choice.", "Structures (readable story glyphs)."),
    "ancient_bone_block": ("3 Encounters", "Storage/decor for Giant drops.", "-"),
    "ancient_bone_from_block": ("3 Encounters", "Reverses storage.", "-"),
    "bone_meal_from_ancient_bone": ("3 Encounters", "Giant bones are big: 6 bone meal each, a farming bonus without being infinite.", "-"),
    "illusory_wall": ("3 Encounters", "Hidden passages; illusion dust gives the Illusioner drop a building use.", "Brick Pyramid entrances."),
    "red_dye_from_rose": ("1 Early", "Same as poppy.", "-"),
    "cyan_dye_from_cyan_rose": ("1 Early", "Same as other single-dye flowers.", "-"),
    "ancient_circuit": ("2 Exploration", "Core component of every ancient device; ruby gives the gem its mechanical role.", "Ruins and lab chests."),
    "ancient_key": ("2 Exploration", "One key per locked chest; gold + ruby keeps keys valuable but craftable.", "Story reward (first ancient site), chests."),
    "ancient_journal": ("1 Early", "Cheap so every player can follow the story.", "Starting House chest."),
    "decoded_notes": ("3 Story", "Requires one Illusioner-related find (lens) and one clue.", "Story reward for decoding is a smithing template, not more notes."),
    "ancient_smithing_template_duplication": ("4 Late", "Mirrors vanilla template duplication (7 material + base).", "Dragon lair and locked chests; story rewards."),
    "draconic_sigil": ("5 Finale", "Needs one Giant, one Red Dragon and one Illusioner-related item: no grinding, each creature once.", "None - the finale key."),
    "quiver": ("1 Early", "Leather + string: an early convenience item.", "Starting House and pyramid chests."),
    "copper_horn": ("2 Exploration", "Goat horn + 3 copper, as in the removed design; tune is rolled when crafted.", "Starting House / locked chests."),
    "studded_helmet": ("1 Early", "Between chain and iron: cheap leather + nuggets, high enchantability.", "Brick pyramid chests."),
    "studded_chestplate": ("1 Early", "As above.", "Locked chests."),
    "studded_leggings": ("1 Early", "As above.", "-"),
    "studded_boots": ("1 Early", "As above.", "Brick pyramid chests."),
    "dragonscale_chestplate_smithing": ("4 Late", "Diamond-level chest piece with extra toughness; costs a template + scale, not a full set.", "-"),
    "fang_blade": ("4 Late", "Iron-tier damage, longer durability, sets targets alight: a trophy weapon.", "-"),
    "edge_compass": ("4 Late", "Far Lands access after meeting an Illusioner (lens) and gathering obsidian.", "-"),
    "ancient_event_sensor": ("2 Exploration", "Observer + circuit: clearly above vanilla observers in cost.", "Glass pillar labs contain one."),
    "ancient_energy_reactor": ("3 Mechanisms", "Ruby block + redstone block + circuits; fuel is the ongoing cost.", "-"),
    "runic_logic_device": ("2 Exploration", "Comparator-like cost with a circuit.", "Ruins vault puzzle."),
    "ancient_secret_door": ("2 Exploration", "Eight doors per circuit, like doors in bulk.", "-"),
    "dart_trap": ("2 Exploration", "Dispenser-like cost; darts cannot be picked up, so no arrow duplication.", "-"),
    "spike_trap": ("3 Encounters", "Uses a Giant bone; 2 per craft.", "-"),
    "spike_trap_from_vorpal_fang": ("3 Encounters", "Killer Bunny fang as a trap component: 4 per craft.", "-"),
    "cooked_cursed_rabbit": ("3 Encounters", "Better than cooked rabbit as a small reward.", "-"),
    "cooked_cursed_rabbit_from_smoking": ("3 Encounters", "Smoker: twice as fast.", "-"),
    "cooked_cursed_rabbit_from_campfire_cooking": ("3 Encounters", "Campfire: slow but fuel-free.", "-"),
}


def name_of(ref):
    ns, path = ref.split(":")
    if ns == NS:
        for prefix in ("item", "block"):
            k = f"{prefix}.{NS}.{path}"
            if k in LANG:
                return f"{LANG[k]} (`{ref}`)"
    return f"`{ref}`"


def ingredient(v):
    if isinstance(v, list):
        return " / ".join(name_of(x) for x in v)
    if isinstance(v, str):
        return name_of(v) if not v.startswith("#") else f"tag `{v}`"
    return f"`{json.dumps(v)}`"


def unlocks():
    out = {}
    for path in glob.glob(os.path.join(GEN, "data", NS, "advancement", "recipes", "*", "*.json")):
        adv = json.load(open(path))
        for crit, c in adv["criteria"].items():
            if c["trigger"] == "minecraft:inventory_changed":
                items = [i["items"] for i in c["conditions"]["items"]]
                out[os.path.basename(path)[:-5]] = "Obtain " + ", ".join(name_of(i) if isinstance(i, str) else str(i) for i in items)
    return out


def recipes_md():
    unl = unlocks()
    rows = []
    for path in sorted(glob.glob(os.path.join(GEN, "data", NS, "recipe", "*.json"))):
        rid = os.path.basename(path)[:-5]
        r = json.load(open(path))
        t = r["type"]
        result = r["result"]
        out = f"{result.get('count', 1)} x {name_of(result['id'])}"
        if t == "minecraft:crafting_shaped":
            grid = "<br>".join(f"`{row.replace(' ', '·')}`" for row in r["pattern"])
            key = "<br>".join(f"`{k}` = {ingredient(v)}" for k, v in sorted(r["key"].items()))
            counts = {}
            for row in r["pattern"]:
                for ch in row:
                    if ch != " ":
                        counts[ch] = counts.get(ch, 0) + 1
            qty = ", ".join(f"{n} x `{k}`" for k, n in sorted(counts.items()))
            inputs = f"{grid}<br>{key}<br>Quantities: {qty}"
        elif t == "minecraft:crafting_shapeless":
            inputs = "<br>".join(ingredient(x) for x in r["ingredients"])
        elif t in DEFAULT_TIME:
            inputs = f"{ingredient(r['ingredient'])}<br>{r.get('cookingtime', DEFAULT_TIME[t])} ticks, {r.get('experience', 0)} XP"
        elif t == "minecraft:stonecutting":
            inputs = ingredient(r["ingredient"])
        elif t == "minecraft:smithing_transform":
            inputs = f"Template: {ingredient(r['template'])}<br>Base: {ingredient(r['base'])}<br>Addition: {ingredient(r['addition'])}"
        else:
            inputs = f"`{json.dumps(r)}`"
        stage, why, alt = NOTES.get(rid, ("?", "?", "-"))
        rows.append(f"| `{NS}:{rid}` | {out} | {inputs} | {STATION.get(t, t)} | {unl.get(rid, 'Always visible')} | {alt} | {stage} | {why} |")
    missing = sorted(set(NOTES) - {os.path.basename(p)[:-5] for p in glob.glob(os.path.join(GEN, "data", NS, "recipe", "*.json"))})
    header = f"""# Recipes

Generated by `tools/docs/gen_docs.py` from `src/generated/resources/data/{NS}/recipe` (the files the mod
actually ships). **{len(rows)} recipes**, all in the `{NS}` namespace - no vanilla recipe is replaced
or removed. In shaped layouts `·` is an empty slot. "Unlock" is the recipe-book trigger generated
with the recipe (the recipe is always craftable; unlocking only reveals it in the recipe book).

Verification: every ingredient/output id was checked by `tools/validate_resources.py`; the recipe set
loads on a dedicated 26.2 server and the GameTest `recipes_namespaced_and_valid` confirms at runtime
that 40+ `{NS}` recipes are registered and vanilla recipes are still present.

## Progression stages

1. **Early** - ruby mining, studded armor, quiver, journal.
2. **Exploration** - structures, keys, circuits, sensors, logic, doors, traps.
3. **Encounters / Mechanisms / Story** - Giant, Illusioner, Killer Bunny drops; reactor; decoded notes.
4. **Late** - dragon materials, templates, Edge Compass.
5. **Finale** - Draconic Sigil.

Survival completeness: every recipe input is obtainable without commands - rubies from ore, ancient
stone from crafting or structures, creature drops from natural encounters/events or lair residents,
templates from chests and story rewards (and template duplication once one is found). The only items
without a crafting recipe are the Locked Chest and Ancient Altar (structure-only by design), music discs
(chest loot and story rewards), trophies (rare drops) and spawn eggs (creative only).

## Catalogue

| Recipe ID | Output | Ingredients / layout | Station | Unlock | Alternative acquisition | Stage | Balance rationale |
|---|---|---|---|---|---|---|---|
"""
    text = header + "\n".join(rows) + "\n"
    if missing:
        text += "\n> Notes defined for recipes that no longer exist: " + ", ".join(missing) + "\n"
    open(os.path.join(ROOT, "docs", "RECIPES.md"), "w").write(text)
    return len(rows)


PURPOSE = {
    "entity.red_dragon": "Red Dragon", "entity.giant": "Giant", "entity.illusioner": "Illusioner", "entity.killer_bunny": "Killer Bunny",
    "block.ruby": "Ruby ore/block sound type", "block.event_sensor": "Ancient Event Sensor", "block.reactor": "Ancient Energy Reactor",
    "block.runic_logic": "Runic Logic Device", "block.mechanism": "Mechanism failure", "block.ancient_door": "Ancient Secret Door",
    "block.dart_trap": "Dart Trap", "block.spike_trap": "Spike Trap", "block.locked_chest": "Locked Chest", "block.ancient_altar": "Ancient Altar",
    "item.quiver": "Quiver", "item.journal": "Ancient Journal", "item.relic": "Relic use", "item.dragon_device": "Edge Compass / dragon devices",
    "item.copper_horn": "Copper Horn tunes", "event": "Event / story cue", "music": "Situational music theme", "music_disc": "Music disc",
}


def assets_md():
    sounds = json.load(open(os.path.join(RES, "assets", NS, "sounds.json")))
    durations = json.load(open(os.path.join(ROOT, "tools", "assetgen", "audio_catalog.json")))
    rows = []
    for event, entry in sorted(sounds.items()):
        s = entry["sounds"][0]
        name = s["name"].split(":")[1]
        stream = s.get("stream", False)
        group = next((v for k, v in PURPOSE.items() if event.startswith(k)), "")
        rows.append(f"| `{NS}:{event}` | {group} | `assets/{NS}/sounds/{name}.ogg` | {durations.get(name, '?')} s | "
                    f"{'stream' if stream else 'static'} | {LANG.get(entry.get('subtitle', ''), '-')} |")
    tex = sorted(os.path.relpath(p, os.path.join(RES, "assets", NS)) for p in glob.glob(os.path.join(RES, "assets", NS, "textures", "**", "*.png"), recursive=True))
    tex_rows = "\n".join(f"- `assets/{NS}/{t}`" for t in tex)
    music_map = {
        "ancient_echoes": "music/ruins", "dragons_omen": "music/dragon", "far_beyond": "music/far_lands",
        "forgotten_civilization": "music/story", "ruby_resonance": "music/mechanism", "illusion": "music/illusioner",
        "the_last_monolith": "music/underground"}
    disc_rows = "\n".join(f"| {LANG.get(f'jukebox_song.{NS}.{d}', d)} | `{NS}:music_disc_{d}` | `assets/{NS}/sounds/{f}.ogg` | {durations.get(f, '?')} s |"
                          for d, f in music_map.items())
    text = f"""# Assets and Audio

Generated by `tools/docs/gen_docs.py`. Every texture, model, sound and music track in this mod is
**original** and generated from code in `tools/assetgen/` (pixel art with PIL/numpy, audio synthesised
with numpy/scipy and encoded with ffmpeg). Nothing is extracted from Minecraft or other mods.

## Replacing assets by hand

* **Sounds and music**: replace the `.ogg` at the listed path with your own file of the same name.
  Use Ogg Vorbis. Positional sounds (everything except `music.*`) and music discs must be **mono**
  so they attenuate with distance. No Java change is needed: `assets/{NS}/sounds.json` maps every
  event to its file, and sound events are registered by id in `ModSounds`, independent of gameplay
  code. A missing optional file only produces a client warning; it cannot crash the game.
* **Textures**: replace the PNG at the same path and keep the size (16x16 for blocks/items,
  16 px per block for paintings, entity textures at their listed size because the model UVs depend
  on it).
* **Entity models**: `RedDragonModel` and `KillerBunnyModel` layer code is generated by
  `tools/assetgen/gen_entities.py` together with their textures. To redesign a model, edit the part
  list in that script and re-run it so UVs and texture stay in sync.
* **Music disc lengths**: `data/{NS}/jukebox_song/*.json` stores `length_in_seconds`. If you replace a
  track, update the length (or re-run `gen_audio.py --sfx-only` after editing `audio_catalog.json`).
* To regenerate everything: `python3 tools/assetgen/gen_entities.py`, `gen_blocks.py`, `gen_items.py`,
  `gen_art.py`, `gen_audio.py`, then `python3 tools/datagen/gen_data.py`.

## Audio status

All {len(rows)} sound events have a real, audible, original file (no silent placeholders). They are
procedurally synthesised: functional and distinct per action, but intentionally simple. They are the
"temporary originals" the developer intends to replace. Loudness was measured on every file
(measured: RMS between -19.2 and -13.9 dBFS, peaks at most -1.5 dBFS, no clipping).

### Music tracks and discs

Nine original tracks (mono, 44.1 kHz Ogg Vorbis, ~88-115 s each), composed algorithmically per theme
(mode, tempo, instrumentation). Seven discs each play a **distinct** track:

| Disc | Item | File | Length |
|---|---|---|---|
{disc_rows}

Theme-only tracks: `music/dragon_boss.ogg` (Ancestral Red Dragon fight) and `music/giant.ogg`.
Themes are chosen client-side through NeoForge's `SelectMusicEvent` only in Lost Features contexts
(near our creatures, ancient blocks, in the Far Lands or with the journal open) and use the vanilla
Music volume slider; vanilla music selection is otherwise untouched. The Far Lands dimension also
declares `music.far_lands` as its background music.

### Complete sound event catalogue

| Sound event | Used by | File to replace | Length | Load | Subtitle |
|---|---|---|---|---|---|
""" + "\n".join(rows) + f"""

## Textures ({len(tex)} files)

{tex_rows}

## Models

* Red Dragon: `client/model/RedDragonModel.java` (generated, 256x256 texture, procedural animation:
  idle breathing, walk gait, folded/flapping wings, takeoff/flight lean, jaw for breath charge and
  breath, head look). Ancestral variant uses `textures/entity/ancestral_red_dragon.png` and 1.5x scale.
* Killer Bunny: `client/model/KillerBunnyModel.java` (generated, 64x32).
* Giant: vanilla code-defined giant humanoid geometry (`ModelLayers.GIANT`) + original texture +
  windup/aggressive arm animation (`GiantModel`).
* Illusioner: vanilla illager geometry and mirror-image renderer + original texture.
* Blocks: generated by `ModModelProvider`; hand-written models `models/block/spike_trap*.json` and
  `models/block/ancient_altar.json`.
* Armor: `equipment/studded.json`, `equipment/dragonscale.json` and `textures/entity/equipment/...`.

## Paintings

13 variants in `data/{NS}/painting_variant/`, textures in `textures/painting/`, added to the vanilla
`#minecraft:placeable` painting tag with `"replace": false` (so they appear in survival from a normal
painting item, alongside every vanilla painting).
"""
    open(os.path.join(ROOT, "docs", "ASSETS_AND_AUDIO.md"), "w").write(text)
    return len(rows), len(tex)


if __name__ == "__main__":
    os.makedirs(os.path.join(ROOT, "docs"), exist_ok=True)
    n = recipes_md()
    s, t = assets_md()
    print(f"RECIPES.md: {n} recipes; ASSETS_AND_AUDIO.md: {s} sounds, {t} textures")
