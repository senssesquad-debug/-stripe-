package com.legacy.rediscovered.client.gui;

import com.mojang.blaze3d.platform.Lighting.Entry;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.render.pip.PictureInPictureRenderer;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.EntityRenderDispatcher;
import net.minecraft.client.renderer.feature.FeatureRenderDispatcher;
import net.minecraft.client.renderer.state.gui.GuiRenderState;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import org.joml.Quaternionf;
import org.joml.Vector3f;

public class EntityPiPRenderer extends PictureInPictureRenderer<EntityPiPRenderState> {
    private final EntityRenderDispatcher entityRenderDispatcher = Minecraft.getInstance().getEntityRenderDispatcher();

    public EntityPiPRenderer() {
    }

    @Override
    public Class<EntityPiPRenderState> getRenderStateClass() {
        return EntityPiPRenderState.class;
    }

    @Override
    public void prepare(EntityPiPRenderState renderState, GuiRenderState guiRenderState, FeatureRenderDispatcher featureRenderDispatcher, int guiScale) {
        int specialGuiScale = Math.round(guiScale + renderState.guiScale());
        super.prepare(renderState, guiRenderState, featureRenderDispatcher, specialGuiScale);
    }

    @Override
    protected void renderToTexture(EntityPiPRenderState entityState, PoseStack poseStack, SubmitNodeCollector submitNodeCollector) {
        Minecraft.getInstance().gameRenderer.lighting().setupFor(Entry.ENTITY_IN_UI);
        Vector3f translation = entityState.translation();
        poseStack.translate(translation.x, translation.y, translation.z);
        poseStack.mulPose(entityState.rotation());
        Quaternionf overriddenCameraAngle = entityState.overrideCameraAngle();
        CameraRenderState cameraRenderState = new CameraRenderState();
        if (overriddenCameraAngle != null) {
            cameraRenderState.orientation = overriddenCameraAngle.conjugate(new Quaternionf()).rotateY((float) Math.PI);
        }

        this.entityRenderDispatcher.submit(entityState.renderState(), cameraRenderState, 0.0, 0.0, 0.0, poseStack, submitNodeCollector);
    }

    @Override
    protected float getTranslateY(int height, int guiScale) {
        return height / 2.0F;
    }

    @Override
    protected String getTextureLabel() {
        return "rediscovered_entity_pip";
    }
}
