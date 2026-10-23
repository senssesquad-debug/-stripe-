package com.lostfeatures.client;

import com.lostfeatures.client.screen.JournalScreen;
import com.lostfeatures.network.JournalPayload;
import net.minecraft.client.Minecraft;
import net.neoforged.neoforge.network.handling.IPayloadContext;

import java.util.List;
import java.util.Set;

/** Client-side cache of the last journal snapshot sent by the server. Display only. */
public final class ClientJournal {
    private static Set<String> milestones = Set.of();
    private static Set<String> worldFlags = Set.of();

    private ClientJournal() {
    }

    public static Set<String> milestones() {
        return milestones;
    }

    public static Set<String> worldFlags() {
        return worldFlags;
    }

    public static void handle(JournalPayload payload, IPayloadContext context) {
        milestones = Set.copyOf(payload.milestones());
        worldFlags = Set.copyOf(payload.worldFlags());
        if (payload.open()) {
            Minecraft.getInstance().gui.setScreen(new JournalScreen());
        } else if (Minecraft.getInstance().gui.screen() instanceof JournalScreen screen) {
            screen.refresh();
        }
    }

    static List<String> sorted(Set<String> set) {
        return set.stream().sorted().toList();
    }
}
