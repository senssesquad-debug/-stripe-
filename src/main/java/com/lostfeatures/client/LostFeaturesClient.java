package com.lostfeatures.client;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.client.model.KillerBunnyModel;
import com.lostfeatures.client.model.RedDragonModel;
import com.lostfeatures.client.renderer.GiantRenderer;
import com.lostfeatures.client.renderer.KillerBunnyRenderer;
import com.lostfeatures.client.renderer.LostIllusionerRenderer;
import com.lostfeatures.client.renderer.ModModelLayers;
import com.lostfeatures.client.renderer.RedDragonRenderer;
import com.lostfeatures.network.JournalPayload;
import com.lostfeatures.registry.ModEntities;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.client.event.EntityRenderersEvent;
import net.neoforged.neoforge.client.event.SelectMusicEvent;
import net.neoforged.neoforge.client.network.event.RegisterClientPayloadHandlersEvent;

/** Client-only registration. Loaded only on the physical client. */
@EventBusSubscriber(modid = LostFeatures.MOD_ID, value = Dist.CLIENT)
public final class LostFeaturesClient {
    private LostFeaturesClient() {
    }

    @SubscribeEvent
    public static void registerLayers(EntityRenderersEvent.RegisterLayerDefinitions event) {
        event.registerLayerDefinition(ModModelLayers.RED_DRAGON, RedDragonModel::createBodyLayer);
        event.registerLayerDefinition(ModModelLayers.KILLER_BUNNY, KillerBunnyModel::createBodyLayer);
    }

    @SubscribeEvent
    public static void registerRenderers(EntityRenderersEvent.RegisterRenderers event) {
        event.registerEntityRenderer(ModEntities.RED_DRAGON.get(), RedDragonRenderer::new);
        event.registerEntityRenderer(ModEntities.GIANT.get(), GiantRenderer::new);
        event.registerEntityRenderer(ModEntities.ILLUSIONER.get(), LostIllusionerRenderer::new);
        event.registerEntityRenderer(ModEntities.KILLER_BUNNY.get(), KillerBunnyRenderer::new);
    }

    @SubscribeEvent
    public static void registerPayloadHandlers(RegisterClientPayloadHandlersEvent event) {
        event.register(JournalPayload.TYPE, ClientJournal::handle);
    }

    @SubscribeEvent
    public static void selectMusic(SelectMusicEvent event) {
        SituationalMusic.onSelectMusic(event);
    }
}
