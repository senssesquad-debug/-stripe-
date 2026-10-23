package com.lostfeatures.block.entity;

import com.lostfeatures.registry.ModBlockEntities;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.level.block.entity.BlockEntity;
import net.minecraft.world.level.block.state.BlockState;
import net.minecraft.world.level.storage.ValueInput;
import net.minecraft.world.level.storage.ValueOutput;
import net.minecraft.world.level.storage.loot.LootTable;
import org.jspecify.annotations.Nullable;

/** Remembers which loot table the chest grants once unlocked. */
public class LockedChestBlockEntity extends BlockEntity {
    private @Nullable ResourceKey<LootTable> lootTable;
    private long lootSeed;

    public LockedChestBlockEntity(BlockPos pos, BlockState state) {
        super(ModBlockEntities.LOCKED_CHEST.get(), pos, state);
    }

    public void setLootTable(ResourceKey<LootTable> table, long seed) {
        this.lootTable = table;
        this.lootSeed = seed;
        setChanged();
    }

    public @Nullable ResourceKey<LootTable> getLootTable() {
        return lootTable;
    }

    public long getLootSeed() {
        return lootSeed;
    }

    @Override
    protected void saveAdditional(ValueOutput output) {
        super.saveAdditional(output);
        if (lootTable != null) {
            output.putString("loot_table", lootTable.identifier().toString());
            output.putLong("loot_seed", lootSeed);
        }
    }

    @Override
    protected void loadAdditional(ValueInput input) {
        super.loadAdditional(input);
        lootTable = input.getString("loot_table")
                .map(net.minecraft.resources.Identifier::tryParse)
                .map(id -> ResourceKey.create(Registries.LOOT_TABLE, id))
                .orElse(null);
        lootSeed = input.getLongOr("loot_seed", 0L);
    }
}
