package com.lostfeatures.registry;

import com.lostfeatures.LostFeatures;
import net.minecraft.core.registries.Registries;
import net.minecraft.sounds.SoundEvent;
import net.neoforged.bus.api.IEventBus;
import net.neoforged.neoforge.common.util.DeferredSoundType;
import net.neoforged.neoforge.registries.DeferredHolder;
import net.neoforged.neoforge.registries.DeferredRegister;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Every sound event the mod owns. Each event maps 1:1 to an entry in
 * {@code assets/lostfeatures/sounds.json}; see docs/ASSETS_AND_AUDIO.md for the file to replace.
 */
public final class ModSounds {
    public static final DeferredRegister<SoundEvent> SOUNDS = DeferredRegister.create(Registries.SOUND_EVENT, LostFeatures.MOD_ID);
    private static final List<DeferredHolder<SoundEvent, SoundEvent>> ALL = new ArrayList<>();

    // Red Dragon
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_AMBIENT = sound("entity.red_dragon.ambient");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_STEP = sound("entity.red_dragon.step");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_TAKEOFF = sound("entity.red_dragon.takeoff");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_FLAP = sound("entity.red_dragon.flap");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_LAND = sound("entity.red_dragon.land");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_ROAR = sound("entity.red_dragon.roar");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_WARNING = sound("entity.red_dragon.warning");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_BREATH_START = sound("entity.red_dragon.breath_start");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_BREATH_LOOP = sound("entity.red_dragon.breath_loop");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_BREATH_IMPACT = sound("entity.red_dragon.breath_impact");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_HURT = sound("entity.red_dragon.hurt");
    public static final DeferredHolder<SoundEvent, SoundEvent> RED_DRAGON_DEATH = sound("entity.red_dragon.death");

    // Giant
    public static final DeferredHolder<SoundEvent, SoundEvent> GIANT_AMBIENT = sound("entity.giant.ambient");
    public static final DeferredHolder<SoundEvent, SoundEvent> GIANT_STEP = sound("entity.giant.step");
    public static final DeferredHolder<SoundEvent, SoundEvent> GIANT_WINDUP = sound("entity.giant.windup");
    public static final DeferredHolder<SoundEvent, SoundEvent> GIANT_SLAM = sound("entity.giant.slam");
    public static final DeferredHolder<SoundEvent, SoundEvent> GIANT_HURT = sound("entity.giant.hurt");
    public static final DeferredHolder<SoundEvent, SoundEvent> GIANT_DEATH = sound("entity.giant.death");

    // Illusioner
    public static final DeferredHolder<SoundEvent, SoundEvent> ILLUSIONER_AMBIENT = sound("entity.illusioner.ambient");
    public static final DeferredHolder<SoundEvent, SoundEvent> ILLUSIONER_CAST = sound("entity.illusioner.cast");
    public static final DeferredHolder<SoundEvent, SoundEvent> ILLUSIONER_ILLUSION = sound("entity.illusioner.illusion");
    public static final DeferredHolder<SoundEvent, SoundEvent> ILLUSIONER_REPOSITION = sound("entity.illusioner.reposition");
    public static final DeferredHolder<SoundEvent, SoundEvent> ILLUSIONER_SHOOT = sound("entity.illusioner.shoot");
    public static final DeferredHolder<SoundEvent, SoundEvent> ILLUSIONER_HURT = sound("entity.illusioner.hurt");
    public static final DeferredHolder<SoundEvent, SoundEvent> ILLUSIONER_DEATH = sound("entity.illusioner.death");

    // Killer Bunny
    public static final DeferredHolder<SoundEvent, SoundEvent> KILLER_BUNNY_HOP = sound("entity.killer_bunny.hop");
    public static final DeferredHolder<SoundEvent, SoundEvent> KILLER_BUNNY_WARNING = sound("entity.killer_bunny.warning");
    public static final DeferredHolder<SoundEvent, SoundEvent> KILLER_BUNNY_ATTACK = sound("entity.killer_bunny.attack");
    public static final DeferredHolder<SoundEvent, SoundEvent> KILLER_BUNNY_HURT = sound("entity.killer_bunny.hurt");
    public static final DeferredHolder<SoundEvent, SoundEvent> KILLER_BUNNY_DEATH = sound("entity.killer_bunny.death");

    // Ruby block sound type
    public static final DeferredHolder<SoundEvent, SoundEvent> RUBY_BREAK = sound("block.ruby.break");
    public static final DeferredHolder<SoundEvent, SoundEvent> RUBY_STEP = sound("block.ruby.step");
    public static final DeferredHolder<SoundEvent, SoundEvent> RUBY_PLACE = sound("block.ruby.place");
    public static final DeferredHolder<SoundEvent, SoundEvent> RUBY_HIT = sound("block.ruby.hit");
    public static final DeferredHolder<SoundEvent, SoundEvent> RUBY_FALL = sound("block.ruby.fall");

