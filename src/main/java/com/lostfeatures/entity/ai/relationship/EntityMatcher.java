package com.lostfeatures.entity.ai.relationship;

import com.mojang.serialization.Codec;
import com.mojang.serialization.DataResult;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.tags.TagKey;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntityType;

/** Matches an entity by type id ({@code minecraft:cow}) or entity type tag ({@code #lostfeatures:dragon_prey}). */
public record EntityMatcher(String raw, Identifier id, boolean isTag) {
    public static final Codec<EntityMatcher> CODEC = Codec.STRING.comapFlatMap(EntityMatcher::parse, EntityMatcher::raw);

    public static DataResult<EntityMatcher> parse(String s) {
        boolean tag = s.startsWith("#");
        Identifier id = Identifier.tryParse(tag ? s.substring(1) : s);
        if (id == null) {
            return DataResult.error(() -> "Invalid entity matcher: " + s);
        }
        return DataResult.success(new EntityMatcher(s, id, tag));
    }

    public boolean matches(Entity entity) {
        if (isTag) {
            return entity.is(TagKey.create(Registries.ENTITY_TYPE, id));
        }
        return BuiltInRegistries.ENTITY_TYPE.getKey(entity.getType()).equals(id);
    }

    public boolean matchesType(EntityType<?> type) {
        if (isTag) {
            return type.builtInRegistryHolder().is(TagKey.create(Registries.ENTITY_TYPE, id));
        }
        return BuiltInRegistries.ENTITY_TYPE.getKey(type).equals(id);
    }
}
