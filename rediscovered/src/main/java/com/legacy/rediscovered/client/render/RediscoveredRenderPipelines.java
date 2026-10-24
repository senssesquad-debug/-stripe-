package com.legacy.rediscovered.client.render;

import com.mojang.blaze3d.PrimitiveTopology;
import com.legacy.rediscovered.RediscoveredMod;
import com.mojang.blaze3d.pipeline.BlendFunction;
import com.mojang.blaze3d.pipeline.ColorTargetState;
import com.mojang.blaze3d.pipeline.DepthStencilState;
import com.mojang.blaze3d.pipeline.RenderPipeline;
import com.mojang.blaze3d.pipeline.RenderPipeline.Snippet;
import net.minecraft.client.renderer.BindGroupLayouts;
import net.minecraft.client.renderer.RenderPipelines;
import net.neoforged.api.distmarker.Dist;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.fml.event.IModBusEvent;
import net.neoforged.neoforge.client.event.RegisterRenderPipelinesEvent;

@EventBusSubscriber(Dist.CLIENT)
public class RediscoveredRenderPipelines implements IModBusEvent {
    public static final RenderPipeline ENERGY = RenderPipeline.builder(RenderPipelines.ENTITY_SNIPPET)
        .withLocation(RediscoveredMod.locate("pipeline/energy"))
        .withShaderDefine("ALPHA_CUTOUT", 0.1F)
        .withBindGroupLayout(BindGroupLayouts.SAMPLER1)
        .withColorTargetState(new ColorTargetState(BlendFunction.LIGHTNING))
        .withCull(false)
        .withDepthStencilState(DepthStencilState.DEFAULT)
        .build();
    private static final Snippet FLUFFY_CLOUDS_SNIPPET = RenderPipeline.builder(RenderPipelines.MATRICES_FOG_SNIPPET)
        .withVertexShader(RediscoveredMod.locate("core/fluffy_clouds"))
        .withFragmentShader(RediscoveredMod.locate("core/fluffy_clouds"))
        .withColorTargetState(new ColorTargetState(BlendFunction.TRANSLUCENT))
        .withPrimitiveTopology(PrimitiveTopology.QUADS)
        .withBindGroupLayout(BindGroupLayouts.SAMPLER0)
        .withBindGroupLayout(BindGroupLayouts.CLOUD_INFO)
        .withDepthStencilState(DepthStencilState.DEFAULT)
        .buildSnippet();
    public static final RenderPipeline FLUFFY_CLOUDS = RenderPipeline.builder(FLUFFY_CLOUDS_SNIPPET)
        .withLocation(RediscoveredMod.locate("pipeline/fluffy_clouds"))
        .withCull(true)
        .build();
    public static final RenderPipeline FLAT_FLUFFY_CLOUDS = RenderPipeline.builder(FLUFFY_CLOUDS_SNIPPET)
        .withLocation(RediscoveredMod.locate("pipeline/flat_fluffy_clouds"))
        .withCull(false)
        .build();

    @SubscribeEvent
    public static void init(RegisterRenderPipelinesEvent event) {
        event.registerPipeline(ENERGY);
        event.registerPipeline(FLUFFY_CLOUDS);
        event.registerPipeline(FLAT_FLUFFY_CLOUDS);
    }
}
