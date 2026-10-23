package com.lostfeatures.entity;

import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModDamageTypes;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.registry.ModTags;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import com.lostfeatures.world.memory.EventMemory;
import net.minecraft.core.BlockPos;
import net.minecraft.core.UUIDUtil;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.network.chat.Component;
import net.minecraft.network.syncher.EntityDataAccessor;
import net.minecraft.network.syncher.EntityDataSerializers;
import net.minecraft.network.syncher.SynchedEntityData;
import net.minecraft.server.level.ServerBossEvent;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.world.BossEvent;
import net.minecraft.world.DifficultyInstance;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.MoverType;
import net.minecraft.world.entity.SpawnGroupData;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.ai.goal.FloatGoal;
import net.minecraft.world.entity.ai.goal.LookAtPlayerGoal;
import net.minecraft.world.entity.ai.goal.MeleeAttackGoal;
import net.minecraft.world.entity.ai.goal.RandomLookAroundGoal;
import net.minecraft.world.entity.ai.goal.WaterAvoidingRandomStrollGoal;
import net.minecraft.world.entity.ai.goal.target.HurtByTargetGoal;
import net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal;
import net.minecraft.world.entity.animal.Animal;
import net.minecraft.world.entity.monster.Monster;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ServerLevelAccessor;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;
import net.neoforged.neoforge.event.EventHooks;
import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

/**
 * The Red Dragon: Notch's 2011 idea of a "slightly less dangerous" dragon that can land and does not
 * destroy terrain, implemented as an original creature. All behaviour is server-authoritative; the
 * client only reads synched flags for animation.
 *
 * <p>Movement modes: GROUND (vanilla navigation and goals), TAKEOFF, FLY (steered flight) and LAND.
 * Fire breath is always telegraphed by a warning roar and smoke for {@link #BREATH_CHARGE} ticks.</p>
 */
public class RedDragon extends Monster {
    public static final int BREATH_CHARGE = 16;
    public static final int BREATH_DURATION = 40;
    public static final double BREATH_RANGE = 12.0;
    private static final double BREATH_HALF_ANGLE_COS = Math.cos(Math.toRadians(25));
    private static final int MAX_DAMAGERS = 32;

    public enum Mode { GROUND, TAKEOFF, FLY, LAND }

    private static final EntityDataAccessor<Boolean> DATA_FLYING = SynchedEntityData.defineId(RedDragon.class, EntityDataSerializers.BOOLEAN);
    /** 0 = none, 1 = charging (telegraph), 2 = breathing. */
    private static final EntityDataAccessor<Integer> DATA_BREATH = SynchedEntityData.defineId(RedDragon.class, EntityDataSerializers.INT);
    private static final EntityDataAccessor<Boolean> DATA_ANCESTRAL = SynchedEntityData.defineId(RedDragon.class, EntityDataSerializers.BOOLEAN);
    private static final EntityDataAccessor<Integer> DATA_PHASE = SynchedEntityData.defineId(RedDragon.class, EntityDataSerializers.INT);

    private Mode mode = Mode.GROUND;
    private int modeTicks;
    private @Nullable Vec3 flightTarget;
    private float orbitAngle;
    private int breathTicks;
    private int breathCooldown = 60;
    private int buffetCooldown = 80;
    private int takeoffCooldown = 100;
    private int hungerCooldown = 1200;
    private int trespassTicks;
    private int warningCooldown;
    private int scorchedThisBreath;
    private int stuckTicks;
    private Vec3 lastProgressPos = Vec3.ZERO;
    private @Nullable BlockPos homePos;
    private boolean bossScaled;
    private final Set<UUID> damagers = new LinkedHashSet<>();
    private final LostCreatureLifecycle lifecycle = new LostCreatureLifecycle();
    private @Nullable ServerBossEvent bossEvent;

    public RedDragon(EntityType<? extends RedDragon> type, Level level) {
        super(type, level);
        this.xpReward = 50;
    }

