package com.lostfeatures.story;

import com.lostfeatures.LostFeatures;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.stats.Stats;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.boss.enderdragon.EnderDragon;
import net.minecraft.world.entity.boss.wither.WitherBoss;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.entity.living.LivingDamageEvent;
import net.neoforged.neoforge.event.entity.living.LivingDeathEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;

import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Observes legitimate vanilla Ender Dragon and Wither victories. It only listens: no event is
 * cancelled, no damage, drop, experience or advancement is altered, and both bosses keep their
 * vanilla behaviour.
 *
 * <p>Who is credited: the killing player plus players who dealt damage to that boss (tracked here, at
 * most 32 per boss and 16 bosses at a time) and are within 192 blocks. Players are never credited
 * merely for standing nearby. Existing worlds are supported: on login, the vanilla per-player
 * {@code minecraft:killed} statistic for either boss unlocks the milestone retroactively.</p>
 */
@EventBusSubscriber(modid = LostFeatures.MOD_ID)
public final class VanillaBossObserver {
    private static final int MAX_TRACKED_BOSSES = 16;
    private static final Map<UUID, Set<UUID>> PARTICIPANTS = new LinkedHashMap<>(16, 0.75F, true) {
        @Override
        protected boolean removeEldestEntry(Map.Entry<UUID, Set<UUID>> eldest) {
            return size() > MAX_TRACKED_BOSSES;
        }
    };

    private VanillaBossObserver() {
    }

    private static boolean isVanillaBoss(LivingEntity entity) {
        return entity instanceof EnderDragon || entity instanceof WitherBoss;
    }

    @SubscribeEvent(priority = EventPriority.LOWEST)
    public static void onDamage(LivingDamageEvent.Post event) {
        LivingEntity entity = event.getEntity();
        if (!entity.level().isClientSide() && isVanillaBoss(entity)
                && event.getSource().getEntity() instanceof ServerPlayer player) {
            Set<UUID> set = PARTICIPANTS.computeIfAbsent(entity.getUUID(), k -> new HashSet<>());
            if (set.size() < 32) {
                set.add(player.getUUID());
            }
        }
    }

    @SubscribeEvent(priority = EventPriority.LOWEST)
    public static void onDeath(LivingDeathEvent event) {
        LivingEntity entity = event.getEntity();
        if (entity.level().isClientSide() || !isVanillaBoss(entity) || event.isCanceled()) {
            return;
        }
        Milestone milestone = entity instanceof EnderDragon ? Milestone.ENDER_DRAGON_VICTORY : Milestone.WITHER_VICTORY;
        Set<UUID> credited = new HashSet<>(PARTICIPANTS.getOrDefault(entity.getUUID(), Set.of()));
        if (event.getSource().getEntity() instanceof ServerPlayer killer) {
            credited.add(killer.getUUID());
        }
        PARTICIPANTS.remove(entity.getUUID());
        var server = entity.level().getServer();
        if (server == null) {
            return;
        }
        for (UUID id : credited) {
            ServerPlayer p = server.getPlayerList().getPlayer(id);
            if (p != null && p.level() == entity.level() && p.distanceToSqr(entity) < 192 * 192) {
                StoryEvents.unlock(p, milestone);
            }
        }
    }

    @SubscribeEvent
    public static void onLogin(PlayerEvent.PlayerLoggedInEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) {
            recoverFromStats(player);
            StoryEvents.sync(player, false);
        }
    }

    /** Retroactive unlocks for worlds where a vanilla boss was defeated before the mod was installed. */
    public static void recoverFromStats(ServerPlayer player) {
        if (player.getStats().getValue(Stats.ENTITY_KILLED.get(EntityTypes.ENDER_DRAGON)) > 0) {
            StoryEvents.unlock(player, Milestone.ENDER_DRAGON_VICTORY);
        }
        if (player.getStats().getValue(Stats.ENTITY_KILLED.get(EntityTypes.WITHER)) > 0) {
            StoryEvents.unlock(player, Milestone.WITHER_VICTORY);
        }
    }
}
