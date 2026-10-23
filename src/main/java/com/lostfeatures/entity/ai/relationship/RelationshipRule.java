package com.lostfeatures.entity.ai.relationship;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.util.StringRepresentable;

/**
 * One data-driven relationship, loaded from {@code data/<namespace>/lostfeatures/relationships/*.json}.
 *
 * <pre>{
 *   "subject": "#lostfeatures:dragon_prey",
 *   "target": "lostfeatures:red_dragon",
 *   "relation": "fear",
 *   "range": 20, "priority": 1, "speed": 1.4,
 *   "condition": "always"
 * }</pre>
 */
public record RelationshipRule(EntityMatcher subject, EntityMatcher target, Relation relation, float range, int priority,
                               double speed, Condition condition, int cooldown) {
    public enum Condition implements StringRepresentable {
        ALWAYS("always"), TAMED("tamed"), UNTAMED("untamed"), NIGHT("night"), DAY("day");

        public static final Codec<Condition> CODEC = StringRepresentable.fromEnum(Condition::values);
        private final String name;

        Condition(String name) {
            this.name = name;
        }

        @Override
        public String getSerializedName() {
            return name;
        }
    }

    public static final Codec<RelationshipRule> CODEC = RecordCodecBuilder.create(i -> i.group(
            EntityMatcher.CODEC.fieldOf("subject").forGetter(RelationshipRule::subject),
            EntityMatcher.CODEC.fieldOf("target").forGetter(RelationshipRule::target),
            Relation.CODEC.fieldOf("relation").forGetter(RelationshipRule::relation),
            Codec.floatRange(1.0F, 64.0F).optionalFieldOf("range", 16.0F).forGetter(RelationshipRule::range),
            Codec.intRange(0, 10).optionalFieldOf("priority", 3).forGetter(RelationshipRule::priority),
            Codec.doubleRange(0.1, 3.0).optionalFieldOf("speed", 1.2).forGetter(RelationshipRule::speed),
            Condition.CODEC.optionalFieldOf("condition", Condition.ALWAYS).forGetter(RelationshipRule::condition),
            Codec.intRange(0, 24000).optionalFieldOf("cooldown", 200).forGetter(RelationshipRule::cooldown)
    ).apply(i, RelationshipRule::new));
}
