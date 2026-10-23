package com.lostfeatures.world.event;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.entity.KillerBunny;
import com.lostfeatures.entity.LostGiant;
import com.lostfeatures.registry.ModEntities;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.world.AncientSignals;
import com.lostfeatures.world.memory.EventMemory;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.animal.rabbit.Rabbit;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.LightLayer;

import java.util.List;

/**
 * Rare ambient appearances outside the four structured events. Each check is one roll per player per
 * director interval, only ever places creatures in entity-ticking chunks near that player, and is
 * capped by a "none already nearby" population check. Vanilla rabbits are never converted or removed;
 * a Killer Bunny simply appears beside a wild rabbit.
 */
public final class NaturalEncounters {
    private NaturalEncounters() {
    }

    public static boolean tryGiant(ServerLevel level, ServerPlayer player, RandomSource random, boolean forced) {
        if (!LFConfig.GIANT_NATURAL_SPAWNING.getAsBoolean() || level.dimension() != Level.OVERWORLD) return false;
        if (!forced) {
            if (!level.isDarkOutside() || random.nextDouble() >= LFConfig.GIANT_SPAWN_CHANCE.get()) return false;
            if (!level.canSeeSky(player.blockPosition())) return false;
        }
        if (!level.getEntitiesOfClass(LostGiant.class, player.getBoundingBox().inflate(128, 64, 128), LostGiant::isAlive).isEmpty()) return false;
        BlockPos at = EncounterDirector.surfaceSpot(level, player.blockPosition(), 40, 64, random, ModEntities.GIANT.get());
        if (at == null || (!forced && level.getBrightness(LightLayer.BLOCK, at) > 7)) return false;
        LostGiant giant = place(level, ModEntities.GIANT.get(), at, random);
        if (giant == null) return false;
        giant.lifecycle().markNatural();
        int escorts = LFConfig.GIANT_ESCORT_COUNT.getAsInt();
        for (int i = 0; i < escorts; i++) {
            EntityType<? extends Mob> type = random.nextBoolean() ? EntityTypes.ZOMBIE : EntityTypes.SKELETON;
            BlockPos ep = EncounterDirector.surfaceSpot(level, at, 2, 6, random, type);
            if (ep != null) {
                place(level, type, ep, random);
            }
        }
        level.playSound(null, at, ModSounds.GIANT_AMBIENT.get(), SoundSource.HOSTILE, 6.0F, 0.8F);
        EventMemory.get(level).record(EventMemory.Type.BOSS_ENCOUNTER, at, "giant_march");
        AncientSignals.post(level, at, AncientSignals.Kind.ENCOUNTER_START);
        return true;
    }

    public static boolean tryKillerBunny(ServerLevel level, ServerPlayer player, RandomSource random, boolean forced) {
        if (!LFConfig.KILLER_BUNNY_NATURAL_SPAWNING.getAsBoolean()) return false;
        if (!forced && random.nextDouble() >= LFConfig.KILLER_BUNNY_SPAWN_CHANCE.get()) return false;
        List<Rabbit> rabbits = level.getEntitiesOfClass(Rabbit.class, player.getBoundingBox().inflate(48, 16, 48), Rabbit::isAlive);
        if (rabbits.isEmpty()) return false;
        if (!level.getEntitiesOfClass(KillerBunny.class, player.getBoundingBox().inflate(64, 32, 64), KillerBunny::isAlive).isEmpty()) return false;
        Rabbit host = rabbits.get(random.nextInt(rabbits.size()));
        if (host.distanceToSqr(player) < 16 * 16 && !forced) return false; // never pop into existence in plain sight
        BlockPos at = EncounterDirector.surfaceSpot(level, host.blockPosition(), 1, 3, random, ModEntities.KILLER_BUNNY.get());
        if (at == null) return false;
        KillerBunny bunny = place(level, ModEntities.KILLER_BUNNY.get(), at, random);
        if (bunny == null) return false;
        bunny.lifecycle().markNatural();
        return true;
    }

    private static <T extends Mob> T place(ServerLevel level, EntityType<T> type, BlockPos pos, RandomSource random) {
        T mob = type.create(level, EntitySpawnReason.EVENT);
        if (mob == null) return null;
        mob.snapTo(pos.getX() + 0.5, pos.getY(), pos.getZ() + 0.5, random.nextFloat() * 360F, 0F);
        mob.finalizeSpawn(level, level.getCurrentDifficultyAt(pos), EntitySpawnReason.EVENT, null);
        level.addFreshEntityWithPassengers(mob);
        return mob;
    }
}
