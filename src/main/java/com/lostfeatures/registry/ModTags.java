package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import net.minecraft.core.registries.Registries;
import net.minecraft.tags.TagKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.block.Block;

public final class ModTags {
    public static final class Entities {
        /** Mobs an Ancient Event Sensor in "creatures" mode reacts to. */
        public static final TagKey<EntityType<?>> SENSOR_DETECTABLE = tag("sensor_detectable");
        /** Animals a hunting Red Dragon may prey on. */
        public static final TagKey<EntityType<?>> DRAGON_PREY = tag("dragon_prey");
        /** Mobs that may march as a Giant's escort. */
        public static final TagKey<EntityType<?>> GIANT_ESCORT = tag("giant_escort");
        /** Lost Features threats that villages react to. */
        public static final TagKey<EntityType<?>> VILLAGE_THREATS = tag("village_threats");

        private static TagKey<EntityType<?>> tag(String name) {
            return TagKey.create(Registries.ENTITY_TYPE, LostFeatures.id(name));
        }
    }

    public static final class Items {
        public static final TagKey<Item> REACTOR_FUEL = tag("reactor_fuel");
        public static final TagKey<Item> REPAIRS_STUDDED_ARMOR = tag("repairs_studded_armor");
        public static final TagKey<Item> REPAIRS_DRAGONSCALE = tag("repairs_dragonscale");
        public static final TagKey<Item> RUBIES = TagKey.create(Registries.ITEM, net.minecraft.resources.Identifier.fromNamespaceAndPath("c", "gems/ruby"));

        private static TagKey<Item> tag(String name) {
            return TagKey.create(Registries.ITEM, LostFeatures.id(name));
        }
    }

    public static final class Blocks {
        /** Blocks a dragon's breath may scorch (natural vegetation only). */
        public static final TagKey<Block> DRAGON_SCORCHABLE = tag("dragon_scorchable");
        /** Blocks a Giant's slam may knock loose. */
        public static final TagKey<Block> GIANT_BREAKABLE = tag("giant_breakable");
        /** Blocks that indicate a player base (dragons avoid starting encounters here). */
        public static final TagKey<Block> PLAYER_BASE_MARKERS = tag("player_base_markers");

        private static TagKey<Block> tag(String name) {
            return TagKey.create(Registries.BLOCK, LostFeatures.id(name));
        }
    }

    public static final class Biomes {
        public static final TagKey<Biome> RUBY_ORE_BIOMES = tag("has_ruby_ore");
        public static final TagKey<Biome> HAS_BRICK_PYRAMID = tag("has_structure/brick_pyramid");
        public static final TagKey<Biome> HAS_MONOLITH = tag("has_structure/monolith");
        public static final TagKey<Biome> HAS_ANCIENT_RUINS = tag("has_structure/ancient_ruins");
        public static final TagKey<Biome> HAS_DRAGON_LAIR = tag("has_structure/dragon_lair");
        public static final TagKey<Biome> HAS_GLASS_PILLAR = tag("has_structure/glass_pillar");
        public static final TagKey<Biome> HAS_STARTING_HOUSE = tag("has_structure/starting_house");
        public static final TagKey<Biome> HAS_OBSIDIAN_WALL = tag("has_structure/obsidian_wall");

        private static TagKey<Biome> tag(String name) {
            return TagKey.create(Registries.BIOME, LostFeatures.id(name));
        }
    }

    private ModTags() {
    }
}
