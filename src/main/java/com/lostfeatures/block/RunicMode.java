package com.lostfeatures.block;

import net.minecraft.util.StringRepresentable;

/** Logic modes of the Runic Logic Device. Inputs: left side, back, right side; output: front. */
public enum RunicMode implements StringRepresentable {
    /** Left AND right must both be powered. */
    AND("and"),
    /** At least two of the three inputs must be powered. */
    MAJORITY("majority"),
    /** Rising edges must arrive in the order left, back, right, each within the timing window. */
    SEQUENCE("sequence"),
    /** Left sets, right resets; output follows the stored bit. */
    LATCH("latch");

    private final String name;

    RunicMode(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }

    public RunicMode next() {
        return values()[(ordinal() + 1) % values().length];
    }
}
