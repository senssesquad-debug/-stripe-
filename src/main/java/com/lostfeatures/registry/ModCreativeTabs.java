package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.item.CopperHornItem;
import net.minecraft.core.registries.Registries;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.CreativeModeTab;
import net.minecraft.world.item.ItemStack;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

/**
 * One dedicated "Lost Features" tab. Vanilla creative tabs only display their own content in groups,
 * so ours is ordered in the documented categories: mobs and spawn eggs, building blocks, functional
 * blocks, redstone devices, materials, equipment, music discs and decorative items.
 */
public final class ModCreativeTabs {
    public static final DeferredRegister<CreativeModeTab> TABS = DeferredRegister.create(Registries.CREATIVE_MODE_TAB, LostFeatures.MOD_ID);

    public static final DeferredHolder<CreativeModeTab, CreativeModeTab> MAIN = TABS.register("main", () -> CreativeModeTab.builder()
            .title(Component.translatable("itemGroup.lostfeatures"))
            .icon(() -> new ItemStack(ModItems.RUBY.get()))
            .displayItems((params, out) -> {
                // Mobs and spawn eggs
                out.accept(ModItems.RED_DRAGON_SPAWN_EGG.get());
                out.accept(ModItems.GIANT_SPAWN_EGG.get());
                out.accept(ModItems.ILLUSIONER_SPAWN_EGG.get());
                out.accept(ModItems.KILLER_BUNNY_SPAWN_EGG.get());
                // Building blocks
                out.accept(ModItems.RUBY_ORE_ITEM.get());
                out.accept(ModItems.DEEPSLATE_RUBY_ORE_ITEM.get());
                out.accept(ModItems.RUBY_BLOCK_ITEM.get());
                out.accept(ModItems.RUBY_BRICKS_ITEM.get());
                out.accept(ModItems.ANCIENT_STONE_ITEM.get());
                out.accept(ModItems.ANCIENT_STONE_BRICKS_ITEM.get());
                out.accept(ModItems.CRACKED_ANCIENT_STONE_BRICKS_ITEM.get());
                out.accept(ModItems.ANCIENT_GLYPH_BRICKS_ITEM.get());
                out.accept(ModItems.ANCIENT_BONE_BLOCK_ITEM.get());
                out.accept(ModItems.ILLUSORY_WALL_ITEM.get());
                // Functional blocks
                out.accept(ModItems.LOCKED_CHEST_ITEM.get());
                out.accept(ModItems.ANCIENT_ALTAR_ITEM.get());
                // Redstone devices
                out.accept(ModItems.ANCIENT_EVENT_SENSOR_ITEM.get());
                out.accept(ModItems.ANCIENT_ENERGY_REACTOR_ITEM.get());
                out.accept(ModItems.RUNIC_LOGIC_DEVICE_ITEM.get());
                out.accept(ModItems.ANCIENT_SECRET_DOOR_ITEM.get());
                out.accept(ModItems.DART_TRAP_ITEM.get());
                out.accept(ModItems.SPIKE_TRAP_ITEM.get());
                // Materials
                out.accept(ModItems.RUBY.get());
                out.accept(ModItems.ANCIENT_CIRCUIT.get());
                out.accept(ModItems.ANCIENT_KEY.get());
                out.accept(ModItems.ANCIENT_SMITHING_TEMPLATE.get());
                out.accept(ModItems.DRAGON_SCALE.get());
                out.accept(ModItems.DRAGON_FANG.get());
                out.accept(ModItems.DRAGON_HEART.get());
                out.accept(ModItems.WING_MEMBRANE.get());
                out.accept(ModItems.ANCIENT_BONE.get());
                out.accept(ModItems.STRENGTH_SHARD.get());
                out.accept(ModItems.ILLUSION_DUST.get());
                out.accept(ModItems.LENS_FRAGMENT.get());
                out.accept(ModItems.ENCRYPTED_NOTES.get());
                out.accept(ModItems.DECODED_NOTES.get());
                out.accept(ModItems.VORPAL_FANG.get());
                out.accept(ModItems.DRACONIC_SIGIL.get());
                out.accept(ModItems.CURSED_RABBIT.get());
                out.accept(ModItems.COOKED_CURSED_RABBIT.get());
                // Equipment
                out.accept(ModItems.ANCIENT_JOURNAL.get());
                out.accept(ModItems.QUIVER.get());
                for (int tune = 0; tune < CopperHornItem.TUNES; tune++) {
                    out.accept(CopperHornItem.withTune(ModItems.COPPER_HORN.get(), tune));
                }
                out.accept(ModItems.STUDDED_HELMET.get());
                out.accept(ModItems.STUDDED_CHESTPLATE.get());
                out.accept(ModItems.STUDDED_LEGGINGS.get());
                out.accept(ModItems.STUDDED_BOOTS.get());
                out.accept(ModItems.DRAGONSCALE_CHESTPLATE.get());
                out.accept(ModItems.FANG_BLADE.get());
                out.accept(ModItems.EDGE_COMPASS.get());
                // Music discs
                ModItems.discs().forEach(d -> out.accept(d.get()));
                // Decorative items and trophies
                out.accept(ModItems.ROSE_ITEM.get());
                out.accept(ModItems.CYAN_ROSE_ITEM.get());
                out.accept(ModItems.SCORCHED_GRASS_ITEM.get());
                out.accept(ModItems.CHARRED_REMAINS_ITEM.get());
                out.accept(ModItems.GIANT_TROPHY.get());
                out.accept(ModItems.KILLER_BUNNY_TROPHY.get());
            })
            .build());

    private ModCreativeTabs() {
    }

    public static void register(IEventBus bus) {
        TABS.register(bus);
    }
}
