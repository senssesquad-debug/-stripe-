package com.lostfeatures.block;

import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;

/**
 * A grass block burnt by dragon fire. It is a temporary environmental trace: random ticks regrow it
 * into a vanilla grass block, so dragon territories heal on their own.
 */
public class ScorchedGrassBlock extends Block {
    public ScorchedGrassBlock(Properties properties) {
        super(properties);
    }

    @Override
    protected boolean isRandomlyTicking(BlockState state) {
        return true;
    }

    @Override
    protected void randomTick(BlockState state, ServerLevel level, BlockPos pos, RandomSource random) {
        if (random.nextInt(6) == 0 && level.getMaxLocalRawBrightness(pos.above()) >= 9
                && level.getBlockState(pos.above()).isAir()) {
            level.setBlockAndUpdate(pos, Blocks.GRASS_BLOCK.defaultBlockState());
        }
    }
}