    public static AttributeSupplier.Builder createAttributes() {
        return Monster.createMonsterAttributes()
                .add(Attributes.MAX_HEALTH, 160.0)
                .add(Attributes.MOVEMENT_SPEED, 0.28)
                .add(Attributes.FLYING_SPEED, 0.6)
                .add(Attributes.ATTACK_DAMAGE, 9.0)
                .add(Attributes.ATTACK_KNOCKBACK, 1.0)
                .add(Attributes.ARMOR, 8.0)
                .add(Attributes.KNOCKBACK_RESISTANCE, 0.8)
                .add(Attributes.FOLLOW_RANGE, 48.0)
                .add(Attributes.STEP_HEIGHT, 1.5);
    }

    // ------------------------------------------------------------------ synched state

    @Override
    protected void defineSynchedData(SynchedEntityData.Builder builder) {
        super.defineSynchedData(builder);
        builder.define(DATA_FLYING, false);
        builder.define(DATA_BREATH, 0);
        builder.define(DATA_ANCESTRAL, false);
        builder.define(DATA_PHASE, 1);
    }

    public boolean isFlying() {
        return entityData.get(DATA_FLYING);
    }

    private void setFlying(boolean flying) {
        entityData.set(DATA_FLYING, flying);
        setNoGravity(flying);
    }

    public int getBreathState() {
        return entityData.get(DATA_BREATH);
    }

    public boolean isAncestral() {
        return entityData.get(DATA_ANCESTRAL);
    }

    public int getPhase() {
        return entityData.get(DATA_PHASE);
    }

    public Mode getMode() {
        return mode;
    }

    /** Turns this dragon into the finale boss. Call before adding it to the level. */
    public void makeAncestral() {
        entityData.set(DATA_ANCESTRAL, true);
        getAttribute(Attributes.MAX_HEALTH).setBaseValue(LFConfig.DRAGON_BOSS_HEALTH.get());
        getAttribute(Attributes.SCALE).setBaseValue(1.5);
        getAttribute(Attributes.ATTACK_DAMAGE).setBaseValue(13.0);
        setHealth(getMaxHealth());
        setCustomName(Component.translatable("entity.lostfeatures.ancestral_red_dragon"));
        xpReward = 500;
        initBossEvent();
    }

    public void setHomePos(BlockPos pos) {
        this.homePos = pos.immutable();
    }

    public @Nullable BlockPos getHomePos() {
        return homePos;
    }

    public LostCreatureLifecycle lifecycle() {
        return lifecycle;
    }

    private void initBossEvent() {
        if (bossEvent == null && !level().isClientSide()) {
            bossEvent = new ServerBossEvent(getUUID(), getDisplayName(), BossEvent.BossBarColor.RED, BossEvent.BossBarOverlay.NOTCHED_10);
            bossEvent.setDarkenScreen(true);
        }
    }

    // ------------------------------------------------------------------ goals

    @Override
    protected void registerGoals() {
        goalSelector.addGoal(0, new FloatGoal(this));
        goalSelector.addGoal(2, new MeleeAttackGoal(this, 1.2, true) {
            @Override
            public boolean canUse() {
                return !isFlying() && getBreathState() == 0 && super.canUse();
            }

            @Override
            public boolean canContinueToUse() {
                return !isFlying() && getBreathState() == 0 && super.canContinueToUse();
            }
        });
        goalSelector.addGoal(6, new WaterAvoidingRandomStrollGoal(this, 0.8) {
            @Override
            public boolean canUse() {
                return !isFlying() && super.canUse();
            }
        });
        goalSelector.addGoal(7, new LookAtPlayerGoal(this, Player.class, 24.0F));
        goalSelector.addGoal(8, new RandomLookAroundGoal(this));

        targetSelector.addGoal(1, new HurtByTargetGoal(this, RedDragon.class));
        targetSelector.addGoal(2, new NearestAttackableTargetGoal<>(this, Player.class, 10, true, false,
                (target, level) -> isAncestral() || trespassTicks >= 100));
        targetSelector.addGoal(3, new NearestAttackableTargetGoal<>(this, Animal.class, 20, false, false,
                (target, level) -> hungerCooldown <= 0 && target.is(ModTags.Entities.DRAGON_PREY)));
    }

