"""Armor equipment layers and the original painting collection.

Paintings are 16 px per block and share one palette family (dusk reds, ruby, ancient sandstone,
cool night blues) so the set reads as one coherent collection about the mod's world.
Run: python3 tools/assetgen/gen_art.py"""
from __future__ import annotations

import json
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(__file__))
from boxmodel import Box, Part, faces  # noqa: E402
from pixel import ROOT, Canvas, hex_rgb, mix, shade  # noqa: E402

# =========================================================================== equipment


def armor_layer(name, folder, base, light, stud, legs_only=False):
    c = Canvas(64, 32, 5)
    p = Part("root")
    if legs_only:
        p.boxes = [Box("body", (0, 0, 0), (8, 12, 4), uv=(16, 16)), Box("leg", (0, 0, 0), (4, 12, 4), uv=(0, 16))]
    else:
        p.boxes = [Box("head", (0, 0, 0), (8, 8, 8), uv=(0, 0)), Box("body", (0, 0, 0), (8, 12, 4), uv=(16, 16)),
                   Box("arm", (0, 0, 0), (4, 12, 4), uv=(40, 16)), Box("leg", (0, 0, 0), (4, 12, 4), uv=(0, 16))]
    for part, box, face, x0, y0, w, h in faces(p):
        if w <= 0 or h <= 0:
            continue
        c.noise_rect(x0, y0, w, h, base, 0.07)
        for yy in range(h):
            for xx in range(w):
                if (xx + yy) % 3 == 0 and yy % 3 == 1:
                    c.set(x0 + xx, y0 + yy, stud)
        c.rect(x0, y0, w, 1, light)
        if box.name == "head" and face == "front":
            c.rect(x0 + 1, y0 + 3, w - 2, 2, (0, 0, 0), 0)  # visor opening
        if box.name == "body" and legs_only and face in ("front", "back"):
            c.rect(x0, y0 + 6, w, 6, (0, 0, 0), 0)  # leggings only cover the waist band
    c.save("textures", "entity", "equipment", folder, name + ".png")


def equipment():
    leather, leather_l, nail = hex_rgb("6a4424"), hex_rgb("8a5a34"), hex_rgb("c8c8d0")
    armor_layer("studded", "humanoid", leather, leather_l, nail)
    armor_layer("studded", "humanoid_leggings", leather, leather_l, nail, legs_only=True)
    armor_layer("dragonscale", "humanoid", hex_rgb("9c2018"), hex_rgb("f0b030"), hex_rgb("e8304a"))
    eq_dir = os.path.join(ROOT, "src", "main", "resources", "assets", "lostfeatures", "equipment")
    os.makedirs(eq_dir, exist_ok=True)
    json.dump({"layers": {"humanoid": [{"texture": "lostfeatures:studded"}], "humanoid_leggings": [{"texture": "lostfeatures:studded"}]}},
              open(os.path.join(eq_dir, "studded.json"), "w"), indent=2)
    json.dump({"layers": {"humanoid": [{"texture": "lostfeatures:dragonscale"}]}},
              open(os.path.join(eq_dir, "dragonscale.json"), "w"), indent=2)


# =========================================================================== paintings

SKY_DUSK = [hex_rgb(c) for c in ("2a1630", "5a2238", "a83a32", "e8823a", "f8c86a")]
SKY_NIGHT = [hex_rgb(c) for c in ("0c0e22", "16204a", "24366e", "3a5a90")]
SAND = [hex_rgb(c) for c in ("5a4636", "80664e", "a6896a", "c8a87e")]
RUBYC = [hex_rgb(c) for c in ("5a0a14", "8e1224", "c0182e", "e8304a", "ff7a8a")]


def frame(c, color=hex_rgb("3a2416"), light=hex_rgb("6a4424")):
    for x in range(c.w):
        c.set(x, 0, light); c.set(x, c.h - 1, color)
    for y in range(c.h):
        c.set(0, y, light); c.set(c.w - 1, y, color)


