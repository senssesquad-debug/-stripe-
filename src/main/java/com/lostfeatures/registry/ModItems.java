package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.item.AncientJournalItem;
import com.lostfeatures.item.CopperHornItem;
import com.lostfeatures.item.EdgeCompassItem;
import com.lostfeatures.item.FangBladeItem;
import com.lostfeatures.item.LoreItem;
import com.lostfeatures.item.ModArmorMaterials;
import com.lostfeatures.item.QuiverItem;
import net.minecraft.resources.ResourceKey;
import net.minecraft.tags.BlockTags;
import net.minecraft.world.item.BlockItem;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.JukeboxSong;
import net.minecraft.world.item.Rarity;
import net.minecraft.world.item.SpawnEggItem;
import net.minecraft.world.item.ToolMaterial;
import net.minecraft.world.item.equipment.ArmorType;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredItem;
import net.neoforged.neoforge.registries.DeferredRegister;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

public final class ModItems {
    public static final DeferredRegister.Items ITEMS = DeferredRegister.createItems(LostFeatures.MOD_ID);
    private static final List<DeferredItem<? extends Item>> DISCS = new ArrayList<>();

    /** Fang Blade: iron-tier sword with higher durability that sets targets alight. */
    public static final ToolMaterial DRAGON_FANG_MATERIAL = new ToolMaterial(BlockTags.INCORRECT_FOR_IRON_TOOL, 900, 7.0F, 2.5F, 16,
            ModTags.Items.REPAIRS_DRAGONSCALE);

    // --- Materials ------------------------------------------------------------------------
    public static final DeferredItem<Item> RUBY = lore("ruby", p -> p);
    public static final DeferredItem<Item> DRAGON_SCALE = lore("dragon_scale", p -> p.fireResistant().rarity(Rarity.UNCOMMON));
    public static final DeferredItem<Item> DRAGON_FANG = lore("dragon_fang", p -> p.fireResistant().rarity(Rarity.UNCOMMON));
    public static final DeferredItem<Item> DRAGON_HEART = lore("dragon_heart", p -> p.fireResistant().rarity(Rarity.RARE).stacksTo(16));
    public static final DeferredItem<Item> WING_MEMBRANE = lore("wing_membrane", p -> p.fireResistant().rarity(Rarity.UNCOMMON));
    public static final DeferredItem<Item> ANCIENT_BONE = lore("ancient_bone", p -> p);
    public static final DeferredItem<Item> STRENGTH_SHARD = lore("strength_shard", p -> p.rarity(Rarity.UNCOMMON));
    public static final DeferredItem<Item> GIANT_TROPHY = lore("giant_trophy", p -> p.rarity(Rarity.EPIC).stacksTo(1));
    public static final DeferredItem<Item> ILLUSION_DUST = lore("illusion_dust", p -> p);
    public static final DeferredItem<Item> LENS_FRAGMENT = lore("lens_fragment", p -> p.rarity(Rarity.UNCOMMON));
    public static final DeferredItem<Item> ENCRYPTED_NOTES = lore("encrypted_notes", p -> p.rarity(Rarity.UNCOMMON).stacksTo(16));
    public static final DeferredItem<Item> DECODED_NOTES = lore("decoded_notes", p -> p.rarity(Rarity.RARE).stacksTo(16));
    public static final DeferredItem<Item> VORPAL_FANG = lore("vorpal_fang", p -> p.rarity(Rarity.UNCOMMON));
    public static final DeferredItem<Item> KILLER_BUNNY_TROPHY = lore("killer_bunny_trophy", p -> p.rarity(Rarity.EPIC).stacksTo(1));
    public static final DeferredItem<Item> ANCIENT_CIRCUIT = lore("ancient_circuit", p -> p);
    public static final DeferredItem<Item> ANCIENT_KEY = lore("ancient_key", p -> p.rarity(Rarity.UNCOMMON).stacksTo(16));
    public static final DeferredItem<Item> DRACONIC_SIGIL = lore("draconic_sigil", p -> p.rarity(Rarity.EPIC).stacksTo(1).fireResistant());
    public static final DeferredItem<Item> ANCIENT_SMITHING_TEMPLATE = lore("ancient_smithing_template", p -> p.rarity(Rarity.UNCOMMON));

