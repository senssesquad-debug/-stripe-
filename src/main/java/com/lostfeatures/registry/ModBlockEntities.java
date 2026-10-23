package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.block.entity.AncientEnergyReactorBlockEntity;
import com.lostfeatures.block.entity.AncientEventSensorBlockEntity;
import com.lostfeatures.block.entity.LockedChestBlockEntity;
import com.lostfeatures.block.entity.RunicLogicBlockEntity;
import net.minecraft.core.registries.Registries;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.capabilities.Capabilities;
import net.neoforged.neoforge.capabilities.RegisterCapabilitiesEvent;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModBlockEntities {
    public static final DeferredRegister<BlockEntityType<?>> BLOCK_ENTITIES =
            DeferredRegister.create(Registries.BLOCK_ENTITY_TYPE, LostFeatures.MOD_ID);

    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<AncientEventSensorBlockEntity>> EVENT_SENSOR =
            BLOCK_ENTITIES.register("ancient_event_sensor", () -> new BlockEntityType<>(AncientEventSensorBlockEntity::new,
                    ModBlocks.ANCIENT_EVENT_SENSOR.get()));
    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<AncientEnergyReactorBlockEntity>> ENERGY_REACTOR =
            BLOCK_ENTITIES.register("ancient_energy_reactor", () -> new BlockEntityType<>(AncientEnergyReactorBlockEntity::new,
                    ModBlocks.ANCIENT_ENERGY_REACTOR.get()));
    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<RunicLogicBlockEntity>> RUNIC_LOGIC =
            BLOCK_ENTITIES.register("runic_logic_device", () -> new BlockEntityType<>(RunicLogicBlockEntity::new,
                    ModBlocks.RUNIC_LOGIC_DEVICE.get()));
    public static final DeferredHolder<BlockEntityType<?>, BlockEntityType<LockedChestBlockEntity>> LOCKED_CHEST =
            BLOCK_ENTITIES.register("locked_chest", () -> new BlockEntityType<>(LockedChestBlockEntity::new,
                    ModBlocks.LOCKED_CHEST.get()));

    private ModBlockEntities() {
    }

    public static void registerCapabilities(RegisterCapabilitiesEvent event) {
        // Hoppers can feed reactor fuel; this is the reactor's own inventory, vanilla hoppers are untouched.
        event.registerBlockEntity(Capabilities.Item.BLOCK, ENERGY_REACTOR.get(), (be, side) -> be.inventory);
    }

    public static void register(IEventBus bus) {
        BLOCK_ENTITIES.register(bus);
    }
}
