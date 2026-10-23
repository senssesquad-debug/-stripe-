package com.lostfeatures.item;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.FarLands;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.portal.TeleportTransition;
import net.minecraft.world.phys.Vec3;

/**
 * Travels between the Overworld and the Far Lands dimension. The return point is remembered per
 * player. Arrival is always placed on the top surface of the target column with a few seconds of
 * Slow Falling, so the jagged Far Lands walls cannot trap or kill the traveller.
 */
public class EdgeCompassItem extends Item {
    private static final String RETURN_KEY = "lostfeatures_far_lands_return";

    public EdgeCompassItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        if (!(player instanceof ServerPlayer serverPlayer) || !(level instanceof ServerLevel current)) {
            return InteractionResult.SUCCESS;
        }
        ItemStack stack = player.getItemInHand(hand);
        if (!LFConfig.FAR_LANDS_ENABLED.getAsBoolean()) {
            player.sendOverlayMessage(Component.translatable("message.lostfeatures.edge_compass.disabled"));
            return InteractionResult.FAIL;
        }
        var server = current.getServer();
        ServerLevel target;
        Vec3 pos;
        if (current.dimension() == FarLands.LEVEL) {
            target = server.overworld();
            long packed = serverPlayer.getPersistentData().getLongOr(RETURN_KEY, Long.MIN_VALUE);
            BlockPos back = packed == Long.MIN_VALUE ? target.getRespawnData().pos() : BlockPos.of(packed);
            pos = surface(target, back);
        } else if (current.dimension() == Level.OVERWORLD) {
            target = server.getLevel(FarLands.LEVEL);
            if (target == null) {
                player.sendOverlayMessage(Component.translatable("message.lostfeatures.edge_compass.missing"));
                return InteractionResult.FAIL;
            }
            serverPlayer.getPersistentData().putLong(RETURN_KEY, player.blockPosition().asLong());
            pos = surface(target, player.blockPosition());
        } else {
            player.sendOverlayMessage(Component.translatable("message.lostfeatures.edge_compass.wrong_dimension"));
            return InteractionResult.FAIL;
        }
        player.getCooldowns().addCooldown(stack, 200);
        current.playSound(null, player.blockPosition(), ModSounds.DRAGON_DEVICE_ACTIVATE.get(), SoundSource.PLAYERS, 1.0F, 0.8F);
        serverPlayer.teleport(new TeleportTransition(target, pos, Vec3.ZERO, player.getYRot(), player.getXRot(), TeleportTransition.PLAY_PORTAL_SOUND));
        serverPlayer.addEffect(new MobEffectInstance(MobEffects.SLOW_FALLING, 200));
        if (target.dimension() == FarLands.LEVEL) {
            StoryEvents.onFarLandsReached(serverPlayer);
        }
        return InteractionResult.SUCCESS;
    }

    private static Vec3 surface(ServerLevel level, BlockPos near) {
        int y = level.getChunk(near.getX() >> 4, near.getZ() >> 4).getHeight(Heightmap.Types.MOTION_BLOCKING, near.getX() & 15, near.getZ() & 15);
        int safeY = Math.min(Math.max(y + 1, level.getMinY() + 2), level.getMaxY() - 2);
        return new Vec3(near.getX() + 0.5, safeY, near.getZ() + 0.5);
    }
}