    // ------------------------------------------------------------------ spawning and persistence

    @Override
    public @Nullable SpawnGroupData finalizeSpawn(ServerLevelAccessor level, DifficultyInstance difficulty, EntitySpawnReason reason,
                                                  @Nullable SpawnGroupData groupData) {
        CreatureOrigin.record(this, reason);
        if (!isAncestral()) {
            getAttribute(Attributes.MAX_HEALTH).setBaseValue(LFConfig.DRAGON_HEALTH.get());
            setHealth(getMaxHealth());
        }
        if (homePos == null) {
            homePos = blockPosition();
        }
        return super.finalizeSpawn(level, difficulty, reason, groupData);
    }

    @Override
    protected void addAdditionalSaveData(ValueOutput output) {
        super.addAdditionalSaveData(output);
        output.putBoolean("flying", isFlying());
        output.putString("mode", mode.name());
        output.putBoolean("ancestral", isAncestral());
        output.putBoolean("boss_scaled", bossScaled);
        output.putInt("hunger", hungerCooldown);
        if (homePos != null) {
            output.store("home", BlockPos.CODEC, homePos);
        }
        output.store("damagers", UUIDUtil.CODEC.listOf(), new ArrayList<>(damagers));
        lifecycle.save(output);
    }

    @Override
    protected void readAdditionalSaveData(ValueInput input) {
        super.readAdditionalSaveData(input);
        entityData.set(DATA_ANCESTRAL, input.getBooleanOr("ancestral", false));
        setFlying(input.getBooleanOr("flying", false));
        try {
            mode = Mode.valueOf(input.getStringOr("mode", Mode.GROUND.name()));
        } catch (IllegalArgumentException e) {
            mode = Mode.GROUND;
        }
        if (mode == Mode.GROUND && isFlying()) {
            mode = Mode.LAND; // recover: never stay airborne without a flight mode
        }
        bossScaled = input.getBooleanOr("boss_scaled", false);
        hungerCooldown = input.getIntOr("hunger", 1200);
        homePos = input.read("home", BlockPos.CODEC).orElse(null);
        damagers.clear();
        input.read("damagers", UUIDUtil.CODEC.listOf()).ifPresent(damagers::addAll);
        lifecycle.load(input);
        if (isAncestral()) {
            initBossEvent();
        }
    }

    @Override
    public void setCustomName(@Nullable Component name) {
        super.setCustomName(name);
        if (bossEvent != null) {
            bossEvent.setName(getDisplayName());
        }
    }

    @Override
    public boolean removeWhenFarAway(double distSqr) {
        return false;
    }

    @Override
    public void startSeenByPlayer(ServerPlayer player) {
        super.startSeenByPlayer(player);
        if (bossEvent != null) {
            bossEvent.addPlayer(player);
        }
    }

    @Override
    public void stopSeenByPlayer(ServerPlayer player) {
        super.stopSeenByPlayer(player);
        if (bossEvent != null) {
            bossEvent.removePlayer(player);
        }
    }

    // ------------------------------------------------------------------ movement

    @Override
    public void travel(Vec3 input) {
        if (isFlying()) {
            move(MoverType.SELF, getDeltaMovement());
            setDeltaMovement(getDeltaMovement().scale(0.91));
            calculateEntityAnimation(false);
        } else {
            super.travel(input);
        }
    }

    @Override
    public boolean causeFallDamage(double fallDistance, float damageModifier, DamageSource damageSource) {
        return false;
    }

    private void steerTowards(Vec3 target, double maxSpeed) {
        Vec3 delta = target.subtract(position());
        double dist = delta.length();
        if (dist < 0.5) {
            setDeltaMovement(getDeltaMovement().scale(0.8));
            return;
        }
        Vec3 desired = delta.scale(Math.min(maxSpeed, dist * 0.08) / dist);
        Vec3 vel = getDeltaMovement().add(desired.subtract(getDeltaMovement()).scale(0.12));
        setDeltaMovement(vel);
        if (vel.horizontalDistanceSqr() > 0.002 && getBreathState() == 0) {
            float yaw = (float) (Mth.atan2(vel.z, vel.x) * Mth.RAD_TO_DEG) - 90.0F;
            setYRot(Mth.approachDegrees(getYRot(), yaw, 6.0F));
            yBodyRot = getYRot();
            yHeadRot = getYRot();
        }
    }

