package com.lostfeatures.data;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.registry.ModItems;
import net.minecraft.core.HolderLookup;
import net.minecraft.core.registries.Registries;
import net.minecraft.data.PackOutput;
import net.minecraft.data.recipes.RecipeCategory;
import net.minecraft.data.recipes.RecipeOutput;
import net.minecraft.data.recipes.RecipeProvider;
import net.minecraft.data.recipes.SimpleCookingRecipeBuilder;
import net.minecraft.data.recipes.SingleItemRecipeBuilder;
import net.minecraft.data.recipes.SmithingTransformRecipeBuilder;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.crafting.CookingBookCategory;
import net.minecraft.world.item.crafting.Ingredient;
import net.minecraft.world.item.crafting.Recipe;
import net.minecraft.world.level.ItemLike;

import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * Every Lost Features recipe. All IDs live in the {@code lostfeatures} namespace, so no vanilla recipe
 * is replaced; docs/RECIPES.md documents each one (layout, unlock, progression stage, rationale).
 */
public final class ModRecipeProvider extends RecipeProvider.Runner {
    public ModRecipeProvider(PackOutput output, CompletableFuture<HolderLookup.Provider> lookupProvider) {
        super(output, lookupProvider);
    }

    @Override
    protected RecipeProvider createRecipeProvider(HolderLookup.Provider registries, RecipeOutput output) {
        return new Provider(registries, output);
    }

    @Override
    public String getName() {
        return "Lost Features Recipes";
    }

    private static final class Provider extends RecipeProvider {
        private Provider(HolderLookup.Provider registries, RecipeOutput output) {
            super(registries, output);
        }

        private static ResourceKey<Recipe<?>> id(String path) {
            return ResourceKey.create(Registries.RECIPE, LostFeatures.id(path));
        }

        private Ingredient of(ItemLike item) {
            return Ingredient.of(item);
        }

