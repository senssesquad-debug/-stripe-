package com.legacy.rediscovered.client.model;

import com.legacy.rediscovered.RediscoveredMod;
import com.legacy.rediscovered.item.util.DragonArmorTrim;
import com.mojang.serialization.Codec;
import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import it.unimi.dsi.fastutil.objects.Object2ObjectMap;
import it.unimi.dsi.fastutil.objects.Object2ObjectOpenHashMap;
import java.util.EnumMap;
import java.util.List;
import java.util.Optional;
import net.minecraft.client.multiplayer.ClientLevel;
import net.minecraft.client.renderer.block.dispatch.BlockModelRotation;
import net.minecraft.client.renderer.item.CuboidItemModelWrapper;
import net.minecraft.client.renderer.item.ItemModel;
import net.minecraft.client.renderer.item.ItemModelResolver;
import net.minecraft.client.renderer.item.ItemStackRenderState;
import net.minecraft.client.renderer.item.ModelRenderProperties;
import net.minecraft.client.renderer.item.ItemModel.BakingContext;
import net.minecraft.client.resources.model.ModelBaker;
import net.minecraft.client.resources.model.ModelDebugName;
import net.minecraft.client.resources.model.ResolvedModel;
import net.minecraft.client.resources.model.ResolvableModel.Resolver;
import net.minecraft.client.resources.model.cuboid.ItemTransforms;
import net.minecraft.client.resources.model.cuboid.ItemModelGenerator.ItemLayerKey;
import net.minecraft.client.resources.model.geometry.QuadCollection;
import net.minecraft.client.resources.model.sprite.Material;
import net.minecraft.client.resources.model.sprite.MaterialBaker;
import net.minecraft.client.resources.model.sprite.Material.Baked;
import net.minecraft.resources.Identifier;
import net.minecraft.world.entity.ItemOwner;
import net.minecraft.world.item.ItemDisplayContext;
import net.minecraft.world.item.ItemStack;
import org.joml.Matrix4fc;
import org.jspecify.annotations.Nullable;

public class DragonArmorModel implements ItemModel {
    private static final ModelDebugName DEBUG_NAME = () -> "DragonArmorModel";
    private final EnumMap<DragonArmorTrim.Decoration, ItemModel> itemsWithoutTrim = new EnumMap<>(DragonArmorTrim.Decoration.class);
    private final EnumMap<DragonArmorTrim.Decoration, Object2ObjectMap<String, ItemModel>> itemsWithTrims = new EnumMap<>(DragonArmorTrim.Decoration.class);
    private final EnumMap<DragonArmorTrim.Decoration, DragonArmorModel.TextureLayer> textureLayers = new EnumMap<>(DragonArmorTrim.Decoration.class);
    private final BakingContext bakingContext;
    private final Matrix4fc transformation;
    private final ItemTransforms itemTransforms;

    private DragonArmorModel(
        DragonArmorModel.TextureLayer chain,
        DragonArmorModel.TextureLayer plating,
        DragonArmorModel.TextureLayer inlay,
        BakingContext bakingContext,
        Matrix4fc transformation
    ) {
        this.textureLayers.put(DragonArmorTrim.Decoration.CHAIN, chain);
        this.textureLayers.put(DragonArmorTrim.Decoration.PLATING, plating);
        this.textureLayers.put(DragonArmorTrim.Decoration.INLAY, inlay);

        for (DragonArmorTrim.Decoration decor : DragonArmorTrim.Decoration.values()) {
            this.itemsWithTrims.put(decor, new Object2ObjectOpenHashMap<>());
        }

        this.bakingContext = bakingContext;
        this.transformation = transformation;
        ResolvedModel baseItemModel = bakingContext.blockModelBaker().getModel(Identifier.withDefaultNamespace("item/generated"));
        this.itemTransforms = baseItemModel.getTopTransforms();
    }

