package com.lostfeatures.config;

import com.lostfeatures.LostFeatures;
import com.mojang.serialization.Codec;
import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.neoforged.neoforge.common.conditions.ICondition;

/**
 * Datapack condition {@code {"type": "lostfeatures:config_enabled", "key": "ruby_generation"}}.
 * Used on biome modifiers and structure sets so that disabling a world-generation option in the
 * config simply removes that datapack entry - no registry references are left dangling.
 */
public record ConfigEnabledCondition(String key) implements ICondition {
    public static final MapCodec<ConfigEnabledCondition> CODEC = RecordCodecBuilder.mapCodec(i -> i.group(
            Codec.STRING.fieldOf("key").forGetter(ConfigEnabledCondition::key)
    ).apply(i, ConfigEnabledCondition::new));

    @Override
    public boolean test(IContext context) {
        try {
            return LFConfig.flag(key);
        } catch (IllegalStateException notLoaded) {
            LostFeatures.LOGGER.debug("Config not loaded while testing condition {}; using default (enabled)", key);
            return true;
        }
    }

    @Override
    public MapCodec<? extends ICondition> codec() {
        return CODEC;
    }
}
