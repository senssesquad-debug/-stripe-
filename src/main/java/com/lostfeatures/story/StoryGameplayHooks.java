package com.lostfeatures.story;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.world.memory.EventMemory;
import com.lostfeatures.world.structure.ModStructures;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.ItemStack;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.entity.player.ItemEntityPickupEvent;
import net.neoforged.neoforge.event.entity.player.PlayerEvent;
import net.neoforged.neoforge.event.tick.PlayerTickEvent;

/** Observes ordinary gameplay (pickups, crafting, exploring) to advance the optional story. */
@EventBusSubscriber(modid = LostFeatures.MOD_ID)
public final class StoryGameplayHooks {
    private static final int DISCOVERY_CHECK_INTERVAL = 40;

    private StoryGameplayHooks() {
    }

    @SubscribeEvent
    public static void onPickup(ItemEntityPickupEvent.Post event) {
        if (event.getPlayer() instanceof ServerPlayer player) {
            StoryEvents.onItemObtained(player, event.getOriginalStack());
        }
    }

    @SubscribeEvent
    public static void onCrafted(PlayerEvent.ItemCraftedEvent event) {
        if (event.getEntity() instanceof ServerPlayer player) {
            ItemStack crafted = event.getCrafting();
            StoryEvents.onItemObtained(player, crafted);
            if (crafted.is(ModItems.ANCIENT_EVENT_SENSOR_ITEM.get()) || crafted.is(ModItems.RUNIC_LOGIC_DEVICE_ITEM.get())
                    || crafted.is(ModItems.ANCIENT_ENERGY_REACTOR_ITEM.get())) {
                StoryEvents.unlock(player, Milestone.MECHANISM_BUILT);
            }
        }
    }

    /** Every two seconds, checks whether the player stands inside a Lost Features structure. */
    @SubscribeEvent
    public static void onPlayerTick(PlayerTickEvent.Post event) {
        if (!(event.getEntity() instanceof ServerPlayer player) || player.tickCount % DISCOVERY_CHECK_INTERVAL != 0) {
            return;
        }
        ServerLevel level = player.level();
        if (StoryProgress.get(level.getServer()).has(player.getUUID(), Milestone.ANCIENT_SITE)) {
            return;
        }
        if (level.structureManager().getStructureWithPieceAt(player.blockPosition(), ModStructures.ANCIENT_SITES).isValid()) {
            EventMemory.get(level).record(EventMemory.Type.STRUCTURE_DISCOVERY, player.blockPosition(), "ancient_site");
            StoryEvents.onStructureDiscovered(player);
        }
    }
}
