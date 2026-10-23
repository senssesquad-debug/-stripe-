package com.lostfeatures.client.renderer;

import com.lostfeatures.LostFeatures;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.IllusionerRenderer;
import net.minecraft.client.renderer.entity.state.IllusionerRenderState;
import net.minecraft.resources.Identifier;

/** Vanilla illusioner rendering (mirror images included) with the mod's original robe texture. */
public class LostIllusionerRenderer extends IllusionerRenderer {
    private static final Identifier TEXTURE = LostFeatures.id("textures/entity/illusioner.png");

    public LostIllusionerRenderer(EntityRendererProvider.Context context) {
        super(context);
    }

    @Override
    public Identifier getTextureLocation(IllusionerRenderState state) {
        return TEXTURE;
    }
}
