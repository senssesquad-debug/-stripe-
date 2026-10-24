package com.legacy.structure_gel.core.client.renderers;

import com.legacy.structure_gel.api.util.Positions;
import com.legacy.structure_gel.core.SGConfig;
import com.legacy.structure_gel.core.client.ClientProxy;
import com.legacy.structure_gel.core.client.SGRenderPipelines;
import com.legacy.structure_gel.core.client.SGRenderType;
import com.legacy.structure_gel.core.client.renderers.building_tool.CloneToolRenderer;
import com.legacy.structure_gel.core.client.renderers.building_tool.ExtendToolRenderer;
import com.legacy.structure_gel.core.client.renderers.building_tool.FillToolRenderer;
import com.legacy.structure_gel.core.client.renderers.building_tool.FloodToolRenderer;
import com.legacy.structure_gel.core.client.renderers.building_tool.LineToolRenderer;
import com.legacy.structure_gel.core.client.renderers.building_tool.MoveToolRenderer;
import com.legacy.structure_gel.core.client.renderers.building_tool.ReplaceToolRenderer;
import com.legacy.structure_gel.core.client.renderers.building_tool.ShapeToolRenderer;
import com.legacy.structure_gel.core.item.building_tool.BuildingToolItem;
import com.legacy.structure_gel.core.item.building_tool.BuildingToolMode;
import com.legacy.structure_gel.core.item.building_tool.BuildingToolModes;
import com.legacy.structure_gel.core.item.building_tool.SmartBoundingBox;
import com.legacy.structure_gel.core.registry.SGRegistry;
import com.mojang.blaze3d.buffers.GpuBuffer;
import com.mojang.blaze3d.buffers.GpuBufferSlice;
import com.mojang.blaze3d.buffers.GpuBuffer.MappedView;
import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.systems.RenderPass;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.systems.RenderSystem.AutoStorageIndexBuffer;
import com.mojang.blaze3d.textures.GpuTextureView;
import com.mojang.blaze3d.vertex.BufferBuilder;
import com.mojang.blaze3d.vertex.ByteBufferBuilder;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.MeshData;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.blaze3d.vertex.PoseStack.Pose;
import com.mojang.blaze3d.vertex.VertexFormat.Mode;
import com.mojang.datafixers.util.Pair;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.OptionalInt;
import java.util.concurrent.CompletableFuture;
import java.util.function.Supplier;
import net.minecraft.client.Minecraft;
import net.minecraft.client.player.LocalPlayer;
import net.minecraft.client.renderer.MappableRingBuffer;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.core.Vec3i;
import net.minecraft.util.Util;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import net.minecraft.world.phys.AABB;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.HitResult;
import net.minecraft.world.phys.Vec3;
import net.minecraft.world.phys.HitResult.Type;
import org.joml.Matrix4f;
import org.joml.Vector3f;
import org.joml.Vector4f;
import org.jspecify.annotations.Nullable;

public abstract class BuildingToolRenderer implements IRenderBase {
    private static final Map<BuildingToolMode, Supplier<BuildingToolRenderer>> RENDERERS = Util.make(new HashMap<>(), map -> {
        map.put(BuildingToolModes.REPLACE, ReplaceToolRenderer::new);
        map.put(BuildingToolModes.FILL, FillToolRenderer::new);
        map.put(BuildingToolModes.CLONE, CloneToolRenderer::new);
        map.put(BuildingToolModes.FLOOD, FloodToolRenderer::new);
        map.put(BuildingToolModes.EXTEND, ExtendToolRenderer::new);
        map.put(BuildingToolModes.MOVE, MoveToolRenderer::new);
        map.put(BuildingToolModes.LINE, LineToolRenderer::new);
        map.put(BuildingToolModes.SHAPE, ShapeToolRenderer::new);
    });
    protected static @Nullable BuildingToolMode currentMode = null;
    private static @Nullable BuildingToolRenderer instance = null;
    private static boolean shouldClear = false;
    protected @Nullable BlockPos pos;
    protected @Nullable BlockPos hitPos;
    protected @Nullable Direction hitFace;
    protected @Nullable Vec3 hitVec;
    protected boolean hitBlock = false;
    private @Nullable MappableRingBuffer lineBuffer;
    private int indexCount = 0;
    protected boolean needsUpdated = true;
    protected Vec3i renderPos = Vec3i.ZERO;
    private final ByteBufferBuilder byteBufferBuilder = SGRenderType.createWireframeBuffer();
    private @Nullable CompletableFuture<BuildingToolRenderer.RenderResult> futureRender = null;
    protected BuildingToolRenderer.RenderInfo lastRenderInfo = new BuildingToolRenderer.RenderInfo();

