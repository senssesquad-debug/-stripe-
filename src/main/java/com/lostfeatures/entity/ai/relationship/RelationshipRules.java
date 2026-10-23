package com.lostfeatures.entity.ai.relationship;

import com.lostfeatures.LostFeatures;
import net.minecraft.resources.FileToIdConverter;
import net.minecraft.resources.Identifier;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimpleJsonResourceReloadListener;
import net.minecraft.util.profiling.ProfilerFiller;

import java.util.Map;

/**
 * Datapack reload listener holding the active relationship rules. Goals hold only a rule id and look
 * the rule up on every use, so a {@code /reload} that removes or changes a rule takes effect on mobs
 * that are already loaded.
 */
public final class RelationshipRules extends SimpleJsonResourceReloadListener<RelationshipRule> {
    public static final Identifier ID = LostFeatures.id("relationships");
    private static volatile Map<Identifier, RelationshipRule> rules = Map.of();

    public RelationshipRules() {
        super(RelationshipRule.CODEC, FileToIdConverter.json("lostfeatures/relationships"));
    }

    @Override
    protected void apply(Map<Identifier, RelationshipRule> loaded, ResourceManager manager, ProfilerFiller profiler) {
        rules = Map.copyOf(loaded);
        LostFeatures.LOGGER.info("Loaded {} Lost Features relationship rules", loaded.size());
    }

    public static Map<Identifier, RelationshipRule> all() {
        return rules;
    }

    public static RelationshipRule get(Identifier id) {
        return rules.get(id);
    }
}
