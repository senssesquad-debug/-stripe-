package com.lostfeatures.item;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.registry.ModTags;
import net.minecraft.resources.ResourceKey;
import net.minecraft.sounds.SoundEvents;
import net.minecraft.world.item.equipment.ArmorMaterial;
import net.minecraft.world.item.equipment.ArmorType;
import net.minecraft.world.item.equipment.EquipmentAsset;
import net.minecraft.world.item.equipment.EquipmentAssets;

import java.util.EnumMap;
import java.util.Map;

/**
 * Armor materials. Studded armor sits between chainmail and iron: slightly less protection than
 * iron, but cheap (leather + iron nuggets) and highly enchantable, giving it an early-game niche.
 * Dragonscale is a single chestplate upgrade with fire-resistant toughness.
 */
public final class ModArmorMaterials {
    public static final ResourceKey<EquipmentAsset> STUDDED_ASSET = ResourceKey.create(EquipmentAssets.ROOT_ID, LostFeatures.id("studded"));
    public static final ResourceKey<EquipmentAsset> DRAGONSCALE_ASSET = ResourceKey.create(EquipmentAssets.ROOT_ID, LostFeatures.id("dragonscale"));

    public static final ArmorMaterial STUDDED = new ArmorMaterial(13, defense(2, 4, 5, 2, 4), 17,
            SoundEvents.ARMOR_EQUIP_CHAIN, 0.0F, 0.0F, ModTags.Items.REPAIRS_STUDDED_ARMOR, STUDDED_ASSET);
    public static final ArmorMaterial DRAGONSCALE = new ArmorMaterial(30, defense(3, 6, 8, 3, 9), 12,
            SoundEvents.ARMOR_EQUIP_NETHERITE, 2.5F, 0.05F, ModTags.Items.REPAIRS_DRAGONSCALE, DRAGONSCALE_ASSET);

    private static Map<ArmorType, Integer> defense(int boots, int leggings, int chest, int helmet, int body) {
        Map<ArmorType, Integer> map = new EnumMap<>(ArmorType.class);
        map.put(ArmorType.BOOTS, boots);
        map.put(ArmorType.LEGGINGS, leggings);
        map.put(ArmorType.CHESTPLATE, chest);
        map.put(ArmorType.HELMET, helmet);
        map.put(ArmorType.BODY, body);
        return map;
    }

    private ModArmorMaterials() {
    }
}