    private void faceTowards(Vec3 point) {
        Vec3 d = point.subtract(position());
        float yaw = (float) (Mth.atan2(d.z, d.x) * Mth.RAD_TO_DEG) - 90.0F;
        setYRot(Mth.approachDegrees(getYRot(), yaw, 10.0F));
        yBodyRot = getYRot();
        yHeadRot = getYRot();
        getLookControl().setLookAt(point.x, point.y, point.z);
    }

    private double groundY(ServerLevel level, double x, double z) {
        return level.getHeight(Heightmap.Types.MOTION_BLOCKING_NO_LEAVES, Mth.floor(x), Mth.floor(z));
    }

    // ------------------------------------------------------------------ main AI tick

    @Override
    protected void customServerAiStep(ServerLevel level) {
        super.customServerAiStep(level);

        if (lifecycle.tick(this)) {
            EventMemory.get(level).record(EventMemory.Type.DRAGON_SIGHTING, blockPosition(), "departed");
            discard();
            return;
        }
        if (isAncestral()) {
            tickBoss(level);
        }
        if (breathCooldown > 0) breathCooldown--;
        if (buffetCooldown > 0) buffetCooldown--;
        if (takeoffCooldown > 0) takeoffCooldown--;
        if (hungerCooldown > 0) hungerCooldown--;
        if (warningCooldown > 0) warningCooldown--;
        modeTicks++;

        tickTerritory(level);
        LivingEntity target = getTarget();
        if (target != null && !target.isAlive()) {
            setTarget(null);
            target = null;
        }

        switch (mode) {
            case GROUND -> tickGround(level, target);
            case TAKEOFF -> tickTakeoff(level);
            case FLY -> tickFly(level, target);
            case LAND -> tickLand(level);
        }
        tickBreath(level, target);
        if (isFlying() && tickCount % 18 == 0) {
            playSound(ModSounds.RED_DRAGON_FLAP.get(), 2.0F, 0.9F + random.nextFloat() * 0.2F);
        }
    }

    private void setMode(Mode next) {
        if (mode == next) {
            return;
        }
        mode = next;
        modeTicks = 0;
        stuckTicks = 0;
        lastProgressPos = position();
    }

    private void tickTerritory(ServerLevel level) {
        if (isAncestral() || tickCount % 10 != 0) {
            return;
        }
        Player nearest = level.getNearestPlayer(this, 24.0);
        if (nearest != null && !nearest.isCreative() && !nearest.isSpectator()) {
            if (trespassTicks == 0 && warningCooldown <= 0) {
                playSound(ModSounds.RED_DRAGON_WARNING.get(), 3.0F, 1.0F);
                warningCooldown = 400;
                EventMemory.get(level).record(EventMemory.Type.DRAGON_SIGHTING, blockPosition(), "warning");
                for (ServerPlayer p : level.getPlayers(p -> p.distanceToSqr(this) < 64 * 64)) {
                    StoryEvents.onDragonSighted(p, this);
                }
            }
            trespassTicks = Math.min(trespassTicks + 10, 400);
        } else {
            trespassTicks = Math.max(0, trespassTicks - 5);
        }
    }

    private void tickGround(ServerLevel level, @Nullable LivingEntity target) {
        if (isFlying()) {
            setFlying(false);
        }
        if (target != null) {
            double dist = distanceTo(target);
            // Wing buffet when crowded: telegraphed by a flap sound and pushes everyone back.
            if (dist < 5.0 && buffetCooldown <= 0) {
                wingBuffet(level);
            }
            // Ground breath at medium range.
            if (getBreathState() == 0 && breathCooldown <= 0 && dist < 10.0 && hasLineOfSight(target)) {
                startBreathCharge();
            }
            boolean wantsAir = dist > 16.0 || target.getY() > getY() + 5.0 || (isAncestral() && getPhase() >= 2);
            if (getNavigation().isDone() && dist > 3.0) {
                stuckTicks++;
            } else {
                stuckTicks = 0;
            }
            if (takeoffCooldown <= 0 && getBreathState() == 0 && (wantsAir || stuckTicks > 60)) {
                beginTakeoff();
            }
        } else if (takeoffCooldown <= 0 && random.nextInt(isAncestral() ? 200 : 1400) == 0) {
            beginTakeoff();
        }
    }

