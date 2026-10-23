package com.lostfeatures.block;

import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;
import net.minecraft.world.entity.projectile.arrow.AbstractArrow;
import net.minecraft.world.entity.projectile.arrow.Arrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.level.redstone.Orientation;
import org.jspecify.annotations.Nullable;

/**
 * Fires a single dart (an arrow that cannot be picked up) on each rising redstone edge. It is a
 * separate block, so vanilla dispensers keep their behaviour; it has no inventory and darts never
 * drop as items, so it cannot be used to duplicate arrows.
 */
public class DartTrapBlock extends Block {
    public static final EnumProperty<Direction> FACING = BlockStateProperties.FACING;
    public static final BooleanProperty TRIGGERED = BlockStateProperties.TRIGGERED;

    public DartTrapBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(FACING, Direction.NORTH).setValue(TRIGGERED, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(FACING, TRIGGERED);
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        return defaultBlockState().setValue(FACING, context.getNearestLookingDirection().getOpposite());
    }

    @Override
    protected BlockState rotate(BlockState state, Rotation rotation) {
        return state.setValue(FACING, rotation.rotate(state.getValue(FACING)));
    }

    @Override
    protected BlockState mirror(BlockState state, Mirror mirror) {
        return state.rotate(mirror.getRotation(state.getValue(FACING)));
    }

    @Override
    protected void neighborChanged(BlockState state, Level level, BlockPos pos, Block block, @Nullable Orientation orientation, boolean movedByPiston) {
        if (level.isClientSide()) {
            return;
        }
        boolean powered = level.hasNeighborSignal(pos);
        boolean triggered = state.getValue(TRIGGERED);
        if (powered && !triggered) {
            level.scheduleTick(pos, this, 2);
            level.setBlock(pos, state.setValue(TRIGGERED, true), Block.UPDATE_CLIENTS);
        } else if (!powered && triggered) {
            level.setBlock(pos, state.setValue(TRIGGERED, false), Block.UPDATE_CLIENTS);
        }
    }

    @Override
    protected void tick(BlockState state, ServerLevel level, BlockPos pos, RandomSource random) {
        Direction dir = state.getValue(FACING);
        double x = pos.getX() + 0.5 + dir.getStepX() * 0.7;
        double y = pos.getY() + 0.5 + dir.getStepY() * 0.7 - 0.1;
        double z = pos.getZ() + 0.5 + dir.getStepZ() * 0.7;
        Arrow dart = new Arrow(level, x, y, z, new ItemStack(Items.ARROW), null);
        dart.pickup = AbstractArrow.Pickup.CREATIVE_ONLY;
        dart.setBaseDamage(2.0);
        dart.shoot(dir.getStepX(), dir.getStepY() + 0.05, dir.getStepZ(), 1.4F, 3.0F);
        level.addFreshEntity(dart);
        level.playSound(null, pos, ModSounds.DART_TRAP_FIRE.get(), SoundSource.BLOCKS, 0.9F, 0.9F + random.nextFloat() * 0.2F);
        AncientSignals.post(level, pos, AncientSignals.Kind.MECHANISM);
    }
}
