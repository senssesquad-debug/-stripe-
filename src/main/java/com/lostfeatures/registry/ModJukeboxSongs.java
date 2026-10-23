package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import net.minecraft.core.registries.Registries;
import net.minecraft.resources.ResourceKey;
import net.minecraft.world.item.JukeboxSong;

/** Keys of the data-driven jukebox songs in data/lostfeatures/jukebox_song. */
public final class ModJukeboxSongs {
    public static final ResourceKey<JukeboxSong> ANCIENT_ECHOES = key("ancient_echoes");
    public static final ResourceKey<JukeboxSong> DRAGONS_OMEN = key("dragons_omen");
    public static final ResourceKey<JukeboxSong> FAR_BEYOND = key("far_beyond");
    public static final ResourceKey<JukeboxSong> FORGOTTEN_CIVILIZATION = key("forgotten_civilization");
    public static final ResourceKey<JukeboxSong> RUBY_RESONANCE = key("ruby_resonance");
    public static final ResourceKey<JukeboxSong> ILLUSION = key("illusion");
    public static final ResourceKey<JukeboxSong> THE_LAST_MONOLITH = key("the_last_monolith");

    private static ResourceKey<JukeboxSong> key(String name) {
        return ResourceKey.create(Registries.JUKEBOX_SONG, LostFeatures.id(name));
    }

    private ModJukeboxSongs() {
    }
}
