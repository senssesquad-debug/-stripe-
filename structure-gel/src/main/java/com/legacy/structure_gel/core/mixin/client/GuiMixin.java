package com.legacy.structure_gel.core.mixin.client;

import com.legacy.structure_gel.core.client.ClientProxy;
import net.minecraft.client.gui.Hud;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

// 26.2: the HUD (and its portal overlay) moved from Gui to Hud
@Mixin(Hud.class)
public class GuiMixin {
    @Inject(at = @At("HEAD"), method = "extractPortalOverlay", cancellable = true)
    private void renderPortal(GuiGraphicsExtractor guiGraphics, float alpha, CallbackInfo callback) {
        if (ClientProxy.lastPortal.isPresent()) {
            ClientProxy.lastPortal.get().renderPortalOverlay(guiGraphics, alpha);
            callback.cancel();
        }
    }
}
