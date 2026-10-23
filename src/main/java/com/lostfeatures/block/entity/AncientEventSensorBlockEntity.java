package com.lostfeatures.block.entity;

import com.lostfeatures.block.AncientEventSensorBlock;
import com.lostfeatures.block.SensorFilter;
import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModBlockEntities;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.registry.ModTags;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.Mob;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.phys.AABB;

import java.util.List;

public class AncientEventSensorBlockEntity extends BlockEntity {
    private static final int[] RANGES = {4, 8, 12, 16, 24, 32};
    /** Signals from encounters/mechanisms hold the output this long so that they read as a clean pulse. */
    private static final int PULSE_TICKS = 10;

    private int range = 8;
    private long lastScan;
    private int pulseRemaining;

    public AncientEventSensorBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.EVENT_SENSOR.get(), pos, state);
    }

    public int effectiveRange() {
        return Math.min(range, LFConfig.SENSOR_MAX_RANGE.getAsInt());
    }

    public int cycleRange() {
        int idx = 0;
        for (int i = 0; i < RANGES.length; i++) {
            if (RANGES[i] == range) {
                idx = i;
            }
        }
        int max = LFConfig.SENSOR_MAX_RANGE.getAsInt();
        int next = RANGES[(idx + 1) % RANGES.length];
        range = next > max ? RANGES[0] : next;
        setChanged();
        return range;
    }

    public void serverTick() {
        if (!(level instanceof ServerLevel server)) {
            return;
        }
        long now = server.getGameTime();
        int interval = LFConfig.SENSOR_SCAN_INTERVAL.getAsInt();
        // Stagger sensors so many sensors never query on the same tick.
        if ((now + worldPosition.asLong()) % interval != 0) {
            if (pulseRemaining > 0 && --pulseRemaining == 0) {
                setPower(server, 0);
            }
            return;
        }
        BlockState state = getBlockState();
        SensorFilter filter = state.getValue(AncientEventSensorBlock.FILTER);
        int r = effectiveRange();
        int power = 0;

        if (filter == SensorFilter.CREATURES || filter == SensorFilter.ANY) {
            AABB box = new AABB(worldPosition).inflate(r);
            List<Mob> mobs = server.getEntitiesOfClass(Mob.class, box,
                    m -> m.isAlive() && m.is(ModTags.Entities.SENSOR_DETECTABLE));
            double best = -1;
            for (Mob mob : mobs) {
                double d = Math.sqrt(mob.distanceToSqr(net.minecraft.world.phys.Vec3.atCenterOf(worldPosition)));
                if (d <= r && (best < 0 || d < best)) {
                    best = d;
                }
            }
            if (best >= 0) {
                power = Math.max(power, strength(best, r));
            }
        }
        if (filter != SensorFilter.CREATURES) {
            double d = AncientSignals.closestSince(server, worldPosition, r, lastScan, kind -> switch (filter) {
                case ENCOUNTERS -> kind == AncientSignals.Kind.ENCOUNTER_START || kind == AncientSignals.Kind.ENCOUNTER_END
                        || kind == AncientSignals.Kind.EVENT_STATE;
                case MECHANISMS -> kind == AncientSignals.Kind.MECHANISM;
                default -> true;
            });
            if (d >= 0) {
                power = Math.max(power, strength(d, r));
                pulseRemaining = PULSE_TICKS;
            }
        }
        lastScan = now;

        int current = state.getValue(AncientEventSensorBlock.POWER);
        if (power == 0 && pulseRemaining > 0) {
            return; // keep the pulse alive until it times out
        }
        if (power != current) {
            if (current == 0) {
                server.playSound(null, worldPosition, ModSounds.EVENT_SENSOR_ACTIVATE.get(), SoundSource.BLOCKS, 0.6F, 1.0F);
            }
            setPower(server, power);
        }
    }

    private static int strength(double distance, int range) {
        return Mth.clamp(15 - (int) (distance * 14.0 / Math.max(1, range)), 1, 15);
    }

    private void setPower(ServerLevel server, int power) {
        BlockState state = getBlockState();
        if (state.getValue(AncientEventSensorBlock.POWER) != power) {
            server.setBlock(worldPosition, state.setValue(AncientEventSensorBlock.POWER, power), Block.UPDATE_ALL);
        }
    }

    @Override
    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        output.putInt("range", range);
    }

    @Override
    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        range = Mth.clamp(input.getIntOr("range", 8), 1, 32);
    }
}
