package com.lostfeatures.world.structure;

import com.lostfeatures.block.LockedChestBlock;
import com.lostfeatures.block.RunicLogicDeviceBlock;
import com.lostfeatures.block.RunicMode;
import com.lostfeatures.block.entity.LockedChestBlockEntity;
import com.lostfeatures.entity.RedDragon;
import com.lostfeatures.registry.ModBlocks;
import com.lostfeatures.registry.ModEntities;
import net.minecraft.core.BlockPos;
import net.minecraft.core.Direction;
import net.minecraft.nbt.CompoundTag;
import net.minecraft.resources.ResourceKey;
import net.minecraft.util.RandomSource;
import net.minecraft.world.RandomizableContainer;
import net.minecraft.world.entity.EntitySpawnReason;
import net.minecraft.world.level.ChunkPos;
import net.minecraft.world.level.StructureManager;
import net.minecraft.world.level.WorldGenLevel;
import net.minecraft.world.level.block.Block;
import net.minecraft.world.level.block.Blocks;
import net.minecraft.world.level.block.ChestBlock;
import net.minecraft.world.level.block.LeverBlock;
import net.minecraft.world.level.block.TorchBlock;
import net.minecraft.world.level.block.WallTorchBlock;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.block.state.properties.AttachFace;
import net.minecraft.world.level.chunk.ChunkGenerator;
import net.minecraft.world.level.levelgen.Heightmap;
import net.minecraft.world.level.levelgen.structure.BoundingBox;
import net.minecraft.world.level.levelgen.structure.StructurePiece;
import net.minecraft.world.level.levelgen.structure.pieces.StructurePieceSerializationContext;
import net.minecraft.world.level.storage.loot.LootTable;

/**
 * One piece per structure. {@link #postProcess} is called once per chunk the bounding box touches;
 * every write goes through {@link #put}, which discards positions outside the chunk being generated,
 * and every random decision uses a RNG re-seeded from the structure seed, so all chunks agree on the
 * layout and nothing is ever placed twice or outside the structure.
 */
public class AncientPiece extends StructurePiece {
    private final StructureKind kind;
    private final BlockPos origin;
    private final long seed;
    private boolean spawnedGuardian;

    public AncientPiece(StructureKind kind, BlockPos origin, long seed) {
        super(ModStructures.ANCIENT_PIECE.get(), 0, new BoundingBox(origin.getX(), origin.getY() - kind.depth - 6, origin.getZ(),
                origin.getX() + kind.sizeX - 1, origin.getY() + kind.sizeY, origin.getZ() + kind.sizeZ - 1));
        this.kind = kind;
        this.origin = origin;
        this.seed = seed;
        setOrientation(Direction.NORTH);
    }

    public AncientPiece(CompoundTag tag) {
        super(ModStructures.ANCIENT_PIECE.get(), tag);
        StructureKind k = StructureKind.ANCIENT_RUINS;
        String name = tag.getStringOr("kind", "ancient_ruins");
        for (StructureKind candidate : StructureKind.values()) {
            if (candidate.getSerializedName().equals(name)) {
                k = candidate;
            }
        }
        this.kind = k;
        this.origin = tag.read("origin", BlockPos.CODEC).orElse(BlockPos.ZERO);
        this.seed = tag.getLongOr("seed", 0L);
        this.spawnedGuardian = tag.getBooleanOr("spawned", false);
    }

    @Override
    protected void addAdditionalSaveData(StructurePieceSerializationContext context, CompoundTag tag) {
        tag.putString("kind", kind.getSerializedName());
        tag.store("origin", BlockPos.CODEC, origin);
        tag.putLong("seed", seed);
        tag.putBoolean("spawned", spawnedGuardian);
    }

    // ------------------------------------------------------------------ placement helpers

    private record Ctx(WorldGenLevel level, BoundingBox chunkBB, RandomSource random) {
    }

    private boolean put(Ctx c, int x, int y, int z, BlockState state) {
        BlockPos pos = origin.offset(x, y, z);
        if (!c.chunkBB().isInside(pos) || !boundingBox.isInside(pos)) {
            return false;
        }
        c.level().setBlock(pos, state, Block.UPDATE_CLIENTS);
        return true;
    }

