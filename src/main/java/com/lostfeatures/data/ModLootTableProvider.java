package com.lostfeatures.data;

import com.lostfeatures.entity.RedDragon;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModEntities;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.world.structure.ModStructures;
import net.minecraft.core.HolderLookup;
import net.minecraft.data.PackOutput;
import net.minecraft.data.loot.BlockLootSubProvider;
import net.minecraft.data.loot.EntityLootSubProvider;
import net.minecraft.data.loot.LootTableProvider;
import net.minecraft.data.loot.LootTableSubProvider;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.flag.FeatureFlags;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.ItemLike;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.storage.loot.LootPool;
import net.minecraft.world.level.storage.loot.LootTable;
import net.minecraft.world.level.storage.loot.entries.EmptyLootItem;
import net.minecraft.world.level.storage.loot.entries.LootItem;
import net.minecraft.world.level.storage.loot.functions.EnchantedCountIncreaseFunction;
import net.minecraft.world.level.storage.loot.functions.SetItemCountFunction;
import net.minecraft.world.level.storage.loot.parameters.LootContextParamSets;
import net.minecraft.world.level.storage.loot.predicates.LootItemKilledByPlayerCondition;
import net.minecraft.world.level.storage.loot.predicates.LootItemRandomChanceCondition;
import net.minecraft.world.level.storage.loot.predicates.LootItemRandomChanceWithEnchantedBonusCondition;
import net.minecraft.world.level.storage.loot.providers.number.ConstantValue;
import net.minecraft.world.level.storage.loot.providers.number.UniformGenerator;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.function.BiConsumer;
import java.util.stream.Stream;

/**
 * Block, entity and chest loot. Only {@code lostfeatures:} tables are produced; vanilla loot tables
 * are never touched (custom creatures use their own entity-type tables).
 */
public final class ModLootTableProvider extends LootTableProvider {
    public ModLootTableProvider(PackOutput output, CompletableFuture<HolderLookup.Provider> lookup) {
        super(output, Set.of(), List.of(
                new SubProviderEntry(Blocks::new, LootContextParamSets.BLOCK),
                new SubProviderEntry(Entities::new, LootContextParamSets.ENTITY),
                new SubProviderEntry(Chests::new, LootContextParamSets.CHEST)
        ), lookup);
    }

    // ------------------------------------------------------------------------------- blocks

    private static final class Blocks extends BlockLootSubProvider {
        Blocks(HolderLookup.Provider registries) {
            super(Set.of(), FeatureFlags.DEFAULT_FLAGS, registries);
        }

        @Override
        protected void generate() {
            add(ModBlocks.RUBY_ORE.get(), createOreDrop(ModBlocks.RUBY_ORE.get(), ModItems.RUBY.get()));
            add(ModBlocks.DEEPSLATE_RUBY_ORE.get(), createOreDrop(ModBlocks.DEEPSLATE_RUBY_ORE.get(), ModItems.RUBY.get()));
            for (Block b : new Block[]{ModBlocks.RUBY_BLOCK.get(), ModBlocks.RUBY_BRICKS.get(), ModBlocks.ANCIENT_STONE.get(),
                    ModBlocks.ANCIENT_STONE_BRICKS.get(), ModBlocks.CRACKED_ANCIENT_STONE_BRICKS.get(), ModBlocks.ANCIENT_GLYPH_BRICKS.get(),
                    ModBlocks.ANCIENT_BONE_BLOCK.get(), ModBlocks.ILLUSORY_WALL.get(), ModBlocks.ROSE.get(), ModBlocks.CYAN_ROSE.get(),
                    ModBlocks.ANCIENT_EVENT_SENSOR.get(), ModBlocks.ANCIENT_ENERGY_REACTOR.get(), ModBlocks.RUNIC_LOGIC_DEVICE.get(),
                    ModBlocks.ANCIENT_SECRET_DOOR.get(), ModBlocks.DART_TRAP.get(), ModBlocks.SPIKE_TRAP.get(), ModBlocks.ANCIENT_ALTAR.get()}) {
                dropSelf(b);
            }
            add(ModBlocks.SCORCHED_GRASS.get(), createSingleItemTableWithSilkTouch(ModBlocks.SCORCHED_GRASS.get(), Items.DIRT));
            add(ModBlocks.CHARRED_REMAINS.get(), LootTable.lootTable().withPool(LootPool.lootPool().setRolls(ConstantValue.exactly(1))
                    .add(LootItem.lootTableItem(Items.BONE_MEAL).apply(SetItemCountFunction.setCount(UniformGenerator.between(1, 2))))));
        }

