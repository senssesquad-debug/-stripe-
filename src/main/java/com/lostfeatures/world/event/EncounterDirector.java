package com.lostfeatures.world.event;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.config.LFConfig;
import com.lostfeatures.entity.KillerBunny;
import com.lostfeatures.entity.LostGiant;
import com.lostfeatures.entity.LostIllusioner;
import com.lostfeatures.entity.RedDragon;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModEntities;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.registry.ModTags;
import com.lostfeatures.block.LockedChestBlock;
import com.lostfeatures.block.entity.LockedChestBlockEntity;
import com.lostfeatures.world.AncientSignals;
import com.lostfeatures.world.ecology.RegionalEcology;
import com.lostfeatures.world.memory.EventMemory;
import com.lostfeatures.world.structure.ModStructures;
import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.TagKey;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.ai.memory.MemoryModuleType;
import net.minecraft.world.entity.ai.village.poi.PoiManager;
import net.minecraft.world.entity.ai.village.poi.PoiTypes;
import net.minecraft.world.entity.animal.golem.IronGolem;
import net.minecraft.world.entity.monster.PatrollingMonster;
import net.minecraft.world.entity.npc.villager.Villager;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.saveddata.SavedDataType;
import net.minecraft.world.phys.AABB;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * Per-dimension director for rare encounters and the four dynamic event types. It runs on the server
 * thread from {@link EventTicker}, evaluates new events only every
 * {@code events.checkIntervalTicks}, considers only positions in entity-ticking (already loaded)
 * chunks around players, and never loads chunks. Active events are persisted and bounded by
 * {@code events.maxActiveEventsPerDimension}; per-type and global cooldowns prevent repeated spawning.
 */
public class EncounterDirector extends SavedData {
    public static final int DATA_VERSION = 1;

    public static final Codec<EncounterDirector> CODEC = RecordCodecBuilder.create(i -> i.group(
            Codec.INT.optionalFieldOf("version", DATA_VERSION).forGetter(d -> DATA_VERSION),
            ActiveEvent.CODEC.listOf().optionalFieldOf("events", List.of()).forGetter(d -> d.events),
            Codec.INT.optionalFieldOf("next_id", 1).forGetter(d -> d.nextId),
            Codec.LONG.optionalFieldOf("last_event", -1_000_000L).forGetter(d -> d.lastEventTime),
            Codec.LONG.optionalFieldOf("last_dragon", -1_000_000L).forGetter(d -> d.lastDragonTime),
            Codec.unboundedMap(Codec.STRING, Codec.LONG).optionalFieldOf("type_cooldowns", Map.of()).forGetter(d -> d.lastByType)
    ).apply(i, EncounterDirector::fromSaved));

    public static final SavedDataType<EncounterDirector> TYPE = new SavedDataType<>(LostFeatures.id("encounter_director"), EncounterDirector::new, CODEC);

    /** Each event type may start at most once per this many ticks per dimension. */
    private static final long TYPE_COOLDOWN = 36_000L;

    private final List<ActiveEvent> events = new ArrayList<>();
    private int nextId = 1;
    private long lastEventTime = -1_000_000L;
    private long lastDragonTime = -1_000_000L;
    private final Map<String, Long> lastByType = new HashMap<>();
    /** Why the last start attempt was refused (for admin commands and debug logs; not persisted). */
    private String lastRefusal = "";

    public EncounterDirector() {
    }

    private static EncounterDirector fromSaved(int version, List<ActiveEvent> events, int nextId, long lastEvent, long lastDragon,
                                               Map<String, Long> cooldowns) {
        EncounterDirector d = new EncounterDirector();
        if (version <= DATA_VERSION) {
            d.events.addAll(events);
        }
        d.nextId = nextId;
        d.lastEventTime = lastEvent;
        d.lastDragonTime = lastDragon;
        d.lastByType.putAll(cooldowns);
        return d;
    }