        @Override
        protected void buildRecipes() {
            // ------------------------------------------------------------ Ruby resource system
            shaped(RecipeCategory.BUILDING_BLOCKS, ModItems.RUBY_BLOCK_ITEM.get())
                    .pattern("RRR").pattern("RRR").pattern("RRR").define('R', ModItems.RUBY.get())
                    .unlockedBy("has_ruby", has(ModItems.RUBY.get())).save(output, id("ruby_block"));
            shapeless(RecipeCategory.MISC, ModItems.RUBY.get(), 9).requires(ModItems.RUBY_BLOCK_ITEM.get())
                    .unlockedBy("has_ruby_block", has(ModItems.RUBY_BLOCK_ITEM.get())).save(output, id("ruby_from_ruby_block"));
            List<ItemLike> rubyOres = List.of(ModItems.RUBY_ORE_ITEM.get(), ModItems.DEEPSLATE_RUBY_ORE_ITEM.get());
            for (ItemLike ore : rubyOres) {
                String name = getItemName(ore);
                SimpleCookingRecipeBuilder.smelting(of(ore), RecipeCategory.MISC, CookingBookCategory.MISC, ModItems.RUBY.get(), 1.0F, 200)
                        .unlockedBy("has_" + name, has(ore)).save(output, id("ruby_from_smelting_" + name));
                SimpleCookingRecipeBuilder.blasting(of(ore), RecipeCategory.MISC, CookingBookCategory.MISC, ModItems.RUBY.get(), 1.0F, 100)
                        .unlockedBy("has_" + name, has(ore)).save(output, id("ruby_from_blasting_" + name));
            }
            shaped(RecipeCategory.BUILDING_BLOCKS, ModItems.RUBY_BRICKS_ITEM.get(), 8)
                    .pattern("SSS").pattern("SRS").pattern("SSS").define('S', Items.STONE_BRICKS).define('R', ModItems.RUBY.get())
                    .unlockedBy("has_ruby", has(ModItems.RUBY.get())).save(output, id("ruby_bricks"));
            SingleItemRecipeBuilder.stonecutting(of(ModItems.RUBY_BLOCK_ITEM.get()), RecipeCategory.BUILDING_BLOCKS, ModItems.RUBY_BRICKS_ITEM.get(), 4)
                    .unlockedBy("has_ruby_block", has(ModItems.RUBY_BLOCK_ITEM.get())).save(output, id("ruby_bricks_from_ruby_block_stonecutting"));

            // ------------------------------------------------------------ Ancient masonry
            shaped(RecipeCategory.BUILDING_BLOCKS, ModItems.ANCIENT_STONE_ITEM.get(), 8)
                    .pattern("SSS").pattern("SRS").pattern("SSS").define('S', Items.STONE).define('R', ModItems.RUBY.get())
                    .unlockedBy("has_ruby", has(ModItems.RUBY.get())).save(output, id("ancient_stone"));
            shaped(RecipeCategory.BUILDING_BLOCKS, ModItems.ANCIENT_STONE_BRICKS_ITEM.get(), 4)
                    .pattern("SS").pattern("SS").define('S', ModItems.ANCIENT_STONE_ITEM.get())
                    .unlockedBy("has_ancient_stone", has(ModItems.ANCIENT_STONE_ITEM.get())).save(output, id("ancient_stone_bricks"));
            SingleItemRecipeBuilder.stonecutting(of(ModItems.ANCIENT_STONE_ITEM.get()), RecipeCategory.BUILDING_BLOCKS, ModItems.ANCIENT_STONE_BRICKS_ITEM.get(), 1)
                    .unlockedBy("has_ancient_stone", has(ModItems.ANCIENT_STONE_ITEM.get())).save(output, id("ancient_stone_bricks_stonecutting"));
            SimpleCookingRecipeBuilder.smelting(of(ModItems.ANCIENT_STONE_BRICKS_ITEM.get()), RecipeCategory.BUILDING_BLOCKS, CookingBookCategory.BLOCKS,
                            ModItems.CRACKED_ANCIENT_STONE_BRICKS_ITEM.get(), 0.1F, 200)
                    .unlockedBy("has_ancient_stone_bricks", has(ModItems.ANCIENT_STONE_BRICKS_ITEM.get())).save(output, id("cracked_ancient_stone_bricks"));
            shapeless(RecipeCategory.BUILDING_BLOCKS, ModItems.ANCIENT_GLYPH_BRICKS_ITEM.get())
                    .requires(ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).requires(Items.GLOW_INK_SAC)
                    .unlockedBy("has_ancient_stone_bricks", has(ModItems.ANCIENT_STONE_BRICKS_ITEM.get())).save(output, id("ancient_glyph_bricks"));
            shaped(RecipeCategory.BUILDING_BLOCKS, ModItems.ANCIENT_BONE_BLOCK_ITEM.get())
                    .pattern("BBB").pattern("BBB").pattern("BBB").define('B', ModItems.ANCIENT_BONE.get())
                    .unlockedBy("has_ancient_bone", has(ModItems.ANCIENT_BONE.get())).save(output, id("ancient_bone_block"));
            shapeless(RecipeCategory.MISC, ModItems.ANCIENT_BONE.get(), 9).requires(ModItems.ANCIENT_BONE_BLOCK_ITEM.get())
                    .unlockedBy("has_ancient_bone_block", has(ModItems.ANCIENT_BONE_BLOCK_ITEM.get())).save(output, id("ancient_bone_from_block"));
            shapeless(RecipeCategory.MISC, Items.BONE_MEAL, 6).requires(ModItems.ANCIENT_BONE.get())
                    .unlockedBy("has_ancient_bone", has(ModItems.ANCIENT_BONE.get())).save(output, id("bone_meal_from_ancient_bone"));
            shaped(RecipeCategory.BUILDING_BLOCKS, ModItems.ILLUSORY_WALL_ITEM.get(), 4)
                    .pattern(" B ").pattern("BDB").pattern(" B ")
                    .define('B', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('D', ModItems.ILLUSION_DUST.get())
                    .unlockedBy("has_illusion_dust", has(ModItems.ILLUSION_DUST.get())).save(output, id("illusory_wall"));

            // ------------------------------------------------------------ Flowers
            shapeless(RecipeCategory.MISC, Items.DYE.red()).requires(ModItems.ROSE_ITEM.get())
                    .unlockedBy("has_rose", has(ModItems.ROSE_ITEM.get())).save(output, id("red_dye_from_rose"));
            shapeless(RecipeCategory.MISC, Items.DYE.cyan()).requires(ModItems.CYAN_ROSE_ITEM.get())
                    .unlockedBy("has_cyan_rose", has(ModItems.CYAN_ROSE_ITEM.get())).save(output, id("cyan_dye_from_cyan_rose"));

            // ------------------------------------------------------------ Components and keys
            shaped(RecipeCategory.REDSTONE, ModItems.ANCIENT_CIRCUIT.get(), 2)
                    .pattern("CDC").pattern("DRD").pattern("CDC")
                    .define('C', Items.COPPER_INGOT).define('D', Items.REDSTONE).define('R', ModItems.RUBY.get())
                    .unlockedBy("has_ruby", has(ModItems.RUBY.get())).save(output, id("ancient_circuit"));
            shaped(RecipeCategory.MISC, ModItems.ANCIENT_KEY.get())
                    .pattern(" R ").pattern(" G ").pattern(" G ")
                    .define('R', ModItems.RUBY.get()).define('G', Items.GOLD_INGOT)
                    .unlockedBy("has_ruby", has(ModItems.RUBY.get())).save(output, id("ancient_key"));
            shapeless(RecipeCategory.MISC, ModItems.ANCIENT_JOURNAL.get()).requires(Items.BOOK).requires(ModItems.RUBY.get())
                    .unlockedBy("has_ruby", has(ModItems.RUBY.get())).save(output, id("ancient_journal"));
            shapeless(RecipeCategory.MISC, ModItems.DECODED_NOTES.get()).requires(ModItems.ENCRYPTED_NOTES.get()).requires(ModItems.LENS_FRAGMENT.get())
                    .unlockedBy("has_encrypted_notes", has(ModItems.ENCRYPTED_NOTES.get())).save(output, id("decoded_notes"));
            shaped(RecipeCategory.MISC, ModItems.ANCIENT_SMITHING_TEMPLATE.get(), 2)
                    .pattern("RTR").pattern("RSR").pattern("RRR")
                    .define('R', ModItems.RUBY.get()).define('T', ModItems.ANCIENT_SMITHING_TEMPLATE.get()).define('S', ModItems.ANCIENT_STONE_ITEM.get())
                    .unlockedBy("has_template", has(ModItems.ANCIENT_SMITHING_TEMPLATE.get())).save(output, id("ancient_smithing_template_duplication"));
            shaped(RecipeCategory.MISC, ModItems.DRACONIC_SIGIL.get())
                    .pattern("DSD").pattern("WRW").pattern("AJA")
                    .define('D', ModItems.ILLUSION_DUST.get()).define('S', ModItems.STRENGTH_SHARD.get())
                    .define('W', ModItems.WING_MEMBRANE.get()).define('R', ModItems.RUBY_BLOCK_ITEM.get())
                    .define('A', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('J', ModItems.DECODED_NOTES.get())
                    .unlockedBy("has_decoded_notes", has(ModItems.DECODED_NOTES.get())).save(output, id("draconic_sigil"));

            // ------------------------------------------------------------ Equipment
            shaped(RecipeCategory.COMBAT, ModItems.QUIVER.get())
                    .pattern("S L").pattern("L L").pattern("LLL").define('S', Items.STRING).define('L', Items.LEATHER)
                    .unlockedBy("has_leather", has(Items.LEATHER)).save(output, id("quiver"));
            shaped(RecipeCategory.MISC, ModItems.COPPER_HORN.get())
                    .pattern("CHC").pattern(" C ").define('C', Items.COPPER_INGOT).define('H', Items.GOAT_HORN)
                    .unlockedBy("has_goat_horn", has(Items.GOAT_HORN)).save(output, id("copper_horn"));
            shaped(RecipeCategory.COMBAT, ModItems.STUDDED_HELMET.get())
                    .pattern("NLN").pattern("L L").define('N', Items.IRON_NUGGET).define('L', Items.LEATHER)
                    .unlockedBy("has_leather", has(Items.LEATHER)).save(output, id("studded_helmet"));
            shaped(RecipeCategory.COMBAT, ModItems.STUDDED_CHESTPLATE.get())
                    .pattern("L L").pattern("NLN").pattern("LNL").define('N', Items.IRON_NUGGET).define('L', Items.LEATHER)
                    .unlockedBy("has_leather", has(Items.LEATHER)).save(output, id("studded_chestplate"));
            shaped(RecipeCategory.COMBAT, ModItems.STUDDED_LEGGINGS.get())
                    .pattern("NLN").pattern("L L").pattern("L L").define('N', Items.IRON_NUGGET).define('L', Items.LEATHER)
                    .unlockedBy("has_leather", has(Items.LEATHER)).save(output, id("studded_leggings"));
            shaped(RecipeCategory.COMBAT, ModItems.STUDDED_BOOTS.get())
                    .pattern("N N").pattern("L L").define('N', Items.IRON_NUGGET).define('L', Items.LEATHER)
                    .unlockedBy("has_leather", has(Items.LEATHER)).save(output, id("studded_boots"));
            SmithingTransformRecipeBuilder.smithing(of(ModItems.ANCIENT_SMITHING_TEMPLATE.get()), of(Items.IRON_CHESTPLATE),
                            of(ModItems.DRAGON_SCALE.get()), RecipeCategory.COMBAT, ModItems.DRAGONSCALE_CHESTPLATE.get())
                    .unlocks("has_dragon_scale", has(ModItems.DRAGON_SCALE.get())).save(output, id("dragonscale_chestplate_smithing"));
            shaped(RecipeCategory.COMBAT, ModItems.FANG_BLADE.get())
                    .pattern("F").pattern("R").pattern("S")
                    .define('F', ModItems.DRAGON_FANG.get()).define('R', ModItems.RUBY.get()).define('S', Items.STICK)
                    .unlockedBy("has_dragon_fang", has(ModItems.DRAGON_FANG.get())).save(output, id("fang_blade"));
            shaped(RecipeCategory.TOOLS, ModItems.EDGE_COMPASS.get())
                    .pattern("ORO").pattern("RCR").pattern("OLO")
                    .define('O', Items.OBSIDIAN).define('R', ModItems.RUBY.get()).define('C', Items.COMPASS).define('L', ModItems.LENS_FRAGMENT.get())
                    .unlockedBy("has_lens_fragment", has(ModItems.LENS_FRAGMENT.get())).save(output, id("edge_compass"));

            // ------------------------------------------------------------ Redstone technology
            shaped(RecipeCategory.REDSTONE, ModItems.ANCIENT_EVENT_SENSOR_ITEM.get())
                    .pattern("SCS").pattern("ROR").pattern("SSS")
                    .define('S', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('C', ModItems.ANCIENT_CIRCUIT.get())
                    .define('R', Items.REDSTONE).define('O', Items.OBSERVER)
                    .unlockedBy("has_ancient_circuit", has(ModItems.ANCIENT_CIRCUIT.get())).save(output, id("ancient_event_sensor"));
            shaped(RecipeCategory.REDSTONE, ModItems.ANCIENT_ENERGY_REACTOR_ITEM.get())
                    .pattern("SCS").pattern("CBC").pattern("SDS")
                    .define('S', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('C', ModItems.ANCIENT_CIRCUIT.get())
                    .define('B', ModItems.RUBY_BLOCK_ITEM.get()).define('D', Items.REDSTONE_BLOCK)
                    .unlockedBy("has_ancient_circuit", has(ModItems.ANCIENT_CIRCUIT.get())).save(output, id("ancient_energy_reactor"));
            shaped(RecipeCategory.REDSTONE, ModItems.RUNIC_LOGIC_DEVICE_ITEM.get())
                    .pattern("TCT").pattern("SSS")
                    .define('T', Items.REDSTONE_TORCH).define('C', ModItems.ANCIENT_CIRCUIT.get()).define('S', ModItems.ANCIENT_STONE_ITEM.get())
                    .unlockedBy("has_ancient_circuit", has(ModItems.ANCIENT_CIRCUIT.get())).save(output, id("runic_logic_device"));
            shaped(RecipeCategory.REDSTONE, ModItems.ANCIENT_SECRET_DOOR_ITEM.get(), 8)
                    .pattern("BBB").pattern("BCB").pattern("BBB")
                    .define('B', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('C', ModItems.ANCIENT_CIRCUIT.get())
                    .unlockedBy("has_ancient_circuit", has(ModItems.ANCIENT_CIRCUIT.get())).save(output, id("ancient_secret_door"));
            shaped(RecipeCategory.REDSTONE, ModItems.DART_TRAP_ITEM.get())
                    .pattern("SSS").pattern("SBS").pattern("SRS")
                    .define('S', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('B', Items.BOW).define('R', Items.REDSTONE)
                    .unlockedBy("has_ancient_stone_bricks", has(ModItems.ANCIENT_STONE_BRICKS_ITEM.get())).save(output, id("dart_trap"));
            shaped(RecipeCategory.REDSTONE, ModItems.SPIKE_TRAP_ITEM.get(), 2)
                    .pattern(" I ").pattern("IAI").pattern("SRS")
                    .define('I', Items.IRON_INGOT).define('A', ModItems.ANCIENT_BONE.get())
                    .define('S', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('R', Items.REDSTONE)
                    .unlockedBy("has_ancient_bone", has(ModItems.ANCIENT_BONE.get())).save(output, id("spike_trap"));
            shaped(RecipeCategory.REDSTONE, ModItems.SPIKE_TRAP_ITEM.get(), 4)
                    .pattern("IVI").pattern("SRS")
                    .define('I', Items.IRON_INGOT).define('V', ModItems.VORPAL_FANG.get())
                    .define('S', ModItems.ANCIENT_STONE_BRICKS_ITEM.get()).define('R', Items.REDSTONE)
                    .unlockedBy("has_vorpal_fang", has(ModItems.VORPAL_FANG.get())).save(output, id("spike_trap_from_vorpal_fang"));

            // ------------------------------------------------------------ Food
            Ingredient cursed = of(ModItems.CURSED_RABBIT.get());
            SimpleCookingRecipeBuilder.smelting(cursed, RecipeCategory.FOOD, CookingBookCategory.FOOD, ModItems.COOKED_CURSED_RABBIT.get(), 0.35F, 200)
                    .unlockedBy("has_cursed_rabbit", has(ModItems.CURSED_RABBIT.get())).save(output, id("cooked_cursed_rabbit"));
            SimpleCookingRecipeBuilder.smoking(cursed, RecipeCategory.FOOD, ModItems.COOKED_CURSED_RABBIT.get(), 0.35F, 100)
                    .unlockedBy("has_cursed_rabbit", has(ModItems.CURSED_RABBIT.get())).save(output, id("cooked_cursed_rabbit_from_smoking"));
            SimpleCookingRecipeBuilder.campfireCooking(cursed, RecipeCategory.FOOD, ModItems.COOKED_CURSED_RABBIT.get(), 0.35F, 600)
                    .unlockedBy("has_cursed_rabbit", has(ModItems.CURSED_RABBIT.get())).save(output, id("cooked_cursed_rabbit_from_campfire_cooking"));
        }
    }
}
