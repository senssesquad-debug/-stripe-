package com.legacy.rediscovered.client.particles;

import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.client.RediscoveredRenderRefs;
import com.legacy.rediscovered.client.render.model.NetherReactorPulseModel;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.math.Axis;
import java.util.List;
import net.minecraft.client.Camera;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.Model;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.client.particle.ParticleGroup;
import net.minecraft.client.particle.ParticleProvider;
import net.minecraft.client.particle.ParticleRenderType;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.culling.Frustum;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.rendertype.RenderTypes;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.client.renderer.state.level.ParticleGroupRenderState;
import net.minecraft.client.renderer.texture.OverlayTexture;
import net.minecraft.util.ARGB;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.util.Unit;
import net.minecraft.world.phys.Vec3;

public class NetherReactorPulseParticle extends Particle {
    public static final ParticleRenderType PARTICLE_RENDER_TYPE = new ParticleRenderType(RediscoveredMod.find("nether_reactor_pulse"));
    private static final RenderType RENDER_TYPE = RenderTypes.entityTranslucent(RediscoveredMod.locate("textures/particle/nether_reactor_pulse_0.png"));
    private final Model<Unit> model;
    private float alpha = 1.0F;
    private float alphaO = 1.0F;
    private final float initialRotation;
    private int pulses = 0;
    boolean pulsed = false;
    final float maxSize;

    public NetherReactorPulseParticle(ClientLevel level, double x, double y, double z, int pulses, int lifetime, float maxSize) {
        super(level, x, y, z, 0.0, 0.0, 0.0);
        this.model = new NetherReactorPulseModel(Minecraft.getInstance().getEntityModels().bakeLayer(RediscoveredRenderRefs.NETHER_REACTOR_PULSE));
        this.xd = 0.0;
        this.yd = 0.0;
        this.zd = 0.0;
        this.initialRotation = level.getRandom().nextFloat() * 360.0F;
        this.lifetime = lifetime;
        this.pulses = pulses;
        this.maxSize = maxSize;
    }

    @Override
    public int getLightCoords(float pPartialTick) {
        return 15728880;
    }

    @Override
    public ParticleRenderType getGroup() {
        return PARTICLE_RENDER_TYPE;
    }

    @Override
    public void tick() {
        super.tick();
        if (!this.pulsed && this.pulses > 0 && (float)this.age / this.lifetime > 0.5F) {
            this.level.addParticle(new NetherReactorPulseData(this.pulses - 1, this.lifetime, this.maxSize), this.x, this.y + 0.001, this.z, 0.0, 0.0, 0.0);
            this.pulsed = true;
        }

        this.alphaO = this.alpha;
        this.alpha = 1.0F - (float)this.age / this.lifetime;
    }

    public static class Factory implements ParticleProvider<NetherReactorPulseData> {
        public NetherReactorPulseParticle createParticle(
            NetherReactorPulseData type, ClientLevel level, double x, double y, double z, double xSpeed, double ySpeed, double zSpeed, RandomSource rand
        ) {
            return new NetherReactorPulseParticle(level, x, y, z, type.pulses(), type.lifetime(), type.maxSize());
        }
    }

    public static class Group extends ParticleGroup<NetherReactorPulseParticle> {
        public Group(ParticleEngine engine) {
            super(engine);
        }

        @Override
        public ParticleGroupRenderState extractRenderState(Frustum frustum, Camera camera, float partialTickTime) {
            return new NetherReactorPulseParticle.Group.State(
                this.particles.stream().map(particle -> NetherReactorPulseParticle.Group.RenderState.fromParticle(particle, camera, partialTickTime)).toList()
            );
        }

        private record RenderState(PoseStack poseStack, Model<Unit> model, float alpha) {
            public static NetherReactorPulseParticle.Group.RenderState fromParticle(NetherReactorPulseParticle particle, Camera camera, float partialTicks) {
                float age = particle.age + partialTicks;
                PoseStack poseStack = new PoseStack();
                poseStack.pushPose();
                Vec3 vec3 = camera.position();
                float f = (float)(Mth.lerp(partialTicks, particle.xo, particle.x) - vec3.x());
                float f1 = (float)(Mth.lerp(partialTicks, particle.yo, particle.y) - vec3.y());
                float f2 = (float)(Mth.lerp(partialTicks, particle.zo, particle.z) - vec3.z());
                poseStack.translate(f, f1, f2);
                poseStack.mulPose(Axis.YP.rotationDegrees(age * 2.0F + particle.initialRotation));
                float scale = age / particle.lifetime * particle.maxSize;
                poseStack.scale(scale, scale, scale);
                return new NetherReactorPulseParticle.Group.RenderState(poseStack, particle.model, Mth.lerp(partialTicks, particle.alphaO, particle.alpha));
            }
        }

        private record State(List<NetherReactorPulseParticle.Group.RenderState> states) implements ParticleGroupRenderState {
            @Override
            public void submit(SubmitNodeCollector submitNodeCollector, CameraRenderState camera) {
                for (NetherReactorPulseParticle.Group.RenderState state : this.states) {
                    submitNodeCollector.submitModel(
                        state.model,
                        Unit.INSTANCE,
                        state.poseStack,
                        NetherReactorPulseParticle.RENDER_TYPE,
                        15728880,
                        OverlayTexture.NO_OVERLAY,
                        ARGB.white(state.alpha),
                        null,
                        0,
                        null
                    );
                }
            }
        }
    }
}
