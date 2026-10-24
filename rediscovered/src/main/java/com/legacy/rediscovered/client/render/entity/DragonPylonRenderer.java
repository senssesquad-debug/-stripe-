package com.legacy.rediscovered.client.render.entity;

import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.client.RediscoveredRenderRefs;
import com.legacy.rediscovered.client.render.RediscoveredRenderTypes;
import com.legacy.rediscovered.client.render.entity.state.DragonPylonRenderState;
import com.legacy.rediscovered.entity.dragon.DragonPylonEntity;
import com.legacy.rediscovered.entity.dragon.RedDragonBossEntity;
import com.legacy.rediscovered.registry.RediscoveredBlocks;
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
import net.minecraft.client.renderer.culling.Frustum;
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
import net.minecraft.resources.Identifier;
import net.minecraft.util.ARGB;
import net.minecraft.util.Mth;
import org.joml.Quaternionf;

public class DragonPylonRenderer<T extends DragonPylonEntity, S extends DragonPylonRenderState> extends EntityRenderer<T, S> {
    public static final SpriteMapper SHIELD_MAPPER = new SpriteMapper(TextureAtlas.LOCATION_BLOCKS, "entity/dragon_pylon");
    public static final SpriteId SHIELD_SPRITE = SHIELD_MAPPER.apply(RediscoveredMod.locate("energy_shield"));
    private static final Identifier PYLON_TEXTURE = RediscoveredMod.locate("textures/entity/dragon_pylon/core.png");
    private static final Identifier PYLON_BEAM_TEXTURE = RediscoveredMod.locate("textures/entity/dragon_pylon/beam.png");
    public static final RenderType RENDER_TYPE = RediscoveredRenderTypes.sortedEntityTranslucent(PYLON_TEXTURE);
    private static final RenderType BEAM_RENDER_TYPE = RediscoveredRenderTypes.energy(PYLON_BEAM_TEXTURE);
    public static final float SIN_45 = Mth.sin((float) (Math.PI / 4));
    private final ModelPart cube;
    private final SpriteGetter sprites;

    public DragonPylonRenderer(Context context) {
        super(context);
        this.sprites = context.getSprites();
        this.shadowRadius = 0.5F;
        ModelPart modelpart = context.bakeLayer(RediscoveredRenderRefs.DRAGON_PYLON);
        this.cube = modelpart.getChild("cube");
    }

    public static LayerDefinition createBodyLayer() {
        MeshDefinition meshdefinition = new MeshDefinition();
        PartDefinition partdefinition = meshdefinition.getRoot();
        partdefinition.addOrReplaceChild("cube", CubeListBuilder.create().texOffs(0, 0).addBox(-4.0F, -4.0F, -4.0F, 8.0F, 8.0F, 8.0F), PartPose.ZERO);
        return LayerDefinition.create(meshdefinition, 32, 16);
    }

    public void extractRenderState(T entity, S state, float partialTicks) {
        super.extractRenderState(entity, state, partialTicks);
        state.time = entity.time;
        state.attachedDragon = entity.getAttachedDragon();
        state.layerCount = entity.getLayerCount();
        state.blockPos = entity.blockPosition();
        BlockPos top = entity.blockPosition().above(6);
        state.atDungeon = entity.level().getBlockState(top).is(RediscoveredBlocks.obsidian_bulb);
        state.hasRedOverlay = entity.hurtTime > 0 || entity.isDeadOrDying();
    }

