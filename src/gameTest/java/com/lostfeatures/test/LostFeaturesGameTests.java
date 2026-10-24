package com.lostfeatures.test;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.block.AncientEnergyReactorBlock;
import com.lostfeatures.block.AncientEventSensorBlock;
import com.lostfeatures.block.AncientSecretDoorBlock;
import com.lostfeatures.block.ReactorPhase;
import com.lostfeatures.block.RunicLogicDeviceBlock;
import com.lostfeatures.block.RunicMode;
import com.lostfeatures.block.SensorFilter;
import com.lostfeatures.block.SpikeTrapBlock;
import com.lostfeatures.block.entity.AncientEnergyReactorBlockEntity;
import com.lostfeatures.block.entity.LockedChestBlockEntity;
import com.lostfeatures.entity.CreatureOrigin;
import com.lostfeatures.entity.LostGiant;
import com.lostfeatures.entity.RedDragon;
import com.lostfeatures.entity.ai.relationship.RelationshipRules;
import com.lostfeatures.item.QuiverContents;
import com.lostfeatures.item.QuiverItem;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModEntities;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.story.Milestone;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.story.StoryProgress;
import com.lostfeatures.world.AncientSignals;
import com.lostfeatures.world.FarLandsDensity;
import com.lostfeatures.world.event.ActiveEvent;
import com.lostfeatures.world.event.EncounterDirector;
import com.lostfeatures.world.event.EventStage;
import com.lostfeatures.world.event.EventType;
import com.lostfeatures.world.memory.EventMemory;
import com.lostfeatures.world.structure.ModStructures;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.Holder;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.gametest.framework.FunctionGameTestInstance;
import net.minecraft.gametest.framework.GameTestHelper;
import net.minecraft.gametest.framework.TestData;
import net.minecraft.gametest.framework.TestEnvironmentDefinition;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityTypes;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.attributes.DefaultAttributes;
import net.minecraft.world.entity.animal.cow.Cow;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.entity.projectile.arrow.Arrow;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.crafting.RecipeHolder;
import net.minecraft.world.level.GameType;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.storage.loot.LootTable;
import net.minecraft.world.phys.AABB;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.RegisterGameTestsEvent;
import net.neoforged.neoforge.registries.RegisterEvent;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Automated GameTests. Run with {@code ./gradlew runGameTestServer}. Each test builds what it needs in
 * a 9x5x9 stone-floored template; coordinates below are relative to that template.
 */
@EventBusSubscriber(modid = LostFeatures.MOD_ID)
public final class LostFeaturesGameTests {
    private record Spec(Consumer<GameTestHelper> fn, int ticks) {
    }

    private static final Map<String, Spec> TESTS = new LinkedHashMap<>();

    static {
        TESTS.put("registries_complete", new Spec(LostFeaturesGameTests::registriesComplete, 20));
        TESTS.put("recipes_namespaced_and_valid", new Spec(LostFeaturesGameTests::recipesNamespacedAndValid, 20));
        TESTS.put("loot_tables_resolve", new Spec(LostFeaturesGameTests::lootTablesResolve, 20));
        TESTS.put("vanilla_untouched", new Spec(LostFeaturesGameTests::vanillaUntouched, 20));
        TESTS.put("sensor_detects_creature", new Spec(LostFeaturesGameTests::sensorDetectsCreature, 60));
        TESTS.put("sensor_mechanism_pulse", new Spec(LostFeaturesGameTests::sensorMechanismPulse, 60));
        TESTS.put("reactor_finite_charge", new Spec(LostFeaturesGameTests::reactorFiniteCharge, 120));
        TESTS.put("runic_and_gate", new Spec(LostFeaturesGameTests::runicAndGate, 40));
        TESTS.put("runic_sequence", new Spec(LostFeaturesGameTests::runicSequence, 80));
        TESTS.put("secret_door_group", new Spec(LostFeaturesGameTests::secretDoorGroup, 40));
        TESTS.put("dart_trap_fires_once", new Spec(LostFeaturesGameTests::dartTrapFiresOnce, 40));
        TESTS.put("spike_trap_damages", new Spec(LostFeaturesGameTests::spikeTrapDamages, 60));
        TESTS.put("locked_chest_unlocks", new Spec(LostFeaturesGameTests::lockedChestUnlocks, 20));
        TESTS.put("quiver_supplies_bow", new Spec(LostFeaturesGameTests::quiverSuppliesBow, 20));
        TESTS.put("story_idempotent_rewards", new Spec(LostFeaturesGameTests::storyIdempotentRewards, 20));
        TESTS.put("creative_spawn_no_progress", new Spec(LostFeaturesGameTests::creativeSpawnNoProgress, 20));
        TESTS.put("red_dragon_flight_and_persistence", new Spec(LostFeaturesGameTests::redDragonFlightAndPersistence, 80));
        TESTS.put("relationship_goals_injected", new Spec(LostFeaturesGameTests::relationshipGoalsInjected, 20));
        TESTS.put("event_memory_bounded", new Spec(LostFeaturesGameTests::eventMemoryBounded, 20));
        TESTS.put("ancient_disturbance_lifecycle", new Spec(LostFeaturesGameTests::ancientDisturbanceLifecycle, 900));
        TESTS.put("far_lands_density_bounded", new Spec(LostFeaturesGameTests::farLandsDensityBounded, 20));
        TESTS.put("structures_build_signature_blocks", new Spec(LostFeaturesGameTests::structuresBuild, 40));
        TESTS.put("red_dragon_breath_is_telegraphed", new Spec(LostFeaturesGameTests::dragonBreathTelegraphed, 200));
        TESTS.put("giant_slam_after_windup", new Spec(LostFeaturesGameTests::giantSlamAfterWindup, 260));
    }

