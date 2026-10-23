package com.lostfeatures.network;

import com.lostfeatures.LostFeatures;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.network.protocol.common.custom.CustomPacketPayload;

import java.util.List;

/**
 * Server to client: the player's unlocked milestone IDs and world story flags. Sent on login, on each
 * unlock and when the journal is opened; never every tick. The client only displays it - all
 * progression decisions stay on the server.
 */
public record JournalPayload(List<String> milestones, List<String> worldFlags, boolean open) implements CustomPacketPayload {
    public static final Type<JournalPayload> TYPE = new Type<>(LostFeatures.id("journal"));
    private static final StreamCodec<io.netty.buffer.ByteBuf, List<String>> STRINGS =
            ByteBufCodecs.stringUtf8(64).apply(ByteBufCodecs.list(128));

    public static final StreamCodec<RegistryFriendlyByteBuf, JournalPayload> STREAM_CODEC = StreamCodec.composite(
            STRINGS, JournalPayload::milestones,
            STRINGS, JournalPayload::worldFlags,
            ByteBufCodecs.BOOL, JournalPayload::open,
            JournalPayload::new);

    @Override
    public Type<? extends CustomPacketPayload> type() {
        return TYPE;
    }
}
