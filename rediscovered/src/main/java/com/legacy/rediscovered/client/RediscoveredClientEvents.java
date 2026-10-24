package com.legacy.rediscovered.client;

import com.google.common.reflect.TypeToken;
import com.legacy.rediscovered.RediscoveredConfig;
import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.capability.util.ScaleAnimator;
import com.legacy.rediscovered.client.data.manager.TableDisplayOffsetManager;
import com.legacy.rediscovered.client.extension.RubyFluteClient;
import com.legacy.rediscovered.client.extension.SkylandsPortalClient;
import com.legacy.rediscovered.client.gui.ClientQuiverTooltip;
import com.legacy.rediscovered.client.gui.DragonInventoryScreen;
import com.legacy.rediscovered.client.gui.EntityPiPRenderState;
import com.legacy.rediscovered.client.gui.EntityPiPRenderer;
import com.legacy.rediscovered.client.gui.GuardPigmanInventoryScreen;
import com.legacy.rediscovered.client.gui.ItemPiPRenderState;
import com.legacy.rediscovered.client.gui.ItemPiPRenderer;
import com.legacy.rediscovered.client.gui.QuiverOverlay;
import com.legacy.rediscovered.client.gui.QuiverScreen;
import com.legacy.rediscovered.client.gui.RedDragonOverlay;
import com.legacy.rediscovered.client.gui.StoreScreen;
import com.legacy.rediscovered.client.model.DragonArmorModel;
import com.legacy.rediscovered.client.particles.NetherReactorPulseParticle;
import com.legacy.rediscovered.client.particles.PylonShieldBlastParticle;
import com.legacy.rediscovered.client.particles.group.BoltParticleGroup;
import com.legacy.rediscovered.client.render.world.EnvironmentHooks;
import com.legacy.rediscovered.client.render.world.FluffyCloudRenderer;
import com.legacy.rediscovered.data.providers.RediscoveredLangProv;
import com.legacy.rediscovered.entity.dragon.RedDragonOffspringEntity;
import com.legacy.rediscovered.entity.util.IGiant;
import com.legacy.rediscovered.entity.util.animation.AnimData;
import com.legacy.rediscovered.item.util.QuiverData;
import com.legacy.rediscovered.item.util.QuiverTooltip;
import com.legacy.rediscovered.network.PacketHandler;
import com.legacy.rediscovered.network.c_to_s.CycleQuiverPacket;
import com.legacy.rediscovered.registry.RediscoveredBlocks;
import com.legacy.rediscovered.registry.RediscoveredDimensions;
import com.legacy.rediscovered.registry.RediscoveredItems;
import com.legacy.rediscovered.registry.RediscoveredMenuType;
import com.legacy.rediscovered.registry.RediscoveredParticles;
import com.mojang.blaze3d.vertex.PoseStack;
import com.mojang.datafixers.util.Either;
import com.mojang.datafixers.util.Pair;
import java.util.Calendar;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import net.minecraft.ChatFormatting;
import net.minecraft.client.Camera;
import net.minecraft.client.CloudStatus;
import net.minecraft.client.KeyMapping;
import net.minecraft.client.Minecraft;
import net.minecraft.client.gui.screens.inventory.ContainerScreen;
import net.minecraft.client.renderer.CubeMap;
import net.minecraft.client.renderer.SubmitNodeCollector;
import net.minecraft.client.renderer.entity.AbstractHorseRenderer;
import net.minecraft.client.renderer.entity.GiantMobRenderer;
import net.minecraft.client.renderer.entity.LivingEntityRenderer;
import net.minecraft.client.renderer.entity.VillagerRenderer;
import net.minecraft.client.renderer.entity.state.EntityRenderState;
import net.minecraft.client.renderer.entity.state.EquineRenderState;
import net.minecraft.client.renderer.entity.state.LivingEntityRenderState;
import net.minecraft.client.renderer.state.level.BlockOutlineRenderState;
import net.minecraft.client.renderer.state.level.LevelRenderState;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.network.chat.contents.TranslatableContents;
import net.minecraft.resources.Identifier;
import net.minecraft.util.EasingType;
import net.minecraft.util.Mth;
import net.minecraft.util.context.ContextKey;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.effect.MobEffectInstance;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.EquipmentSlot;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.inventory.MenuType;
import net.minecraft.world.inventory.tooltip.TooltipComponent;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.alchemy.PotionContents;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.phys.Vec3;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.event.config.ModConfigEvent.Reloading;
import net.neoforged.neoforge.client.CustomBlockOutlineRenderer;
import net.neoforged.neoforge.client.CustomCloudsRenderer;
import net.neoforged.neoforge.client.event.AddClientReloadListenersEvent;
import net.neoforged.neoforge.client.event.CalculateDetachedCameraDistanceEvent;
import net.neoforged.neoforge.client.event.ExtractBlockOutlineRenderStateEvent;
import net.neoforged.neoforge.client.event.ExtractLevelRenderStateEvent;
import net.neoforged.neoforge.client.event.FlipFrameEvent;
import net.neoforged.neoforge.client.event.RegisterClientTooltipComponentFactoriesEvent;
import net.neoforged.neoforge.client.event.RegisterCustomEnvironmentEffectRendererEvent;
import net.neoforged.neoforge.client.event.RegisterGuiLayersEvent;
import net.neoforged.neoforge.client.event.RegisterItemModelsEvent;
import net.neoforged.neoforge.client.event.RegisterKeyMappingsEvent;
import net.neoforged.neoforge.client.event.RegisterMenuScreensEvent;
import net.neoforged.neoforge.client.event.RegisterParticleGroupsEvent;
import net.neoforged.neoforge.client.event.RegisterParticleProvidersEvent;
import net.neoforged.neoforge.client.event.RegisterPictureInPictureRenderersEvent;
import net.neoforged.neoforge.client.event.InputEvent.MouseButton.Post;
import net.neoforged.neoforge.client.event.RenderTooltipEvent.GatherComponents;
import net.neoforged.neoforge.client.event.ScreenEvent.Opening;
import net.neoforged.neoforge.client.event.ViewportEvent.ComputeCameraAngles;
import net.neoforged.neoforge.client.event.ViewportEvent.ComputeFov;
import net.neoforged.neoforge.client.extensions.common.RegisterClientExtensionsEvent;
import net.neoforged.neoforge.client.gui.VanillaGuiLayers;
import net.neoforged.neoforge.client.renderstate.RegisterRenderStateModifiersEvent;
import net.neoforged.neoforge.common.util.Lazy;
import net.neoforged.neoforge.event.entity.EntityJoinLevelEvent;
import net.neoforged.neoforge.event.entity.player.ItemTooltipEvent;
import net.neoforged.neoforge.event.tick.LevelTickEvent.Pre;
import org.joml.Matrix4fc;

