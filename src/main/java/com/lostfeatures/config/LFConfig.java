package com.lostfeatures.config;

import net.neoforged.neoforge.common.ModConfigSpec;

import java.util.List;

/**
 * Common configuration. Values are read at runtime (never cached in static initialisers) so that
 * edits made through the config file take effect after a reload without corrupting saves.
 */
public final class LFConfig {
    public static final ModConfigSpec SPEC;

    // General
    public static final ModConfigSpec.BooleanValue DEBUG_LOGGING;

    // World generation (consumed by the lostfeatures:config_enabled datapack condition)
    public static final ModConfigSpec.BooleanValue RUBY_GENERATION;
    public static final ModConfigSpec.BooleanValue STRUCTURE_GENERATION;
    public static final ModConfigSpec.BooleanValue FLOWER_GENERATION;
    public static final ModConfigSpec.BooleanValue FAR_LANDS_ENABLED;

    // Red Dragon
    public static final ModConfigSpec.BooleanValue DRAGON_NATURAL_SPAWNING;
    public static final ModConfigSpec.DoubleValue DRAGON_SPAWN_CHANCE;
    public static final ModConfigSpec.IntValue DRAGON_SPAWN_COOLDOWN_TICKS;
    public static final ModConfigSpec.IntValue DRAGON_MAX_NEARBY;
    public static final ModConfigSpec.IntValue DRAGON_MIN_DISTANCE_FROM_WORLD_SPAWN;
    public static final ModConfigSpec.BooleanValue DRAGON_NEAR_PLAYER_BUILDS;
    public static final ModConfigSpec.BooleanValue DRAGON_ENVIRONMENTAL_DAMAGE;
    public static final ModConfigSpec.IntValue DRAGON_MAX_SCORCH_BLOCKS;
    public static final ModConfigSpec.DoubleValue DRAGON_HEALTH;
    public static final ModConfigSpec.DoubleValue DRAGON_BREATH_DAMAGE;
    public static final ModConfigSpec.BooleanValue DRAGON_BOSS_ENABLED;
    public static final ModConfigSpec.DoubleValue DRAGON_BOSS_HEALTH;
    public static final ModConfigSpec.ConfigValue<List<? extends String>> DRAGON_BIOME_TAGS;

    // Giant
    public static final ModConfigSpec.BooleanValue GIANT_NATURAL_SPAWNING;
    public static final ModConfigSpec.DoubleValue GIANT_SPAWN_CHANCE;
    public static final ModConfigSpec.DoubleValue GIANT_HEALTH;
    public static final ModConfigSpec.DoubleValue GIANT_SLAM_DAMAGE;
    public static final ModConfigSpec.BooleanValue GIANT_TERRAIN_INTERACTION;
    public static final ModConfigSpec.IntValue GIANT_ESCORT_COUNT;

    // Illusioner
    public static final ModConfigSpec.DoubleValue ILLUSIONER_HEALTH;
    public static final ModConfigSpec.IntValue ILLUSIONER_BLINDNESS_COOLDOWN;
    public static final ModConfigSpec.IntValue ILLUSIONER_REPOSITION_COOLDOWN;

    // Killer Bunny
    public static final ModConfigSpec.BooleanValue KILLER_BUNNY_NATURAL_SPAWNING;
    public static final ModConfigSpec.DoubleValue KILLER_BUNNY_SPAWN_CHANCE;
    public static final ModConfigSpec.DoubleValue KILLER_BUNNY_DAMAGE;

    // Dynamic events
    public static final ModConfigSpec.BooleanValue EVENTS_ENABLED;
    public static final ModConfigSpec.IntValue EVENT_CHECK_INTERVAL_TICKS;
    public static final ModConfigSpec.IntValue EVENT_MAX_ACTIVE;
    public static final ModConfigSpec.IntValue EVENT_GLOBAL_COOLDOWN_TICKS;
    public static final ModConfigSpec.DoubleValue EVENT_HUNTING_GROUNDS_CHANCE;
    public static final ModConfigSpec.DoubleValue EVENT_VILLAGE_THREAT_CHANCE;
    public static final ModConfigSpec.DoubleValue EVENT_EXPEDITION_CHANCE;
    public static final ModConfigSpec.DoubleValue EVENT_DISTURBANCE_CHANCE;
    public static final ModConfigSpec.IntValue EVENT_DURATION_TICKS;

