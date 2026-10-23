package com.lostfeatures.entity.ai.relationship;

import com.lostfeatures.LostFeatures;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.PathfinderMob;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.AddServerReloadListenersEvent;
import net.neoforged.neoforge.event.entity.EntityJoinLevelEvent;

import java.util.Map;

/**
 * Adds relationship goals to mobs whose type matches a rule's subject when they join a server level.
 * Goals are only <em>added</em>; vanilla goals are never removed or replaced, so mobs that match no rule
 * are completely unaffected and disabling the feature makes every injected goal inert.
 */
@EventBusSubscriber(modid = LostFeatures.MOD_ID)
public final class RelationshipInjector {
    private RelationshipInjector() {
    }

    @SubscribeEvent
    public static void onReloadListeners(AddServerReloadListenersEvent event) {
        event.addListener(RelationshipRules.ID, new RelationshipRules());
    }

    @SubscribeEvent
    public static void onJoin(EntityJoinLevelEvent event) {
        if (event.getLevel().isClientSide() || !(event.getEntity() instanceof Mob mob)) {
            return;
        }
        for (Map.Entry<Identifier, RelationshipRule> entry : RelationshipRules.all().entrySet()) {
            RelationshipRule rule = entry.getValue();
            if (!rule.subject().matches(mob)) {
                continue;
            }
            Identifier id = entry.getKey();
            int p = rule.priority();
            switch (rule.relation()) {
                case FEAR -> {
                    if (mob instanceof PathfinderMob pm) mob.goalSelector.addGoal(p, RelationshipGoals.fear(pm, id, rule));
                }
                case PREDATOR, ENEMY -> mob.targetSelector.addGoal(p, RelationshipGoals.attack(mob, id));
                case PROTECT_OWNER -> mob.targetSelector.addGoal(p, RelationshipGoals.protectOwner(mob, id));
                case SUPPORT -> {
                    if (mob instanceof PathfinderMob pm) mob.goalSelector.addGoal(p, RelationshipGoals.support(pm, id));
                }
                case ESCORT -> {
                    if (mob instanceof PathfinderMob pm) mob.goalSelector.addGoal(p, RelationshipGoals.escort(pm, id));
                }
                case NEUTRAL -> {
                }
            }
        }
    }
}
