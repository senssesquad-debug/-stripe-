package com.legacy.rediscovered.client.render.entity;

import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.client.RediscoveredRenderRefs;
import com.legacy.rediscovered.client.render.RediscoveredRenderTypes;
import com.legacy.rediscovered.client.render.RediscoveredRendering;
import com.legacy.rediscovered.client.render.entity.state.ThunderCloudRenderState;
import com.legacy.rediscovered.entity.dragon.ThunderCloudEntity;
import com.mojang.blaze3d.vertex.PoseStack;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.EntityRenderer;
import net.minecraft.client.renderer.entity.EntityRendererProvider.Context;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.core.BlockPos;
import net.minecraft.resources.Identifier;
import net.minecraft.util.ARGB;
import net.minecraft.util.Mth;
import net.minecraft.util.valueproviders.ConstantFloat;
import net.minecraft.util.valueproviders.UniformFloat;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;

public class ThunderCloudRenderer<T extends ThunderCloudEntity, S extends ThunderCloudRenderState> extends EntityRenderer<T, S> {
    public static final Identifier TEXTURE = RediscoveredMod.locate("textures/entity/thunder_cloud/thunder_cloud.png");
    public static final Identifier TEXTURE_MAP = RediscoveredMod.locate("textures/entity/thunder_cloud/thunder_cloud_map.png");
    private final ModelPart cloud;

    public ThunderCloudRenderer(Context pContext) {
        super(pContext);
        this.cloud = pContext.bakeLayer(RediscoveredRenderRefs.THUNDER_CLOUD);
    }

    public static RediscoveredRendering.Bolt createBolt(float length, boolean centered) {
        RediscoveredRendering.Bolt bolt = RediscoveredRendering.bolt()
            .layers(2)
            .bolts(1)
            .startScale(centered ? 0.3F : 0.2F)
            .endScale(centered ? 0.1F : 0.05F)
            .centerSpacing(0.0F)
            .length(length)
            .turns(5, 7)
            .rotationDegrees(ConstantFloat.ZERO, UniformFloat.of(0.0F, 360.0F), ConstantFloat.of(180.0F))
            .color(UniformFloat.of(0.2F, 0.6F), UniformFloat.of(0.65F, 0.85F), UniformFloat.of(0.8F, 1.0F), ConstantFloat.of(0.3F));
        if (centered) {
            bolt.limitedChaos().recenterAtTip();
        }

        return bolt;
    }

    protected int getBlockLightLevel(T entity, BlockPos pos) {
        return 15;
    }

    protected AABB getBoundingBoxForCulling(T entity) {
        return super.getBoundingBoxForCulling(entity).expandTowards(0.0, -entity.getStrikeDistance(), 0.0);
    }

    public void extractRenderState(T entity, S state, float partialTicks) {
        super.extractRenderState(entity, state, partialTicks);
        state.strikeDistance = entity.getStrikeDistance();
        state.strikeTime = entity.getStrikeTime();
        state.renderOffsets = entity.renderOffsets;
        state.uuidHash = entity.getUUID().hashCode();
    }

    public void submit(S state, PoseStack pose, SubmitNodeCollector submitNodeCollector, CameraRenderState camera) {
        float ageInTicks = state.ageInTicks;
        float partialTicks = state.partialTick;
        float boltLength = state.strikeDistance;
        if (boltLength != 0.0F && state.strikeTime > 0) {
            int boltSeed = (int)((ageInTicks - partialTicks + state.uuidHash / 100) / 2.0F * 10.0F);
            createBolt(boltLength / 3.0F, false).submit(pose, submitNodeCollector, boltSeed * 10);
            createBolt(boltLength / 2.0F, false).submit(pose, submitNodeCollector, boltSeed * 30);
            createBolt(boltLength, true).submit(pose, submitNodeCollector, boltSeed);
        }

        pose.pushPose();
        float enterScale = 0.0F + Math.min(1.0F, ageInTicks * 0.03F);
        pose.scale(enterScale, enterScale, enterScale);

        for (int c = 0; c < state.renderOffsets.size(); c++) {
            Vec3 offset = state.renderOffsets.get(c);
            int seed = Math.abs(offset.hashCode());
            float offsetScale = 1.0F * Math.min(1.0F, ageInTicks * 0.02F);
            pose.pushPose();
            pose.translate(offset.x * offsetScale, (state.boundingBoxHeight / 2.0F + offset.y) * offsetScale, offset.z * offsetScale);
            float s = 1.0F + seed % 4 * 0.3F;
            float speed = ageInTicks * (0.2F + seed % 8 * 0.02F);
            float speedSeed = seed % 10;
            float distance = 0.2F;
            pose.translate(Math.sin(speed - speedSeed) * distance, Math.sin(speed + speedSeed) * distance, Math.cos(speed - speedSeed) * distance);
            pose.scale(
                1.0F + (float)Math.sin(speed / 2.0F - speedSeed) * distance,
                1.0F + (float)Math.sin(speed / 2.0F + speedSeed) * distance,
                1.0F + (float)Math.cos(speed / 2.0F - speedSeed) * distance
            );
            pose.scale(s, s, s);
            float a = 0.5F;
            submitNodeCollector.submitModelPart(
                this.cloud,
                pose,
                RediscoveredRenderTypes.sortedEntityTranslucentCull(TEXTURE),
                state.lightCoords,
                OverlayTexture.NO_OVERLAY,
                null,
                false,
                false,
                ARGB.white(a),
                null,
                state.outlineColor
            );
            pose.popPose();
        }

        pose.pushPose();
        float scale = 3.0F;
        float xz = Mth.cos(0.0F + ageInTicks * 0.2F) * 0.1F;
        float y = Mth.sin(0.0F + ageInTicks * 0.2F) * 0.1F;
        float base = 1.0F;
        pose.scale(base + xz, base + y, base + xz);
        pose.scale(scale, scale, scale);
        float alpha = 0.5F;
        submitNodeCollector.submitModelPart(
            this.cloud,
            pose,
            RediscoveredRenderTypes.sortedEntityTranslucentCull(TEXTURE),
            state.lightCoords,
            OverlayTexture.NO_OVERLAY,
            null,
            false,
            false,
            ARGB.white(alpha),
            null,
            state.outlineColor
        );
        pose.popPose();
        pose.popPose();
        super.submit(state, pose, submitNodeCollector, camera);
    }

    public S createRenderState() {
        return (S)(new ThunderCloudRenderState());
    }
}
