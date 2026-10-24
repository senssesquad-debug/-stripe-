package com.legacy.rediscovered.port;

import java.util.Optional;
import java.util.function.Consumer;

import org.jspecify.annotations.Nullable;

import com.legacy.rediscovered.entity.dragon.RedDragonOffspringEntity;

import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.data.tags.TagAppender;
import net.minecraft.network.chat.TextColor;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.tags.BlockItemTags;
import net.minecraft.tags.TagKey;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.PostSpawnProcessor;
import net.minecraft.world.entity.animal.equine.ZombieHorse;
import net.minecraft.world.item.DyeColor;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.alchemy.Potion;
import net.minecraft.world.item.alchemy.Potions;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.phys.Vec3;

/**
 * Replacements for Minecraft 26.1.2 APIs that changed in 26.2. Calls to the old APIs in the
 * original bytecode are redirected here by the porter (see port.rules).
 */
@SuppressWarnings({ "unchecked", "rawtypes" })
public final class Port26_2 {
    private Port26_2() {
    }

    // Dyed blocks and items are ColorCollections now

    public static Block Blocks_WHITE_WOOL_get() {
        return Blocks.WOOL.pick(DyeColor.WHITE);
    }

    public static Block Blocks_WHITE_CARPET_get() {
        return Blocks.CARPET.pick(DyeColor.WHITE);
    }

    public static Block Blocks_WHITE_CANDLE_get() {
        return Blocks.DYED_CANDLE.pick(DyeColor.WHITE);
    }

    public static Block Blocks_ORANGE_CANDLE_get() {
        return Blocks.DYED_CANDLE.pick(DyeColor.ORANGE);
    }

    public static Block Blocks_RED_CANDLE_get() {
        return Blocks.DYED_CANDLE.pick(DyeColor.RED);
    }

    public static Block Blocks_BLACK_CANDLE_get() {
        return Blocks.DYED_CANDLE.pick(DyeColor.BLACK);
    }

    public static Block Blocks_COPPER_BLOCK_get() {
        return Blocks.COPPER_BLOCK.weathering().unaffected();
    }

    public static Item Items_WHITE_WOOL_get() {
        return Items.WOOL.pick(DyeColor.WHITE);
    }

    public static Item Items_PINK_WOOL_get() {
        return Items.WOOL.pick(DyeColor.PINK);
    }

    public static Item Items_PINK_CARPET_get() {
        return Items.CARPET.pick(DyeColor.PINK);
    }

    public static Item Items_WHITE_DYE_get() {
        return Items.DYE.pick(DyeColor.WHITE);
    }

    public static Item Items_ORANGE_DYE_get() {
        return Items.DYE.pick(DyeColor.ORANGE);
    }

    public static Item Items_PINK_DYE_get() {
        return Items.DYE.pick(DyeColor.PINK);
    }

    public static Item Items_RED_DYE_get() {
        return Items.DYE.pick(DyeColor.RED);
    }

    public static Item Items_CYAN_DYE_get() {
        return Items.DYE.pick(DyeColor.CYAN);
    }

    public static Item Items_CYAN_CANDLE_get() {
        return Items.DYED_CANDLE.pick(DyeColor.CYAN);
    }

    public static Item Items_PINK_CANDLE_get() {
        return Items.DYED_CANDLE.pick(DyeColor.PINK);
    }

    public static Item Items_PURPLE_CANDLE_get() {
        return Items.DYED_CANDLE.pick(DyeColor.PURPLE);
    }

    public static Item Items_RED_CANDLE_get() {
        return Items.DYED_CANDLE.pick(DyeColor.RED);
    }

    public static Item Items_BLUE_STAINED_GLASS_PANE_get() {
        return Items.STAINED_GLASS_PANE.pick(DyeColor.BLUE);
    }

    public static Item Items_CYAN_STAINED_GLASS_PANE_get() {
        return Items.STAINED_GLASS_PANE.pick(DyeColor.CYAN);
    }

    public static Item Items_MAGENTA_STAINED_GLASS_PANE_get() {
        return Items.STAINED_GLASS_PANE.pick(DyeColor.MAGENTA);
    }

    public static Item Items_PINK_STAINED_GLASS_PANE_get() {
        return Items.STAINED_GLASS_PANE.pick(DyeColor.PINK);
    }

    public static Item Items_PURPLE_STAINED_GLASS_PANE_get() {
        return Items.STAINED_GLASS_PANE.pick(DyeColor.PURPLE);
    }

    public static Item Items_RED_STAINED_GLASS_PANE_get() {
        return Items.STAINED_GLASS_PANE.pick(DyeColor.RED);
    }

    public static Item Items_YELLOW_STAINED_GLASS_PANE_get() {
        return Items.STAINED_GLASS_PANE.pick(DyeColor.YELLOW);
    }

