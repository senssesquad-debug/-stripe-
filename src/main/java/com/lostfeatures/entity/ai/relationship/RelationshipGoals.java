package com.lostfeatures.entity.ai.relationship;

import com.lostfeatures.config.LFConfig;
import net.minecraft.core.Holder;
import net.minecraft.resources.Identifier;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.entity.EntitySelector;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.entity.OwnableEntity;
import net.minecraft.world.entity.PathfinderMob;
import net.minecraft.world.entity.TamableAnimal;
import net.minecraft.world.entity.ai.goal.AvoidEntityGoal;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.projectile.Projectile;
import net.minecraft.world.entity.projectile.throwableitemprojectile.ThrownSplashPotion;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.alchemy.PotionContents;
import net.minecraft.world.item.alchemy.Potion;
import net.minecraft.world.item.alchemy.Potions;
import net.minecraft.world.phys.AABB;
import org.jspecify.annotations.Nullable;

import java.util.EnumSet;
import java.util.List;

/** Reusable goals driven by {@link RelationshipRule}s. Every goal re-checks its rule before acting. */
public final class RelationshipGoals {
    private RelationshipGoals() {
    }

    static @Nullable RelationshipRule live(Identifier ruleId, Mob mob) {
        if (!LFConfig.RELATIONSHIPS_ENABLED.getAsBoolean()) {
            return null;
        }
        RelationshipRule rule = RelationshipRules.get(ruleId);
        if (rule == null || !conditionHolds(rule.condition(), mob)) {
            return null;
        }
        return rule;
    }

    static boolean conditionHolds(RelationshipRule.Condition condition, Mob mob) {
        return switch (condition) {
            case ALWAYS -> true;
            case TAMED -> mob instanceof TamableAnimal t && t.isTame();
            case UNTAMED -> !(mob instanceof TamableAnimal t) || !t.isTame();
            case NIGHT -> mob.level().isDarkOutside();
            case DAY -> !mob.level().isDarkOutside();
        };
    }

    static float range(RelationshipRule rule) {
        return (float) (rule.range() * LFConfig.RELATIONSHIP_INTENSITY.get());
    }

    /** FEAR: flee from matching entities. */
    public static Goal fear(PathfinderMob mob, Identifier ruleId, RelationshipRule initial) {
        return new AvoidEntityGoal<>(mob, LivingEntity.class, target -> {
            RelationshipRule rule = live(ruleId, mob);
            return rule != null && rule.target().matches(target) && target.distanceTo(mob) <= range(rule);
        }, Math.max(initial.range(), 4.0F) * 1.5F, initial.speed() * 0.85, initial.speed(), EntitySelector.NO_CREATIVE_OR_SPECTATOR::test);
    }

    /** PREDATOR / ENEMY: target matching entities. */
    public static Goal attack(Mob mob, Identifier ruleId) {
        return new NearestAttackableTargetGoal<>(mob, LivingEntity.class, 20, true, false, (target, level) -> {
            RelationshipRule rule = live(ruleId, mob);
            return rule != null && rule.target().matches(target) && target.distanceTo(mob) <= range(rule);
        });
    }

    /** PROTECT_OWNER: target matching entities that come close to this mob's owner. */
    public static Goal protectOwner(Mob mob, Identifier ruleId) {
        return new NearestAttackableTargetGoal<>(mob, LivingEntity.class, 20, false, false, (target, level) -> {
            RelationshipRule rule = live(ruleId, mob);
            if (rule == null || !(mob instanceof OwnableEntity ownable) || !rule.target().matches(target)) {
                return false;
            }
            LivingEntity owner = ownable.getOwner();
            return owner != null && owner.distanceTo(target) <= range(rule);
        });
    }

    /** SUPPORT: throw a regeneration potion at a hurt matching ally, with a cooldown. */
    public static Goal support(PathfinderMob mob, Identifier ruleId) {
        return new SupportGoal(mob, ruleId);
    }

    /** ESCORT: keep within a few blocks of the nearest matching leader. */
    public static Goal escort(PathfinderMob mob, Identifier ruleId) {
        return new EscortGoal(mob, ruleId);
    }

    private static final class SupportGoal extends Goal {
        private final PathfinderMob mob;
        private final Identifier ruleId;
        private int cooldown;
        private @Nullable LivingEntity ally;

        SupportGoal(PathfinderMob mob, Identifier ruleId) {
            this.mob = mob;
            this.ruleId = ruleId;
            setFlags(EnumSet.of(Flag.LOOK));
        }

        @Override
        public boolean canUse() {
            if (cooldown > 0) {
                cooldown--;
                return false;
            }
            RelationshipRule rule = live(ruleId, mob);
            if (rule == null || mob.getTarget() != null) {
                return false;
            }
            float r = range(rule);
            List<LivingEntity> allies = mob.level().getEntitiesOfClass(LivingEntity.class, new AABB(mob.blockPosition()).inflate(r),
                    e -> e != mob && e.isAlive() && rule.target().matches(e) && e.getHealth() < e.getMaxHealth() * 0.6F);
            ally = allies.isEmpty() ? null : allies.get(0);
            if (ally == null) {
                cooldown = 40;
            }
            return ally != null;
        }

        @Override
        public void start() {
            RelationshipRule rule = live(ruleId, mob);
            if (ally == null || rule == null || !(mob.level() instanceof ServerLevel level)) {
                return;
            }
            mob.getLookControl().setLookAt(ally);
            double dx = ally.getX() - mob.getX();
            double dy = ally.getEyeY() - 1.1 - mob.getEyeY();
            double dz = ally.getZ() - mob.getZ();
            double dist = Math.sqrt(dx * dx + dz * dz);
            Holder<Potion> potion = Potions.REGENERATION;
            Projectile.spawnProjectileUsingShoot(ThrownSplashPotion::new, level, PotionContents.createItemStack(Items.SPLASH_POTION, potion),
                    mob, dx, dy + dist * 0.2, dz, 0.75F, 8.0F);
            level.playSound(null, mob.blockPosition(), SoundEvents.WITCH_THROW, mob.getSoundSource(), 1.0F, 0.9F);
            cooldown = rule.cooldown();
        }

        @Override
        public boolean canContinueToUse() {
            return false;
        }
    }

    private static final class EscortGoal extends Goal {
        private final PathfinderMob mob;
        private final Identifier ruleId;
        private @Nullable LivingEntity leader;
        private int recheck;

        EscortGoal(PathfinderMob mob, Identifier ruleId) {
            this.mob = mob;
            this.ruleId = ruleId;
            setFlags(EnumSet.of(Flag.MOVE));
        }

        @Override
        public boolean canUse() {
            if (--recheck > 0 || mob.getTarget() != null) {
                return false;
            }
            recheck = 40;
            RelationshipRule rule = live(ruleId, mob);
            if (rule == null) {
                return false;
            }
            float r = range(rule);
            List<LivingEntity> leaders = mob.level().getEntitiesOfClass(LivingEntity.class, new AABB(mob.blockPosition()).inflate(r),
                    e -> e.isAlive() && rule.target().matches(e));
            leader = leaders.isEmpty() ? null : leaders.get(0);
            return leader != null && mob.distanceToSqr(leader) > 36.0;
        }

        @Override
        public void start() {
            RelationshipRule rule = live(ruleId, mob);
            if (leader != null && rule != null) {
                mob.getNavigation().moveTo(leader, rule.speed());
            }
        }

        @Override
        public boolean canContinueToUse() {
            return leader != null && leader.isAlive() && mob.getTarget() == null && !mob.getNavigation().isDone() && mob.distanceToSqr(leader) > 25.0;
        }
    }
}
