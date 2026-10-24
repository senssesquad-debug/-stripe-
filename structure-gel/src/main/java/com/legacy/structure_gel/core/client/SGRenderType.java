package com.legacy.structure_gel.core.client;

import com.legacy.structure_gel.core.StructureGelMod;
import com.mojang.blaze3d.vertex.ByteBufferBuilder;
import net.minecraft.client.renderer.rendertype.RenderSetup;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.rendertype.RenderTypes;

public abstract class SGRenderType extends RenderTypes {
    public static final RenderType WORLD_WIREFRAME = RenderType.create(
        StructureGelMod.locate("world_wireframe").toString(), RenderSetup.builder(SGRenderPipelines.WORLD_WIREFRAME).sortOnUpload().createRenderSetup()
    );

    // RenderType no longer exposes its buffer size; 1536 is the RenderSetup default used for WORLD_WIREFRAME
    private static final int WIREFRAME_BUFFER_SIZE = 1536;

    public static ByteBufferBuilder createWireframeBuffer() {
        return new ByteBufferBuilder(WIREFRAME_BUFFER_SIZE);
    }

    private SGRenderType() {
    }
}
