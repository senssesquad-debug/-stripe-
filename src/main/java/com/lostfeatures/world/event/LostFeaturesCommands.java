package com.lostfeatures.world.event;

import com.lostfeatures.LostFeatures;
import com.lostfeatures.story.Milestone;
import com.lostfeatures.story.StoryEvents;
import com.lostfeatures.story.StoryProgress;
import com.lostfeatures.world.memory.EventMemory;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.commands.SharedSuggestionProvider;
import net.minecraft.commands.arguments.EntityArgument;
import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.RegisterCommandsEvent;

import java.util.Arrays;

/**
 * Operator-only debugging and testing commands (permission level 2):
 * <pre>
 * /lostfeatures event list | start &lt;type&gt; | stop &lt;id&gt;
 * /lostfeatures encounter giant | killer_bunny
 * /lostfeatures memory
 * /lostfeatures story list &lt;player&gt; | unlock &lt;player&gt; &lt;milestone&gt;
 * </pre>
 * Admin-started events are logged; they never grant story rewards by themselves.
 */
@EventBusSubscriber(modid = LostFeatures.MOD_ID)
public final class LostFeaturesCommands {
    private LostFeaturesCommands() {
    }

    @SubscribeEvent
    public static void register(RegisterCommandsEvent event) {
        LiteralArgumentBuilder<CommandSourceStack> root = Commands.literal("lostfeatures")
                .requires(Commands.hasPermission(Commands.LEVEL_GAMEMASTERS));

        root.then(Commands.literal("event")
                .then(Commands.literal("list").executes(ctx -> {
                    ServerLevel level = ctx.getSource().getLevel();
                    var events = EncounterDirector.get(level).events();
                    ctx.getSource().sendSuccess(() -> Component.literal("Active Lost Features events: " + events.size()), false);
                    for (ActiveEvent e : events) {
                        ctx.getSource().sendSuccess(() -> Component.literal(" #" + e.id() + " " + e.type().getSerializedName() + " "
                                + e.stage().getSerializedName() + " at " + e.center().toShortString() + " age " + e.age(level.getGameTime())
                                + (e.outcome().isEmpty() ? "" : " (" + e.outcome() + ")")), false);
                    }
                    return events.size();
                }))
                .then(Commands.literal("start").then(Commands.argument("type", StringArgumentType.word())
                        .suggests((c, b) -> SharedSuggestionProvider.suggest(Arrays.stream(EventType.values()).map(EventType::getSerializedName), b))
                        .executes(ctx -> startEvent(ctx.getSource(), StringArgumentType.getString(ctx, "type"),
                                net.minecraft.core.BlockPos.containing(ctx.getSource().getPosition())))
                        .then(Commands.argument("pos", net.minecraft.commands.arguments.coordinates.BlockPosArgument.blockPos())
                                .executes(ctx -> startEvent(ctx.getSource(), StringArgumentType.getString(ctx, "type"),
                                        net.minecraft.commands.arguments.coordinates.BlockPosArgument.getLoadedBlockPos(ctx, "pos"))))))
                .then(Commands.literal("stop").then(Commands.argument("id", IntegerArgumentType.integer(1)).executes(ctx -> {
                    ServerLevel level = ctx.getSource().getLevel();
                    boolean ok = EncounterDirector.get(level).stop(IntegerArgumentType.getInteger(ctx, "id"), level.getGameTime());
                    ctx.getSource().sendSuccess(() -> Component.literal(ok ? "Event stopping" : "No such active event"), true);
                    return ok ? 1 : 0;
                }))));
        root.then(Commands.literal("encounter")
                .then(Commands.literal("giant").executes(ctx -> {
                    ServerPlayer p = ctx.getSource().getPlayerOrException();
                    boolean ok = NaturalEncounters.tryGiant(p.level(), p, p.getRandom(), true);
                    ctx.getSource().sendSuccess(() -> Component.literal(ok ? "Giant placed" : "No valid spot"), true);
                    return ok ? 1 : 0;
                }))
                .then(Commands.literal("killer_bunny").executes(ctx -> {
                    ServerPlayer p = ctx.getSource().getPlayerOrException();
                    boolean ok = NaturalEncounters.tryKillerBunny(p.level(), p, p.getRandom(), true);
                    ctx.getSource().sendSuccess(() -> Component.literal(ok ? "Killer Bunny placed" : "Needs a wild rabbit within 48 blocks"), true);
                    return ok ? 1 : 0;
                })));

        root.then(Commands.literal("memory").executes(ctx -> {
            int size = EventMemory.get(ctx.getSource().getLevel()).size();
            ctx.getSource().sendSuccess(() -> Component.literal("Event memory records in this dimension: " + size), false);
            return size;
        }));

        root.then(Commands.literal("story")
                .then(Commands.literal("list").then(Commands.argument("player", EntityArgument.player()).executes(ctx -> {
                    ServerPlayer p = EntityArgument.getPlayer(ctx, "player");
                    var set = StoryProgress.get(ctx.getSource().getServer()).milestones(p.getUUID());
                    ctx.getSource().sendSuccess(() -> Component.literal(p.getGameProfile().name() + ": " + set), false);
                    return set.size();
                })))
                .then(Commands.literal("unlock").then(Commands.argument("player", EntityArgument.player())
                        .then(Commands.argument("milestone", StringArgumentType.word())
                                .suggests((c, b) -> SharedSuggestionProvider.suggest(Arrays.stream(Milestone.values()).map(Milestone::id), b))
                                .executes(ctx -> {
                                    ServerPlayer p = EntityArgument.getPlayer(ctx, "player");
                                    var m = Milestone.byId(StringArgumentType.getString(ctx, "milestone"));
                                    if (m.isEmpty()) {
                                        ctx.getSource().sendFailure(Component.literal("Unknown milestone"));
                                        return 0;
                                    }
                                    boolean first = StoryEvents.unlock(p, m.get());
                                    ctx.getSource().sendSuccess(() -> Component.literal(first ? "Unlocked" : "Already unlocked (no duplicate reward)"), true);
                                    return first ? 1 : 0;
                                })))));

        event.getDispatcher().register(root);
    }

    private static int startEvent(CommandSourceStack source, String name, net.minecraft.core.BlockPos pos) {
        EventType type = Arrays.stream(EventType.values()).filter(t -> t.getSerializedName().equals(name)).findFirst().orElse(null);
        if (type == null) {
            source.sendFailure(Component.literal("Unknown event type " + name));
            return 0;
        }
        ServerLevel level = source.getLevel();
        EncounterDirector director = EncounterDirector.get(level);
        ActiveEvent e = director.tryStart(level, pos, type, true);
        if (e == null) {
            source.sendFailure(Component.literal("Could not start " + name + " here: " + director.lastRefusal()));
            return 0;
        }
        LostFeatures.LOGGER.info("Admin {} started event {} #{} at {}", source.getTextName(), name, e.id(), e.center().toShortString());
        source.sendSuccess(() -> Component.literal("Started " + name + " #" + e.id() + " at " + e.center().toShortString()), true);
        return 1;
    }
}
