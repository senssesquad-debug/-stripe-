package com.legacy.structure_gel.core.client;

import com.legacy.structure_gel.core.StructureGelMod;
import com.mojang.blaze3d.pipeline.BlendFunction;
import com.mojang.blaze3d.pipeline.ColorTargetState;
import com.mojang.blaze3d.pipeline.DepthStencilState;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import com.mojang.blaze3d.vertex.VertexFormat.Mode;
import net.minecraft.client.renderer.RenderPipelines;
import net.neoforged.neoforge.client.event.RegisterRenderPipelinesEvent;

public class SGRenderPipelines {
    public static final RenderPipeline WORLD_WIREFRAME = RenderPipeline.builder(RenderPipelines.MATRICES_FOG_LIGHT_DIR_SNIPPET)
        .withLocation(StructureGelMod.locate("world_wireframe"))
        .withVertexShader(StructureGelMod.locate("core/world_wireframe"))
        .withFragmentShader(StructureGelMod.locate("core/world_wireframe"))
        .withColorTargetState(new ColorTargetState(BlendFunction.TRANSLUCENT))
        .withVertexFormat(DefaultVertexFormat.POSITION_COLOR, Mode.QUADS)
        .withDepthStencilState(DepthStencilState.DEFAULT)
        .withCull(true)
        .build();

    public static void init(RegisterRenderPipelinesEvent event) {
        event.registerPipeline(WORLD_WIREFRAME);
    }
}
