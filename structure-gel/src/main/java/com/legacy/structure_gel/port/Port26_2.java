package com.legacy.structure_gel.port;

import java.util.Optional;

import org.jspecify.annotations.Nullable;

import net.minecraft.ChatFormatting;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Holder;
import net.minecraft.core.HolderGetter;
import net.minecraft.core.Registry;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.data.registries.VanillaRegistries;
import net.minecraft.data.tags.TagAppender;
import net.minecraft.data.worldgen.SurfaceRuleData;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.network.chat.TextColor;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityProcessor;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntitySpawnRequest;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.biome.Biome;
import net.minecraft.world.level.levelgen.SurfaceRules;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.server.ServerLifecycleHooks;

/**
 * Replacements for Minecraft 26.1.2 APIs that changed in 26.2. Calls to the old APIs in the
 * original bytecode are redirected here by the porter (see port.rules).
 */
@SuppressWarnings({ "unchecked", "rawtypes" })
public final class Port26_2 {
    private Port26_2() {
    }

    // Removed helpers

    public static Vec3 BlockPos_getCenter(BlockPos pos) {
        return Vec3.atCenterOf(pos);
    }

    public static @Nullable Integer ChatFormatting_getColor(ChatFormatting format) {
        TextColor color = TextColor.fromLegacyFormat(format);
        return color == null ? null : color.getValue();
    }

    // Entity loading takes an EntitySpawnRequest instead of an EntitySpawnReason

    public static Optional<Entity> EntityType_create(ValueInput input, Level level, EntitySpawnReason reason) {
        return EntityType.create(input, level, new EntitySpawnRequest(reason, false));
    }

    public static @Nullable Entity EntityType_loadEntityRecursive(CompoundTag tag, Level level, EntitySpawnReason reason, EntityProcessor postLoad) {
        return EntityType.loadEntityRecursive(tag, level, new EntitySpawnRequest(reason, false), postLoad);
    }

    // The overworld surface rules need a biome lookup now

    public static SurfaceRules.RuleSource SurfaceRuleData_overworld() {
        return SurfaceRuleData.overworld(biomes());
    }

    public static SurfaceRules.RuleSource SurfaceRuleData_overworldLike(boolean doPreliminarySurfaceCheck, boolean bedrockRoof, boolean bedrockFloor) {
        return SurfaceRuleData.overworldLike(biomes(), doPreliminarySurfaceCheck, bedrockRoof, bedrockFloor);
    }

    private static HolderGetter<Biome> biomes() {
        var server = ServerLifecycleHooks.getCurrentServer();
        if (server != null)
            return server.registryAccess().lookupOrThrow(Registries.BIOME);
        return VanillaRegistries.createLookup().lookupOrThrow(Registries.BIOME);
    }

    // Data generation: TagAppender only accepts ResourceKeys

    public static TagAppender TagAppender_add(TagAppender appender, Object[] elements) {
        for (Object element : elements)
            appender.add(toKey(element));
        return appender;
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