    protected BuildingToolRenderer() {
    }

    private static void updateRenderedMode(@Nullable ItemStack stack) {
        BuildingToolMode newMode = stack != null && stack.is(SGRegistry.Items.BUILDING_TOOL.get()) ? BuildingToolItem.getMode(stack) : null;
        if (currentMode != newMode || instance == null) {
            currentMode = newMode;
            if (instance != null) {
                instance.close();
            }

            instance = currentMode == null ? null : RENDERERS.getOrDefault(currentMode, () -> null).get();
        }
    }

    public static void render(double camX, double camY, double camZ) {
        if (shouldClear) {
            shouldClear = false;
            if (instance != null) {
                instance.close();
            }

            instance = null;
        }

        Minecraft mc = Minecraft.getInstance();
        LocalPlayer player = mc.player;
        if (player != null && player.isCreative()) {
            Pair<InteractionHand, ItemStack> tool = BuildingToolItem.getBuildingTool(player);
            if (tool == null) {
                updateRenderedMode(null);
                return;
            }

            ItemStack toolStack = tool.getSecond();
            updateRenderedMode(toolStack);
            if (instance != null && !toolStack.isEmpty()) {
                instance.updateData(mc, toolStack);
                Vec3i camPos = Positions.vec3i(camX, camY, camZ);
                if (instance.shouldRender(camPos)) {
                    if (instance.needsUpdated && instance.build(mc, player, toolStack, camX, camY, camZ).isFinished) {
                        instance.needsUpdated = false;
                    }

                    instance.render(mc, player, toolStack, camX, camY, camZ);
                }
            }
        }
    }

    protected BuildingToolRenderer.RenderInfo build(Minecraft mc, LocalPlayer player, ItemStack stack, double camX, double camY, double camZ) {
        if (SGConfig.CLIENT.threadBuildingTool()) {
            if (this.futureRender == null) {
                this.lastRenderInfo.isFinished = false;
                this.futureRender = CompletableFuture.supplyAsync(() -> {
                    Pose posex = new PoseStack().last();
                    BufferBuilder buffBuilderx = new BufferBuilder(this.byteBufferBuilder, Mode.QUADS, DefaultVertexFormat.POSITION_COLOR);
                    BuildingToolRenderer.RenderInfo renderInfox = new BuildingToolRenderer.RenderInfo();
                    this.buildMain(mc, stack, posex, buffBuilderx, camX, camY, camZ, renderInfox);
                    MeshData meshx = buffBuilderx.build();
                    ByteBuffer bufferx = meshx != null ? meshx.vertexBuffer() : null;
                    int indexCount = meshx != null ? meshx.drawState().indexCount() : 0;
                    return new BuildingToolRenderer.RenderResult(renderInfox, meshx, bufferx, indexCount);
                }, Util.backgroundExecutor());
            }

            if (this.futureRender != null && this.futureRender.isDone()) {
                try {
                    BuildingToolRenderer.RenderResult result = this.futureRender.get();

                    try (MeshData mesh = result.mesh) {
                        if (mesh != null) {
                            ByteBuffer buffer = result.buffer;
                            if (this.lineBuffer == null || this.lineBuffer.size() < buffer.remaining()) {
                                if (this.lineBuffer != null) {
                                    this.lineBuffer.close();
                                }

                                int bufferFlags = 162;
                                this.lineBuffer = new MappableRingBuffer(() -> "Building Tool", bufferFlags, buffer.remaining());
                            }

                            this.lineBuffer.rotate();

                            try (MappedView view = RenderSystem.getDevice()
                                    .createCommandEncoder()
                                    .mapBuffer(this.lineBuffer.currentBuffer().slice(), false, true)) {
                                view.data().put(buffer);
                                this.indexCount = result.indexCount;
                            }

                            BuildingToolRenderer.RenderInfo renderInfo = result.renderInfo();
                            this.renderPos = renderInfo.renderPos;
                            renderInfo.isFinished = true;
                            this.lastRenderInfo = renderInfo;
                        }
                    }
                } catch (Throwable t) {
                    t.printStackTrace();
                } finally {
                    this.futureRender = null;
                }
            }
        } else {
            Pose pose = new PoseStack().last();
            BufferBuilder buffBuilder = new BufferBuilder(ClientProxy.WIREFRAME_BUFFER_BUILDER, Mode.QUADS, DefaultVertexFormat.POSITION_COLOR);
            BuildingToolRenderer.RenderInfo renderInfo = new BuildingToolRenderer.RenderInfo();
            this.buildMain(mc, stack, pose, buffBuilder, camX, camY, camZ, renderInfo);

            try (MeshData mesh = buffBuilder.build()) {
                if (mesh != null) {
                    ByteBuffer buffer = mesh.vertexBuffer();
                    if (this.lineBuffer == null || this.lineBuffer.size() < buffer.remaining()) {
                        if (this.lineBuffer != null) {
                            this.lineBuffer.close();
                        }

                        int bufferFlags = 162;
                        this.lineBuffer = new MappableRingBuffer(() -> "Building Tool", bufferFlags, buffer.remaining());
                    }

                    this.lineBuffer.rotate();

                    try (MappedView view = RenderSystem.getDevice().createCommandEncoder().mapBuffer(this.lineBuffer.currentBuffer().slice(), false, true)) {
                        view.data().put(buffer);
                        this.indexCount = mesh.drawState().indexCount();
                    }

                    this.renderPos = renderInfo.renderPos;
                    renderInfo.isFinished = true;
                    this.lastRenderInfo = renderInfo;
                }
            }
        }

        return this.lastRenderInfo;
    }

