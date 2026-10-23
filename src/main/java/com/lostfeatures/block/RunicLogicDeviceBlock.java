package com.lostfeatures.block;

import com.lostfeatures.block.entity.RunicLogicBlockEntity;
import com.lostfeatures.registry.ModSounds;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.level.redstone.ExperimentalRedstoneUtils;
import net.minecraft.world.level.redstone.Orientation;
import net.minecraft.world.phys.BlockHitResult;
import org.jspecify.annotations.Nullable;

/**
 * A logic block with three inputs and one output. Follows the vanilla diode convention: FACING
 * points at the back input and the output leaves from the opposite face.
 */
public class RunicLogicDeviceBlock extends Block implements EntityBlock {
    public static final EnumProperty<Direction> FACING = BlockStateProperties.HORIZONTAL_FACING;
    public static final BooleanProperty POWERED = BlockStateProperties.POWERED;
    public static final EnumProperty<RunicMode> MODE = EnumProperty.create("mode", RunicMode.class);
    /** When true the output is a short pulse on each satisfied condition instead of a steady level. */
    public static final BooleanProperty PULSE = BooleanProperty.create("pulse");

    public RunicLogicDeviceBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(FACING, Direction.NORTH).setValue(POWERED, false)
                .setValue(MODE, RunicMode.AND).setValue(PULSE, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(FACING, POWERED, MODE, PULSE);
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        return defaultBlockState().setValue(FACING, context.getHorizontalDirection().getOpposite());
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
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (!level.isClientSide()) {
            BlockState next;
            if (player.isShiftKeyDown()) {
                next = state.setValue(PULSE, !state.getValue(PULSE));
                player.sendOverlayMessage(Component.translatable(next.getValue(PULSE)
                        ? "message.lostfeatures.runic.pulse" : "message.lostfeatures.runic.steady"));
            } else {
                next = state.setValue(MODE, state.getValue(MODE).next()).setValue(POWERED, false);
                player.sendOverlayMessage(Component.translatable("message.lostfeatures.runic.mode",
                        Component.translatable("mode.lostfeatures." + next.getValue(MODE).getSerializedName())));
                if (level.getBlockEntity(pos) instanceof RunicLogicBlockEntity be) {
                    be.resetState();
                }
            }
            level.setBlock(pos, next, Block.UPDATE_ALL);
            updateFront(level, pos, next);
            level.playSound(null, pos, ModSounds.RUNIC_RESET.get(), SoundSource.BLOCKS, 0.5F, 1.2F);
            level.scheduleTick(pos, this, 1);
        }
        return InteractionResult.SUCCESS;
    }

    @Override
    protected void neighborChanged(BlockState state, Level level, BlockPos pos, Block block, @Nullable Orientation orientation, boolean movedByPiston) {
        if (!level.isClientSide()) {
            level.scheduleTick(pos, this, 1);
        }
    }

    @Override
    protected void onPlace(BlockState state, Level level, BlockPos pos, BlockState oldState, boolean movedByPiston) {
        if (!level.isClientSide() && !oldState.is(this)) {
            level.scheduleTick(pos, this, 1);
        }
    }

    @Override
    protected void tick(BlockState state, ServerLevel level, BlockPos pos, RandomSource random) {
        if (level.getBlockEntity(pos) instanceof RunicLogicBlockEntity be) {
            boolean output = be.evaluate(level, state, readInputs(level, pos, state));
            if (output != state.getValue(POWERED)) {
                BlockState next = state.setValue(POWERED, output);
                level.setBlock(pos, next, Block.UPDATE_ALL);
                updateFront(level, pos, next);
            }
            int wake = be.nextWakeDelay(level);
            if (wake > 0) {
                level.scheduleTick(pos, this, wake);
            }
        }
    }

    /** Bit 0: left, bit 1: back, bit 2: right (relative to the output arrow). */
    public static int readInputs(Level level, BlockPos pos, BlockState state) {
        Direction back = state.getValue(FACING);
        Direction left = back.getClockWise();
        Direction right = back.getCounterClockWise();
        int mask = 0;
        if (level.getSignal(pos.relative(left), left) > 0) mask |= 1;
        if (level.getSignal(pos.relative(back), back) > 0) mask |= 2;
        if (level.getSignal(pos.relative(right), right) > 0) mask |= 4;
        return mask;
    }

    private void updateFront(Level level, BlockPos pos, BlockState state) {
        Direction out = state.getValue(FACING).getOpposite();
        BlockPos front = pos.relative(out);
        Orientation orientation = ExperimentalRedstoneUtils.initialOrientation(level, out, Direction.UP);
        level.neighborChanged(front, this, orientation);
        level.updateNeighborsAtExceptFromFacing(front, this, out.getOpposite(), orientation);
    }

    @Override
    protected boolean isSignalSource(BlockState state) {
        return true;
    }

    @Override
    protected int getSignal(BlockState state, BlockGetter level, BlockPos pos, Direction direction) {
        return state.getValue(POWERED) && state.getValue(FACING) == direction ? 15 : 0;
    }

    @Override
    protected int getDirectSignal(BlockState state, BlockGetter level, BlockPos pos, Direction direction) {
        return getSignal(state, level, pos, direction);
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new RunicLogicBlockEntity(pos, state);
    }
}
