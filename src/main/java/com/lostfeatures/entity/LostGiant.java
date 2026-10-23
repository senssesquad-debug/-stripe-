package com.lostfeatures.entity;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModDamageTypes;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.registry.ModTags;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import com.lostfeatures.world.memory.EventMemory;
import net.minecraft.core.BlockPos;
import net.minecraft.core.UUIDUtil;
import net.minecraft.core.particles.BlockParticleOption;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
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
import net.minecraft.world.entity.ai.goal.Goal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.goal.target.HurtByTargetGoal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.animal.golem.IronGolem;
import net.minecraft.world.entity.monster.Monster;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.event.EventHooks;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * A functional Giant. Unlike the unused vanilla {@code minecraft:giant} (which has no AI and is left
 * untouched), this mod-owned creature lumbers toward targets, swipes at close range and performs a
 * telegraphed ground slam: it raises its arms for {@link #WINDUP_TICKS} ticks (synched for the
 * animation and accompanied by a windup sound) before striking, so players can always step away.
 */
public class LostGiant extends Monster {
    public static final int WINDUP_TICKS = 30;
    public static final double SLAM_RADIUS = 5.0;
    private static final EntityDataAccessor<Integer> DATA_WINDUP = SynchedEntityData.defineId(LostGiant.class, EntityDataSerializers.INT);

    private final LostCreatureLifecycle lifecycle = new LostCreatureLifecycle();
    private final Set<UUID> damagers = new LinkedHashSet<>();
    private int slamCooldown = 60;

    public LostGiant(EntityType<? extends LostGiant> type, Level level) {
        super(type, level);
        this.xpReward = 40;
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Monster.createMonsterAttributes()
                .add(Attributes.MAX_HEALTH, 220.0)
                .add(Attributes.MOVEMENT_SPEED, 0.22)
                .add(Attributes.ATTACK_DAMAGE, 10.0)
                .add(Attributes.ATTACK_KNOCKBACK, 1.5)
                .add(Attributes.KNOCKBACK_RESISTANCE, 1.0)
                .add(Attributes.ARMOR, 6.0)
                .add(Attributes.FOLLOW_RANGE, 40.0)
                .add(Attributes.STEP_HEIGHT, 2.0)
                .add(Attributes.CAMERA_DISTANCE, 16.0);
    }

    @Override
    protected void defineSynchedData(SynchedEntityData.Builder builder) {
        super.defineSynchedData(builder);
        builder.define(DATA_WINDUP, 0);
    }

    /** Ticks into the slam windup (0 when not winding up). Read by the client for the arm animation. */
    public int getWindup() {
        return entityData.get(DATA_WINDUP);
    }

    public LostCreatureLifecycle lifecycle() {
        return lifecycle;
    }