    // Relationships and ecology
    public static final ModConfigSpec.BooleanValue RELATIONSHIPS_ENABLED;
    public static final ModConfigSpec.DoubleValue RELATIONSHIP_INTENSITY;
    public static final ModConfigSpec.BooleanValue ECOLOGY_ENABLED;
    public static final ModConfigSpec.IntValue MEMORY_MAX_RECORDS;
    public static final ModConfigSpec.IntValue MEMORY_EXPIRY_TICKS;

    // Redstone devices
    public static final ModConfigSpec.IntValue SENSOR_MAX_RANGE;
    public static final ModConfigSpec.IntValue SENSOR_SCAN_INTERVAL;
    public static final ModConfigSpec.IntValue REACTOR_PULSE_INTERVAL;
    public static final ModConfigSpec.IntValue REACTOR_CAPACITY;
    public static final ModConfigSpec.IntValue RUNIC_TIMING_WINDOW;
    public static final ModConfigSpec.BooleanValue TRAPS_DAMAGE_PLAYERS;

    // Story
    public static final ModConfigSpec.BooleanValue STORY_ENABLED;
    public static final ModConfigSpec.BooleanValue CREATIVE_SPAWNS_GRANT_PROGRESSION;
    public static final ModConfigSpec.BooleanValue STORY_ANNOUNCEMENTS;

    // Audio
    public static final ModConfigSpec.BooleanValue SITUATIONAL_MUSIC;
    public static final ModConfigSpec.IntValue MUSIC_TRIGGER_RANGE;

