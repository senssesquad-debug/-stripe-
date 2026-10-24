package com.legacy.structure_gel.api.dimension;

import java.util.Optional;
import java.util.OptionalInt;
import net.minecraft.core.HolderGetter;
import net.minecraft.core.registries.Registries;
import net.minecraft.data.worldgen.BootstrapContext;
import net.minecraft.resources.ResourceKey;
import net.minecraft.tags.BlockTags;
import net.minecraft.tags.TagKey;
import net.minecraft.tags.TimelineTags;
import net.minecraft.util.valueproviders.IntProvider;
import net.minecraft.util.valueproviders.UniformInt;
import net.minecraft.world.attribute.EnvironmentAttributeMap;
import net.minecraft.world.attribute.EnvironmentAttributeMap.Builder;
import net.minecraft.world.clock.WorldClock;
import net.minecraft.world.level.CardinalLighting.Type;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.dimension.DimensionType;
import net.minecraft.world.level.dimension.DimensionType.MonsterSettings;
import net.minecraft.world.level.dimension.DimensionType.Skybox;
import net.minecraft.world.timeline.Timeline;

public class DimensionTypeBuilder {
    private boolean hasFixedTime = false;
    private boolean hasSkyLight = true;
    private boolean hasCeiling = false;
    private boolean hasEnderDragonFight = false;
    private double coordinateScale = 1.0;
    private int minY = -64;
    private int height = 384;
    private OptionalInt logicalHeight = OptionalInt.empty();
    private TagKey<Block> infiniburn = BlockTags.INFINIBURN_OVERWORLD;
    private float ambientLight = 0.0F;
    private IntProvider monsterSpawnLightTest = UniformInt.of(0, 7);
    private int monsterSpawnBlockLightLimit = 0;
    private Skybox skybox = Skybox.OVERWORLD;
    private Type cardinalLightType = Type.DEFAULT;
    private EnvironmentAttributeMap attributes = EnvironmentAttributeMap.builder().build();
    private TagKey<Timeline> timeline = TimelineTags.IN_OVERWORLD;
    private Optional<ResourceKey<WorldClock>> worldClock = Optional.empty();

    private DimensionTypeBuilder() {
    }

    public static DimensionTypeBuilder of() {
        return new DimensionTypeBuilder();
    }

    public DimensionTypeBuilder fixedTime(boolean fixedTime) {
        this.hasFixedTime = fixedTime;
        return this;
    }

    public DimensionTypeBuilder hasSkyLight(boolean hasSkyLight) {
        this.hasSkyLight = hasSkyLight;
        return this;
    }

    public DimensionTypeBuilder hasCeiling(boolean hasCeiling) {
        this.hasCeiling = hasCeiling;
        return this;
    }

    public DimensionTypeBuilder coordinateScale(double coordinateScale) {
        this.coordinateScale = coordinateScale;
        return this;
    }

    public DimensionTypeBuilder minY(int minY) {
        this.minY = minY;
        return this;
    }

    public DimensionTypeBuilder height(int height) {
        this.height = height;
        return this;
    }

    public DimensionTypeBuilder logicalHeight(int logicalHeight) {
        this.logicalHeight = OptionalInt.of(logicalHeight);
        return this;
    }

    public DimensionTypeBuilder infiniburn(TagKey<Block> infiniburn) {
        this.infiniburn = infiniburn;
        return this;
    }

    public DimensionTypeBuilder ambientLight(float ambientLight) {
        this.ambientLight = ambientLight;
        return this;
    }

    public DimensionTypeBuilder monsterSpawnLightTest(IntProvider lightRange) {
        this.monsterSpawnLightTest = lightRange;
        return this;
    }

    public DimensionTypeBuilder monsterSpawnBlockLightLimit(int monsterSpawnBlockLightLimit) {
        this.monsterSpawnBlockLightLimit = monsterSpawnBlockLightLimit;
        return this;
    }

    public DimensionTypeBuilder environmentAttributes(Builder attributeBuilder) {
        this.attributes = attributeBuilder.build();
        return this;
    }

    public DimensionTypeBuilder skybox(Skybox skybox) {
        this.skybox = skybox;
        return this;
    }

    public DimensionTypeBuilder cardinalLightType(Type cardinalLightType) {
        this.cardinalLightType = cardinalLightType;
        return this;
    }

    public DimensionTypeBuilder hasEnderDragonFight() {
        this.hasEnderDragonFight = true;
        return this;
    }

    public DimensionTypeBuilder timeline(TagKey<Timeline> timelines) {
        this.timeline = timelines;
        return this;
    }

    public DimensionTypeBuilder worldClock(ResourceKey<WorldClock> worldClock) {
        this.worldClock = Optional.of(worldClock);
        return this;
    }

    public DimensionType build(BootstrapContext<?> context) {
        HolderGetter<Timeline> timelineReg = context.lookup(Registries.TIMELINE);
        HolderGetter<WorldClock> worldClockReg = context.lookup(Registries.WORLD_CLOCK);
        int logicalH = this.logicalHeight.orElseGet(() -> this.height - this.minY);
        return new DimensionType(
            this.hasFixedTime,
            this.hasSkyLight,
            this.hasCeiling,
            this.hasEnderDragonFight,
            this.coordinateScale,
            this.minY,
            this.height,
            logicalH,
            this.infiniburn,
            this.ambientLight,
            new MonsterSettings(this.monsterSpawnLightTest, this.monsterSpawnBlockLightLimit),
            this.skybox,
            this.cardinalLightType,
            this.attributes,
            timelineReg.getOrThrow(this.timeline),
            this.worldClock.map(worldClockReg::getOrThrow)
        );
    }
}
