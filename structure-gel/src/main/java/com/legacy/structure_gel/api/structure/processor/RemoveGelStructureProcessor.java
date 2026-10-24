package com.legacy.structure_gel.api.structure.processor;

import com.legacy.structure_gel.api.block.gel.StructureGelBlock;
import com.legacy.structure_gel.api.data.tags.SGTags;
import com.mojang.serialization.MapCodec;
import javax.annotation.Nullable;
import net.minecraft.core.BlockPos;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessor;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate.StructureBlockInfo;

public final class RemoveGelStructureProcessor implements StructureProcessor {
    public static final RemoveGelStructureProcessor INSTANCE = new RemoveGelStructureProcessor();
    public static final MapCodec<RemoveGelStructureProcessor> CODEC = MapCodec.unit(() -> INSTANCE);

    private RemoveGelStructureProcessor() {
    }

    @Nullable
    @Override
    public StructureBlockInfo processBlock(
        LevelReader level, BlockPos pos, BlockPos pos2, BlockPos templateRelativePos, StructureBlockInfo placed, StructurePlaceSettings settings
    ) {
        if (placed.state().is(SGTags.BlockTags.GEL)) {
            return new StructureBlockInfo(
                placed.pos(), placed.state().getBlock() instanceof StructureGelBlock gel ? gel.getReplacementState() : Blocks.AIR.defaultBlockState(), null
            );
        } else {
            return placed.state().is(Blocks.AIR) ? null : placed;
        }
    }

    @Override
    public MapCodec<? extends StructureProcessor> codec() {
        return CODEC;
    }
}
