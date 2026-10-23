package com.lostfeatures.entity;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import com.lostfeatures.world.memory.EventMemory;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.world.DifficultyInstance;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.effect.MobEffects;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.SpawnGroupData;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.monster.illager.Illusioner;
import net.minecraft.world.entity.monster.illager.SpellcasterIllager;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

import java.util.EnumSet;

/**
 * Lost Features' Illusioner. It is a separate entity type ({@code lostfeatures:illusioner}) that
 * reuses the vanilla Illusioner class for its proven mirror-image and bow behaviour, leaving the
 * vanilla {@code minecraft:illusioner} completely unchanged. Additions:
 * <ul>
 *     <li>Disorientation spell: brief Nausea + Slowness on any difficulty, configurable cooldown.</li>
 *     <li>Tactical blink: when cornered it repositions 6-10 blocks away (cooldown, telegraphed).</li>
 *     <li>Expedition leader flag for Illager Expedition events.</li>
 * </ul>
 * Counterplay: decoys share the real Illusioner's facing, its blink has a long cooldown and both
 * spells play distinct cast sounds before they land.
 */
public class LostIllusioner extends Illusioner {
    private final LostCreatureLifecycle lifecycle = new LostCreatureLifecycle();
    private int repositionCooldown = 60;
    private int disorientCooldown = 100;
    private boolean expeditionLeader;

    public LostIllusioner(EntityType<? extends LostIllusioner> type, Level level) {
        super(type, level);
        this.xpReward = 20;
    }

    public static AttributeSupplier.Builder createLostAttributes() {
        return Illusioner.createAttributes().add(Attributes.MAX_HEALTH, 48.0).add(Attributes.FOLLOW_RANGE, 24.0);
    }

    public LostCreatureLifecycle lifecycle() {
        return lifecycle;
    }

    public void setExpeditionLeader(boolean leader) {
        this.expeditionLeader = leader;
    }

    public boolean isExpeditionLeader() {
        return expeditionLeader;
    }

    @Override
    protected void registerGoals() {
        super.registerGoals();
        goalSelector.addGoal(2, new RepositionGoal());
        goalSelector.addGoal(5, new DisorientSpellGoal());
    }

    @Override
    public SpawnGroupData finalizeSpawn(ServerLevelAccessor level, DifficultyInstance difficulty, EntitySpawnReason reason,
                                        @Nullable SpawnGroupData groupData) {
        CreatureOrigin.record(this, reason);
        getAttribute(Attributes.MAX_HEALTH).setBaseValue(LFConfig.ILLUSIONER_HEALTH.get());
        setHealth(getMaxHealth());
        return super.finalizeSpawn(level, difficulty, reason, groupData);
    }

    @Override
    protected void customServerAiStep(ServerLevel level) {
        super.customServerAiStep(level);
        if (repositionCooldown > 0) repositionCooldown--;
        if (disorientCooldown > 0) disorientCooldown--;
        if (lifecycle.tick(this)) {
            discard();
        }
    }

    @Override
    public void performRangedAttack(LivingEntity target, float power) {
        super.performRangedAttack(target, power);
        playSound(ModSounds.ILLUSIONER_SHOOT.get(), 0.8F, 1.0F);
    }

    @Override
    public void die(DamageSource source) {
        if (level() instanceof ServerLevel level && !isRemoved() && !dead) {
            if (source.getEntity() instanceof ServerPlayer killer) {
                StoryEvents.onLostMobDefeated(killer, this);
            }
            if (expeditionLeader) {
                // The expedition's research notes are the clue players hunt for; always dropped once.
                spawnAtLocation(level, new net.minecraft.world.item.ItemStack(com.lostfeatures.registry.ModItems.ENCRYPTED_NOTES.get()));
            }
            EventMemory.get(level).record(EventMemory.Type.ILLAGER_EXPEDITION, blockPosition(), "illusioner_defeated");
            AncientSignals.post(level, blockPosition(), AncientSignals.Kind.ENCOUNTER_END);
        }
        super.die(source);
    }

