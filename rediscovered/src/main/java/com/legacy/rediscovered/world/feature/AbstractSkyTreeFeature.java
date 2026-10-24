package com.legacy.rediscovered.world.feature;

import com.legacy.structure_gel.core.util.Internal;
import java.util.Map;
import java.util.Set;
import java.util.Map.Entry;
import java.util.function.BiConsumer;
import java.util.function.Function;
import java.util.function.Supplier;
import javax.annotation.Nullable;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.tags.BlockTags;
import net.minecraft.util.RandomSource;
import net.minecraft.util.Util;
import net.minecraft.util.valueproviders.ConstantInt;
import net.minecraft.world.level.WorldGenLevel;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.LeavesBlock;
import net.minecraft.world.level.block.RotatedPillarBlock;
import net.minecraft.world.level.block.SnowLayerBlock;
import net.minecraft.world.level.block.VineBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.levelgen.feature.TreeFeature;
import net.minecraft.world.level.levelgen.feature.configurations.TreeConfiguration;
import net.minecraft.world.level.levelgen.feature.configurations.TreeConfiguration.TreeConfigurationBuilder;
import net.minecraft.world.level.levelgen.feature.featuresize.TwoLayersFeatureSize;
import net.minecraft.world.level.levelgen.feature.foliageplacers.BlobFoliagePlacer;
import net.minecraft.world.level.levelgen.feature.foliageplacers.FoliagePlacer.FoliageSetter;
import net.minecraft.world.level.levelgen.feature.stateproviders.BlockStateProvider;
import net.minecraft.world.level.levelgen.feature.trunkplacers.StraightTrunkPlacer;
import net.minecraft.world.level.material.Fluids;

public abstract class AbstractSkyTreeFeature extends TreeFeature {
    public static final TreeConfiguration DUMMY_CONFIG = new TreeConfigurationBuilder(
            BlockStateProvider.simple(Blocks.OAK_LOG.defaultBlockState()),
            new StraightTrunkPlacer(4, 2, 0),
            BlockStateProvider.simple(Blocks.OAK_LEAVES.defaultBlockState()),
            new BlobFoliagePlacer(ConstantInt.of(2), ConstantInt.of(0), 3),
            new TwoLayersFeatureSize(1, 0, 1)
        )
        .ignoreVines()
        .build();
    private static final Map<Direction, BooleanProperty> VINE_PROPERTIES = VineBlock.PROPERTY_BY_DIRECTION
        .entrySet()
        .stream()
        .filter(e -> e.getKey() != Direction.UP)
        .collect(Util.toMap());
    protected final AbstractSkyTreeFeature.TreeProperties.Baked properties;

    public AbstractSkyTreeFeature(AbstractSkyTreeFeature.TreeProperties properties) {
        super(TreeConfiguration.CODEC);
        this.properties = properties.bake();
    }

    public boolean natural() {
        return this.properties.isNatural;
    }

    @Internal
    @Override
    public final boolean doPlace(
        WorldGenLevel level,
        RandomSource rand,
        BlockPos pos,
        @Deprecated BiConsumer<BlockPos, BlockState> changedRoots,
        BiConsumer<BlockPos, BlockState> changedLogs,
        FoliageSetter changedLeaves,
        TreeConfiguration config
    ) {
        BlockPos groundPos = pos.below();
        if (this.isValidGround(level, level.getBlockState(groundPos), groundPos)) {
            int height = this.properties.heightFunc.apply(rand);
            boolean placed = this.place(level, rand, pos, height, changedLogs, changedLeaves::set);
            if (placed && this.natural()) {
                this.placeFallenLeaves(level, rand, pos);
            }

            return placed;
        } else {
            return false;
        }
    }

    public abstract boolean place(
        WorldGenLevel var1, RandomSource var2, BlockPos var3, int var4, BiConsumer<BlockPos, BlockState> var5, BiConsumer<BlockPos, BlockState> var6
    );

    public boolean isValidGround(WorldGenLevel level, BlockState state, BlockPos pos) {
        return state.canSustainPlant(level, pos, Direction.UP, this.properties.sapling().get().getBlock().defaultBlockState()).isTrue()
            || state.is(BlockTags.SUBSTRATE_OVERWORLD)
            || state.is(Blocks.FARMLAND);
    }