    public static EncounterDirector get(ServerLevel level) {
        return level.getDataStorage().computeIfAbsent(TYPE);
    }

    public String lastRefusal() {
        return lastRefusal;
    }

    private <T> T refuse(String reason) {
        lastRefusal = reason;
        return null;
    }

    public List<ActiveEvent> events() {
        return Collections.unmodifiableList(events);
    }

    // =========================================================================== ticking

    public void tick(ServerLevel level) {
        long now = level.getGameTime();
        if (now % 20 == 0 && !events.isEmpty()) {
            tickEvents(level, now);
        }
        int interval = LFConfig.EVENT_CHECK_INTERVAL_TICKS.getAsInt();
        if (now % interval == 0) {
            evaluate(level, now);
        }
    }

    private void evaluate(ServerLevel level, long now) {
        List<ServerPlayer> players = new ArrayList<>(level.getPlayers(p -> !p.isSpectator()));
        Collections.shuffle(players, new java.util.Random(now));
        RandomSource random = level.getRandom();
        for (ServerPlayer player : players) {
            NaturalEncounters.tryGiant(level, player, random, false);
            NaturalEncounters.tryKillerBunny(level, player, random, false);
            if (!LFConfig.EVENTS_ENABLED.getAsBoolean() || activeCount() >= LFConfig.EVENT_MAX_ACTIVE.getAsInt()
                    || now - lastEventTime < LFConfig.EVENT_GLOBAL_COOLDOWN_TICKS.getAsInt()) {
                continue;
            }
            List<EventType> order = new ArrayList<>(List.of(EventType.values()));
            Collections.shuffle(order, new java.util.Random(now ^ player.getUUID().getLeastSignificantBits()));
            for (EventType type : order) {
                if (tryStart(level, player, type, false) != null) {
                    break;
                }
            }
        }
    }

    private int activeCount() {
        int n = 0;
        for (ActiveEvent e : events) {
            if (e.stage != EventStage.DONE) n++;
        }
        return n;
    }

    public @Nullable ActiveEvent tryStart(ServerLevel level, ServerPlayer player, EventType type, boolean forced) {
        return tryStart(level, player.blockPosition(), type, forced);
    }

    /** Attempts to start an event near {@code anchor}. {@code forced} (admin command) skips chance and cooldowns, never safety checks. */
    public @Nullable ActiveEvent tryStart(ServerLevel level, BlockPos anchor, EventType type, boolean forced) {
        long now = level.getGameTime();
        lastRefusal = "conditions not met";
        if (!forced) {
            long last = lastByType.getOrDefault(type.getSerializedName(), -1_000_000L);
            if (now - last < TYPE_COOLDOWN) {
                return null;
            }
        }
        ActiveEvent started = switch (type) {
            case DRAGON_HUNTING_GROUNDS -> startHuntingGrounds(level, anchor, forced, now);
            case VILLAGE_UNDER_THREAT -> startVillageThreat(level, anchor, forced, now);
            case ILLAGER_EXPEDITION -> startExpedition(level, anchor, forced, now);
            case ANCIENT_DISTURBANCE -> startDisturbance(level, anchor, forced, now);
        };
        if (started != null) {
            events.add(started);
            lastEventTime = now;
            lastByType.put(type.getSerializedName(), now);
            setDirty();
            debug("started {} #{} at {}", type.getSerializedName(), started.id, started.center.toShortString());
        }
        return started;
    }

    public boolean stop(int id, long now) {
        for (ActiveEvent e : events) {
            if (e.id == id && e.stage != EventStage.DONE) {
                e.outcome = "stopped";
                e.setStage(EventStage.RESOLVING, now);
                setDirty();
                return true;
            }
        }
        return false;
    }

