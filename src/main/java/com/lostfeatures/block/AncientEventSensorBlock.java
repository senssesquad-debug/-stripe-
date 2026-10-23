package com.lostfeatures.block;

import com.lostfeatures.block.entity.AncientEventSensorBlockEntity;
import com.lostfeatures.registry.ModSounds;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.BlockGetter;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.BlockEntityTicker;
import net.minecraft.world.level.block.entity.BlockEntityType;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.level.block.state.properties.IntegerProperty;
import net.minecraft.world.phys.BlockHitResult;
import org.jspecify.annotations.Nullable;

/**
 * Emits a redstone signal when a configured local event happens nearby. Right-click cycles the
 * filter, sneak-right-click cycles the detection range. All detection is server-side.
 */
public class AncientEventSensorBlock extends Block implements EntityBlock {
    public static final IntegerProperty POWER = BlockStateProperties.POWER;
    public static final EnumProperty<SensorFilter> FILTER = EnumProperty.create("filter", SensorFilter.class);

    public AncientEventSensorBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(POWER, 0).setValue(FILTER, SensorFilter.CREATURES));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(POWER, FILTER);
    }

    @Override
    protected boolean isSignalSource(BlockState state) {
        return true;
    }

    @Override
    protected int getSignal(BlockState state, BlockGetter level, BlockPos pos, Direction direction) {
        return state.getValue(POWER);
    }

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (!level.isClientSide() && level.getBlockEntity(pos) instanceof AncientEventSensorBlockEntity sensor) {
            if (player.isShiftKeyDown()) {
                int range = sensor.cycleRange();
                player.sendOverlayMessage(Component.translatable("message.lostfeatures.sensor.range", range));
            } else {
                SensorFilter next = state.getValue(FILTER).next();
                level.setBlock(pos, state.setValue(FILTER, next), Block.UPDATE_ALL);
                player.sendOverlayMessage(Component.translatable("message.lostfeatures.sensor.filter",
                        Component.translatable("filter.lostfeatures." + next.getSerializedName())));
            }
            level.playSound(null, pos, ModSounds.RUNIC_INPUT.get(), SoundSource.BLOCKS, 0.5F, 1.4F);
        }
        return InteractionResult.SUCCESS;
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new AncientEventSensorBlockEntity(pos, state);
    }

    @Override
    public <T extends BlockEntity> @Nullable BlockEntityTicker<T> getTicker(Level level, BlockState state, BlockEntityType<T> type) {
        return level.isClientSide() ? null : (l, p, s, be) -> {
            if (be instanceof AncientEventSensorBlockEntity sensor) {
                sensor.serverTick();
            }
        };
    }
}