public class RediscoveredClientEvents {
    public static final ContextKey<AnimData> GIANT_SMASH_ANIM = new ContextKey<>(RediscoveredMod.locate("giant_smash_anim"));
    public static final CubeMap PANORAMA_RESOURCES = new CubeMap(RediscoveredMod.locate("textures/gui/panorama/panorama"));
    public static final Identifier PANORAMA_OVERLAY = RediscoveredMod.locate("textures/gui/panorama_overlay.png");
    public static final Identifier STEVE_MD3 = RediscoveredMod.locate("models/entity/steve.md3");
    public static final Identifier RANA_MD3 = RediscoveredMod.locate("models/entity/mcexport01.md3");
    public static final Map<Identifier, Identifier> QUIVER_ITEM_MODEL_IDS = new HashMap<>();
    public static final Set<UUID> ACTIVE_DRAGON_FIGHTS = new HashSet<>();
    public static float dragonThunderTime;
    public static float shakeStrength;

    public static boolean isAprilFools() {
        return isAprilFoolsDay() && RediscoveredConfig.CLIENT.allowAprilFools();
    }

    public static boolean isAprilFoolsDay() {
        return isDay(3, 1);
    }

    static boolean isDay(int month, int day) {
        Calendar calendar = Calendar.getInstance();
        return calendar.get(2) == month && calendar.get(5) == day;
    }

    public static class ForgeEvents {
        private static final CustomBlockOutlineRenderer NO_OUTLINE = new CustomBlockOutlineRenderer() {
            @Override
            public boolean render(
                BlockOutlineRenderState renderState, SubmitNodeCollector submitNodeCollector, PoseStack poseStack, LevelRenderState levelRenderState
            ) {
                return true;
            }
        };

        @SubscribeEvent
        public static void extractBlockOutlines(ExtractBlockOutlineRenderStateEvent event) {
            BlockState state = event.getBlockState();
            if (state.is(RediscoveredBlocks.red_dragon_egg) || state.is(RediscoveredBlocks.mini_dragon_pylon)) {
                event.addCustomRenderer(NO_OUTLINE);
            }
        }

        @SubscribeEvent
        public static void extractLevelRenderState(ExtractLevelRenderStateEvent event) {
            if (event.getLevel().dimension() == RediscoveredDimensions.skylandsKey()) {
                event.getRenderState().skyRenderState.shouldRenderDarkDisc = false;
            }
        }

