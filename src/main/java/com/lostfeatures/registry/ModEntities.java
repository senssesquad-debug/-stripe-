package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.entity.KillerBunny;
import com.lostfeatures.entity.LostGiant;
import com.lostfeatures.entity.LostIllusioner;
import com.lostfeatures.entity.RedDragon;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.MobCategory;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.event.entity.EntityAttributeCreationEvent;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

public final class ModEntities {
    public static final DeferredRegister.Entities ENTITIES = DeferredRegister.createEntities(LostFeatures.MOD_ID);

    public static final DeferredHolder<EntityType<?>, EntityType<RedDragon>> RED_DRAGON = ENTITIES.registerEntityType("red_dragon",
            RedDragon::new, MobCategory.MONSTER, b -> b.sized(3.2F, 2.4F).eyeHeight(2.0F).fireImmune().clientTrackingRange(12).notInPeaceful());
    public static final DeferredHolder<EntityType<?>, EntityType<LostGiant>> GIANT = ENTITIES.registerEntityType("giant",
            LostGiant::new, MobCategory.MONSTER, b -> b.sized(3.6F, 12.0F).eyeHeight(10.44F).clientTrackingRange(12).notInPeaceful());
    public static final DeferredHolder<EntityType<?>, EntityType<LostIllusioner>> ILLUSIONER = ENTITIES.registerEntityType("illusioner",
            LostIllusioner::new, MobCategory.MONSTER, b -> b.sized(0.6F, 1.95F).passengerAttachments(2.0F).ridingOffset(-0.6F)
                    .clientTrackingRange(8).notInPeaceful());
    public static final DeferredHolder<EntityType<?>, EntityType<KillerBunny>> KILLER_BUNNY = ENTITIES.registerEntityType("killer_bunny",
            KillerBunny::new, MobCategory.MONSTER, b -> b.sized(0.49F, 0.6F).eyeHeight(0.5F).clientTrackingRange(8).notInPeaceful());

    private ModEntities() {
    }

    public static void registerAttributes(EntityAttributeCreationEvent event) {
        event.put(RED_DRAGON.get(), RedDragon.createAttributes().build());
        event.put(GIANT.get(), LostGiant.createAttributes().build());
        event.put(ILLUSIONER.get(), LostIllusioner.createLostAttributes().build());
        event.put(KILLER_BUNNY.get(), KillerBunny.createAttributes().build());
    }

    public static void register(IEventBus bus) {
        ENTITIES.register(bus);
    }
}