    private void tickEvents(ServerLevel level, long now) {
        int maxDuration = LFConfig.EVENT_DURATION_TICKS.getAsInt();
        Iterator<ActiveEvent> it = events.iterator();
        while (it.hasNext()) {
            ActiveEvent e = it.next();
            if (e.stage == EventStage.DONE) {
                it.remove();
                setDirty();
                continue;
            }
            if (e.stage == EventStage.RESOLVING) {
                if (now - e.stageTime >= 200) {
                    cleanup(level, e);
                    e.setStage(EventStage.DONE, now);
                    AncientSignals.post(level, e.center, AncientSignals.Kind.ENCOUNTER_END);
                    debug("event #{} done ({})", e.id, e.outcome);
                }
                setDirty();
                continue;
            }
            if (e.age(now) > maxDuration && e.stage == EventStage.ACTIVE) {
                e.outcome = e.outcome.isEmpty() ? "timed_out" : e.outcome;
                e.setStage(EventStage.RESOLVING, now);
                setDirty();
                continue;
            }
            switch (e.type) {
                case DRAGON_HUNTING_GROUNDS -> tickHuntingGrounds(level, e, now);
                case VILLAGE_UNDER_THREAT -> tickVillageThreat(level, e, now);
                case ILLAGER_EXPEDITION -> tickExpedition(level, e, now);
                case ANCIENT_DISTURBANCE -> tickDisturbance(level, e, now);
            }
            setDirty();
        }
    }

    /** Removes event creatures that nobody is watching; creatures near players stay and finish naturally. */
    private void cleanup(ServerLevel level, ActiveEvent e) {
        List<UUID> all = new ArrayList<>(e.participants);
        if (e.primary != null) all.add(e.primary);
        for (UUID id : all) {
            Entity entity = level.getEntity(id);
            if (entity instanceof Mob mob && mob.isAlive() && level.getNearestPlayer(mob, 48.0) == null && !mob.hasCustomName()) {
                mob.discard();
            }
        }
    }

    // =========================================================================== helpers

    private ActiveEvent newEvent(EventType type, BlockPos center, long now) {
        return ActiveEvent.create(nextId++, type, center, now);
    }

    private static void debug(String msg, Object... args) {
        if (LFConfig.DEBUG_LOGGING.getAsBoolean()) {
            LostFeatures.LOGGER.info("[director] " + msg, args);
        }
    }