    @Override
    public void update(
        ItemStackRenderState state,
        ItemStack stack,
        ItemModelResolver resolver,
        ItemDisplayContext context,
        @Nullable ClientLevel level,
        @Nullable ItemOwner owner,
        int seed
    ) {
        Optional<DragonArmorTrim> trim = DragonArmorTrim.getTrim(stack);

        for (DragonArmorTrim.Decoration decor : DragonArmorTrim.Decoration.values()) {
            DragonArmorModel.TextureLayer layer = this.textureLayers.get(decor);
            trim.map(d -> d.getMaterial(decor).orElse(null))
                .ifPresentOrElse(
                    material -> {
                        String suffix = material.value().assets().base().suffix();
                        this.itemsWithTrims
                            .get(decor)
                            .computeIfAbsent(suffix, (java.util.function.Function<String, ItemModel>) s -> this.createTrimLayer(layer.baseTrimTexture, s))
                            .update(state, stack, resolver, context, level, owner, seed);
                    },
                    () -> this.itemsWithoutTrim
                        .computeIfAbsent(decor, d -> this.createLayer(layer.untrimmedTexture))
                        .update(state, stack, resolver, context, level, owner, seed)
                );
        }
    }

    private ItemModel createTrimLayer(Identifier baseTrimTexture, String materialSuffix) {
        return this.createLayer(baseTrimTexture.withSuffix("_" + materialSuffix));
    }

    private ItemModel createLayer(Identifier texture) {
        ModelBaker baker = this.bakingContext.blockModelBaker();
        MaterialBaker materials = baker.materials();
        Baked overlayMat = materials.get(new Material(texture), DEBUG_NAME);
        ModelRenderProperties overlayRenderProps = new ModelRenderProperties(false, overlayMat, this.itemTransforms);
        QuadCollection overlayQuads = baker.compute(new ItemLayerKey(overlayMat, BlockModelRotation.IDENTITY, 0));
        return new CuboidItemModelWrapper(List.of(), overlayQuads, overlayRenderProps, this.transformation);
    }

    public record TextureLayer(Identifier untrimmedTexture, Identifier baseTrimTexture) {
        private static final Codec<DragonArmorModel.TextureLayer> CODEC = RecordCodecBuilder.create(
            instance -> instance.group(
                    Identifier.CODEC.fieldOf("untrimmed_texture").forGetter(DragonArmorModel.TextureLayer::untrimmedTexture),
                    Identifier.CODEC.fieldOf("base_trim_texture").forGetter(DragonArmorModel.TextureLayer::baseTrimTexture)
                )
                .apply(instance, DragonArmorModel.TextureLayer::new)
        );

        public static DragonArmorModel.TextureLayer of(String baseName) {
            return new DragonArmorModel.TextureLayer(RediscoveredMod.locate("item/" + baseName), RediscoveredMod.locate("trims/items/" + baseName));
        }
    }

    public record Unbaked(DragonArmorModel.TextureLayer chain, DragonArmorModel.TextureLayer plating, DragonArmorModel.TextureLayer inlay)
        implements net.minecraft.client.renderer.item.ItemModel.Unbaked {
        public static final MapCodec<DragonArmorModel.Unbaked> MAP_CODEC = RecordCodecBuilder.mapCodec(
            instance -> instance.group(
                    DragonArmorModel.TextureLayer.CODEC.fieldOf("chain").forGetter(DragonArmorModel.Unbaked::chain),
                    DragonArmorModel.TextureLayer.CODEC.fieldOf("plating").forGetter(DragonArmorModel.Unbaked::plating),
                    DragonArmorModel.TextureLayer.CODEC.fieldOf("inlay").forGetter(DragonArmorModel.Unbaked::inlay)
                )
                .apply(instance, DragonArmorModel.Unbaked::new)
        );

        @Override
        public ItemModel bake(BakingContext context, Matrix4fc transformation) {
            return new DragonArmorModel(this.chain, this.plating, this.inlay, context, transformation);
        }

        @Override
        public void resolveDependencies(Resolver resolver) {
        }

        @Override
        public MapCodec<? extends net.minecraft.client.renderer.item.ItemModel.Unbaked> type() {
            return MAP_CODEC;
        }
    }
}
