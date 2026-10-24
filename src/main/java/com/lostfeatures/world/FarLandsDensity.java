package com.lostfeatures.world;

import com.mojang.serialization.MapCodec;
import net.minecraft.util.KeyDispatchDataCodec;
import net.minecraft.util.Mth;
import net.minecraft.util.RandomSource;
import net.minecraft.world.level.levelgen.DensityFunction;
import net.minecraft.world.level.levelgen.synth.ImprovedNoise;

/**
 * Density function for the Far Lands dimension ({@code lostfeatures:far_lands_walls}).
 *
 * <p>The historical Java Edition Far Lands came from a 32-bit integer overflow in the terrain noise
 * generators (fixed in Beta 1.8). This is a deliberate, stable recreation of their look - not of the
 * bug: towering walls running roughly along one axis, flat-topped near the build limit, riddled with
 * long horizontal tunnels, with ordinary low terrain (and water below sea level) between them. Every
 * value is finite and bounded, so chunk generation, lighting, collision, saving and pathfinding are
 * all handled by vanilla's noise chunk generator as usual.</p>
 *
 * <p>Noise is seeded from a fixed constant so the dimension looks the same in every world, matching the
 * deterministic placement of the original.</p>
 */
public final class FarLandsDensity implements DensityFunction.SimpleFunction {
    public static final FarLandsDensity INSTANCE = new FarLandsDensity();
    public static final MapCodec<FarLandsDensity> CODEC = MapCodec.unit(INSTANCE);
    private static final KeyDispatchDataCodec<FarLandsDensity> DISPATCH = KeyDispatchDataCodec.of(CODEC);

    private final ImprovedNoise warp;
    private final ImprovedNoise wallDetail;
    private final ImprovedNoise top;
    private final ImprovedNoise tunnelsA;
    private final ImprovedNoise tunnelsB;
    private final ImprovedNoise lowland;

    private FarLandsDensity() {
        RandomSource random = RandomSource.create(12_550_821L); // the classic Far Lands distance, as a nod
        warp = new ImprovedNoise(random);
        wallDetail = new ImprovedNoise(random);
        top = new ImprovedNoise(random);
        tunnelsA = new ImprovedNoise(random);
        tunnelsB = new ImprovedNoise(random);
        lowland = new ImprovedNoise(random);
    }

    /** Pure function of block coordinates; positive = solid. */
    public double sample(double x, double y, double z) {
        double phase = x * 0.035 + 2.5 * warp.noise(z * 0.005, 0.5, x * 0.002);
        double wall = 0.5 + 0.5 * Math.cos(phase);
        double wallSolid = (wall - 0.42) * 5.0 + 0.6 * wallDetail.noise(x * 0.05, y * 0.03, z * 0.05);
        double ceiling = 252.0 + 6.0 * top.noise(x * 0.01, 3.3, z * 0.01);
        wallSolid = Math.min(wallSolid, (ceiling - y) * 0.25);
        double t = Math.min(Math.abs(tunnelsA.noise(x * 0.018, y * 0.07, z * 0.018)),
                Math.abs(tunnelsB.noise(x * 0.04 + 17.0, y * 0.12, z * 0.04)));
        double tunnels = Math.max(0.075 - t, 0.0) * 60.0;
        double low = -(y - 66.0) / 22.0 + 0.8 * lowland.noise(x * 0.015, y * 0.02, z * 0.015);
        return Mth.clamp(Math.max(low, wallSolid - tunnels), -64.0, 64.0);
    }

    @Override
    public double compute(FunctionContext context) {
        return sample(context.blockX(), context.blockY(), context.blockZ());
    }

    @Override
    public double minValue() {
        return -64.0;
    }

    @Override
    public double maxValue() {
        return 64.0;
    }

    @Override
    public KeyDispatchDataCodec<? extends DensityFunction> codec() {
        return DISPATCH;
    }
}
