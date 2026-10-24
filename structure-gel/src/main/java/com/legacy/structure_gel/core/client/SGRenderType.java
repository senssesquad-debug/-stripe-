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

    public static ByteBufferBuilder createWireframeBuffer() {
        return new ByteBufferBuilder(WORLD_WIREFRAME.bufferSize());
    }

    private SGRenderType() {
    }
}
