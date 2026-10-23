package com.lostfeatures.client.renderer;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.client.model.KillerBunnyModel;
import com.lostfeatures.entity.KillerBunny;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.resources.Identifier;

public class KillerBunnyRenderer extends MobRenderer<KillerBunny, KillerBunnyRenderState, KillerBunnyModel> {
    private static final Identifier TEXTURE = LostFeatures.id("textures/entity/killer_bunny.png");

    public KillerBunnyRenderer(EntityRendererProvider.Context context) {
        super(context, new KillerBunnyModel(context.bakeLayer(ModModelLayers.KILLER_BUNNY)), 0.3F);
    }

    @Override
    public Identifier getTextureLocation(KillerBunnyRenderState state) {
        return TEXTURE;
    }

    @Override
    public KillerBunnyRenderState createRenderState() {
        return new KillerBunnyRenderState();
    }

    @Override
    public void extractRenderState(KillerBunny entity, KillerBunnyRenderState state, float partialTicks) {
        super.extractRenderState(entity, state, partialTicks);
        state.airborne = !entity.onGround();
        state.aggressive = entity.isAggressive();
    }
}