    private void beginTakeoff() {
        setMode(Mode.TAKEOFF);
        setFlying(true);
        getNavigation().stop();
        playSound(ModSounds.RED_DRAGON_TAKEOFF.get(), 3.0F, 1.0F);
    }

    private void tickTakeoff(ServerLevel level) {
        setDeltaMovement(getDeltaMovement().multiply(0.6, 0.0, 0.6).add(0, 0.28, 0));
        if (modeTicks > 22 || verticalCollision && modeTicks > 4) {
            setMode(Mode.FLY);
            flightTarget = null;
        }
    }

    private void tickFly(ServerLevel level, @Nullable LivingEntity target) {
        double speed = getAttributeValue(Attributes.FLYING_SPEED) * (isAncestral() && getPhase() == 3 ? 1.3 : 1.0);
        if (getBreathState() != 0 && target != null) {
            // Hover while breathing so the attack is readable and dodgeable.
            setDeltaMovement(getDeltaMovement().scale(0.7));
            faceTowards(target.getEyePosition());
            return;
        }
        if (target != null) {
            orbitAngle += 0.035F;
            double radius = 13.0;
            Vec3 c = target.position();
            double alt = Math.max(c.y + 9.0, groundY(level, c.x, c.z) + 8.0);
            flightTarget = new Vec3(c.x + Math.cos(orbitAngle) * radius, alt, c.z + Math.sin(orbitAngle) * radius);
            if (breathCooldown <= 0 && distanceTo(target) < 22.0 && hasLineOfSight(target)) {
                startBreathCharge();
            }
            // Boss phase 1 and natural dragons that lose sight come down to fight on foot.
            boolean wantsGround = (!isAncestral() && modeTicks > 600) || (isAncestral() && getPhase() == 1 && modeTicks > 200);
            if (wantsGround) {
                setMode(Mode.LAND);
            }
        } else {
            if (flightTarget == null || position().distanceToSqr(flightTarget) < 9.0 || modeTicks % 200 == 0) {
                BlockPos home = homePos != null ? homePos : blockPosition();
                double x = home.getX() + (random.nextDouble() - 0.5) * 80.0;
                double z = home.getZ() + (random.nextDouble() - 0.5) * 80.0;
                flightTarget = new Vec3(x, groundY(level, x, z) + 16.0 + random.nextInt(10), z);
            }
            if (modeTicks > 500) {
                setMode(Mode.LAND);
                return;
            }
        }
        // Stuck recovery: climb when blocked, re-plan when not making progress.
        if (horizontalCollision) {
            flightTarget = flightTarget.add(0, 4.0, 0);
        }
        if (modeTicks % 40 == 0) {
            if (position().distanceToSqr(lastProgressPos) < 1.0) {
                flightTarget = position().add((random.nextDouble() - 0.5) * 20, 8.0, (random.nextDouble() - 0.5) * 20);
            }
            lastProgressPos = position();
        }
        // Never fly into the build limit or the void.
        double maxY = level.getMaxY() - 8;
        double minY = level.getMinY() + 8;
        flightTarget = new Vec3(flightTarget.x, Mth.clamp(flightTarget.y, minY, maxY), flightTarget.z);
        steerTowards(flightTarget, speed);
    }

    private void tickLand(ServerLevel level) {
        double gy = groundY(level, getX(), getZ());
        Vec3 landing = new Vec3(getX(), gy, getZ());
        steerTowards(landing, 0.35);
        if (onGround() || getY() - gy < 0.6 || modeTicks > 200) {
            setFlying(false);
            setMode(Mode.GROUND);
            takeoffCooldown = isAncestral() ? 120 : 300;
            playSound(ModSounds.RED_DRAGON_LAND.get(), 3.0F, 1.0F);
            level.sendParticles(ParticleTypes.CLOUD, getX(), getY() + 0.2, getZ(), 20, 1.5, 0.1, 1.5, 0.02);
            if (isAncestral() && getPhase() == 3) {
                landingShockwave(level);
            }
        }
    }

