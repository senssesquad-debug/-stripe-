package com.lostfeatures.block;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModDamageTypes;
import com.lostfeatures.registry.ModSounds;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.InsideBlockEffectApplier;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.redstone.Orientation;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.VoxelShape;
import org.jspecify.annotations.Nullable;

/** A floor plate whose spikes extend while powered and hurt living entities standing in them. */
public class SpikeTrapBlock extends Block {
    public static final BooleanProperty EXTENDED = BooleanProperty.create("extended");
    private static final VoxelShape RETRACTED_SHAPE = Block.box(0, 0, 0, 16, 4, 16);
    private static final VoxelShape EXTENDED_SHAPE = Block.box(0, 0, 0, 16, 12, 16);
    private static final VoxelShape COLLISION = Block.box(0, 0, 0, 16, 4, 16);

    public SpikeTrapBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(EXTENDED, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(EXTENDED);
    }

    @Override
    protected VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return state.getValue(EXTENDED) ? EXTENDED_SHAPE : RETRACTED_SHAPE;
    }

    @Override
    protected VoxelShape getCollisionShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return COLLISION;
    }

    @Override
    protected void neighborChanged(BlockState state, Level level, BlockPos pos, Block block, @Nullable Orientation orientation, boolean movedByPiston) {
        if (level.isClientSide()) {
            return;
        }
        boolean powered = level.hasNeighborSignal(pos);
        if (powered != state.getValue(EXTENDED)) {
            level.setBlock(pos, state.setValue(EXTENDED, powered), Block.UPDATE_ALL);
            if (powered) {
                level.playSound(null, pos, ModSounds.SPIKE_TRAP_EXTEND.get(), SoundSource.BLOCKS, 0.8F, 1.0F);
            }
        }
    }

    @Override
    protected void entityInside(BlockState state, Level level, BlockPos pos, Entity entity, InsideBlockEffectApplier effectApplier, boolean isPrecise) {
        if (!state.getValue(EXTENDED) || !(level instanceof ServerLevel server) || !(entity instanceof LivingEntity living)) {
            return;
        }
        if (living instanceof Player player && (player.isCreative() || player.isSpectator() || !LFConfig.TRAPS_DAMAGE_PLAYERS.getAsBoolean())) {
            return;
        }
        if (server.getGameTime() % 10 == 0) {
            living.hurtServer(server, server.damageSources().source(ModDamageTypes.SPIKE_TRAP), 3.0F);
        }
    }
}