    private LostFeaturesGameTests() {
    }

    @SubscribeEvent
    public static void registerTests(RegisterGameTestsEvent event) {
        Holder<TestEnvironmentDefinition<?>> environment = event.registerEnvironment(LostFeatures.id("default"), new TestEnvironmentDefinition.AllOf());
        TESTS.forEach((name, spec) -> {
            TestData<Holder<TestEnvironmentDefinition<?>>> data = new TestData<>(environment, LostFeatures.id("empty"), spec.ticks(), 0, true,
                    Rotation.NONE);
            event.registerTest(LostFeatures.id(name), new FunctionGameTestInstance(fn(name), data));
        });
    }

    @SubscribeEvent
    public static void registerFunctions(RegisterEvent event) {
        event.register(Registries.TEST_FUNCTION, r -> TESTS.forEach((name, spec) -> r.register(fn(name), spec.fn())));
    }

    private static ResourceKey<Consumer<GameTestHelper>> fn(String name) {
        return ResourceKey.create(Registries.TEST_FUNCTION, LostFeatures.id(name));
    }

    private static final BlockPos C = new BlockPos(4, 1, 4);

    // ------------------------------------------------------------------ registration and data

    static void registriesComplete(GameTestHelper h) {
        h.assertTrue(BuiltInRegistries.ENTITY_TYPE.containsKey(LostFeatures.id("red_dragon")), "red dragon registered");
        h.assertTrue(DefaultAttributes.hasSupplier(ModEntities.GIANT.get()), "giant attributes registered");
        for (var egg : new ItemStack[]{new ItemStack(ModItems.RED_DRAGON_SPAWN_EGG.get()), new ItemStack(ModItems.GIANT_SPAWN_EGG.get()),
                new ItemStack(ModItems.ILLUSIONER_SPAWN_EGG.get()), new ItemStack(ModItems.KILLER_BUNNY_SPAWN_EGG.get())}) {
            var type = net.minecraft.world.item.SpawnEggItem.getType(egg);
            h.assertTrue(type != null && BuiltInRegistries.ENTITY_TYPE.getKey(type).getNamespace().equals(LostFeatures.MOD_ID),
                    "spawn egg targets a lostfeatures entity: " + egg);
        }
        var paintings = h.getLevel().registryAccess().lookupOrThrow(Registries.PAINTING_VARIANT);
        h.assertTrue(paintings.get(ResourceKey.create(Registries.PAINTING_VARIANT, LostFeatures.id("dragon_over_peaks"))).isPresent(),
                "painting variant registered");
        var songs = h.getLevel().registryAccess().lookupOrThrow(Registries.JUKEBOX_SONG);
        h.assertTrue(songs.get(ResourceKey.create(Registries.JUKEBOX_SONG, LostFeatures.id("ancient_echoes"))).isPresent(),
                "jukebox song registered");
        h.succeed();
    }

