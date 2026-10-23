package com.lostfeatures.client.renderer;

import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;

public class RedDragonRenderState extends LivingEntityRenderState {
    public boolean flying;
    public int breathState;
    public boolean ancestral;
    /** Body pitch in radians derived from vertical velocity while flying (climb/dive lean). */
    public float pitchHint;
}