    public void submit(S state, PoseStack pose, SubmitNodeCollector submitNodeCollector, CameraRenderState camera) {
        float partialTicks = state.partialTick;
        float y = getY(state.time, partialTicks);
        float yRenderOffset = y / 2.0F;
        float rot = (state.time + partialTicks) * 3.0F;
        float scale = 4.0F;
        pose.pushPose();
        pose.translate(0.0F, 1.5F + yRenderOffset, 0.0F);
        pose.scale(scale, scale, scale);
        float cubeScale = 0.5F;
        pose.scale(cubeScale, cubeScale, cubeScale);
        pose.mulPose(new Quaternionf().setAngleAxis((float) (Math.PI / 3), SIN_45, 0.0F, SIN_45));
        pose.mulPose(Axis.YP.rotationDegrees(rot));
        pose.mulPose(Axis.XP.rotationDegrees(rot * 2.0F));
        pose.mulPose(Axis.ZP.rotationDegrees(rot * 3.0F));
        submitNodeCollector.submitModelPart(this.cube, pose, RENDER_TYPE, 15728880, state.hasRedOverlay ? 3 : OverlayTexture.NO_OVERLAY, null);
        pose.popPose();
        RedDragonBossEntity dragon = state.attachedDragon;
        if (dragon != null) {
            boolean atDungeon = state.atDungeon;
            double yOff = atDungeon ? 5 : 0;
            double f3 = Mth.lerp(partialTicks, dragon.xOld, dragon.getX());
            double f4 = Mth.lerp(partialTicks, dragon.yOld, dragon.getY());
            double f5 = Mth.lerp(partialTicks, dragon.zOld, dragon.getZ());
            float f6 = (float)(f3 - state.x);
            float f7 = (float)(f4 - (state.y + yOff));
            float f8 = (float)(f5 - state.z);
            pose.pushPose();
            pose.translate(f6, f7 + yOff, f8);
            renderPylonBeam(-f6, -f7 + (atDungeon ? 0.0F : y), -f8, partialTicks, state.time, pose, submitNodeCollector, 15728880, 270.0F, 2.5F, 0.3F, 1.0F);
            pose.popPose();
            if (atDungeon) {
                pose.pushPose();
                BlockPos top = BlockPos.containing(state.x, state.y + 6.0, state.z);
                f3 = top.getX() + 0.5F;
                f4 = top.getY();
                f5 = top.getZ() + 0.5F;
                f6 = (float)(f3 - state.x);
                f7 = (float)(f4 - state.y);
                f8 = (float)(f5 - state.z);
                pose.translate(f6, f7, f8);
                renderPylonBeam(-f6, -f7 + yRenderOffset - 0.4F, -f8, partialTicks, state.time, pose, submitNodeCollector, 15728880, 90.0F);
                pose.popPose();
            }
        }

        pose.pushPose();
        pose.translate(0.0F, 1.5F + yRenderOffset, 0.0F);
        pose.scale(scale, scale, scale);
        RenderType shieldRenderType = SHIELD_SPRITE.renderType(RediscoveredRenderTypes::energy);
        TextureAtlasSprite shieldSprite = this.sprites.get(SHIELD_SPRITE);
        float glassScale = 1.0F;
        float glassScaleMul = 1.18F;
        int glassLayers = state.layerCount;
        renderPylonShields(this.cube, pose, submitNodeCollector, shieldRenderType, shieldSprite, 15728880, rot, glassScale, glassScaleMul, glassLayers);
        pose.popPose();
        super.submit(state, pose, submitNodeCollector, camera);
    }

    public static void renderPylonShields(
        ModelPart cube,
        PoseStack poseStack,
        SubmitNodeCollector submitNodeCollector,
        RenderType type,
        TextureAtlasSprite sprite,
        int lightCoords,
        float rotation,
        float scale,
        float scaleMul,
        int layers
    ) {
        renderPylonShields(cube, poseStack, submitNodeCollector, type, sprite, lightCoords, rotation, scale, scaleMul, layers, 1.0F);
    }

    public static void renderPylonShields(
        ModelPart cube,
        PoseStack poseStack,
        SubmitNodeCollector submitNodeCollector,
        RenderType type,
        TextureAtlasSprite sprite,
        int lightCoords,
        float rotation,
        float scale,
        float scaleMul,
        int layers,
        float alpha
    ) {
        poseStack.pushPose();

        for (int i = 0; i < layers; i++) {
            poseStack.scale(scale, scale, scale);
            poseStack.mulPose(new Quaternionf().setAngleAxis((float) (Math.PI / 3), SIN_45, 0.0F, SIN_45));
            poseStack.mulPose(Axis.YP.rotationDegrees(-rotation));
            poseStack.mulPose(Axis.XP.rotationDegrees(rotation * 0.4F));
            poseStack.mulPose(Axis.ZP.rotationDegrees(rotation * -0.1F));
            submitNodeCollector.order(1 + i)
                .submitModelPart(cube, poseStack, type, lightCoords, OverlayTexture.NO_OVERLAY, sprite, false, false, ARGB.white(alpha), null, 0);
            scale *= scaleMul;
        }

        poseStack.popPose();
    }

