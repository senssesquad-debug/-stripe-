package com.lostfeatures.block.entity;

import com.lostfeatures.block.AncientEnergyReactorBlock;
import com.lostfeatures.block.ReactorPhase;
import com.lostfeatures.config.LFConfig;
import com.lostfeatures.registry.ModBlockEntities;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.core.particles.ParticleTypes;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.util.Mth;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.neoforged.neoforge.transfer.item.ItemResource;
import net.neoforged.neoforge.transfer.item.ItemStacksResourceHandler;
import net.neoforged.neoforge.transfer.transaction.Transaction;

public class AncientEnergyReactorBlockEntity extends BlockEntity {
    /** Charge spent per emitted pulse. */
    public static final int PULSE_COST = 10;
    /** Ticks the reactor must rest after running dry. */
    public static final int COOLDOWN_TICKS = 100;
    private static final int PULSE_LENGTH = 4;

    /** One-slot fuel buffer, also exposed to hoppers through the item capability. */
    public final ItemStacksResourceHandler inventory = new ItemStacksResourceHandler(1) {
        @Override
        public boolean isValid(int slot, ItemResource resource) {
            return fuelValue(resource.toStack()) > 0;
        }

        @Override
        protected void onContentsChanged(int slot, ItemStack previous) {
            setChanged();
        }
    };

    private int charge;
    private int cooldown;
    private int pulseTimer;
    private boolean wasEnabled;

    public AncientEnergyReactorBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.ENERGY_REACTOR.get(), pos, state);
    }

    /** Charge granted by one item of fuel. Only rare mod materials are accepted. */
    public static int fuelValue(ItemStack stack) {
        if (stack.is(ModItems.RUBY.get())) return 200;
        if (stack.is(ModItems.RUBY_BLOCK_ITEM.get())) return 1800;
        if (stack.is(ModItems.ILLUSION_DUST.get())) return 300;
        if (stack.is(ModItems.STRENGTH_SHARD.get())) return 1000;
        if (stack.is(ModItems.DRAGON_HEART.get())) return 4000;
        return 0;
    }

    public int getCharge() {
        return charge;
    }

    public int getCapacity() {
        return LFConfig.REACTOR_CAPACITY.getAsInt();
    }

    public int comparatorLevel() {
        return charge <= 0 ? 0 : Mth.clamp(1 + charge * 14 / Math.max(1, getCapacity()), 1, 15);
    }

    /** Inserts as much of {@code stack} into the fuel slot as fits; returns the number accepted. */
    public int insertFuel(ItemStack stack) {
        if (stack.isEmpty()) {
            return 0;
        }
        try (var tx = Transaction.openRoot()) {
            int inserted = inventory.insert(0, ItemResource.of(stack), stack.getCount(), tx);
            tx.commit();
            return inserted;
        }
    }

    public void serverTick() {
        if (!(level instanceof ServerLevel server)) {
            return;
        }
        absorbFuel();
        BlockState state = getBlockState();
        ReactorPhase phase = state.getValue(AncientEnergyReactorBlock.PHASE);
        boolean enabled = server.hasSignal(worldPosition.below(), net.minecraft.core.Direction.DOWN);

        if (phase == ReactorPhase.COOLDOWN) {
            if (--cooldown <= 0) {
                setState(server, ReactorPhase.IDLE, false);
            }
            return;
        }
        if (enabled && charge >= PULSE_COST) {
            if (phase != ReactorPhase.ACTIVE) {
                setState(server, ReactorPhase.ACTIVE, false);
                server.playSound(null, worldPosition, ModSounds.REACTOR_ACTIVATE.get(), SoundSource.BLOCKS, 0.8F, 1.0F);
                AncientSignals.post(server, worldPosition, AncientSignals.Kind.MECHANISM);
                if (!wasEnabled) {
                    for (ServerPlayer player : server.getPlayers(p -> p.distanceToSqr(net.minecraft.world.phys.Vec3.atCenterOf(worldPosition)) < 64)) {
                        StoryEvents.onMechanismActivated(player, "reactor");
                    }
                }
            }
            pulseTimer++;
            int interval = LFConfig.REACTOR_PULSE_INTERVAL.getAsInt();
            if (pulseTimer >= interval) {
                pulseTimer = 0;
                charge -= PULSE_COST;
                setChanged();
                setState(server, ReactorPhase.ACTIVE, true);
                server.playSound(null, worldPosition, ModSounds.REACTOR_PULSE.get(), SoundSource.BLOCKS, 0.35F, 1.0F);
                server.sendParticles(ParticleTypes.ELECTRIC_SPARK, worldPosition.getX() + 0.5, worldPosition.getY() + 1.05,
                        worldPosition.getZ() + 0.5, 6, 0.25, 0.1, 0.25, 0.02);
            } else if (pulseTimer == PULSE_LENGTH && state.getValue(AncientEnergyReactorBlock.PULSING)) {
                setState(server, ReactorPhase.ACTIVE, false);
            }
        } else if (phase == ReactorPhase.ACTIVE) {
            pulseTimer = 0;
            if (charge < PULSE_COST) {
                cooldown = COOLDOWN_TICKS;
                setState(server, ReactorPhase.COOLDOWN, false);
                server.playSound(null, worldPosition, ModSounds.MECHANISM_FAIL.get(), SoundSource.BLOCKS, 0.6F, 0.8F);
            } else {
                setState(server, ReactorPhase.IDLE, false);
            }
            server.playSound(null, worldPosition, ModSounds.REACTOR_SHUTDOWN.get(), SoundSource.BLOCKS, 0.7F, 1.0F);
        }
        wasEnabled = enabled;
    }

    private void absorbFuel() {
        ItemResource resource = inventory.getResource(0);
        if (resource.isEmpty()) {
            return;
        }
        int value = fuelValue(resource.toStack());
        if (value <= 0 || charge + value > getCapacity()) {
            return;
        }
        try (var tx = Transaction.openRoot()) {
            if (inventory.extract(0, resource, 1, tx) == 1) {
                tx.commit();
                charge += value;
                setChanged();
                if (level != null) {
                    level.updateNeighbourForOutputSignal(worldPosition, getBlockState().getBlock());
                }
            }
        }
    }

    private void setState(ServerLevel server, ReactorPhase phase, boolean pulsing) {
        BlockState state = getBlockState();
        BlockState next = state.setValue(AncientEnergyReactorBlock.PHASE, phase).setValue(AncientEnergyReactorBlock.PULSING, pulsing);
        if (next != state) {
            server.setBlock(worldPosition, next, Block.UPDATE_ALL);
            server.updateNeighbourForOutputSignal(worldPosition, state.getBlock());
        }
    }

    @Override
    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        output.putInt("charge", charge);
        output.putInt("cooldown", cooldown);
        inventory.serialize(output.child("fuel"));
    }

    @Override
    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        charge = Math.max(0, input.getIntOr("charge", 0));
        cooldown = Math.max(0, input.getIntOr("cooldown", 0));
        inventory.deserialize(input.childOrEmpty("fuel"));
    }

    @Override
    public void preRemoveSideEffects(BlockPos pos, BlockState state) {
        if (level != null && !level.isClientSide()) {
            ItemResource resource = inventory.getResource(0);
            if (!resource.isEmpty()) {
                Block.popResource(level, pos, resource.toStack(inventory.getAmountAsInt(0)));
            }
        }
        super.preRemoveSideEffects(pos, state);
    }
}
