package com.lostfeatures.world.structure;

import com.lostfeatures.LostFeatures;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.tags.TagKey;
import net.minecraft.world.level.levelgen.structure.Structure;
import net.minecraft.world.level.levelgen.structure.StructureType;
import net.minecraft.world.level.levelgen.structure.pieces.StructurePieceType;
import net.minecraft.world.level.storage.loot.LootTable;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModStructures {
    public static final DeferredRegister<StructureType<?>> TYPES = DeferredRegister.create(Registries.STRUCTURE_TYPE, LostFeatures.MOD_ID);
    public static final DeferredRegister<StructurePieceType> PIECES = DeferredRegister.create(Registries.STRUCTURE_PIECE, LostFeatures.MOD_ID);

    public static final DeferredHolder<StructureType<?>, StructureType<AncientStructure>> ANCIENT =
            TYPES.register("ancient", () -> () -> AncientStructure.CODEC);
    public static final DeferredHolder<StructurePieceType, StructurePieceType> ANCIENT_PIECE =
            PIECES.register("ancient_piece", () -> (StructurePieceType.ContextlessType) AncientPiece::new);

    /** Structure tag used for "discovered an ancient site" story detection. */
    public static final TagKey<Structure> ANCIENT_SITES = TagKey.create(Registries.STRUCTURE, LostFeatures.id("ancient_sites"));

    public static final ResourceKey<LootTable> LOOT_ANCIENT_RUINS = loot("chests/ancient_ruins");
    public static final ResourceKey<LootTable> LOOT_LOCKED_ANCIENT = loot("chests/locked_ancient");
    public static final ResourceKey<LootTable> LOOT_BRICK_PYRAMID = loot("chests/brick_pyramid");
    public static final ResourceKey<LootTable> LOOT_STARTING_HOUSE = loot("chests/starting_house");
    public static final ResourceKey<LootTable> LOOT_GLASS_PILLAR_LAB = loot("chests/glass_pillar_lab");
    public static final ResourceKey<LootTable> LOOT_DRAGON_LAIR = loot("chests/dragon_lair");
    public static final ResourceKey<LootTable> LOOT_MONOLITH = loot("chests/monolith");

    private static ResourceKey<LootTable> loot(String path) {
        return ResourceKey.create(Registries.LOOT_TABLE, LostFeatures.id(path));
    }

    private ModStructures() {
    }

    public static void register(IEventBus bus) {
        TYPES.register(bus);
        PIECES.register(bus);
    }
}