    protected boolean setBlockIfOk(@Nullable BiConsumer<BlockPos, BlockState> changedBlocks, WorldGenLevel level, BlockPos pos, BlockState state) {
        pos = pos.immutable();
        Block block = state.getBlock();
        if (block instanceof RotatedPillarBlock) {
            if (this.isReplaceableByLogs(level, pos)) {
                this.setBlock(changedBlocks, level, pos, state);
                return true;
            } else {
                return false;
            }
        } else if (block instanceof LeavesBlock) {
            if (this.isReplaceableByLeaves(level, pos)) {
                this.setBlock(changedBlocks, level, pos, state);
                return true;
            } else {
                return false;
            }
        } else if (level.isEmptyBlock(pos) && state.canSurvive(level, pos)) {
            this.setBlock(changedBlocks, level, pos, state);
            if (block instanceof SnowLayerBlock) {
                BlockState lower = level.getBlockState(pos.below());
                if (lower.hasProperty(BlockStateProperties.SNOWY)) {
                    level.setBlock(pos.below(), lower.setValue(BlockStateProperties.SNOWY, true), 2);
                }
            }

            return true;
        } else {
            return false;
        }
    }

    protected void setBlock(@Nullable BiConsumer<BlockPos, BlockState> changedBlocks, WorldGenLevel level, BlockPos pos, BlockState state) {
        if (state.hasProperty(BlockStateProperties.WATERLOGGED) && level.getFluidState(pos).is(Fluids.WATER)) {
            state = state.setValue(BlockStateProperties.WATERLOGGED, true);
        }

        TreeFeature.setBlockKnownShape(level, pos, state);
        if (changedBlocks != null) {
            changedBlocks.accept(pos, state);
        }
    }

    public boolean isReplaceableByLeaves(WorldGenLevel level, BlockPos pos) {
        BlockState state = level.getBlockState(pos);
        return state.canBeReplaced() || state.is(BlockTags.REPLACEABLE_BY_TREES);
    }

    public boolean isReplaceableByLogs(WorldGenLevel level, BlockPos pos) {
        BlockState state = level.getBlockState(pos);
        return state.canBeReplaced() || state.is(BlockTags.REPLACEABLE_BY_TREES) || state.is(BlockTags.LOGS);
    }