    /** A surface position {@code min..max} blocks from {@code from} in an entity-ticking chunk, or null. */
    static @Nullable BlockPos surfaceSpot(ServerLevel level, BlockPos from, int min, int max, RandomSource random, EntityType<?> type) {
        for (int attempt = 0; attempt < 24; attempt++) {
            double angle = random.nextDouble() * Math.PI * 2;
            int dist = min + random.nextInt(Math.max(1, max - min));
            int x = from.getX() + Mth.floor(Math.cos(angle) * dist);
            int z = from.getZ() + Mth.floor(Math.sin(angle) * dist);
            BlockPos probe = new BlockPos(x, from.getY(), z);
            if (!level.isPositionEntityTicking(probe)) {
                continue;
            }
            int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, x, z);
            BlockPos pos = new BlockPos(x, y, z);
            if (!level.getBlockState(pos.below()).isSolid() || !level.getFluidState(pos).isEmpty()) {
                continue;
            }
            if (level.noCollision(type.getSpawnAABB(x + 0.5, y, z + 0.5))) {
                return pos;
            }
        }
        return null;
    }

    private static boolean inDragonBiome(ServerLevel level, BlockPos pos) {
        var biome = level.getBiome(pos);
        for (String s : LFConfig.DRAGON_BIOME_TAGS.get()) {
            Identifier id = Identifier.tryParse(s.startsWith("#") ? s.substring(1) : s);
            if (id != null && biome.is(TagKey.<Biome>create(Registries.BIOME, id))) {
                return true;
            }
        }
        return false;
    }

    private static Optional<EventMemory.Record> knownSite(ServerLevel level, BlockPos near, int radius, long minAge) {
        EventMemory memory = EventMemory.get(level);
        List<EventMemory.Record> sites = memory.query(near, radius, Long.MAX_VALUE,
                r -> r.type() == EventMemory.Type.STRUCTURE_DISCOVERY && level.getGameTime() - r.time() >= minAge);
        if (sites.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(sites.get(level.getRandom().nextInt(sites.size())));
    }

    private static void announce(ServerLevel level, BlockPos pos, net.minecraft.sounds.SoundEvent sound, float volume) {
        level.playSound(null, pos, sound, SoundSource.AMBIENT, volume, 1.0F);
    }

    private static @Nullable <T extends Mob> T spawn(ServerLevel level, EntityType<T> type, BlockPos pos, EntitySpawnReason reason) {
        T mob = type.create(level, reason);
        if (mob == null) {
            return null;
        }
        mob.snapTo(pos.getX() + 0.5, pos.getY(), pos.getZ() + 0.5, level.getRandom().nextFloat() * 360F, 0F);
        mob.finalizeSpawn(level, level.getCurrentDifficultyAt(pos), reason, null);
        level.addFreshEntityWithPassengers(mob);
        return mob;
    }

    // =========================================================================== 9.1 Dragon Hunting Grounds

    private @Nullable ActiveEvent startHuntingGrounds(ServerLevel level, BlockPos anchor, boolean forced, long now) {
        if (!LFConfig.DRAGON_NATURAL_SPAWNING.getAsBoolean() || level.dimension() != Level.OVERWORLD) {
            return refuse("dragon spawning disabled or not the Overworld");
        }
        RandomSource random = level.getRandom();
        if (!forced) {
            if (now - lastDragonTime < LFConfig.DRAGON_SPAWN_COOLDOWN_TICKS.getAsInt()) return null;
            if (random.nextDouble() >= LFConfig.DRAGON_SPAWN_CHANCE.get()) return null;
            if (!inDragonBiome(level, anchor)) return null;
            BlockPos spawn = level.getRespawnData().pos();
            int minDist = LFConfig.DRAGON_MIN_DISTANCE_FROM_WORLD_SPAWN.getAsInt();
            if (anchor.distSqr(spawn) < (double) minDist * minDist) return null;
        }
        int nearby = level.getEntitiesOfClass(RedDragon.class, new AABB(anchor).inflate(256, 128, 256), RedDragon::isAlive).size();
        if (nearby >= Math.max(1, LFConfig.DRAGON_MAX_NEARBY.getAsInt())) return refuse("population cap: " + nearby + " Red Dragon(s) within 256 blocks");
        BlockPos center = surfaceSpot(level, anchor, 48, 96, random, ModEntities.RED_DRAGON.get());
        if (center == null) return refuse("no free surface spot 48-96 blocks away in entity-ticking chunks");
        if (!LFConfig.DRAGON_NEAR_PLAYER_BUILDS.getAsBoolean() && !forced
                && level.getPoiManager().findClosest(h -> h.is(PoiTypes.HOME), center, 48, PoiManager.Occupancy.ANY).isPresent()) {
            return null; // beds nearby: a player base or village
        }
        if (!forced && RegionalEcology.sample(level, center).preyAvailability() < 2) {
            return null;
        }
        BlockPos sky = center.above(28);
        RedDragon dragon = ModEntities.RED_DRAGON.get().create(level, EntitySpawnReason.EVENT);
        if (dragon == null) return null;
        dragon.snapTo(sky.getX() + 0.5, sky.getY(), sky.getZ() + 0.5, random.nextFloat() * 360F, 0F);
        dragon.finalizeSpawn(level, level.getCurrentDifficultyAt(center), EntitySpawnReason.EVENT, null);
        dragon.setHomePos(center);
        dragon.lifecycle().markNatural();
        dragon.beginAirborne();
        level.addFreshEntity(dragon);
        lastDragonTime = now;

        ActiveEvent e = newEvent(EventType.DRAGON_HUNTING_GROUNDS, center, now);
        e.primary = dragon.getUUID();
        announce(level, center, ModSounds.EVENT_DRAGON_ENCOUNTER.get(), 8.0F);
        EventMemory.get(level).record(EventMemory.Type.DRAGON_SIGHTING, center, "hunting_grounds");
        AncientSignals.post(level, center, AncientSignals.Kind.ENCOUNTER_START);
        e.setStage(EventStage.ACTIVE, now);
        return e;
    }

    private void tickHuntingGrounds(ServerLevel level, ActiveEvent e, long now) {
        if (!level.isPositionEntityTicking(e.center)) {
            return; // paused: nobody nearby, nothing simulated
        }
        Entity entity = e.primary == null ? null : level.getEntity(e.primary);
        if (!(entity instanceof RedDragon dragon) || !dragon.isAlive()) {
            e.outcome = (entity == null) ? "slain_or_departed" : "slain";
            e.setStage(EventStage.RESOLVING, now);
            return;
        }
        e.counter++;
        // Encourage hunting inside the territory: point the dragon at prey every ~10 seconds.
        if (e.counter % 10 == 0 && dragon.getTarget() == null) {
            List<LivingEntity> prey = level.getEntitiesOfClass(LivingEntity.class, new AABB(e.center).inflate(32, 24, 32),
                    l -> l.isAlive() && l.is(ModTags.Entities.DRAGON_PREY));
            if (!prey.isEmpty()) {
                dragon.setTarget(prey.get(level.getRandom().nextInt(prey.size())));
            }
        }
        if (e.counter % 30 == 0) {
            EventMemory.get(level).record(EventMemory.Type.DRAGON_SIGHTING, dragon.blockPosition(), "patrol");
            AncientSignals.post(level, dragon.blockPosition(), AncientSignals.Kind.EVENT_STATE);
        }
    }

    // =========================================================================== 9.2 Village Under Threat

    private @Nullable ActiveEvent startVillageThreat(ServerLevel level, BlockPos anchor, boolean forced, long now) {
        if (level.dimension() != Level.OVERWORLD) return null;
        RandomSource random = level.getRandom();
        if (!forced && (!level.isDarkOutside() || random.nextDouble() >= LFConfig.EVENT_VILLAGE_THREAT_CHANCE.get())) return null;
        Optional<BlockPos> bell = level.getPoiManager().findClosest(h -> h.is(PoiTypes.MEETING), anchor, 64, PoiManager.Occupancy.ANY);
        if (bell.isEmpty() && !forced) return null;
        BlockPos center = bell.orElse(anchor);
        for (ActiveEvent other : events) {
            if (other.type == EventType.VILLAGE_UNDER_THREAT && other.center.distSqr(center) < 128 * 128 && other.stage != EventStage.DONE) {
                return refuse("another village threat is active within 128 blocks");
            }
        }
        if (!forced && RegionalEcology.sample(level, center).villageNeedsRest()) return null;

        // A Giant needs a large clear spot; when none is found nearby the threat falls back to Killer Bunnies.
        BlockPos giantAt = LFConfig.GIANT_NATURAL_SPAWNING.getAsBoolean() && random.nextFloat() < 0.7F
                ? surfaceSpot(level, center, 36, 52, random, ModEntities.GIANT.get()) : null;
        LostGiant g = giantAt == null ? null : spawn(level, ModEntities.GIANT.get(), giantAt, EntitySpawnReason.EVENT);
        boolean giant = g != null;
        ActiveEvent e = newEvent(EventType.VILLAGE_UNDER_THREAT, center, now);
        if (giant) {
            BlockPos at = giantAt;
            g.lifecycle().markNatural();
            e.primary = g.getUUID();
            for (int i = 0; i < Math.min(2, LFConfig.GIANT_ESCORT_COUNT.getAsInt()); i++) {
                BlockPos ep = surfaceSpot(level, at, 2, 6, random, EntityTypes.ZOMBIE);
                if (ep != null) {
                    Mob escort = spawn(level, EntityTypes.ZOMBIE, ep, EntitySpawnReason.EVENT);
                    if (escort != null) e.addParticipant(escort.getUUID());
                }
            }
        } else {
            for (int i = 0; i < 2; i++) {
                BlockPos at = surfaceSpot(level, center, 28, 44, random, ModEntities.KILLER_BUNNY.get());
                if (at == null) continue;
                KillerBunny b = spawn(level, ModEntities.KILLER_BUNNY.get(), at, EntitySpawnReason.EVENT);
                if (b != null) {
                    b.lifecycle().markNatural();
                    if (e.primary == null) e.primary = b.getUUID();
                    else e.addParticipant(b.getUUID());
                }
            }
            if (e.primary == null) return refuse("no safe surface spot for the threat within 52 blocks");
        }
        announce(level, center, ModSounds.EVENT_VILLAGE_ALARM.get(), 4.0F);
        EventMemory.get(level).record(EventMemory.Type.VILLAGE_THREAT, center, giant ? "giant" : "killer_bunnies");
        AncientSignals.post(level, center, AncientSignals.Kind.ENCOUNTER_START);
        e.setStage(EventStage.ACTIVE, now);
        return e;
    }

    private void tickVillageThreat(ServerLevel level, ActiveEvent e, long now) {
        if (!level.isPositionEntityTicking(e.center)) return;
        List<Mob> threats = new ArrayList<>();
        if (e.primary != null && level.getEntity(e.primary) instanceof Mob m && m.isAlive()) threats.add(m);
        for (UUID id : e.participants) {
            if (level.getEntity(id) instanceof Mob m && m.isAlive()) threats.add(m);
        }
        if (threats.isEmpty()) {
            e.outcome = "repelled";
            e.setStage(EventStage.RESOLVING, now);
            return;
        }
        AABB village = new AABB(e.center).inflate(48, 16, 48);
        boolean nearVillage = threats.stream().anyMatch(t -> t.blockPosition().closerThan(e.center, 64));
        if (nearVillage) {
            // Villagers shelter using vanilla's own bell-alarm memory; nothing about their AI is replaced.
            for (Villager v : level.getEntitiesOfClass(Villager.class, village, Villager::isAlive)) {
                v.getBrain().setMemory(MemoryModuleType.HEARD_BELL_TIME, now);
            }
            // Iron golems defend: point idle golems at the closest threat.
            for (IronGolem golem : level.getEntitiesOfClass(IronGolem.class, village, g -> g.isAlive() && g.getTarget() == null)) {
                threats.stream().filter(t -> t.distanceToSqr(golem) < 40 * 40)
                        .min((a, b) -> Double.compare(a.distanceToSqr(golem), b.distanceToSqr(golem)))
                        .ifPresent(golem::setTarget);
            }
        }
        // Threats march on the village if they have nothing to fight.
        for (Mob t : threats) {
            if (t.getTarget() == null && !t.blockPosition().closerThan(e.center, 12)) {
                t.getNavigation().moveTo(e.center.getX() + 0.5, e.center.getY(), e.center.getZ() + 0.5, 1.0);
            }
        }
    }

    // =========================================================================== 9.3 Illager Expedition

    private @Nullable ActiveEvent startExpedition(ServerLevel level, BlockPos anchor, boolean forced, long now) {
        RandomSource random = level.getRandom();
        if (!forced && random.nextDouble() >= LFConfig.EVENT_EXPEDITION_CHANCE.get()) return null;
        Optional<EventMemory.Record> site = knownSite(level, anchor, 160, forced ? 0 : 6000);
        BlockPos target;
        if (site.isPresent()) {
            target = site.get().pos();
        } else if (forced) {
            target = anchor;
        } else {
            return null;
        }
        if (!forced && EventMemory.get(level).count(target, 48, 72000, EventMemory.Type.ILLAGER_EXPEDITION) > 0) return null;
        BlockPos start = surfaceSpot(level, target, 24, 40, random, ModEntities.ILLUSIONER.get());
        if (start == null) return refuse("no free surface spot 24-40 blocks from the site");
        LostIllusioner leader = spawn(level, ModEntities.ILLUSIONER.get(), start, EntitySpawnReason.PATROL);
        if (leader == null) return null;
        leader.setExpeditionLeader(true);
        leader.setPatrolLeader(true);
        leader.setPatrolTarget(target);
        ActiveEvent e = newEvent(EventType.ILLAGER_EXPEDITION, target, now);
        e.primary = leader.getUUID();
        int followers = 2 + random.nextInt(2);
        for (int i = 0; i < followers; i++) {
            EntityType<? extends PatrollingMonster> type = random.nextBoolean() ? EntityTypes.PILLAGER : EntityTypes.VINDICATOR;
            BlockPos fp = surfaceSpot(level, start, 1, 4, random, type);
            if (fp == null) continue;
            PatrollingMonster follower = spawn(level, type, fp, EntitySpawnReason.PATROL);
            if (follower != null) {
                follower.setPatrolTarget(target);
                e.addParticipant(follower.getUUID());
            }
        }
        announce(level, start, ModSounds.EVENT_EXPEDITION.get(), 4.0F);
        EventMemory.get(level).record(EventMemory.Type.ILLAGER_EXPEDITION, target, "expedition_started");
        AncientSignals.post(level, target, AncientSignals.Kind.ENCOUNTER_START);
        e.setStage(EventStage.ACTIVE, now);
        return e;
    }

    private void tickExpedition(ServerLevel level, ActiveEvent e, long now) {
        Entity entity = e.primary == null ? null : level.getEntity(e.primary);
        if (!(entity instanceof LostIllusioner leader) || !leader.isAlive()) {
            if (level.isPositionEntityTicking(e.center)) {
                e.outcome = "leader_lost";
                e.setStage(EventStage.RESOLVING, now);
            }
            return;
        }
        if (leader.blockPosition().closerThan(e.center, 8)) {
            e.counter++;
            if (e.counter == 1) {
                AncientSignals.post(level, e.center, AncientSignals.Kind.EVENT_STATE);
            }
            if (e.counter >= 60) {
                // The expedition finished its survey and leaves with whatever it learned.
                e.outcome = "survey_complete";
                e.setStage(EventStage.RESOLVING, now);
            }
        } else if (e.counter == 0 && leader.getTarget() == null) {
            leader.setPatrolTarget(e.center);
        }
    }

    // =========================================================================== 9.4 Ancient Disturbance

    private @Nullable ActiveEvent startDisturbance(ServerLevel level, BlockPos anchor, boolean forced, long now) {
        RandomSource random = level.getRandom();
        if (!forced && random.nextDouble() >= LFConfig.EVENT_DISTURBANCE_CHANCE.get()) return null;
        Optional<EventMemory.Record> site = knownSite(level, anchor, 96, forced ? 0 : 1200);
        BlockPos center;
        if (site.isPresent()) {
            center = site.get().pos();
        } else if (forced) {
            center = anchor;
        } else {
            return null;
        }
        if (!level.isPositionEntityTicking(center)) return refuse("site is not in an entity-ticking chunk");
        if (!forced && EventMemory.get(level).count(center, 32, 24000, EventMemory.Type.ANCIENT_DISTURBANCE) > 0) return null;
        ActiveEvent e = newEvent(EventType.ANCIENT_DISTURBANCE, center, now);
        EventMemory.get(level).record(EventMemory.Type.ANCIENT_DISTURBANCE, center, "tremor");
        e.setStage(EventStage.STARTING, now);
        return e;
    }

    private void tickDisturbance(ServerLevel level, ActiveEvent e, long now) {
        if (!level.isPositionEntityTicking(e.center)) return;
        RandomSource random = level.getRandom();
        if (e.stage == EventStage.STARTING) {
            // Tremor: five seconds of rumbling, ash and sensor pulses.
            announce(level, e.center, ModSounds.EVENT_DISTURBANCE.get(), 3.0F);
            level.sendParticles(ParticleTypes.ASH, e.center.getX() + 0.5, e.center.getY() + 1.5, e.center.getZ() + 0.5, 40, 4, 1.5, 4, 0.01);
            level.sendParticles(ParticleTypes.ENCHANT, e.center.getX() + 0.5, e.center.getY() + 1.0, e.center.getZ() + 0.5, 30, 2, 1, 2, 0.5);
            AncientSignals.post(level, e.center, AncientSignals.Kind.EVENT_STATE);
            if (now - e.stageTime >= 100) {
                e.setStage(EventStage.ACTIVE, now);
            }
            return;
        }
        if (e.counter == 0) {
            e.counter = 1;
            float roll = random.nextFloat();
            if (roll < 0.25F && tryRevealChest(level, e.center)) {
                e.outcome = "mechanism_revealed";
            } else if (roll < 0.55F) {
                BlockPos at = surfaceSpot(level, e.center, 4, 10, random, ModEntities.KILLER_BUNNY.get());
                Mob guardian = null;
                if (at != null) {
                    guardian = random.nextInt(3) == 0
                            ? spawn(level, ModEntities.ILLUSIONER.get(), at, EntitySpawnReason.EVENT)
                            : spawn(level, ModEntities.KILLER_BUNNY.get(), at, EntitySpawnReason.EVENT);
                }
                if (guardian != null) {
                    e.primary = guardian.getUUID();
                    e.outcome = "guardian_awakened";
                } else {
                    dropClue(level, e.center);
                    e.outcome = "clue_surfaced";
                }
            } else {
                dropClue(level, e.center);
                e.outcome = "clue_surfaced";
            }
            level.playSound(null, e.center, ModSounds.EVENT_RARE_DISCOVERY.get(), SoundSource.AMBIENT, 2.0F, 1.0F);
            return;
        }
        if (now - e.stageTime >= 400) {
            e.setStage(EventStage.RESOLVING, now);
        }
    }

    private static void dropClue(ServerLevel level, BlockPos center) {
        int y = level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, center.getX(), center.getZ());
        var item = new net.minecraft.world.entity.item.ItemEntity(level, center.getX() + 0.5, Math.max(y, center.getY()) + 1.0, center.getZ() + 0.5,
                new ItemStack(ModItems.ENCRYPTED_NOTES.get()));
        item.setDefaultPickUpDelay();
        level.addFreshEntity(item);
    }

    /** Only places a chest on top of ancient masonry into empty air, so player builds are never overwritten. */
    private static boolean tryRevealChest(ServerLevel level, BlockPos center) {
        for (BlockPos p : BlockPos.betweenClosed(center.offset(-3, -2, -3), center.offset(3, 3, 3))) {
            var below = level.getBlockState(p.below());
            if (level.getBlockState(p).isAir() && (below.is(ModBlocks.ANCIENT_STONE.get()) || below.is(ModBlocks.ANCIENT_STONE_BRICKS.get())
                    || below.is(ModBlocks.CRACKED_ANCIENT_STONE_BRICKS.get()))) {
                BlockPos at = p.immutable();
                level.setBlockAndUpdate(at, ModBlocks.LOCKED_CHEST.get().defaultBlockState().setValue(LockedChestBlock.FACING, Direction.NORTH));
                if (level.getBlockEntity(at) instanceof LockedChestBlockEntity chest) {
                    chest.setLootTable(ModStructures.LOOT_LOCKED_ANCIENT, level.getRandom().nextLong());
                }
                level.sendParticles(ParticleTypes.END_ROD, at.getX() + 0.5, at.getY() + 0.8, at.getZ() + 0.5, 20, 0.3, 0.5, 0.3, 0.02);
                return true;
            }
        }
        return false;
    }
}