        @SubscribeEvent
        public static void gatherTooltipComponents(GatherComponents event) {
            ItemStack stack = event.getItemStack();
            Optional<QuiverData> quiverData = QuiverData.get(stack);
            if (quiverData.isPresent()) {
                QuiverData quiver = quiverData.get();
                Optional<TooltipComponent> tooltipImage = quiver.getTooltipImage(stack);
                if (tooltipImage.isPresent()) {
                    event.getTooltipElements().add(1, Either.right(tooltipImage.get()));
                }
            }
        }

        @SubscribeEvent
        public static void onTooltip(ItemTooltipEvent event) {
            PotionContents potion = event.getItemStack().get(DataComponents.POTION_CONTENTS);
            if (potion != null) {
                List<Component> tooltips = event.getToolTip();
                int insertLine = -1;

                for (int i = tooltips.size() - 1; i > -1 && insertLine == -1; i--) {
                    if (matchesTranslationKey(tooltips.get(i), "potion.whenDrank")) {
                        insertLine = i + 1;
                    }
                }

                if (insertLine != -1) {
                    for (MobEffectInstance instance : potion.getAllEffects()) {
                        RediscoveredLangProv.EffectDetails details = RediscoveredLangProv.EFFECT_TOOLTIPS.get(instance.getEffect().getKey());
                        if (details != null) {
                            tooltips.add(insertLine, Component.translatable(details.descriptionKey()).withStyle(ChatFormatting.BLUE));
                        }
                    }
                }
            }
        }

        private static boolean matchesTranslationKey(Component component, String key) {
            return component.getContents() instanceof TranslatableContents trans && trans.getKey().equals(key);
        }

        @SubscribeEvent
        public static void mouseClick(Post event) {
            Minecraft mc = mc();
            if (mc.player != null) {
                int action = event.getAction();
                if ((action == 1 || action == 2) && mc.gui.screen() == null && mc.options.keyAttack.getKey().getValue() == event.getButton()) {
                    Pair<InteractionHand, ItemStack> heldBow = QuiverData.getHeldBow(mc.player);
                    if (!heldBow.getSecond().isEmpty()
                        && !QuiverData.isHoldingAmmo(mc.player, heldBow.getSecond())
                        && QuiverData.get(mc.player.getItemBySlot(EquipmentSlot.CHEST)).isPresent()
                        && (heldBow.getFirst() == InteractionHand.MAIN_HAND || mc.player.isUsingItem())) {
                        QuiverOverlay.setAccessed();
                        PacketHandler.sendToServer(new CycleQuiverPacket());
                    }
                }
            }
        }

        @SubscribeEvent
        public static void onFovCompute(ComputeFov event) {
            Camera camera = event.getCamera();
            double pt = mc().getDeltaTracker().getGameTimeDeltaPartialTick(true);
            if (RediscoveredClientEvents.shakeStrength > 0.0F) {
                float s = RediscoveredConfig.CLIENT.screenShakeIntensity() / 100.0F * Mth.clamp(RediscoveredClientEvents.shakeStrength, 0.0F, 1.0F) * 3.0F;
                double time = (mc().level.getGameTime() + pt) * 2.5;
                float rightLeft = (float)(Math.sin(time) * 0.1F) * EasingType.OUT_SINE.apply(s);
                float upDown = (float)(Math.cos(time) * 0.1F) * EasingType.OUT_QUAD.apply(s);
                camera.move(0.0F, upDown, rightLeft);
            }
        }

        @SubscribeEvent
        public static void onAngleCompute(ComputeCameraAngles event) {
        }

        @SubscribeEvent
        public static void calcCameraDistance(CalculateDetachedCameraDistanceEvent event) {
        }

        @SubscribeEvent
        public static void onClientPreTick(Pre event) {
            if (event.getLevel().isClientSide()) {
                RediscoveredClientEvents.ACTIVE_DRAGON_FIGHTS.removeIf(uuid -> !mc().gui.hud.getBossOverlay().events.keySet().contains(uuid));
                if (RediscoveredClientEvents.ACTIVE_DRAGON_FIGHTS.isEmpty()) {
                    RediscoveredClientEvents.dragonThunderTime -= 0.02F;
                } else {
                    RediscoveredClientEvents.dragonThunderTime += 0.02F;
                }

                RediscoveredClientEvents.dragonThunderTime = Mth.clamp(RediscoveredClientEvents.dragonThunderTime, 0.0F, 1.0F);
                RediscoveredClientEvents.shakeStrength *= 0.7F;
                if (mc().player != null) {
                    EnvironmentHooks.tick(event.getLevel().dimension(), mc().player);
                }
            }
        }