    static void recipesNamespacedAndValid(GameTestHelper h) {
        var recipes = h.getLevel().recipeAccess();
        int ours = 0;
        for (RecipeHolder<?> holder : recipes.getRecipes()) {
            Identifier id = holder.id().identifier();
            if (id.getNamespace().equals(LostFeatures.MOD_ID)) {
                ours++;
            }
        }
        h.assertTrue(ours >= 40, "expected at least 40 lostfeatures recipes, found " + ours);
        h.assertTrue(recipes.byKey(ResourceKey.create(Registries.RECIPE, Identifier.withDefaultNamespace("diamond_pickaxe"))).isPresent(),
                "vanilla diamond_pickaxe recipe still present");
        h.succeed();
    }

    static void lootTablesResolve(GameTestHelper h) {
        var server = h.getLevel().getServer();
        for (ResourceKey<LootTable> key : new ResourceKey[]{ModStructures.LOOT_ANCIENT_RUINS, ModStructures.LOOT_LOCKED_ANCIENT,
                ModStructures.LOOT_BRICK_PYRAMID, ModStructures.LOOT_STARTING_HOUSE, ModStructures.LOOT_GLASS_PILLAR_LAB,
                ModStructures.LOOT_DRAGON_LAIR, ModStructures.LOOT_MONOLITH, RedDragon.ANCESTRAL_LOOT}) {
            h.assertTrue(server.reloadableRegistries().getLootTable(key) != LootTable.EMPTY, "loot table present: " + key.identifier());
        }
        for (var type : new net.minecraft.world.entity.EntityType<?>[]{ModEntities.RED_DRAGON.get(), ModEntities.GIANT.get(),
                ModEntities.ILLUSIONER.get(), ModEntities.KILLER_BUNNY.get()}) {
            var key = type.getDefaultLootTable().orElseThrow();
            h.assertTrue(key.identifier().getNamespace().equals(LostFeatures.MOD_ID), "entity uses its own loot table");
            h.assertTrue(server.reloadableRegistries().getLootTable(key) != LootTable.EMPTY, "entity loot present: " + key.identifier());
        }
        h.succeed();
    }

    static void vanillaUntouched(GameTestHelper h) {
        h.assertTrue(DefaultAttributes.getSupplier(EntityTypes.ENDER_DRAGON).getBaseValue(Attributes.MAX_HEALTH) == 200.0, "ender dragon health");
        h.assertTrue(DefaultAttributes.getSupplier(EntityTypes.WITHER).getBaseValue(Attributes.MAX_HEALTH) == 300.0, "wither health");
        h.assertTrue(DefaultAttributes.getSupplier(EntityTypes.ILLUSIONER).getBaseValue(Attributes.MAX_HEALTH) == 32.0, "vanilla illusioner health");
        h.assertTrue(DefaultAttributes.getSupplier(EntityTypes.GIANT).getBaseValue(Attributes.MAX_HEALTH) == 100.0, "vanilla giant health");
        h.assertTrue((Object) EntityTypes.ILLUSIONER != ModEntities.ILLUSIONER.get(), "illusioner is a separate type");
        var server = h.getLevel().getServer();
        h.assertTrue(server.reloadableRegistries().getLootTable(EntityTypes.ZOMBIE.getDefaultLootTable().orElseThrow()) != LootTable.EMPTY,
                "vanilla zombie loot intact");
        h.succeed();
    }

    // ------------------------------------------------------------------ devices

    static void sensorDetectsCreature(GameTestHelper h) {
        h.setBlock(C, ModBlocks.ANCIENT_EVENT_SENSOR.get().defaultBlockState().setValue(AncientEventSensorBlock.FILTER, SensorFilter.CREATURES));
        var bunny = h.spawn(ModEntities.KILLER_BUNNY.get(), new BlockPos(2, 1, 2));
        bunny.setNoAi(true);
        h.succeedWhen(() -> h.assertTrue(h.getBlockState(C).getValue(AncientEventSensorBlock.POWER) > 0, "sensor powered by nearby creature"));
    }

    static void sensorMechanismPulse(GameTestHelper h) {
        h.setBlock(C, ModBlocks.ANCIENT_EVENT_SENSOR.get().defaultBlockState().setValue(AncientEventSensorBlock.FILTER, SensorFilter.MECHANISMS));
        h.runAfterDelay(2, () -> AncientSignals.post(h.getLevel(), h.absolutePos(new BlockPos(2, 1, 2)), AncientSignals.Kind.MECHANISM));
        h.succeedWhen(() -> h.assertTrue(h.getBlockState(C).getValue(AncientEventSensorBlock.POWER) > 0, "sensor pulses on mechanism signal"));
    }