        @Override
        protected Iterable<Block> getKnownBlocks() {
            // The Locked Chest is unbreakable in survival and has no loot table of its own.
            return ModBlocks.BLOCKS.getEntries().stream().map(h -> (Block) h.value())
                    .filter(b -> b != ModBlocks.LOCKED_CHEST.get()).toList();
        }
    }

    // ------------------------------------------------------------------------------- entities

    private static final class Entities extends EntityLootSubProvider {
        Entities(HolderLookup.Provider registries) {
            super(FeatureFlags.DEFAULT_FLAGS, registries);
        }

        private LootItem.Builder<?> counted(ItemLike item, float min, float max, float lootingBonus) {
            LootItem.Builder<?> b = LootItem.lootTableItem(item).apply(SetItemCountFunction.setCount(UniformGenerator.between(min, max)));
            if (lootingBonus > 0) {
                b.apply(EnchantedCountIncreaseFunction.lootingMultiplier(registries, UniformGenerator.between(0, lootingBonus)));
            }
            return b;
        }

        private LootPool.Builder playerOnly(ItemLike item, float chance, float lootingBonus) {
            return LootPool.lootPool().setRolls(ConstantValue.exactly(1)).add(LootItem.lootTableItem(item))
                    .when(LootItemKilledByPlayerCondition.killedByPlayer())
                    .when(LootItemRandomChanceWithEnchantedBonusCondition.randomChanceAndLootingBoost(registries, chance, lootingBonus));
        }

        @Override
        public void generate() {
            // Red Dragon: scales and fang always useful; heart and membranes reward a real victory.
            add(ModEntities.RED_DRAGON.get(), LootTable.lootTable()
                    .withPool(LootPool.lootPool().add(counted(ModItems.DRAGON_SCALE.get(), 2, 4, 1)))
                    .withPool(LootPool.lootPool().add(counted(ModItems.DRAGON_FANG.get(), 1, 1, 1)))
                    .withPool(LootPool.lootPool().add(counted(ModItems.WING_MEMBRANE.get(), 2, 2, 0))
                            .when(LootItemKilledByPlayerCondition.killedByPlayer()))
                    .withPool(playerOnly(ModItems.DRAGON_HEART.get(), 1.0F, 0.0F)));
            add(ModEntities.RED_DRAGON.get(), RedDragon.ANCESTRAL_LOOT, LootTable.lootTable()
                    .withPool(LootPool.lootPool().add(counted(ModItems.DRAGON_SCALE.get(), 6, 10, 2)))
                    .withPool(LootPool.lootPool().add(counted(ModItems.DRAGON_FANG.get(), 2, 2, 0)))
                    .withPool(LootPool.lootPool().add(counted(ModItems.WING_MEMBRANE.get(), 3, 3, 0)))
                    .withPool(LootPool.lootPool().add(counted(ModItems.DRAGON_HEART.get(), 2, 2, 0)))
                    .withPool(LootPool.lootPool().add(LootItem.lootTableItem(ModItems.DISC_DRAGONS_OMEN.get()))));
            // Giant
            add(ModEntities.GIANT.get(), LootTable.lootTable()
                    .withPool(LootPool.lootPool().add(counted(ModItems.ANCIENT_BONE.get(), 2, 5, 1)))
                    .withPool(LootPool.lootPool().add(counted(Items.ROTTEN_FLESH, 3, 6, 1)))
                    .withPool(playerOnly(ModItems.STRENGTH_SHARD.get(), 1.0F, 0.0F))
                    .withPool(playerOnly(ModItems.GIANT_TROPHY.get(), 0.15F, 0.03F)));
            // Illusioner
            add(ModEntities.ILLUSIONER.get(), LootTable.lootTable()
                    .withPool(LootPool.lootPool().add(counted(ModItems.ILLUSION_DUST.get(), 1, 3, 1)))
                    .withPool(playerOnly(ModItems.LENS_FRAGMENT.get(), 0.35F, 0.1F))
                    .withPool(playerOnly(ModItems.ENCRYPTED_NOTES.get(), 0.2F, 0.05F)));
            // Killer Bunny
            add(ModEntities.KILLER_BUNNY.get(), LootTable.lootTable()
                    .withPool(LootPool.lootPool().add(counted(ModItems.CURSED_RABBIT.get(), 1, 1, 1)))
                    .withPool(LootPool.lootPool().add(counted(Items.RABBIT_HIDE, 0, 1, 1)))
                    .withPool(playerOnly(ModItems.VORPAL_FANG.get(), 0.4F, 0.1F))
                    .withPool(playerOnly(ModItems.KILLER_BUNNY_TROPHY.get(), 0.05F, 0.02F)));
        }

