package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.world.FarLandsDensity;
import com.mojang.serialization.MapCodec;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.level.levelgen.DensityFunction;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModWorldgen {
    public static final DeferredRegister<MapCodec<? extends DensityFunction>> DENSITY_FUNCTION_TYPES =
            DeferredRegister.create(Registries.DENSITY_FUNCTION_TYPE, LostFeatures.MOD_ID);

    public static final DeferredHolder<MapCodec<? extends DensityFunction>, MapCodec<FarLandsDensity>> FAR_LANDS_WALLS =
            DENSITY_FUNCTION_TYPES.register("far_lands_walls", () -> FarLandsDensity.CODEC);

    private ModWorldgen() {
    }

    public static void register(IEventBus bus) {
        DENSITY_FUNCTION_TYPES.register(bus);
    }
}
