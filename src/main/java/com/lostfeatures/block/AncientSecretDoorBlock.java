package com.lostfeatures.block;

import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.RenderShape;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.redstone.Orientation;
import net.minecraft.world.phys.shapes.CollisionContext;
import net.minecraft.world.phys.shapes.Shapes;
import net.minecraft.world.phys.shapes.VoxelShape;
import org.jspecify.annotations.Nullable;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * A wall segment that dissolves while powered. Connected segments (face-adjacent, up to
 * {@link #MAX_GROUP} blocks) open and close together, so a single button can open a whole doorway.
 */
public class AncientSecretDoorBlock extends Block {
    public static final BooleanProperty OPEN = BlockStateProperties.OPEN;
    public static final int MAX_GROUP = 16;

    public AncientSecretDoorBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(OPEN, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(OPEN);
    }

    @Override
    protected RenderShape getRenderShape(BlockState state) {
        return state.getValue(OPEN) ? RenderShape.INVISIBLE : RenderShape.MODEL;
    }

    @Override
    protected VoxelShape getShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return state.getValue(OPEN) ? Shapes.empty() : Shapes.block();
    }

    @Override
    protected VoxelShape getCollisionShape(BlockState state, BlockGetter level, BlockPos pos, CollisionContext context) {
        return state.getValue(OPEN) ? Shapes.empty() : Shapes.block();
    }

    @Override
    protected void neighborChanged(BlockState state, Level level, BlockPos pos, Block block, @Nullable Orientation orientation, boolean movedByPiston) {
        if (!level.isClientSide()) {
            level.scheduleTick(pos, this, 2);
        }
    }

    @Override
    protected void tick(BlockState state, ServerLevel level, BlockPos pos, RandomSource random) {
        List<BlockPos> group = collectGroup(level, pos);
        boolean powered = false;
        for (BlockPos p : group) {
            if (level.hasNeighborSignal(p)) {
                powered = true;
                break;
            }
        }
        boolean changed = false;
        for (BlockPos p : group) {
            BlockState s = level.getBlockState(p);
            if (s.is(this) && s.getValue(OPEN) != powered) {
                level.setBlock(p, s.setValue(OPEN, powered), Block.UPDATE_CLIENTS | Block.UPDATE_KNOWN_SHAPE);
                changed = true;
            }
        }
        if (changed) {
            level.playSound(null, pos, powered ? ModSounds.ANCIENT_DOOR_OPEN.get() : ModSounds.ANCIENT_DOOR_CLOSE.get(),
                    SoundSource.BLOCKS, 0.9F, 1.0F);
            AncientSignals.post(level, pos, AncientSignals.Kind.MECHANISM);
        }
    }

    private List<BlockPos> collectGroup(Level level, BlockPos start) {
        List<BlockPos> result = new ArrayList<>();
        Set<BlockPos> seen = new HashSet<>();
        ArrayDeque<BlockPos> queue = new ArrayDeque<>();
        queue.add(start);
        seen.add(start);
        while (!queue.isEmpty() && result.size() < MAX_GROUP) {
            BlockPos p = queue.poll();
            result.add(p);
            for (Direction d : Direction.values()) {
                BlockPos n = p.relative(d);
                if (seen.add(n) && level.isLoaded(n) && level.getBlockState(n).is(this)) {
                    queue.add(n);
                }
            }
        }
        return result;
    }
}
