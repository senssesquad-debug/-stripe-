package com.legacy.rediscovered.client.render.world;

import com.mojang.blaze3d.PrimitiveTopology;
import com.legacy.rediscovered.RediscoveredConfig;
import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.client.render.RediscoveredRenderPipelines;
import com.legacy.rediscovered.registry.RediscoveredDimensions;
import com.mojang.blaze3d.buffers.GpuBuffer;
import com.mojang.blaze3d.buffers.GpuBufferSlice;
import com.mojang.blaze3d.buffers.Std140Builder;
import com.mojang.blaze3d.buffers.Std140SizeCalculator;
import com.mojang.blaze3d.buffers.GpuBufferSlice.MappedView;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.pipeline.RenderTarget;
import com.mojang.blaze3d.platform.NativeImage;
import com.mojang.blaze3d.systems.RenderPass;
import com.mojang.blaze3d.systems.RenderSystem;
import com.mojang.blaze3d.systems.RenderSystem.AutoStorageIndexBuffer;
import com.mojang.blaze3d.textures.GpuTextureView;
import java.io.IOException;
import java.io.InputStream;
import java.nio.ByteBuffer;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.OptionalDouble;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Predicate;
import javax.annotation.Nullable;
import net.minecraft.client.CloudStatus;
import net.minecraft.client.Minecraft;
import net.minecraft.client.renderer.MappableRingBuffer;
import net.minecraft.client.renderer.state.level.LevelRenderState;
import net.minecraft.client.renderer.texture.AbstractTexture;
import net.minecraft.client.renderer.texture.TextureManager;
import net.minecraft.core.Direction;
import net.minecraft.resources.Identifier;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.packs.resources.ResourceManager;
import net.minecraft.server.packs.resources.SimplePreparableReloadListener;
import net.minecraft.util.ARGB;
import net.minecraft.util.Mth;
import net.minecraft.util.profiling.ProfilerFiller;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.Vec3;
import org.joml.Matrix4f;
import org.joml.Matrix4fc;
import org.joml.Vector3f;
import org.joml.Vector4f;

