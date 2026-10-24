"""Original 16x16 block textures for Lost Features. Run: python3 tools/assetgen/gen_blocks.py"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from pixel import Canvas, hex_rgb, mix, shade  # noqa: E402

RUBY = [hex_rgb(c) for c in ("5a0a14", "8e1224", "c0182e", "e8304a", "ff7a8a", "ffd0d6")]
STONE = [hex_rgb(c) for c in ("6e6e6e", "7c7c7c", "8a8a8a", "959595")]
DEEP = [hex_rgb(c) for c in ("3c3c44", "48484f", "54545c", "5e5e66")]
ANCIENT = [hex_rgb(c) for c in ("5a4636", "6e5642", "80664e", "927658", "a6896a")]
GOLD = hex_rgb("f0c040")
GLOW = hex_rgb("ff9a3a")
CYAN_GLOW = hex_rgb("6af0e8")


def base_noise(seed, palette, weights=None):
    c = Canvas(16, 16, seed)
    c.palette_rect(0, 0, 16, 16, palette, weights)
    return c


def ore(seed, ground, name):
    c = base_noise(seed, ground, [3, 4, 4, 2])
    # ruby crystals: small faceted clusters
    for cx, cy in ((3, 3), (11, 4), (6, 10), (12, 12), (2, 12)):
        c.set(cx, cy, RUBY[3])
        c.set(cx + 1, cy, RUBY[2])
        c.set(cx, cy + 1, RUBY[1])
        c.set(cx + 1, cy + 1, RUBY[2])
        c.set(cx + 1, cy - 1, RUBY[4])
        c.set(cx - 1, cy + 1, RUBY[0])
    c.save("textures", "block", name + ".png")


def ruby_block():
    c = Canvas(16, 16, 3)
    for y in range(16):
        for x in range(16):
            # diamond-cut facets
            d = (abs(x - 7.5) + abs(y - 7.5)) / 15.0
            col = mix(RUBY[4], RUBY[1], d)
            if (x + y) % 4 == 0:
                col = shade(col, 1.12)
            c.set(x, y, col)
    for i in range(16):
        c.set(i, 0, RUBY[0]); c.set(i, 15, RUBY[0]); c.set(0, i, RUBY[0]); c.set(15, i, RUBY[0])
    c.set(4, 3, RUBY[5]); c.set(5, 3, RUBY[5]); c.set(4, 4, RUBY[5])
    c.save("textures", "block", "ruby_block.png")


def bricks(name, palette, seed, mortar, cracked=False, accent=None):
    c = Canvas(16, 16, seed)
    c.palette_rect(0, 0, 16, 16, palette, [2, 4, 4, 3] + [1] * (len(palette) - 4))
    for y in (0, 4, 8, 12):
        c.rect(0, y + 3, 16, 1, mortar)
    for row, y in enumerate((0, 4, 8, 12)):
        off = 0 if row % 2 == 0 else 4
        for x in range(off, 16, 8):
            c.rect(x, y, 1, 3, mortar)
    if cracked:
        for (x0, y0, x1, y1) in ((2, 1, 6, 6), (10, 5, 13, 10), (5, 9, 3, 14)):
            c.line(x0, y0, x1, y1, shade(mortar, 0.7))
    if accent:
        for (x, y) in ((3, 1), (11, 5), (7, 9), (14, 13)):
            c.set(x, y, accent)
    c.save("textures", "block", name + ".png")


def ancient_stone():
    c = base_noise(7, ANCIENT, [1, 3, 4, 3, 1])
    for (x, y) in ((2, 3), (9, 6), (5, 12), (13, 10), (11, 2)):
        c.set(x, y, shade(ANCIENT[0], 0.9))
    c.save("textures", "block", "ancient_stone.png")


def glyph_bricks():
    bricks("ancient_glyph_bricks", ANCIENT, 11, hex_rgb("3e3026"))
    from PIL import Image
    path = os.path.join(os.path.dirname(__file__), "..", "..", "src", "main", "resources", "assets", "lostfeatures", "textures", "block", "ancient_glyph_bricks.png")
    c = Canvas(16, 16, 12)
    c.px[:] = __import__("numpy").array(Image.open(path).convert("RGBA"))
    # glowing ruby glyph: a stylised eye-and-wing sigil
    pts = [(7, 4), (8, 4), (6, 5), (9, 5), (5, 6), (10, 6), (6, 7), (9, 7), (7, 8), (8, 8), (7, 6), (8, 6),
           (4, 9), (11, 9), (3, 10), (12, 10), (7, 10), (8, 10), (7, 11), (8, 11)]
    for x, y in pts:
        c.set(x, y, GLOW)
    c.set(7, 6, RUBY[4]); c.set(8, 6, RUBY[4])
    c.save("textures", "block", "ancient_glyph_bricks.png")


def bone_block():
    c = Canvas(16, 16, 21)
    bone = [hex_rgb(h) for h in ("d8cfb0", "e6ddc0", "efe7cf", "c8bd9a")]
    c.palette_rect(0, 0, 16, 16, bone, [3, 4, 2, 1])
    for y in (5, 10):
        c.rect(0, y, 16, 1, hex_rgb("a89c78"))
    for x in (3, 8, 13):
        c.rect(x, 0, 1, 16, hex_rgb("b8ad88"))
    c.save("textures", "block", "ancient_bone_block.png")


def flower(name, petal, petal_dark, center):
    c = Canvas(16, 16, 31)
    stem = hex_rgb("3e8a2a")
    for y in range(8, 16):
        c.set(7, y, stem)
    c.set(6, 11, stem); c.set(5, 10, hex_rgb("4ea83a")); c.set(8, 13, stem); c.set(9, 12, hex_rgb("4ea83a"))
    for (x, y) in ((6, 3), (7, 2), (8, 3), (5, 4), (9, 4), (6, 5), (8, 5), (5, 6), (9, 6), (6, 7), (7, 7), (8, 7), (7, 3), (6, 4), (8, 4), (6, 6), (8, 6)):
        c.set(x, y, petal)
    for (x, y) in ((5, 5), (9, 5), (7, 6), (7, 8)):
        c.set(x, y, petal_dark)
    c.set(7, 4, center); c.set(7, 5, center)
    c.save("textures", "block", name + ".png")


def scorched():
    top = Canvas(16, 16, 41)
    top.palette_rect(0, 0, 16, 16, [hex_rgb(h) for h in ("2a2622", "36302a", "443a30", "1e1c1a")], [4, 4, 2, 2])
    for (x, y) in ((3, 4), (11, 9), (7, 13)):
        top.set(x, y, hex_rgb("ff6a1a"))
    top.save("textures", "block", "scorched_grass_top.png")
    side = Canvas(16, 16, 42)
    side.palette_rect(0, 0, 16, 16, [hex_rgb(h) for h in ("6a4a30", "7a5638", "5e4028", "86603e")])
    for x in range(16):
        h = 3 + (x * 7 % 3)
        side.rect(x, 0, 1, h, hex_rgb("2e2824") if x % 2 else hex_rgb("3a322a"))
    side.save("textures", "block", "scorched_grass_side.png")


def charred_remains():
    c = Canvas(16, 16, 51)
    c.palette_rect(0, 0, 16, 16, [hex_rgb(h) for h in ("2a2826", "3a3634", "4a4542")])
    bone = hex_rgb("d8cfb0")
    for (x0, y0, x1, y1) in ((2, 3, 9, 6), (6, 10, 13, 12), (11, 2, 13, 8)):
        c.line(x0, y0, x1, y1, bone)
    c.set(2, 3, hex_rgb("efe7cf")); c.set(9, 6, hex_rgb("efe7cf"))
    c.save("textures", "block", "charred_remains.png")


def device_frame(seed):
    c = Canvas(16, 16, seed)
    c.palette_rect(0, 0, 16, 16, ANCIENT[1:4])
    for i in range(16):
        for (x, y) in ((i, 0), (i, 15), (0, i), (15, i)):
            c.set(x, y, ANCIENT[0])
    for (x, y) in ((1, 1), (14, 1), (1, 14), (14, 14)):
        c.set(x, y, GOLD)
    return c


def sensor():
    for on in (False, True):
        top = device_frame(61)
        eye = GLOW if on else RUBY[1]
        top.disc(7.5, 7.5, 4.2, hex_rgb("2a1e18"))
        top.disc(7.5, 7.5, 3.0, eye)
        top.disc(7.5, 7.5, 1.3, RUBY[5] if on else RUBY[0])
        top.save("textures", "block", "ancient_event_sensor_top" + ("_on" if on else "") + ".png")
        side = device_frame(62)
        for x in range(3, 13):
            side.set(x, 7, GLOW if on else RUBY[0])
        for y in range(4, 11):
            side.set(7, y, GLOW if on else RUBY[0])
        side.set(7, 7, RUBY[5] if on else RUBY[2])
        side.save("textures", "block", "ancient_event_sensor_side" + ("_on" if on else "") + ".png")


def reactor():
    variants = {"": RUBY[1], "_active": GLOW, "_cooldown": hex_rgb("4a6a8a")}
    for suffix, core in variants.items():
        top = device_frame(71)
        top.rect(4, 4, 8, 8, hex_rgb("1e1612"))
        top.rect(5, 5, 6, 6, core)
        top.rect(7, 7, 2, 2, shade(core, 1.3))
        top.save("textures", "block", "ancient_energy_reactor_top" + suffix + ".png")
        side = device_frame(72)
        for x in (3, 7, 11):
            side.rect(x, 2, 2, 12, hex_rgb("1e1612"))
            side.rect(x, 3 if suffix != "_active" else 2, 2, 10 if suffix != "_active" else 12, core)
        side.save("textures", "block", "ancient_energy_reactor_side" + suffix + ".png")


def runic():
    for on in (False, True):
        rune = GLOW if on else hex_rgb("7a2a1a")
        top = Canvas(16, 16, 81)
        top.palette_rect(0, 0, 16, 16, ANCIENT[2:5])
        # three input runes and an output arrow
        for (x, y) in ((2, 7), (3, 6), (3, 8), (13, 7), (12, 6), (12, 8), (7, 12), (8, 12), (7, 13), (8, 13)):
            top.set(x, y, rune)
        for y in range(2, 11):
            top.set(7, y, rune); top.set(8, y, rune)
        top.set(6, 3, rune); top.set(9, 3, rune); top.set(5, 4, rune); top.set(10, 4, rune)
        top.save("textures", "block", "runic_logic_device_top" + ("_on" if on else "") + ".png")
        front = device_frame(82)
        for (x, y) in ((7, 4), (8, 4), (6, 5), (9, 5), (5, 6), (10, 6), (7, 6), (8, 6), (7, 7), (8, 7), (7, 8), (8, 8), (7, 9), (8, 9), (7, 10), (8, 10)):
            front.set(x, y, rune)
        front.save("textures", "block", "runic_logic_device_front" + ("_on" if on else "") + ".png")
    side = device_frame(83)
    side.rect(3, 7, 10, 2, hex_rgb("7a2a1a"))
    side.save("textures", "block", "runic_logic_device_side.png")


def dart_trap():
    bricks("dart_trap_front_base", ANCIENT, 91, hex_rgb("3e3026"))
    c = Canvas(16, 16, 91)
    c.palette_rect(0, 0, 16, 16, ANCIENT[1:4])
    for i in range(16):
        c.set(i, 0, ANCIENT[0]); c.set(i, 15, ANCIENT[0]); c.set(0, i, ANCIENT[0]); c.set(15, i, ANCIENT[0])
    # carved face with a dark mouth hole
    c.rect(4, 4, 2, 2, hex_rgb("2a1e18")); c.rect(10, 4, 2, 2, hex_rgb("2a1e18"))
    c.disc(7.5, 10.5, 2.0, hex_rgb("120c0a"))
    c.rect(4, 3, 2, 1, GLOW); c.rect(10, 3, 2, 1, GLOW)
    c.save("textures", "block", "dart_trap_front.png")
    os.remove(os.path.join(os.path.dirname(__file__), "..", "..", "src", "main", "resources", "assets", "lostfeatures", "textures", "block", "dart_trap_front_base.png"))


def spikes():
    top = Canvas(16, 16, 101)
    top.palette_rect(0, 0, 16, 16, [hex_rgb(h) for h in ("5a5a60", "68686e", "74747a")])
    for x in (2, 7, 12):
        for y in (2, 7, 12):
            top.rect(x, y, 2, 2, hex_rgb("1a1a1e"))
    top.save("textures", "block", "spike_trap_top.png")
    side = Canvas(16, 16, 102)
    side.palette_rect(0, 0, 16, 16, ANCIENT[1:4])
    side.rect(0, 12, 16, 4, hex_rgb("5a5a60"))
    side.rect(0, 12, 16, 1, hex_rgb("8a8a90"))
    side.save("textures", "block", "spike_trap_side.png")
    spike = Canvas(16, 16, 103)
    for y in range(16):
        for x in range(16):
            spike.set(x, y, mix(hex_rgb("d0d0d8"), hex_rgb("6a6a72"), y / 15))
    spike.save("textures", "block", "spike.png")


def locked_chest():
    wood = [hex_rgb(h) for h in ("6a4424", "7a5030", "86593a")]
    band = hex_rgb("3a3a40")
    for name in ("top", "side", "front"):
        c = Canvas(16, 16, 111)
        c.palette_rect(0, 0, 16, 16, wood)
        for x in range(16):
            c.set(x, 0, wood[0]); c.set(x, 15, wood[0])
        for y in range(16):
            c.set(0, y, band); c.set(15, y, band)
        if name != "top":
            c.rect(0, 5, 16, 1, band)
        if name == "front":
            c.rect(6, 4, 4, 5, hex_rgb("8a8a92"))
            c.rect(7, 5, 2, 3, hex_rgb("2a2a30"))
            c.set(7, 4, RUBY[3]); c.set(8, 4, RUBY[3])
            c.rect(5, 10, 6, 1, GOLD)
        c.save("textures", "block", "locked_chest_" + name + ".png")


def altar():
    side = Canvas(16, 16, 121)
    side.palette_rect(0, 0, 16, 16, [hex_rgb(h) for h in ("2a2224", "3a2e30", "4a3a3a")])
    for x in range(16):
        side.set(x, 2, GOLD); side.set(x, 13, GOLD)
    for x in range(2, 14, 3):
        side.set(x, 7, RUBY[3]); side.set(x + 1, 8, RUBY[2])
    side.save("textures", "block", "ancient_altar_side.png")
    top = Canvas(16, 16, 122)
    top.palette_rect(0, 0, 16, 16, [hex_rgb(h) for h in ("3a2e30", "4a3a3a")])
    for i in range(16):
        top.set(i, 0, GOLD); top.set(i, 15, GOLD); top.set(0, i, GOLD); top.set(15, i, GOLD)
    top.disc(7.5, 7.5, 3, hex_rgb("1a1214"))
    top.save("textures", "block", "ancient_altar_top.png")


def secret_door():
    bricks("ancient_secret_door", ANCIENT, 131, hex_rgb("3e3026"))
    # nearly identical to ancient bricks: a single hairline seam gives attentive players a hint
    from PIL import Image
    import numpy as np
    root = os.path.join(os.path.dirname(__file__), "..", "..", "src", "main", "resources", "assets", "lostfeatures", "textures", "block")
    c = Canvas(16, 16, 132)
    c.px[:] = np.array(Image.open(os.path.join(root, "ancient_secret_door.png")).convert("RGBA"))
    for y in range(0, 16, 2):
        c.set(15, y, hex_rgb("2a1e16"))
    c.save("textures", "block", "ancient_secret_door.png")


def main():
    ore(1, STONE, "ruby_ore")
    ore(2, DEEP, "deepslate_ruby_ore")
    ruby_block()
    bricks("ruby_bricks", [hex_rgb(h) for h in ("8e1224", "a4182a", "b81e32", "c02436")], 4, hex_rgb("4a0a12"), accent=RUBY[4])
    ancient_stone()
    bricks("ancient_stone_bricks", ANCIENT, 8, hex_rgb("3e3026"))
    bricks("cracked_ancient_stone_bricks", ANCIENT, 9, hex_rgb("3e3026"), cracked=True)
    glyph_bricks()
    bone_block()
    flower("rose", hex_rgb("d0182a"), hex_rgb("8e0e1c"), hex_rgb("ffd040"))
    flower("cyan_rose", hex_rgb("40c8d8"), hex_rgb("2a8a9a"), hex_rgb("f0f0ff"))
    scorched()
    charred_remains()
    sensor()
    reactor()
    runic()
    dart_trap()
    spikes()
    locked_chest()
    altar()
    secret_door()
    print("block textures written")


if __name__ == "__main__":
    main()
