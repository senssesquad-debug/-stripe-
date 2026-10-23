package com.lostfeatures.item;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.registry.ModItems;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.ProjectileWeaponItem;
import net.neoforged.bus.api.EventPriority;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.entity.living.LivingGetProjectileEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

import java.util.ArrayList;
import java.util.List;

/**
 * Lets bows and crossbows draw from a quiver without changing vanilla ammo logic.
 *
 * <p>Only when vanilla found <em>no</em> ammo at all ({@link LivingGetProjectileEvent} with an empty
 * stack) do we offer a temporary stack copied from the quiver. Vanilla then consumes from that stack
 * exactly as it would from an inventory stack (respecting Infinity, creative mode, multishot). At the
 * end of the server tick we compare counts and subtract what was actually used from the quiver. The
 * offered stack never enters the inventory, so nothing can be duplicated.</p>
 */
@EventBusSubscriber(modid = LostFeatures.MOD_ID)
public final class QuiverHandler {
    private record Pending(ItemStack quiver, ItemStack offered, int offeredCount) {
    }

    private static final List<Pending> PENDING = new ArrayList<>();

    private QuiverHandler() {
    }

    @SubscribeEvent(priority = EventPriority.LOW)
    public static void onGetProjectile(LivingGetProjectileEvent event) {
        // Runs on both sides: the client needs ammo to start the draw animation; only the server
        // tracks and applies consumption, and the quiver contents themselves are server-synced.
        if (!(event.getEntity() instanceof net.minecraft.world.entity.player.Player player) || !event.getProjectileItemStack().isEmpty()) {
            return;
        }
        ItemStack weapon = event.getProjectileWeaponItemStack();
        if (!(weapon.getItem() instanceof ProjectileWeaponItem projectileWeapon)) {
            return;
        }
        Inventory inv = player.getInventory();
        for (int i = 0; i < inv.getContainerSize(); i++) {
            ItemStack quiver = inv.getItem(i);
            if (!quiver.is(ModItems.QUIVER.get())) {
                continue;
            }
            QuiverContents contents = QuiverItem.contents(quiver);
            if (!contents.isEmpty() && projectileWeapon.getAllSupportedProjectiles(weapon).test(contents.arrow())) {
                ItemStack offered = contents.arrow().copyWithCount(Math.min(contents.count(), contents.arrow().getMaxStackSize()));
                if (player instanceof ServerPlayer) {
                    PENDING.add(new Pending(quiver, offered, offered.getCount()));
                }
                event.setProjectileItemStack(offered);
                return;
            }
        }
    }

    @SubscribeEvent
    public static void onServerTick(ServerTickEvent.Post event) {
        if (PENDING.isEmpty()) {
            return;
        }
        for (Pending p : PENDING) {
            int used = p.offeredCount() - p.offered().getCount();
            if (used <= 0 || p.quiver().isEmpty()) {
                continue;
            }
            QuiverContents contents = QuiverItem.contents(p.quiver());
            QuiverItem.setContents(p.quiver(), QuiverContents.of(contents.arrow(), contents.count() - used));
        }
        PENDING.clear();
    }
}