public class FluffyCloudRenderer implements AutoCloseable {
    private static final int UBO_SIZE = new Std140SizeCalculator().putVec4().putVec3().putVec3().get();
    public static final float VANILLA_CLOUD_HEIGHT_PARITY = -195.67F;
    private static final List<FluffyCloudRenderer> RENDERERS = new ArrayList<>(
        List.of(
            new FluffyCloudRenderer(
                -30.0F,
                280.0F,
                -60.0F,
                0.2F,
                1.0F,
                FluffyCloudRenderer.TextureState.FLUFFY_VANILLA,
                Map.of(Level.OVERWORLD, FluffyCloudRenderer.FadeState.RIDING_DRAGON_NEAR_TRANSITION),
                FluffyCloudRenderer.RenderLocation.BOTH
            ),
            new FluffyCloudRenderer(
                30.0F,
                215.0F,
                60.0F,
                0.04F,
                0.8F,
                FluffyCloudRenderer.TextureState.FLUFFY_LEGACY,
                Map.of(Level.OVERWORLD, FluffyCloudRenderer.FadeState.RIDING_DRAGON_NEAR_TRANSITION),
                FluffyCloudRenderer.RenderLocation.BOTH
            ),
            new FluffyCloudRenderer(
                0.0F,
                0.0F,
                0.0F,
                0.03F,
                1.0F,
                FluffyCloudRenderer.TextureState.FLUFFY_LEGACY,
                Map.of(Level.OVERWORLD, FluffyCloudRenderer.FadeState.RIDING_DRAGON_NEAR_TRANSITION),
                FluffyCloudRenderer.RenderLocation.BOTH
            ),
            new FluffyCloudRenderer(
                -80.0F,
                -40.0F,
                120.0F,
                0.04F,
                1.0F,
                FluffyCloudRenderer.TextureState.FLUFFY_VANILLA,
                Map.of(Level.OVERWORLD, FluffyCloudRenderer.FadeState.RIDING_DRAGON_NEAR_TRANSITION),
                FluffyCloudRenderer.RenderLocation.BOTH
            ),
            new FluffyCloudRenderer(
                0.0F,
                -195.67F,
                0.0F,
                0.03F,
                1.0F,
                FluffyCloudRenderer.TextureState.VANILLA,
                Map.of(RediscoveredDimensions.skylandsKey(), FluffyCloudRenderer.FadeState.NEAR_VOID_FADE_IN),
                FluffyCloudRenderer.RenderLocation.SKYLANDS
            ),
            new FluffyCloudRenderer(
                0.0F,
                -195.77F,
                0.0F,
                0.03F,
                1.0F,
                FluffyCloudRenderer.TextureState.FLUFFY_VANILLA,
                Map.of(RediscoveredDimensions.skylandsKey(), FluffyCloudRenderer.FadeState.NEAR_VOID_FADE_OUT),
                FluffyCloudRenderer.RenderLocation.SKYLANDS
            )
        )
    );
    private static final FluffyCloudRenderer VANILLA_OVERRIDE = new FluffyCloudRenderer(
        0.0F, 0.0F, 0.0F, 0.03F, 1.0F, FluffyCloudRenderer.TextureState.FLUFFY_VANILLA, Map.of(), FluffyCloudRenderer.RenderLocation.OVERWORLD
    ) {
        @Override
        public float getHeight(float defaultHeight, Vec3 camPosition) {
            return defaultHeight;
        }
    };
    private final float xOffset;
    private final float yHeight;
    private final float zOffset;
    private final float speedModifier;
    private final FluffyCloudRenderer.TextureState textureState;
    private final Map<ResourceKey<Level>, FluffyCloudRenderer.FadeState> fadeState;
    public final FluffyCloudRenderer.RenderLocation renderLocation;
    private static EnumMap<FluffyCloudRenderer.TextureState, FluffyCloudRenderer.TextureData> textureData = new EnumMap<>(
        FluffyCloudRenderer.TextureState.class
    );
    private int prevCellX = Integer.MIN_VALUE;
    private int prevCellZ = Integer.MIN_VALUE;
    private FluffyCloudRenderer.RelativeCameraPos prevRelativeCameraPos = FluffyCloudRenderer.RelativeCameraPos.INSIDE;
    @Nullable
    private CloudStatus prevCloudStatus;
    private int quadCount = 0;
    @Nullable
    private MappableRingBuffer cloudInfo;
    @Nullable
    private MappableRingBuffer cloudFaces;
    private boolean needsRebuild = true;
    static final byte NORTH_MASK = 1;
    static final byte EAST_MASK = 2;
    static final byte SOUTH_MASK = 4;
    static final byte WEST_MASK = 8;
    private static boolean wasInMiddle = false;
    static final int FLAG_INSIDE_FACE = 16;
    static final int FLAG_USE_TOP_COLOR = 32;
    static final int VERTEX_SIZE = 6;

    public FluffyCloudRenderer(
        float xOffset,
        float yHeight,
        float zOffset,
        float speedModifier,
        float brightness,
        FluffyCloudRenderer.TextureState textureState,
        Map<ResourceKey<Level>, FluffyCloudRenderer.FadeState> fadeState,
        FluffyCloudRenderer.RenderLocation renderLocation
    ) {
        this.xOffset = xOffset;
        this.yHeight = yHeight;
        this.zOffset = zOffset;
        this.speedModifier = speedModifier;
        this.textureState = textureState;
        this.fadeState = fadeState;
        this.renderLocation = renderLocation;
    }

    private static int packCellData(int alpha, boolean north, boolean east, boolean south, boolean west) {
        return alpha << 4 | (north ? 1 : 0) | (east ? 2 : 0) | (south ? 4 : 0) | (west ? 8 : 0);
    }

