package com.lostfeatures.data;

import net.neoforged.neoforge.data.event.GatherDataEvent;

/** Run with {@code ./gradlew runClientData runServerData}; output goes to src/generated/resources. */
public final class ModDataGenerators {
    private ModDataGenerators() {
    }

    public static void gatherClientData(GatherDataEvent.Client event) {
        event.createProvider(ModModelProvider::new);
    }

    public static void gatherServerData(GatherDataEvent.Server event) {
        event.createProvider(ModRecipeProvider::new);
        event.createProvider(ModLootTableProvider::new);
    }
}