    static {
        ModConfigSpec.Builder b = new ModConfigSpec.Builder();

        b.push("general");
        DEBUG_LOGGING = b.comment("Log event-director, relationship and story decisions at INFO level.")
                .define("debugLogging", false);
        b.pop();

        b.push("worldgen");
        RUBY_GENERATION = b.comment("Generate ruby ore in new chunks. Requires a world reload; existing chunks are never modified.")
                .define("rubyGeneration", true);
        STRUCTURE_GENERATION = b.comment("Generate Lost Features structures (Brick Pyramids, monoliths, ruins, lairs) in new chunks.")
                .define("structureGeneration", true);
        FLOWER_GENERATION = b.comment("Generate roses and cyan roses in new chunks.")
                .define("flowerGeneration", true);
        FAR_LANDS_ENABLED = b.comment("Allow the Edge Compass to open travel to the Far Lands dimension.")
                .define("farLandsEnabled", true);
        b.pop();

        b.push("red_dragon");
        DRAGON_NATURAL_SPAWNING = b.comment("Allow the encounter director to place rare Red Dragon encounters.")
                .define("naturalSpawning", true);
        DRAGON_SPAWN_CHANCE = b.comment("Chance per eligible player per director check (default check: every 1200 ticks).",
                        "0.004 = 1 in 250 checks, i.e. about one attempt per ~12 in-game days of play per player, before biome/cooldown/population conditions.")
                .defineInRange("spawnChance", 0.004, 0.0, 1.0);
        DRAGON_SPAWN_COOLDOWN_TICKS = b.comment("Minimum ticks between natural dragon encounters in one dimension.")
                .defineInRange("spawnCooldownTicks", 72000, 0, Integer.MAX_VALUE);
        DRAGON_MAX_NEARBY = b.comment("No natural dragon spawns if this many Red Dragons are already within 256 blocks.")
                .defineInRange("maxNearby", 1, 0, 16);
        DRAGON_MIN_DISTANCE_FROM_WORLD_SPAWN = b.comment("Natural dragon encounters never start closer than this to the world spawn.")
                .defineInRange("minDistanceFromWorldSpawn", 512, 0, 100000);
        DRAGON_NEAR_PLAYER_BUILDS = b.comment("If false, natural encounters never start within 48 blocks of a bed (player bases and villages).")
                .define("allowNearPlayerBuilds", false);
        DRAGON_ENVIRONMENTAL_DAMAGE = b.comment("Fire breath may scorch grass blocks (they regrow) and burn away short grass, ferns and dead bushes (tag lostfeatures:dragon_scorchable). Respects mobGriefing.")
                .define("environmentalDamage", true);
        DRAGON_MAX_SCORCH_BLOCKS = b.comment("Hard cap of blocks a single breath can scorch.")
                .defineInRange("maxScorchBlocksPerBreath", 6, 0, 64);
        DRAGON_HEALTH = b.defineInRange("health", 160.0, 20.0, 2048.0);
        DRAGON_BREATH_DAMAGE = b.comment("Damage per breath tick (every 10 ticks) to entities inside the cone.")
                .defineInRange("breathDamage", 4.0, 0.0, 100.0);
        DRAGON_BOSS_ENABLED = b.comment("Allow the Ancestral Red Dragon finale encounter to be summoned at an Ancient Altar.")
                .define("bossEnabled", true);
        DRAGON_BOSS_HEALTH = b.defineInRange("bossHealth", 400.0, 50.0, 4096.0);
        DRAGON_BIOME_TAGS = b.comment("Biome tags where dragon encounters may start.")
                .defineListAllowEmpty("biomeTags", List.of("minecraft:is_mountain", "minecraft:is_badlands", "minecraft:is_savanna", "lostfeatures:dragon_habitat"),
                        () -> "minecraft:is_mountain", o -> o instanceof String);
        b.pop();

        b.push("giant");
        GIANT_NATURAL_SPAWNING = b.define("naturalSpawning", true);
        GIANT_SPAWN_CHANCE = b.comment("Chance per eligible player per director check at night on the surface.")
                .defineInRange("spawnChance", 0.006, 0.0, 1.0);
        GIANT_HEALTH = b.defineInRange("health", 220.0, 20.0, 2048.0);
        GIANT_SLAM_DAMAGE = b.defineInRange("slamDamage", 14.0, 0.0, 200.0);
        GIANT_TERRAIN_INTERACTION = b.comment("Ground slams may knock loose leaves and tall grass (never other blocks).")
                .define("terrainInteraction", true);
        GIANT_ESCORT_COUNT = b.comment("Zombies/skeletons that march with a naturally spawned Giant.")
                .defineInRange("escortCount", 3, 0, 8);
        b.pop();

        b.push("illusioner");
        ILLUSIONER_HEALTH = b.defineInRange("health", 48.0, 10.0, 1024.0);
        ILLUSIONER_BLINDNESS_COOLDOWN = b.defineInRange("blindnessCooldownTicks", 240, 20, 12000);
        ILLUSIONER_REPOSITION_COOLDOWN = b.defineInRange("repositionCooldownTicks", 140, 20, 12000);
        b.pop();

        b.push("killer_bunny");
        KILLER_BUNNY_NATURAL_SPAWNING = b.define("naturalSpawning", true);
        KILLER_BUNNY_SPAWN_CHANCE = b.comment("Chance per director check that a Killer Bunny appears near a wild rabbit close to a player.")
                .defineInRange("spawnChance", 0.01, 0.0, 1.0);
        KILLER_BUNNY_DAMAGE = b.defineInRange("attackDamage", 8.0, 0.0, 100.0);
        b.pop();

        b.push("events");
        EVENTS_ENABLED = b.define("enabled", true);
        EVENT_CHECK_INTERVAL_TICKS = b.comment("How often the encounter director evaluates each dimension.")
                .defineInRange("checkIntervalTicks", 1200, 100, 72000);
        EVENT_MAX_ACTIVE = b.defineInRange("maxActiveEventsPerDimension", 2, 0, 16);
        EVENT_GLOBAL_COOLDOWN_TICKS = b.comment("Minimum ticks between any two new events in one dimension.")
                .defineInRange("globalCooldownTicks", 24000, 0, Integer.MAX_VALUE);
        EVENT_HUNTING_GROUNDS_CHANCE = b.defineInRange("huntingGroundsChance", 0.02, 0.0, 1.0);
        EVENT_VILLAGE_THREAT_CHANCE = b.defineInRange("villageThreatChance", 0.03, 0.0, 1.0);
        EVENT_EXPEDITION_CHANCE = b.defineInRange("illagerExpeditionChance", 0.03, 0.0, 1.0);
        EVENT_DISTURBANCE_CHANCE = b.defineInRange("ancientDisturbanceChance", 0.05, 0.0, 1.0);
        EVENT_DURATION_TICKS = b.comment("Maximum duration of an event before it is resolved automatically.")
                .defineInRange("maxDurationTicks", 12000, 600, 240000);
        b.pop();

        b.push("living_world");
        RELATIONSHIPS_ENABLED = b.comment("Inject relationship goals (fear, predator, protective ally) defined in data/*/lostfeatures_relationships.")
                .define("relationshipsEnabled", true);
        RELATIONSHIP_INTENSITY = b.comment("Scales detection ranges of relationship goals.")
                .defineInRange("relationshipIntensity", 1.0, 0.1, 3.0);
        ECOLOGY_ENABLED = b.define("regionalEcologyEnabled", true);
        MEMORY_MAX_RECORDS = b.comment("Hard cap of local event-memory records per dimension.")
                .defineInRange("memoryMaxRecords", 256, 16, 4096);
        MEMORY_EXPIRY_TICKS = b.comment("Records older than this are discarded.")
                .defineInRange("memoryExpiryTicks", 168000, 1200, Integer.MAX_VALUE);
        b.pop();

        b.push("redstone");
        SENSOR_MAX_RANGE = b.defineInRange("eventSensorMaxRange", 16, 1, 32);
        SENSOR_SCAN_INTERVAL = b.comment("Ticks between event sensor entity queries.")
                .defineInRange("eventSensorScanInterval", 10, 2, 200);
        REACTOR_PULSE_INTERVAL = b.defineInRange("reactorPulseIntervalTicks", 20, 2, 1200);
        REACTOR_CAPACITY = b.comment("Maximum stored charge units in an Ancient Energy Reactor.")
                .defineInRange("reactorCapacity", 4000, 100, 100000);
        RUNIC_TIMING_WINDOW = b.comment("Ticks allowed between sequence inputs before the Runic Logic Device resets.")
                .defineInRange("runicTimingWindowTicks", 40, 2, 1200);
        TRAPS_DAMAGE_PLAYERS = b.define("trapsDamagePlayers", true);
        b.pop();

        b.push("story");
        STORY_ENABLED = b.define("enabled", true);
        CREATIVE_SPAWNS_GRANT_PROGRESSION = b.comment("If true, defeating spawn-egg or command-spawned mobs also unlocks story milestones.")
                .define("creativeSpawnsGrantProgression", false);
        STORY_ANNOUNCEMENTS = b.comment("Show a chat message when a journal entry is unlocked.")
                .define("announceDiscoveries", true);
        b.pop();

        b.push("audio");
        SITUATIONAL_MUSIC = b.comment("Client: play mod music themes near ancient sites and during encounters (uses the vanilla music slider).")
                .define("situationalMusic", true);
        MUSIC_TRIGGER_RANGE = b.defineInRange("musicTriggerRange", 48, 8, 128);
        b.pop();

        SPEC = b.build();
    }

    private LFConfig() {
    }

    /** Lookup used by the {@code lostfeatures:config_enabled} datapack condition. */
    public static boolean flag(String key) {
        return switch (key) {
            case "ruby_generation" -> RUBY_GENERATION.getAsBoolean();
            case "structure_generation" -> STRUCTURE_GENERATION.getAsBoolean();
            case "flower_generation" -> FLOWER_GENERATION.getAsBoolean();
            case "far_lands" -> FAR_LANDS_ENABLED.getAsBoolean();
            default -> true;
        };
    }
}