    // --- Equipment and tools --------------------------------------------------------------
    public static final DeferredItem<QuiverItem> QUIVER = ITEMS.registerItem("quiver", QuiverItem::new, p -> p.stacksTo(1));
    public static final DeferredItem<CopperHornItem> COPPER_HORN = ITEMS.registerItem("copper_horn", CopperHornItem::new,
            p -> p.stacksTo(1).rarity(Rarity.UNCOMMON));
    public static final DeferredItem<Item> STUDDED_HELMET = ITEMS.registerItem("studded_helmet", Item::new,
            p -> p.humanoidArmor(ModArmorMaterials.STUDDED, ArmorType.HELMET));
    public static final DeferredItem<Item> STUDDED_CHESTPLATE = ITEMS.registerItem("studded_chestplate", Item::new,
            p -> p.humanoidArmor(ModArmorMaterials.STUDDED, ArmorType.CHESTPLATE));
    public static final DeferredItem<Item> STUDDED_LEGGINGS = ITEMS.registerItem("studded_leggings", Item::new,
            p -> p.humanoidArmor(ModArmorMaterials.STUDDED, ArmorType.LEGGINGS));
    public static final DeferredItem<Item> STUDDED_BOOTS = ITEMS.registerItem("studded_boots", Item::new,
            p -> p.humanoidArmor(ModArmorMaterials.STUDDED, ArmorType.BOOTS));
    public static final DeferredItem<Item> DRAGONSCALE_CHESTPLATE = ITEMS.registerItem("dragonscale_chestplate", Item::new,
            p -> p.humanoidArmor(ModArmorMaterials.DRAGONSCALE, ArmorType.CHESTPLATE).fireResistant().rarity(Rarity.RARE));
    public static final DeferredItem<FangBladeItem> FANG_BLADE = ITEMS.registerItem("fang_blade", FangBladeItem::new,
            p -> p.sword(DRAGON_FANG_MATERIAL, 3.0F, -2.4F).fireResistant().rarity(Rarity.UNCOMMON));
    public static final DeferredItem<AncientJournalItem> ANCIENT_JOURNAL = ITEMS.registerItem("ancient_journal", AncientJournalItem::new,
            p -> p.stacksTo(1));
    public static final DeferredItem<EdgeCompassItem> EDGE_COMPASS = ITEMS.registerItem("edge_compass", EdgeCompassItem::new,
            p -> p.stacksTo(1).rarity(Rarity.RARE));

    // --- Music discs -----------------------------------------------------------------------
    public static final DeferredItem<Item> DISC_ANCIENT_ECHOES = disc("music_disc_ancient_echoes", ModJukeboxSongs.ANCIENT_ECHOES);
    public static final DeferredItem<Item> DISC_DRAGONS_OMEN = disc("music_disc_dragons_omen", ModJukeboxSongs.DRAGONS_OMEN);
    public static final DeferredItem<Item> DISC_FAR_BEYOND = disc("music_disc_far_beyond", ModJukeboxSongs.FAR_BEYOND);
    public static final DeferredItem<Item> DISC_FORGOTTEN_CIVILIZATION = disc("music_disc_forgotten_civilization", ModJukeboxSongs.FORGOTTEN_CIVILIZATION);
    public static final DeferredItem<Item> DISC_RUBY_RESONANCE = disc("music_disc_ruby_resonance", ModJukeboxSongs.RUBY_RESONANCE);
    public static final DeferredItem<Item> DISC_ILLUSION = disc("music_disc_illusion", ModJukeboxSongs.ILLUSION);
    public static final DeferredItem<Item> DISC_THE_LAST_MONOLITH = disc("music_disc_the_last_monolith", ModJukeboxSongs.THE_LAST_MONOLITH);