        @SubscribeEvent
        public static void entityPreTick(net.neoforged.neoforge.event.tick.EntityTickEvent.Pre event) {
            if (event.getEntity() instanceof LivingEntity living && living.level().isClientSide() && living instanceof ScaleAnimator animator) {
                animator.rediscovered$getScaleState().tick(living.getScale(), living);
            }
        }

        @SubscribeEvent
        public static void joinlevel(EntityJoinLevelEvent event) {
            if (event.getEntity() == mc().player) {
                RediscoveredClientEvents.ACTIVE_DRAGON_FIGHTS.clear();
                RediscoveredClientEvents.dragonThunderTime = 0.0F;
                RediscoveredClientEvents.shakeStrength = 0.0F;
            }
        }

        @SubscribeEvent
        public static void renderOverlayPre(net.neoforged.neoforge.client.event.RenderGuiLayerEvent.Pre event) {
            Identifier id = event.getName();
            if (RediscoveredConfig.WORLD.redDragonStamina()
                && id.equals(VanillaGuiLayers.CONTEXTUAL_INFO_BAR)
                && mc().player.getVehicle() instanceof RedDragonOffspringEntity dragon
                && dragon.getOwner() == mc().player) {
                event.setCanceled(true);
            }
        }

        @SubscribeEvent
        public static void openScreen(Opening event) {
            if (RediscoveredClientEvents.isAprilFools()
                && event.getNewScreen() instanceof ContainerScreen containerScreen
                && (containerScreen.getMenu().getType().equals(MenuType.GENERIC_9x3) || containerScreen.getMenu().getType().equals(MenuType.GENERIC_9x6))
                && Minecraft.getInstance().level.getRandom().nextFloat() < 0.025F) {
                event.setNewScreen(new StoreScreen());
            }
        }

        @SubscribeEvent
        public static void flipFrame(FlipFrameEvent event) {
            FluffyCloudRenderer.endFrames();
        }

        private static final Minecraft mc() {
            return Minecraft.getInstance();
        }
    }

    public static class ModEvents {
        @SubscribeEvent
        protected static void registerKeyMappings(RegisterKeyMappingsEvent event) {
            event.registerCategory(RediscoveredClientProxy.RED_DRAGON_CATEGORY);

            for (Lazy<KeyMapping> mapping : RediscoveredClientProxy.KEY_MAPPINGS) {
                event.register(mapping.get());
            }
        }

        @SubscribeEvent
        public static void registerTooltips(RegisterClientTooltipComponentFactoriesEvent event) {
            event.register(QuiverTooltip.class, ClientQuiverTooltip::new);
        }

        @SubscribeEvent
        protected static void registerGuiOverlays(RegisterGuiLayersEvent event) {
            event.registerAbove(VanillaGuiLayers.SELECTED_ITEM_NAME, RediscoveredMod.locate("quiver_overlay"), QuiverOverlay::render);
            event.registerAbove(VanillaGuiLayers.CONTEXTUAL_INFO_BAR, RediscoveredMod.locate("red_dragon_stamina_display"), RedDragonOverlay::render);
            if (RediscoveredClientEvents.isAprilFoolsDay()) {
                event.registerBelow(VanillaGuiLayers.CAMERA_OVERLAYS, RediscoveredMod.locate("firefly_overlay"), StoreScreen.StoreOverlay::renderFirefly);
                event.registerAbove(VanillaGuiLayers.CROSSHAIR, RediscoveredMod.locate("lock_overlay"), StoreScreen.StoreOverlay::renderLock);
                event.registerAbove(VanillaGuiLayers.SELECTED_ITEM_NAME, RediscoveredMod.locate("rtx_on"), StoreScreen.StoreOverlay::renderRtx);
            }
        }

        @SubscribeEvent
        public static void registerEffects(RegisterCustomEnvironmentEffectRendererEvent event) {
            event.registerCloudRenderer(
                RediscoveredMod.locate("skylands_fluffy_clouds"),
                new CustomCloudsRenderer() {
                    @Override
                    public boolean renderClouds(
                        LevelRenderState levelRenderState,
                        Vec3 camPos,
                        CloudStatus cloudStatus,
                        int cloudColor,
                        float cloudHeight,
                        int cloudRange,
                        Matrix4fc modelViewMatrix
                    ) {
                        return FluffyCloudRenderer.renderLayers(
                            levelRenderState, camPos, cloudStatus, cloudColor, cloudHeight, 0.0F, cloudRange, modelViewMatrix
                        );
                    }
                }
            );
        }