    public static void placeVines(
        WorldGenLevel level,
        BlockPos trunkStart,
        RandomSource rand,
        int areaWidth,
        int areaHeight,
        int minVineLength,
        int maxVineLength,
        float placementChance,
        VineBlock vine,
        Set<Block> allowedAttachmentBlocks
    ) {
        int halfWidth = Math.max((areaWidth - 1) / 2, 1);

        for (int x = -halfWidth; x <= halfWidth; x++) {
            for (int z = -halfWidth; z <= halfWidth; z++) {
                for (int y = 2; y <= areaHeight; y++) {
                    BlockPos offsetPos = trunkStart.offset(x, y, z);
                    if (level.isEmptyBlock(offsetPos) && rand.nextFloat() < placementChance) {
                        for (Entry<Direction, BooleanProperty> prop : VINE_PROPERTIES.entrySet()) {
                            BlockState vineBlock = vine.defaultBlockState().setValue(prop.getValue(), true);
                            if (vineBlock.canSurvive(level, offsetPos)
                                && (
                                    allowedAttachmentBlocks.isEmpty()
                                        || allowedAttachmentBlocks.contains(level.getBlockState(offsetPos.relative(prop.getKey())).getBlock())
                                )) {
                                int maxLength = rand.nextInt(maxVineLength - minVineLength) + minVineLength;

                                for (int vineLength = 0;
                                    vineLength <= maxLength && level.isEmptyBlock(offsetPos.below(vineLength)) && vineBlock.canSurvive(level, offsetPos);
                                    vineLength++
                                ) {
                                    level.setBlock(offsetPos.below(vineLength), vineBlock, 6);
                                }
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    protected void placeFallenLeaves(WorldGenLevel level, RandomSource rand, BlockPos centerPos) {
        BlockState leafCarpet = this.properties.leafCarpet;
        if (leafCarpet != null) {
            float chance = this.properties.leafCarpetChance;
            int range = 4;

            for (int x = -range; x <= range; x++) {
                for (int z = -range; z <= range; z++) {
                    if (rand.nextFloat() < chance) {
                        for (int y = 2; y >= -3; y--) {
                            BlockPos offsetPos = centerPos.offset(x, y, z);
                            if (level.getBlockState(offsetPos.below()).is(BlockTags.DIRT)
                                && (this.setBlockIfOk(null, level, offsetPos, leafCarpet) || !level.isEmptyBlock(offsetPos) && y < 0)) {
                                break;
                            }
                        }
                    }
                }
            }
        }
    }

    public boolean isAreaOk(WorldGenLevel level, BlockPos pos, int trunkHeight, int trunkWidth, int leafStartHeight, int leafWidth) {
        int minY = level.getMinY();
        int maxY = level.getMaxY();
        if (pos.getY() > minY && pos.getY() + trunkHeight + 1 < maxY) {
            if (trunkWidth == 1) {
                for (int y = 0; y <= 1 + trunkHeight && pos.getY() + y >= 1 && pos.getY() + y < maxY; y++) {
                    if (!this.isReplaceableByLogs(level, pos.above(y))) {
                        return false;
                    }
                }
            } else {
                for (int y = 0; y <= 1 + trunkHeight && pos.getY() + y >= 1 && pos.getY() + y < maxY; y++) {
                    for (int x = 0; x < trunkWidth; x++) {
                        for (int z = 0; z < trunkWidth; z++) {
                            if (!this.isReplaceableByLogs(level, pos.offset(x, y, z))) {
                                return false;
                            }
                        }
                    }
                }
            }

            int width = Math.max((leafWidth - 1) / 2, 1);

            for (int y = leafStartHeight; y <= trunkHeight + 2 && pos.getY() + y >= 0 && pos.getY() + y < maxY; y++) {
                for (int x = -width; x <= width; x++) {
                    for (int z = -width; z <= width; z++) {
                        if (!this.isReplaceableByLogs(level, pos.offset(x, y, z))) {
                            return false;
                        }
                    }
                }
            }

            return true;
        } else {
            return false;
        }
    }

    public static class TreeProperties {
        final Supplier<BlockState> sapling;
        boolean isNatural = true;
        @Nullable
        BlockState leafCarpet = null;
        float leafCarpetChance = 0.0F;
        boolean fromDungeon = false;
        Function<RandomSource, Integer> heightFunc = r -> r.nextInt(3) + 5;

        private TreeProperties(Supplier<BlockState> sapling) {
            this.sapling = sapling;
        }

        public static AbstractSkyTreeFeature.TreeProperties of(Supplier<BlockState> sapling) {
            return new AbstractSkyTreeFeature.TreeProperties(sapling);
        }

        public static AbstractSkyTreeFeature.TreeProperties natural(Supplier<BlockState> sapling) {
            return of(sapling).setNatural(true);
        }

        public static AbstractSkyTreeFeature.TreeProperties artificial(Supplier<BlockState> sapling) {
            return of(sapling).setNatural(false);
        }

        public AbstractSkyTreeFeature.TreeProperties setNatural(boolean isNatural) {
            this.isNatural = isNatural;
            return this;
        }

        public AbstractSkyTreeFeature.TreeProperties leafCarpet(@Nullable BlockState block, float chance) {
            this.leafCarpet = block;
            this.leafCarpetChance = chance;
            return this;
        }

        public AbstractSkyTreeFeature.TreeProperties leafCarpet(@Nullable BlockState block) {
            return this.leafCarpet(block, 0.2F);
        }

        public AbstractSkyTreeFeature.TreeProperties fromDungeon() {
            this.fromDungeon = true;
            return this;
        }

        public AbstractSkyTreeFeature.TreeProperties height(int min, int max) {
            if (min <= max && max >= 0) {
                return this.height(rand -> min == max ? min : min + rand.nextInt(max - min + 1));
            } else {
                throw new IllegalArgumentException("Tried to set a tree's min height bigger than the max, or used negative values");
            }
        }

        public AbstractSkyTreeFeature.TreeProperties height(Function<RandomSource, Integer> heightFunc) {
            this.heightFunc = heightFunc;
            return this;
        }

        public AbstractSkyTreeFeature.TreeProperties.Baked bake() {
            return new AbstractSkyTreeFeature.TreeProperties.Baked(
                this.sapling, this.isNatural, this.leafCarpet, this.leafCarpetChance, this.fromDungeon, this.heightFunc
            );
        }

        public record Baked(
            Supplier<BlockState> sapling,
            boolean isNatural,
            BlockState leafCarpet,
            float leafCarpetChance,
            boolean fromDungeon,
            Function<RandomSource, Integer> heightFunc
        ) {
        }
    }
}
