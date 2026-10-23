package com.lostfeatures.block;

import com.lostfeatures.block.entity.LockedChestBlockEntity;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.world.AncientSignals;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.context.BlockPlaceContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.EntityBlock;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.entity.ChestBlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.StateDefinition;
import net.minecraft.world.level.block.state.properties.BlockStateProperties;
import net.minecraft.world.level.block.state.properties.EnumProperty;
import net.minecraft.world.phys.BlockHitResult;

/**
 * The historical "Locked chest" (Beta 1.4 April Fools), reinterpreted: an ancient strongbox that
 * opens only with an Ancient Key. Unlocking turns it into a vanilla chest carrying its loot table,
 * so vanilla's own loot unpacking is used unchanged.
 */
public class LockedChestBlock extends Block implements EntityBlock {
    public static final EnumProperty<Direction> FACING = BlockStateProperties.HORIZONTAL_FACING;

    public LockedChestBlock(Properties properties) {
        super(properties);
        registerDefaultState(stateDefinition.any().setValue(FACING, Direction.NORTH));
    }

    @Override
    protected void createBlockStateDefinition(StateDefinition.Builder<Block, BlockState> builder) {
        builder.add(FACING);
    }

    @Override
    public BlockState getStateForPlacement(BlockPlaceContext context) {
        return defaultBlockState().setValue(FACING, context.getHorizontalDirection().getOpposite());
    }

    @Override
    protected BlockState rotate(BlockState state, Rotation rotation) {
        return state.setValue(FACING, rotation.rotate(state.getValue(FACING)));
    }

    @Override
    protected BlockState mirror(BlockState state, Mirror mirror) {
        return state.rotate(mirror.getRotation(state.getValue(FACING)));
    }

    @Override
    protected InteractionResult useItemOn(ItemStack stack, BlockState state, Level level, BlockPos pos, Player player,
                                          InteractionHand hand, BlockHitResult hit) {
        if (!stack.is(ModItems.ANCIENT_KEY.get())) {
            return InteractionResult.TRY_WITH_EMPTY_HAND;
        }
        if (level instanceof ServerLevel server && level.getBlockEntity(pos) instanceof LockedChestBlockEntity locked) {
            var lootTable = locked.getLootTable();
            long seed = locked.getLootSeed();
            BlockState chest = Blocks.CHEST.defaultBlockState().setValue(ChestBlock.FACING, state.getValue(FACING));
            server.setBlock(pos, chest, Block.UPDATE_ALL);
            if (lootTable != null && server.getBlockEntity(pos) instanceof ChestBlockEntity chestEntity) {
                chestEntity.setLootTable(lootTable, seed);
            }
            stack.consume(1, player);
            server.playSound(null, pos, ModSounds.LOCKED_CHEST_UNLOCK.get(), SoundSource.BLOCKS, 1.0F, 1.0F);
            AncientSignals.post(server, pos, AncientSignals.Kind.MECHANISM);
            if (player instanceof ServerPlayer serverPlayer) {
                StoryEvents.onLockedChestOpened(serverPlayer);
            }
        }
        return InteractionResult.SUCCESS;
    }

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (!level.isClientSide()) {
            player.sendOverlayMessage(Component.translatable("message.lostfeatures.locked_chest.locked"));
        }
        return InteractionResult.SUCCESS;
    }

    @Override
    public BlockEntity newBlockEntity(BlockPos pos, BlockState state) {
        return new LockedChestBlockEntity(pos, state);
    }
}
