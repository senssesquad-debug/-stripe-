package com.lostfeatures.world;

import com.lostfeatures.LostFeatures;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.Level;

/** Keys for the Far Lands dimension, defined in data/lostfeatures/dimension/far_lands.json. */
public final class FarLands {
    public static final ResourceKey<Level> LEVEL = ResourceKey.create(Registries.DIMENSION, LostFeatures.id("far_lands"));

    private FarLands() {
    }
}