    private static boolean isNeighborEmpty(int neightbor) {
        return ARGB.alpha(neightbor) == 0;
    }

    private static int getAlpha(int cellData) {
        return cellData >> 4;
    }

    private static boolean isNorthEmpty(int cellData) {
        return (cellData & 1) == 1;
    }

    private static boolean isEastEmpty(int cellData) {
        return (cellData & 2) == 2;
    }

    private static boolean isSouthEmpty(int cellData) {
        return (cellData & 4) == 4;
    }

    private static boolean isWestEmpty(int cellData) {
        return (cellData & 8) == 8;
    }

    public static boolean renderLayers(
        LevelRenderState levelRenderState,
        Vec3 camPosition,
        CloudStatus cloudStatus,
        int cloudColor,
        float cloudHeight,
        float heightOffset,
        int cloudRange,
        Matrix4fc modelViewMatrix
    ) {
        double camY = camPosition.y();
        boolean inMiddle = camY < 200.0 && camY > 15.0;
        RENDERERS.sort((o1, o2) -> Double.compare(Math.abs(camY - (o2.yHeight + heightOffset)), Math.abs(camY - (o1.yHeight + heightOffset))));
        AtomicBoolean shouldRender = new AtomicBoolean(false);

        for (FluffyCloudRenderer renderer : RENDERERS) {
            if (renderer.renderClouds(levelRenderState, camPosition, cloudStatus, cloudColor, cloudHeight, heightOffset, cloudRange, modelViewMatrix)) {
                shouldRender.set(true);
            }
        }

        wasInMiddle = inMiddle;
        return shouldRender.get();
    }

    public static boolean renderCloudOverride(
        LevelRenderState levelRenderState,
        Vec3 camPosition,
        CloudStatus cloudStatus,
        int cloudColor,
        float cloudHeight,
        int cloudRange,
        Matrix4fc modelViewMatrix
    ) {
        if (RediscoveredConfig.CLIENT.overrideVanillaClouds()) {
            VANILLA_OVERRIDE.renderClouds(levelRenderState, camPosition, cloudStatus, cloudColor, cloudHeight, 0.0F, cloudRange, modelViewMatrix);
            return true;
        } else {
            return false;
        }
    }

    public float getHeight(float defaultHeight, Vec3 camPosition) {
        int minY = mc().level.getMinY();
        int voidDamageStart = minY - 63;
        return camPosition.y < voidDamageStart ? this.yHeight - (voidDamageStart - (float)camPosition.y) : this.yHeight;
    }

    private static int getSizeForCloudDistance(int radiusCells) {
        int maxFacesPerCell = 6;
        int maxCells = (radiusCells + 1) * 2 * (radiusCells + 1) * 2 / 2;
        int maxFaces = maxCells * maxFacesPerCell + 9 * maxFacesPerCell;
        return maxFaces * 6;
    }

