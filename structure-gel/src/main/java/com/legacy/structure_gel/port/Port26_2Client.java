package com.legacy.structure_gel.port;

import com.mojang.blaze3d.pipeline.RenderTarget;

import net.minecraft.client.Minecraft;
import net.minecraft.client.Options;
import net.minecraft.client.gui.Gui;
import net.minecraft.client.gui.components.ChatComponent;
import net.minecraft.client.gui.screens.Screen;

/**
 * Client-only replacements for Minecraft 26.1.2 APIs that changed in 26.2. Calls to the old APIs in
 * the original bytecode are redirected here by the porter (see port.rules).
 */
public final class Port26_2Client {
    private Port26_2Client() {
    }

    // Minecraft.gui became the screen manager; the old HUD is Gui.hud

    public static Screen Minecraft_screen_get(Minecraft mc) {
        return mc.gui.screen();
    }

    public static void Minecraft_setScreen(Minecraft mc, Screen screen) {
        mc.gui.setScreen(screen);
    }

    public static RenderTarget Minecraft_getMainRenderTarget(Minecraft mc) {
        return mc.gameRenderer.mainRenderTarget();
    }

    public static boolean Options_hideGui_get(Options options) {
        return Minecraft.getInstance().gui.hud.isHidden();
    }

    public static ChatComponent Gui_getChat(Gui gui) {
        return gui.hud.getChat();
    }
}