    // ------------------------------------------------------------------ attacks

    private void startBreathCharge() {
        entityData.set(DATA_BREATH, 1);
        breathTicks = 0;
        scorchedThisBreath = 0;
        playSound(ModSounds.RED_DRAGON_ROAR.get(), 3.0F, 1.0F);
    }

    private Vec3 mouthPos() {
        Vec3 look = Vec3.directionFromRotation(0, getYRot());
        double s = getScale();
        return position().add(look.scale(2.6 * s)).add(0, 1.9 * s, 0);
    }

    private void tickBreath(ServerLevel level, @Nullable LivingEntity target) {
        int state = getBreathState();
        if (state == 0) {
            return;
        }
        breathTicks++;
        Vec3 mouth = mouthPos();
        if (state == 1) {
            if (target != null) {
                faceTowards(target.getEyePosition());
            }
            level.sendParticles(ParticleTypes.LARGE_SMOKE, mouth.x, mouth.y, mouth.z, 3, 0.2, 0.2, 0.2, 0.01);
            if (breathTicks >= BREATH_CHARGE) {
                entityData.set(DATA_BREATH, 2);
                breathTicks = 0;
                playSound(ModSounds.RED_DRAGON_BREATH_START.get(), 3.0F, 1.0F);
            }
            return;
        }
        Vec3 dir = target != null ? target.getEyePosition().subtract(mouth).normalize() : Vec3.directionFromRotation(20, getYRot());
        if (target != null) {
            faceTowards(target.getEyePosition());
        }
        if (breathTicks % 2 == 0) {
            for (int i = 1; i <= 6; i++) {
                double d = i * BREATH_RANGE / 6.0;
                Vec3 p = mouth.add(dir.scale(d));
                double spread = 0.15 * d;
                level.sendParticles(ParticleTypes.FLAME, p.x, p.y, p.z, 3, spread, spread, spread, 0.02);
            }
        }
        if (breathTicks % 20 == 1) {
            playSound(ModSounds.RED_DRAGON_BREATH_LOOP.get(), 2.5F, 1.0F);
        }
        if (breathTicks % 10 == 0) {
            damageCone(level, mouth, dir);
            scorch(level, mouth, dir);
        }
        if (breathTicks >= BREATH_DURATION) {
            entityData.set(DATA_BREATH, 0);
            int base = isAncestral() ? (getPhase() == 3 ? 60 : 90) : 140;
            breathCooldown = base + random.nextInt(60);
        }
    }

