package com.lostfeatures.block;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.entity.RedDragon;
import com.lostfeatures.registry.ModEntities;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.VoxelShape;

/**
 * Finale focus. Using a Draconic Sigil summons the Ancestral Red Dragon, provided no other
 * Ancestral dragon is within {@link #EXCLUSION_RADIUS} blocks, so the boss can never be stacked.
 */
public class AncientAltarBlock extends Block {
    public static final int EXCLUSION_RADIUS = 160;
    private static final VoxelShape SHAPE = Block.box(1, 0, 1, 15, 13, 15);

    public AncientAltarBlock(Properties properties) {
        super(properties);
    }

    @Override
    protected VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return SHAPE;
    }

    @Override
    protected InteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player,
                                          InteractionHand hand, BlockHitResult hit) {
        if (!stack.is(ModItems.DRACONIC_SIGIL.get())) {
            return InteractionResult.TRY_WITH_EMPTY_HAND;
        }
        if (!(level instanceof ServerLevel server)) {
            return InteractionResult.SUCCESS;
        }
        if (!LFConfig.DRAGON_BOSS_ENABLED.getAsBoolean()) {
            player.sendOverlayMessage(Component.translatable("message.lostfeatures.altar.disabled"));
            return InteractionResult.FAIL;
        }
        AABB area = new AABB(pos).inflate(EXCLUSION_RADIUS);
        boolean bossPresent = !server.getEntitiesOfClass(RedDragon.class, area, RedDragon::isAncestral).isEmpty();
        if (bossPresent) {
            player.sendOverlayMessage(Component.translatable("message.lostfeatures.altar.busy"));
            return InteractionResult.FAIL;
        }
        RedDragon boss = ModEntities.RED_DRAGON.get().create(server, EntitySpawnReason.TRIGGERED);
        if (boss == null) {
            return InteractionResult.FAIL;
        }
        boss.makeAncestral();
        boss.snapTo(pos.getX() + 0.5, pos.getY() + 12, pos.getZ() + 0.5, player.getYRot() + 180F, 0F);
        boss.finalizeSpawn(server, server.getCurrentDifficultyAt(pos), EntitySpawnReason.TRIGGERED, null);
        boss.setHomePos(pos);
        server.addFreshEntity(boss);
        stack.consume(1, player);
        server.playSound(null, pos, ModSounds.ALTAR_ACTIVATE.get(), SoundSource.HOSTILE, 2.0F, 1.0F);
        server.sendParticles(ParticleTypes.FLAME, pos.getX() + 0.5, pos.getY() + 1.2, pos.getZ() + 0.5, 60, 0.6, 0.8, 0.6, 0.05);
        AncientSignals.post(server, pos, AncientSignals.Kind.ENCOUNTER_START);
        if (player instanceof ServerPlayer serverPlayer) {
            StoryEvents.onAltarActivated(serverPlayer);
        }
        return InteractionResult.SUCCESS;
    }

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (!level.isClientSide()) {
            player.sendOverlayMessage(Component.translatable("message.lostfeatures.altar.hint"));
        }
        return InteractionResult.SUCCESS;
    }
}
