package com.legacy.structure_gel.core.client.renderers.building_tool;

import com.mojang.blaze3d.PrimitiveTopology;
import com.legacy.structure_gel.core.SGConfig;
import com.legacy.structure_gel.core.client.SGRenderType;
import com.legacy.structure_gel.core.client.renderers.BuildingToolRenderer;
import com.legacy.structure_gel.core.client.renderers.IRenderBase;
import com.legacy.structure_gel.core.item.building_tool.BuildingToolItem;
import com.legacy.structure_gel.core.item.building_tool.CapturedBlocks;
import com.legacy.structure_gel.core.item.building_tool.ToolModeProperty;
import com.legacy.structure_gel.core.item.building_tool.modes.CloneTool;
import com.mojang.blaze3d.buffers.GpuBufferSlice.MappedView;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.vertex.BufferBuilder;
import com.mojang.blaze3d.vertex.ByteBufferBuilder;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.MeshData;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.PoseStack.Pose;
import java.nio.ByteBuffer;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.CompletableFuture;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.renderer.MappableRingBuffer;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Vec3i;
import net.minecraft.util.RandomSource;
import net.minecraft.util.Util;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.Mirror;
import net.minecraft.world.level.block.Rotation;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.phys.shapes.VoxelShape;
import org.jspecify.annotations.Nullable;

public class CloneToolRenderer extends BuildingToolRenderer.ForCorners {
    private @Nullable CapturedBlocks capturedBlocksCache = null;
    private Mirror mirror = Mirror.NONE;
    private Rotation rotation = Rotation.NONE;
    private @Nullable MappableRingBuffer destBuffer;
    private int destIndexCount = 0;
    private final ByteBufferBuilder destBufferBuilder = SGRenderType.createWireframeBuffer();
    private @Nullable CompletableFuture<BuildingToolRenderer.RenderResult> destFutureRender = null;
    private BuildingToolRenderer.RenderInfo destLastRenderInfo = new BuildingToolRenderer.RenderInfo();

    @Override
    protected float[] getOutlineRGB() {
        return new float[]{0.0F, 0.85F, 0.0F};
    }

    @Override
    protected void updateData(Minecraft mc, ItemStack stack) {
        super.updateData(mc, stack);
        CapturedBlocks captured = BuildingToolItem.getCapturedBlocks(stack, mc.level, mc.player);
        if (!Objects.equals(captured, this.capturedBlocksCache)) {
            this.needsUpdated = true;
            this.selectionChanged = true;
        }

        if (this.needsUpdated && (this.selectionChanged || this.itemChanged) && BuildingToolItem.getSelectedCorner(stack) == null) {
            if (this.pos != null && this.secondPos != null && captured != null) {
                RandomSource rand = mc.level.getRandom();
                ToolModeProperty.SGMirror mirrorProp = BuildingToolItem.getProperty(stack, ToolModeProperty.MIRROR);
                this.mirror = (mirrorProp == ToolModeProperty.SGMirror.RANDOM ? ToolModeProperty.SGMirror.NONE : mirrorProp).toVanilla(rand);
                ToolModeProperty.SGRotation rotationProp = BuildingToolItem.getProperty(stack, ToolModeProperty.ROTATION);
                this.rotation = (rotationProp == ToolModeProperty.SGRotation.RANDOM ? ToolModeProperty.SGRotation.R_0 : rotationProp).toVanilla(rand);
                CapturedBlocks capturedC = captured.withTransforms(this.mirror, this.rotation);
                this.capturedBlocksCache = capturedC.compressForRender(mc.level, this.pos, mc.player, SGConfig.CLIENT.maxCloneCompileTime());
            } else {
                this.capturedBlocksCache = null;
            }
        }
    }

    @Override
    protected void buildMain(
        Minecraft mc, ItemStack stack, Pose pose, BufferBuilder buffBuilder, double camX, double camY, double camZ, BuildingToolRenderer.RenderInfo renderInfo
    ) {
        super.buildMain(mc, stack, pose, buffBuilder, camX, camY, camZ, renderInfo);
    }

    protected void buildDest(
        Minecraft mc, ItemStack stack, Pose pose, BufferBuilder buffBuilder, double camX, double camY, double camZ, BuildingToolRenderer.RenderInfo renderInfo
    ) {
        if (this.hitPos != null
            && this.pos != null
            && this.secondPos != null
            && this.capturedBlocksCache != null
            && BuildingToolItem.getSelectedCorner(stack) == null) {
            try {
                BoundingBox destBB = CloneTool.getCloneDestBounds(this.capturedBlocksCache, BlockPos.ZERO, Blocks.AIR.defaultBlockState(), Vec3.ZERO, false);
                BlockPos worldPos = new BlockPos(destBB.minX(), destBB.minY(), destBB.minZ());
                Map<BlockPos, VoxelShape> shapes = this.capturedBlocksCache.getShapes(mc.level, worldPos);
                BoundingBox worldDestBB = CloneTool.getCloneDestBounds(
                    this.capturedBlocksCache, this.hitPos, mc.player.level().getBlockState(this.hitPos), mc.player.position(), mc.player.isShiftKeyDown()
                );
                Vec3i cloneRenderPos = new Vec3i(worldDestBB.minX() - (int)camX, worldDestBB.minY() - (int)camY, worldDestBB.minZ() - (int)camZ);
                IRenderBase.highlightVoxelShapes(pose, buffBuilder, Vec3.ZERO, cloneRenderPos, shapes, 0.6F, 0.0F, 0.9F, 0.7F);

                for (AABB bounds : this.capturedBlocksCache.getEntityBoxes(mc.level, worldPos, this.mirror, this.rotation)) {
                    IRenderBase.makeBox(pose, buffBuilder, bounds, 0.8F, 0.8F, 0.8F, 0.7F);
                }

                IRenderBase.makeLineBox(pose, buffBuilder, destBB, -0.01, 0.75F, 0.0F, 0.75F, 0.3F);
            } catch (NullPointerException e) {
                if (this.capturedBlocksCache != null) {
                    throw e;
                }
            }
        }
    }