def gradient(c, colors, y0=0, y1=None):
    y1 = c.h if y1 is None else y1
    for y in range(y0, y1):
        t = (y - y0) / max(1, y1 - y0 - 1) * (len(colors) - 1)
        i = min(int(t), len(colors) - 2)
        col = mix(colors[i], colors[i + 1], t - i)
        # ordered dither between bands gives the pixel-art banding look
        for x in range(c.w):
            jitter = ((x * 7 + y * 3) % 4) / 8.0 - 0.18
            c.set(x, y, mix(colors[i], colors[i + 1], min(1, max(0, t - i + jitter))))


def ridge(c, base_y, amp, freq, color, seed, rough=1.0):
    rng = random.Random(seed)
    phase = rng.random() * 10
    for x in range(c.w):
        h = base_y - amp * (0.6 * math.sin(x * freq + phase) + 0.4 * math.sin(x * freq * 2.3 + phase * 1.7)) - rng.random() * rough
        for y in range(max(0, int(h)), c.h):
            c.set(x, y, color)


def stars(c, n, seed, y_max):
    rng = random.Random(seed)
    for _ in range(n):
        c.set(rng.randrange(c.w), rng.randrange(max(1, y_max)), hex_rgb("f4f0d0") if rng.random() < 0.7 else hex_rgb("a8c8ff"))


def dragon_silhouette(c, cx, cy, scale, color):
    pts = []
    # body + wings as a few polygons rasterised by scanline
    wing_l = [(0, 0), (-9, -5), (-16, -3), (-11, 0), (-14, 2), (-6, 1)]
    wing_r = [(x * -1, y) for x, y in wing_l]
    body = [(-2, -1), (2, -1), (3, 1), (0, 7), (-3, 1)]
    head = [(-1, -3), (1, -3), (1, -1), (-1, -1)]
    for poly in (wing_l, wing_r, body, head):
        fill_poly(c, [(cx + x * scale, cy + y * scale) for x, y in poly], color)
    # tail
    for i in range(10):
        c.set(int(cx + math.sin(i * 0.5) * scale * 1.5), int(cy + (7 + i) * scale * 0.6), color)


def fill_poly(c, pts, color):
    ys = [p[1] for p in pts]
    for y in range(int(min(ys)), int(max(ys)) + 1):
        xs = []
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            if (y0 <= y < y1) or (y1 <= y < y0):
                xs.append(x0 + (y - y0) * (x1 - x0) / (y1 - y0))
        xs.sort()
        for j in range(0, len(xs) - 1, 2):
            for x in range(int(round(xs[j])), int(round(xs[j + 1])) + 1):
                c.set(x, y, color)


def p_dragon_over_peaks():
    c = Canvas(64, 32, 1)
    gradient(c, SKY_DUSK)
    c.disc(48, 20, 6, hex_rgb("ffe8a0"))
    ridge(c, 24, 6, 0.18, hex_rgb("3a1a28"), 2, 1.5)
    ridge(c, 28, 3, 0.31, hex_rgb("1e0e18"), 3)
    dragon_silhouette(c, 22, 9, 1.0, hex_rgb("140810"))
    frame(c)
    return c


def p_forest_ruins():
    c = Canvas(32, 32, 2)
    gradient(c, [hex_rgb("6aa8c8"), hex_rgb("b8d8e0"), hex_rgb("e0ecd8")], 0, 20)
    ridge(c, 20, 2, 0.4, hex_rgb("3a6a3a"), 4)
    rng = random.Random(5)
    for x0 in (3, 10, 22, 27):
        h = 6 + rng.randrange(5)
        c.rect(x0, 24 - h, 3, h, SAND[2])
        c.rect(x0, 24 - h, 3, 1, SAND[3])
        c.set(x0 + 1, 24 - h + 2, RUBYC[3])
    for x in range(0, 32, 2):
        c.disc(x + rng.random() * 2, 16 + rng.random() * 3, 2.2, hex_rgb("2e5a2a"))
    c.rect(0, 24, 32, 8, hex_rgb("4a8a3a"))
    c.palette_rect(0, 27, 32, 5, [hex_rgb("3e7a30"), hex_rgb("4a8a3a"), hex_rgb("5a9a44")])
    frame(c)
    return c


