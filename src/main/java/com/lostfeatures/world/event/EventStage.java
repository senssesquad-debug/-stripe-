package com.lostfeatures.world.event;

import com.mojang.serialization.Codec;
import net.minecraft.util.StringRepresentable;

/**
 * Shared event state machine: STARTING -> ACTIVE -> RESOLVING -> DONE.
 * <ul>
 *     <li>STARTING: participants are placed; announcement cues play.</li>
 *     <li>ACTIVE: the event runs its per-type behaviour until resolved or timed out.</li>
 *     <li>RESOLVING: short cooldown period; departures/cleanup happen here.</li>
 *     <li>DONE: removed from the active list on the next director tick.</li>
 * </ul>
 */
public enum EventStage implements StringRepresentable {
    STARTING("starting"), ACTIVE("active"), RESOLVING("resolving"), DONE("done");

    public static final Codec<EventStage> CODEC = StringRepresentable.fromEnum(EventStage::values);
    private final String name;

    EventStage(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }
}
