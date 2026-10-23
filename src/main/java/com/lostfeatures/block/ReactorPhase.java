package com.lostfeatures.block;

import net.minecraft.util.StringRepresentable;

public enum ReactorPhase implements StringRepresentable {
    IDLE("idle"), ACTIVE("active"), COOLDOWN("cooldown");

    private final String name;

    ReactorPhase(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }
}
