package com.lostfeatures.world.ecology;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModTags;
import com.lostfeatures.world.memory.EventMemory;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.animal.Animal;
import net.minecraft.world.phys.AABB;

/**
 * A read-only snapshot of local conditions around a position. It combines the bounded event memory
 * with a single, small entity query over already-loaded chunks. Nothing is simulated in unloaded
 * chunks, no chunks are loaded, and no animals are ever removed to balance populations.
 */
public record RegionalEcology(int predatorActivity, int preyAvailability, int threatLevel, int recentCombat, int rareCreatureActivity) {
    public static final int RADIUS = 48;
    private static final long WINDOW = 24000L;

    public static RegionalEcology sample(ServerLevel level, BlockPos center) {
        if (!LFConfig.ECOLOGY_ENABLED.getAsBoolean()) {
            return new RegionalEcology(0, 0, 0, 0, 0);
        }
        EventMemory memory = EventMemory.get(level);
        int predator = memory.count(center, 128, WINDOW, EventMemory.Type.PREDATOR_ATTACK);
        int sightings = memory.count(center, 192, WINDOW, EventMemory.Type.DRAGON_SIGHTING);
        int threats = memory.count(center, 128, WINDOW, EventMemory.Type.VILLAGE_THREAT);
        int combat = memory.count(center, 128, WINDOW, EventMemory.Type.BOSS_ENCOUNTER);

        AABB box = new AABB(center).inflate(RADIUS, 24, RADIUS);
        int prey = 0;
        int rare = 0;
        for (Mob mob : level.getEntitiesOfClass(Mob.class, box, m -> m.isAlive())) {
            if (mob instanceof Animal && mob.is(ModTags.Entities.DRAGON_PREY)) {
                prey++;
            } else if (mob.is(ModTags.Entities.SENSOR_DETECTABLE)) {
                rare++;
            }
        }
        return new RegionalEcology(predator, prey, threats + sightings, combat, rare + sightings);
    }

    /** A region is "good hunting grounds" for a dragon when prey is plentiful and no dragon fed here recently. */
    public boolean suitsHuntingGrounds() {
        return preyAvailability >= 4 && predatorActivity < 3;
    }

    /** Villages recently threatened rest before another threat event can start. */
    public boolean villageNeedsRest() {
        return threatLevel >= 2;
    }
}