def p_far_lands():
    c = Canvas(64, 32, 3)
    gradient(c, [hex_rgb("6a9ad8"), hex_rgb("a8c8f0"), hex_rgb("d8e8f8")], 0, 32)
    # the jagged layered walls, striped like overflowing noise
    rng = random.Random(9)
    for x in range(30, 64):
        top = int(2 + rng.random() * 3 + (64 - x) * 0.05)
        for y in range(top, 32):
            band = (y // 2 + x // 5) % 3
            col = [hex_rgb("6e6e6e"), hex_rgb("8a8a8a"), hex_rgb("5a5a5a")][band]
            if (y + x // 3) % 7 == 0:
                col = hex_rgb("1a1a1e")  # tunnels
            c.set(x, y, col)
        c.set(x, top, hex_rgb("4a8a3a"))
    ridge(c, 28, 2, 0.3, hex_rgb("4a8a3a"), 6)
    c.rect(0, 29, 30, 3, hex_rgb("3a6a2e"))
    frame(c)
    return c


def p_ancient_reactor():
    c = Canvas(16, 32, 4)
    gradient(c, [hex_rgb("120c10"), hex_rgb("2a1a18")])
    c.rect(3, 8, 10, 18, SAND[1])
    c.rect(4, 9, 8, 16, SAND[0])
    for y in range(11, 23):
        c.set(7, y, hex_rgb("ff9a3a")); c.set(8, y, hex_rgb("ffd060"))
    c.disc(7.5, 16.5, 2.5, hex_rgb("ff9a3a"))
    c.disc(7.5, 16.5, 1.2, hex_rgb("fff0c0"))
    for y in (6, 27):
        c.rect(2, y, 12, 2, hex_rgb("f0c040"))
    frame(c)
    return c


def p_monoliths():
    c = Canvas(32, 16, 5)
    gradient(c, SKY_NIGHT)
    stars(c, 14, 3, 8)
    ridge(c, 13, 1, 0.4, hex_rgb("22303a"), 8)
    for x0, w, top in ((4, 5, 2), (14, 4, 5), (24, 5, 3)):
        c.rect(x0, top, w, 14 - top, hex_rgb("5a5a62"))
        c.rect(x0, top, 1, 14 - top, hex_rgb("7a7a84"))
        c.set(x0 + w // 2, top + 2, RUBYC[3])
    c.rect(0, 14, 32, 2, hex_rgb("1a2a22"))
    frame(c)
    return c


def p_the_illusionist():
    c = Canvas(32, 32, 6)
    gradient(c, [hex_rgb("1a1430"), hex_rgb("3a2a6a"), hex_rgb("6a4ab0")])
    robe, trim = hex_rgb("2a3a7a"), hex_rgb("b8a0ff")
    for i, (x, alpha) in enumerate(((5, 0.35), (12, 0.6), (16, 1.0), (20, 0.6), (27, 0.35))):
        col = mix(hex_rgb("6a4ab0"), robe, alpha)
        c.rect(x - 2, 12, 5, 14, col)
        c.rect(x - 2, 8, 5, 4, mix(hex_rgb("6a4ab0"), hex_rgb("9aa6a8"), alpha))
        c.set(x - 1, 10, mix(hex_rgb("6a4ab0"), trim, alpha)); c.set(x + 1, 10, mix(hex_rgb("6a4ab0"), trim, alpha))
        if alpha == 1.0:
            for y in range(12, 26):
                c.set(x, y, trim)
    c.rect(0, 26, 32, 6, hex_rgb("120e20"))
    frame(c)
    return c


def p_giants_shadow():
    c = Canvas(32, 32, 7)
    gradient(c, SKY_DUSK[:4])
    # giant silhouette looming over tiny houses
    g = hex_rgb("1a1018")
    c.rect(13, 4, 6, 6, g)
    c.rect(11, 10, 10, 12, g)
    c.rect(8, 10, 3, 10, g); c.rect(21, 10, 3, 10, g)
    c.rect(12, 22, 3, 8, g); c.rect(17, 22, 3, 8, g)
    c.set(15, 6, hex_rgb("ffd23c")); c.set(17, 6, hex_rgb("ffd23c"))
    for x0 in (2, 24):
        c.rect(x0, 25, 6, 5, hex_rgb("8a5a34"))
        fill_poly(c, [(x0 - 1, 25), (x0 + 3, 21), (x0 + 7, 25)], hex_rgb("6a2a1e"))
        c.set(x0 + 2, 27, hex_rgb("ffd060"))
    c.rect(0, 30, 32, 2, hex_rgb("2a3a1e"))
    frame(c)
    return c


def p_ruby_cave():
    c = Canvas(32, 16, 8)
    c.palette_rect(0, 0, 32, 16, [hex_rgb("2a2a30"), hex_rgb("34343a"), hex_rgb("3e3e46")])
    rng = random.Random(11)
    for _ in range(9):
        x, y = rng.randrange(2, 30), rng.randrange(2, 14)
        c.set(x, y, RUBYC[3]); c.set(x + 1, y, RUBYC[2]); c.set(x, y + 1, RUBYC[1]); c.set(x + 1, y - 1, RUBYC[4])
    c.rect(0, 12, 32, 4, hex_rgb("1e1e22"))
    c.disc(16, 13, 3, hex_rgb("ff9a3a"))  # explorer's torchlight
    c.disc(16, 13, 1.5, hex_rgb("ffe8a0"))
    frame(c)
    return c


def p_civilization_mural():
    c = Canvas(64, 48, 9)
    c.palette_rect(0, 0, 64, 48, SAND[1:4])
    ink, accent = hex_rgb("3a2416"), RUBYC[2]
    for y in (8, 24, 40):
        c.rect(2, y, 60, 1, ink)
    # register 1: figures studying a dragon
    for x in (6, 12, 18):
        c.rect(x, 12, 2, 6, ink); c.set(x, 11, ink); c.set(x + 1, 11, ink)
    dragon_silhouette(c, 44, 14, 0.6, ink)
    # register 2: the reactor and rays
    c.rect(28, 27, 8, 10, ink)
    c.rect(30, 29, 4, 6, accent)
    for i in range(6):
        a = i * math.pi / 3
        c.line(32, 32, int(32 + math.cos(a) * 12), int(32 + math.sin(a) * 6), hex_rgb("f0c040"))
    # register 3: glyph band
    for x in range(4, 60, 6):
        c.rect(x, 42, 3, 3, ink); c.set(x + 1, 43, accent)
    frame(c)
    return c


def p_underground_machinery():
    c = Canvas(48, 32, 10)
    c.palette_rect(0, 0, 48, 32, [hex_rgb("1a1612"), hex_rgb("221c16")])
    for x in range(4, 44, 8):
        c.rect(x, 4, 4, 24, SAND[0])
        c.rect(x + 1, 6, 2, 20, hex_rgb("2a1e16"))
        for y in range(8, 26, 4):
            c.set(x + 1, y, hex_rgb("ff9a3a")); c.set(x + 2, y + 1, hex_rgb("ff9a3a"))
    c.rect(2, 14, 44, 2, hex_rgb("f0c040"))
    for x in range(2, 46, 3):
        c.set(x, 15, RUBYC[3])
    frame(c)
    return c


def p_journal_clue():
    c = Canvas(16, 16, 11)
    c.palette_rect(0, 0, 16, 16, [hex_rgb("efe2c0"), hex_rgb("e4d4ac")])
    ink = hex_rgb("3a2416")
    for (x, y) in ((4, 4), (5, 3), (6, 4), (9, 4), (10, 3), (11, 4), (7, 7), (8, 7), (7, 8), (8, 8)):
        c.set(x, y, ink)
    for x in range(3, 13):
        c.set(x, 11, ink)
    c.set(7, 12, RUBYC[3]); c.set(8, 12, RUBYC[3])
    frame(c, hex_rgb("6a4424"), hex_rgb("8a5a34"))
    return c


def p_ember_sky():
    c = Canvas(16, 16, 12)
    gradient(c, [hex_rgb("1a0a10"), hex_rgb("6a1a1e"), hex_rgb("e8823a")])
    rng = random.Random(13)
    for _ in range(14):
        c.set(rng.randrange(16), rng.randrange(16), hex_rgb("ffd060"))
    frame(c)
    return c


def p_brick_pyramid():
    c = Canvas(32, 32, 13)
    gradient(c, [hex_rgb("5a8ad0"), hex_rgb("a8c8f0")], 0, 26)
    brick, mortar = hex_rgb("9a4a3a"), hex_rgb("6a2e24")
    for layer in range(14):
        y = 25 - layer
        x0, x1 = 3 + layer, 28 - layer
        for x in range(x0, x1 + 1):
            c.set(x, y, mortar if (x + layer) % 4 == 0 else brick)
    c.rect(0, 26, 32, 6, hex_rgb("4a8a3a"))
    frame(c)
    return c


PAINTINGS = {
    "dragon_over_peaks": (p_dragon_over_peaks, 4, 2),
    "forest_ruins": (p_forest_ruins, 2, 2),
    "far_lands": (p_far_lands, 4, 2),
    "ancient_reactor": (p_ancient_reactor, 1, 2),
    "monoliths": (p_monoliths, 2, 1),
    "the_illusionist": (p_the_illusionist, 2, 2),
    "giants_shadow": (p_giants_shadow, 2, 2),
    "ruby_cave": (p_ruby_cave, 2, 1),
    "civilization_mural": (p_civilization_mural, 4, 3),
    "underground_machinery": (p_underground_machinery, 3, 2),
    "journal_clue": (p_journal_clue, 1, 1),
    "ember_sky": (p_ember_sky, 1, 1),
    "brick_pyramid": (p_brick_pyramid, 2, 2),
}


def paintings():
    data = os.path.join(ROOT, "src", "main", "resources", "data")
    variant_dir = os.path.join(data, "lostfeatures", "painting_variant")
    os.makedirs(variant_dir, exist_ok=True)
    for name, (fn, w, h) in PAINTINGS.items():
        canvas = fn()
        assert canvas.w == w * 16 and canvas.h == h * 16, name
        canvas.save("textures", "painting", name + ".png")
        json.dump({
            "asset_id": f"lostfeatures:{name}",
            "author": {"color": "gray", "translate": f"painting.lostfeatures.{name}.author"},
            "height": h,
            "title": {"color": "yellow", "translate": f"painting.lostfeatures.{name}.title"},
            "width": w,
        }, open(os.path.join(variant_dir, name + ".json"), "w"), indent=2)
    tag_dir = os.path.join(data, "minecraft", "tags", "painting_variant")
    os.makedirs(tag_dir, exist_ok=True)
    json.dump({"replace": False, "values": [f"lostfeatures:{n}" for n in PAINTINGS]},
              open(os.path.join(tag_dir, "placeable.json"), "w"), indent=2)


def main():
    equipment()
    paintings()
    print(f"equipment layers and {len(PAINTINGS)} paintings written")


if __name__ == "__main__":
    main()
