package com.legacy.rediscovered.registry;

import com.legacy.structure_gel.api.registry.RegistrarHolder;
import com.legacy.structure_gel.api.registry.registrar.RegistrarHandler;
import com.legacy.structure_gel.api.registry.registrar.Registrar.Static;
import com.mojang.serialization.MapCodec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.Identifier;
import net.minecraft.util.KeyDispatchDataCodec;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.levelgen.PositionalRandomFactory;
import net.minecraft.world.level.levelgen.SurfaceRules.Condition;
import net.minecraft.world.level.levelgen.SurfaceRules.ConditionSource;
import net.minecraft.world.level.levelgen.SurfaceRules.Context;

@RegistrarHolder
public interface RediscoveredSurfaceRules {
    RegistrarHandler<MapCodec<? extends ConditionSource>> HANDLER = RegistrarHandler.getOrCreate(Registries.MATERIAL_CONDITION, "rediscovered");
    Static<MapCodec<? extends ConditionSource>> COIN_FLIP = HANDLER.createStatic("coin_flip", RediscoveredSurfaceRules.CoinFlip.CODEC::codec);

    record CoinFlip(Identifier randomName) implements ConditionSource {
        public static final KeyDispatchDataCodec<RediscoveredSurfaceRules.CoinFlip> CODEC = KeyDispatchDataCodec.of(
            RecordCodecBuilder.mapCodec(
                instance -> instance.group(Identifier.CODEC.fieldOf("random_name").forGetter(RediscoveredSurfaceRules.CoinFlip::randomName))
                    .apply(instance, RediscoveredSurfaceRules.CoinFlip::new)
            )
        );

        public Condition apply(Context context) {
            PositionalRandomFactory positionRand = context.randomState.getOrCreateRandomFactory(this.randomName());
            return new RediscoveredSurfaceRules.CoinFlip.RandomCondition(positionRand.at(context.blockX, 0, context.blockZ));
        }

        @Override
        public KeyDispatchDataCodec<? extends ConditionSource> codec() {
            return CODEC;
        }

        class RandomCondition implements Condition {
            private final RandomSource rand;

            public RandomCondition(RandomSource randomSource) {
                this.rand = randomSource;
            }

            @Override
            public boolean test() {
                return this.rand.nextBoolean();
            }
        }
    }
}