    @Override
    protected void addAdditionalSaveData(ValueOutput output) {
        super.addAdditionalSaveData(output);
        lifecycle.save(output);
        output.putBoolean("expedition_leader", expeditionLeader);
    }

    @Override
    protected void readAdditionalSaveData(ValueInput input) {
        super.readAdditionalSaveData(input);
        lifecycle.load(input);
        expeditionLeader = input.getBooleanOr("expedition_leader", false);
    }

    @Override
    public boolean removeWhenFarAway(double distSqr) {
        return !expeditionLeader && super.removeWhenFarAway(distSqr);
    }

    @Override
    protected SoundEvent getAmbientSound() {
        return ModSounds.ILLUSIONER_AMBIENT.get();
    }

    @Override
    protected SoundEvent getHurtSound(DamageSource source) {
        return ModSounds.ILLUSIONER_HURT.get();
    }

    @Override
    protected SoundEvent getDeathSound() {
        return ModSounds.ILLUSIONER_DEATH.get();
    }

    @Override
    protected SoundEvent getCastingSoundEvent() {
        return ModSounds.ILLUSIONER_ILLUSION.get();
    }

    /** Short-range blink away from a target that closes in. */
    private class RepositionGoal extends Goal {
        RepositionGoal() {
            setFlags(EnumSet.of(Flag.MOVE));
        }

        @Override
        public boolean canUse() {
            LivingEntity target = getTarget();
            return target != null && repositionCooldown <= 0 && !isCastingSpell() && distanceToSqr(target) < 25.0;
        }

        @Override
        public void start() {
            if (!(level() instanceof ServerLevel level)) {
                return;
            }
            LivingEntity target = getTarget();
            Vec3 from = position();
            for (int attempt = 0; attempt < 12; attempt++) {
                double angle = random.nextDouble() * Math.PI * 2;
                double dist = 6 + random.nextDouble() * 4;
                double x = getX() + Math.cos(angle) * dist;
                double z = getZ() + Math.sin(angle) * dist;
                double y = getY() + random.nextInt(5) - 2;
                if (randomTeleport(x, y, z, false) && (target == null || hasLineOfSight(target))) {
                    level.sendParticles(ParticleTypes.CLOUD, from.x, from.y + 1, from.z, 20, 0.3, 0.6, 0.3, 0.02);
                    level.sendParticles(ParticleTypes.WITCH, getX(), getY() + 1, getZ(), 20, 0.3, 0.6, 0.3, 0.02);
                    playSound(ModSounds.ILLUSIONER_REPOSITION.get(), 1.0F, 1.0F);
                    break;
                }
            }
            repositionCooldown = LFConfig.ILLUSIONER_REPOSITION_COOLDOWN.getAsInt();
        }

        @Override
        public boolean canContinueToUse() {
            return false;
        }
    }

    /** Disorientation: Nausea + Slowness, telegraphed by the casting animation and sound. */
    private class DisorientSpellGoal extends SpellcasterIllager.SpellcasterUseSpellGoal {
        @Override
        public boolean canUse() {
            return getTarget() != null && disorientCooldown <= 0 && super.canUse();
        }

        @Override
        protected int getCastingTime() {
            return 30;
        }

        @Override
        protected int getCastingInterval() {
            return LFConfig.ILLUSIONER_BLINDNESS_COOLDOWN.getAsInt();
        }

        @Override
        protected void performSpellCasting() {
            LivingEntity target = getTarget();
            if (target != null && distanceToSqr(target) < 24 * 24) {
                target.addEffect(new MobEffectInstance(MobEffects.NAUSEA, 120), LostIllusioner.this);
                target.addEffect(new MobEffectInstance(MobEffects.SLOWNESS, 80, 0), LostIllusioner.this);
            }
            disorientCooldown = LFConfig.ILLUSIONER_BLINDNESS_COOLDOWN.getAsInt();
        }

        @Override
        protected @Nullable SoundEvent getSpellPrepareSound() {
            return ModSounds.ILLUSIONER_CAST.get();
        }

        @Override
        protected SpellcasterIllager.IllagerSpell getSpell() {
            return SpellcasterIllager.IllagerSpell.BLINDNESS;
        }
    }
}
