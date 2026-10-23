package com.lostfeatures.client.renderer;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.client.model.RedDragonModel;
import com.lostfeatures.entity.RedDragon;
import net.minecraft.client.renderer.entity.EntityRendererProvider;
import net.minecraft.client.renderer.entity.MobRenderer;
import net.minecraft.resources.Identifier;
import net.minecraft.util.Mth;
import net.minecraft.world.phys.AABB;

public class RedDragonRenderer extends MobRenderer<RedDragon, RedDragonRenderState, RedDragonModel> {
    private static final Identifier TEXTURE = LostFeatures.id("textures/entity/red_dragon.png");
    private static final Identifier ANCESTRAL_TEXTURE = LostFeatures.id("textures/entity/ancestral_red_dragon.png");

    public RedDragonRenderer(EntityRendererProvider.Context context) {
        super(context, new RedDragonModel(context.bakeLayer(ModModelLayers.RED_DRAGON)), 1.8F);
    }

    @Override
    public Identifier getTextureLocation(RedDragonRenderState state) {
        return state.ancestral ? ANCESTRAL_TEXTURE : TEXTURE;
    }

    @Override
    public RedDragonRenderState createRenderState() {
        return new RedDragonRenderState();
    }

    @Override
    public void extractRenderState(RedDragon entity, RedDragonRenderState state, float partialTicks) {
        super.extractRenderState(entity, state, partialTicks);
        state.flying = entity.isFlying();
        state.breathState = entity.getBreathState();
        state.ancestral = entity.isAncestral();
        state.pitchHint = (float) Mth.clamp(-entity.getDeltaMovement().y * 0.8, -0.35, 0.35);
    }

    @Override
    protected AABB getBoundingBoxForCulling(RedDragon entity) {
        // Wings and tail extend well beyond the hitbox.
        return super.getBoundingBoxForCulling(entity).inflate(4.0, 1.5, 4.0);
    }
}
