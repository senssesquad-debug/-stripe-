package com.lostfeatures.entity;

import net.minecraft.world.entity.Mob;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;

/**
 * Bounded lifetime for naturally placed rare creatures: if no player has been within
 * {@link #ABSENCE_RANGE} blocks for {@link #ABSENCE_LIMIT} ticks, the creature leaves the world.
 * This keeps natural encounters from accumulating in rarely visited regions while never removing
 * named, leashed, creative-spawned or boss creatures.
 */
public final class LostCreatureLifecycle {
    public static final double ABSENCE_RANGE = 160.0;
    public static final int ABSENCE_LIMIT = 6000;
    private static final int CHECK_INTERVAL = 100;

    private int absentTicks;
    private boolean natural;

    public void markNatural() {
        natural = true;
    }

    public boolean isNatural() {
        return natural;
    }

    /** Returns true when the mob should leave. Call once per server tick. */
    public boolean tick(Mob mob) {
        if (!natural || mob.hasCustomName() || mob.isLeashed() || mob.isPersistenceRequired()) {
            return false;
        }
        if (mob.tickCount % CHECK_INTERVAL != 0) {
            return false;
        }
        boolean playerNear = mob.level().getNearestPlayer(mob, ABSENCE_RANGE) != null;
        absentTicks = playerNear ? 0 : absentTicks + CHECK_INTERVAL;
        return absentTicks >= ABSENCE_LIMIT;
    }

    public void save(ValueOutput output) {
        output.putBoolean("lf_natural", natural);
        output.putInt("lf_absent", absentTicks);
    }

    public void load(ValueInput input) {
        natural = input.getBooleanOr("lf_natural", false);
        absentTicks = Math.max(0, input.getIntOr("lf_absent", 0));
    }
}