        @Override
        protected Stream<EntityType<?>> getKnownEntityTypes() {
            return ModEntities.ENTITIES.getEntries().stream().map(h -> h.value());
        }
    }

    // ------------------------------------------------------------------------------- chests

    private record Chests(HolderLookup.Provider registries) implements LootTableSubProvider {
        private static LootPool.Builder pool(int minRolls, int maxRolls) {
            return LootPool.lootPool().setRolls(UniformGenerator.between(minRolls, maxRolls));
        }

        private static LootItem.Builder<?> item(ItemLike item, int weight, float min, float max) {
            return LootItem.lootTableItem(item).setWeight(weight).apply(SetItemCountFunction.setCount(UniformGenerator.between(min, max)));
        }

        private static LootItem.Builder<?> item(ItemLike item, int weight) {
            return LootItem.lootTableItem(item).setWeight(weight);
        }

        private static LootPool.Builder chance(ItemLike item, float chance) {
            return LootPool.lootPool().setRolls(ConstantValue.exactly(1)).add(LootItem.lootTableItem(item))
                    .when(LootItemRandomChanceCondition.randomChance(chance));
        }

        private static LootPool.Builder oneOf(float chance, Item... items) {
            LootPool.Builder p = LootPool.lootPool().setRolls(ConstantValue.exactly(1)).when(LootItemRandomChanceCondition.randomChance(chance));
            for (Item i : items) {
                p.add(LootItem.lootTableItem(i));
            }
            return p;
        }

