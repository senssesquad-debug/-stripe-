package com.lostfeatures.client.renderer;

import net.minecraft.client.renderer.entity.state.HumanoidRenderState;

public class GiantRenderState extends HumanoidRenderState {
    /** 0..1 progress of the ground-slam windup (arms raised). */
    public float windup;
    public boolean aggressive;
}
