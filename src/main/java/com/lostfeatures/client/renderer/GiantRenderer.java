package com.lostfeatures.client.renderer;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.client.model.GiantModel;
import com.lostfeatures.entity.LostGiant;
import net.minecraft.client.model.geom.ModelLayers;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.HumanoidMobRenderer;
import net.minecraft.resources.Identifier;

public class GiantRenderer extends HumanoidMobRenderer<LostGiant, GiantRenderState, GiantModel> {
    private static final Identifier TEXTURE = LostFeatures.id("textures/entity/giant.png");

    public GiantRenderer(EntityRendererProvider.Context context) {
        super(context, new GiantModel(context.bakeLayer(ModelLayers.GIANT)), 3.0F);
    }

    @Override
    public Identifier getTextureLocation(GiantRenderState state) {
        return TEXTURE;
    }

    @Override
    public GiantRenderState createRenderState() {
        return new GiantRenderState();
    }

    @Override
    public void extractRenderState(LostGiant entity, GiantRenderState state, float partialTicks) {
        super.extractRenderState(entity, state, partialTicks);
        state.windup = GiantModel.windupProgress(entity);
        state.aggressive = entity.isAggressive();
    }
}
