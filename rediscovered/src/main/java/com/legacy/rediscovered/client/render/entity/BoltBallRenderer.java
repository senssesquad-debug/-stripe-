package com.legacy.rediscovered.client.render.entity;

import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.client.RediscoveredRenderRefs;
import com.legacy.rediscovered.client.render.RediscoveredRenderTypes;
import com.legacy.rediscovered.client.render.RediscoveredRendering;
import com.legacy.rediscovered.client.render.entity.state.BoltBallRenderState;
import com.legacy.rediscovered.entity.dragon.BoltBallEntity;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.client.renderer.SpriteMapper;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.client.renderer.entity.EntityRendererProvider.Context;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.client.renderer.texture.TextureAtlas;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
import net.minecraft.client.resources.model.sprite.SpriteGetter;
import net.minecraft.client.resources.model.sprite.SpriteId;
import net.minecraft.core.BlockPos;
import net.minecraft.util.ARGB;
import net.minecraft.util.valueproviders.ConstantFloat;
import net.minecraft.util.valueproviders.UniformFloat;

public class BoltBallRenderer<T extends BoltBallEntity, S extends BoltBallRenderState> extends EntityRenderer<T, S> {
    public static final SpriteMapper WIND_MAPPER = new SpriteMapper(TextureAtlas.LOCATION_BLOCKS, "entity/bolt_ball");
    public static final SpriteId WIND_SPRITE = WIND_MAPPER.apply(RediscoveredMod.locate("wind"));
    private final ModelPart wind;
    private final RediscoveredRendering.Bolt bolt = createBolt();
    private final SpriteGetter sprites;

    public BoltBallRenderer(Context context) {
        super(context);
        this.sprites = context.getSprites();
        this.wind = context.bakeLayer(RediscoveredRenderRefs.BOLT_BALL_WIND);
    }

    public static RediscoveredRendering.Bolt createBolt() {
        return RediscoveredRendering.bolt()
            .layers(2)
            .bolts(10)
            .startScale(0.06F)
            .endScale(0.001F)
            .centerSpacing(0.0F)
            .length(1.0F, 1.5F)
            .turns(3, 5)
            .color(UniformFloat.of(0.2F, 0.6F), UniformFloat.of(0.65F, 0.85F), UniformFloat.of(0.8F, 1.0F), ConstantFloat.of(0.3F));
    }

    protected int getBlockLightLevel(T entity, BlockPos pos) {
        return 15;
    }

    public void submit(S state, PoseStack pose, SubmitNodeCollector submitNodeCollector, CameraRenderState camera) {
        RenderType windRenderType = WIND_SPRITE.renderType(RediscoveredRenderTypes::sortedEntityTranslucent);
        TextureAtlasSprite windSprite = this.sprites.get(WIND_SPRITE);
        float t = state.ageInTicks;
        float centerY = state.boundingBoxHeight / 2.0F;
        pose.pushPose();
        pose.translate(0.0F, centerY, 0.0F);
        this.bolt.submit(pose, submitNodeCollector, state.seed);
        pose.popPose();
        float windScale = 2.0F;
        float wobbleSpeed = 0.5F;
        float wobbleScale = 0.3F;
        float windSpeed = 23.0F;
        float windAlpha = 0.6F;
        pose.pushPose();
        pose.translate(0.0F, centerY, 0.0F);
        pose.scale(windScale + (float)Math.sin(t * wobbleSpeed) * wobbleScale, windScale, windScale + (float)Math.cos(t * wobbleSpeed) * wobbleScale);
        pose.mulPose(Axis.ZP.rotationDegrees((float)Math.sin(t) * 5.0F));
        pose.mulPose(Axis.YP.rotationDegrees(t * windSpeed));
        submitNodeCollector.submitModelPart(
            this.wind,
            pose,
            windRenderType,
            state.lightCoords,
            OverlayTexture.NO_OVERLAY,
            windSprite,
            ARGB.white(windAlpha),
            null,
            state.outlineColor
        );
        pose.popPose();
        windScale = 1.3F;
        float offset = 0.7F;
        pose.pushPose();
        pose.translate(0.0F, centerY + offset, 0.0F);
        pose.scale(windScale + (float)Math.sin(t * wobbleSpeed) * wobbleScale, windScale, windScale + (float)Math.cos(t * wobbleSpeed) * wobbleScale);
        pose.mulPose(Axis.ZP.rotationDegrees((float)Math.cos(t) * 5.0F));
        pose.mulPose(Axis.YP.rotationDegrees(t * -windSpeed * 1.3F));
        pose.mulPose(Axis.XP.rotationDegrees(180.0F));
        submitNodeCollector.submitModelPart(
            this.wind,
            pose,
            windRenderType,
            state.lightCoords,
            OverlayTexture.NO_OVERLAY,
            windSprite,
            ARGB.white(windAlpha),
            null,
            state.outlineColor
        );
        pose.popPose();
        pose.pushPose();
        pose.translate(0.0F, centerY - offset, 0.0F);
        pose.scale(windScale + (float)Math.sin(t * wobbleSpeed) * wobbleScale, windScale, windScale + (float)Math.cos(t * wobbleSpeed) * wobbleScale);
        pose.mulPose(Axis.ZP.rotationDegrees((float)Math.cos(t) * 5.0F));
        pose.mulPose(Axis.YP.rotationDegrees(t * -windSpeed * 1.2F));
        pose.mulPose(Axis.XP.rotationDegrees(180.0F));
        submitNodeCollector.submitModelPart(
            this.wind,
            pose,
            windRenderType,
            state.lightCoords,
            OverlayTexture.NO_OVERLAY,
            windSprite,
            ARGB.white(windAlpha),
            null,
            state.outlineColor
        );
        pose.popPose();
        super.submit(state, pose, submitNodeCollector, camera);
    }

    public static LayerDefinition createWindLayer() {
        MeshDefinition meshdefinition = new MeshDefinition();
        PartDefinition partdefinition = meshdefinition.getRoot();
        partdefinition.addOrReplaceChild("wind", CubeListBuilder.create().texOffs(0, 0).addBox(-8.0F, -8.0F, -8.0F, 16.0F, 16.0F, 16.0F), PartPose.ZERO);
        return LayerDefinition.create(meshdefinition, 64, 32);
    }

    public void extractRenderState(T entity, S state, float partialTicks) {
        super.extractRenderState(entity, state, partialTicks);
        state.seed = entity.getSeed();
    }

    public S createRenderState() {
        return (S)(new BoltBallRenderState());
    }
}
