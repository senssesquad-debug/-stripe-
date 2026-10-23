"""Small deterministic pixel-art toolkit (PIL + numpy). Every asset is generated from code, so all
art in the mod is original and can be regenerated or replaced file-by-file."""
from __future__ import annotations

import os
import random

import numpy as np
from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
ASSETS = os.path.join(ROOT, "src", "main", "resources", "assets", "lostfeatures")


def out_path(*parts):
    path = os.path.join(ASSETS, *parts)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return path


def hex_rgb(h: str):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def shade(c, f):
    return tuple(max(0, min(255, int(round(x * f)))) for x in c[:3])


def mix(a, b, t):
    return tuple(int(round(a[i] * (1 - t) + b[i] * t)) for i in range(3))


class Canvas:
    def __init__(self, w, h, seed=0):
        self.w, self.h = w, h
        self.px = np.zeros((h, w, 4), dtype=np.uint8)
        self.rng = random.Random(seed)

    def set(self, x, y, c, a=255):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[y, x, :3] = c[:3]
            self.px[y, x, 3] = a

    def get(self, x, y):
        return tuple(int(v) for v in self.px[y, x, :3])

    def alpha(self, x, y):
        return int(self.px[y, x, 3])

    def rect(self, x0, y0, w, h, c, a=255):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.set(x, y, c, a)

    def noise_rect(self, x0, y0, w, h, base, amount=0.12, a=255):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                f = 1.0 + (self.rng.random() - 0.5) * 2 * amount
                self.set(x, y, shade(base, f), a)

    def palette_rect(self, x0, y0, w, h, colors, weights=None, a=255):
        for y in range(y0, y0 + h):
            for x in range(x0, x0 + w):
                self.set(x, y, self.rng.choices(colors, weights)[0], a)

    def outline(self, color, only_alpha=True):
        """Darken pixels that border transparency (classic item outline)."""
        src = self.px.copy()
        for y in range(self.h):
            for x in range(self.w):
                if src[y, x, 3] == 0:
                    continue
                edge = False
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if not (0 <= nx < self.w and 0 <= ny < self.h) or src[ny, nx, 3] == 0:
                        edge = True
                if edge:
                    self.px[y, x, :3] = color[:3]

    def line(self, x0, y0, x1, y1, c, a=255):
        steps = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(steps + 1):
            t = i / steps
            self.set(int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t)), c, a)

    def disc(self, cx, cy, r, c, a=255):
        for y in range(int(cy - r - 1), int(cy + r + 2)):
            for x in range(int(cx - r - 1), int(cx + r + 2)):
                if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                    self.set(x, y, c, a)

    def mask_from(self, rows, palette):
        """Paint from a list of strings; '.' is transparent, other chars index the palette dict."""
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != "." and ch in palette:
                    self.set(x, y, palette[ch])

    def save(self, *parts):
        path = out_path(*parts)
        Image.fromarray(self.px, "RGBA").save(path)
        return path

    def image(self):
        return Image.fromarray(self.px, "RGBA")