    @Override
    protected void registerGoals() {
        goalSelector.addGoal(0, new FloatGoal(this));
        goalSelector.addGoal(1, new GroundSlamGoal());
        goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.0, true) {
            @Override
            public boolean canUse() {
                return getWindup() == 0 && super.canUse();
            }
        });
        goalSelector.addGoal(6, new WaterAvoidingRandomStrollGoal(this, 0.7));
        goalSelector.addGoal(7, new LookAtPlayerGoal(this, Player.class, 16.0F));
        goalSelector.addGoal(8, new RandomLookAroundGoal(this));
        targetSelector.addGoal(1, new HurtByTargetGoal(this));
        targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Player.class, true));
        targetSelector.addGoal(3, new NearestAttackableTargetGoal<>(this, IronGolem.class, true));
    }

    @Override
    public @Nullable SpawnGroupData finalizeSpawn(ServerLevelAccessor level, DifficultyInstance difficulty, EntitySpawnReason reason,
                                                  @Nullable SpawnGroupData groupData) {
        CreatureOrigin.record(this, reason);
        getAttribute(Attributes.MAX_HEALTH).setBaseValue(LFConfig.GIANT_HEALTH.get());
        setHealth(getMaxHealth());
        return super.finalizeSpawn(level, difficulty, reason, groupData);
    }

    @Override
    protected void customServerAiStep(ServerLevel level) {
        super.customServerAiStep(level);
        if (slamCooldown > 0) {
            slamCooldown--;
        }
        if (lifecycle.tick(this)) {
            discard();
        }
    }

    @Override
    public boolean removeWhenFarAway(double distSqr) {
        return false;
    }

    private void performSlam(ServerLevel level) {
        Vec3 look = Vec3.directionFromRotation(0, getYRot());
        Vec3 center = position().add(look.scale(3.0));
        playSound(ModSounds.GIANT_SLAM.get(), 4.0F, 0.8F + random.nextFloat() * 0.2F);
        BlockState ground = level.getBlockState(BlockPos.containing(center).below());
        if (!ground.isAir()) {
            level.sendParticles(new BlockParticleOption(ParticleTypes.BLOCK, ground), center.x, center.y + 0.2, center.z, 80, 2.0, 0.2, 2.0, 0.15);
        }
        level.sendParticles(ParticleTypes.EXPLOSION, center.x, center.y + 0.5, center.z, 2, 1.0, 0.0, 1.0, 0.0);
        float damage = LFConfig.GIANT_SLAM_DAMAGE.get().floatValue();
        AABB box = new AABB(center, center).inflate(SLAM_RADIUS, 2.0, SLAM_RADIUS);
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, box, e -> e != this && e.isAlive() && !(e instanceof LostGiant))) {
            double d = e.position().distanceTo(center);
            if (d > SLAM_RADIUS) {
                continue;
            }
            float scaled = (float) (damage * (1.0 - 0.5 * d / SLAM_RADIUS));
            e.hurtServer(level, damageSources().source(ModDamageTypes.GIANT_SLAM, this), scaled);
            Vec3 push = e.position().subtract(center).multiply(1, 0, 1);
            if (push.lengthSqr() > 1.0E-4) {
                push = push.normalize().scale(0.9);
                e.push(push.x, 0.5, push.z);
                e.hurtMarked = true;
            }
        }
        if (LFConfig.GIANT_TERRAIN_INTERACTION.getAsBoolean() && EventHooks.canEntityGrief(level, this)) {
            int broken = 0;
            BlockPos c = BlockPos.containing(center);
            for (BlockPos p : BlockPos.betweenClosed(c.offset(-2, -1, -2), c.offset(2, 2, 2))) {
                if (broken >= 8) {
                    break;
                }
                if (level.getBlockState(p).is(ModTags.Blocks.GIANT_BREAKABLE)) {
                    level.destroyBlock(p, true, this);
                    broken++;
                }
            }
        }
        AncientSignals.post(level, blockPosition(), AncientSignals.Kind.CREATURE);
    }

    @Override
    public boolean hurtServer(ServerLevel level, DamageSource source, float damage) {
        if (source.getEntity() instanceof ServerPlayer player && damagers.size() < 32) {
            damagers.add(player.getUUID());
        }
        return super.hurtServer(level, source, damage);
    }

    @Override
    public void die(DamageSource source) {
        if (level() instanceof ServerLevel level && !isRemoved() && !dead) {
            if (source.getEntity() instanceof ServerPlayer killer) {
                damagers.add(killer.getUUID());
            }
            List<ServerPlayer> credited = new ArrayList<>();
            for (UUID id : damagers) {
                if (level.getPlayerByUUID(id) instanceof ServerPlayer p && p.distanceToSqr(this) < 128 * 128) {
                    credited.add(p);
                }
            }
            credited.forEach(p -> StoryEvents.onLostMobDefeated(p, this));
            EventMemory.get(level).record(EventMemory.Type.BOSS_ENCOUNTER, blockPosition(), "giant_defeated");
            AncientSignals.post(level, blockPosition(), AncientSignals.Kind.ENCOUNTER_END);
        }
        super.die(source);
    }

    @Override
    protected void addAdditionalSaveData(ValueOutput output) {
        super.addAdditionalSaveData(output);
        lifecycle.save(output);
        output.store("damagers", UUIDUtil.CODEC.listOf(), new ArrayList<>(damagers));
    }

    @Override
    protected void readAdditionalSaveData(ValueInput input) {
        super.readAdditionalSaveData(input);
        lifecycle.load(input);
        damagers.clear();
        input.read("damagers", UUIDUtil.CODEC.listOf()).ifPresent(damagers::addAll);
    }

    @Override
    protected @Nullable SoundEvent getAmbientSound() {
        return ModSounds.GIANT_AMBIENT.get();
    }

    @Override
    protected @Nullable SoundEvent getHurtSound(DamageSource source) {
        return ModSounds.GIANT_HURT.get();
    }

    @Override
    protected @Nullable SoundEvent getDeathSound() {
        return ModSounds.GIANT_DEATH.get();
    }

    @Override
    protected void playStepSound(BlockPos pos, BlockState state) {
        playSound(ModSounds.GIANT_STEP.get(), 1.5F, 0.8F + random.nextFloat() * 0.2F);
    }

    @Override
    protected float getSoundVolume() {
        return 2.5F;
    }

    @Override
    public int getAmbientSoundInterval() {
        return 200;
    }

    /** Windup (telegraph) then a radial slam in front of the Giant. */
    private class GroundSlamGoal extends Goal {
        private int ticks;

        GroundSlamGoal() {
            setFlags(EnumSet.of(Flag.MOVE, Flag.LOOK));
        }

        @Override
        public boolean canUse() {
            LivingEntity target = getTarget();
            return target != null && target.isAlive() && slamCooldown <= 0 && onGround() && distanceTo(target) < 7.5;
        }

        @Override
        public boolean canContinueToUse() {
            return ticks <= WINDUP_TICKS + 6 && isAlive();
        }

        @Override
        public void start() {
            ticks = 0;
            getNavigation().stop();
            playSound(ModSounds.GIANT_WINDUP.get(), 3.0F, 1.0F);
        }

        @Override
        public boolean requiresUpdateEveryTick() {
            return true;
        }

        @Override
        public void tick() {
            ticks++;
            LivingEntity target = getTarget();
            if (target != null && ticks < WINDUP_TICKS - 8) {
                getLookControl().setLookAt(target, 30.0F, 30.0F);
            }
            entityData.set(DATA_WINDUP, Math.min(ticks, WINDUP_TICKS));
            if (ticks == WINDUP_TICKS && level() instanceof ServerLevel level) {
                performSlam(level);
            }
        }

        @Override
        public void stop() {
            entityData.set(DATA_WINDUP, 0);
            slamCooldown = 80 + random.nextInt(60);
        }
    }
}
