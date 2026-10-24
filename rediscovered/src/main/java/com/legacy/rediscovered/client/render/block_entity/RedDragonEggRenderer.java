package com.legacy.rediscovered.client.render.block_entity;

import com.legacy.rediscovered.block.RedDragonEggBlock;
import com.legacy.rediscovered.block_entities.RedDragonEggBlockEntity;
import com.legacy.rediscovered.client.render.RediscoveredRendering;
import com.legacy.rediscovered.client.render.block_entity.state.RedDragonEggRenderState;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import net.minecraft.client.Minecraft;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.block.dispatch.BlockStateModel;
import net.minecraft.client.renderer.blockentity.BlockEntityRenderer;
import net.minecraft.client.renderer.blockentity.BlockEntityRendererProvider.Context;
import net.minecraft.client.renderer.feature.ModelFeatureRenderer.CrumblingOverlay;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.core.BlockPos;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;
import org.jspecify.annotations.Nullable;

public class RedDragonEggRenderer<T extends RedDragonEggBlockEntity, S extends RedDragonEggRenderState> implements BlockEntityRenderer<T, S> {
    public RedDragonEggRenderer(Context context) {
    }

    public void extractRenderState(T egg, S state, float partialTicks, Vec3 cameraPosition, @Nullable CrumblingOverlay breakProgress) {
        BlockEntityRenderer.super.extractRenderState(egg, state, partialTicks, cameraPosition, breakProgress);
        BlockPos pos = egg.getBlockPos();
        state.blockState = egg.getBlockState();
        state.hatchProgress = egg.getHatchProgress();
        state.maxShakeTime = egg.maxShakeTime();
        state.canHatch = egg.canHatch();
        state.isShaking = egg.isShaking();
        state.shakeTime = egg.clientShakeTime(partialTicks);
        state.xShake = egg.clientXShakeDir;
        state.yShake = egg.clientYShakeDir;
        state.zShake = egg.clientZShakeDir;
        state.movingBlockRenderState.randomSeedPos = pos;
        state.movingBlockRenderState.blockPos = pos;
        state.movingBlockRenderState.blockState = egg.getBlockState();
        ClientLevel clientLevel = Minecraft.getInstance().level;
        state.movingBlockRenderState.biome = clientLevel.getBiome(pos);
        state.movingBlockRenderState.cardinalLighting = clientLevel.cardinalLighting();
        state.movingBlockRenderState.lightEngine = clientLevel.getLightEngine();
    }

    public void submit(S egg, PoseStack poseStack, SubmitNodeCollector submitNodeCollector, CameraRenderState camera) {
        if (!egg.blockState.hasProperty(RedDragonEggBlock.FALLING) || !egg.blockState.getValue(RedDragonEggBlock.FALLING)) {
            poseStack.pushPose();
            BlockStateModel model = Minecraft.getInstance().getModelManager().getBlockStateModelSet().get(egg.blockState);
            poseStack.translate(0.5, 0.5, 0.5);
            if (egg.canHatch && egg.isShaking) {
                float hatchProgress = egg.hatchProgress;
                hatchProgress = hatchProgress * hatchProgress * hatchProgress * hatchProgress;
                float bounces = 1.0F;
                float bounceHeight = 0.1F * hatchProgress;
                float period = (float) (Math.PI * 2) / (egg.maxShakeTime / bounces);
                float bounce = (float)Math.sin(period * egg.shakeTime) * bounceHeight;
                if (bounce > 0.0F) {
                    float shakeAmount = 9.0F * hatchProgress;
                    float turnAmount = 15.0F * hatchProgress;
                    poseStack.mulPose(Axis.XP.rotationDegrees((float)Math.sin(period * 2.0F * egg.shakeTime) * shakeAmount * egg.xShake));
                    poseStack.mulPose(Axis.ZP.rotationDegrees((float)Math.sin(period * 2.0F * egg.shakeTime) * shakeAmount * egg.zShake));
                    poseStack.mulPose(Axis.YP.rotationDegrees((float)Math.sin(period * 2.0F * egg.shakeTime) * turnAmount * egg.yShake));
                    poseStack.translate(0.0F, bounce, 0.0F);
                }
            }

            poseStack.translate(-0.5, -0.5, -0.5);
            submitNodeCollector.submitMovingBlock(poseStack, egg.movingBlockRenderState);
            if (Minecraft.getInstance().hitResult instanceof BlockHitResult blockHit
                && blockHit.getBlockPos().equals(egg.blockPos)
                && !Minecraft.getInstance().options.hideGui) {
                poseStack.pushPose();
                RediscoveredRendering.renderHitOutline(
                    poseStack,
                    submitNodeCollector,
                    RenderTypes.lines(),
                    Minecraft.getInstance().getCameraEntity(),
                    0.0,
                    0.0,
                    0.0,
                    BlockPos.ZERO,
                    egg.blockState
                );
                poseStack.popPose();
            }

            poseStack.popPose();
        }
    }

    @Override
    public int getViewDistance() {
        return Minecraft.getInstance().options.renderDistance().get() * 16;
    }

    public S createRenderState() {
        return (S)(new RedDragonEggRenderState());
    }
}
