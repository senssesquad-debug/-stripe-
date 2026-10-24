package com.lostfeatures.data;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.block.AncientEnergyReactorBlock;
import com.lostfeatures.block.AncientEventSensorBlock;
import com.lostfeatures.block.DartTrapBlock;
import com.lostfeatures.block.LockedChestBlock;
import com.lostfeatures.block.ReactorPhase;
import com.lostfeatures.block.RunicLogicDeviceBlock;
import com.lostfeatures.block.SpikeTrapBlock;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModItems;
import net.minecraft.client.data.models.BlockModelGenerators;
import net.minecraft.client.data.models.ItemModelGenerators;
import net.minecraft.client.data.models.ModelProvider;
import net.minecraft.client.data.models.blockstates.MultiVariantGenerator;
import net.minecraft.client.data.models.blockstates.PropertyDispatch;
import net.minecraft.client.data.models.model.ItemModelUtils;
import net.minecraft.client.data.models.model.ModelTemplates;
import net.minecraft.client.data.models.model.TextureMapping;
import net.minecraft.client.data.models.model.TextureSlot;
import net.minecraft.client.renderer.block.dispatch.VariantMutator;
import net.minecraft.client.resources.model.sprite.Material;
import net.minecraft.core.Direction;
import net.minecraft.data.PackOutput;
import net.minecraft.resources.Identifier;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.block.Block;
import net.neoforged.neoforge.registries.DeferredItem;

import static net.minecraft.client.data.models.BlockModelGenerators.plainVariant;

/** Generates every blockstate, block model and item model of the mod. */
public final class ModModelProvider extends ModelProvider {
    public ModModelProvider(PackOutput output) {
        super(output, LostFeatures.MOD_ID);
    }

    private static Material tex(String path) {
        return new Material(LostFeatures.id(path));
    }

    private static Identifier model(String path) {
        return LostFeatures.id(path);
    }

