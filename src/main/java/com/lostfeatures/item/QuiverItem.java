package com.lostfeatures.item;

import com.lostfeatures.registry.ModDataComponents;
import com.lostfeatures.registry.ModSounds;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundSource;
import net.minecraft.tags.ItemTags;
import net.minecraft.util.Mth;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.TooltipDisplay;
import net.minecraft.world.level.Level;

import java.util.function.Consumer;

/**
 * The quiver from Indev (2009) and the scrapped 1.9 design, made functional. It stores up to
 * {@link QuiverContents#MAX_ARROWS} arrows of one kind. Bows and crossbows draw from it only when the
 * player has no loose arrows (see {@code QuiverHandler}); vanilla ammo rules are otherwise unchanged.
 *
 * <p>Use: pulls matching arrows from the inventory. Sneak-use: empties the quiver into the inventory.</p>
 */
public class QuiverItem extends Item {
    public QuiverItem(Properties properties) {
        super(properties);
    }

    public static QuiverContents contents(ItemStack stack) {
        return stack.getOrDefault(ModDataComponents.QUIVER_CONTENTS.get(), QuiverContents.EMPTY);
    }

    public static void setContents(ItemStack stack, QuiverContents contents) {
        if (contents.isEmpty()) {
            stack.remove(ModDataComponents.QUIVER_CONTENTS.get());
        } else {
            stack.set(ModDataComponents.QUIVER_CONTENTS.get(), contents);
        }
    }

    @Override
    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        ItemStack quiver = player.getItemInHand(hand);
        if (level.isClientSide()) {
            return InteractionResult.SUCCESS;
        }
        QuiverContents contents = contents(quiver);
        Inventory inv = player.getInventory();
        if (player.isShiftKeyDown()) {
            if (contents.isEmpty()) {
                return InteractionResult.PASS;
            }
            int remaining = contents.count();
            while (remaining > 0) {
                int n = Math.min(remaining, contents.arrow().getMaxStackSize());
                ItemStack out = contents.arrow().copyWithCount(n);
                if (!inv.add(out)) {
                    player.drop(out, false);
                }
                remaining -= n;
            }
            setContents(quiver, QuiverContents.EMPTY);
            level.playSound(null, player.blockPosition(), ModSounds.QUIVER_REMOVE.get(), SoundSource.PLAYERS, 0.8F, 1.0F);
            return InteractionResult.SUCCESS;
        }
        boolean changed = false;
        for (int i = 0; i < inv.getContainerSize() && contents.space() > 0; i++) {
            ItemStack slot = inv.getItem(i);
            if (slot.is(ItemTags.ARROWS) && contents.canAccept(slot)) {
                int moved = Math.min(slot.getCount(), contents.space());
                contents = QuiverContents.of(slot, contents.count() + moved);
                slot.shrink(moved);
                changed = true;
            }
        }
        if (changed) {
            setContents(quiver, contents);
            level.playSound(null, player.blockPosition(), ModSounds.QUIVER_INSERT.get(), SoundSource.PLAYERS, 0.8F, 1.0F);
            return InteractionResult.SUCCESS;
        }
        return InteractionResult.PASS;
    }

    @Override
    public boolean isBarVisible(ItemStack stack) {
        return !contents(stack).isEmpty();
    }

    @Override
    public int getBarWidth(ItemStack stack) {
        return Mth.clamp(Math.round(13.0F * contents(stack).count() / QuiverContents.MAX_ARROWS), 0, 13);
    }

    @Override
    public int getBarColor(ItemStack stack) {
        return 0xC8A060;
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, TooltipDisplay display, Consumer<Component> builder, TooltipFlag flag) {
        QuiverContents contents = contents(stack);
        if (contents.isEmpty()) {
            builder.accept(Component.translatable("tooltip.lostfeatures.quiver.empty").withStyle(net.minecraft.ChatFormatting.GRAY));
        } else {
            builder.accept(Component.translatable("tooltip.lostfeatures.quiver.contents", contents.count(), QuiverContents.MAX_ARROWS,
                    contents.arrow().getHoverName()).withStyle(net.minecraft.ChatFormatting.GRAY));
        }
        builder.accept(Component.translatable("tooltip.lostfeatures.quiver.usage").withStyle(net.minecraft.ChatFormatting.DARK_GRAY));
    }
}
