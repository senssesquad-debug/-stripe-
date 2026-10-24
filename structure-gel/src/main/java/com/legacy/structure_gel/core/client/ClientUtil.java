package com.legacy.structure_gel.core.client;

import com.legacy.structure_gel.core.util.Internal;
import com.mojang.blaze3d.vertex.PoseStack;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.state.level.CameraRenderState;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Registry;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceKey;
import net.minecraft.util.Mth;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.level.ClipContext;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.ClipContext.Block;
import net.minecraft.world.level.ClipContext.Fluid;
import net.minecraft.world.phys.BlockHitResult;
import net.minecraft.world.phys.Vec3;

@Internal
public class ClientUtil {
    public static final Map<ResourceKey<? extends Registry<?>>, List<ResourceKey<?>>> REGISTRY_KEYS = new HashMap<>();

    public static BlockHitResult rayTrace(Level level, Player player) {
        Vec3 eyePos = player.getEyePosition(1.0F);
        float pi = (float) Math.PI;
        float radian = pi / 180.0F;
        float pitch = player.getXRot() * radian;
        float yaw = player.getYRot() * radian;
        float cosYaw = Mth.cos(-yaw - pi);
        float sinYaw = Mth.sin(-yaw - pi);
        float cosPitch = -Mth.cos(-pitch);
        float sinPitch = Mth.sin(-pitch);
        double playerReach = player.getAttribute(Attributes.BLOCK_INTERACTION_RANGE).getValue();
        Vec3 endPos = eyePos.add(sinYaw * cosPitch * playerReach, sinPitch * playerReach, cosYaw * cosPitch * playerReach);
        return level.clip(new ClipContext(eyePos, endPos, Block.COLLIDER, Fluid.NONE, player));
    }

    public static void submitName(
        Component component,
        BlockPos pos,
        PoseStack poseStack,
        SubmitNodeCollector nodeCollector,
        CameraRenderState cameraRenderState,
        float partialTicks,
        int packedLight
    ) {
        if (component != null) {
            nodeCollector.submitNameTag(poseStack, new Vec3(0.5, 1.0, 0.5), 0, component, true, packedLight, cameraRenderState);
        }
    }
}
