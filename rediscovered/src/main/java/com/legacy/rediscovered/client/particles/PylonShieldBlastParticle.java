package com.legacy.rediscovered.client.particles;

import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.client.RediscoveredRenderRefs;
import com.legacy.rediscovered.client.render.RediscoveredRenderTypes;
import com.legacy.rediscovered.client.render.entity.DragonPylonRenderer;
import com.mojang.blaze3d.vertex.PoseStack;
import java.util.List;
import net.minecraft.client.Camera;
import net.minecraft.client.Minecraft;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.particle.Particle;
import net.minecraft.client.particle.ParticleEngine;
import net.minecraft.client.particle.ParticleGroup;
import net.minecraft.client.particle.ParticleProvider;
import net.minecraft.client.particle.ParticleRenderType;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.culling.Frustum;
import net.minecraft.client.renderer.rendertype.RenderType;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.client.renderer.state.level.ParticleGroupRenderState;
import net.minecraft.client.renderer.texture.TextureAtlasSprite;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.phys.Vec3;

public class PylonShieldBlastParticle extends Particle {
    public static final ParticleRenderType PARTICLE_RENDER_TYPE = new ParticleRenderType(RediscoveredMod.find("pylon_shield_blast"), RediscoveredMod.find("pylon_shield_blast"));
    private final ModelPart model = Minecraft.getInstance().getEntityModels().bakeLayer(RediscoveredRenderRefs.DRAGON_PYLON).getChild("cube");
    private final float initialRotation;
    final float startSize;
    final float endSize;
    final float startAlpha;
    final float endAlpha;
    final RenderType shieldRenderType;
    final TextureAtlasSprite shieldSprite;

    public PylonShieldBlastParticle(
        ClientLevel level, double x, double y, double z, int lifetime, float startSize, float endSize, float startAlpha, float endAlpha
    ) {
        super(level, x, y, z, 0.0, 0.0, 0.0);
        this.xd = 0.0;
        this.yd = 0.0;
        this.zd = 0.0;
        this.initialRotation = level.getRandom().nextFloat() * 360.0F;
        this.lifetime = lifetime;
        this.startSize = startSize;
        this.endSize = endSize;
        this.startAlpha = startAlpha;
        this.endAlpha = endAlpha;
        this.shieldRenderType = DragonPylonRenderer.SHIELD_SPRITE.renderType(RediscoveredRenderTypes::energy);
        this.shieldSprite = Minecraft.getInstance().getAtlasManager().get(DragonPylonRenderer.SHIELD_SPRITE);
    }

    @Override
    public void tick() {
        super.tick();
    }

    @Override
    public int getLightCoords(float pPartialTick) {
        return 15728880;
    }

    @Override
    public ParticleRenderType getGroup() {
        return PARTICLE_RENDER_TYPE;
    }

    public static class Factory implements ParticleProvider<PylonShieldBlastData> {
        public PylonShieldBlastParticle createParticle(
            PylonShieldBlastData type, ClientLevel level, double x, double y, double z, double xSpeed, double ySpeed, double zSpeed, RandomSource rand
        ) {
            return new PylonShieldBlastParticle(level, x, y, z, type.lifetime(), type.startSize(), type.endSize(), type.startAlpha(), type.endAlpha());
        }
    }

    public static class Group extends ParticleGroup<PylonShieldBlastParticle> {
        public Group(ParticleEngine engine) {
            super(engine);
        }

        @Override
        public ParticleGroupRenderState extractRenderState(Frustum frustum, Camera camera, float partialTickTime) {
            return new PylonShieldBlastParticle.Group.State(
                this.particles.stream().map(particle -> PylonShieldBlastParticle.Group.RenderState.fromParticle(particle, camera, partialTickTime)).toList()
            );
        }

        private record RenderState(
            PoseStack poseStack, ModelPart model, RenderType renderType, TextureAtlasSprite sprite, int lightCoords, float rotation, float scale, float alpha
        ) {
            public static PylonShieldBlastParticle.Group.RenderState fromParticle(PylonShieldBlastParticle particle, Camera camera, float partialTicks) {
                float age = particle.age + partialTicks;
                float endPercent = Mth.clamp(age / particle.getLifetime(), 0.0F, 1.0F);
                float startPercent = 1.0F - endPercent;
                PoseStack poseStack = new PoseStack();
                poseStack.pushPose();
                Vec3 vec3 = camera.position();
                float x = (float)(Mth.lerp(partialTicks, particle.xo, particle.x) - vec3.x());
                float y = (float)(Mth.lerp(partialTicks, particle.yo, particle.y) - vec3.y());
                float z = (float)(Mth.lerp(partialTicks, particle.zo, particle.z) - vec3.z());
                poseStack.translate(x, y, z);
                float scale = particle.startSize * startPercent + particle.endSize * endPercent;
                float alpha = particle.startAlpha * startPercent + particle.endAlpha * endPercent;
                float rotation = particle.initialRotation + age * 20.0F;
                return new PylonShieldBlastParticle.Group.RenderState(
                    poseStack, particle.model, particle.shieldRenderType, particle.shieldSprite, particle.getLightCoords(partialTicks), rotation, scale, alpha
                );
            }
        }

        private record State(List<PylonShieldBlastParticle.Group.RenderState> states) implements ParticleGroupRenderState {
            @Override
            public void submit(SubmitNodeCollector submitNodeCollector, CameraRenderState camera) {
                for (PylonShieldBlastParticle.Group.RenderState state : this.states) {
                    DragonPylonRenderer.renderPylonShields(
                        state.model,
                        state.poseStack,
                        submitNodeCollector,
                        state.renderType,
                        state.sprite,
                        state.lightCoords,
                        state.rotation,
                        state.scale,
                        1.18F,
                        1,
                        state.alpha
                    );
                }
            }
        }
    }
}
