package com.legacy.structure_gel.core.data.generators;

import com.legacy.structure_gel.api.data.tags.SGTags;
import com.legacy.structure_gel.core.registry.SGRegistry;
import java.util.concurrent.CompletableFuture;
import net.minecraft.core.HolderLookup.Provider;
import net.minecraft.core.component.DataComponentType;
import net.minecraft.core.component.DataComponents;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.data.PackOutput;
import net.minecraft.data.tags.TagsProvider;
import net.minecraft.data.tags.StructureTagsProvider;
import net.minecraft.data.tags.TagsProvider.TagLookup;
import net.minecraft.tags.BlockTags;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.block.Block;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.levelgen.structure.BuiltinStructures;
import net.neoforged.neoforge.common.data.BlockTagCopyingItemTagProvider;
import net.neoforged.neoforge.common.data.BlockTagsProvider;

public class SGTagProv {
    // 26.2: tag appenders only accept registry keys
    private static ResourceKey<Block> key(Block block) {
        return BuiltInRegistries.BLOCK.getResourceKey(block).orElseThrow();
    }

    private static ResourceKey<Item> key(Item item) {
        return BuiltInRegistries.ITEM.getResourceKey(item).orElseThrow();
    }

    private static ResourceKey<DataComponentType<?>> key(DataComponentType<?> type) {
        return BuiltInRegistries.DATA_COMPONENT_TYPE.getResourceKey(type).orElseThrow();
    }

    public static class BlockTagProv extends BlockTagsProvider {
        public BlockTagProv(PackOutput output, CompletableFuture<Provider> lookupProvider) {
            super(output, lookupProvider, "structure_gel");
        }

        @Override
        protected void addTags(Provider prov) {
            this.tag(SGTags.BlockTags.GEL)
                .add(
                    key(SGRegistry.Blocks.RED_GEL.get()),
                    key(SGRegistry.Blocks.BLUE_GEL.get()),
                    key(SGRegistry.Blocks.GREEN_GEL.get()),
                    key(SGRegistry.Blocks.CYAN_GEL.get()),
                    key(SGRegistry.Blocks.ORANGE_GEL.get()),
                    key(SGRegistry.Blocks.YELLOW_GEL.get())
                );
            this.tag(SGTags.BlockTags.PORTALS_CAN_REPLACE).addTags(BlockTags.LOGS, BlockTags.LEAVES, BlockTags.REPLACEABLE_BY_MUSHROOMS);
            this.tag(BlockTags.DRAGON_IMMUNE).add(key(SGRegistry.Blocks.DATA_HANDLER.get()), key(SGRegistry.Blocks.LOOT_SAMPLER.get()));
            this.tag(BlockTags.WITHER_IMMUNE).add(key(SGRegistry.Blocks.DATA_HANDLER.get()), key(SGRegistry.Blocks.LOOT_SAMPLER.get()));
        }
    }

    public static class DataComponentTagProv extends TagsProvider<DataComponentType<?>> {
        public DataComponentTagProv(PackOutput output, CompletableFuture<Provider> lookupProvider) {
            super(output, Registries.DATA_COMPONENT_TYPE, lookupProvider, "structure_gel");
        }

        @Override
        protected void addTags(Provider prov) {
            this.tag(SGTags.DataComponentTags.LOOT_SAMPLER_IGNORED)
                .add(
                    key(DataComponents.ENCHANTMENTS),
                    key(DataComponents.STORED_ENCHANTMENTS),
                    key(DataComponents.DAMAGE),
                    key(DataComponents.CONTAINER),
                    key(DataComponents.BUNDLE_CONTENTS),
                    key(DataComponents.WRITABLE_BOOK_CONTENT),
                    key(DataComponents.WRITTEN_BOOK_CONTENT),
                    key(DataComponents.FIREWORK_EXPLOSION),
                    key(DataComponents.FIREWORKS),
                    key(DataComponents.BEES)
                );
        }
    }

    public static class ItemTagProv extends BlockTagCopyingItemTagProvider {
        public ItemTagProv(PackOutput output, CompletableFuture<Provider> lookupProvider, CompletableFuture<TagLookup<Block>> blockTags) {
            super(output, lookupProvider, blockTags, "structure_gel");
        }

        @Override
        protected void addTags(Provider provider) {
            this.copy(SGTags.BlockTags.GEL, SGTags.ItemTags.GEL);
            this.tag(SGTags.ItemTags.GEL_INTERACTABLE).add(key(Items.DEBUG_STICK), key(Items.GUNPOWDER)).addTag(SGTags.ItemTags.GEL);
        }
    }

    public static class StructureTagProv extends StructureTagsProvider {
        public StructureTagProv(PackOutput output, CompletableFuture<Provider> lookupProvider) {
            super(output, lookupProvider, "structure_gel");
        }

        @Override
        protected void addTags(Provider prov) {
            this.tag(SGTags.StructureTags.LAKE_PROOF)
                .add(
                    BuiltinStructures.PILLAGER_OUTPOST,
                    BuiltinStructures.WOODLAND_MANSION,
                    BuiltinStructures.JUNGLE_TEMPLE,
                    BuiltinStructures.DESERT_PYRAMID,
                    BuiltinStructures.IGLOO,
                    BuiltinStructures.STRONGHOLD
                );
        }
    }
}
