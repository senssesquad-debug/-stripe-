package com.lostfeatures.client;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.entity.LostGiant;
import com.lostfeatures.entity.LostIllusioner;
import com.lostfeatures.entity.RedDragon;
import com.lostfeatures.client.screen.JournalScreen;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.world.FarLands;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.core.BlockPos;
import net.minecraft.sounds.Music;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.phys.AABB;
import net.neoforged.neoforge.client.event.SelectMusicEvent;
import org.jspecify.annotations.Nullable;

/**
 * Picks a Lost Features theme only in Lost Features contexts (near our creatures, ancient sites, the
 * Far Lands or with the journal open); everywhere else vanilla music selection is left untouched.
 * The decision is re-evaluated at most once per second and uses the vanilla music volume slider.
 */
public final class SituationalMusic {
    private static @Nullable Music cached;
    private static long lastCheck = -100;

    private static final Music DRAGON_BOSS = new Music(ModSounds.MUSIC_DRAGON_BOSS, 0, 0, true);
    private static final Music DRAGON = new Music(ModSounds.MUSIC_DRAGON, 20, 200, true);
    private static final Music GIANT = new Music(ModSounds.MUSIC_GIANT, 20, 200, true);
    private static final Music ILLUSIONER = new Music(ModSounds.MUSIC_ILLUSIONER, 20, 200, true);
    private static final Music FAR_LANDS = new Music(ModSounds.MUSIC_FAR_LANDS, 1200, 6000, false);
    private static final Music UNDERGROUND = new Music(ModSounds.MUSIC_UNDERGROUND, 1200, 6000, false);
    private static final Music RUINS = new Music(ModSounds.MUSIC_RUINS, 600, 3600, false);
    private static final Music MECHANISM = new Music(ModSounds.MUSIC_MECHANISM, 600, 3600, false);
    private static final Music STORY = new Music(ModSounds.MUSIC_STORY, 100, 600, false);

    private SituationalMusic() {
    }

    public static void onSelectMusic(SelectMusicEvent event) {
        if (!LFConfig.SITUATIONAL_MUSIC.getAsBoolean()) {
            return;
        }
        Minecraft mc = Minecraft.getInstance();
        LocalPlayer player = mc.player;
        if (player == null || mc.level == null) {
            return;
        }
        long now = mc.level.getGameTime();
        if (now - lastCheck >= 20 || now < lastCheck) {
            lastCheck = now;
            cached = choose(mc, player);
        }
        if (cached != null) {
            event.setMusic(cached);
        }
    }

    private static @Nullable Music choose(Minecraft mc, LocalPlayer player) {
        if (mc.gui.screen() instanceof JournalScreen) {
            return STORY;
        }
        int range = LFConfig.MUSIC_TRIGGER_RANGE.getAsInt();
        AABB box = player.getBoundingBox().inflate(range);
        Music best = null;
        int priority = 0;
        for (Mob mob : mc.level.getEntitiesOfClass(Mob.class, box, m -> m instanceof RedDragon || m instanceof LostGiant || m instanceof LostIllusioner)) {
            if (mob instanceof RedDragon dragon && dragon.isAncestral()) {
                return DRAGON_BOSS;
            }
            if (mob instanceof RedDragon && priority < 3) {
                best = DRAGON;
                priority = 3;
            } else if (mob instanceof LostGiant && priority < 2) {
                best = GIANT;
                priority = 2;
            } else if (mob instanceof LostIllusioner && priority < 1) {
                best = ILLUSIONER;
                priority = 1;
            }
        }
        if (best != null) {
            return best;
        }
        if (mc.level.dimension() == FarLands.LEVEL) {
            return player.getY() < 50 ? UNDERGROUND : FAR_LANDS;
        }
        return nearAncientBlocks(mc, player.blockPosition());
    }

    /** A tiny 9x5x9 scan, done at most once per second. */
    private static @Nullable Music nearAncientBlocks(Minecraft mc, BlockPos center) {
        for (BlockPos p : BlockPos.betweenClosed(center.offset(-4, -2, -4), center.offset(4, 2, 4))) {
            var state = mc.level.getBlockState(p);
            if (state.is(ModBlocks.ANCIENT_ENERGY_REACTOR.get()) || state.is(ModBlocks.RUNIC_LOGIC_DEVICE.get())) {
                return MECHANISM;
            }
            if (state.is(ModBlocks.ANCIENT_GLYPH_BRICKS.get()) || state.is(ModBlocks.ANCIENT_ALTAR.get())) {
                return RUINS;
            }
        }
        return null;
    }
}
