package com.legacy.structure_gel.api.structure.processor;

import com.mojang.serialization.Codec;
import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import javax.annotation.Nullable;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.world.level.LevelReader;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructurePlaceSettings;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureProcessor;
import net.minecraft.world.level.levelgen.structure.templatesystem.StructureTemplate.StructureBlockInfo;

public class RandomBlockSwapProcessor implements StructureProcessor {
    public static final MapCodec<RandomBlockSwapProcessor> CODEC = RecordCodecBuilder.mapCodec(
        instance -> instance.group(
                BuiltInRegistries.BLOCK.byNameCodec().fieldOf("condition").forGetter(processor -> processor.condition),
                Codec.FLOAT.fieldOf("chance").forGetter(processor -> processor.chance),
                BlockState.CODEC.fieldOf("change_to").forGetter(processor -> processor.changeTo)
            )
            .apply(instance, RandomBlockSwapProcessor::new)
    );
    private final Block condition;
    private final float chance;
    private final BlockState changeTo;

    public RandomBlockSwapProcessor(Block condition, float chance, BlockState changeTo) {
        this.condition = condition;
        this.chance = chance;
        this.changeTo = changeTo;
    }

    public RandomBlockSwapProcessor(Block condition, BlockState changeTo) {
        this(condition, 1.0F, changeTo);
    }

    public RandomBlockSwapProcessor(Block condition, float chance, Block changeTo) {
        this(condition, chance, changeTo.defaultBlockState());
    }

    public RandomBlockSwapProcessor(Block condition, Block changeTo) {
        this(condition, changeTo.defaultBlockState());
    }

    @Nullable
    @Override
    public StructureBlockInfo processBlock(
        LevelReader level, BlockPos pos, BlockPos pos2, BlockPos templateRelativePos, StructureBlockInfo placed, StructurePlaceSettings settings
    ) {
        return !placed.state().getBlock().equals(this.condition) || this.chance != 1.0F && !(settings.getRandom(placed.pos()).nextFloat() < this.chance)
            ? placed
            : new StructureBlockInfo(placed.pos(), this.changeTo, null);
    }

    @Override
    public MapCodec<? extends StructureProcessor> codec() {
        return CODEC;
    }
}