    private void fill(Ctx c, int x0, int y0, int z0, int x1, int y1, int z1, BlockState state) {
        for (int y = y0; y <= y1; y++) {
            for (int x = x0; x <= x1; x++) {
                for (int z = z0; z <= z1; z++) {
                    put(c, x, y, z, state);
                }
            }
        }
    }

    /** Fills air/fluid under the footprint so buildings never float (max 6 blocks deep). */
    private void foundation(Ctx c, int x0, int z0, int x1, int z1, BlockState state) {
        for (int x = x0; x <= x1; x++) {
            for (int z = z0; z <= z1; z++) {
                for (int dy = -1; dy >= -6; dy--) {
                    BlockPos pos = origin.offset(x, dy, z);
                    if (!c.chunkBB().isInside(pos)) {
                        break;
                    }
                    BlockState existing = c.level().getBlockState(pos);
                    if (!existing.canBeReplaced() && existing.getFluidState().isEmpty()) {
                        break;
                    }
                    c.level().setBlock(pos, state, Block.UPDATE_CLIENTS);
                }
            }
        }
    }

    private BlockState weathered(Ctx c) {
        float r = c.random().nextFloat();
        if (r < 0.62F) return ModBlocks.ANCIENT_STONE_BRICKS.get().defaultBlockState();
        if (r < 0.85F) return ModBlocks.CRACKED_ANCIENT_STONE_BRICKS.get().defaultBlockState();
        return ModBlocks.ANCIENT_STONE.get().defaultBlockState();
    }

    private void chest(Ctx c, int x, int y, int z, Direction facing, ResourceKey<LootTable> loot) {
        if (put(c, x, y, z, Blocks.CHEST.defaultBlockState().setValue(ChestBlock.FACING, facing))) {
            RandomizableContainer.setBlockEntityLootTable(c.level(), c.random(), origin.offset(x, y, z), loot);
        }
    }

    private void lockedChest(Ctx c, int x, int y, int z, Direction facing, ResourceKey<LootTable> loot) {
        if (put(c, x, y, z, ModBlocks.LOCKED_CHEST.get().defaultBlockState().setValue(LockedChestBlock.FACING, facing))
                && c.level().getBlockEntity(origin.offset(x, y, z)) instanceof LockedChestBlockEntity locked) {
            locked.setLootTable(loot, c.random().nextLong());
        }
    }

    // ------------------------------------------------------------------ generation

    @Override
    public void postProcess(WorldGenLevel level, StructureManager structureManager, ChunkGenerator generator, RandomSource ignored,
                            BoundingBox chunkBB, ChunkPos chunkPos, BlockPos referencePos) {
        Ctx c = new Ctx(level, chunkBB, RandomSource.create(seed));
        switch (kind) {
            case BRICK_PYRAMID -> brickPyramid(c);
            case STARTING_HOUSE -> startingHouse(c);
            case OBSIDIAN_WALL -> obsidianWall(c);
            case GLASS_PILLAR -> glassPillar(c);
            case MONOLITH -> monolith(c);
            case ANCIENT_RUINS -> ancientRuins(c);
            case DRAGON_LAIR -> dragonLair(c);
        }
    }