    protected void render(Minecraft mc, LocalPlayer player, ItemStack stack, double camX, double camY, double camZ) {
        if (this.indexCount != 0) {
            this.draw(
                this.lineBuffer, this.indexCount, this.renderPos.getX() - (float)camX, this.renderPos.getY() - (float)camY, this.renderPos.getZ() - (float)camZ
            );
        }
    }

    protected void draw(MappableRingBuffer buffer, int indexCount, float xOffset, float yOffset, float zOffset) {
        GpuBufferSlice dynamicTransforms = RenderSystem.getDynamicUniforms()
            .writeTransform(RenderSystem.getModelViewMatrix(), new Vector4f(1.0F, 1.0F, 1.0F, 1.0F), new Vector3f(xOffset, yOffset, zOffset), new Matrix4f());
        RenderTarget mainRenderTarget = Minecraft.getInstance().getMainRenderTarget();
        RenderTarget particleTarget = Minecraft.getInstance().levelRenderer.getParticlesTarget();
        AutoStorageIndexBuffer indices = RenderSystem.getSequentialBuffer(Mode.QUADS);
        GpuBuffer indexBuffer = indices.getBuffer(indexCount);
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
                .createRenderPass(() -> "Building Tool", colorTexture, OptionalInt.empty(), depthTexture, OptionalDouble.empty())) {
            renderPass.setPipeline(SGRenderPipelines.WORLD_WIREFRAME);
            renderPass.setVertexBuffer(0, buffer.currentBuffer());
            RenderSystem.bindDefaultUniforms(renderPass);
            renderPass.setUniform("DynamicTransforms", dynamicTransforms);
            renderPass.setIndexBuffer(indexBuffer, indices.type());
            renderPass.drawIndexed(0, 0, indexCount, 1);
        }
    }

    protected static Collection<BlockPos> mapPosesTo(Collection<BlockPos> poses, Vec3i renderPos) {
        List<BlockPos> newPoses = new ArrayList<>(poses.size());
        int x = renderPos.getX();
        int y = renderPos.getY();
        int z = renderPos.getZ();

        for (BlockPos pos : poses) {
            newPoses.add(pos.offset(-x, -y, -z));
        }

        return newPoses;
    }

    protected boolean shouldRender(Vec3i camPos) {
        return true;
    }

    protected void updateData(Minecraft mc, ItemStack stack) {
        HitResult hitResult = mc.hitResult;
        BlockPos hPos;
        Direction hDir;
        boolean hBlock;
        if (hitResult instanceof BlockHitResult bHitResult) {
            hPos = bHitResult.getBlockPos();
            hDir = bHitResult.getDirection();
            hBlock = bHitResult.getType() == Type.BLOCK;
        } else {
            hPos = null;
            hDir = null;
            hBlock = false;
        }

        if (this.hitPos != null && !this.hitPos.equals(hPos)
            || hPos != null && !hPos.equals(this.hitPos)
            || this.hitPos == null != (hPos == null)
            || hDir != this.hitFace
            || hBlock != this.hitBlock) {
            this.hitPos = hPos;
            this.hitFace = hDir;
            this.hitBlock = hBlock;
            this.needsUpdated = true;
        }

        Vec3 hVec;
        if (hitResult instanceof BlockHitResult bHitResult) {
            hVec = bHitResult.getLocation();
        } else {
            hVec = null;
        }

        if (this.hitVec != null && !this.hitVec.equals(hVec) || hVec != null && !hVec.equals(this.hitVec)) {
            this.hitVec = hVec;
            this.needsUpdated = true;
        }
    }

    protected abstract void buildMain(
        Minecraft var1, ItemStack var2, Pose var3, BufferBuilder var4, double var5, double var7, double var9, BuildingToolRenderer.RenderInfo var11
    );

    protected void close() {
        if (this.lineBuffer != null) {
            this.lineBuffer.close();
        }
    }

    public static void needsUpdated() {
        if (instance != null) {
            instance.needsUpdated = true;
        }
    }

    public static void clear() {
        shouldClear = true;
    }

    public abstract static class ForCorners extends BuildingToolRenderer {
        protected boolean selectionChanged = false;
        protected boolean itemChanged = false;
        private ItemStack oldStack = ItemStack.EMPTY;
        boolean wasHoldingShift = false;
        SmartBoundingBox.@Nullable CornerType oldCorner = null;
        protected @Nullable BlockPos secondPos;
        private @Nullable MappableRingBuffer targetBuffer;
        private int targetIndexCount = 0;

        @Override
        protected boolean shouldRender(Vec3i camPos) {
            return true;
        }

        @Override
        protected void updateData(Minecraft mc, ItemStack stack) {
            super.updateData(mc, stack);
            Optional<BlockPos> pos0 = BuildingToolItem.getPos(stack, 0);
            Optional<BlockPos> pos1 = BuildingToolItem.getPos(stack, 1);
            boolean pos0Flag = this.arePosesDifferent(pos0, this.pos);
            boolean pos1Flag = this.arePosesDifferent(pos1, this.secondPos);
            SmartBoundingBox.CornerType corner = BuildingToolItem.getSelectedCorner(stack);
            boolean isHoldingShift = mc.player.isShiftKeyDown();
            this.pos = pos0.orElse(null);
            this.secondPos = pos1.orElse(null);
            if (pos0Flag || pos1Flag || this.wasHoldingShift != isHoldingShift || this.oldCorner != corner) {
                this.needsUpdated = true;
            }

            this.selectionChanged = pos0Flag || pos1Flag || this.oldCorner != corner;
            this.itemChanged = this.oldStack == null != (stack == null) || this.oldStack != null && !ItemStack.matches(this.oldStack, stack);
            this.wasHoldingShift = isHoldingShift;
            this.oldCorner = corner;
            this.oldStack = stack.copy();
        }

        private boolean arePosesDifferent(Optional<BlockPos> opPos, BlockPos compareTo) {
            return opPos.isPresent() ? !opPos.get().equals(compareTo) : compareTo != null;
        }

        protected abstract float[] getOutlineRGB();

        @Override
        protected void buildMain(
            Minecraft mc,
            ItemStack stack,
            Pose pose,
            BufferBuilder buffBuilder,
            double camX,
            double camY,
            double camZ,
            BuildingToolRenderer.RenderInfo renderInfo
        ) {
            boolean hasPosA = this.pos != null;
            boolean hasPosB = this.secondPos != null;
            float selectionPointAlpha = 0.5F;
            Vec3i renderPos = this.renderPos;
            renderInfo.skipTargetDraw = false;
            if (hasPosA && !hasPosB) {
                renderPos = this.pos;
                IRenderBase.makeLineBox(pose, buffBuilder, BoundingBox.fromCorners(Vec3i.ZERO, Vec3i.ZERO), 0.75F, 0.0F, 0.0F, selectionPointAlpha);
            }

            if (!hasPosA && hasPosB) {
                renderPos = this.secondPos;
                IRenderBase.makeLineBox(pose, buffBuilder, BoundingBox.fromCorners(Vec3i.ZERO, Vec3i.ZERO), 0.0F, 0.0F, 0.75F, selectionPointAlpha);
            }

            if (hasPosA && hasPosB) {
                SmartBoundingBox.CornerType selectedCorner = BuildingToolItem.getSelectedCorner(stack);
                float[] rgb = this.getOutlineRGB();
                BoundingBox bb = BoundingBox.fromCorners(this.pos, this.secondPos);
                renderPos = new Vec3i(bb.minX(), bb.minY(), bb.minZ());
                double pointWidth = 0.53;
                Vec3 pointWidthVec = new Vec3(pointWidth, pointWidth, pointWidth);
                Vec3 posA = Vec3.atCenterOf(this.pos.subtract(renderPos));
                Vec3 posB = Vec3.atCenterOf(this.secondPos.subtract(renderPos));
                double cornerWidth = 0.3;
                Vec3 cornerWidthVec = new Vec3(cornerWidth, cornerWidth, cornerWidth);
                double range = 10.0;
                Vec3 lookVec = mc.player.getLookAngle();
                Vec3 playerPos = mc.player.getEyePosition();
                Vec3 rp = new Vec3(renderPos.getX(), renderPos.getY(), renderPos.getZ());
                boolean hasAllCorners = this.hasAllCorners();
                SmartBoundingBox bounds = SmartBoundingBox.fromCorners(Positions.blockPos(posA), Positions.blockPos(posB));

                for (SmartBoundingBox.Corner corner : hasAllCorners ? bounds.allCorners() : bounds.selectionPointCorners()) {
                    Vec3i cornerPos = corner.getPoint();
                    Vec3 c = new Vec3(cornerPos.getX(), cornerPos.getY(), cornerPos.getZ());
                    AABB aabb = new AABB(c.subtract(cornerWidthVec).add(rp), c.add(cornerWidthVec).add(rp));
                    if (selectedCorner == corner.type || aabb.clip(playerPos, playerPos.add(lookVec.multiply(range, range, range))).isPresent()) {
                        IRenderBase.makeBox(pose, buffBuilder, c.subtract(cornerWidthVec), c.add(cornerWidthVec), 0.0F, 0.7F, 0.3F, 0.5F);
                        renderInfo.skipTargetDraw = true;
                        break;
                    }
                }

                if (hasAllCorners) {
                    IRenderBase.makeBox(pose, buffBuilder, posA.subtract(pointWidthVec), posA.add(pointWidthVec), 0.75F, 0.0F, 0.0F, selectionPointAlpha);
                    IRenderBase.makeBox(pose, buffBuilder, posB.subtract(pointWidthVec), posB.add(pointWidthVec), 0.0F, 0.0F, 0.75F, selectionPointAlpha);
                } else {
                    IRenderBase.makeLineBox(pose, buffBuilder, BlockPos.containing(posA), 0.75F, 0.0F, 0.0F, selectionPointAlpha);
                    IRenderBase.makeLineBox(pose, buffBuilder, BlockPos.containing(posB), 0.0F, 0.0F, 0.75F, selectionPointAlpha);
                }

                if (hasAllCorners) {
                    IRenderBase.makeLineBox(pose, buffBuilder, BoundingBox.fromCorners(Vec3i.ZERO, bb.getLength()), rgb[0], rgb[1], rgb[2], 0.3F);
                    if (selectedCorner != null) {
                        double boxWidth = 0.508;
                        Vec3 boxWidthVec = new Vec3(boxWidth, boxWidth, boxWidth);
                        IRenderBase.makeBox(
                            pose,
                            buffBuilder,
                            Vec3.atCenterOf(Vec3i.ZERO).subtract(boxWidthVec),
                            Vec3.atCenterOf(bb.getLength()).add(boxWidthVec),
                            rgb[0],
                            rgb[1],
                            rgb[2],
                            0.1F
                        );
                    }
                }
            }

            renderInfo.renderPos = renderPos;
        }

        protected boolean hasAllCorners() {
            return currentMode instanceof BuildingToolMode.ForCorners cornerMode && cornerMode.hasAllCorners();
        }

        protected void buildTarget(
            Minecraft mc,
            ItemStack stack,
            Pose pose,
            BufferBuilder buffBuilder,
            double camX,
            double camY,
            double camZ,
            BuildingToolRenderer.RenderInfo renderInfo
        ) {
            if (currentMode != BuildingToolModes.CLONE || this.pos == null || this.secondPos == null) {
                if (this.hitPos != null) {
                    boolean posA = !mc.player.isShiftKeyDown();
                    float[] color = new float[]{posA ? 0.75F : 0.0F, 0.0F, posA ? 0.0F : 0.75F};
                    float selectionPointAlpha = 0.3F;
                    if (mc.level.getBlockState(this.hitPos).isAir()) {
                        double min = 0.15;
                        double max = 0.85;
                        IRenderBase.makeBox(
                            pose, buffBuilder, new Vec3(min, min, min), new Vec3(max, max, max), color[0], color[1], color[2], selectionPointAlpha
                        );
                    } else {
                        double min = 0.01;
                        double max = 0.99;
                        IRenderBase.makeLineBox(pose, buffBuilder, min, min, min, max, max, max, color[0], color[1], color[2], selectionPointAlpha);
                    }
                }
            }
        }

        @Override
        protected BuildingToolRenderer.RenderInfo build(Minecraft mc, LocalPlayer player, ItemStack stack, double camX, double camY, double camZ) {
            BuildingToolRenderer.RenderInfo ret = super.build(mc, player, stack, camX, camY, camZ);
            Pose pose = new PoseStack().last();
            BufferBuilder buffBuilder = new BufferBuilder(ClientProxy.WIREFRAME_BUFFER_BUILDER, Mode.QUADS, DefaultVertexFormat.POSITION_COLOR);
            this.buildTarget(mc, stack, pose, buffBuilder, camX, camY, camZ, ret);

            try (MeshData mesh = buffBuilder.build()) {
                if (mesh != null) {
                    ByteBuffer buffer = mesh.vertexBuffer();
                    if (this.targetBuffer == null || this.targetBuffer.size() < buffer.remaining()) {
                        if (this.targetBuffer != null) {
                            this.targetBuffer.close();
                        }

                        int bufferFlags = 162;
                        this.targetBuffer = new MappableRingBuffer(() -> "Building Tool Target", bufferFlags, buffer.remaining());
                    }

                    this.targetBuffer.rotate();

                    try (MappedView view = RenderSystem.getDevice().createCommandEncoder().mapBuffer(this.targetBuffer.currentBuffer().slice(), false, true)) {
                        view.data().put(buffer);
                        this.targetIndexCount = mesh.drawState().indexCount();
                    }
                }
            }

            return ret;
        }

        @Override
        protected void render(Minecraft mc, LocalPlayer player, ItemStack stack, double camX, double camY, double camZ) {
            Vec3i camPos = mc.gameRenderer.getMainCamera().blockPosition();
            int dist = 300;
            if (this.pos != null && this.pos.closerThan(camPos, dist) || this.secondPos != null && this.secondPos.closerThan(camPos, dist)) {
                super.render(mc, player, stack, camX, camY, camZ);
            }

            if (!this.lastRenderInfo.skipTargetDraw && this.targetIndexCount != 0 && this.hitPos != null) {
                this.draw(
                    this.targetBuffer,
                    this.targetIndexCount,
                    this.hitPos.getX() - (float)camX,
                    this.hitPos.getY() - (float)camY,
                    this.hitPos.getZ() - (float)camZ
                );
            }
        }

        @Override
        protected void close() {
            super.close();
            if (this.targetBuffer != null) {
                this.targetBuffer.close();
            }
        }
    }

    public static class RenderInfo {
        public boolean isFinished = false;
        public Vec3i renderPos = Vec3i.ZERO;
        public boolean skipTargetDraw = false;
    }

    public record RenderResult(BuildingToolRenderer.RenderInfo renderInfo, MeshData mesh, ByteBuffer buffer, int indexCount) {
    }
}
