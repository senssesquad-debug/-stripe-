package com.lostfeatures.world;

import net.minecraft.core.BlockPos;
import net.minecraft.resources.ResourceKey;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.Level;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

/**
 * A tiny, bounded, in-memory bus for "something ancient happened here" pulses.
 *
 * <p>Mechanisms, encounters and events post a signal with a position and a kind. Ancient Event
 * Sensors poll only the signals of their own dimension that are newer than their last scan, so
 * nothing ever iterates over all loaded entities. Signals expire after {@link #LIFETIME} ticks and
 * each dimension keeps at most {@link #MAX_SIGNALS}; nothing is persisted because signals are
 * transient by design.</p>
 */
public final class AncientSignals {
    public static final int LIFETIME = 100;
    public static final int MAX_SIGNALS = 128;

    public enum Kind {
        CREATURE, ENCOUNTER_START, ENCOUNTER_END, MECHANISM, EVENT_STATE
    }

    public record Signal(BlockPos pos, Kind kind, long gameTime) {
    }

    private static final Map<ResourceKey<Level>, Deque<Signal>> SIGNALS = new HashMap<>();

    private AncientSignals() {
    }

    public static synchronized void post(ServerLevel level, BlockPos pos, Kind kind) {
        Deque<Signal> queue = SIGNALS.computeIfAbsent(level.dimension(), k -> new ArrayDeque<>());
        long now = level.getGameTime();
        prune(queue, now);
        if (queue.size() >= MAX_SIGNALS) {
            queue.pollFirst();
        }
        queue.addLast(new Signal(pos.immutable(), kind, now));
    }

    /** Returns the strongest match (closest signal) since {@code sinceTick}, or -1 when none. */
    public static synchronized double closestSince(ServerLevel level, BlockPos center, int range, long sinceTick, java.util.function.Predicate<Kind> filter) {
        Deque<Signal> queue = SIGNALS.get(level.dimension());
        if (queue == null || queue.isEmpty()) {
            return -1;
        }
        prune(queue, level.getGameTime());
        double best = -1;
        double rangeSq = (double) range * range;
        for (Signal signal : queue) {
            if (signal.gameTime() < sinceTick || !filter.test(signal.kind())) {
                continue;
            }
            double d = signal.pos().distSqr(center);
            if (d <= rangeSq && (best < 0 || d < best)) {
                best = d;
            }
        }
        return best < 0 ? -1 : Math.sqrt(best);
    }

    private static void prune(Deque<Signal> queue, long now) {
        Iterator<Signal> it = queue.iterator();
        while (it.hasNext()) {
            if (now - it.next().gameTime() > LIFETIME) {
                it.remove();
            } else {
                break;
            }
        }
    }

    public static synchronized void clear() {
        SIGNALS.clear();
    }
}
