package com.lostfeatures.client.model;

import com.lostfeatures.client.renderer.GiantRenderState;
import com.lostfeatures.entity.LostGiant;
import net.minecraft.client.model.HumanoidModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.util.Mth;

/**
 * Uses the vanilla code-defined giant humanoid geometry (ModelLayers.GIANT) with an original texture,
 * adding readable attack animations: reaching arms when aggressive and an overhead windup before
 * the ground slam.
 */
public class GiantModel extends HumanoidModel<GiantRenderState> {
    public GiantModel(ModelPart root) {
        super(root);
    }

    @Override
    public void setupAnim(GiantRenderState state) {
        super.setupAnim(state);
        if (state.windup > 0.0F) {
            float raise = Mth.clamp(state.windup, 0.0F, 1.0F);
            float angle = -Mth.PI * 0.95F * raise;
            rightArm.xRot = angle;
            leftArm.xRot = angle;
            rightArm.zRot = 0.15F * raise;
            leftArm.zRot = -0.15F * raise;
            body.xRot = -0.15F * raise;
            head.xRot -= 0.2F * raise;
        } else if (state.aggressive) {
            float sway = Mth.sin(state.ageInTicks * 0.1F) * 0.05F;
            rightArm.xRot = -Mth.HALF_PI * 0.7F + sway;
            leftArm.xRot = -Mth.HALF_PI * 0.7F - sway;
        }
    }

    public static float windupProgress(LostGiant giant) {
        return giant.getWindup() / (float) LostGiant.WINDUP_TICKS;
    }
}
