package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.config.ConfigEnabledCondition;
import com.mojang.serialization.MapCodec;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.common.conditions.ICondition;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;
import net.neoforged.neoforge.registries.NeoForgeRegistries;

public final class ModConditions {
    public static final DeferredRegister<MapCodec<? extends ICondition>> CONDITIONS =
            DeferredRegister.create(NeoForgeRegistries.Keys.CONDITION_CODECS, LostFeatures.MOD_ID);

    public static final DeferredHolder<MapCodec<? extends ICondition>, MapCodec<ConfigEnabledCondition>> CONFIG_ENABLED =
            CONDITIONS.register("config_enabled", () -> ConfigEnabledCondition.CODEC);

    private ModConditions() {
    }

    public static void register(IEventBus bus) {
        CONDITIONS.register(bus);
    }
}
