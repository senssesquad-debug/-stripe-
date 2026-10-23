package com.lostfeatures.world.structure;

import net.minecraft.util.StringRepresentable;

/**
 * Every Lost Features structure. Footprint sizes are hard limits used for the bounding box, so a
 * structure never writes outside its own box (and, per chunk, never outside the chunk being
 * generated).
 */
public enum StructureKind implements StringRepresentable {
    /** Infdev 2010 brick pyramid (historically solid); our version hides a small sealed chamber. */
    BRICK_PYRAMID("brick_pyramid", 31, 17, 31, 0),
    /** Indev 2010 starting house: stone floor, oak plank walls, two torches. */
    STARTING_HOUSE("starting_house", 9, 6, 9, 0),
    /** Infdev obsidian axis wall, reinterpreted as a weathered wall segment. */
    OBSIDIAN_WALL("obsidian_wall", 25, 9, 5, 0),
    /** Beta 1.9-pre3 stronghold glass pillar, reinterpreted as a marker above an ancient lab. */
    GLASS_PILLAR("glass_pillar", 9, 56, 9, 9),
    /** Infdev-Alpha inverted-terrain monolith, reinterpreted as a sheer ancient stone monolith. */
    MONOLITH("monolith", 11, 36, 11, 0),
    /** Original: ruins of the ancient civilisation's research outposts. */
    ANCIENT_RUINS("ancient_ruins", 17, 8, 17, 4),
    /** Original: a Red Dragon lair holding an Ancient Altar (story finale location). */
    DRAGON_LAIR("dragon_lair", 21, 12, 21, 3);

    private final String name;
    public final int sizeX;
    public final int sizeY;
    public final int sizeZ;
    /** Blocks below the surface the structure extends into. */
    public final int depth;

    StructureKind(String name, int sizeX, int sizeY, int sizeZ, int depth) {
        this.name = name;
        this.sizeX = sizeX;
        this.sizeY = sizeY;
        this.sizeZ = sizeZ;
        this.depth = depth;
    }

    @Override
    public String getSerializedName() {
        return name;
    }
}
