package com.lostfeatures.block;

import com.lostfeatures.block.entity.AncientEnergyReactorBlockEntity;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BooleanProperty;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.phys.BlockHitResult;
import org.jspecify.annotations.Nullable;

/**
 * Consumes rare mod materials into a finite charge. While enabled by a redstone signal it spends
 * charge to emit bounded redstone pulses; it never creates energy from nothing and never touches
 * vanilla furnaces, hoppers or circuits.
 */
public class AncientEnergyReactorBlock extends Block implements EntityBlock {
    public static final EnumProperty<ReactorPhase> PHASE = EnumProperty.create("phase", ReactorPhase.class);
    public static final BooleanProperty PULSING = BooleanProperty.create("pulsing");

    public AncientEnergyReactorBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(PHASE, ReactorPhase.IDLE).setValue(PULSING, false));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(PHASE, PULSING);
    }

    @Override
    protected InteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player,
                                          InteractionHand hand, BlockHitResult hit) {
        if (AncientEnergyReactorBlockEntity.fuelValue(stack) <= 0) {
            return InteractionResult.TRY_WITH_EMPTY_HAND;
        }
        if (!level.isClientSide() && level.getBlockEntity(pos) instanceof AncientEnergyReactorBlockEntity reactor) {
            int accepted = reactor.insertFuel(stack.copy());
            if (accepted > 0) {
                stack.consume(accepted, player);
            } else {
                player.sendOverlayMessage(Component.translatable("message.lostfeatures.reactor.full"));
            }
        }
        return InteractionResult.SUCCESS;
    }

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (!level.isClientSide() && level.getBlockEntity(pos) instanceof AncientEnergyReactorBlockEntity reactor) {
            player.sendOverlayMessage(Component.translatable("message.lostfeatures.reactor.status",
                    reactor.getCharge(), reactor.getCapacity(),
                    Component.translatable("phase.lostfeatures." + state.getValue(PHASE).getSerializedName())));
        }
        return InteractionResult.SUCCESS;
    }

    @Override
    protected boolean isSignalSource(BlockState state) {
        return true;
    }

    @Override
    protected int getSignal(BlockState state, BlockGetter level, BlockPos pos, Direction direction) {
        // Never emit toward the block below: that is the enable input, so the reactor cannot latch itself on.
        return state.getValue(PULSING) && direction != Direction.UP ? 15 : 0;
    }

    @Override
    protected boolean hasAnalogOutputSignal(BlockState state) {
        return true;
    }

    @Override
    protected int getAnalogOutputSignal(BlockState state, Level level, BlockPos pos, Direction direction) {
        return level.getBlockEntity(pos) instanceof AncientEnergyReactorBlockEntity reactor ? reactor.comparatorLevel() : 0;
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new AncientEnergyReactorBlockEntity(pos, state);
    }

    @Override
    public <T extends BlockEntity> @Nullable BlockEntityTicker<T> getTicker(Level level, BlockState state, BlockEntityType<T> type) {
        return level.isClientSide() ? null : (l, p, s, be) -> {
            if (be instanceof AncientEnergyReactorBlockEntity reactor) {
                reactor.serverTick();
            }
        };
    }
}
