package com.lostfeatures.network;

import net.neoforged.neoforge.network.event.RegisterPayloadHandlersEvent;

/** Payload registration. Client handlers are attached in {@code LostFeaturesClient} only on the client. */
public final class ModNetwork {
    public static final String VERSION = "1";

    private ModNetwork() {
    }

    public static void register(RegisterPayloadHandlersEvent event) {
        event.registrar(VERSION).playToClient(JournalPayload.TYPE, JournalPayload.STREAM_CODEC);
    }
}
