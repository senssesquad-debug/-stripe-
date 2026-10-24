package com.lostfeatures;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.network.ModNetwork;
import com.lostfeatures.registry.ModBlockEntities;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModCreativeTabs;
import com.lostfeatures.registry.ModDataComponents;
import com.lostfeatures.registry.ModEntities;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.registry.ModSounds;
import com.mojang.logging.LogUtils;
import net.minecraft.resources.Identifier;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.fml.ModContainer;
import net.neoforged.fml.common.Mod;
import net.neoforged.fml.config.ModConfig;
import org.slf4j.Logger;

/**
 * Entry point for Lost Features — Living World.
 *
 * <p>Everything this mod adds is registered additively under the {@code lostfeatures} namespace.
 * No vanilla registry entry, recipe, loot table or behaviour is replaced.</p>
 */
@Mod(LostFeatures.MOD_ID)
public final class LostFeatures {
    public static final String MOD_ID = "lostfeatures";
    public static final Logger LOGGER = LogUtils.getLogger();

    public LostFeatures(IEventBus modEventBus, ModContainer container) {
        container.registerConfig(ModConfig.Type.COMMON, LFConfig.SPEC);

        ModSounds.register(modEventBus);
        com.lostfeatures.registry.ModWorldgen.register(modEventBus);
        com.lostfeatures.registry.ModConditions.register(modEventBus);
        ModDataComponents.register(modEventBus);
        ModBlocks.register(modEventBus);
        ModEntities.register(modEventBus);
        ModItems.register(modEventBus);
        ModBlockEntities.register(modEventBus);
        ModCreativeTabs.register(modEventBus);
        com.lostfeatures.world.structure.ModStructures.register(modEventBus);

        modEventBus.addListener(ModEntities::registerAttributes);
        modEventBus.addListener(ModBlockEntities::registerCapabilities);
        modEventBus.addListener(ModNetwork::register);
        modEventBus.addListener(net.neoforged.neoforge.data.event.GatherDataEvent.Client.class, com.lostfeatures.data.ModDataGenerators::gatherClientData);
        modEventBus.addListener(net.neoforged.neoforge.data.event.GatherDataEvent.Server.class, com.lostfeatures.data.ModDataGenerators::gatherServerData);

        LOGGER.info("Lost Features — Living World is loading");
    }

    public static Identifier id(String path) {
        return Identifier.fromNamespaceAndPath(MOD_ID, path);
    }
}
