package com.lostfeatures.item;

import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.item.Item;
import net.minecraft.world.item.ItemStack;

/** A sword carved from a Red Dragon fang. Sets struck targets alight for two seconds. */
public class FangBladeItem extends Item {
    public FangBladeItem(Properties properties) {
        super(properties);
    }

    @Override
    public void hurtEnemy(ItemStack stack, LivingEntity target, LivingEntity attacker) {
        super.hurtEnemy(stack, target, attacker);
        if (!target.fireImmune()) {
            target.igniteForTicks(40);
        }
    }
}