    public boolean renderClouds(
        LevelRenderState levelRenderState,
        Vec3 camPosition,
        CloudStatus cloudStatus,
        int cloudColor,
        float bottomY,
        float heightOffset,
        int range,
        Matrix4fc modelViewMatrix
    ) {
        ResourceKey<Level> dimension = mc().level.dimension();
        FluffyCloudRenderer.TextureData texture = textureData.get(this.textureState);
        if (texture != null && this.renderLocation.test(dimension)) {
            bottomY = this.getHeight(bottomY, camPosition) + heightOffset;
            float alphaMod = this.fadeState.getOrDefault(dimension, FluffyCloudRenderer.FadeState.NOOP).getAlpha(camPosition, bottomY);
            if (alphaMod <= 0.0F) {
                return false;
            }

            Vec3 cameraPosition = levelRenderState.cameraRenderState.pos;
            int color = levelRenderState.cloudColor;
            float cellWidth = 12.0F;
            float cellHeight = 4.0F;
            int radiusBlocks = range * 16;
            int radiusCells = Mth.ceil(radiusBlocks / cellWidth);
            int facesBufferSize = getSizeForCloudDistance(radiusCells);
            if (this.cloudInfo == null) {
                this.cloudInfo = new MappableRingBuffer(() -> "Fluffy Cloud Info", 130, UBO_SIZE);
            }

            if (this.cloudFaces == null || this.cloudFaces.currentBuffer().size() != facesBufferSize) {
                if (this.cloudFaces != null) {
                    this.cloudFaces.close();
                }

                this.cloudFaces = new MappableRingBuffer(() -> "Fluffy Cloud Faces", 258, facesBufferSize);
            }

            float relativeBottomY = (float)(bottomY - cameraPosition.y);
            float relativeTopY = relativeBottomY + cellHeight;
            FluffyCloudRenderer.RelativeCameraPos relativeCameraPos;
            if (relativeTopY < 0.0F) {
                relativeCameraPos = FluffyCloudRenderer.RelativeCameraPos.ABOVE;
            } else if (relativeBottomY > 0.0F) {
                relativeCameraPos = FluffyCloudRenderer.RelativeCameraPos.BELOW;
            } else {
                relativeCameraPos = FluffyCloudRenderer.RelativeCameraPos.INSIDE;
            }

            float cloudOffset = (float)(levelRenderState.gameTime % (texture.width * 400L)) + mc().getDeltaTracker().getGameTimeDeltaPartialTick(false);
            double cloudX = cameraPosition.x + this.xOffset + cloudOffset * this.speedModifier;
            double cloudZ = cameraPosition.z + this.zOffset + 3.96F;
            double textureWidthBlocks = texture.width * cellWidth;
            double textureHeightBlocks = texture.height * cellWidth;
            cloudX -= Mth.floor(cloudX / textureWidthBlocks) * textureWidthBlocks;
            cloudZ -= Mth.floor(cloudZ / textureHeightBlocks) * textureHeightBlocks;
            int cellX = Mth.floor(cloudX / cellWidth);
            int cellZ = Mth.floor(cloudZ / cellWidth);
            float xInCell = (float)(cloudX - cellX * cellWidth);
            float zInCell = (float)(cloudZ - cellZ * cellWidth);
            boolean fancyClouds = cloudStatus == CloudStatus.FANCY;
            if (this.needsRebuild
                || cellX != this.prevCellX
                || cellZ != this.prevCellZ
                || relativeCameraPos != this.prevRelativeCameraPos
                || cloudStatus != this.prevCloudStatus) {
                this.needsRebuild = false;
                this.prevCellX = cellX;
                this.prevCellZ = cellZ;
                this.prevRelativeCameraPos = relativeCameraPos;
                this.prevCloudStatus = cloudStatus;
                this.cloudFaces.rotate();

                try (MappedView view = this.cloudFaces.currentBuffer().map(false, true)) {
                    this.buildMesh(relativeCameraPos, view.data(), cellX, cellZ, fancyClouds, radiusCells, texture);
                    this.quadCount = view.data().position() / 6;
                }
            }

            if (this.quadCount != 0) {
                try (MappedView view = this.cloudInfo.currentBuffer().map(false, true)) {
                    Std140Builder.intoBuffer(view.data())
                        .putVec4(ARGB.vector4fFromARGB32(color))
                        .putVec3(-xInCell, relativeBottomY, -zInCell)
                        .putVec3(cellWidth, cellHeight, cellWidth);
                }

                GpuBufferSlice dynamicTransforms = RenderSystem.getDynamicUniforms()
                    .writeTransform(RenderSystem.getModelViewMatrixCopy(), new Vector4f(1.0F, 1.0F, 1.0F, alphaMod), new Vector3f(), new Matrix4f());
                AutoStorageIndexBuffer indices = RenderSystem.getSequentialBuffer(PrimitiveTopology.QUADS);
                GpuBuffer indexBuffer = indices.getBuffer(6 * this.quadCount);
                RenderTarget mainRenderTarget = Minecraft.getInstance().gameRenderer.mainRenderTarget();
                GpuTextureView colorTexture = mainRenderTarget.getColorTextureView();
                GpuTextureView depthTexture = mainRenderTarget.getDepthTextureView();
                RenderPipeline renderPipeline = fancyClouds ? RediscoveredRenderPipelines.FLUFFY_CLOUDS : RediscoveredRenderPipelines.FLAT_FLUFFY_CLOUDS;
                TextureManager textureManager = Minecraft.getInstance().getTextureManager();
                AbstractTexture fluffTexture = textureManager.getTexture(this.textureState.fluff);

                try (RenderPass renderPass = RenderSystem.getDevice()
                        .createCommandEncoder()
                        .createRenderPass(() -> "Fluffy Clouds", colorTexture, Optional.empty(), depthTexture, OptionalDouble.empty())) {
                    renderPass.setPipeline(renderPipeline);
                    RenderSystem.bindDefaultUniforms(renderPass);
                    renderPass.setUniform("DynamicTransforms", dynamicTransforms);
                    renderPass.setIndexBuffer(indexBuffer, indices.type());
                    renderPass.setUniform("CloudInfo", this.cloudInfo.currentBuffer());
                    renderPass.setUniform("CloudFaces", this.cloudFaces.currentBuffer());
                    renderPass.bindTexture("Sampler0", fluffTexture.getTextureView(), fluffTexture.getSampler());
                    renderPass.drawIndexed(6 * this.quadCount, 1, 0, 0, 0);
                }
            }

            return true;
        } else {
            return false;
        }
    }

