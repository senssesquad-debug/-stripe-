package com.legacy.rediscovered.client.particles.group;

import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.client.particles.IBoltParticle;
import com.legacy.rediscovered.client.render.RediscoveredRendering;
import com.mojang.blaze3d.vertex.PoseStack;
import java.util.List;
import net.minecraft.client.Camera;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.client.particle.ParticleGroup;
import net.minecraft.client.particle.ParticleRenderType;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.culling.Frustum;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.client.renderer.state.level.ParticleGroupRenderState;
import net.minecraft.util.Mth;
import net.minecraft.world.phys.Vec3;

public class BoltParticleGroup<P extends Particle & IBoltParticle> extends ParticleGroup<P> {
    public static final ParticleRenderType PARTICLE_RENDER_TYPE = new ParticleRenderType(RediscoveredMod.find("lightning_bolt"), RediscoveredMod.find("lightning_bolt"));

    public BoltParticleGroup(ParticleEngine engine) {
        super(engine);
    }

    @Override
    public ParticleGroupRenderState extractRenderState(Frustum frustum, Camera camera, float partialTickTime) {
        return new BoltParticleGroup.State(
            this.particles
                .stream()
                .map(particle -> BoltParticleGroup.LightningBoltParticleRenderState.fromParticle((P)particle, camera, partialTickTime))
                .toList()
        );
    }

    private record LightningBoltParticleRenderState(RediscoveredRendering.Bolt bolt, PoseStack poseStack, int age, Vec3 pos) {
        public static <P extends Particle & IBoltParticle> BoltParticleGroup.LightningBoltParticleRenderState fromParticle(
            P particle, Camera camera, float partialTicks
        ) {
            int age = particle.getAge();
            int lifetime = particle.getLifetime();
            float time = Mth.clamp(age + partialTicks, 0.0F, lifetime) / lifetime;
            PoseStack poseStack = new PoseStack();
            poseStack.pushPose();
            Vec3 vec3 = camera.position();
            Vec3 p = particle.pos();
            Vec3 po = particle.posOld();
            float x = (float)(Mth.lerp(partialTicks, po.x, p.x) - vec3.x());
            float y = (float)(Mth.lerp(partialTicks, po.y, p.y) - vec3.y());
            float z = (float)(Mth.lerp(partialTicks, po.z, p.z) - vec3.z());
            poseStack.translate(x, y, z);
            return new BoltParticleGroup.LightningBoltParticleRenderState(particle.getBolt(time), poseStack, age, p);
        }
    }

    private record State(List<BoltParticleGroup.LightningBoltParticleRenderState> states) implements ParticleGroupRenderState {
        @Override
        public void submit(SubmitNodeCollector submitNodeCollector, CameraRenderState camera) {
            for (BoltParticleGroup.LightningBoltParticleRenderState state : this.states) {
                Vec3 pos = state.pos;
                state.bolt.submit(state.poseStack, submitNodeCollector, (int)(state.age + pos.x + pos.z) / 2 * 10);
            }
        }
    }
}