    // --- Spawn eggs (entity types are registered before items, so they resolve here) ------
    public static final DeferredItem<SpawnEggItem> RED_DRAGON_SPAWN_EGG = ITEMS.registerItem("red_dragon_spawn_egg", SpawnEggItem::new,
            p -> p.spawnEgg(ModEntities.RED_DRAGON.get()));
    public static final DeferredItem<SpawnEggItem> GIANT_SPAWN_EGG = ITEMS.registerItem("giant_spawn_egg", SpawnEggItem::new,
            p -> p.spawnEgg(ModEntities.GIANT.get()));
    public static final DeferredItem<SpawnEggItem> ILLUSIONER_SPAWN_EGG = ITEMS.registerItem("illusioner_spawn_egg", SpawnEggItem::new,
            p -> p.spawnEgg(ModEntities.ILLUSIONER.get()));
    public static final DeferredItem<SpawnEggItem> KILLER_BUNNY_SPAWN_EGG = ITEMS.registerItem("killer_bunny_spawn_egg", SpawnEggItem::new,
            p -> p.spawnEgg(ModEntities.KILLER_BUNNY.get()));

    // --- Block items -----------------------------------------------------------------------
    public static final DeferredItem<BlockItem> RUBY_ORE_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.RUBY_ORE);
    public static final DeferredItem<BlockItem> DEEPSLATE_RUBY_ORE_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.DEEPSLATE_RUBY_ORE);
    public static final DeferredItem<BlockItem> RUBY_BLOCK_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.RUBY_BLOCK);
    public static final DeferredItem<BlockItem> RUBY_BRICKS_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.RUBY_BRICKS);
    public static final DeferredItem<BlockItem> ANCIENT_STONE_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_STONE);
    public static final DeferredItem<BlockItem> ANCIENT_STONE_BRICKS_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_STONE_BRICKS);
    public static final DeferredItem<BlockItem> CRACKED_ANCIENT_STONE_BRICKS_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.CRACKED_ANCIENT_STONE_BRICKS);
    public static final DeferredItem<BlockItem> ANCIENT_GLYPH_BRICKS_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_GLYPH_BRICKS);
    public static final DeferredItem<BlockItem> ANCIENT_BONE_BLOCK_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_BONE_BLOCK);
    public static final DeferredItem<BlockItem> ILLUSORY_WALL_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ILLUSORY_WALL);
    public static final DeferredItem<BlockItem> ROSE_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ROSE);
    public static final DeferredItem<BlockItem> CYAN_ROSE_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.CYAN_ROSE);
    public static final DeferredItem<BlockItem> SCORCHED_GRASS_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.SCORCHED_GRASS);
    public static final DeferredItem<BlockItem> CHARRED_REMAINS_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.CHARRED_REMAINS);
    public static final DeferredItem<BlockItem> ANCIENT_EVENT_SENSOR_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_EVENT_SENSOR);
    public static final DeferredItem<BlockItem> ANCIENT_ENERGY_REACTOR_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_ENERGY_REACTOR);
    public static final DeferredItem<BlockItem> RUNIC_LOGIC_DEVICE_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.RUNIC_LOGIC_DEVICE);
    public static final DeferredItem<BlockItem> ANCIENT_SECRET_DOOR_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_SECRET_DOOR);
    public static final DeferredItem<BlockItem> DART_TRAP_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.DART_TRAP);
    public static final DeferredItem<BlockItem> SPIKE_TRAP_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.SPIKE_TRAP);
    public static final DeferredItem<BlockItem> LOCKED_CHEST_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.LOCKED_CHEST,
            p -> p.rarity(Rarity.UNCOMMON));
    public static final DeferredItem<BlockItem> ANCIENT_ALTAR_ITEM = ITEMS.registerSimpleBlockItem(ModBlocks.ANCIENT_ALTAR,
            p -> p.rarity(Rarity.RARE));

    private ModItems() {
    }

    private static DeferredItem<Item> lore(String name, java.util.function.UnaryOperator<Item.Properties> props) {
        return ITEMS.registerItem(name, p -> new LoreItem(p, name), props);
    }

    private static DeferredItem<Item> disc(String name, ResourceKey<JukeboxSong> song) {
        DeferredItem<Item> item = ITEMS.registerItem(name, Item::new, p -> p.stacksTo(1).rarity(Rarity.RARE).jukeboxPlayable(song));
        DISCS.add(item);
        return item;
    }

    public static List<DeferredItem<? extends Item>> discs() {
        return Collections.unmodifiableList(DISCS);
    }

    public static void register(IEventBus bus) {
        ITEMS.register(bus);
    }
}
