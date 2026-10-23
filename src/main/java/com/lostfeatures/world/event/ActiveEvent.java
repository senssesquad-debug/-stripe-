package com.lostfeatures.world.event;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.core.BlockPos;
import net.minecraft.core.UUIDUtil;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Persistent state of one running event. Participants are stored as UUIDs (never live references) and
 * resolved through the level each tick; an unloaded participant simply pauses that part of the event
 * until it is loaded again or the event times out.
 */
public final class ActiveEvent {
    public static final int MAX_PARTICIPANTS = 12;

    public static final Codec<ActiveEvent> CODEC = RecordCodecBuilder.create(i -> i.group(
            Codec.INT.fieldOf("id").forGetter(e -> e.id),
            EventType.CODEC.fieldOf("type").forGetter(e -> e.type),
            EventStage.CODEC.fieldOf("stage").forGetter(e -> e.stage),
            BlockPos.CODEC.fieldOf("center").forGetter(e -> e.center),
            Codec.LONG.fieldOf("start").forGetter(e -> e.startTime),
            Codec.LONG.fieldOf("stage_time").forGetter(e -> e.stageTime),
            UUIDUtil.CODEC.optionalFieldOf("primary").forGetter(e -> Optional.ofNullable(e.primary)),
            UUIDUtil.CODEC.listOf().optionalFieldOf("participants", List.of()).forGetter(e -> e.participants),
            Codec.STRING.optionalFieldOf("outcome", "").forGetter(e -> e.outcome),
            Codec.INT.optionalFieldOf("counter", 0).forGetter(e -> e.counter)
    ).apply(i, ActiveEvent::new));

    final int id;
    final EventType type;
    EventStage stage;
    final BlockPos center;
    final long startTime;
    long stageTime;
    UUID primary;
    final List<UUID> participants;
    String outcome;
    int counter;

    ActiveEvent(int id, EventType type, EventStage stage, BlockPos center, long startTime, long stageTime, Optional<UUID> primary,
                List<UUID> participants, String outcome, int counter) {
        this.id = id;
        this.type = type;
        this.stage = stage;
        this.center = center.immutable();
        this.startTime = startTime;
        this.stageTime = stageTime;
        this.primary = primary.orElse(null);
        this.participants = new ArrayList<>(participants.subList(0, Math.min(participants.size(), MAX_PARTICIPANTS)));
        this.outcome = outcome;
        this.counter = counter;
    }

    static ActiveEvent create(int id, EventType type, BlockPos center, long now) {
        return new ActiveEvent(id, type, EventStage.STARTING, center, now, now, Optional.empty(), List.of(), "", 0);
    }

    void addParticipant(UUID uuid) {
        if (participants.size() < MAX_PARTICIPANTS && !participants.contains(uuid)) {
            participants.add(uuid);
        }
    }

    void setStage(EventStage next, long now) {
        stage = next;
        stageTime = now;
    }

    public int id() {
        return id;
    }

    public EventType type() {
        return type;
    }

    public EventStage stage() {
        return stage;
    }

    public BlockPos center() {
        return center;
    }

    public String outcome() {
        return outcome;
    }

    public long age(long now) {
        return now - startTime;
    }
}