    @Override
    protected void registerModels(BlockModelGenerators blocks, ItemModelGenerators items) {
        // ---- Simple cubes
        for (Block b : new Block[]{ModBlocks.RUBY_ORE.get(), ModBlocks.DEEPSLATE_RUBY_ORE.get(), ModBlocks.RUBY_BLOCK.get(),
                ModBlocks.RUBY_BRICKS.get(), ModBlocks.ANCIENT_STONE.get(), ModBlocks.ANCIENT_STONE_BRICKS.get(),
                ModBlocks.CRACKED_ANCIENT_STONE_BRICKS.get(), ModBlocks.ANCIENT_GLYPH_BRICKS.get(), ModBlocks.ANCIENT_BONE_BLOCK.get()}) {
            blocks.createTrivialCube(b);
        }

        // ---- Illusory wall: looks exactly like ancient stone bricks
        Identifier illusory = ModelTemplates.CUBE_ALL.create(ModBlocks.ILLUSORY_WALL.get(),
                new TextureMapping().put(TextureSlot.ALL, tex("block/ancient_stone_bricks")), blocks.modelOutput);
        blocks.blockStateOutput.accept(BlockModelGenerators.createSimpleBlock(ModBlocks.ILLUSORY_WALL.get(), plainVariant(illusory)));

        // ---- Secret door: same model in both states (the open state is not rendered at all)
        Identifier door = ModelTemplates.CUBE_ALL.create(ModBlocks.ANCIENT_SECRET_DOOR.get(),
                new TextureMapping().put(TextureSlot.ALL, tex("block/ancient_secret_door")), blocks.modelOutput);
        blocks.blockStateOutput.accept(BlockModelGenerators.createSimpleBlock(ModBlocks.ANCIENT_SECRET_DOOR.get(), plainVariant(door)));

        // ---- Flowers (cross models, flat item)
        blocks.createCrossBlockWithDefaultItem(ModBlocks.ROSE.get(), BlockModelGenerators.PlantType.NOT_TINTED);
        blocks.createCrossBlockWithDefaultItem(ModBlocks.CYAN_ROSE.get(), BlockModelGenerators.PlantType.NOT_TINTED);

        // ---- Scorched grass
        Identifier scorched = ModelTemplates.CUBE_BOTTOM_TOP.create(ModBlocks.SCORCHED_GRASS.get(), new TextureMapping()
                .put(TextureSlot.TOP, tex("block/scorched_grass_top"))
                .put(TextureSlot.SIDE, tex("block/scorched_grass_side"))
                .put(TextureSlot.BOTTOM, new Material(Identifier.withDefaultNamespace("block/dirt"))), blocks.modelOutput);
        blocks.blockStateOutput.accept(BlockModelGenerators.createSimpleBlock(ModBlocks.SCORCHED_GRASS.get(), plainVariant(scorched)));

        // ---- Charred remains: flat layer using the carpet template
        Identifier remains = ModelTemplates.CARPET.create(ModBlocks.CHARRED_REMAINS.get(),
                new TextureMapping().put(TextureSlot.WOOL, tex("block/charred_remains")), blocks.modelOutput);
        blocks.blockStateOutput.accept(BlockModelGenerators.createSimpleBlock(ModBlocks.CHARRED_REMAINS.get(), plainVariant(remains)));

        // ---- Event sensor: dark when idle, glowing when emitting
        Identifier sensorOff = ModelTemplates.CUBE_BOTTOM_TOP.create(ModBlocks.ANCIENT_EVENT_SENSOR.get(), new TextureMapping()
                .put(TextureSlot.TOP, tex("block/ancient_event_sensor_top"))
                .put(TextureSlot.SIDE, tex("block/ancient_event_sensor_side"))
                .put(TextureSlot.BOTTOM, tex("block/ancient_stone")), blocks.modelOutput);
        Identifier sensorOn = ModelTemplates.CUBE_BOTTOM_TOP.createWithSuffix(ModBlocks.ANCIENT_EVENT_SENSOR.get(), "_on", new TextureMapping()
                .put(TextureSlot.TOP, tex("block/ancient_event_sensor_top_on"))
                .put(TextureSlot.SIDE, tex("block/ancient_event_sensor_side_on"))
                .put(TextureSlot.BOTTOM, tex("block/ancient_stone")), blocks.modelOutput);
        blocks.blockStateOutput.accept(MultiVariantGenerator.dispatch(ModBlocks.ANCIENT_EVENT_SENSOR.get())
                .with(PropertyDispatch.initial(AncientEventSensorBlock.POWER).generate(p -> plainVariant(p > 0 ? sensorOn : sensorOff))));
        blocks.registerSimpleItemModel(ModBlocks.ANCIENT_EVENT_SENSOR.get(), sensorOff);

        // ---- Reactor: one model per phase
        Identifier reactorIdle = reactorModel(blocks, "", "block/ancient_energy_reactor_side");
        Identifier reactorActive = reactorModel(blocks, "_active", "block/ancient_energy_reactor_side_active");
        Identifier reactorCooldown = reactorModel(blocks, "_cooldown", "block/ancient_energy_reactor_side_cooldown");
        blocks.blockStateOutput.accept(MultiVariantGenerator.dispatch(ModBlocks.ANCIENT_ENERGY_REACTOR.get())
                .with(PropertyDispatch.initial(AncientEnergyReactorBlock.PHASE).generate(phase -> plainVariant(switch (phase) {
                    case IDLE -> reactorIdle;
                    case ACTIVE -> reactorActive;
                    case COOLDOWN -> reactorCooldown;
                }))));
        blocks.registerSimpleItemModel(ModBlocks.ANCIENT_ENERGY_REACTOR.get(), reactorIdle);

        // ---- Runic logic device: horizontal facing x powered
        Identifier runicOff = ModelTemplates.CUBE_ORIENTABLE.create(ModBlocks.RUNIC_LOGIC_DEVICE.get(), new TextureMapping()
                .put(TextureSlot.TOP, tex("block/runic_logic_device_top"))
                .put(TextureSlot.FRONT, tex("block/runic_logic_device_front"))
                .put(TextureSlot.SIDE, tex("block/runic_logic_device_side")), blocks.modelOutput);
        Identifier runicOn = ModelTemplates.CUBE_ORIENTABLE.createWithSuffix(ModBlocks.RUNIC_LOGIC_DEVICE.get(), "_on", new TextureMapping()
                .put(TextureSlot.TOP, tex("block/runic_logic_device_top_on"))
                .put(TextureSlot.FRONT, tex("block/runic_logic_device_front_on"))
                .put(TextureSlot.SIDE, tex("block/runic_logic_device_side")), blocks.modelOutput);
        blocks.blockStateOutput.accept(MultiVariantGenerator.dispatch(ModBlocks.RUNIC_LOGIC_DEVICE.get())
                .with(PropertyDispatch.initial(RunicLogicDeviceBlock.POWERED).generate(on -> plainVariant(on ? runicOn : runicOff)))
                // FACING points at the back input; the orientable "front" texture marks the output face.
                .with(PropertyDispatch.modify(RunicLogicDeviceBlock.FACING).generate(f -> horizontal(f.getOpposite()))));
        blocks.registerSimpleItemModel(ModBlocks.RUNIC_LOGIC_DEVICE.get(), runicOff);

        // ---- Dart trap: six facings
        Identifier dart = ModelTemplates.CUBE_ORIENTABLE.create(ModBlocks.DART_TRAP.get(), new TextureMapping()
                .put(TextureSlot.TOP, tex("block/ancient_stone_bricks"))
                .put(TextureSlot.FRONT, tex("block/dart_trap_front"))
                .put(TextureSlot.SIDE, tex("block/ancient_stone_bricks")), blocks.modelOutput);
        Identifier dartVertical = ModelTemplates.CUBE_ORIENTABLE_VERTICAL.create(ModBlocks.DART_TRAP.get(), new TextureMapping()
                .put(TextureSlot.FRONT, tex("block/dart_trap_front"))
                .put(TextureSlot.SIDE, tex("block/ancient_stone_bricks")), blocks.modelOutput);
        blocks.blockStateOutput.accept(MultiVariantGenerator.dispatch(ModBlocks.DART_TRAP.get())
                .with(PropertyDispatch.initial(DartTrapBlock.FACING).generate(f -> switch (f) {
                    case UP -> plainVariant(dartVertical);
                    case DOWN -> plainVariant(dartVertical).with(BlockModelGenerators.X_ROT_180);
                    default -> plainVariant(dart).with(horizontal(f));
                })));
        blocks.registerSimpleItemModel(ModBlocks.DART_TRAP.get(), dart);

        // ---- Spike trap: hand-written models (plate / plate with spikes)
        Identifier spikeOff = model("block/spike_trap");
        Identifier spikeOn = model("block/spike_trap_extended");
        blocks.blockStateOutput.accept(MultiVariantGenerator.dispatch(ModBlocks.SPIKE_TRAP.get())
                .with(PropertyDispatch.initial(SpikeTrapBlock.EXTENDED).generate(e -> plainVariant(e ? spikeOn : spikeOff))));
        blocks.registerSimpleItemModel(ModBlocks.SPIKE_TRAP.get(), spikeOff);

        // ---- Locked chest: orientable box with a lock on the front
        Identifier locked = ModelTemplates.CUBE_ORIENTABLE.create(ModBlocks.LOCKED_CHEST.get(), new TextureMapping()
                .put(TextureSlot.TOP, tex("block/locked_chest_top"))
                .put(TextureSlot.FRONT, tex("block/locked_chest_front"))
                .put(TextureSlot.SIDE, tex("block/locked_chest_side")), blocks.modelOutput);
        blocks.blockStateOutput.accept(MultiVariantGenerator.dispatch(ModBlocks.LOCKED_CHEST.get(), plainVariant(locked))
                .with(PropertyDispatch.modify(LockedChestBlock.FACING).generate(ModModelProvider::horizontal)));
        blocks.registerSimpleItemModel(ModBlocks.LOCKED_CHEST.get(), locked);

        // ---- Altar: hand-written model
        Identifier altar = model("block/ancient_altar");
        blocks.blockStateOutput.accept(BlockModelGenerators.createSimpleBlock(ModBlocks.ANCIENT_ALTAR.get(), plainVariant(altar)));
        blocks.registerSimpleItemModel(ModBlocks.ANCIENT_ALTAR.get(), altar);

        // ---- Items
        for (DeferredItem<? extends Item> item : new DeferredItem[]{ModItems.RUBY, ModItems.DRAGON_SCALE, ModItems.DRAGON_FANG,
                ModItems.DRAGON_HEART, ModItems.WING_MEMBRANE, ModItems.ANCIENT_BONE, ModItems.STRENGTH_SHARD, ModItems.GIANT_TROPHY,
                ModItems.ILLUSION_DUST, ModItems.LENS_FRAGMENT, ModItems.ENCRYPTED_NOTES, ModItems.DECODED_NOTES, ModItems.VORPAL_FANG,
                ModItems.KILLER_BUNNY_TROPHY, ModItems.ANCIENT_CIRCUIT, ModItems.ANCIENT_KEY, ModItems.DRACONIC_SIGIL,
                ModItems.ANCIENT_SMITHING_TEMPLATE, ModItems.QUIVER, ModItems.COPPER_HORN, ModItems.STUDDED_HELMET,
                ModItems.STUDDED_CHESTPLATE, ModItems.STUDDED_LEGGINGS, ModItems.STUDDED_BOOTS, ModItems.DRAGONSCALE_CHESTPLATE,
                ModItems.ANCIENT_JOURNAL, ModItems.EDGE_COMPASS, ModItems.RED_DRAGON_SPAWN_EGG, ModItems.GIANT_SPAWN_EGG,
                ModItems.ILLUSIONER_SPAWN_EGG, ModItems.KILLER_BUNNY_SPAWN_EGG, ModItems.CURSED_RABBIT, ModItems.COOKED_CURSED_RABBIT}) {
            items.generateFlatItem(item.get(), ModelTemplates.FLAT_ITEM);
        }
        items.generateFlatItem(ModItems.FANG_BLADE.get(), ModelTemplates.FLAT_HANDHELD_ITEM);
        ModItems.discs().forEach(d -> items.generateFlatItem(d.get(), ModelTemplates.FLAT_ITEM));
    }

    private Identifier reactorModel(BlockModelGenerators blocks, String suffix, String side) {
        return ModelTemplates.CUBE_BOTTOM_TOP.createWithSuffix(ModBlocks.ANCIENT_ENERGY_REACTOR.get(), suffix, new TextureMapping()
                .put(TextureSlot.TOP, tex("block/ancient_energy_reactor_top" + suffix))
                .put(TextureSlot.SIDE, tex(side))
                .put(TextureSlot.BOTTOM, tex("block/ancient_stone_bricks")), blocks.modelOutput);
    }

    /** Rotation for models whose front faces north by default. */
    private static VariantMutator horizontal(Direction facing) {
        return switch (facing) {
            case EAST -> BlockModelGenerators.Y_ROT_90;
            case SOUTH -> BlockModelGenerators.Y_ROT_180;
            case WEST -> BlockModelGenerators.Y_ROT_270;
            default -> BlockModelGenerators.NOP;
        };
    }
}
