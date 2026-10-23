package com.lostfeatures.item;

import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.network.RegistryFriendlyByteBuf;
import net.minecraft.network.codec.ByteBufCodecs;
import net.minecraft.network.codec.StreamCodec;
import net.minecraft.world.item.ItemStack;

/**
 * Immutable contents of a quiver: one kind of arrow (stored as a count-1 template that keeps its
 * components, e.g. tipped-arrow potions) and how many of it are stored.
 */
public record QuiverContents(ItemStack arrow, int count) {
    public static final int MAX_ARROWS = 192;
    public static final QuiverContents EMPTY = new QuiverContents(ItemStack.EMPTY, 0);

    public static final Codec<QuiverContents> CODEC = RecordCodecBuilder.create(i -> i.group(
            ItemStack.OPTIONAL_CODEC.fieldOf("arrow").forGetter(QuiverContents::arrow),
            Codec.intRange(0, MAX_ARROWS).fieldOf("count").forGetter(QuiverContents::count)
    ).apply(i, QuiverContents::of));

    public static final StreamCodec<RegistryFriendlyByteBuf, QuiverContents> STREAM_CODEC = StreamCodec.composite(
            ItemStack.OPTIONAL_STREAM_CODEC, QuiverContents::arrow,
            ByteBufCodecs.VAR_INT, QuiverContents::count,
            QuiverContents::of);

    public static QuiverContents of(ItemStack arrow, int count) {
        if (arrow.isEmpty() || count <= 0) {
            return EMPTY;
        }
        return new QuiverContents(arrow.copyWithCount(1), Math.min(count, MAX_ARROWS));
    }

    public boolean isEmpty() {
        return count <= 0 || arrow.isEmpty();
    }

    public boolean canAccept(ItemStack stack) {
        return isEmpty() || ItemStack.isSameItemSameComponents(arrow, stack);
    }

    public int space() {
        return MAX_ARROWS - count;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof QuiverContents other && count == other.count && ItemStack.matches(arrow, other.arrow);
    }

    @Override
    public int hashCode() {
        return 31 * ItemStack.hashItemAndComponents(arrow) + count;
    }
}