        @SubscribeEvent
        public static void registerClientExtensions(RegisterClientExtensionsEvent event) {
            event.registerItem(new RubyFluteClient(), RediscoveredItems.ruby_flute);
            event.registerBlock(new SkylandsPortalClient(RediscoveredBlocks.skylands_portal), RediscoveredBlocks.skylands_portal);
        }

        @SubscribeEvent
        public static void registerMenuScreens(RegisterMenuScreensEvent event) {
            event.register(RediscoveredMenuType.QUIVER.get(), QuiverScreen::new);
            event.register(RediscoveredMenuType.DRAGON_INVENTORY.get(), DragonInventoryScreen::new);
            event.register(RediscoveredMenuType.GUARD_PIGMAN_INVENTORY.get(), GuardPigmanInventoryScreen::new);
        }

        @SubscribeEvent
        public static void registerParticleFactories(RegisterParticleProvidersEvent event) {
            RediscoveredParticles.Factories.init(event);
        }

        @SubscribeEvent
        public static void onConfigChange(Reloading event) {
            StoreScreen.configRefresh(event);
        }

        @SubscribeEvent
        public static void registerParticleGroups(RegisterParticleGroupsEvent event) {
            event.register(BoltParticleGroup.PARTICLE_RENDER_TYPE, BoltParticleGroup::new);
            event.register(PylonShieldBlastParticle.PARTICLE_RENDER_TYPE, PylonShieldBlastParticle.Group::new);
            event.register(NetherReactorPulseParticle.PARTICLE_RENDER_TYPE, NetherReactorPulseParticle.Group::new);
        }

        @SubscribeEvent
        public static void registerItemModels(RegisterItemModelsEvent event) {
            event.register(RediscoveredMod.locate("dragon_armor"), DragonArmorModel.Unbaked.MAP_CODEC);
        }

        @SubscribeEvent
        public static void registerPictureInPicture(RegisterPictureInPictureRenderersEvent event) {
            event.register(ItemPiPRenderState.class, ItemPiPRenderer::new);
            event.register(EntityPiPRenderState.class, EntityPiPRenderer::new);
        }

        @SubscribeEvent
        public static void addReloadListeners(AddClientReloadListenersEvent event) {
            event.addListener(RediscoveredMod.locate("fluffy_clouds"), new FluffyCloudRenderer.ReloadListener());
            event.addListener(RediscoveredMod.locate("table_display_offset"), TableDisplayOffsetManager.INSTANCE);
        }

        @SubscribeEvent
        protected static void registerRenderStateMods(RegisterRenderStateModifiersEvent event) {
            event.registerEntityModifier(TypeToken.of(GiantMobRenderer.class), (giant, state) -> {
                if (giant instanceof IGiant gi) {
                    state.setRenderData(RediscoveredClientEvents.GIANT_SMASH_ANIM, gi.rediscovered$getSmashAnim());
                }
            });
            event.registerEntityModifier((TypeToken) TypeToken.of(LivingEntityRenderer.class), RediscoveredClientEvents.ModEvents::modifyScale);
            if (RediscoveredClientEvents.isAprilFoolsDay()) {
                event.registerEntityModifier((TypeToken) TypeToken.of(AbstractHorseRenderer.class), RediscoveredClientEvents.ModEvents::modifyHorseState);
                event.registerEntityModifier(TypeToken.of(VillagerRenderer.class), (villager, state) -> state.villagerData = null);
            }
        }

        private static void modifyScale(Entity entity, EntityRenderState state) {
            if (entity instanceof LivingEntity living
                && living instanceof ScaleAnimator animator
                && state instanceof LivingEntityRenderState livingState
                && RediscoveredConfig.CLIENT.displayResizingAnimation()) {
                ScaleAnimator.ScaleState scalingState = animator.rediscovered$getScaleState();
                if (scalingState.animationActive(living)) {
                    livingState.scale = scalingState.getScale(state.partialTick);
                }
            }
        }

        private static void modifyHorseState(Entity entity, EntityRenderState state) {
            if (StoreScreen.horseSaddle && state instanceof LivingEntityRenderState living && !living.isBaby) {
                living.isInvisible = true;
                living.isInvisibleToPlayer = true;
                if (living instanceof EquineRenderState equine) {
                    equine.saddle = Items.SADDLE.getDefaultInstance();
                    equine.bodyArmorItem = ItemStack.EMPTY;
                }
            }
        }
    }
}