    // Ancient devices
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_SENSOR_ACTIVATE = sound("block.event_sensor.activate");
    public static final DeferredHolder<SoundEvent, SoundEvent> REACTOR_ACTIVATE = sound("block.reactor.activate");
    public static final DeferredHolder<SoundEvent, SoundEvent> REACTOR_SHUTDOWN = sound("block.reactor.shutdown");
    public static final DeferredHolder<SoundEvent, SoundEvent> REACTOR_PULSE = sound("block.reactor.pulse");
    public static final DeferredHolder<SoundEvent, SoundEvent> RUNIC_INPUT = sound("block.runic_logic.input");
    public static final DeferredHolder<SoundEvent, SoundEvent> RUNIC_OUTPUT = sound("block.runic_logic.output");
    public static final DeferredHolder<SoundEvent, SoundEvent> RUNIC_RESET = sound("block.runic_logic.reset");
    public static final DeferredHolder<SoundEvent, SoundEvent> MECHANISM_FAIL = sound("block.mechanism.fail");
    public static final DeferredHolder<SoundEvent, SoundEvent> ANCIENT_DOOR_OPEN = sound("block.ancient_door.open");
    public static final DeferredHolder<SoundEvent, SoundEvent> ANCIENT_DOOR_CLOSE = sound("block.ancient_door.close");
    public static final DeferredHolder<SoundEvent, SoundEvent> DART_TRAP_FIRE = sound("block.dart_trap.fire");
    public static final DeferredHolder<SoundEvent, SoundEvent> SPIKE_TRAP_EXTEND = sound("block.spike_trap.extend");
    public static final DeferredHolder<SoundEvent, SoundEvent> LOCKED_CHEST_UNLOCK = sound("block.locked_chest.unlock");
    public static final DeferredHolder<SoundEvent, SoundEvent> ALTAR_ACTIVATE = sound("block.ancient_altar.activate");

    // Items
    public static final DeferredHolder<SoundEvent, SoundEvent> QUIVER_INSERT = sound("item.quiver.insert");
    public static final DeferredHolder<SoundEvent, SoundEvent> QUIVER_REMOVE = sound("item.quiver.remove");
    public static final DeferredHolder<SoundEvent, SoundEvent> JOURNAL_OPEN = sound("item.journal.open");
    public static final DeferredHolder<SoundEvent, SoundEvent> RELIC_USE = sound("item.relic.use");
    public static final DeferredHolder<SoundEvent, SoundEvent> DRAGON_DEVICE_ACTIVATE = sound("item.dragon_device.activate");

    /** Copper horn tunes: 10 variants x {melody, harmony, bass}, mirroring the removed 22w13a/22w14a design. */
    public static final List<DeferredHolder<SoundEvent, SoundEvent>> COPPER_HORN_MELODY = horn("melody");
    public static final List<DeferredHolder<SoundEvent, SoundEvent>> COPPER_HORN_HARMONY = horn("harmony");
    public static final List<DeferredHolder<SoundEvent, SoundEvent>> COPPER_HORN_BASS = horn("bass");

    // Event and story cues
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_DRAGON_ENCOUNTER = sound("event.dragon_encounter");
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_RARE_DISCOVERY = sound("event.rare_discovery");
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_DISTURBANCE = sound("event.ancient_disturbance");
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_VILLAGE_ALARM = sound("event.village_alarm");
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_EXPEDITION = sound("event.illager_expedition");
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_BOSS_PHASE = sound("event.boss_phase");
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_BOSS_VICTORY = sound("event.boss_victory");
    public static final DeferredHolder<SoundEvent, SoundEvent> EVENT_STORY_DISCOVERY = sound("event.story_discovery");

    // Music themes (situational, chosen client-side through SelectMusicEvent)
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_RUINS = sound("music.ruins");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_DRAGON = sound("music.dragon");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_DRAGON_BOSS = sound("music.dragon_boss");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_MECHANISM = sound("music.mechanism");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_FAR_LANDS = sound("music.far_lands");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_ILLUSIONER = sound("music.illusioner");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_GIANT = sound("music.giant");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_STORY = sound("music.story");
    public static final DeferredHolder<SoundEvent, SoundEvent> MUSIC_UNDERGROUND = sound("music.underground");

    // Music discs (each points at a distinct original track)
    public static final DeferredHolder<SoundEvent, SoundEvent> DISC_ANCIENT_ECHOES = sound("music_disc.ancient_echoes");
    public static final DeferredHolder<SoundEvent, SoundEvent> DISC_DRAGONS_OMEN = sound("music_disc.dragons_omen");
    public static final DeferredHolder<SoundEvent, SoundEvent> DISC_FAR_BEYOND = sound("music_disc.far_beyond");
    public static final DeferredHolder<SoundEvent, SoundEvent> DISC_FORGOTTEN_CIVILIZATION = sound("music_disc.forgotten_civilization");
    public static final DeferredHolder<SoundEvent, SoundEvent> DISC_RUBY_RESONANCE = sound("music_disc.ruby_resonance");
    public static final DeferredHolder<SoundEvent, SoundEvent> DISC_ILLUSION = sound("music_disc.illusion");
    public static final DeferredHolder<SoundEvent, SoundEvent> DISC_THE_LAST_MONOLITH = sound("music_disc.the_last_monolith");

    public static final DeferredSoundType RUBY_SOUND_TYPE = new DeferredSoundType(1.0F, 1.0F,
            RUBY_BREAK, RUBY_STEP, RUBY_PLACE, RUBY_HIT, RUBY_FALL);

    private ModSounds() {
    }

    private static DeferredHolder<SoundEvent, SoundEvent> sound(String name) {
        DeferredHolder<SoundEvent, SoundEvent> holder = SOUNDS.register(name,
                () -> SoundEvent.createVariableRangeEvent(LostFeatures.id(name)));
        ALL.add(holder);
        return holder;
    }

    private static List<DeferredHolder<SoundEvent, SoundEvent>> horn(String part) {
        List<DeferredHolder<SoundEvent, SoundEvent>> list = new ArrayList<>();
        for (int i = 0; i < 10; i++) {
            list.add(sound("item.copper_horn." + part + "." + i));
        }
        return Collections.unmodifiableList(list);
    }

    public static List<DeferredHolder<SoundEvent, SoundEvent>> all() {
        return Collections.unmodifiableList(ALL);
    }

    public static void register(IEventBus bus) {
        SOUNDS.register(bus);
    }
}
