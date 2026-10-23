package com.lostfeatures.story;

import com.lostfeatures.LostFeatures;
import com.mojang.serialization.Codec;
import com.mojang.serialization.codecs.RecordCodecBuilder;
import net.minecraft.core.UUIDUtil;
import net.minecraft.server.MinecraftServer;
import net.minecraft.world.level.saveddata.SavedData;
import net.minecraft.world.level.saveddata.SavedDataType;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Server-global (per world save) story state, stored in the server's data storage so it is shared by
 * every dimension. Per-player milestone sets make unlocks idempotent: {@link #unlock} returns true
 * only the first time, and rewards are granted only on that first time, so duplicate event delivery,
 * reloads and re-kills can never grant a reward twice. Unknown IDs from newer versions are kept.
 */
public class StoryProgress extends SavedData {
    public static final int DATA_VERSION = 1;

    private record PlayerEntry(UUID player, List<String> milestones) {
        static final Codec<PlayerEntry> CODEC = RecordCodecBuilder.create(i -> i.group(
                UUIDUtil.CODEC.fieldOf("player").forGetter(PlayerEntry::player),
                Codec.STRING.listOf().fieldOf("milestones").forGetter(PlayerEntry::milestones)
        ).apply(i, PlayerEntry::new));
    }

    public static final Codec<StoryProgress> CODEC = RecordCodecBuilder.create(i -> i.group(
            Codec.INT.optionalFieldOf("version", DATA_VERSION).forGetter(s -> DATA_VERSION),
            PlayerEntry.CODEC.listOf().optionalFieldOf("players", List.of()).forGetter(StoryProgress::entries),
            Codec.STRING.listOf().optionalFieldOf("world_flags", List.of()).forGetter(s -> List.copyOf(s.worldFlags))
    ).apply(i, StoryProgress::fromSaved));

    public static final SavedDataType<StoryProgress> TYPE = new SavedDataType<>(LostFeatures.id("story_progress"), StoryProgress::new, CODEC);

    private final Map<UUID, Set<String>> players = new HashMap<>();
    private final Set<String> worldFlags = new LinkedHashSet<>();

    public StoryProgress() {
    }

    private static StoryProgress fromSaved(int version, List<PlayerEntry> entries, List<String> flags) {
        StoryProgress progress = new StoryProgress();
        for (PlayerEntry e : entries) {
            progress.players.put(e.player(), new LinkedHashSet<>(e.milestones()));
        }
        progress.worldFlags.addAll(flags);
        return progress;
    }

    private List<PlayerEntry> entries() {
        return players.entrySet().stream().map(e -> new PlayerEntry(e.getKey(), List.copyOf(e.getValue()))).toList();
    }

    public static StoryProgress get(MinecraftServer server) {
        return server.getDataStorage().computeIfAbsent(TYPE);
    }

    public boolean has(UUID player, Milestone milestone) {
        return players.getOrDefault(player, Set.of()).contains(milestone.id());
    }

    /** Returns true only on the first unlock for this player. */
    public boolean unlock(UUID player, Milestone milestone) {
        boolean added = players.computeIfAbsent(player, k -> new LinkedHashSet<>()).add(milestone.id());
        if (added) {
            setDirty();
        }
        return added;
    }

    public Set<String> milestones(UUID player) {
        return Set.copyOf(players.getOrDefault(player, new HashSet<>()));
    }

    public boolean setWorldFlag(String flag) {
        boolean added = worldFlags.add(flag);
        if (added) {
            setDirty();
        }
        return added;
    }

    public Set<String> worldFlags() {
        return Set.copyOf(worldFlags);
    }
}
