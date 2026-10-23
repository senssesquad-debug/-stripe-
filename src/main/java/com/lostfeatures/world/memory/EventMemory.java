package com.lostfeatures.world.memory;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.config.LFConfig;
import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.util.StringRepresentable;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.saveddata.SavedDataType;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.function.Predicate;

/**
 * Bounded local event memory for one dimension. Records are small value objects (type, position,
 * short detail string, game time) - never entity references - and are capped by
 * {@code living_world.memoryMaxRecords} and expired after {@code living_world.memoryExpiryTicks}.
 * Data is versioned so that future formats can migrate or discard safely.
 */
public class EventMemory extends SavedData {
    public static final int DATA_VERSION = 1;

    public enum Type implements StringRepresentable {
        PREDATOR_ATTACK, DRAGON_SIGHTING, VILLAGE_THREAT, ILLAGER_EXPEDITION, BOSS_ENCOUNTER, STRUCTURE_DISCOVERY, ANCIENT_DISTURBANCE;

        public static final Codec<Type> CODEC = StringRepresentable.fromEnum(Type::values);

        @Override
        public String getSerializedName() {
            return name().toLowerCase(java.util.Locale.ROOT);
        }
    }

    public record Record(Type type, BlockPos pos, String detail, long time) {
        public static final Codec<Record> CODEC = RecordCodecBuilder.create(i -> i.group(
                Type.CODEC.fieldOf("type").forGetter(Record::type),
                BlockPos.CODEC.fieldOf("pos").forGetter(Record::pos),
                Codec.string(0, 64).fieldOf("detail").forGetter(Record::detail),
                Codec.LONG.fieldOf("time").forGetter(Record::time)
        ).apply(i, Record::new));
    }

    public static final Codec<EventMemory> CODEC = RecordCodecBuilder.create(i -> i.group(
            Codec.INT.optionalFieldOf("version", DATA_VERSION).forGetter(m -> DATA_VERSION),
            Record.CODEC.listOf().optionalFieldOf("records", List.of()).forGetter(m -> new ArrayList<>(m.records))
    ).apply(i, EventMemory::fromSaved));

    public static final SavedDataType<EventMemory> TYPE = new SavedDataType<>(LostFeatures.id("event_memory"), EventMemory::new, CODEC);

    private final Deque<Record> records = new ArrayDeque<>();
    private long lastKnownTime;

    public EventMemory() {
    }

    private static EventMemory fromSaved(int version, List<Record> saved) {
        EventMemory memory = new EventMemory();
        if (version <= DATA_VERSION) {
            memory.records.addAll(saved);
        } else {
            LostFeatures.LOGGER.warn("Event memory saved by a newer Lost Features version (v{}); starting fresh", version);
        }
        return memory;
    }

    public static EventMemory get(ServerLevel level) {
        EventMemory memory = level.getDataStorage().computeIfAbsent(TYPE);
        memory.lastKnownTime = level.getGameTime();
        return memory;
    }

    public void record(Type type, BlockPos pos, String detail) {
        prune();
        int max = LFConfig.MEMORY_MAX_RECORDS.getAsInt();
        while (records.size() >= max) {
            records.pollFirst();
        }
        String safe = detail.length() > 64 ? detail.substring(0, 64) : detail;
        records.addLast(new Record(type, pos.immutable(), safe, lastKnownTime));
        setDirty();
        if (LFConfig.DEBUG_LOGGING.getAsBoolean()) {
            LostFeatures.LOGGER.info("[memory] {} at {} ({})", type.getSerializedName(), pos.toShortString(), safe);
        }
    }

    public List<Record> query(BlockPos center, int radius, long maxAge, Predicate<Record> filter) {
        prune();
        long r2 = (long) radius * radius;
        List<Record> result = new ArrayList<>();
        for (Record r : records) {
            if (lastKnownTime - r.time() <= maxAge && r.pos().distSqr(center) <= r2 && filter.test(r)) {
                result.add(r);
            }
        }
        return result;
    }

    public int count(BlockPos center, int radius, long maxAge, Type type) {
        return query(center, radius, maxAge, r -> r.type() == type).size();
    }

    public int size() {
        return records.size();
    }

    private void prune() {
        long expiry = LFConfig.MEMORY_EXPIRY_TICKS.getAsInt();
        boolean changed = false;
        while (!records.isEmpty() && lastKnownTime - records.peekFirst().time() > expiry) {
            records.pollFirst();
            changed = true;
        }
        if (changed) {
            setDirty();
        }
    }
}
