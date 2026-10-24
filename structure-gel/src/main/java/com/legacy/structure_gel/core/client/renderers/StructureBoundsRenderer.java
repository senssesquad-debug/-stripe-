package com.legacy.structure_gel.core.client.renderers;

import com.legacy.structure_gel.api.util.Positions;
import com.legacy.structure_gel.core.StructureGelMod;
import com.legacy.structure_gel.core.client.ClientProxy;
import com.legacy.structure_gel.core.client.SGRenderPipelines;
import com.legacy.structure_gel.core.structure.StructureInfo;
import com.mojang.blaze3d.buffers.GpuBuffer;
import com.mojang.blaze3d.buffers.GpuBufferSlice;
import com.mojang.blaze3d.buffers.GpuBuffer.MappedView;
import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.systems.RenderPass;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.systems.RenderSystem.AutoStorageIndexBuffer;
import com.mojang.blaze3d.textures.GpuTextureView;
import com.mojang.blaze3d.vertex.BufferBuilder;
import com.mojang.blaze3d.vertex.MeshData;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.PoseStack.Pose;
import com.mojang.blaze3d.vertex.VertexFormat.Mode;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.OptionalInt;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MappableRingBuffer;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Vec3i;
import net.minecraft.resources.Identifier;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import org.joml.Matrix4f;
import org.joml.Vector3f;
import org.joml.Vector4f;
import org.jspecify.annotations.Nullable;

public class StructureBoundsRenderer {
    private static final Map<Identifier, List<StructureBoundsRenderer>> STRUCTURE_INFOS = new HashMap<>();
    private static boolean shouldClear = false;
    private final BlockPos pos;
    private final StructureInfo structureInfo;
    private @Nullable MappableRingBuffer ringBuffer;
    private int indexCount = 0;
    private boolean needsUpdated = true;

    private StructureBoundsRenderer(StructureInfo structureInfo) {
        this.pos = structureInfo.fullBounds().getCenter();
        this.structureInfo = structureInfo;
    }

    public static void render(double camX, double camY, double camZ) {
        if (shouldClear) {
            shouldClear = false;

            for (List<StructureBoundsRenderer> rendererList : STRUCTURE_INFOS.values()) {
                for (StructureBoundsRenderer renderer : rendererList) {
                    if (renderer.ringBuffer != null) {
                        renderer.ringBuffer.close();
                        renderer.ringBuffer = null;
                        renderer.indexCount = 0;
                    }
                }
            }

            STRUCTURE_INFOS.clear();
        }

        if (StructureGelMod.proxy.shouldViewBounds()) {
            Identifier dimensionName = Minecraft.getInstance().level.dimension().identifier();
            List<StructureBoundsRenderer> renderers = STRUCTURE_INFOS.get(dimensionName);
            if (renderers != null) {
                Vec3i camPos = Positions.vec3i(camX, camY, camZ);

                for (int i = renderers.size() - 1; i > -1; i--) {
                    StructureBoundsRenderer renderer = renderers.get(i);
                    if (renderer.pos.closerThan(camPos, 300.0)) {
                        renderer.renderBounds(camX, camY, camZ);
                    }
                }
            }
        }
    }

    private void renderBounds(double camX, double camY, double camZ) {
        if (this.needsUpdated && this.buildMesh(camX, camY, camZ)) {
            this.needsUpdated = false;
        }

        if (this.indexCount != 0) {
            BoundingBox bb = this.structureInfo.fullBounds();
            this.draw(bb.minX() - (float)camX, bb.minY() - (float)camY, bb.minZ() - (float)camZ);
        }
    }

