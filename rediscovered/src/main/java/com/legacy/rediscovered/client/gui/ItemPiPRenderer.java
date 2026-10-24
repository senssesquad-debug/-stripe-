package com.legacy.rediscovered.client.gui;

import com.mojang.blaze3d.platform.Lighting.Entry;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.textures.FilterMode;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.Font.DisplayMode;
import net.minecraft.client.gui.navigation.ScreenRectangle;
import net.minecraft.client.gui.render.TextureSetup;
import net.minecraft.client.gui.render.pip.PictureInPictureRenderer;
import net.minecraft.client.renderer.RenderPipelines;
import net.minecraft.client.renderer.SubmitNodeStorage;
import net.minecraft.client.renderer.MultiBufferSource.BufferSource;
import net.minecraft.client.renderer.feature.FeatureRenderDispatcher;
import net.minecraft.client.renderer.item.TrackingItemStackRenderState;
import net.minecraft.client.renderer.state.gui.BlitRenderState;
import net.minecraft.client.renderer.state.gui.GuiItemRenderState;
import net.minecraft.client.renderer.state.gui.GuiRenderState;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.network.chat.Component;
import net.minecraft.util.ARGB;
import net.minecraft.util.FormattedCharSequence;

public class ItemPiPRenderer extends PictureInPictureRenderer<ItemPiPRenderState> {
    public ItemPiPRenderer(BufferSource bufferSource) {
        super(bufferSource);
    }

    @Override
    public Class<ItemPiPRenderState> getRenderStateClass() {
        return ItemPiPRenderState.class;
    }

    protected void renderToTexture(ItemPiPRenderState renderState, PoseStack poseStack) {
        poseStack.scale(1.0F, -1.0F, -1.0F);
        Minecraft mc = Minecraft.getInstance();
        GuiItemRenderState guiItemRenderState = renderState.guiItemRenderState();
        ScreenRectangle itemBounds = guiItemRenderState.bounds();
        float itemBoundsCenterX = (itemBounds.left() + itemBounds.right()) / 2.0F;
        float itemBoundsCenterY = (itemBounds.top() + itemBounds.bottom()) / 2.0F;
        float slotCenterX = guiItemRenderState.x() + 8.0F;
        float slotCenterY = guiItemRenderState.y() + 8.0F;
        poseStack.translate((slotCenterX - itemBoundsCenterX) / 16.0F, (itemBoundsCenterY - slotCenterY) / 16.0F, 0.0F);
        TrackingItemStackRenderState itemStackRenderState = guiItemRenderState.itemStackRenderState();
        boolean flat = !itemStackRenderState.usesBlockLight();
        if (flat) {
            mc.gameRenderer.getLighting().setupFor(Entry.ITEMS_FLAT);
        } else {
            mc.gameRenderer.getLighting().setupFor(Entry.ITEMS_3D);
        }

        FeatureRenderDispatcher featureRenderDispatcher = mc.gameRenderer.getFeatureRenderDispatcher();
        SubmitNodeStorage submitNodeStorage = featureRenderDispatcher.getSubmitNodeStorage();
        itemStackRenderState.submit(poseStack, submitNodeStorage, 15728880, OverlayTexture.NO_OVERLAY, 0);
        if (renderState.itemCount() > 1) {
            this.renderCount(renderState, poseStack, submitNodeStorage);
        }

        featureRenderDispatcher.renderAllFeatures();
    }

    private void renderCount(ItemPiPRenderState renderState, PoseStack poseStack, SubmitNodeStorage submitNodeCollector) {
        Minecraft mc = Minecraft.getInstance();
        FormattedCharSequence formatted = Component.literal(Integer.toString(renderState.itemCount())).getVisualOrderText();
        poseStack.pushPose();
        float scale = 1.0F / renderState.scale();
        poseStack.scale(scale, -scale, scale);
        poseStack.translate(9 - mc.font.width(formatted), 1.0F, 10.0F);
        submitNodeCollector.submitText(poseStack, 0.0F, 0.0F, formatted, true, DisplayMode.NORMAL, 15728880, ARGB.white(255), ARGB.alpha(0), 0);
        poseStack.popPose();
    }

    public void blitTexture(ItemPiPRenderState renderState, GuiRenderState guiRenderState) {
        int a = ARGB.as8BitChannel(renderState.alpha());
        guiRenderState.addBlitToCurrentLayer(
            new BlitRenderState(
                RenderPipelines.GUI_TEXTURED_PREMULTIPLIED_ALPHA,
                TextureSetup.singleTexture(this.textureView, RenderSystem.getSamplerCache().getRepeat(FilterMode.NEAREST)),
                renderState.pose(),
                renderState.x0(),
                renderState.y0(),
                renderState.x1(),
                renderState.y1(),
                0.0F,
                1.0F,
                1.0F,
                0.0F,
                ARGB.color(a, a, a, a),
                renderState.scissorArea(),
                null
            )
        );
    }

    public boolean textureIsReadyToBlit(ItemPiPRenderState renderState) {
        return false;
    }

    @Override
    protected float getTranslateY(int height, int guiScale) {
        return height / 2.0F;
    }

    @Override
    protected String getTextureLabel() {
        return "rediscovered_item_pip";
    }
}