    static void reactorFiniteCharge(GameTestHelper h) {
        h.setBlock(C.below(), Blocks.REDSTONE_BLOCK);
        h.setBlock(C, ModBlocks.ANCIENT_ENERGY_REACTOR.get());
        var reactor = h.getBlockEntity(C, AncientEnergyReactorBlockEntity.class);
        h.assertTrue(reactor.insertFuel(new ItemStack(Items.DIAMOND)) == 0, "non-fuel rejected");
        h.assertTrue(reactor.insertFuel(new ItemStack(ModItems.RUBY.get(), 1)) == 1, "ruby accepted");
        h.runAfterDelay(30, () -> {
            h.assertTrue(reactor.getCharge() < 200 && reactor.getCharge() > 0, "charge is being spent: " + reactor.getCharge());
            h.assertTrue(h.getBlockState(C).getValue(AncientEnergyReactorBlock.PHASE) == ReactorPhase.ACTIVE, "reactor active");
        });
        // 200 charge / 10 per pulse / 20 ticks per pulse -> empty after ~400 ticks; we only verify bounded spend here.
        h.runAfterDelay(110, h::succeed);
    }

    static void runicAndGate(GameTestHelper h) {
        BlockPos dev = C;
        // FACING = SOUTH: back input south, output north, left = west, right = east.
        h.setBlock(dev, ModBlocks.RUNIC_LOGIC_DEVICE.get().defaultBlockState().setValue(RunicLogicDeviceBlock.FACING, Direction.SOUTH)
                .setValue(RunicLogicDeviceBlock.MODE, RunicMode.AND));
        h.setBlock(dev.west(), Blocks.REDSTONE_BLOCK);
        h.runAfterDelay(4, () -> {
            h.assertFalse(h.getBlockState(dev).getValue(RunicLogicDeviceBlock.POWERED), "one input is not enough");
            h.setBlock(dev.east(), Blocks.REDSTONE_BLOCK);
        });
        h.runAfterDelay(10, () -> {
            h.assertTrue(h.getBlockState(dev).getValue(RunicLogicDeviceBlock.POWERED), "both inputs power the output");
            h.setBlock(dev.west(), Blocks.AIR);
        });
        h.runAfterDelay(16, () -> {
            h.assertFalse(h.getBlockState(dev).getValue(RunicLogicDeviceBlock.POWERED), "output drops when an input drops");
            h.succeed();
        });
    }

    static void runicSequence(GameTestHelper h) {
        BlockPos dev = C;
        h.setBlock(dev, ModBlocks.RUNIC_LOGIC_DEVICE.get().defaultBlockState().setValue(RunicLogicDeviceBlock.FACING, Direction.SOUTH)
                .setValue(RunicLogicDeviceBlock.MODE, RunicMode.SEQUENCE));
        h.runAfterDelay(2, () -> h.setBlock(dev.west(), Blocks.REDSTONE_BLOCK));   // left
        h.runAfterDelay(6, () -> h.setBlock(dev.south(), Blocks.REDSTONE_BLOCK));  // back
        h.runAfterDelay(10, () -> {
            h.assertFalse(h.getBlockState(dev).getValue(RunicLogicDeviceBlock.POWERED), "incomplete sequence does not fire");
            h.setBlock(dev.east(), Blocks.REDSTONE_BLOCK);                         // right
        });
        h.succeedWhen(() -> h.assertTrue(h.getBlockState(dev).getValue(RunicLogicDeviceBlock.POWERED), "correct sequence pulses the output"));
    }

    static void secretDoorGroup(GameTestHelper h) {
        h.setBlock(C, ModBlocks.ANCIENT_SECRET_DOOR.get());
        h.setBlock(C.above(), ModBlocks.ANCIENT_SECRET_DOOR.get());
        h.runAfterDelay(2, () -> h.setBlock(C.east(), Blocks.REDSTONE_BLOCK));
        h.succeedWhen(() -> {
            h.assertTrue(h.getBlockState(C).getValue(AncientSecretDoorBlock.OPEN), "powered segment opens");
            h.assertTrue(h.getBlockState(C.above()).getValue(AncientSecretDoorBlock.OPEN), "connected segment opens with it");
        });
    }

