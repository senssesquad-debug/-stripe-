package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.damagesource.DamageType;

/** Data-driven damage types (JSON under data/lostfeatures/damage_type). */
public final class ModDamageTypes {
    public static final ResourceKey<DamageType> DRAGON_FIRE = key("dragon_fire");
    public static final ResourceKey<DamageType> GIANT_SLAM = key("giant_slam");
    public static final ResourceKey<DamageType> SPIKE_TRAP = key("spike_trap");

    private static ResourceKey<DamageType> key(String name) {
        return ResourceKey.create(Registries.DAMAGE_TYPE, LostFeatures.id(name));
    }

    private ModDamageTypes() {
    }
}