    private void damageCone(ServerLevel level, Vec3 mouth, Vec3 dir) {
        AABB box = new AABB(mouth, mouth).inflate(BREATH_RANGE);
        float damage = LFConfig.DRAGON_BREATH_DAMAGE.get().floatValue() * (isAncestral() ? 1.5F : 1.0F);
        boolean hit = false;
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, box, e -> e != this && e.isAlive() && !(e instanceof RedDragon))) {
            Vec3 to = e.getBoundingBox().getCenter().subtract(mouth);
            double dist = to.length();
            if (dist > BREATH_RANGE || dist < 0.01) {
                continue;
            }
            if (to.scale(1.0 / dist).dot(dir) < BREATH_HALF_ANGLE_COS) {
                continue;
            }
            if (e.hurtServer(level, damageSources().source(ModDamageTypes.DRAGON_FIRE, this), damage)) {
                e.igniteForTicks(60);
                hit = true;
            }
        }
        if (hit) {
            playSound(ModSounds.RED_DRAGON_BREATH_IMPACT.get(), 2.0F, 1.0F);
        }
    }

    /** Bounded environmental trace: natural vegetation only, capped per breath, respects mobGriefing. */
    private void scorch(ServerLevel level, Vec3 mouth, Vec3 dir) {
        if (!LFConfig.DRAGON_ENVIRONMENTAL_DAMAGE.getAsBoolean() || scorchedThisBreath >= LFConfig.DRAGON_MAX_SCORCH_BLOCKS.getAsInt()
                || !EventHooks.canEntityGrief(level, this)) {
            return;
        }
        Vec3 end = mouth.add(dir.scale(BREATH_RANGE));
        BlockHitResult hit = level.clip(new ClipContext(mouth, end, ClipContext.Block.OUTLINE, ClipContext.Fluid.NONE, this));
        if (hit.getType() != HitResult.Type.BLOCK) {
            return;
        }
        BlockPos pos = hit.getBlockPos();
        BlockState state = level.getBlockState(pos);
        if (!state.is(ModTags.Blocks.DRAGON_SCORCHABLE)) {
            return;
        }
        if (state.is(Blocks.GRASS_BLOCK)) {
            level.setBlockAndUpdate(pos, ModBlocks.SCORCHED_GRASS.get().defaultBlockState());
        } else {
            level.removeBlock(pos, false);
        }
        scorchedThisBreath++;
    }

    private void wingBuffet(ServerLevel level) {
        buffetCooldown = isAncestral() ? 100 : 160;
        playSound(ModSounds.RED_DRAGON_FLAP.get(), 3.0F, 0.7F);
        level.sendParticles(ParticleTypes.CLOUD, getX(), getY() + 0.5, getZ(), 30, 2.5, 0.3, 2.5, 0.05);
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, getBoundingBox().inflate(4.0), e -> e != this && !(e instanceof RedDragon))) {
            Vec3 push = e.position().subtract(position()).multiply(1, 0, 1);
            if (push.lengthSqr() < 1.0E-4) {
                push = new Vec3(1, 0, 0);
            }
            push = push.normalize().scale(1.4);
            e.push(push.x, 0.45, push.z);
            e.hurtMarked = true;
            e.hurtServer(level, damageSources().mobAttack(this), 4.0F);
        }
    }

    private void landingShockwave(ServerLevel level) {
        playSound(ModSounds.GIANT_SLAM.get(), 3.0F, 0.6F);
        level.sendParticles(ParticleTypes.EXPLOSION, getX(), getY() + 0.3, getZ(), 6, 3.0, 0.1, 3.0, 0.0);
        for (LivingEntity e : level.getEntitiesOfClass(LivingEntity.class, getBoundingBox().inflate(6.0, 1.0, 6.0), e -> e != this && e.onGround())) {
            e.hurtServer(level, damageSources().mobAttack(this), 8.0F);
            e.push(0, 0.6, 0);
            e.hurtMarked = true;
        }
    }

    @Override
    public boolean doHurtTarget(ServerLevel level, Entity target) {
        boolean hit = super.doHurtTarget(level, target);
        if (hit) {
            playSound(ModSounds.RED_DRAGON_ROAR.get(), 1.5F, 1.4F);
        }
        return hit;
    }

    @Override
    public boolean killedEntity(ServerLevel level, LivingEntity victim, DamageSource source) {
        boolean result = super.killedEntity(level, victim, source);
        if (victim.is(ModTags.Entities.DRAGON_PREY)) {
            heal(12.0F);
            hungerCooldown = 2400 + random.nextInt(2400);
            EventMemory.get(level).record(EventMemory.Type.PREDATOR_ATTACK, victim.blockPosition(), "red_dragon");
            BlockPos at = victim.blockPosition();
            if (LFConfig.DRAGON_ENVIRONMENTAL_DAMAGE.getAsBoolean() && level.getBlockState(at).canBeReplaced()
                    && ModBlocks.CHARRED_REMAINS.get().defaultBlockState().canSurvive(level, at)) {
                level.setBlockAndUpdate(at, ModBlocks.CHARRED_REMAINS.get().defaultBlockState());
            }
            setTarget(null);
        }
        return result;
    }

    // ------------------------------------------------------------------ boss

    private void tickBoss(ServerLevel level) {
        if (!bossScaled) {
            bossScaled = true;
            int players = Math.max(1, level.getPlayers(p -> p.distanceToSqr(this) < 96 * 96 && !p.isSpectator()).size());
            double factor = 1.0 + 0.25 * (Math.min(players, 5) - 1);
            getAttribute(Attributes.MAX_HEALTH).setBaseValue(LFConfig.DRAGON_BOSS_HEALTH.get() * factor);
            setHealth(getMaxHealth());
            playSound(ModSounds.EVENT_DRAGON_ENCOUNTER.get(), 4.0F, 1.0F);
        }
        float ratio = getHealth() / getMaxHealth();
        int phase = ratio > 0.66F ? 1 : ratio > 0.33F ? 2 : 3;
        if (phase != getPhase()) {
            entityData.set(DATA_PHASE, phase);
            playSound(ModSounds.EVENT_BOSS_PHASE.get(), 4.0F, 1.0F);
            playSound(ModSounds.RED_DRAGON_ROAR.get(), 4.0F, 0.8F);
            AncientSignals.post(level, blockPosition(), AncientSignals.Kind.EVENT_STATE);
            if (phase >= 2 && mode == Mode.GROUND) {
                takeoffCooldown = 0;
            }
        }
        if (bossEvent != null) {
            bossEvent.setProgress(ratio);
        }
        // Keep the boss near its altar so the arena stays relevant.
        if (homePos != null && blockPosition().distSqr(homePos) > 96 * 96 && mode == Mode.FLY) {
            flightTarget = Vec3.atCenterOf(homePos).add(0, 14, 0);
        }
    }

    @Override
    public boolean hurtServer(ServerLevel level, DamageSource source, float damage) {
        if (source.getEntity() instanceof ServerPlayer player && damagers.size() < MAX_DAMAGERS) {
            damagers.add(player.getUUID());
        }
        boolean hurt = super.hurtServer(level, source, damage);
        if (hurt && mode == Mode.GROUND && getHealth() < getMaxHealth() * 0.5F && takeoffCooldown <= 0 && random.nextInt(4) == 0) {
            beginTakeoff();
        }
        return hurt;
    }

    @Override
    public void die(DamageSource source) {
        if (level() instanceof ServerLevel level && !isRemoved() && !dead) {
            if (source.getEntity() instanceof ServerPlayer killer) {
                damagers.add(killer.getUUID());
            }
            List<ServerPlayer> credited = new ArrayList<>();
            for (UUID id : damagers) {
                if (level.getPlayerByUUID(id) instanceof ServerPlayer p && p.distanceToSqr(this) < 160 * 160) {
                    credited.add(p);
                }
            }
            for (ServerPlayer p : credited) {
                StoryEvents.onLostMobDefeated(p, this);
            }
            EventMemory.get(level).record(EventMemory.Type.BOSS_ENCOUNTER, blockPosition(), isAncestral() ? "ancestral_defeated" : "dragon_defeated");
            AncientSignals.post(level, blockPosition(), AncientSignals.Kind.ENCOUNTER_END);
            if (isAncestral()) {
                playSound(ModSounds.EVENT_BOSS_VICTORY.get(), 4.0F, 1.0F);
                if (bossEvent != null) {
                    bossEvent.removeAllPlayers();
                }
            }
        }
        super.die(source);
    }

    // ------------------------------------------------------------------ sounds

    @Override
    protected @Nullable SoundEvent getAmbientSound() {
        return ModSounds.RED_DRAGON_AMBIENT.get();
    }

    @Override
    protected @Nullable SoundEvent getHurtSound(DamageSource source) {
        return ModSounds.RED_DRAGON_HURT.get();
    }

    @Override
    protected @Nullable SoundEvent getDeathSound() {
        return ModSounds.RED_DRAGON_DEATH.get();
    }

    @Override
    protected void playStepSound(BlockPos pos, BlockState state) {
        playSound(ModSounds.RED_DRAGON_STEP.get(), 0.8F, 1.0F);
    }

    @Override
    protected float getSoundVolume() {
        return 3.0F;
    }

    @Override
    public int getAmbientSoundInterval() {
        return 240;
    }

    @Override
    public SoundSource getSoundSource() {
        return SoundSource.HOSTILE;
    }
}
