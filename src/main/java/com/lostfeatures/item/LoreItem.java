package com.lostfeatures.item;

import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.TooltipDisplay;

import java.util.function.Consumer;

/** A plain item with a one-line purpose tooltip ({@code tooltip.lostfeatures.<id>}). */
public class LoreItem extends Item {
    private final String key;

    public LoreItem(Properties properties, String id) {
        super(properties);
        this.key = "tooltip.lostfeatures." + id;
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, TooltipDisplay display, Consumer<Component> builder, TooltipFlag flag) {
        builder.accept(Component.translatable(key).withStyle(ChatFormatting.GRAY));
    }
}
