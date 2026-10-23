package com.lostfeatures.block;

import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import net.minecraft.core.BlockPos;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.BlockHitResult;

/** Inscribed brick. Reading it shows one of the civilisation's inscriptions and records a story clue. */
public class AncientGlyphBlock extends Block {
    public static final int INSCRIPTIONS = 8;

    public AncientGlyphBlock(Properties properties) {
        super(properties);
    }

    @Override
    protected InteractionResult useWithoutItem(BlockState state, Level level, BlockPos pos, Player player, BlockHitResult hit) {
        if (player instanceof ServerPlayer serverPlayer) {
            int index = Math.floorMod(pos.hashCode(), INSCRIPTIONS);
            serverPlayer.sendSystemMessage(Component.translatable("glyph.lostfeatures.inscription." + index)
                    .withStyle(net.minecraft.ChatFormatting.GOLD, net.minecraft.ChatFormatting.ITALIC));
            level.playSound(null, pos, ModSounds.EVENT_STORY_DISCOVERY.get(), SoundSource.BLOCKS, 0.4F, 1.2F);
            StoryEvents.onGlyphRead(serverPlayer);
        }
        return InteractionResult.SUCCESS;
    }
}
