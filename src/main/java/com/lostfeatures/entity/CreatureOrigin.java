package com.lostfeatures.entity;

import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;

/**
 * Records whether a Lost Features creature was created by a creative/admin tool (spawn egg,
 * command, spawner block, dispenser). Kills of such creatures still drop loot, but do not grant story
 * milestones unless {@code story.creativeSpawnsGrantProgression} is enabled. Stored in NeoForge's
 * per-entity persistent data so it survives save/reload for every entity class, including our
 * Illusioner subclass.
 */
public final class CreatureOrigin {
    private static final String KEY = "lostfeatures_creative_origin";

    private CreatureOrigin() {
    }

    public static void record(Entity entity, EntitySpawnReason reason) {
        boolean creative = reason == EntitySpawnReason.SPAWN_ITEM_USE || reason == EntitySpawnReason.COMMAND
                || reason == EntitySpawnReason.SPAWNER || reason == EntitySpawnReason.DISPENSER
                || reason == EntitySpawnReason.TRIAL_SPAWNER;
        if (creative) {
            entity.getPersistentData().putBoolean(KEY, true);
        }
    }

    public static boolean isCreative(Entity entity) {
        return entity.getPersistentData().getBooleanOr(KEY, false);
    }
}