    private void buildMesh(
        FluffyCloudRenderer.RelativeCameraPos relativePos,
        ByteBuffer faceBuffer,
        int centerCellX,
        int centerCellZ,
        boolean extrude,
        int radiusCells,
        FluffyCloudRenderer.TextureData texture
    ) {
        int[] cells = texture.cells;
        int textureWidth = texture.width;
        int textureHeight = texture.height;

        for (int ring = 0; ring <= 2 * radiusCells; ring++) {
            for (int relativeCellX = -ring; relativeCellX <= ring; relativeCellX++) {
                int relativeCellZ = ring - Math.abs(relativeCellX);
                if (relativeCellZ >= 0
                    && relativeCellZ <= radiusCells
                    && relativeCellX * relativeCellX + relativeCellZ * relativeCellZ <= radiusCells * radiusCells) {
                    if (relativeCellZ != 0) {
                        this.tryBuildCell(
                            relativePos, faceBuffer, centerCellX, centerCellZ, extrude, relativeCellX, textureWidth, -relativeCellZ, textureHeight, cells
                        );
                    }

                    this.tryBuildCell(
                        relativePos, faceBuffer, centerCellX, centerCellZ, extrude, relativeCellX, textureWidth, relativeCellZ, textureHeight, cells
                    );
                }
            }
        }
    }

    private void tryBuildCell(
        FluffyCloudRenderer.RelativeCameraPos relativePos,
        ByteBuffer faceBuffer,
        int cellX,
        int cellZ,
        boolean extrude,
        int relativeCellX,
        int textureWidth,
        int relativeCellZ,
        int textureHeight,
        int[] cells
    ) {
        int indexX = Math.floorMod(cellX + relativeCellX, textureWidth);
        int indexY = Math.floorMod(cellZ + relativeCellZ, textureHeight);
        int cellData = cells[indexX + indexY * textureWidth];
        if (cellData != 0) {
            if (extrude) {
                this.buildExtrudedCell(relativePos, faceBuffer, relativeCellX, relativeCellZ, indexX, indexY, cellData);
            } else {
                this.buildFlatCell(faceBuffer, relativeCellX, relativeCellZ, indexX, indexY, cellData);
            }
        }
    }