    static void dartTrapFiresOnce(GameTestHelper h) {
        h.setBlock(C, ModBlocks.DART_TRAP.get().defaultBlockState().setValue(com.lostfeatures.block.DartTrapBlock.FACING, Direction.UP));
        h.runAfterDelay(2, () -> h.setBlock(C.east(), Blocks.REDSTONE_BLOCK));
        h.runAfterDelay(8, () -> {
            var arrows = h.getLevel().getEntitiesOfClass(Arrow.class, new AABB(h.absolutePos(C)).inflate(16));
            h.assertTrue(arrows.size() == 1, "exactly one dart per rising edge, found " + arrows.size());
            h.assertTrue(arrows.get(0).pickup == net.minecraft.world.entity.projectile.arrow.AbstractArrow.Pickup.CREATIVE_ONLY,
                    "darts cannot be picked up");
            h.succeed();
        });
    }

    static void spikeTrapDamages(GameTestHelper h) {
        h.setBlock(C, ModBlocks.SPIKE_TRAP.get());
        var zombie = h.spawn(EntityTypes.ZOMBIE, C);
        zombie.setNoAi(true);
        float start = zombie.getHealth();
        h.runAfterDelay(2, () -> h.setBlock(C.east(), Blocks.REDSTONE_BLOCK));
        h.succeedWhen(() -> {
            h.assertTrue(h.getBlockState(C).getValue(SpikeTrapBlock.EXTENDED), "spikes extend when powered");
            h.assertTrue(zombie.getHealth() < start, "standing on extended spikes hurts");
        });
    }

    static void lockedChestUnlocks(GameTestHelper h) {
        h.setBlock(C, ModBlocks.LOCKED_CHEST.get());
        h.getBlockEntity(C, LockedChestBlockEntity.class).setLootTable(ModStructures.LOOT_LOCKED_ANCIENT, 42L);
        Player player = h.makeMockServerPlayer(GameType.SURVIVAL);
        player.setItemInHand(InteractionHand.MAIN_HAND, new ItemStack(ModItems.ANCIENT_KEY.get()));
        h.useBlock(C, player);
        h.assertTrue(h.getBlockState(C).is(Blocks.CHEST), "locked chest became a vanilla chest");
        h.assertTrue(player.getMainHandItem().isEmpty(), "key consumed");
        h.succeed();
    }

    // ------------------------------------------------------------------ items and story

    static void quiverSuppliesBow(GameTestHelper h) {
        Player player = h.makeMockServerPlayer(GameType.SURVIVAL);
        ItemStack quiver = new ItemStack(ModItems.QUIVER.get());
        QuiverItem.setContents(quiver, QuiverContents.of(new ItemStack(Items.ARROW), 10));
        player.getInventory().setItem(9, quiver);
        ItemStack bow = new ItemStack(Items.BOW);
        player.setItemInHand(InteractionHand.MAIN_HAND, bow);
        ItemStack ammo = player.getProjectile(bow);
        h.assertTrue(ammo.is(Items.ARROW), "quiver supplies arrows when the inventory has none");
        ammo.shrink(1); // what vanilla does when firing
        h.runAfterDelay(2, () -> {
            h.assertTrue(QuiverItem.contents(quiver).count() == 9, "one arrow removed from the quiver, found " + QuiverItem.contents(quiver).count());
            h.succeed();
        });
    }

    static void storyIdempotentRewards(GameTestHelper h) {
        ServerPlayer player = (ServerPlayer) h.makeMockServerPlayer(GameType.SURVIVAL);
        h.assertTrue(StoryEvents.unlock(player, Milestone.ANCIENT_SITE), "first unlock succeeds");
        h.assertFalse(StoryEvents.unlock(player, Milestone.ANCIENT_SITE), "second unlock is a no-op");
        int keys = player.getInventory().countItem(ModItems.ANCIENT_KEY.get());
        h.assertTrue(keys == 1, "reward granted exactly once, found " + keys);
        h.assertTrue(StoryProgress.get(h.getLevel().getServer()).has(player.getUUID(), Milestone.ANCIENT_SITE), "milestone persisted in saved data");
        h.succeed();
    }

