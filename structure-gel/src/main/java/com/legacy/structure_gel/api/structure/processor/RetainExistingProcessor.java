package com.legacy.structure_gel.api.structure.processor;

import com.mojang.serialization.MapCodec;
import net.minecraft.core.BlockPos;
import net.minecraft.tags.BlockTags;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessor;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate.StructureBlockInfo;
import org.jspecify.annotations.Nullable;

public class RetainExistingProcessor implements StructureProcessor {
    public static final RetainExistingProcessor INSTANCE = new RetainExistingProcessor();
    public static final MapCodec<RetainExistingProcessor> CODEC = MapCodec.unit(() -> INSTANCE);

    @Override
    public @Nullable StructureBlockInfo processBlock(
        LevelReader level,
        BlockPos targetPosition,
        BlockPos referencePos,
        BlockPos templateRelativePos,
        StructureBlockInfo processedBlockInfo,
        StructurePlaceSettings settings
    ) {
        BlockState locState = level.getBlockState(processedBlockInfo.pos());
        return !locState.canBeReplaced() && !locState.is(BlockTags.REPLACEABLE) ? null : processedBlockInfo;
    }

    @Override
    public MapCodec<? extends StructureProcessor> codec() {
        return CODEC;
    }
}