    public static void renderPylonBeam(
        float x,
        float y,
        float z,
        float partialTick,
        int tickCount,
        PoseStack poseStack,
        SubmitNodeCollector submitNodeCollector,
        int packedLight,
        float zRotation
    ) {
        renderPylonBeam(x, y, z, partialTick, tickCount, poseStack, submitNodeCollector, packedLight, zRotation, 0.2F, 0.8F, 1.0F);
    }

    public static void renderPylonBeam(
        float x,
        float y,
        float z,
        float partialTick,
        int tickCount,
        PoseStack poseStack,
        SubmitNodeCollector submitNodeCollector,
        int packedLight,
        float zRotation,
        float topWidth,
        float bottomWidth,
        float endAlpha
    ) {
        float f = Mth.sqrt(x * x + z * z);
        float f1 = Mth.sqrt(x * x + y * y + z * z);
        poseStack.pushPose();
        poseStack.translate(0.0F, 2.0F, 0.0F);
        poseStack.mulPose(Axis.YP.rotation((float)(-Math.atan2(z, x)) - (float) (Math.PI / 2)));
        poseStack.mulPose(Axis.XP.rotation((float)(-Math.atan2(f, y)) - (float) (Math.PI / 2)));
        poseStack.mulPose(Axis.ZP.rotation(zRotation));
        float speed = 0.03F;
        float motion = (tickCount + partialTick) * speed;
        float f2 = 0.0F + motion;
        float f3 = Mth.sqrt(x * x + y * y + z * z) / 32.0F + motion;
        int sides = 6;
        submitNodeCollector.order(0)
            .submitCustomGeometry(
                poseStack,
                BEAM_RENDER_TYPE,
                (poseIn, buffer) -> {
                    for (int j = 1; j <= sides; j++) {
                        float f7 = Mth.sin(j * (float) (Math.PI * 2) / sides) * 0.75F;
                        float f8 = Mth.cos(j * (float) (Math.PI * 2) / sides) * 0.75F;
                        float f9 = (float)j / sides;
                        float f4 = 0.0F;
                        float f5 = 0.75F;
                        float f6 = 0.0F;
                        float startColor = 1.0F;
                        float startAlpha = 1.0F;
                        float endColor = 0.75F;
                        buffer.addVertex(poseIn, f4 * topWidth, f5 * topWidth, 0.0F)
                            .setColor(endColor, endColor, endColor, endAlpha)
                            .setUv(f6, f2)
                            .setOverlay(OverlayTexture.NO_OVERLAY)
                            .setLight(packedLight)
                            .setNormal(0.0F, -1.0F, 0.0F);
                        buffer.addVertex(poseIn, f4 * bottomWidth, f5 * bottomWidth, f1)
                            .setColor(startColor, startColor, startColor, startAlpha)
                            .setUv(f6, f3)
                            .setOverlay(OverlayTexture.NO_OVERLAY)
                            .setLight(packedLight)
                            .setNormal(0.0F, -1.0F, 0.0F);
                        buffer.addVertex(poseIn, f7 * bottomWidth, f8 * bottomWidth, f1)
                            .setColor(startColor, startColor, startColor, startAlpha)
                            .setUv(f9, f3)
                            .setOverlay(OverlayTexture.NO_OVERLAY)
                            .setLight(packedLight)
                            .setNormal(0.0F, -1.0F, 0.0F);
                        buffer.addVertex(poseIn, f7 * topWidth, f8 * topWidth, 0.0F)
                            .setColor(endColor, endColor, endColor, endAlpha)
                            .setUv(f9, f2)
                            .setOverlay(OverlayTexture.NO_OVERLAY)
                            .setLight(packedLight)
                            .setNormal(0.0F, -1.0F, 0.0F);
                    }
                }
            );
        poseStack.popPose();
    }

    public static float getY(int time, float pPartialTick) {
        float f = time + pPartialTick;
        float f1 = Mth.sin(f * 0.1F) / 2.0F + 1.7F;
        f1 = (f1 * f1 + f1) * 0.2F;
        return f1 - 1.4F;
    }

    public boolean shouldRender(T pLivingEntity, Frustum pCamera, double pCamX, double pCamY, double pCamZ) {
        return super.shouldRender(pLivingEntity, pCamera, pCamX, pCamY, pCamZ) || pLivingEntity.getAttachedDragonUUID().isPresent();
    }

    public S createRenderState() {
        return (S)(new DragonPylonRenderState());
    }
}
