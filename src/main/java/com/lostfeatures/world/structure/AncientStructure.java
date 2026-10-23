package com.lostfeatures.world.structure;

import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.core.BlockPos;
import net.minecraft.util.StringRepresentable;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.Structure;
import net.minecraft.world.level.levelgen.structure.StructureType;

import java.util.Optional;

/**
 * Data-driven entry point for all Lost Features structures. Which buildings exist, where and how
 * often is configured entirely in data/lostfeatures/worldgen/structure(_set); only new chunks are
 * affected and vanilla structures are never modified.
 */
public class AncientStructure extends Structure {
    public static final MapCodec<AncientStructure> CODEC = RecordCodecBuilder.mapCodec(i -> i.group(
            settingsCodec(i),
            StringRepresentable.fromEnum(StructureKind::values).fieldOf("kind").forGetter(s -> s.kind)
    ).apply(i, AncientStructure::new));

    private final StructureKind kind;

    public AncientStructure(StructureSettings settings, StructureKind kind) {
        super(settings);
        this.kind = kind;
    }

    @Override
    public Optional<GenerationStub> findGenerationPoint(GenerationContext context) {
        int x = context.chunkPos().getMiddleBlockX();
        int z = context.chunkPos().getMiddleBlockZ();
        int y = context.chunkGenerator().getFirstOccupiedHeight(x, z, Heightmap.Types.WORLD_SURFACE_WG, context.heightAccessor(), context.randomState());
        int sea = context.chunkGenerator().getSeaLevel();
        if (y <= sea && kind != StructureKind.GLASS_PILLAR) {
            return Optional.empty(); // land structures only; never placed in oceans or rivers
        }
        BlockPos origin = new BlockPos(x - kind.sizeX / 2, y, z - kind.sizeZ / 2);
        long seed = context.seed() ^ context.chunkPos().pack() * 341873128712L;
        return Optional.of(new GenerationStub(origin, builder -> builder.addPiece(new AncientPiece(kind, origin, seed))));
    }

    @Override
    public StructureType<?> type() {
        return ModStructures.ANCIENT.get();
    }
}
