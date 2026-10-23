package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.block.AncientAltarBlock;
import com.lostfeatures.block.AncientEnergyReactorBlock;
import com.lostfeatures.block.AncientEventSensorBlock;
import com.lostfeatures.block.AncientGlyphBlock;
import com.lostfeatures.block.AncientSecretDoorBlock;
import com.lostfeatures.block.CharredRemainsBlock;
import com.lostfeatures.block.DartTrapBlock;
import com.lostfeatures.block.IllusoryWallBlock;
import com.lostfeatures.block.LockedChestBlock;
import com.lostfeatures.block.ReactorPhase;
import com.lostfeatures.block.RunicLogicDeviceBlock;
import com.lostfeatures.block.ScorchedGrassBlock;
import com.lostfeatures.block.SpikeTrapBlock;
import net.minecraft.util.valueproviders.UniformInt;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.DropExperienceBlock;
import net.minecraft.world.level.block.FlowerBlock;
import net.minecraft.world.level.block.SoundType;
import net.minecraft.world.level.block.state.BlockBehaviour;
import net.minecraft.world.level.block.state.properties.NoteBlockInstrument;
import net.minecraft.world.level.material.MapColor;
import net.minecraft.world.level.material.PushReaction;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.registries.DeferredBlock;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModBlocks {
    public static final DeferredRegister.Blocks BLOCKS = DeferredRegister.createBlocks(LostFeatures.MOD_ID);

    // --- Ruby resource system -------------------------------------------------------------
    public static final DeferredBlock<DropExperienceBlock> RUBY_ORE = BLOCKS.registerBlock("ruby_ore",
            p -> new DropExperienceBlock(UniformInt.of(3, 7), p),
            p -> p.mapColor(MapColor.STONE).instrument(NoteBlockInstrument.BASEDRUM).requiresCorrectToolForDrops()
                    .strength(3.0F, 3.0F).sound(ModSounds.RUBY_SOUND_TYPE));
    public static final DeferredBlock<DropExperienceBlock> DEEPSLATE_RUBY_ORE = BLOCKS.registerBlock("deepslate_ruby_ore",
            p -> new DropExperienceBlock(UniformInt.of(3, 7), p),
            p -> p.mapColor(MapColor.DEEPSLATE).instrument(NoteBlockInstrument.BASEDRUM).requiresCorrectToolForDrops()
                    .strength(4.5F, 3.0F).sound(ModSounds.RUBY_SOUND_TYPE));
    public static final DeferredBlock<Block> RUBY_BLOCK = BLOCKS.registerSimpleBlock("ruby_block",
            p -> p.mapColor(MapColor.COLOR_RED).instrument(NoteBlockInstrument.BIT).requiresCorrectToolForDrops()
                    .strength(5.0F, 6.0F).sound(ModSounds.RUBY_SOUND_TYPE));
    public static final DeferredBlock<Block> RUBY_BRICKS = BLOCKS.registerSimpleBlock("ruby_bricks",
            p -> p.mapColor(MapColor.COLOR_RED).requiresCorrectToolForDrops().strength(3.0F, 6.0F).sound(ModSounds.RUBY_SOUND_TYPE));

    // --- Ancient civilisation building blocks --------------------------------------------
    public static final DeferredBlock<Block> ANCIENT_STONE = BLOCKS.registerSimpleBlock("ancient_stone",
            p -> p.mapColor(MapColor.TERRACOTTA_BROWN).instrument(NoteBlockInstrument.BASEDRUM).requiresCorrectToolForDrops().strength(2.0F, 6.0F));
    public static final DeferredBlock<Block> ANCIENT_STONE_BRICKS = BLOCKS.registerSimpleBlock("ancient_stone_bricks",
            p -> p.mapColor(MapColor.TERRACOTTA_BROWN).instrument(NoteBlockInstrument.BASEDRUM).requiresCorrectToolForDrops().strength(2.0F, 6.0F));
    public static final DeferredBlock<Block> CRACKED_ANCIENT_STONE_BRICKS = BLOCKS.registerSimpleBlock("cracked_ancient_stone_bricks",
            p -> p.mapColor(MapColor.TERRACOTTA_BROWN).instrument(NoteBlockInstrument.BASEDRUM).requiresCorrectToolForDrops().strength(2.0F, 6.0F));
    public static final DeferredBlock<AncientGlyphBlock> ANCIENT_GLYPH_BRICKS = BLOCKS.registerBlock("ancient_glyph_bricks",
            AncientGlyphBlock::new,
            p -> p.mapColor(MapColor.TERRACOTTA_BROWN).instrument(NoteBlockInstrument.BASEDRUM).requiresCorrectToolForDrops()
                    .strength(2.0F, 6.0F).lightLevel(s -> 4));
    public static final DeferredBlock<Block> ANCIENT_BONE_BLOCK = BLOCKS.registerSimpleBlock("ancient_bone_block",
            p -> p.mapColor(MapColor.SAND).instrument(NoteBlockInstrument.XYLOPHONE).requiresCorrectToolForDrops().strength(2.0F).sound(SoundType.BONE_BLOCK));
    public static final DeferredBlock<IllusoryWallBlock> ILLUSORY_WALL = BLOCKS.registerBlock("illusory_wall",
            IllusoryWallBlock::new,
            p -> p.mapColor(MapColor.TERRACOTTA_BROWN).strength(1.0F).noCollision().noOcclusion().isSuffocating((s, l, pos) -> false)
                    .isViewBlocking((s, l, pos) -> false));

    // --- Historical flora (Classic rose and Pocket Edition cyan flower) -------------------
    public static final DeferredBlock<FlowerBlock> ROSE = BLOCKS.registerBlock("rose",
            p -> new FlowerBlock(MobEffects.REGENERATION, 8.0F, p), ModBlocks::flowerProperties);
    public static final DeferredBlock<FlowerBlock> CYAN_ROSE = BLOCKS.registerBlock("cyan_rose",
            p -> new FlowerBlock(MobEffects.NIGHT_VISION, 5.0F, p), ModBlocks::flowerProperties);

    // --- Environmental traces -------------------------------------------------------------
    public static final DeferredBlock<ScorchedGrassBlock> SCORCHED_GRASS = BLOCKS.registerBlock("scorched_grass",
            ScorchedGrassBlock::new, p -> p.mapColor(MapColor.COLOR_BLACK).strength(0.6F).sound(SoundType.GRAVEL).randomTicks());
    public static final DeferredBlock<CharredRemainsBlock> CHARRED_REMAINS = BLOCKS.registerBlock("charred_remains",
            CharredRemainsBlock::new, p -> p.mapColor(MapColor.COLOR_GRAY).strength(0.2F).sound(SoundType.BONE_BLOCK)
                    .noCollision().noOcclusion().randomTicks().pushReaction(PushReaction.DESTROY));

    // --- Ancient redstone technology -----------------------------------------------------
    public static final DeferredBlock<AncientEventSensorBlock> ANCIENT_EVENT_SENSOR = BLOCKS.registerBlock("ancient_event_sensor",
            AncientEventSensorBlock::new, p -> p.mapColor(MapColor.COLOR_RED).requiresCorrectToolForDrops().strength(3.0F, 6.0F)
                    .sound(SoundType.COPPER).lightLevel(s -> s.getValue(AncientEventSensorBlock.POWER) > 0 ? 7 : 0));
    public static final DeferredBlock<AncientEnergyReactorBlock> ANCIENT_ENERGY_REACTOR = BLOCKS.registerBlock("ancient_energy_reactor",
            AncientEnergyReactorBlock::new, p -> p.mapColor(MapColor.COLOR_RED).requiresCorrectToolForDrops().strength(4.0F, 8.0F)
                    .sound(SoundType.COPPER).lightLevel(s -> s.getValue(AncientEnergyReactorBlock.PHASE) == ReactorPhase.ACTIVE ? 12 : 3));
    public static final DeferredBlock<RunicLogicDeviceBlock> RUNIC_LOGIC_DEVICE = BLOCKS.registerBlock("runic_logic_device",
            RunicLogicDeviceBlock::new, p -> p.mapColor(MapColor.TERRACOTTA_BROWN).requiresCorrectToolForDrops().strength(2.5F, 6.0F)
                    .lightLevel(s -> s.getValue(RunicLogicDeviceBlock.POWERED) ? 6 : 0));
    public static final DeferredBlock<AncientSecretDoorBlock> ANCIENT_SECRET_DOOR = BLOCKS.registerBlock("ancient_secret_door",
            AncientSecretDoorBlock::new, p -> p.mapColor(MapColor.TERRACOTTA_BROWN).requiresCorrectToolForDrops().strength(3.0F, 6.0F)
                    .noOcclusion().pushReaction(PushReaction.BLOCK));
    public static final DeferredBlock<DartTrapBlock> DART_TRAP = BLOCKS.registerBlock("dart_trap",
            DartTrapBlock::new, p -> p.mapColor(MapColor.TERRACOTTA_BROWN).requiresCorrectToolForDrops().strength(3.0F, 6.0F));
    public static final DeferredBlock<SpikeTrapBlock> SPIKE_TRAP = BLOCKS.registerBlock("spike_trap",
            SpikeTrapBlock::new, p -> p.mapColor(MapColor.METAL).requiresCorrectToolForDrops().strength(3.0F, 6.0F)
                    .sound(SoundType.METAL).noOcclusion());
    public static final DeferredBlock<LockedChestBlock> LOCKED_CHEST = BLOCKS.registerBlock("locked_chest",
            LockedChestBlock::new, p -> p.mapColor(MapColor.WOOD).strength(-1.0F, 3600000.0F).sound(SoundType.WOOD)
                    .noLootTable().pushReaction(PushReaction.BLOCK));
    public static final DeferredBlock<AncientAltarBlock> ANCIENT_ALTAR = BLOCKS.registerBlock("ancient_altar",
            AncientAltarBlock::new, p -> p.mapColor(MapColor.COLOR_RED).requiresCorrectToolForDrops().strength(5.0F, 1200.0F)
                    .lightLevel(s -> 9).noOcclusion());

    private static BlockBehaviour.Properties flowerProperties(BlockBehaviour.Properties p) {
        return p.mapColor(MapColor.PLANT).noCollision().instabreak().sound(SoundType.GRASS)
                .offsetType(BlockBehaviour.OffsetType.XZ).pushReaction(PushReaction.DESTROY);
    }

    private ModBlocks() {
    }

    public static void register(IEventBus bus) {
        BLOCKS.register(bus);
    }
}
