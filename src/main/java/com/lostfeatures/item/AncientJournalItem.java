package com.lostfeatures.item;

import com.lostfeatures.registry.ModSounds;
import com.lostfeatures.story.StoryEvents;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.level.Level;

/** Opens the discovery journal and bestiary. The server sends the authoritative entry list. */
public class AncientJournalItem extends Item {
    public AncientJournalItem(Properties properties) {
        super(properties);
    }

    @Override
    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        if (player instanceof ServerPlayer serverPlayer) {
            StoryEvents.onItemObtained(serverPlayer, player.getItemInHand(hand));
            level.playSound(null, player.blockPosition(), ModSounds.JOURNAL_OPEN.get(), SoundSource.PLAYERS, 0.6F, 1.0F);
            StoryEvents.sync(serverPlayer, true);
        }
        return InteractionResult.SUCCESS;
    }
}
