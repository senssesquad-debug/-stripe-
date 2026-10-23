package com.lostfeatures.story;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Stable story milestone IDs. IDs are persisted, so they must never be renamed; new milestones are
 * only ever appended. All milestones are per-player. Text lives under
 * {@code journal.lostfeatures.<id>.title} / {@code .text} and is original mod lore.
 */
public enum Milestone {
    // Chronicle: the ancient research arc
    FIRST_STEPS("first_steps", Category.CHRONICLE),
    RUBY_FOUND("ruby_found", Category.CHRONICLE),
    ANCIENT_SITE("ancient_site", Category.CHRONICLE),
    GLYPHS_READ("glyphs_read", Category.CHRONICLE),
    NOTES_FOUND("notes_found", Category.CHRONICLE),
    NOTES_DECODED("notes_decoded", Category.CHRONICLE),
    LOCKED_CHEST_OPENED("locked_chest_opened", Category.CHRONICLE),
    MECHANISM_BUILT("mechanism_built", Category.CHRONICLE),
    REACTOR_AWAKENED("reactor_awakened", Category.CHRONICLE),
    FAR_LANDS_REACHED("far_lands_reached", Category.CHRONICLE),
    // Vanilla boss observations (never modifies either boss)
    ENDER_DRAGON_VICTORY("ender_dragon_victory", Category.CHRONICLE),
    WITHER_VICTORY("wither_victory", Category.CHRONICLE),
    // Finale
    SIGIL_FORGED("sigil_forged", Category.CHRONICLE),
    ALTAR_AWAKENED("altar_awakened", Category.CHRONICLE),
    ANCESTRAL_DEFEATED("ancestral_defeated", Category.CHRONICLE),
    // Bestiary
    DRAGON_SIGHTED("dragon_sighted", Category.BESTIARY),
    DRAGON_DEFEATED("dragon_defeated", Category.BESTIARY),
    GIANT_DEFEATED("giant_defeated", Category.BESTIARY),
    ILLUSIONER_DEFEATED("illusioner_defeated", Category.BESTIARY),
    KILLER_BUNNY_DEFEATED("killer_bunny_defeated", Category.BESTIARY);

    public enum Category { CHRONICLE, BESTIARY }

    private static final Map<String, Milestone> BY_ID = Arrays.stream(values()).collect(Collectors.toMap(Milestone::id, Function.identity()));

    private final String id;
    private final Category category;

    Milestone(String id, Category category) {
        this.id = id;
        this.category = category;
    }

    public String id() {
        return id;
    }

    public Category category() {
        return category;
    }

    public String titleKey() {
        return "journal.lostfeatures." + id + ".title";
    }

    public String textKey() {
        return "journal.lostfeatures." + id + ".text";
    }

    public static Optional<Milestone> byId(String id) {
        return Optional.ofNullable(BY_ID.get(id));
    }

    /** Ordered list for the journal UI. */
    public static List<Milestone> ordered(Category category) {
        return Arrays.stream(values()).filter(m -> m.category == category).toList();
    }
}
