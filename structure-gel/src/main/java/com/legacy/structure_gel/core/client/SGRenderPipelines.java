package com.legacy.structure_gel.core.client;

import com.legacy.structure_gel.core.StructureGelMod;
import com.mojang.blaze3d.PrimitiveTopology;
import com.mojang.blaze3d.pipeline.BlendFunction;
import com.mojang.blaze3d.pipeline.ColorTargetState;
import com.mojang.blaze3d.pipeline.DepthStencilState;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.vertex.DefaultVertexFormat;
import net.minecraft.client.renderer.RenderPipelines;
import net.neoforged.neoforge.client.event.RegisterRenderPipelinesEvent;

public class SGRenderPipelines {
    public static final RenderPipeline WORLD_WIREFRAME = RenderPipeline.builder(RenderPipelines.MATRICES_FOG_LIGHT_DIR_SNIPPET)
        .withLocation(StructureGelMod.locate("world_wireframe"))
        .withVertexShader(StructureGelMod.locate("core/world_wireframe"))
        .withFragmentShader(StructureGelMod.locate("core/world_wireframe"))
        .withColorTargetState(new ColorTargetState(BlendFunction.TRANSLUCENT))
        .withVertexBinding(0, DefaultVertexFormat.POSITION_COLOR)
        .withPrimitiveTopology(PrimitiveTopology.QUADS)
        .withDepthStencilState(DepthStencilState.DEFAULT)
        .withCull(true)
        .build();

    public static void init(RegisterRenderPipelinesEvent event) {
        event.registerPipeline(WORLD_WIREFRAME);
    }
}
