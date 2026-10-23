package com.lostfeatures.block;

import net.minecraft.util.StringRepresentable;

/** What an Ancient Event Sensor listens for. */
public enum SensorFilter implements StringRepresentable {
    CREATURES("creatures"),
    ENCOUNTERS("encounters"),
    MECHANISMS("mechanisms"),
    ANY("any");

    private final String name;

    SensorFilter(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }

    public SensorFilter next() {
        return values()[(ordinal() + 1) % values().length];
    }
}