    private void encodeFace(ByteBuffer faceBuffer, int x, int z, Direction direction, int flags, int indexX, int indexY, int cellData) {
        int dirAndFlags = direction.get3DDataValue() | flags;
        dirAndFlags |= (x & 1) << 7;
        dirAndFlags |= (z & 1) << 6;
        faceBuffer.put((byte)(x >> 1)).put((byte)(z >> 1)).put((byte)dirAndFlags).put((byte)indexX).put((byte)indexY).put((byte)(getAlpha(cellData) >> 1));
    }

    private void buildExtrudedCell(FluffyCloudRenderer.RelativeCameraPos relativePos, ByteBuffer faceBuffer, int x, int z, int indexX, int indexY, int cellData) {
        if (relativePos != FluffyCloudRenderer.RelativeCameraPos.BELOW) {
            this.encodeFace(faceBuffer, x, z, Direction.UP, 0, indexX, indexY, cellData);
        }

        if (relativePos != FluffyCloudRenderer.RelativeCameraPos.ABOVE) {
            this.encodeFace(faceBuffer, x, z, Direction.DOWN, 0, indexX, indexY, cellData);
        }

        if (isNorthEmpty(cellData) && z > 0) {
            this.encodeFace(faceBuffer, x, z, Direction.NORTH, 0, indexX, indexY, cellData);
        }

        if (isSouthEmpty(cellData) && z < 0) {
            this.encodeFace(faceBuffer, x, z, Direction.SOUTH, 0, indexX, indexY, cellData);
        }

        if (isWestEmpty(cellData) && x > 0) {
            this.encodeFace(faceBuffer, x, z, Direction.WEST, 0, indexX, indexY, cellData);
        }

        if (isEastEmpty(cellData) && x < 0) {
            this.encodeFace(faceBuffer, x, z, Direction.EAST, 0, indexX, indexY, cellData);
        }

        boolean addInteriorFaces = relativePos == FluffyCloudRenderer.RelativeCameraPos.INSIDE && Math.abs(x) <= 1 && Math.abs(z) <= 1;
        if (addInteriorFaces) {
            for (Direction direction : Direction.values()) {
                this.encodeFace(faceBuffer, x, z, direction, 16, indexX, indexY, cellData);
            }
        }
    }

    private void buildFlatCell(ByteBuffer faceBuffer, int x, int z, int indexX, int indexY, int cellData) {
        this.encodeFace(faceBuffer, x, z, Direction.DOWN, 32, indexX, indexY, cellData);
    }

    public static void endFrames() {
        for (FluffyCloudRenderer r : RENDERERS) {
            r.endFrame();
        }
    }

    public void endFrame() {
        if (this.cloudInfo != null) {
            this.cloudInfo.rotate();
        }
    }

    @Override
    public void close() throws Exception {
        if (this.cloudInfo != null) {
            this.cloudInfo.close();
        }

        if (this.cloudFaces != null) {
            this.cloudFaces.close();
        }
    }

    private static final Minecraft mc() {
        return Minecraft.getInstance();
    }

    enum FadeState {
        NOOP {
            @Override
            float getAlpha(Vec3 camPos, float y) {
                return 1.0F;
            }
        },
        NEAR_VOID_FADE_OUT {
            @Override
            float getAlpha(Vec3 camPos, float y) {
                return 1.0F - NEAR_VOID_FADE_IN.getAlpha(camPos, y);
            }
        },
        NEAR_VOID_FADE_IN {
            @Override
            float getAlpha(Vec3 camPos, float y) {
                return camPos.y <= 0.0 ? Math.clamp((float)(-camPos.y) / 40.0F, 0.0F, 1.0F) : 0.0F;
            }
        },
        RIDING_DRAGON_NEAR_TRANSITION {
            @Override
            float getAlpha(Vec3 camPos, float y) {
                return EnvironmentHooks.getOverworldBiasFromTime();
            }
        };

        abstract float getAlpha(Vec3 var1, float var2);
    }

    enum RelativeCameraPos {
        ABOVE,
        INSIDE,
        BELOW;
    }

