package com.lostfeatures.client.screen;

import com.lostfeatures.client.ClientJournal;
import com.lostfeatures.story.Milestone;
import net.minecraft.client.gui.GuiGraphicsExtractor;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.Screen;
import net.minecraft.network.chat.Component;

import java.util.List;

/**
 * The Ancient Journal: a Chronicle (story) and a Bestiary. Entries are revealed by milestones
 * unlocked on the server. Locked entries are shown as unknown so players can see how much remains.
 */
public class JournalScreen extends Screen {
    private static final int PAGE_W = 300;
    private static final int PAGE_H = 200;
    private static final int PARCHMENT = 0xFFE8D9B0;
    private static final int PARCHMENT_DARK = 0xFFB89E6A;
    private static final int INK = 0xFF3A2A1A;
    private static final int FADED = 0xFF8A7A60;

    private Milestone.Category category = Milestone.Category.CHRONICLE;
    private int index;

    public JournalScreen() {
        super(Component.translatable("screen.lostfeatures.journal"));
    }

    @Override
    protected void init() {
        rebuild();
    }

    public void refresh() {
        rebuild();
    }

    private List<Milestone> entries() {
        return Milestone.ordered(category);
    }

    private void rebuild() {
        clearWidgets();
        int left = (width - PAGE_W) / 2;
        int top = (height - PAGE_H) / 2;
        addRenderableWidget(Button.builder(Component.translatable("screen.lostfeatures.journal.chronicle"), b -> {
            category = Milestone.Category.CHRONICLE;
            index = 0;
            rebuild();
        }).bounds(left, top - 24, 96, 20).build());
        addRenderableWidget(Button.builder(Component.translatable("screen.lostfeatures.journal.bestiary"), b -> {
            category = Milestone.Category.BESTIARY;
            index = 0;
            rebuild();
        }).bounds(left + 100, top - 24, 96, 20).build());
        addRenderableWidget(Button.builder(Component.literal("<"), b -> {
            index = Math.max(0, index - 1);
        }).bounds(left, top + PAGE_H + 4, 30, 20).build());
        addRenderableWidget(Button.builder(Component.literal(">"), b -> {
            index = Math.min(entries().size() - 1, index + 1);
        }).bounds(left + PAGE_W - 30, top + PAGE_H + 4, 30, 20).build());
        addRenderableWidget(Button.builder(Component.translatable("gui.done"), b -> onClose())
                .bounds(left + PAGE_W / 2 - 40, top + PAGE_H + 4, 80, 20).build());
    }

    @Override
    public void extractRenderState(GuiGraphicsExtractor graphics, int mouseX, int mouseY, float a) {
        super.extractRenderState(graphics, mouseX, mouseY, a);
        int left = (width - PAGE_W) / 2;
        int top = (height - PAGE_H) / 2;
        graphics.fill(left - 2, top - 2, left + PAGE_W + 2, top + PAGE_H + 2, PARCHMENT_DARK);
        graphics.fill(left, top, left + PAGE_W, top + PAGE_H, PARCHMENT);

        List<Milestone> list = entries();
        if (list.isEmpty()) {
            return;
        }
        index = Math.clamp(index, 0, list.size() - 1);
        Milestone entry = list.get(index);
        boolean unlocked = ClientJournal.milestones().contains(entry.id());
        long found = list.stream().filter(m -> ClientJournal.milestones().contains(m.id())).count();

        graphics.text(font, Component.translatable("screen.lostfeatures.journal.progress", found, list.size()), left + 8, top + 6, FADED, false);
        graphics.text(font, Component.literal((index + 1) + " / " + list.size()), left + PAGE_W - 40, top + 6, FADED, false);
        if (unlocked) {
            graphics.text(font, Component.translatable(entry.titleKey()), left + 8, top + 22, INK, false);
            graphics.textWithWordWrap(font, Component.translatable(entry.textKey()), left + 8, top + 38, PAGE_W - 16, INK, false);
        } else {
            graphics.text(font, Component.translatable("screen.lostfeatures.journal.unknown"), left + 8, top + 22, FADED, false);
            graphics.textWithWordWrap(font, Component.translatable("journal.lostfeatures." + entry.id() + ".hint"), left + 8, top + 38,
                    PAGE_W - 16, FADED, false);
        }
        if (ClientJournal.worldFlags().contains("ancestral_silenced") && category == Milestone.Category.CHRONICLE) {
            graphics.text(font, Component.translatable("screen.lostfeatures.journal.world_note"), left + 8, top + PAGE_H - 14, FADED, false);
        }
    }

    @Override
    public boolean isPauseScreen() {
        return false;
    }
}
