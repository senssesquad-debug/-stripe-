package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.item.QuiverContents;
import com.mojang.serialization.Codec;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.codec.ByteBufCodecs;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModDataComponents {
    public static final DeferredRegister.DataComponents COMPONENTS =
            DeferredRegister.createDataComponents(Registries.DATA_COMPONENT_TYPE, LostFeatures.MOD_ID);

    public static final DeferredHolder<DataComponentType<?>, DataComponentType<QuiverContents>> QUIVER_CONTENTS =
            COMPONENTS.registerComponentType("quiver_contents", b -> b
                    .persistent(QuiverContents.CODEC)
                    .networkSynchronized(QuiverContents.STREAM_CODEC));

    /** Copper horn tune variant 0-9; absent means "not yet attuned" (assigned when crafted). */
    public static final DeferredHolder<DataComponentType<?>, DataComponentType<Integer>> HORN_TUNE =
            COMPONENTS.registerComponentType("horn_tune", b -> b
                    .persistent(Codec.intRange(0, 9))
                    .networkSynchronized(ByteBufCodecs.VAR_INT));

    private ModDataComponents() {
    }

    public static void register(IEventBus bus) {
        COMPONENTS.register(bus);
    }
}