    public static class ReloadListener extends SimplePreparableReloadListener<EnumMap<FluffyCloudRenderer.TextureState, FluffyCloudRenderer.TextureData>> {
        protected EnumMap<FluffyCloudRenderer.TextureState, FluffyCloudRenderer.TextureData> prepare(ResourceManager manager, ProfilerFiller profiler) {
            try {
                EnumMap<FluffyCloudRenderer.TextureState, FluffyCloudRenderer.TextureData> map = new EnumMap<>(FluffyCloudRenderer.TextureState.class);

                for (FluffyCloudRenderer.TextureState state : FluffyCloudRenderer.TextureState.values()) {
                    try (
                        InputStream input = manager.open(state.texture);
                        NativeImage texture = NativeImage.read(input);
                    ) {
                        int width = texture.getWidth();
                        int height = texture.getHeight();
                        int[] cells = new int[width * height];

                        for (int y = 0; y < height; y++) {
                            for (int x = 0; x < width; x++) {
                                int color = texture.getPixel(x, y);
                                int alpha = ARGB.alpha(color);
                                if (alpha < 10) {
                                    cells[x + y * width] = 0;
                                } else {
                                    boolean north = FluffyCloudRenderer.isNeighborEmpty(texture.getPixel(x, Math.floorMod(y - 1, height)));
                                    boolean east = FluffyCloudRenderer.isNeighborEmpty(texture.getPixel(Math.floorMod(x + 1, height), y));
                                    boolean south = FluffyCloudRenderer.isNeighborEmpty(texture.getPixel(x, Math.floorMod(y + 1, height)));
                                    boolean west = FluffyCloudRenderer.isNeighborEmpty(texture.getPixel(Math.floorMod(x - 1, height), y));
                                    cells[x + y * width] = FluffyCloudRenderer.packCellData(alpha, north, east, south, west);
                                }
                            }
                        }

                        map.put(state, new FluffyCloudRenderer.TextureData(cells, width, height));
                    }
                }

                return map;
            } catch (IOException ex) {
                RediscoveredMod.LOGGER.error("Failed to load cloud texture", ex);
                return new EnumMap<>(FluffyCloudRenderer.TextureState.class);
            }
        }

        protected void apply(
            EnumMap<FluffyCloudRenderer.TextureState, FluffyCloudRenderer.TextureData> preparations, ResourceManager manager, ProfilerFiller profiler
        ) {
            FluffyCloudRenderer.textureData = preparations;
            FluffyCloudRenderer.RENDERERS.forEach(f -> f.needsRebuild = true);
        }
    }

    public enum RenderLocation implements Predicate<ResourceKey<Level>> {
        SKYLANDS {
            public boolean test(ResourceKey<Level> dimension) {
                return dimension == RediscoveredDimensions.skylandsKey();
            }
        },
        OVERWORLD {
            public boolean test(ResourceKey<Level> dimension) {
                return dimension == Level.OVERWORLD;
            }
        },
        BOTH {
            public boolean test(ResourceKey<Level> dimension) {
                return SKYLANDS.test(dimension) || OVERWORLD.test(dimension);
            }
        };
    }

    record TextureData(int[] cells, int width, int height) {
    }

    enum TextureState {
        FLUFFY_VANILLA(RediscoveredMod.locate("textures/environment/cloud_screen.png"), RediscoveredMod.locate("textures/environment/fluff.png")),
        FLUFFY_LEGACY(RediscoveredMod.locate("textures/environment/cloud_screen_legacy.png"), RediscoveredMod.locate("textures/environment/fluff.png")),
        VANILLA(Identifier.withDefaultNamespace("textures/environment/clouds.png"), RediscoveredMod.locate("textures/environment/flat.png"));

        final Identifier texture;
        final Identifier fluff;

        TextureState(Identifier texture, Identifier fluff) {
            this.texture = texture;
            this.fluff = fluff;
        }
    }
}