    private void brickPyramid(Ctx c) {
        int n = kind.sizeX;
        BlockState bricks = Blocks.BRICKS.defaultBlockState();
        foundation(c, 0, 0, n - 1, n - 1, bricks);
        for (int layer = 0; layer <= n / 2; layer++) {
            fill(c, layer, layer, layer, n - 1 - layer, layer, n - 1 - layer, bricks);
        }
        // Sealed chamber (original addition): reached through an illusory wall on the south face.
        int mid = n / 2;
        fill(c, mid - 2, 1, mid - 2, mid + 2, 3, mid + 2, Blocks.AIR.defaultBlockState());
        fill(c, mid - 2, 0, mid - 2, mid + 2, 0, mid + 2, ModBlocks.RUBY_BRICKS.get().defaultBlockState());
        for (int z = mid + 3; z <= n - 2; z++) {
            fill(c, mid, 1, z, mid, 2, z, Blocks.AIR.defaultBlockState());
        }
        put(c, mid, 1, n - 2, ModBlocks.ILLUSORY_WALL.get().defaultBlockState());
        put(c, mid, 2, n - 2, ModBlocks.ILLUSORY_WALL.get().defaultBlockState());
        put(c, mid, 1, n - 1, ModBlocks.ILLUSORY_WALL.get().defaultBlockState());
        put(c, mid, 2, n - 1, ModBlocks.ILLUSORY_WALL.get().defaultBlockState());
        put(c, mid - 2, 3, mid - 2, Blocks.SOUL_LANTERN.defaultBlockState());
        chest(c, mid, 1, mid - 2, Direction.SOUTH, ModStructures.LOOT_BRICK_PYRAMID);
        put(c, mid - 1, 2, mid - 2, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
        put(c, mid + 1, 2, mid - 2, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
    }

    private void startingHouse(Ctx c) {
        BlockState planks = Blocks.OAK_PLANKS.defaultBlockState();
        BlockState stone = Blocks.STONE.defaultBlockState();
        foundation(c, 0, 0, 8, 8, Blocks.COBBLESTONE.defaultBlockState());
        fill(c, 0, 0, 0, 8, 0, 8, stone);
        fill(c, 0, 1, 0, 8, 4, 8, planks);
        fill(c, 1, 1, 1, 7, 4, 7, Blocks.AIR.defaultBlockState());
        fill(c, 0, 5, 0, 8, 5, 8, planks);
        // Two-block doorway on the south side, as in Indev.
        put(c, 4, 1, 8, Blocks.AIR.defaultBlockState());
        put(c, 4, 2, 8, Blocks.AIR.defaultBlockState());
        put(c, 2, 3, 1, Blocks.WALL_TORCH.defaultBlockState().setValue(WallTorchBlock.FACING, Direction.SOUTH));
        put(c, 6, 3, 1, Blocks.WALL_TORCH.defaultBlockState().setValue(WallTorchBlock.FACING, Direction.SOUTH));
        chest(c, 4, 1, 1, Direction.SOUTH, ModStructures.LOOT_STARTING_HOUSE);
        put(c, 1, 1, 6, Blocks.CRAFTING_TABLE.defaultBlockState());
        if (c.random().nextBoolean()) {
            put(c, 7, 1, 6, ModBlocks.ROSE.get().defaultBlockState());
        }
    }

    private void obsidianWall(Ctx c) {
        BlockState obsidian = Blocks.OBSIDIAN.defaultBlockState();
        foundation(c, 0, 2, kind.sizeX - 1, 2, ModBlocks.ANCIENT_STONE.get().defaultBlockState());
        for (int x = 0; x < kind.sizeX; x++) {
            // Weathered profile: tallest in the middle, broken at the ends.
            int height = 3 + (int) (5 * Math.sin(Math.PI * x / (kind.sizeX - 1))) - c.random().nextInt(2);
            for (int y = 0; y <= height; y++) {
                put(c, x, y, 2, (y == 0) ? ModBlocks.ANCIENT_STONE_BRICKS.get().defaultBlockState()
                        : (c.random().nextInt(9) == 0 ? Blocks.CRYING_OBSIDIAN.defaultBlockState() : obsidian));
            }
        }
        put(c, kind.sizeX / 2, 1, 1, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
        put(c, kind.sizeX / 2, 1, 3, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
    }

    private void glassPillar(Ctx c) {
        int mid = kind.sizeX / 2;
        // Underground lab
        int floor = -kind.depth;
        fill(c, 0, floor - 1, 0, 8, floor + 5, 8, ModBlocks.ANCIENT_STONE_BRICKS.get().defaultBlockState());
        fill(c, 1, floor, 1, 7, floor + 4, 7, Blocks.AIR.defaultBlockState());
        for (int y = floor; y <= floor + 4; y++) {
            for (int x = 1; x <= 7; x++) {
                if (c.random().nextInt(5) == 0) put(c, x, y, 0, weathered(c));
            }
        }
        put(c, 1, floor + 3, 1, Blocks.SOUL_LANTERN.defaultBlockState());
        put(c, 7, floor + 3, 7, Blocks.SOUL_LANTERN.defaultBlockState());
        chest(c, 2, floor, 7, Direction.NORTH, ModStructures.LOOT_GLASS_PILLAR_LAB);
        lockedChest(c, 6, floor, 7, Direction.NORTH, ModStructures.LOOT_LOCKED_ANCIENT);
        put(c, 4, floor, 7, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
        put(c, 1, floor, 4, ModBlocks.ANCIENT_EVENT_SENSOR.get().defaultBlockState());
        // Glass pillar from the lab up through the surface and into the sky (bounded height).
        for (int y = floor + 5; y < kind.sizeY - 1; y++) {
            put(c, mid, y, mid, Blocks.GLASS.defaultBlockState());
        }
        put(c, mid, kind.sizeY - 1, mid, Blocks.SEA_LANTERN.defaultBlockState());
        // Ladder shaft beside the pillar so the lab is reachable.
        for (int y = floor; y <= 0; y++) {
            put(c, mid + 1, y, mid, Blocks.AIR.defaultBlockState());
            put(c, mid + 2, y, mid, ModBlocks.ANCIENT_STONE_BRICKS.get().defaultBlockState());
            put(c, mid + 1, y, mid, Blocks.LADDER.defaultBlockState().setValue(net.minecraft.world.level.block.LadderBlock.FACING, Direction.WEST));
        }
    }

    private void monolith(Ctx c) {
        int n = kind.sizeX;
        BlockState stone = Blocks.STONE.defaultBlockState();
        foundation(c, 0, 0, n - 1, n - 1, stone);
        for (int y = 0; y < kind.sizeY; y++) {
            int inset = y > kind.sizeY - 6 ? (y - (kind.sizeY - 6)) / 2 : 0;
            for (int x = inset; x < n - inset; x++) {
                for (int z = inset; z < n - inset; z++) {
                    BlockState s = stone;
                    float r = c.random().nextFloat();
                    if (r < 0.015F) s = ModBlocks.RUBY_ORE.get().defaultBlockState();
                    else if (r < 0.05F) s = Blocks.ANDESITE.defaultBlockState();
                    else if (r < 0.07F) s = Blocks.COAL_ORE.defaultBlockState();
                    put(c, x, y, z, s);
                }
            }
        }
        int mid = n / 2;
        // Inverted-terrain hollow at the base, as monoliths were open underneath.
        fill(c, 2, 0, 2, n - 3, 3, n - 3, Blocks.AIR.defaultBlockState());
        fill(c, mid, 0, n - 2, mid, 2, n - 1, Blocks.AIR.defaultBlockState());
        put(c, mid, 0, mid, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
        chest(c, mid + 1, 0, mid, Direction.WEST, ModStructures.LOOT_MONOLITH);
    }

    private void ancientRuins(Ctx c) {
        int n = kind.sizeX;
        foundation(c, 0, 0, n - 1, n - 1, ModBlocks.ANCIENT_STONE.get().defaultBlockState());
        fill(c, 0, 0, 0, n - 1, 0, n - 1, ModBlocks.ANCIENT_STONE.get().defaultBlockState());
        fill(c, 1, 1, 1, n - 2, kind.sizeY - 1, n - 2, Blocks.AIR.defaultBlockState());
        // Broken outer walls
        for (int i = 0; i < n; i++) {
            int[][] wallCols = {{i, 0}, {i, n - 1}, {0, i}, {n - 1, i}};
            for (int[] col : wallCols) {
                int h = 1 + c.random().nextInt(5);
                for (int y = 1; y <= h; y++) {
                    put(c, col[0], y, col[1], weathered(c));
                }
            }
        }
        // Inner vault with a runic sequence door (puzzle): left, back, right levers in order.
        int v0 = 5;
        int v1 = n - 6;
        fill(c, v0, 1, v0, v1, 4, v1, ModBlocks.ANCIENT_STONE_BRICKS.get().defaultBlockState());
        fill(c, v0 + 1, 1, v0 + 1, v1 - 1, 3, v1 - 1, Blocks.AIR.defaultBlockState());
        int doorX = (v0 + v1) / 2;
        put(c, doorX, 1, v1, ModBlocks.ANCIENT_SECRET_DOOR.get().defaultBlockState());
        put(c, doorX, 2, v1, ModBlocks.ANCIENT_SECRET_DOOR.get().defaultBlockState());
        // Runic Logic Device below the floor in front of the door powers it on a correct sequence.
        BlockState runic = ModBlocks.RUNIC_LOGIC_DEVICE.get().defaultBlockState()
                .setValue(RunicLogicDeviceBlock.FACING, Direction.SOUTH)
                .setValue(RunicLogicDeviceBlock.MODE, RunicMode.SEQUENCE);
        put(c, doorX, 0, v1 + 1, ModBlocks.ANCIENT_STONE_BRICKS.get().defaultBlockState());
        put(c, doorX, 1, v1 + 2, runic);
        put(c, doorX, 1, v1 + 1, Blocks.REDSTONE_WIRE.defaultBlockState());
        BlockState lever = Blocks.LEVER.defaultBlockState().setValue(LeverBlock.FACE, AttachFace.FLOOR);
        put(c, doorX + 1, 1, v1 + 2, lever);
        put(c, doorX, 1, v1 + 3, lever);
        put(c, doorX - 1, 1, v1 + 2, lever);
        put(c, doorX + 2, 1, v1 + 3, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
        lockedChest(c, doorX, 1, v0 + 1, Direction.SOUTH, ModStructures.LOOT_LOCKED_ANCIENT);
        chest(c, 2, 1, 2, Direction.EAST, ModStructures.LOOT_ANCIENT_RUINS);
        put(c, n - 3, 1, 2, ModBlocks.ANCIENT_GLYPH_BRICKS.get().defaultBlockState());
        put(c, v0 + 1, 1, v0 + 1, Blocks.TORCH.defaultBlockState());
        put(c, 3, 1, n - 3, ModBlocks.SPIKE_TRAP.get().defaultBlockState());
    }

    private void dragonLair(Ctx c) {
        int n = kind.sizeX;
        int mid = n / 2;
        BlockState rock = Blocks.BLACKSTONE.defaultBlockState();
        foundation(c, 0, 0, n - 1, n - 1, rock);
        // Dome of rock with a wide entrance; interior floor of scorched ground and bones.
        for (int x = 0; x < n; x++) {
            for (int z = 0; z < n; z++) {
                double dx = x - mid;
                double dz = z - mid;
                double r = Math.sqrt(dx * dx + dz * dz);
                if (r > mid + 0.5) continue;
                int roof = (int) Math.round(Math.sqrt(Math.max(0, (mid + 0.5) * (mid + 0.5) - r * r)) * 0.9);
                for (int y = 0; y <= roof; y++) {
                    boolean shell = r > mid - 1.5 || y >= roof - 1;
                    put(c, x, y, z, shell ? (c.random().nextInt(6) == 0 ? Blocks.BASALT.defaultBlockState() : rock) : Blocks.AIR.defaultBlockState());
                }
                put(c, x, 0, z, r > mid - 1.5 ? rock : ModBlocks.SCORCHED_GRASS.get().defaultBlockState());
            }
        }
        fill(c, mid - 2, 1, n - 3, mid + 2, 5, n - 1, Blocks.AIR.defaultBlockState());
        put(c, mid, 1, mid, ModBlocks.ANCIENT_ALTAR.get().defaultBlockState());
        fill(c, mid - 1, 0, mid - 1, mid + 1, 0, mid + 1, ModBlocks.RUBY_BRICKS.get().defaultBlockState());
        for (int i = 0; i < 6; i++) {
            int x = 3 + c.random().nextInt(n - 6);
            int z = 3 + c.random().nextInt(n - 6);
            if (Math.abs(x - mid) > 1 || Math.abs(z - mid) > 1) {
                put(c, x, 1, z, ModBlocks.CHARRED_REMAINS.get().defaultBlockState());
            }
        }
        chest(c, mid - 4, 1, mid - 4, Direction.SOUTH, ModStructures.LOOT_DRAGON_LAIR);
        put(c, mid + 4, 1, mid - 4, Blocks.GOLD_BLOCK.defaultBlockState());
        // One resident Red Dragon per lair, spawned once.
        BlockPos center = origin.offset(mid, 2, mid);
        if (!spawnedGuardian && c.chunkBB().isInside(center)) {
            RedDragon dragon = ModEntities.RED_DRAGON.get().create(c.level().getLevel(), EntitySpawnReason.STRUCTURE);
            if (dragon != null) {
                dragon.snapTo(center.getX() + 0.5, center.getY(), center.getZ() + 0.5, c.random().nextFloat() * 360F, 0F);
                dragon.finalizeSpawn(c.level(), c.level().getCurrentDifficultyAt(center), EntitySpawnReason.STRUCTURE, null);
                dragon.setHomePos(center);
                c.level().addFreshEntityWithPassengers(dragon);
                spawnedGuardian = true;
            }
        }
    }
}