    @Override
    protected BuildingToolRenderer.RenderInfo build(Minecraft mc, LocalPlayer player, ItemStack stack, double camX, double camY, double camZ) {
        BuildingToolRenderer.RenderInfo ret = super.build(mc, player, stack, camX, camY, camZ);
        if (SGConfig.CLIENT.threadBuildingTool()) {
            if (this.destFutureRender == null) {
                this.destLastRenderInfo.isFinished = false;
                this.destFutureRender = CompletableFuture.supplyAsync(() -> {
                    Pose posex = new PoseStack().last();
                    BufferBuilder buffBuilderx = new BufferBuilder(this.destBufferBuilder, PrimitiveTopology.QUADS, DefaultVertexFormat.POSITION_COLOR);
                    BuildingToolRenderer.RenderInfo destRenderInfox = new BuildingToolRenderer.RenderInfo();
                    this.buildDest(mc, stack, posex, buffBuilderx, camX, camY, camZ, destRenderInfox);
                    MeshData meshx = buffBuilderx.build();
                    ByteBuffer bufferx = meshx != null ? meshx.vertexBuffer() : null;
                    int indexCount = meshx != null ? meshx.drawState().indexCount() : 0;
                    return new BuildingToolRenderer.RenderResult(destRenderInfox, meshx, bufferx, indexCount);
                }, Util.backgroundExecutor());
            }

            if (this.destFutureRender != null && this.destFutureRender.isDone()) {
                try {
                    BuildingToolRenderer.RenderResult result = this.destFutureRender.get();

                    try (MeshData mesh = result.mesh()) {
                        if (mesh != null) {
                            ByteBuffer buffer = result.buffer();
                            if (this.destBuffer == null || this.destBuffer.size() < buffer.remaining()) {
                                if (this.destBuffer != null) {
                                    this.destBuffer.close();
                                }

                                int bufferFlags = 162;
                                this.destBuffer = new MappableRingBuffer(() -> "Clone Display", bufferFlags, buffer.remaining());
                            }

                            this.destBuffer.rotate();

                            try (MappedView view = this.destBuffer.currentBuffer().slice().map(false, true)) {
                                view.data().put(buffer);
                                this.destIndexCount = result.indexCount();
                            }

                            BuildingToolRenderer.RenderInfo destRenderInfo = result.renderInfo();
                            destRenderInfo.isFinished = true;
                            this.destLastRenderInfo = destRenderInfo;
                        }
                    }
                } catch (Throwable t) {
                    t.printStackTrace();
                } finally {
                    this.destFutureRender = null;
                }
            }
        } else {
            Pose pose = new PoseStack().last();
            BufferBuilder buffBuilder = new BufferBuilder(this.destBufferBuilder, PrimitiveTopology.QUADS, DefaultVertexFormat.POSITION_COLOR);
            BuildingToolRenderer.RenderInfo destRenderInfo = new BuildingToolRenderer.RenderInfo();
            this.buildDest(mc, stack, pose, buffBuilder, camX, camY, camZ, destRenderInfo);

            try (MeshData mesh = buffBuilder.build()) {
                if (mesh == null) {
                    ret.isFinished = false;
                } else {
                    ByteBuffer buffer = mesh.vertexBuffer();
                    if (this.destBuffer == null || this.destBuffer.size() < buffer.remaining()) {
                        if (this.destBuffer != null) {
                            this.destBuffer.close();
                        }

                        int bufferFlags = 162;
                        this.destBuffer = new MappableRingBuffer(() -> "Clone Display", bufferFlags, buffer.remaining());
                    }

                    this.destBuffer.rotate();

                    try (MappedView view = this.destBuffer.currentBuffer().slice().map(false, true)) {
                        view.data().put(buffer);
                        this.destIndexCount = mesh.drawState().indexCount();
                    }

                    destRenderInfo.isFinished = true;
                    this.destLastRenderInfo = destRenderInfo;
                }
            }
        }

        ret.isFinished = ret.isFinished && this.destLastRenderInfo.isFinished;
        return ret;
    }

    @Override
    protected void render(Minecraft mc, LocalPlayer player, ItemStack stack, double camX, double camY, double camZ) {
        super.render(mc, player, stack, camX, camY, camZ);
        if (this.destIndexCount != 0 && this.hitPos != null && this.capturedBlocksCache != null) {
            BoundingBox destBB = CloneTool.getCloneDestBounds(
                this.capturedBlocksCache, this.hitPos, player.level().getBlockState(this.hitPos), player.position(), player.isShiftKeyDown()
            );
            this.draw(this.destBuffer, this.destIndexCount, destBB.minX() - (float)camX, destBB.minY() - (float)camY, destBB.minZ() - (float)camZ);
        }
    }

    @Override
    protected void close() {
        super.close();
        if (this.destBuffer != null) {
            this.destBuffer.close();
        }
    }
}