    // Shared block/item tags moved to BlockItemTags

    public static TagKey<Block> BlockTags_SAPLINGS_get() {
        return BlockItemTags.SAPLINGS.block();
    }

    public static TagKey<Item> ItemTags_COPPER_GOLEM_STATUES_get() {
        return BlockItemTags.COPPER_GOLEM_STATUES.item();
    }

    public static TagKey<Item> ItemTags_LANTERNS_get() {
        return BlockItemTags.LANTERNS.item();
    }

    public static TagKey<Item> ItemTags_SLABS_get() {
        return BlockItemTags.SLABS.item();
    }

    public static TagKey<Item> ItemTags_SMALL_FLOWERS_get() {
        return BlockItemTags.SMALL_FLOWERS.item();
    }

    public static TagKey<Item> ItemTags_STAIRS_get() {
        return BlockItemTags.STAIRS.item();
    }

    // Potions are declared as Holder instead of Holder.Reference

    public static Holder.Reference<Potion> Potions_AWKWARD_get() {
        return (Holder.Reference<Potion>) Potions.AWKWARD;
    }

    public static Holder.Reference<Potion> Potions_WEAKNESS_get() {
        return (Holder.Reference<Potion>) Potions.WEAKNESS;
    }

    // Removed helpers

    public static Vec3 BlockPos_getCenter(BlockPos pos) {
        return Vec3.atCenterOf(pos);
    }

    public static @Nullable Integer ChatFormatting_getColor(ChatFormatting format) {
        TextColor color = TextColor.fromLegacyFormat(format);
        return color == null ? null : color.getValue();
    }

    public static void ZombieHorse_setBodyArmorItem(ZombieHorse horse, ItemStack stack) {
        setBodyArmorItem(horse, stack);
    }

    public static void RedDragonOffspringEntity_setBodyArmorItem(RedDragonOffspringEntity dragon, ItemStack stack) {
        setBodyArmorItem(dragon, stack);
    }

    // Same as 26.1.2's Mob.setBodyArmorItem -> setItemSlotAndDropWhenKilled
    private static void setBodyArmorItem(Mob mob, ItemStack stack) {
        mob.setItemSlot(EquipmentSlot.BODY, stack);
        mob.setGuaranteedDrop(EquipmentSlot.BODY);
        mob.setPersistenceRequired();
    }

    // Entity spawning uses PostSpawnProcessor instead of Consumer

    public static @Nullable Entity EntityType_spawn(EntityType type, ServerLevel level, @Nullable Consumer config, BlockPos pos, EntitySpawnReason reason, boolean tryMoveDown, boolean movedUp) {
        return type.spawn(level, toProcessor(config), pos, reason, tryMoveDown, movedUp);
    }

    public static @Nullable Entity EntityType_create(EntityType type, ServerLevel level, @Nullable Consumer config, BlockPos pos, EntitySpawnReason reason, boolean tryMoveDown, boolean movedUp) {
        return type.create(level, toProcessor(config), pos, reason, tryMoveDown, movedUp);
    }

    public static Consumer EntityType_createDefaultStackConfig(Level level, ItemStack stack, @Nullable LivingEntity user) {
        PostSpawnProcessor processor = EntityType.createDefaultStackConfig(level, stack, user);
        return entity -> processor.apply((Entity) entity);
    }

    public static Consumer EntityType_appendDefaultStackConfig(Consumer config, Level level, ItemStack stack, @Nullable LivingEntity user) {
        PostSpawnProcessor processor = EntityType.appendDefaultStackConfig(toProcessor(config), level, stack, user);
        return entity -> processor.apply((Entity) entity);
    }

    private static @Nullable PostSpawnProcessor toProcessor(@Nullable Consumer config) {
        return config == null ? null : config::accept;
    }

    // Data generation: TagAppender only accepts ResourceKeys

    public static TagAppender TagAppender_add(TagAppender appender, Object element) {
        return appender.add(toKey(element));
    }

    public static TagAppender TagAppender_add(TagAppender appender, Object[] elements) {
        for (Object element : elements)
            appender.add(toKey(element));
        return appender;
    }

    public static TagAppender TagAppender_addOptional(TagAppender appender, Object element) {
        return appender.addOptional(toKey(element));
    }

    private static ResourceKey toKey(Object element) {
        if (element instanceof ResourceKey<?> key)
            return key;
        if (element instanceof Holder<?> holder)
            return holder.unwrapKey().orElseThrow();
        for (Registry<?> registry : BuiltInRegistries.REGISTRY) {
            Optional<ResourceKey> key = ((Registry) registry).getResourceKey(element);
            if (key.isPresent())
                return key.get();
        }
        throw new IllegalArgumentException("Unregistered tag element " + element);
    }
}