    static void creativeSpawnNoProgress(GameTestHelper h) {
        ServerPlayer player = (ServerPlayer) h.makeMockServerPlayer(GameType.SURVIVAL);
        LostGiant giant = h.spawn(ModEntities.GIANT.get(), C, EntitySpawnReason.SPAWN_ITEM_USE);
        CreatureOrigin.record(giant, EntitySpawnReason.SPAWN_ITEM_USE);
        h.assertTrue(CreatureOrigin.isCreative(giant), "spawn egg origin recorded");
        StoryEvents.onLostMobDefeated(player, giant);
        h.assertFalse(StoryProgress.get(h.getLevel().getServer()).has(player.getUUID(), Milestone.GIANT_DEFEATED),
                "creative-spawned kills do not grant story progress");
        giant.discard();
        h.succeed();
    }

    // ------------------------------------------------------------------ entities

    static void redDragonFlightAndPersistence(GameTestHelper h) {
        RedDragon dragon = h.spawn(ModEntities.RED_DRAGON.get(), C.above(2));
        dragon.makeAncestral();
        dragon.beginAirborne();
        h.runAfterDelay(20, () -> {
            h.assertTrue(dragon.isAlive(), "dragon alive");
            h.assertTrue(dragon.isFlying(), "dragon in flight mode");
            var output = net.minecraft.world.level.storage.TagValueOutput.createWithContext(net.minecraft.util.ProblemReporter.DISCARDING,
                    h.getLevel().registryAccess());
            dragon.saveWithoutId(output);
            RedDragon copy = ModEntities.RED_DRAGON.get().create(h.getLevel(), EntitySpawnReason.LOAD);
            copy.load(net.minecraft.world.level.storage.TagValueInput.create(net.minecraft.util.ProblemReporter.DISCARDING,
                    h.getLevel().registryAccess(), output.buildResult()));
            h.assertTrue(copy.isAncestral(), "ancestral flag survives save/reload");
            h.assertTrue(copy.isFlying(), "flight state survives save/reload");
            dragon.discard();
            h.succeed();
        });
    }

    static void relationshipGoalsInjected(GameTestHelper h) {
        h.assertTrue(RelationshipRules.get(LostFeatures.id("prey_fear_red_dragon")) != null, "default relationship rules loaded");
        Cow cow = h.spawn(EntityTypes.COW, C);
        boolean hasAvoid = cow.goalSelector.getAvailableGoals().stream()
                .anyMatch(g -> g.getGoal() instanceof net.minecraft.world.entity.ai.goal.AvoidEntityGoal<?>);
        h.assertTrue(hasAvoid, "cow received a fear goal from the data-driven rules");
        h.succeed();
    }

    static void eventMemoryBounded(GameTestHelper h) {
        EventMemory memory = EventMemory.get(h.getLevel());
        for (int i = 0; i < 400; i++) {
            memory.record(EventMemory.Type.PREDATOR_ATTACK, h.absolutePos(C), "test_" + i);
        }
        h.assertTrue(memory.size() <= com.lostfeatures.config.LFConfig.MEMORY_MAX_RECORDS.getAsInt(), "memory is capped: " + memory.size());
        h.succeed();
    }

    static void ancientDisturbanceLifecycle(GameTestHelper h) {
        ServerPlayer player = (ServerPlayer) h.makeMockServerPlayer(GameType.SURVIVAL);
        player.snapTo(h.absolutePos(C).getX() + 0.5, h.absolutePos(C).getY(), h.absolutePos(C).getZ() + 0.5, 0, 0);
        EncounterDirector director = EncounterDirector.get(h.getLevel());
        ActiveEvent event = director.tryStart(h.getLevel(), player, EventType.ANCIENT_DISTURBANCE, true);
        h.assertTrue(event != null, "forced disturbance starts at a loaded location");
        h.succeedWhen(() -> h.assertTrue(event.stage() == EventStage.DONE || !director.events().contains(event),
                "event reaches DONE and is cleaned up (stage " + event.stage() + ")"));
    }

    /** The dragon must show the charging state (jaw/smoke/roar) before any fire damage is dealt. */
    static void dragonBreathTelegraphed(GameTestHelper h) {
        RedDragon dragon = h.spawn(ModEntities.RED_DRAGON.get(), new BlockPos(1, 1, 4));
        var target = h.spawn(EntityTypes.IRON_GOLEM, new BlockPos(7, 1, 4));
        target.setNoAi(true);
        float start = target.getHealth();
        boolean[] sawCharge = {false};
        boolean[] damagedBeforeCharge = {false};
        h.onEachTick(() -> {
            if (dragon.isAlive() && target.isAlive()) {
                dragon.setTarget(target);
            }
            if (dragon.getBreathState() == 1) {
                sawCharge[0] = true;
            }
            // Bites may land at any time; fire must never land before the breath telegraph.
            if (!sawCharge[0] && target.getRemainingFireTicks() > 0) {
                damagedBeforeCharge[0] = true;
            }
        });
        h.succeedWhen(() -> {
            h.assertFalse(damagedBeforeCharge[0], "no fire before the telegraph");
            h.assertTrue(sawCharge[0], "breath charge (telegraph) observed");
            h.assertTrue(!target.isAlive() || target.getHealth() < start, "target took damage");
        });
    }

