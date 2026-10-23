package com.lostfeatures.entity.ai.relationship;

import com.mojang.serialization.Codec;
import net.minecraft.util.StringRepresentable;

/** Relationship categories. Each maps to one reusable goal; nothing is hard-coded per mob pair. */
public enum Relation implements StringRepresentable {
    /** Subject flees from target (prey from predator, fear response). */
    FEAR("fear"),
    /** Subject hunts target. */
    PREDATOR("predator"),
    /** Subject attacks target on sight (natural enemies, territorial rivals). */
    ENEMY("enemy"),
    /** Subject attacks a target that comes close to the subject's owner (tamed animals). */
    PROTECT_OWNER("protect_owner"),
    /** Subject heals a hurt target ally from range (e.g. witches supporting allies). */
    SUPPORT("support"),
    /** Subject stays near the target as an escort (e.g. undead marching with a Giant). */
    ESCORT("escort"),
    /** Explicitly no interaction; documents intent and lets packs disable defaults by overriding a file. */
    NEUTRAL("neutral");

    public static final Codec<Relation> CODEC = StringRepresentable.fromEnum(Relation::values);
    private final String name;

    Relation(String name) {
        this.name = name;
    }

    @Override
    public String getSerializedName() {
        return name;
    }
}
