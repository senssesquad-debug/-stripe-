"""Writes the hand-authored datapack/resource JSON for Lost Features (tags, worldgen, structures,
biome modifiers, damage types, the Far Lands dimension, relationship rules, localization).
Everything is additive and namespaced; vanilla files are never replaced (vanilla tag files use
"replace": false). Run: python3 tools/datagen/gen_data.py
"""
from __future__ import annotations

import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
RES = os.path.join(ROOT, "src", "main", "resources")
NS = "lostfeatures"


def write(rel, obj):
    path = os.path.join(RES, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def tag(rel, values, replace=False):
    write(rel, {"replace": replace, "values": values})


def cond(key):
    return [{"type": f"{NS}:config_enabled", "key": key}]


# ================================================================================= tags

def tags():
    L = lambda *names: [f"{NS}:{n}" for n in names]  # noqa: E731
    pick = L("ruby_ore", "deepslate_ruby_ore", "ruby_block", "ruby_bricks", "ancient_stone", "ancient_stone_bricks",
             "cracked_ancient_stone_bricks", "ancient_glyph_bricks", "ancient_bone_block", "illusory_wall",
             "ancient_event_sensor", "ancient_energy_reactor", "runic_logic_device", "ancient_secret_door", "dart_trap",
             "spike_trap", "ancient_altar")
    tag("data/minecraft/tags/block/mineable/pickaxe.json", pick)
    tag("data/minecraft/tags/block/mineable/shovel.json", L("scorched_grass"))
    tag("data/minecraft/tags/block/needs_iron_tool.json", L("ruby_ore", "deepslate_ruby_ore", "ruby_block", "ancient_altar"))
    tag("data/minecraft/tags/block/small_flowers.json", L("rose", "cyan_rose"))
    tag("data/c/tags/block/ores/ruby.json", L("ruby_ore", "deepslate_ruby_ore"))
    tag("data/c/tags/block/ores.json", ["#c:ores/ruby"])
    tag("data/c/tags/block/storage_blocks/ruby.json", L("ruby_block"))
    tag("data/c/tags/block/storage_blocks.json", ["#c:storage_blocks/ruby"])
    tag(f"data/{NS}/tags/block/dragon_scorchable.json", ["minecraft:grass_block", "minecraft:short_grass", "minecraft:fern", "minecraft:dead_bush"])
    tag(f"data/{NS}/tags/block/giant_breakable.json", ["minecraft:short_grass", "minecraft:fern", "minecraft:tall_grass",
                                                     "minecraft:large_fern", "#minecraft:leaves"])

    tag("data/minecraft/tags/item/small_flowers.json", L("rose", "cyan_rose"))
    tag("data/minecraft/tags/item/head_armor.json", L("studded_helmet"))
    tag("data/minecraft/tags/item/chest_armor.json", L("studded_chestplate", "dragonscale_chestplate"))
    tag("data/minecraft/tags/item/leg_armor.json", L("studded_leggings"))
    tag("data/minecraft/tags/item/foot_armor.json", L("studded_boots"))
    tag("data/minecraft/tags/item/swords.json", L("fang_blade"))
    tag("data/c/tags/item/gems/ruby.json", L("ruby"))
    tag("data/c/tags/item/gems.json", ["#c:gems/ruby"])
    tag("data/c/tags/item/ores/ruby.json", L("ruby_ore", "deepslate_ruby_ore"))
    tag("data/c/tags/item/storage_blocks/ruby.json", L("ruby_block"))
    tag(f"data/{NS}/tags/item/reactor_fuel.json", L("ruby", "ruby_block", "illusion_dust", "strength_shard", "dragon_heart"))
    tag(f"data/{NS}/tags/item/repairs_studded_armor.json", ["minecraft:leather", "minecraft:iron_nugget"])
    tag(f"data/{NS}/tags/item/repairs_dragonscale.json", L("dragon_scale"))

    tag(f"data/{NS}/tags/entity_type/sensor_detectable.json", L("red_dragon", "giant", "illusioner", "killer_bunny"))
    tag(f"data/{NS}/tags/entity_type/village_threats.json", L("red_dragon", "giant", "illusioner", "killer_bunny"))
    tag(f"data/{NS}/tags/entity_type/giant_escort.json", ["minecraft:zombie", "minecraft:husk", "minecraft:skeleton", "minecraft:stray"])
    tag(f"data/{NS}/tags/entity_type/dragon_prey.json", ["minecraft:cow", "minecraft:sheep", "minecraft:pig", "minecraft:goat",
                                                       "minecraft:horse", "minecraft:donkey", "minecraft:llama", "minecraft:rabbit",
                                                       "minecraft:chicken", "minecraft:mooshroom"])

    tag("data/minecraft/tags/damage_type/is_fire.json", L("dragon_fire"))
    tag("data/minecraft/tags/damage_type/no_knockback.json", L("spike_trap"))

    over = "#minecraft:is_overworld"
    biome = lambda name, values: tag(f"data/{NS}/tags/worldgen/biome/{name}.json", values)  # noqa: E731
    biome("has_ruby_ore", [over])
    biome("has_ruby_ore_extra", ["#minecraft:is_badlands", "minecraft:desert", "#minecraft:is_savanna"])
    biome("has_roses", ["minecraft:plains", "minecraft:sunflower_plains", "minecraft:meadow", "minecraft:flower_forest", "minecraft:forest"])
    biome("dragon_habitat", ["#minecraft:is_mountain", "#minecraft:is_badlands", "#minecraft:is_savanna", "minecraft:windswept_hills",
                             "minecraft:windswept_gravelly_hills"])
    biome("has_structure/brick_pyramid", ["minecraft:plains", "minecraft:desert", "#minecraft:is_savanna", "#minecraft:is_badlands",
                                          "minecraft:meadow", "minecraft:sunflower_plains"])
    biome("has_structure/starting_house", ["minecraft:plains", "minecraft:forest", "minecraft:birch_forest", "minecraft:meadow",
                                           "minecraft:flower_forest", "minecraft:sunflower_plains"])
    biome("has_structure/obsidian_wall", ["minecraft:plains", "minecraft:desert", "#minecraft:is_savanna", "#minecraft:is_taiga",
                                          "minecraft:snowy_plains", "#minecraft:is_badlands"])
    biome("has_structure/glass_pillar", ["#minecraft:is_forest", "minecraft:plains", "#minecraft:is_taiga", "#minecraft:is_savanna"])
    biome("has_structure/monolith", ["#minecraft:is_mountain", "#minecraft:is_hill", "minecraft:plains", "minecraft:snowy_plains"])
    biome("has_structure/ancient_ruins", ["#minecraft:is_forest", "#minecraft:is_jungle", "#minecraft:is_taiga", "minecraft:plains",
                                          "minecraft:swamp", "minecraft:meadow"])
    biome("has_structure/dragon_lair", ["#minecraft:is_mountain", "#minecraft:is_badlands", "minecraft:windswept_hills"])

    tag(f"data/{NS}/tags/worldgen/structure/ancient_sites.json", L("brick_pyramid", "starting_house", "obsidian_wall", "glass_pillar",
                                                                    "monolith", "ancient_ruins", "dragon_lair"))


# ================================================================================= worldgen

STRUCTURES = {  # kind: (spacing, separation, salt)
    "brick_pyramid": (48, 20, 1102010),
    "starting_house": (40, 16, 1241910),
    "obsidian_wall": (64, 24, 2271410),
    "glass_pillar": (36, 14, 1903011),
    "monolith": (52, 20, 6111010),
    "ancient_ruins": (28, 10, 7310260),
    "dragon_lair": (80, 32, 10122011),
}


def worldgen():
    ore_targets = lambda block: [  # noqa: E731
        {"target": {"predicate_type": "minecraft:tag_match", "tag": "minecraft:stone_ore_replaceables"}, "state": {"Name": f"{NS}:{block}"}},
        {"target": {"predicate_type": "minecraft:tag_match", "tag": "minecraft:deepslate_ore_replaceables"},
         "state": {"Name": f"{NS}:deepslate_{block}"}}]
    write(f"data/{NS}/worldgen/configured_feature/ore_ruby.json",
          {"type": "minecraft:ore", "config": {"discard_chance_on_air_exposure": 0.3, "size": 4, "targets": ore_targets("ruby_ore")}})
    write(f"data/{NS}/worldgen/placed_feature/ore_ruby.json", {"feature": f"{NS}:ore_ruby", "placement": [
        {"type": "minecraft:count", "count": 3}, {"type": "minecraft:in_square"},
        {"type": "minecraft:height_range", "height": {"type": "minecraft:trapezoid", "min_inclusive": {"absolute": -40}, "max_inclusive": {"absolute": 72}}},
        {"type": "minecraft:biome"}]})
    write(f"data/{NS}/worldgen/placed_feature/ore_ruby_extra.json", {"feature": f"{NS}:ore_ruby", "placement": [
        {"type": "minecraft:count", "count": 4}, {"type": "minecraft:in_square"},
        {"type": "minecraft:height_range", "height": {"type": "minecraft:uniform", "min_inclusive": {"absolute": 16}, "max_inclusive": {"absolute": 128}}},
        {"type": "minecraft:biome"}]})
    write(f"data/{NS}/worldgen/configured_feature/roses.json", {"type": "minecraft:simple_block", "config": {"to_place": {
        "type": "minecraft:weighted_state_provider", "entries": [{"data": {"Name": f"{NS}:rose"}, "weight": 3},
                                                                 {"data": {"Name": f"{NS}:cyan_rose"}, "weight": 1}]}}})
    write(f"data/{NS}/worldgen/placed_feature/roses.json", {"feature": f"{NS}:roses", "placement": [
        {"type": "minecraft:rarity_filter", "chance": 48}, {"type": "minecraft:in_square"},
        {"type": "minecraft:heightmap", "heightmap": "MOTION_BLOCKING"}, {"type": "minecraft:biome"},
        {"type": "minecraft:count", "count": 24},
        {"type": "minecraft:random_offset", "xz_spread": {"type": "minecraft:trapezoid", "max": 6, "min": -6, "plateau": 0},
         "y_spread": {"type": "minecraft:trapezoid", "max": 2, "min": -2, "plateau": 0}},
        {"type": "minecraft:block_predicate_filter", "predicate": {"type": "minecraft:matching_block_tag", "tag": "minecraft:air"}}]})

    bm = f"data/{NS}/neoforge/biome_modifier"
    write(f"{bm}/add_ruby_ore.json", {"neoforge:conditions": cond("ruby_generation"), "type": "neoforge:add_features",
                                       "biomes": f"#{NS}:has_ruby_ore", "features": f"{NS}:ore_ruby", "step": "underground_ores"})
    write(f"{bm}/add_ruby_ore_extra.json", {"neoforge:conditions": cond("ruby_generation"), "type": "neoforge:add_features",
                                             "biomes": f"#{NS}:has_ruby_ore_extra", "features": f"{NS}:ore_ruby_extra", "step": "underground_ores"})
    write(f"{bm}/add_roses.json", {"neoforge:conditions": cond("flower_generation"), "type": "neoforge:add_features",
                                    "biomes": f"#{NS}:has_roses", "features": f"{NS}:roses", "step": "vegetal_decoration"})

    for kind, (spacing, separation, salt) in STRUCTURES.items():
        write(f"data/{NS}/worldgen/structure/{kind}.json", {"type": f"{NS}:ancient", "kind": kind,
                                                            "biomes": f"#{NS}:has_structure/{kind}", "spawn_overrides": {},
                                                            "step": "surface_structures", "terrain_adaptation": "none"})
        write(f"data/{NS}/worldgen/structure_set/{kind}.json", {"neoforge:conditions": cond("structure_generation"),
                                                                "placement": {"type": "minecraft:random_spread", "salt": salt,
                                                                              "separation": separation, "spacing": spacing},
                                                                "structures": [{"structure": f"{NS}:{kind}", "weight": 1}]})


def damage_types():
    write(f"data/{NS}/damage_type/dragon_fire.json", {"exhaustion": 0.1, "message_id": f"{NS}.dragon_fire",
                                                      "scaling": "when_caused_by_living_non_player", "effects": "burning"})
    write(f"data/{NS}/damage_type/giant_slam.json", {"exhaustion": 0.1, "message_id": f"{NS}.giant_slam",
                                                     "scaling": "when_caused_by_living_non_player"})
    write(f"data/{NS}/damage_type/spike_trap.json", {"exhaustion": 0.1, "message_id": f"{NS}.spike_trap", "scaling": "never"})


def far_lands():
    write(f"data/{NS}/dimension_type/far_lands.json", {
        "ambient_light": 0.0,
        "attributes": {
            "minecraft:audio/background_music": {"default": {"max_delay": 6000, "min_delay": 1200, "sound": f"{NS}:music.far_lands"}},
            "minecraft:gameplay/bed_rule": {"can_set_spawn": "never", "can_sleep": "when_dark",
                                            "error_message": {"translate": f"message.{NS}.far_lands.no_spawn"}},
            "minecraft:gameplay/respawn_anchor_works": False,
            "minecraft:visual/ambient_light_color": "#0a0a0a",
            "minecraft:visual/cloud_color": "#ccffffff",
            "minecraft:visual/cloud_height": 270.0,
            "minecraft:visual/fog_color": "#b8c8e8",
            "minecraft:visual/sky_color": "#6a9ad8"},
        "coordinate_scale": 1.0, "default_clock": "minecraft:overworld", "has_ceiling": False, "has_ender_dragon_fight": False,
        "has_skylight": True, "height": 384, "infiniburn": "#minecraft:infiniburn_overworld", "logical_height": 384, "min_y": -64,
        "monster_spawn_block_light_limit": 0,
        "monster_spawn_light_level": {"type": "minecraft:uniform", "max_inclusive": 7, "min_inclusive": 0},
        "timelines": "#minecraft:in_overworld"})
    floor = {"type": "minecraft:stone_depth", "add_surface_depth": False, "offset": 0, "secondary_depth_range": 0, "surface_type": "floor"}
    under = {"type": "minecraft:stone_depth", "add_surface_depth": True, "offset": 0, "secondary_depth_range": 0, "surface_type": "floor"}
    dry = {"type": "minecraft:water", "add_stone_depth": False, "offset": 0, "surface_depth_multiplier": 0}
    block = lambda name, props=None: {"type": "minecraft:block", "result_state": {"Name": name, **({"Properties": props} if props else {})}}  # noqa: E731
    write(f"data/{NS}/worldgen/noise_settings/far_lands.json", {
        "aquifers_enabled": False, "default_block": {"Name": "minecraft:stone"},
        "default_fluid": {"Name": "minecraft:water", "Properties": {"level": "0"}}, "disable_mob_generation": False,
        "legacy_random_source": False, "noise": {"height": 384, "min_y": -64, "size_horizontal": 1, "size_vertical": 2},
        "noise_router": {"barrier": 0.0, "continents": 0.0, "depth": 0.0, "erosion": 0.0,
                         "final_density": {"type": f"{NS}:far_lands_walls"},
                         "fluid_level_floodedness": 0.0, "fluid_level_spread": 0.0, "lava": 0.0, "preliminary_surface_level": 64.0,
                         "ridges": 0.0, "temperature": 0.0, "vegetation": 0.0, "vein_gap": 0.0, "vein_ridged": 0.0, "vein_toggle": 0.0},
        "ore_veins_enabled": False, "sea_level": 63, "spawn_target": [],
        "surface_rule": {"type": "minecraft:sequence", "sequence": [
            {"type": "minecraft:condition", "if_true": {"type": "minecraft:vertical_gradient", "false_at_and_above": {"above_bottom": 5},
                                                        "random_name": f"{NS}:far_lands_bedrock", "true_at_and_below": {"above_bottom": 0}},
             "then_run": block("minecraft:bedrock")},
            {"type": "minecraft:condition", "if_true": floor, "then_run": {"type": "minecraft:sequence", "sequence": [
                {"type": "minecraft:condition", "if_true": dry, "then_run": block("minecraft:grass_block", {"snowy": "false"})},
                block("minecraft:sand")]}},
            {"type": "minecraft:condition", "if_true": under, "then_run": block("minecraft:dirt")}]}})
    write(f"data/{NS}/dimension/far_lands.json", {"type": f"{NS}:far_lands", "generator": {
        "type": "minecraft:noise", "settings": f"{NS}:far_lands",
        "biome_source": {"type": "minecraft:checkerboard", "scale": 4,
                         "biomes": ["minecraft:plains", "minecraft:forest", "minecraft:taiga", "minecraft:savanna", "minecraft:desert",
                                    "minecraft:snowy_plains"]}}})


# ================================================================================= relationships

def relationships():
    base = f"data/{NS}/{NS}/relationships"
    rules = {
        "prey_fear_red_dragon": dict(subject=f"#{NS}:dragon_prey", target=f"{NS}:red_dragon", relation="fear", range=20, priority=1, speed=1.4),
        "prey_fear_giant": dict(subject=f"#{NS}:dragon_prey", target=f"{NS}:giant", relation="fear", range=14, priority=1, speed=1.3),
        "wolves_hunt_killer_bunny": dict(subject="minecraft:wolf", target=f"{NS}:killer_bunny", relation="enemy", range=16, priority=3,
                                         condition="untamed"),
        "tamed_wolves_protect_owner": dict(subject="minecraft:wolf", target=f"#{NS}:village_threats", relation="protect_owner", range=12,
                                           priority=2, condition="tamed"),
        "killer_bunny_hunts_foxes": dict(subject=f"{NS}:killer_bunny", target="minecraft:fox", relation="enemy", range=16, priority=3),
        "foxes_fear_killer_bunny": dict(subject="minecraft:fox", target=f"{NS}:killer_bunny", relation="fear", range=10, priority=1, speed=1.5),
        "witches_support_giant": dict(subject="minecraft:witch", target=f"{NS}:giant", relation="support", range=12, priority=2, cooldown=240),
        "undead_escort_giant": dict(subject=f"#{NS}:giant_escort", target=f"{NS}:giant", relation="escort", range=24, priority=5, speed=1.0,
                                    condition="night"),
        "dragon_giant_rivals": dict(subject=f"{NS}:red_dragon", target=f"{NS}:giant", relation="enemy", range=24, priority=4),
        "illusioner_neutral_to_witch": dict(subject=f"{NS}:illusioner", target="minecraft:witch", relation="neutral"),
    }
    for name, rule in rules.items():
        write(f"{base}/{name}.json", rule)


# ================================================================================= trades

def trades():
    """One additive wandering-trader offer. Vanilla trade files are untouched; the vanilla tag is appended to."""
    write(f"data/{NS}/villager_trade/wandering_trader/emerald_ruby.json", {
        "gives": {"id": f"{NS}:ruby"}, "max_uses": 4.0, "reputation_discount": 0.05,
        "wants": {"count": 5.0, "id": "minecraft:emerald"}})
    tag("data/minecraft/tags/villager_trade/wandering_trader/uncommon.json", [f"{NS}:wandering_trader/emerald_ruby"])


# ================================================================================= localization

def lang():
    t = {}

    def add(k, v):
        t[k] = v

    add("itemGroup.lostfeatures", "Lost Features")
    names = {
        # blocks
        "block.lostfeatures.ruby_ore": "Ruby Ore", "block.lostfeatures.deepslate_ruby_ore": "Deepslate Ruby Ore",
        "block.lostfeatures.ruby_block": "Block of Ruby", "block.lostfeatures.ruby_bricks": "Ruby Bricks",
        "block.lostfeatures.ancient_stone": "Ancient Stone", "block.lostfeatures.ancient_stone_bricks": "Ancient Stone Bricks",
        "block.lostfeatures.cracked_ancient_stone_bricks": "Cracked Ancient Stone Bricks",
        "block.lostfeatures.ancient_glyph_bricks": "Ancient Glyph Bricks", "block.lostfeatures.ancient_bone_block": "Ancient Bone Block",
        "block.lostfeatures.illusory_wall": "Illusory Wall", "block.lostfeatures.rose": "Rose", "block.lostfeatures.cyan_rose": "Cyan Rose",
        "block.lostfeatures.scorched_grass": "Scorched Grass", "block.lostfeatures.charred_remains": "Charred Remains",
        "block.lostfeatures.ancient_event_sensor": "Ancient Event Sensor", "block.lostfeatures.ancient_energy_reactor": "Ancient Energy Reactor",
        "block.lostfeatures.runic_logic_device": "Runic Logic Device", "block.lostfeatures.ancient_secret_door": "Ancient Secret Door",
        "block.lostfeatures.dart_trap": "Dart Trap", "block.lostfeatures.spike_trap": "Spike Trap",
        "block.lostfeatures.locked_chest": "Locked Chest", "block.lostfeatures.ancient_altar": "Ancient Altar",
        # items
        "item.lostfeatures.ruby": "Ruby", "item.lostfeatures.dragon_scale": "Dragon Scale", "item.lostfeatures.dragon_fang": "Dragon Fang",
        "item.lostfeatures.dragon_heart": "Dragon Heart", "item.lostfeatures.wing_membrane": "Wing Membrane",
        "item.lostfeatures.ancient_bone": "Ancient Bone", "item.lostfeatures.strength_shard": "Strength Shard",
        "item.lostfeatures.giant_trophy": "Giant's Trophy", "item.lostfeatures.illusion_dust": "Illusion Dust",
        "item.lostfeatures.lens_fragment": "Lens Fragment", "item.lostfeatures.encrypted_notes": "Encrypted Notes",
        "item.lostfeatures.decoded_notes": "Decoded Notes", "item.lostfeatures.vorpal_fang": "Vorpal Fang",
        "item.lostfeatures.killer_bunny_trophy": "Killer Bunny Trophy", "item.lostfeatures.ancient_circuit": "Ancient Circuit",
        "item.lostfeatures.ancient_key": "Ancient Key", "item.lostfeatures.draconic_sigil": "Draconic Sigil",
        "item.lostfeatures.ancient_smithing_template": "Ancient Smithing Template",
        "item.lostfeatures.cursed_rabbit": "Cursed Rabbit", "item.lostfeatures.cooked_cursed_rabbit": "Cooked Cursed Rabbit",
        "item.lostfeatures.quiver": "Quiver", "item.lostfeatures.copper_horn": "Copper Horn",
        "item.lostfeatures.studded_helmet": "Studded Helmet", "item.lostfeatures.studded_chestplate": "Studded Chestplate",
        "item.lostfeatures.studded_leggings": "Studded Leggings", "item.lostfeatures.studded_boots": "Studded Boots",
        "item.lostfeatures.dragonscale_chestplate": "Dragonscale Chestplate", "item.lostfeatures.fang_blade": "Fang Blade",
        "item.lostfeatures.ancient_journal": "Ancient Journal", "item.lostfeatures.edge_compass": "Edge Compass",
        "item.lostfeatures.red_dragon_spawn_egg": "Red Dragon Spawn Egg", "item.lostfeatures.giant_spawn_egg": "Giant Spawn Egg",
        "item.lostfeatures.illusioner_spawn_egg": "Illusioner Spawn Egg", "item.lostfeatures.killer_bunny_spawn_egg": "Killer Bunny Spawn Egg",
        # entities
        "entity.lostfeatures.red_dragon": "Red Dragon", "entity.lostfeatures.ancestral_red_dragon": "Ancestral Red Dragon",
        "entity.lostfeatures.giant": "Giant", "entity.lostfeatures.illusioner": "Illusioner", "entity.lostfeatures.killer_bunny": "Killer Bunny",
    }
    t.update(names)
    discs = {"ancient_echoes": "Ancient Echoes", "dragons_omen": "Dragon's Omen", "far_beyond": "Far Beyond",
             "forgotten_civilization": "Forgotten Civilization", "ruby_resonance": "Ruby Resonance", "illusion": "Illusion",
             "the_last_monolith": "The Last Monolith"}
    for k, v in discs.items():
        add(f"item.lostfeatures.music_disc_{k}", "Music Disc")
        add(f"jukebox_song.lostfeatures.{k}", f"Lost Features - {v}")
    tooltips = {
        "ruby": "A deep red gem. Powers ancient mechanisms.",
        "dragon_scale": "Fire-tempered. Upgrades an iron chestplate at a smithing table.",
        "dragon_fang": "Sharp enough to carve into a Fang Blade.",
        "dragon_heart": "Still warm. Immense reactor fuel.",
        "wing_membrane": "Tough, light and heat resistant. Part of the Draconic Sigil.",
        "ancient_bone": "From a Giant. Spike traps, bone blocks and plenty of bone meal.",
        "strength_shard": "Crystallised might of a Giant. Reactor fuel and sigil component.",
        "giant_trophy": "Trophy: proof that a Giant fell.",
        "illusion_dust": "Shimmers when nobody is looking. Makes illusory walls.",
        "lens_fragment": "Reveals hidden writing. Decodes encrypted notes.",
        "encrypted_notes": "Ancient research notes. Combine with a Lens Fragment.",
        "decoded_notes": "Translated research. Key to the Draconic Sigil.",
        "vorpal_fang": "From a Killer Bunny. Crafts extra spike traps.",
        "killer_bunny_trophy": "Trophy: you survived the Killer Bunny.",
        "ancient_circuit": "Ruby-tuned circuitry for ancient devices.",
        "ancient_key": "Opens one Locked Chest.",
        "draconic_sigil": "Use on an Ancient Altar to call the Ancestral Red Dragon.",
        "ancient_smithing_template": "Smithing template for dragonscale gear.",
        "cursed_rabbit": "Eat it cooked.",
    }
    for k, v in tooltips.items():
        add(f"tooltip.lostfeatures.{k}", v)
    add("tooltip.lostfeatures.quiver.empty", "Empty")
    add("tooltip.lostfeatures.quiver.contents", "%s/%s %s")
    add("tooltip.lostfeatures.quiver.usage", "Use: store arrows. Sneak-use: empty. Bows draw from it when you carry no loose arrows.")
    add("tooltip.lostfeatures.copper_horn.unattuned", "Unattuned (gains a tune when crafted)")
    tunes = {"great_sky_falling": "Great Sky Falling", "old_hymn_resting": "Old Hymn Resting", "pure_water_desire": "Pure Water Desire",
             "mumble_fire_memory": "Mumble Fire Memory", "dry_urge_anger": "Dry Urge Anger", "clear_temper_journey": "Clear Temper Journey",
             "fresh_nest_thought": "Fresh Nest Thought", "secret_lake_tear": "Secret Lake Tear", "fearless_river_gift": "Fearless River Gift",
             "sweet_moon_love": "Sweet Moon Love"}
    for k, v in tunes.items():
        add(f"tune.lostfeatures.{k}", v)

    messages = {
        "message.lostfeatures.sensor.range": "Detection range: %s blocks",
        "message.lostfeatures.sensor.filter": "Listening for: %s",
        "filter.lostfeatures.creatures": "rare creatures", "filter.lostfeatures.encounters": "encounters and events",
        "filter.lostfeatures.mechanisms": "ancient mechanisms", "filter.lostfeatures.any": "anything ancient",
        "message.lostfeatures.reactor.full": "The reactor cannot hold more charge",
        "message.lostfeatures.reactor.status": "Charge %s/%s - %s",
        "phase.lostfeatures.idle": "idle", "phase.lostfeatures.active": "active", "phase.lostfeatures.cooldown": "cooling down",
        "message.lostfeatures.runic.mode": "Logic: %s", "message.lostfeatures.runic.pulse": "Output: pulse",
        "message.lostfeatures.runic.steady": "Output: steady",
        "mode.lostfeatures.and": "left AND right", "mode.lostfeatures.majority": "any two of three",
        "mode.lostfeatures.sequence": "sequence left, back, right", "mode.lostfeatures.latch": "latch (left sets, right resets)",
        "message.lostfeatures.locked_chest.locked": "Locked. An Ancient Key might fit.",
        "message.lostfeatures.altar.hint": "A socket shaped like a sigil...",
        "message.lostfeatures.altar.busy": "The Ancestral Red Dragon already roams nearby",
        "message.lostfeatures.altar.disabled": "The altar is dormant (disabled in the config)",
        "message.lostfeatures.edge_compass.disabled": "The needle will not move (Far Lands disabled in the config)",
        "message.lostfeatures.edge_compass.missing": "The Far Lands are not present on this server",
        "message.lostfeatures.edge_compass.wrong_dimension": "The compass only works in the Overworld and the Far Lands",
        "message.lostfeatures.far_lands.no_spawn": "You cannot set a spawn point at the edge of the world",
        "message.lostfeatures.journal_updated": "Journal updated: %s",
        "screen.lostfeatures.journal": "Ancient Journal", "screen.lostfeatures.journal.chronicle": "Chronicle",
        "screen.lostfeatures.journal.bestiary": "Bestiary", "screen.lostfeatures.journal.progress": "Discovered %s of %s",
        "screen.lostfeatures.journal.unknown": "??? Undiscovered",
        "screen.lostfeatures.journal.world_note": "Someone in this world has silenced the Ancestral Dragon.",
        "death.attack.lostfeatures.dragon_fire": "%1$s was scorched by %2$s",
        "death.attack.lostfeatures.dragon_fire.player": "%1$s was scorched by %2$s while fighting %3$s",
        "death.attack.lostfeatures.giant_slam": "%1$s was flattened by %2$s",
        "death.attack.lostfeatures.giant_slam.player": "%1$s was flattened by %2$s while fighting %3$s",
        "death.attack.lostfeatures.spike_trap": "%1$s stepped on an ancient spike trap",
        "death.attack.lostfeatures.spike_trap.player": "%1$s was pushed onto a spike trap by %2$s",
    }
    t.update(messages)

    # Story: original mod lore (not Minecraft canon). Title, text, and an unlock hint for each milestone.
    journal = {
        "first_steps": ("A Ruby-Bound Journal",
                        "The binding is warm, as if a heart beat inside it. Someone kept a record of a people who studied dragons, bent ruby light into logic and mapped the edge of the world. They called themselves the Emberwrights. I mean to follow their trail.",
                        "Craft a journal from a book and a ruby, or find one in a Starting House."),
        "ruby_found": ("The Red Stone", "Not redstone - ruby. The Emberwrights tuned their machines to its resonance. Where ruby lies near the surface, their ruins are rarely far.",
                       "Mine ruby ore."),
        "ancient_site": ("Stones That Remember", "Brick pyramids, a lonely glass pillar, walls of obsidian: markers left by the Emberwrights. Each hides a cache, and many a lock.",
                         "Explore an ancient structure."),
        "glyphs_read": ("Glyphs of Fire", "The glyphs repeat a warning: 'We bound the eldest flame beneath the altar. Do not wake it without the sigil of the three.'",
                        "Read an Ancient Glyph Brick."),
        "notes_found": ("Encrypted Notes", "Pages of cipher. Illusioners hunt for these too; their expeditions are drawn to the old sites.",
                        "Find Encrypted Notes in ruins or from an Illusioner expedition."),
        "notes_decoded": ("The Sigil of the Three", "Decoded at last: the Draconic Sigil needs the dust of illusion, the strength of a giant and the wings of a dragon, set around a heart of ruby.",
                          "Combine Encrypted Notes with a Lens Fragment."),
        "locked_chest_opened": ("Keys and Locks", "The Emberwrights sealed their best work in strongboxes that open only to ruby-tipped keys.",
                                "Open a Locked Chest with an Ancient Key."),
        "mechanism_built": ("Runic Engineering", "Their sensors hear the world, their logic stones count and remember. I have rebuilt one.",
                            "Craft or activate an ancient mechanism."),
        "reactor_awakened": ("The Ember Reactor", "Feed it ruby and it pulses with borrowed fire - never for free, always for a price paid in rare things.",
                             "Power an Ancient Energy Reactor."),
        "far_lands_reached": ("The Edge of the World", "Walls taller than mountains, riddled with tunnels, standing where the world forgets how to be smooth. The Emberwrights called it the Edge.",
                              "Use an Edge Compass."),
        "ender_dragon_victory": ("Of Dragons Beyond the Void", "The great void dragon has fallen. The Emberwrights wrote that the red dragons are its distant, earthbound kin - smaller, cleverer, and bound to the land.",
                                 "Defeat the Ender Dragon."),
        "wither_victory": ("The Withered Engine", "The Wither's star burned like a reactor core. The Emberwrights tried to build such engines from ruby instead - and learned to respect their cost.",
                           "Defeat the Wither."),
        "sigil_forged": ("The Sigil Forged", "Three trophies of three great creatures, bound in ruby. The altar in the dragon lair is waiting.",
                         "Craft the Draconic Sigil."),
        "altar_awakened": ("The Eldest Flame Wakes", "The altar drank the sigil and the mountain answered with a roar.",
                           "Use the sigil on an Ancient Altar in a dragon lair."),
        "ancestral_defeated": ("The Last Monolith", "The eldest flame is quiet again. Whatever the Emberwrights feared, it rests - for now. Their story is finished; mine is not.",
                               "Defeat the Ancestral Red Dragon."),
        "dragon_sighted": ("Bestiary: Red Dragon", "A red, earthbound dragon that lands, hunts livestock and guards its territory. It warns before it attacks - heed the roar.",
                           "Encounter a Red Dragon."),
        "dragon_defeated": ("Bestiary: Red Dragon (Defeated)", "Scales for armor, a fang for a blade, membranes for the sigil and a heart for the reactor. One victory is enough.",
                            "Defeat a Red Dragon."),
        "giant_defeated": ("Bestiary: Giant", "It raises its fists before the ground shakes. Step away when the arms go up.",
                           "Defeat a Giant."),
        "illusioner_defeated": ("Bestiary: Illusioner", "Mirror images and a blink-step. Watch for the one image that casts no shadow of doubt: it is the one that shoots.",
                                "Defeat an Illusioner."),
        "killer_bunny_defeated": ("Bestiary: Killer Bunny", "It hides among ordinary rabbits. The red eyes give it away - too late, usually.",
                                  "Defeat a Killer Bunny."),
    }
    for k, (title, text, hint) in journal.items():
        add(f"journal.lostfeatures.{k}.title", title)
        add(f"journal.lostfeatures.{k}.text", text)
        add(f"journal.lostfeatures.{k}.hint", "Hint: " + hint)
    glyphs = ["\"West, then south, then east: so the sun is read on the vault stones.\"",
              "\"Ruby hums where flame is bound.\"",
              "\"The eldest flame sleeps beneath the altar of the lair.\"",
              "\"Three trophies of three great creatures, set around a heart of ruby.\"",
              "\"Our walls stand where the world forgets itself.\"",
              "\"Keys of ruby and gold, for locks of oak and iron.\"",
              "\"The sensor listens; the logic remembers; the reactor pays.\"",
              "\"Do not wake it without the sigil of the three.\""]
    for i, g in enumerate(glyphs):
        add(f"glyph.lostfeatures.inscription.{i}", g)

    paintings = {"dragon_over_peaks": "Dragon over the Peaks", "forest_ruins": "Forest Ruins", "far_lands": "The Edge",
                 "ancient_reactor": "Ember Reactor", "monoliths": "Monoliths at Night", "the_illusionist": "The Illusionist",
                 "giants_shadow": "The Giant's Shadow", "ruby_cave": "Ruby Cave", "civilization_mural": "Mural of the Emberwrights",
                 "underground_machinery": "Deep Machinery", "journal_clue": "A Page of Clues", "ember_sky": "Ember Sky",
                 "brick_pyramid": "Brick Pyramid"}
    for k, v in paintings.items():
        add(f"painting.lostfeatures.{k}.title", v)
        add(f"painting.lostfeatures.{k}.author", "Lost Features")

    sounds_json = os.path.join(RES, "assets", NS, "sounds.json")
    if os.path.exists(sounds_json):
        for event, entry in json.load(open(sounds_json)).items():
            sub = entry.get("subtitle")
            if sub and sub not in t:
                words = event.split(".")
                subject = words[1].replace("_", " ").title() if len(words) > 2 else words[0].title()
                action = words[-1].replace("_", " ")
                if event.startswith("item.copper_horn"):
                    t[sub] = "Copper Horn plays"
                elif event.startswith("event."):
                    t[sub] = {"dragon_encounter": "Distant dragon roar", "rare_discovery": "Something rare surfaces",
                              "ancient_disturbance": "The ground rumbles", "village_alarm": "Village alarm", "illager_expedition": "Expedition horn",
                              "boss_phase": "The dragon grows furious", "boss_victory": "Victory", "story_discovery": "Journal updated"}.get(words[-1], subject)
                else:
                    t[sub] = f"{subject} {action}"
    write(f"assets/{NS}/lang/en_us.json", dict(sorted(t.items())))
    return len(t)


def main():
    tags()
    worldgen()
    damage_types()
    far_lands()
    relationships()
    trades()
    n = lang()
    print(f"data written; {n} lang entries")


if __name__ == "__main__":
    main()