    private boolean buildMesh(double camX, double camY, double camZ) {
        Pose pose = new PoseStack().last();
        BufferBuilder buffBuilder = new BufferBuilder(ClientProxy.WIREFRAME_BUFFER_BUILDER, Mode.QUADS, SGRenderPipelines.WORLD_WIREFRAME.getVertexFormat());
        BoundingBox fullBounds = this.structureInfo.fullBounds();
        int minX = fullBounds.minX();
        int minY = fullBounds.minY();
        int minZ = fullBounds.minZ();
        IRenderBase.makeLineBox(pose, buffBuilder, BoundingBox.fromCorners(Vec3i.ZERO, fullBounds.getLength()), 0.12, 1.0F, 1.0F, 1.0F);

        for (int i = this.structureInfo.pieces().size() - 1; i > -1; i--) {
            StructureInfo.PieceInfo pieceInfo = this.structureInfo.pieces().get(i);
            float[] rgb = pieceInfo.getColorFloats();
            BoundingBox pieceBounds = pieceInfo.bounds();
            IRenderBase.makeLineBox(
                pose,
                buffBuilder,
                BoundingBox.fromCorners(Vec3i.ZERO, pieceBounds.getLength())
                    .moved(pieceBounds.minX() - minX, pieceBounds.minY() - minY, pieceBounds.minZ() - minZ),
                rgb[0],
                rgb[1],
                rgb[2]
            );
        }

        try (MeshData mesh = buffBuilder.build()) {
            if (mesh != null) {
                ByteBuffer buffer = mesh.vertexBuffer();
                if (this.ringBuffer == null || this.ringBuffer.size() < buffer.remaining()) {
                    if (this.ringBuffer != null) {
                        this.ringBuffer.close();
                    }

                    int bufferFlags = 162;
                    this.ringBuffer = new MappableRingBuffer(() -> "Structure Bounds", bufferFlags, buffer.remaining());
                }

                this.ringBuffer.rotate();

                try (MappedView view = RenderSystem.getDevice().createCommandEncoder().mapBuffer(this.ringBuffer.currentBuffer().slice(), false, true)) {
                    view.data().put(buffer);
                    this.indexCount = mesh.drawState().indexCount();
                }

                return true;
            }
        }

        return false;
    }

    protected void draw(float xOffset, float yOffset, float zOffset) {
        GpuBufferSlice dynamicTransforms = RenderSystem.getDynamicUniforms()
            .writeTransform(RenderSystem.getModelViewMatrix(), new Vector4f(1.0F, 1.0F, 1.0F, 1.0F), new Vector3f(xOffset, yOffset, zOffset), new Matrix4f());
        RenderTarget mainRenderTarget = Minecraft.getInstance().getMainRenderTarget();
        RenderTarget particleTarget = Minecraft.getInstance().levelRenderer.getParticlesTarget();
        AutoStorageIndexBuffer indices = RenderSystem.getSequentialBuffer(Mode.QUADS);
        GpuBuffer indexBuffer = indices.getBuffer(this.indexCount);
        GpuTextureView colorTexture;
        GpuTextureView depthTexture;
        if (particleTarget != null) {
            colorTexture = particleTarget.getColorTextureView();
            depthTexture = particleTarget.getDepthTextureView();
        } else {
            colorTexture = mainRenderTarget.getColorTextureView();
            depthTexture = mainRenderTarget.getDepthTextureView();
        }

        try (RenderPass renderPass = RenderSystem.getDevice()
                .createCommandEncoder()
                .createRenderPass(() -> "Structure Bounds", colorTexture, OptionalInt.empty(), depthTexture, OptionalDouble.empty())) {
            renderPass.setPipeline(SGRenderPipelines.WORLD_WIREFRAME);
            renderPass.setVertexBuffer(0, this.ringBuffer.currentBuffer());
            RenderSystem.bindDefaultUniforms(renderPass);
            renderPass.setUniform("DynamicTransforms", dynamicTransforms);
            renderPass.setIndexBuffer(indexBuffer, indices.type());
            renderPass.drawIndexed(0, 0, this.indexCount, 1);
        }
    }

    public static void addInfo(StructureInfo structureInfo) {
        StructureGelMod.LOGGER.log("Recieved structure info at ({}) in {}", structureInfo.fullBounds().getCenter().toShortString(), structureInfo.dimension());
        STRUCTURE_INFOS.computeIfAbsent(structureInfo.dimension(), type -> new ArrayList<>()).add(new StructureBoundsRenderer(structureInfo));
    }

    public static void clear() {
        shouldClear = true;
    }
}
