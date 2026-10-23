package com.lostfeatures.block.entity;

import com.lostfeatures.block.RunicLogicDeviceBlock;
import com.lostfeatures.block.RunicMode;
import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModBlockEntities;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;

/** Holds the timing state of a Runic Logic Device. All evaluation happens in scheduled server ticks. */
public class RunicLogicBlockEntity extends BlockEntity {
    public static final int PULSE_TICKS = 10;
    private static final int[] SEQUENCE_ORDER = {1, 2, 4};

    private int previousMask;
    private int sequenceProgress;
    private long lastInputTime;
    private boolean latched;
    private boolean lastCondition;
    private long pulseUntil;

    public RunicLogicBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.RUNIC_LOGIC.get(), pos, state);
    }

    public void resetState() {
        sequenceProgress = 0;
        latched = false;
        lastCondition = false;
        pulseUntil = 0;
        setChanged();
    }

    /** Returns the desired output given the current input mask. */
    public boolean evaluate(ServerLevel level, BlockState state, int mask) {
        long now = level.getGameTime();
        int rising = mask & ~previousMask;
        previousMask = mask;
        RunicMode mode = state.getValue(RunicLogicDeviceBlock.MODE);
        boolean condition;
        boolean edgeTriggered = false;

        if (rising != 0) {
            level.playSound(null, worldPosition, ModSounds.RUNIC_INPUT.get(), SoundSource.BLOCKS, 0.4F, 0.8F + 0.2F * Integer.bitCount(mask));
        }

        switch (mode) {
            case AND -> condition = (mask & 1) != 0 && (mask & 4) != 0;
            case MAJORITY -> condition = Integer.bitCount(mask) >= 2;
            case LATCH -> {
                if ((rising & 1) != 0) latched = true;
                if ((rising & 4) != 0) latched = false;
                condition = latched;
            }
            case SEQUENCE -> {
                int window = LFConfig.RUNIC_TIMING_WINDOW.getAsInt();
                if (sequenceProgress > 0 && now - lastInputTime > window) {
                    sequenceProgress = 0;
                    level.playSound(null, worldPosition, ModSounds.RUNIC_RESET.get(), SoundSource.BLOCKS, 0.5F, 0.7F);
                }
                condition = false;
                if (rising != 0) {
                    int expected = SEQUENCE_ORDER[sequenceProgress];
                    if (rising == expected) {
                        sequenceProgress++;
                        lastInputTime = now;
                        if (sequenceProgress == SEQUENCE_ORDER.length) {
                            sequenceProgress = 0;
                            condition = true;
                            edgeTriggered = true;
                        }
                    } else {
                        sequenceProgress = 0;
                        level.playSound(null, worldPosition, ModSounds.MECHANISM_FAIL.get(), SoundSource.BLOCKS, 0.6F, 1.0F);
                    }
                }
            }
            default -> condition = false;
        }

        boolean pulseMode = state.getValue(RunicLogicDeviceBlock.PULSE) || mode == RunicMode.SEQUENCE;
        boolean output;
        if (pulseMode) {
            if ((condition && !lastCondition) || edgeTriggered) {
                pulseUntil = now + PULSE_TICKS;
                onSatisfied(level);
            }
            output = now < pulseUntil;
        } else {
            if (condition && !lastCondition) {
                onSatisfied(level);
            }
            output = condition;
        }
        lastCondition = condition && !edgeTriggered;
        setChanged();
        return output;
    }

    private void onSatisfied(ServerLevel level) {
        level.playSound(null, worldPosition, ModSounds.RUNIC_OUTPUT.get(), SoundSource.BLOCKS, 0.6F, 1.0F);
        AncientSignals.post(level, worldPosition, AncientSignals.Kind.MECHANISM);
        for (ServerPlayer player : level.getPlayers(p -> p.distanceToSqr(net.minecraft.world.phys.Vec3.atCenterOf(worldPosition)) < 64)) {
            StoryEvents.onMechanismActivated(player, "runic_logic");
        }
    }

    /** Ticks until the block must re-evaluate on its own (pulse end or sequence timeout), or 0. */
    public int nextWakeDelay(ServerLevel level) {
        long now = level.getGameTime();
        if (pulseUntil > now) {
            return (int) (pulseUntil - now);
        }
        if (sequenceProgress > 0) {
            return LFConfig.RUNIC_TIMING_WINDOW.getAsInt() + 1;
        }
        return 0;
    }

    @Override
    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        output.putInt("prev", previousMask);
        output.putInt("progress", sequenceProgress);
        output.putLong("last_input", lastInputTime);
        output.putBoolean("latched", latched);
        output.putBoolean("last_condition", lastCondition);
        output.putLong("pulse_until", pulseUntil);
    }

    @Override
    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        previousMask = input.getIntOr("prev", 0) & 7;
        sequenceProgress = Math.clamp(input.getIntOr("progress", 0), 0, SEQUENCE_ORDER.length - 1);
        lastInputTime = input.getLongOr("last_input", 0L);
        latched = input.getBooleanOr("latched", false);
        lastCondition = input.getBooleanOr("last_condition", false);
        pulseUntil = input.getLongOr("pulse_until", 0L);
    }
}
