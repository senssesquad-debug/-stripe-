package com.lostfeatures.story;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.config.LFConfig;
import com.lostfeatures.entity.CreatureOrigin;
import com.lostfeatures.entity.KillerBunny;
import com.lostfeatures.entity.LostGiant;
import com.lostfeatures.entity.LostIllusioner;
import com.lostfeatures.entity.RedDragon;
import com.lostfeatures.network.JournalPayload;
import com.lostfeatures.registry.ModItems;
import com.lostfeatures.registry.ModSounds;
import net.minecraft.ChatFormatting;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.sounds.SoundSource;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.item.ItemStack;
import net.neoforged.neoforge.network.PacketDistributor;

import java.util.List;

/**
 * Single entry point for everything that can advance the optional story. Every method is safe to
 * call repeatedly: milestones unlock once per player and rewards are attached to the first unlock.
 */
public final class StoryEvents {
    private StoryEvents() {
    }

    public static boolean unlock(ServerPlayer player, Milestone milestone) {
        if (!LFConfig.STORY_ENABLED.getAsBoolean()) {
            return false;
        }
        StoryProgress progress = StoryProgress.get(player.level().getServer());
        if (!progress.unlock(player.getUUID(), milestone)) {
            return false;
        }
        grantReward(player, milestone);
        if (LFConfig.STORY_ANNOUNCEMENTS.getAsBoolean() && player.connection != null) {
            player.sendSystemMessage(Component.translatable("message.lostfeatures.journal_updated",
                    Component.translatable(milestone.titleKey()).withStyle(ChatFormatting.GOLD)).withStyle(ChatFormatting.YELLOW));
            player.level().playSound(null, player.blockPosition(), ModSounds.EVENT_STORY_DISCOVERY.get(), SoundSource.PLAYERS, 0.6F, 1.0F);
        }
        if (LFConfig.DEBUG_LOGGING.getAsBoolean()) {
            LostFeatures.LOGGER.info("[story] {} unlocked {}", player.getGameProfile().name(), milestone.id());
        }
        sync(player, false);
        return true;
    }

    private static void grantReward(ServerPlayer player, Milestone milestone) {
        List<ItemStack> rewards = switch (milestone) {
            case ANCIENT_SITE -> List.of(new ItemStack(ModItems.ANCIENT_KEY.get()));
            case NOTES_DECODED -> List.of(new ItemStack(ModItems.ANCIENT_SMITHING_TEMPLATE.get()));
            case ENDER_DRAGON_VICTORY -> List.of(new ItemStack(ModItems.DISC_DRAGONS_OMEN.get()));
            case WITHER_VICTORY -> List.of(new ItemStack(ModItems.DISC_RUBY_RESONANCE.get()));
            case ANCESTRAL_DEFEATED -> List.of(new ItemStack(ModItems.DISC_THE_LAST_MONOLITH.get()),
                    new ItemStack(ModItems.ANCIENT_SMITHING_TEMPLATE.get(), 2));
            default -> List.of();
        };
        for (ItemStack stack : rewards) {
            ItemStack copy = stack.copy();
            if (!player.getInventory().add(copy)) {
                player.drop(copy, false);
            }
        }
        if (milestone == Milestone.ANCESTRAL_DEFEATED) {
            StoryProgress.get(player.level().getServer()).setWorldFlag("ancestral_silenced");
        }
    }

    public static void sync(ServerPlayer player, boolean open) {
        if (player.connection == null) {
            return; // not connected yet (or a test mock); the login hook syncs later
        }
        StoryProgress progress = StoryProgress.get(player.level().getServer());
        PacketDistributor.sendToPlayer(player, new JournalPayload(List.copyOf(progress.milestones(player.getUUID())),
                List.copyOf(progress.worldFlags()), open));
    }

    // ------------------------------------------------------------------ triggers

    public static void onLostMobDefeated(ServerPlayer player, Entity mob) {
        if (CreatureOrigin.isCreative(mob) && !LFConfig.CREATIVE_SPAWNS_GRANT_PROGRESSION.getAsBoolean()) {
            return;
        }
        if (mob instanceof RedDragon dragon) {
            unlock(player, Milestone.DRAGON_SIGHTED);
            unlock(player, dragon.isAncestral() ? Milestone.ANCESTRAL_DEFEATED : Milestone.DRAGON_DEFEATED);
        } else if (mob instanceof LostGiant) {
            unlock(player, Milestone.GIANT_DEFEATED);
        } else if (mob instanceof LostIllusioner) {
            unlock(player, Milestone.ILLUSIONER_DEFEATED);
        } else if (mob instanceof KillerBunny) {
            unlock(player, Milestone.KILLER_BUNNY_DEFEATED);
        }
    }

    public static void onDragonSighted(ServerPlayer player, RedDragon dragon) {
        if (!CreatureOrigin.isCreative(dragon) || LFConfig.CREATIVE_SPAWNS_GRANT_PROGRESSION.getAsBoolean()) {
            unlock(player, Milestone.DRAGON_SIGHTED);
        }
    }

    public static void onMechanismActivated(ServerPlayer player, String kind) {
        unlock(player, Milestone.MECHANISM_BUILT);
        if ("reactor".equals(kind)) {
            unlock(player, Milestone.REACTOR_AWAKENED);
        }
    }

    public static void onLockedChestOpened(ServerPlayer player) {
        unlock(player, Milestone.LOCKED_CHEST_OPENED);
    }

    public static void onGlyphRead(ServerPlayer player) {
        unlock(player, Milestone.GLYPHS_READ);
    }

    public static void onAltarActivated(ServerPlayer player) {
        unlock(player, Milestone.ALTAR_AWAKENED);
    }

    public static void onStructureDiscovered(ServerPlayer player) {
        unlock(player, Milestone.ANCIENT_SITE);
    }

    public static void onFarLandsReached(ServerPlayer player) {
        unlock(player, Milestone.FAR_LANDS_REACHED);
    }

    public static void onItemObtained(ServerPlayer player, ItemStack stack) {
        if (stack.is(ModItems.RUBY.get())) {
            unlock(player, Milestone.RUBY_FOUND);
        } else if (stack.is(ModItems.ENCRYPTED_NOTES.get())) {
            unlock(player, Milestone.NOTES_FOUND);
        } else if (stack.is(ModItems.DECODED_NOTES.get())) {
            unlock(player, Milestone.NOTES_DECODED);
        } else if (stack.is(ModItems.DRACONIC_SIGIL.get())) {
            unlock(player, Milestone.SIGIL_FORGED);
        } else if (stack.is(ModItems.ANCIENT_JOURNAL.get())) {
            unlock(player, Milestone.FIRST_STEPS);
        }
    }
}
