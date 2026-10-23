package com.lostfeatures.entity;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.world.DifficultyInstance;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.SpawnGroupData;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.LeapAtTargetGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.goal.target.HurtByTargetGoal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.animal.wolf.Wolf;
import net.minecraft.world.entity.monster.Monster;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

/**
 * The Killer Bunny as its own creature ({@code lostfeatures:killer_bunny}). Vanilla rabbits,
 * including the vanilla "evil" rabbit variant, are not touched. It hops toward prey with short
 * jumps, growls once when it picks a target, and leaps at close range.
 */
public class KillerBunny extends Monster {
    private final LostCreatureLifecycle lifecycle = new LostCreatureLifecycle();
    private int hopCooldown;
    private @Nullable LivingEntity warnedTarget;

    public KillerBunny(EntityType<? extends KillerBunny> type, Level level) {
        super(type, level);
        this.xpReward = 15;
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Monster.createMonsterAttributes()
                .add(Attributes.MAX_HEALTH, 14.0)
                .add(Attributes.MOVEMENT_SPEED, 0.34)
                .add(Attributes.ATTACK_DAMAGE, 8.0)
                .add(Attributes.FOLLOW_RANGE, 24.0)
                .add(Attributes.ARMOR, 4.0);
    }

    public LostCreatureLifecycle lifecycle() {
        return lifecycle;
    }

    @Override
    protected void registerGoals() {
        goalSelector.addGoal(0, new FloatGoal(this));
        goalSelector.addGoal(2, new LeapAtTargetGoal(this, 0.45F));
        goalSelector.addGoal(3, new MeleeAttackGoal(this, 1.3, true));
        goalSelector.addGoal(6, new WaterAvoidingRandomStrollGoal(this, 0.8));
        goalSelector.addGoal(7, new LookAtPlayerGoal(this, Player.class, 8.0F));
        goalSelector.addGoal(8, new RandomLookAroundGoal(this));
        targetSelector.addGoal(1, new HurtByTargetGoal(this));
        targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Player.class, true));
        targetSelector.addGoal(3, new NearestAttackableTargetGoal<>(this, Wolf.class, true));
    }

    @Override
    public @Nullable SpawnGroupData finalizeSpawn(ServerLevelAccessor level, DifficultyInstance difficulty, EntitySpawnReason reason,
                                                  @Nullable SpawnGroupData groupData) {
        CreatureOrigin.record(this, reason);
        getAttribute(Attributes.ATTACK_DAMAGE).setBaseValue(LFConfig.KILLER_BUNNY_DAMAGE.get());
        return super.finalizeSpawn(level, difficulty, reason, groupData);
    }

    @Override
    protected void customServerAiStep(ServerLevel level) {
        super.customServerAiStep(level);
        LivingEntity target = getTarget();
        if (target != null && target != warnedTarget) {
            warnedTarget = target;
            playSound(ModSounds.KILLER_BUNNY_WARNING.get(), 1.0F, 1.0F);
            AncientSignals.post(level, blockPosition(), AncientSignals.Kind.CREATURE);
        }
        // Hop locomotion: small jumps while moving, like a rabbit but relentless.
        if (hopCooldown > 0) {
            hopCooldown--;
        } else if (onGround() && !getNavigation().isDone()) {
            Vec3 v = getDeltaMovement();
            setDeltaMovement(v.x * 1.6, 0.36, v.z * 1.6);
            needsSync = true;
            hopCooldown = 8 + random.nextInt(4);
            playSound(ModSounds.KILLER_BUNNY_HOP.get(), 0.4F, 1.0F + random.nextFloat() * 0.3F);
        }
        if (lifecycle.tick(this)) {
            discard();
        }
    }

    @Override
    public boolean doHurtTarget(ServerLevel level, net.minecraft.world.entity.Entity target) {
        boolean hit = super.doHurtTarget(level, target);
        if (hit) {
            playSound(ModSounds.KILLER_BUNNY_ATTACK.get(), 1.0F, 1.0F);
        }
        return hit;
    }

    @Override
    public void die(DamageSource source) {
        if (level() instanceof ServerLevel && !isRemoved() && !dead && source.getEntity() instanceof ServerPlayer killer) {
            StoryEvents.onLostMobDefeated(killer, this);
        }
        super.die(source);
    }

    @Override
    public boolean causeFallDamage(double fallDistance, float damageModifier, DamageSource damageSource) {
        return false;
    }

    @Override
    protected void addAdditionalSaveData(ValueOutput output) {
        super.addAdditionalSaveData(output);
        lifecycle.save(output);
    }

    @Override
    protected void readAdditionalSaveData(ValueInput input) {
        super.readAdditionalSaveData(input);
        lifecycle.load(input);
    }

    @Override
    protected @Nullable SoundEvent getAmbientSound() {
        return null;
    }

    @Override
    protected @Nullable SoundEvent getHurtSound(DamageSource source) {
        return ModSounds.KILLER_BUNNY_HURT.get();
    }

    @Override
    protected @Nullable SoundEvent getDeathSound() {
        return ModSounds.KILLER_BUNNY_DEATH.get();
    }

    @Override
    protected void playStepSound(BlockPos pos, BlockState state) {
        // Hops have their own sound; no footstep spam.
    }
}
