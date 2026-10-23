package com.lostfeatures.item;

import com.lostfeatures.registry.ModDataComponents;
import com.lostfeatures.registry.ModSounds;
import net.minecraft.network.chat.Component;
import net.minecraft.sounds.SoundEvent;
import net.minecraft.sounds.SoundSource;
import net.minecraft.stats.Stats;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ItemUseAnimation;
import net.minecraft.world.item.TooltipFlag;
import net.minecraft.world.item.component.TooltipDisplay;
import net.minecraft.world.level.Level;
import net.minecraft.world.level.gameevent.GameEvent;

import java.util.function.Consumer;

/**
 * Restores the copper horn removed after snapshots 22w13a-22w16b. Ten tune variants, each with a
 * melody (default), harmony (looking up 45 degrees or more) and bass (sneaking) part; one second to
 * play and a four second cooldown, as researched. All 30 sounds are original mod audio.
 */
public class CopperHornItem extends Item {
    public static final int TUNES = 10;
    private static final String[] TUNE_NAMES = {
            "great_sky_falling", "old_hymn_resting", "pure_water_desire", "mumble_fire_memory", "dry_urge_anger",
            "clear_temper_journey", "fresh_nest_thought", "secret_lake_tear", "fearless_river_gift", "sweet_moon_love"
    };

    public CopperHornItem(Properties properties) {
        super(properties);
    }

    public static int tune(ItemStack stack) {
        return stack.getOrDefault(ModDataComponents.HORN_TUNE.get(), 0);
    }

    public static ItemStack withTune(Item item, int tune) {
        ItemStack stack = new ItemStack(item);
        stack.set(ModDataComponents.HORN_TUNE.get(), Math.floorMod(tune, TUNES));
        return stack;
    }

    @Override
    public void onCraftedBy(ItemStack stack, Player player) {
        super.onCraftedBy(stack, player);
        if (!stack.has(ModDataComponents.HORN_TUNE.get())) {
            stack.set(ModDataComponents.HORN_TUNE.get(), player.getRandom().nextInt(TUNES));
        }
    }

    @Override
    public InteractionResult use(Level level, Player player, InteractionHand hand) {
        ItemStack stack = player.getItemInHand(hand);
        int tune = tune(stack);
        SoundEvent sound;
        if (player.isShiftKeyDown()) {
            sound = ModSounds.COPPER_HORN_BASS.get(tune).get();
        } else if (player.getXRot() <= -45.0F) {
            sound = ModSounds.COPPER_HORN_HARMONY.get(tune).get();
        } else {
            sound = ModSounds.COPPER_HORN_MELODY.get(tune).get();
        }
        player.startUsingItem(hand);
        level.playSound(player, player, sound, SoundSource.RECORDS, 16.0F, 1.0F);
        level.gameEvent(GameEvent.INSTRUMENT_PLAY, player.position(), GameEvent.Context.of(player));
        player.getCooldowns().addCooldown(stack, 80);
        player.awardStat(Stats.ITEM_USED.get(this));
        return InteractionResult.CONSUME;
    }

    @Override
    public int getUseDuration(ItemStack stack, LivingEntity user) {
        return 20;
    }

    @Override
    public ItemUseAnimation getUseAnimation(ItemStack stack) {
        return ItemUseAnimation.TOOT_HORN;
    }

    @Override
    public void appendHoverText(ItemStack stack, TooltipContext context, TooltipDisplay display, Consumer<Component> builder, TooltipFlag flag) {
        if (stack.has(ModDataComponents.HORN_TUNE.get())) {
            builder.accept(Component.translatable("tune.lostfeatures." + TUNE_NAMES[tune(stack)]).withStyle(net.minecraft.ChatFormatting.GRAY));
        } else {
            builder.accept(Component.translatable("tooltip.lostfeatures.copper_horn.unattuned").withStyle(net.minecraft.ChatFormatting.GRAY));
        }
    }

    public static String tuneName(int tune) {
        return TUNE_NAMES[Math.floorMod(tune, TUNES)];
    }
}
