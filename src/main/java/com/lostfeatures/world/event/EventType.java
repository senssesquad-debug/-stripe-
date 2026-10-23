package com.lostfeatures.world.event;

import com.mojang.serialization.Codec;
import net.minecraft.util.StringRepresentable;

public enum EventType implements StringRepresentable {
    DRAGON_HUNTING_GROUNDS("dragon_hunting_grounds"),
    VILLAGE_UNDER_THREAT("village_under_threat"),
    ILLAGER_EXPEDITION("illager_expedition"),
    ANCIENT_DISTURBANCE("ancient_disturbance");

    public static final Codec<EventType> CODEC = StringRepresentable.fromEnum(EventType::values);
    private final String name;

    EventType(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }
}