        @Override
        public void generate(BiConsumer<ResourceKey<LootTable>, LootTable.Builder> out) {
            out.accept(ModStructures.LOOT_STARTING_HOUSE, LootTable.lootTable()
                    .withPool(LootPool.lootPool().add(LootItem.lootTableItem(ModItems.ANCIENT_JOURNAL.get())))
                    .withPool(pool(3, 6).add(item(Items.BREAD, 10, 1, 3)).add(item(Items.APPLE, 10, 1, 3)).add(item(Items.TORCH, 10, 4, 12))
                            .add(item(Items.STONE_PICKAXE, 3)).add(item(Items.STONE_AXE, 3)).add(item(ModItems.ROSE_ITEM.get(), 6, 1, 2))
                            .add(item(Items.OAK_SAPLING, 6, 1, 3)))
                    .withPool(chance(ModItems.COPPER_HORN.get(), 0.2F))
                    .withPool(chance(ModItems.QUIVER.get(), 0.15F)));

            out.accept(ModStructures.LOOT_ANCIENT_RUINS, LootTable.lootTable()
                    .withPool(pool(3, 6).add(item(ModItems.RUBY.get(), 10, 1, 4)).add(item(ModItems.ANCIENT_CIRCUIT.get(), 6, 1, 2))
                            .add(item(ModItems.ILLUSION_DUST.get(), 4, 1, 3)).add(item(Items.GOLD_NUGGET, 8, 2, 8))
                            .add(item(ModItems.ANCIENT_BONE.get(), 6, 1, 3)).add(item(Items.BONE, 8, 1, 4)))
                    .withPool(chance(ModItems.ENCRYPTED_NOTES.get(), 0.25F))
                    .withPool(chance(ModItems.LENS_FRAGMENT.get(), 0.15F))
                    .withPool(chance(ModItems.ANCIENT_KEY.get(), 0.2F))
                    .withPool(oneOf(0.12F, ModItems.DISC_ANCIENT_ECHOES.get(), ModItems.DISC_FORGOTTEN_CIVILIZATION.get())));

            out.accept(ModStructures.LOOT_LOCKED_ANCIENT, LootTable.lootTable()
                    .withPool(pool(4, 7).add(item(ModItems.RUBY.get(), 10, 3, 8)).add(item(ModItems.ANCIENT_CIRCUIT.get(), 8, 2, 4))
                            .add(item(Items.DIAMOND, 3, 1, 2)).add(item(Items.GOLD_INGOT, 6, 2, 5)).add(item(ModItems.STUDDED_CHESTPLATE.get(), 2)))
                    .withPool(chance(ModItems.ANCIENT_SMITHING_TEMPLATE.get(), 0.35F))
                    .withPool(chance(ModItems.ENCRYPTED_NOTES.get(), 0.3F))
                    .withPool(chance(ModItems.LENS_FRAGMENT.get(), 0.25F))
                    .withPool(chance(ModItems.COPPER_HORN.get(), 0.15F))
                    .withPool(oneOf(0.18F, ModItems.DISC_ILLUSION.get(), ModItems.DISC_FAR_BEYOND.get())));

            out.accept(ModStructures.LOOT_BRICK_PYRAMID, LootTable.lootTable()
                    .withPool(pool(3, 5).add(item(ModItems.RUBY.get(), 10, 2, 5)).add(item(Items.GOLD_INGOT, 8, 1, 4))
                            .add(item(Items.BRICK, 8, 4, 12)).add(item(ModItems.STUDDED_HELMET.get(), 3)).add(item(ModItems.STUDDED_BOOTS.get(), 3)))
                    .withPool(chance(ModItems.ANCIENT_KEY.get(), 0.4F))
                    .withPool(chance(ModItems.ENCRYPTED_NOTES.get(), 0.3F))
                    .withPool(chance(ModItems.QUIVER.get(), 0.2F))
                    .withPool(chance(ModItems.DISC_ANCIENT_ECHOES.get(), 0.15F)));

            out.accept(ModStructures.LOOT_GLASS_PILLAR_LAB, LootTable.lootTable()
                    .withPool(pool(3, 6).add(item(ModItems.ANCIENT_CIRCUIT.get(), 8, 1, 3)).add(item(Items.REDSTONE, 10, 3, 9))
                            .add(item(ModItems.RUBY.get(), 8, 1, 4)).add(item(Items.GLASS, 6, 2, 6)).add(item(Items.OBSERVER, 3)))
                    .withPool(chance(ModItems.LENS_FRAGMENT.get(), 0.35F))
                    .withPool(chance(ModItems.ENCRYPTED_NOTES.get(), 0.35F))
                    .withPool(chance(ModItems.DISC_FAR_BEYOND.get(), 0.1F)));

            out.accept(ModStructures.LOOT_DRAGON_LAIR, LootTable.lootTable()
                    .withPool(pool(4, 8).add(item(Items.GOLD_INGOT, 10, 2, 7)).add(item(ModItems.RUBY.get(), 10, 3, 10))
                            .add(item(Items.DIAMOND, 4, 1, 3)).add(item(Items.GOLDEN_APPLE, 2)).add(item(Items.BONE, 6, 2, 6)))
                    .withPool(chance(ModItems.DRAGON_SCALE.get(), 0.4F))
                    .withPool(chance(ModItems.ANCIENT_SMITHING_TEMPLATE.get(), 0.5F))
                    .withPool(chance(ModItems.DISC_DRAGONS_OMEN.get(), 0.25F)));

            out.accept(ModStructures.LOOT_MONOLITH, LootTable.lootTable()
                    .withPool(pool(2, 5).add(item(ModItems.RUBY.get(), 10, 2, 6)).add(item(Items.COAL, 10, 3, 8)).add(item(Items.IRON_INGOT, 8, 1, 4))
                            .add(EmptyLootItem.emptyItem().setWeight(4)))
                    .withPool(chance(ModItems.ANCIENT_KEY.get(), 0.25F))
                    .withPool(chance(ModItems.DISC_THE_LAST_MONOLITH.get(), 0.08F)));
        }
    }
}