    /** The Giant raises its arms (synched windup) before the slam lands. */
    static void giantSlamAfterWindup(GameTestHelper h) {
        LostGiant giant = h.spawn(ModEntities.GIANT.get(), new BlockPos(1, 1, 1));
        var golem = h.spawn(EntityTypes.IRON_GOLEM, new BlockPos(5, 1, 5));
        golem.setNoAi(true);
        float start = golem.getHealth();
        boolean[] sawWindup = {false};
        h.onEachTick(() -> {
            if (giant.isAlive() && golem.isAlive()) {
                giant.setTarget(golem);
            }
            if (giant.getWindup() > 0) {
                sawWindup[0] = true;
            }
        });
        h.succeedWhen(() -> {
            h.assertTrue(sawWindup[0], "windup observed");
            h.assertTrue(golem.getHealth() < start, "golem damaged by the slam/attacks");
        });
    }

    /** Builds every structure kind well away from the test template and checks its signature blocks. */
    static void structuresBuild(GameTestHelper h) {
        var level = h.getLevel();
        BlockPos base = h.absolutePos(C).offset(0, 30, 200);
        int i = 0;
        for (var kind : com.lostfeatures.world.structure.StructureKind.values()) {
            BlockPos origin = base.offset(i++ * 64, 0, 0);
            var piece = new com.lostfeatures.world.structure.AncientPiece(kind, origin, 1234L + i);
            var box = piece.getBoundingBox();
            piece.postProcess(level, level.structureManager(), level.getChunkSource().getGenerator(), level.getRandom(), box,
                    net.minecraft.world.level.ChunkPos.containing(origin), origin);
            net.minecraft.world.level.block.Block signature = switch (kind) {
                case BRICK_PYRAMID -> Blocks.BRICKS;
                case STARTING_HOUSE -> Blocks.OAK_PLANKS;
                case OBSIDIAN_WALL -> Blocks.OBSIDIAN;
                case GLASS_PILLAR -> Blocks.GLASS;
                case MONOLITH -> Blocks.STONE;
                case ANCIENT_RUINS -> ModBlocks.RUNIC_LOGIC_DEVICE.get();
                case DRAGON_LAIR -> ModBlocks.ANCIENT_ALTAR.get();
            };
            boolean found = false;
            boolean chest = false;
            for (BlockPos p : BlockPos.betweenClosed(box.minX(), box.minY(), box.minZ(), box.maxX(), box.maxY(), box.maxZ())) {
                var state = level.getBlockState(p);
                found |= state.is(signature);
                chest |= state.is(Blocks.CHEST) || state.is(ModBlocks.LOCKED_CHEST.get());
            }
            h.assertTrue(found, kind.getSerializedName() + " contains its signature block");
            if (kind != com.lostfeatures.world.structure.StructureKind.OBSIDIAN_WALL) {
                h.assertTrue(chest, kind.getSerializedName() + " contains loot");
            }
        }
        level.getEntitiesOfClass(RedDragon.class, new AABB(base).inflate(600, 80, 100)).forEach(net.minecraft.world.entity.Entity::discard);
        h.succeed();
    }

    static void farLandsDensityBounded(GameTestHelper h) {
        double min = Double.MAX_VALUE;
        double max = -Double.MAX_VALUE;
        for (int x = -400; x <= 400; x += 37) {
            for (int y = -64; y <= 320; y += 16) {
                double d = FarLandsDensity.INSTANCE.sample(x, y, x * 0.7);
                h.assertTrue(Double.isFinite(d), "density finite");
                min = Math.min(min, d);
                max = Math.max(max, d);
            }
        }
        h.assertTrue(min < 0 && max > 0, "density produces both air and solid");
        h.assertTrue(FarLandsDensity.INSTANCE.sample(0, 319, 0) < 0, "open sky at the top of the world");
        h.succeed();
    }
}
