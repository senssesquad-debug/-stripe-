"""Original audio for Lost Features: every sound effect, the 30 copper horn tunes and nine music
tracks are synthesised here from scratch (numpy/scipy) and encoded to mono Ogg Vorbis with ffmpeg.
It also writes assets/lostfeatures/sounds.json and data/lostfeatures/jukebox_song/*.json so the
catalogue, the files and the registrations can never drift apart.

Run: python3 tools/assetgen/gen_audio.py   (needs numpy, scipy and ffmpeg with libvorbis)
Replace any generated .ogg by hand afterwards; just keep the file name (see docs/ASSETS_AND_AUDIO.md).
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
import wave

import numpy as np
from scipy.signal import butter, lfilter

sys.path.insert(0, os.path.dirname(__file__))
from pixel import ROOT  # noqa: E402

SR = 44100
ASSETS = os.path.join(ROOT, "src", "main", "resources", "assets", "lostfeatures")
DATA = os.path.join(ROOT, "src", "main", "resources", "data", "lostfeatures")
RNG = np.random.default_rng(20261023)

# =========================================================================== primitives


class Sig(np.ndarray):
    """1-D signal whose + pads the shorter operand with silence, so layers of any length can be summed."""

    def __new__(cls, arr):
        return np.asarray(arr, dtype=float).view(cls)

    def __add__(self, other):
        if isinstance(other, np.ndarray) and other.ndim == 1 and len(other) != len(self):
            n = max(len(self), len(other))
            return Sig(np.pad(np.asarray(self), (0, n - len(self))) + np.pad(np.asarray(other), (0, n - len(other))))
        return np.ndarray.__add__(self, other)

    __radd__ = __add__


def signal(fn):
    def wrapped(*args, **kwargs):
        return Sig(fn(*args, **kwargs))
    wrapped.__name__ = fn.__name__
    return wrapped


def secs(d):
    return np.arange(int(SR * d)) / SR


def env(n, a=0.01, d=0.1, s=0.7, r=0.2):
    """ADSR envelope (times in seconds) over n samples."""
    a, d, r = int(a * SR), int(d * SR), int(r * SR)
    sus = max(0, n - a - d - r)
    e = np.concatenate([np.linspace(0, 1, max(a, 1)), np.linspace(1, s, max(d, 1)), np.full(sus, s), np.linspace(s, 0, max(r, 1))])
    return np.pad(e, (0, max(0, n - len(e))))[:n]


def exp_decay(n, tau):
    return np.exp(-np.arange(n) / (SR * tau))


@signal
def noise(n):
    return RNG.standard_normal(n)


@signal
def lp(x, cutoff, order=2):
    b, a = butter(order, min(cutoff, SR / 2 - 100) / (SR / 2), "low")
    return lfilter(b, a, x)


@signal
def hp(x, cutoff, order=2):
    b, a = butter(order, max(cutoff, 20) / (SR / 2), "high")
    return lfilter(b, a, x)


@signal
def bp(x, lo, hi, order=2):
    b, a = butter(order, [max(lo, 20) / (SR / 2), min(hi, SR / 2 - 100) / (SR / 2)], "band")
    return lfilter(b, a, x)


@signal
def sweep(f0, f1, dur, shape="sine"):
    t = secs(dur)
    f = f0 * (f1 / f0) ** (t / max(dur, 1e-6))
    ph = 2 * np.pi * np.cumsum(f) / SR
    if shape == "saw":
        return 2 * ((ph / (2 * np.pi)) % 1.0) - 1
    if shape == "square":
        return np.sign(np.sin(ph))
    return np.sin(ph)


@signal
def tone(freq, dur, harmonics=(1.0,), vib=0.0, vib_rate=5.0):
    t = secs(dur)
    f = freq * (1 + vib * np.sin(2 * np.pi * vib_rate * t))
    ph = 2 * np.pi * np.cumsum(f) / SR
    out = np.zeros_like(t)
    for k, amp in enumerate(harmonics, start=1):
        out += amp * np.sin(k * ph)
    return out


@signal
def saw(freq, dur, vib=0.0, vib_rate=5.0, detune=0.0):
    t = secs(dur)
    out = np.zeros_like(t)
    for d in (-detune, 0.0, detune) if detune else (0.0,):
        f = freq * (1 + d) * (1 + vib * np.sin(2 * np.pi * vib_rate * t))
        ph = np.cumsum(f) / SR
        out += 2 * (ph % 1.0) - 1
    return out / (3 if detune else 1)


def mix_at(buf, sig, start, gain=1.0):
    i = int(start * SR)
    if i >= len(buf):
        return
    j = min(len(buf), i + len(sig))
    buf[i:j] += gain * sig[: j - i]


@signal
def reverb(x, wet=0.25, size=1.0):
    out = np.copy(x)
    for delay, g in ((1557, 0.77), (1617, 0.76), (1491, 0.75), (1422, 0.74)):
        d = int(delay * size)
        a = np.zeros(d + 1)
        a[0], a[-1] = 1.0, -g
        out += wet * 0.25 * lfilter([1.0], a, x)
    for delay, g in ((225, 0.7), (556, 0.7)):
        b = np.zeros(delay + 1)
        b[0], b[-1] = -g, 1.0
        a = np.zeros(delay + 1)
        a[0], a[-1] = 1.0, -g
        out = lfilter(b, a, out)
    return out


def finish(x, peak_db=-1.0, fade=0.01, soft=True, max_rms=0.2):
    x = np.nan_to_num(x)
    if soft:
        x = np.tanh(x * 1.2) / np.tanh(1.2)
    n = len(x)
    f = min(int(fade * SR), n // 4)
    if f > 0:
        x[:f] *= np.linspace(0, 1, f)
        x[-f:] *= np.linspace(1, 0, f)
    m = np.max(np.abs(x)) or 1.0
    x = x / m * (10 ** (peak_db / 20))
    rms = float(np.sqrt(np.mean(x ** 2)))
    if rms > max_rms:  # keep dense cues from being louder than vanilla sounds
        x = x * (max_rms / rms)
    return x


def write_ogg(rel_path, x, quality=4):
    path = os.path.join(ASSETS, "sounds", rel_path + ".ogg")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        wav_path = tmp.name
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-c:a", "libvorbis", "-q:a", str(quality), "-ac", "1", path],
                   check=True)
    os.remove(wav_path)
    return len(x) / SR


# =========================================================================== sound designs

@signal
def roar(dur=1.6, base=70, bright=1800):
    n = int(dur * SR)
    body = saw(base, dur, vib=0.03, vib_rate=7, detune=0.012) + 0.5 * saw(base * 1.5, dur, vib=0.04, vib_rate=5.5)
    grit = bp(noise(n), 200, bright)
    x = lp(body, bright) * 0.7 + grit * 0.5
    x *= env(n, 0.08, 0.3, 0.7, dur * 0.45)
    return reverb(x, 0.3, 1.2)


@signal
def thump(dur=0.25, f0=120, f1=40, grit=0.3):
    n = int(dur * SR)
    return (sweep(f0, f1, dur) + grit * lp(noise(n), 900)) * exp_decay(n, dur / 4)


@signal
def whoosh(dur=0.6, lo=150, hi=1200):
    n = int(dur * SR)
    return bp(noise(n), lo, hi) * env(n, dur * 0.35, dur * 0.2, 0.4, dur * 0.4)


@signal
def crackle(dur=1.0, density=0.02):
    n = int(dur * SR)
    clicks = (RNG.random(n) < density).astype(float) * RNG.standard_normal(n)
    return hp(lp(clicks, 6000), 800) + 0.3 * bp(noise(n), 300, 2500)


@signal
def chime(freq, dur=1.0, partials=((1, 1.0), (2.76, 0.5), (5.4, 0.25)), tau=0.4):
    n = int(dur * SR)
    t = secs(dur)
    x = sum(a * np.sin(2 * np.pi * freq * r * t) * exp_decay(n, tau / r ** 0.5) for r, a in partials)
    return x


@signal
def stone_hit(dur=0.18, ring=2200):
    n = int(dur * SR)
    return (bp(noise(n), 300, 3500) * exp_decay(n, 0.03) + 0.5 * np.sin(2 * np.pi * ring * secs(dur)) * exp_decay(n, 0.05))


@signal
def squeak(f0, f1, dur):
    n = int(dur * SR)
    return sweep(f0, f1, dur, "square") * 0.3 * env(n, 0.01, 0.05, 0.6, dur * 0.4) + 0.4 * lp(noise(n), 4000) * exp_decay(n, dur / 3)


@signal
def creature_vocal(f0, f1, dur, formant=(500, 1500), grit=0.4, vib=0.02):
    n = int(dur * SR)
    src = saw(f0, dur, vib=vib, vib_rate=6) if f0 == f1 else sweep(f0, f1, dur, "saw")
    voiced = bp(src, formant[0], formant[1]) * 1.5
    return (voiced + grit * bp(noise(n), formant[0], formant[1] * 1.5)) * env(n, 0.03, 0.1, 0.8, dur * 0.4)


SFX = {
    # ---------------------------------------------------------------- Red Dragon
    "entity/red_dragon/ambient": lambda: creature_vocal(55, 55, 1.8, (90, 700), 0.6) * 0.8 + 0.3 * whoosh(1.8, 80, 400),
    "entity/red_dragon/step": lambda: thump(0.35, 90, 35, 0.6),
    "entity/red_dragon/takeoff": lambda: np.concatenate([whoosh(0.5, 80, 900) + thump(0.5, 70, 30), whoosh(0.6, 120, 1500)]),
    "entity/red_dragon/flap": lambda: whoosh(0.45, 60, 700) * 1.4 + 0.4 * thump(0.45, 60, 30, 0.2),
    "entity/red_dragon/land": lambda: thump(0.8, 70, 25, 1.0) + 0.4 * whoosh(0.8, 60, 500),
    "entity/red_dragon/roar": lambda: roar(2.2, 62, 2200),
    "entity/red_dragon/warning": lambda: roar(1.4, 48, 900) * 0.9,
    "entity/red_dragon/breath_start": lambda: np.concatenate([whoosh(0.3, 200, 3000), crackle(0.7, 0.03) * env(int(0.7 * SR), 0.05, 0.1, 0.8, 0.3)]),
    "entity/red_dragon/breath_loop": lambda: (crackle(1.0, 0.04) + 0.6 * bp(noise(SR), 150, 1200)) * env(SR, 0.05, 0.1, 0.9, 0.1),
    "entity/red_dragon/breath_impact": lambda: thump(0.5, 200, 60, 0.8) + crackle(0.5, 0.05) * exp_decay(int(0.5 * SR), 0.15),
    "entity/red_dragon/hurt": lambda: creature_vocal(120, 80, 0.6, (200, 1800), 0.5),
    "entity/red_dragon/death": lambda: roar(3.0, 70, 1500) * env(int(3.0 * SR), 0.05, 0.5, 0.6, 2.0) + 0.6 * thump(3.0, 50, 20, 0.3),
    # ---------------------------------------------------------------- Giant
    "entity/giant/ambient": lambda: creature_vocal(45, 45, 2.0, (80, 400), 0.7, 0.01),
    "entity/giant/step": lambda: thump(0.6, 60, 22, 0.9),
    "entity/giant/windup": lambda: creature_vocal(50, 85, 1.3, (100, 700), 0.6) + 0.5 * whoosh(1.3, 60, 500),
    "entity/giant/slam": lambda: thump(1.2, 80, 18, 1.4) + 0.7 * bp(noise(int(1.2 * SR)), 60, 900) * exp_decay(int(1.2 * SR), 0.25),
    "entity/giant/hurt": lambda: creature_vocal(70, 50, 0.7, (90, 600), 0.5),
    "entity/giant/death": lambda: creature_vocal(60, 25, 2.5, (70, 500), 0.6) * env(int(2.5 * SR), 0.05, 0.5, 0.7, 1.5) + thump(2.5, 50, 15, 1.0),
    # ---------------------------------------------------------------- Illusioner
    "entity/illusioner/ambient": lambda: creature_vocal(160, 140, 0.9, (400, 2400), 0.2, 0.03),
    "entity/illusioner/cast": lambda: sum(chime(f, 1.4, tau=0.6) for f in (523, 659, 784)) * 0.4 + 0.2 * whoosh(1.4, 1000, 6000),
    "entity/illusioner/illusion": lambda: sweep(300, 1200, 0.9) * env(int(0.9 * SR), 0.05, 0.2, 0.6, 0.4) * 0.5 + 0.4 * reverb(chime(988, 0.9), 0.5),
    "entity/illusioner/reposition": lambda: whoosh(0.5, 800, 6000) + 0.4 * sweep(1600, 200, 0.5) * exp_decay(int(0.5 * SR), 0.15),
    "entity/illusioner/shoot": lambda: thump(0.15, 400, 120, 0.1) + 0.4 * whoosh(0.3, 1500, 7000),
    "entity/illusioner/hurt": lambda: creature_vocal(220, 170, 0.45, (500, 2600), 0.3),
    "entity/illusioner/death": lambda: creature_vocal(200, 90, 1.4, (400, 2400), 0.3) + 0.3 * reverb(chime(440, 1.4), 0.6),
    # ---------------------------------------------------------------- Killer Bunny
    "entity/killer_bunny/hop": lambda: thump(0.12, 300, 150, 0.4) * 0.6,
    "entity/killer_bunny/warning": lambda: creature_vocal(380, 300, 0.7, (800, 3500), 0.6, 0.06),
    "entity/killer_bunny/attack": lambda: squeak(900, 500, 0.25) + thump(0.2, 250, 100, 0.5),
    "entity/killer_bunny/hurt": lambda: squeak(1200, 1500, 0.2),
    "entity/killer_bunny/death": lambda: squeak(1400, 400, 0.6),
    # ---------------------------------------------------------------- ruby blocks
    "block/ruby/break": lambda: stone_hit(0.35, 2600) + 0.5 * chime(1760, 0.35, tau=0.12),
    "block/ruby/step": lambda: stone_hit(0.12, 3000) * 0.6,
    "block/ruby/place": lambda: stone_hit(0.25, 2200) + 0.3 * chime(1318, 0.25, tau=0.1),
    "block/ruby/hit": lambda: stone_hit(0.15, 2800) * 0.7,
    "block/ruby/fall": lambda: stone_hit(0.2, 2000) * 0.8,
    # ---------------------------------------------------------------- ancient devices
    "block/event_sensor/activate": lambda: chime(880, 0.8, tau=0.3) + 0.6 * chime(1320, 0.8, tau=0.25),
    "block/reactor/activate": lambda: sweep(60, 220, 1.6, "saw") * env(int(1.6 * SR), 0.4, 0.3, 0.6, 0.5) * 0.4 + 0.5 * chime(440, 1.6, tau=0.8),
    "block/reactor/shutdown": lambda: sweep(220, 50, 1.4, "saw") * env(int(1.4 * SR), 0.02, 0.3, 0.5, 0.9) * 0.4,
    "block/reactor/pulse": lambda: tone(110, 0.35, (1, 0.5, 0.25)) * exp_decay(int(0.35 * SR), 0.1) + 0.3 * chime(660, 0.35, tau=0.08),
    "block/runic_logic/input": lambda: chime(660, 0.4, tau=0.12),
    "block/runic_logic/output": lambda: chime(660, 0.7, tau=0.25) + chime(990, 0.7, tau=0.25) * 0.7,
    "block/runic_logic/reset": lambda: chime(990, 0.4, tau=0.1) * 0.5 + chime(660, 0.4, tau=0.1) * 0.5,
    "block/mechanism/fail": lambda: sweep(300, 120, 0.5, "square") * env(int(0.5 * SR), 0.01, 0.1, 0.5, 0.2) * 0.3 + stone_hit(0.5, 400) * 0.4,
    "block/ancient_door/open": lambda: lp(noise(int(1.2 * SR)), 500) * env(int(1.2 * SR), 0.2, 0.3, 0.7, 0.4) + 0.5 * thump(1.2, 50, 30, 0.2),
    "block/ancient_door/close": lambda: lp(noise(int(0.9 * SR)), 400) * env(int(0.9 * SR), 0.1, 0.2, 0.6, 0.3) + thump(0.9, 70, 30, 0.6),
    "block/dart_trap/fire": lambda: thump(0.12, 600, 200, 0.2) + whoosh(0.35, 2000, 8000) * 0.7,
    "block/spike_trap/extend": lambda: stone_hit(0.3, 1800) + bp(noise(int(0.3 * SR)), 2000, 8000) * exp_decay(int(0.3 * SR), 0.05),
    "block/locked_chest/unlock": lambda: np.concatenate([stone_hit(0.15, 3200), np.zeros(int(0.08 * SR)), stone_hit(0.2, 2400)]),
    "block/ancient_altar/activate": lambda: reverb(sum(chime(f, 3.0, tau=1.2) for f in (220, 330, 440)) * 0.5 + roar(3.0, 55, 700) * 0.4, 0.5, 1.5),
    # ---------------------------------------------------------------- items
    "item/quiver/insert": lambda: lp(noise(int(0.25 * SR)), 2500) * env(int(0.25 * SR), 0.01, 0.05, 0.5, 0.15),
    "item/quiver/remove": lambda: lp(noise(int(0.3 * SR)), 1800) * env(int(0.3 * SR), 0.02, 0.05, 0.6, 0.2),
    "item/journal/open": lambda: hp(noise(int(0.4 * SR)), 1500) * env(int(0.4 * SR), 0.05, 0.1, 0.4, 0.2) * 0.5,
    "item/relic/use": lambda: reverb(chime(523, 1.2, tau=0.5) + chime(784, 1.2, tau=0.5), 0.4),
    "item/dragon_device/activate": lambda: reverb(sweep(80, 400, 1.5, "saw") * env(int(1.5 * SR), 0.3, 0.3, 0.6, 0.6) * 0.3 + chime(392, 1.5), 0.5),
    # ---------------------------------------------------------------- events
    "event/dragon_encounter": lambda: reverb(roar(3.5, 52, 1200), 0.6, 1.8),
    "event/rare_discovery": lambda: reverb(sum(chime(f, 2.0, tau=0.9) * a for f, a in ((523, 1), (659, 0.8), (784, 0.7), (1046, 0.5))), 0.5),
    "event/ancient_disturbance": lambda: reverb(lp(noise(int(3 * SR)), 120) * env(int(3 * SR), 0.5, 0.5, 0.8, 1.2) * 2 + chime(110, 3.0, tau=1.5) * 0.5, 0.4, 1.5),
    "event/village_alarm": lambda: np.concatenate([chime(880, 0.45, tau=0.25), chime(1175, 0.45, tau=0.25), chime(880, 0.8, tau=0.35)]),
    "event/illager_expedition": lambda: reverb(tone(196, 2.0, (1, 0.6, 0.4, 0.2), vib=0.004) * env(int(2 * SR), 0.2, 0.4, 0.7, 0.8) * 0.6, 0.5),
    "event/boss_phase": lambda: reverb(thump(1.5, 90, 30, 0.8) + roar(1.5, 60, 1200) * 0.6, 0.5),
    "event/boss_victory": lambda: reverb(sum(chime(f, 3.5, tau=1.5) * a for f, a in ((392, 1), (494, 0.8), (587, 0.8), (784, 0.6))), 0.6, 1.4),
    "event/story_discovery": lambda: reverb(chime(659, 1.4, tau=0.6) + chime(988, 1.4, tau=0.5) * 0.6, 0.45),
}

# =========================================================================== copper horns

HORN_ROOTS = [196.0, 220.0, 246.9, 261.6, 293.7, 329.6, 174.6, 207.7, 233.1, 277.2]
HORN_INTERVALS = {"melody": [0, 4, 7, 12], "harmony": [7, 12, 16, 19], "bass": [-12, -5, 0]}


@signal
def horn(root, part, idx):
    seq = HORN_INTERVALS[part]
    rot = idx % len(seq)
    notes = seq[rot:] + seq[:rot]
    dur_each = 0.55 if part != "bass" else 0.75
    out = np.zeros(int(SR * (dur_each * len(notes) + 0.6)))
    for i, semis in enumerate(notes):
        f = root * 2 ** (semis / 12)
        d = dur_each + 0.25
        n = int(d * SR)
        brass = saw(f, d, vib=0.006, vib_rate=5.2)
        brass = lp(brass, 1200 + 900 * (part == "harmony")) + 0.25 * bp(brass, 900, 2400)
        brass *= env(n, 0.06, 0.12, 0.75, 0.2)
        mix_at(out, brass, i * dur_each, 0.8)
    return reverb(out, 0.35, 1.3)


# =========================================================================== music

SCALES = {
    "minor": [0, 2, 3, 5, 7, 8, 10], "dorian": [0, 2, 3, 5, 7, 9, 10], "phrygian": [0, 1, 3, 5, 7, 8, 10],
    "lydian": [0, 2, 4, 6, 7, 9, 11], "major": [0, 2, 4, 5, 7, 9, 11], "harmonic": [0, 2, 3, 5, 7, 8, 11],
}


def midi(n):
    return 440.0 * 2 ** ((n - 69) / 12)


@signal
def pad(freq, dur, bright=1400):
    n = int(dur * SR)
    x = saw(freq, dur, detune=0.006) + 0.5 * saw(freq * 2, dur, detune=0.004)
    return lp(x, bright) * env(n, min(1.5, dur * 0.3), 0.5, 0.8, min(1.5, dur * 0.3)) * 0.25


@signal
def pluck(freq, dur=1.2, bright=1.0):
    n = int(dur * SR)
    t = secs(dur)
    x = sum((0.6 ** (k - 1)) * np.sin(2 * np.pi * freq * k * t) * exp_decay(n, 0.5 / k ** bright) for k in range(1, 6))
    return x * env(n, 0.003, 0.05, 1.0, 0.05) * 0.35


@signal
def bell(freq, dur=2.0):
    return chime(freq, dur, ((1, 1.0), (2.0, 0.4), (3.01, 0.25), (4.2, 0.15)), tau=0.9) * 0.3


@signal
def bass(freq, dur):
    n = int(dur * SR)
    return (np.sin(2 * np.pi * freq * secs(dur)) + 0.3 * lp(saw(freq, dur), 400)) * env(n, 0.02, 0.2, 0.7, 0.2) * 0.45


@signal
def kick():
    return sweep(150, 45, 0.3) * exp_decay(int(0.3 * SR), 0.09) * 0.9


@signal
def snare():
    n = int(0.25 * SR)
    return (bp(noise(n), 800, 6000) * 0.6 + np.sin(2 * np.pi * 190 * secs(0.25)) * 0.4) * exp_decay(n, 0.06) * 0.6


@signal
def hat():
    n = int(0.08 * SR)
    return hp(noise(n), 7000) * exp_decay(n, 0.015) * 0.25


def compose(spec, seed):
    rng = np.random.default_rng(seed)
    bpm, length = spec["bpm"], spec["length"]
    beat = 60.0 / bpm
    bar = beat * 4
    root, scale = spec["root"], SCALES[spec["scale"]]
    prog = spec["prog"]
    out = np.zeros(int(SR * (length + 4)))
    bars = int(length / bar)

    def degree(d, octave=0):
        return root + scale[d % 7] + 12 * (d // 7) + 12 * octave

    melody_inst = {"pluck": pluck, "bell": bell}[spec["lead"]]
    prev = 7
    for b in range(bars):
        t0 = b * bar
        chord_deg = prog[(b // 2) % len(prog)]
        section = b / max(1, bars)
        intro = b < 2
        outro = b >= bars - 2
        # pad chord every 2 bars
        if b % 2 == 0:
            for k in (0, 2, 4):
                mix_at(out, pad(midi(degree(chord_deg + k)), bar * 2 + 0.5, spec.get("pad_bright", 1400)), t0, 0.9)
        if spec.get("drone"):
            if b % 4 == 0:
                mix_at(out, pad(midi(root - 12), bar * 4 + 0.5, 500), t0, 0.8)
        # bass
        if not intro and spec.get("bass", True):
            for q in range(0, 4, 2 if spec.get("drums") else 4):
                mix_at(out, bass(midi(degree(chord_deg, -2)), beat * (2 if spec.get("drums") else 4)), t0 + q * beat, 0.9)
        # melody: random walk favouring chord tones, rests for breathing room
        if not intro and not outro:
            density = spec.get("density", 0.5) * (1.2 if 0.4 < section < 0.75 else 1.0)
            step = beat / 2
            for s in range(8):
                if rng.random() > density:
                    continue
                move = rng.choice([-2, -1, 1, 2, 0, 3, -3], p=[0.18, 0.24, 0.24, 0.16, 0.06, 0.06, 0.06])
                prev = int(np.clip(prev + move, 3, 13))
                if rng.random() < 0.35:
                    prev = chord_deg + rng.choice([0, 2, 4, 7])
                d = step * rng.choice([1, 2, 3])
                mix_at(out, melody_inst(midi(degree(prev, 1)), max(0.8, d * 2)), t0 + s * step, 0.8)
        # percussion for combat themes
        if spec.get("drums") and not intro:
            for q in range(4):
                if q % 2 == 0:
                    mix_at(out, kick(), t0 + q * beat, 1.0)
                else:
                    mix_at(out, snare(), t0 + q * beat, 0.8)
                mix_at(out, hat(), t0 + q * beat + beat / 2, 1.0)
            if spec["drums"] == "heavy" and b % 2 == 1:
                mix_at(out, kick(), t0 + 3.5 * beat, 0.8)
    out = reverb(out, spec.get("wet", 0.3), 1.4)
    out = out[: int(SR * (bars * bar + 3))]
    fade_in, fade_out = int(SR * 2.5), int(SR * 4)
    out[:fade_in] *= np.linspace(0, 1, fade_in)
    out[-fade_out:] *= np.linspace(1, 0, fade_out)
    return finish(out, -6.0, 0.0, max_rms=0.18)


MUSIC = {
    # name: spec (disc mapping documented in docs/ASSETS_AND_AUDIO.md)
    "ruins": dict(bpm=72, length=96, root=57, scale="dorian", prog=[0, 3, 5, 4], lead="pluck", density=0.45, wet=0.35),
    "dragon": dict(bpm=96, length=92, root=50, scale="phrygian", prog=[0, 1, 0, 6], lead="pluck", density=0.55, drums="light", wet=0.25),
    "dragon_boss": dict(bpm=132, length=100, root=50, scale="harmonic", prog=[0, 5, 3, 4], lead="pluck", density=0.7, drums="heavy", wet=0.2, pad_bright=2200),
    "mechanism": dict(bpm=84, length=88, root=62, scale="lydian", prog=[0, 1, 4, 3], lead="bell", density=0.5, wet=0.35),
    "far_lands": dict(bpm=64, length=110, root=55, scale="lydian", prog=[0, 4, 5, 1], lead="bell", density=0.3, drone=True, wet=0.45),
    "illusioner": dict(bpm=88, length=90, root=58, scale="harmonic", prog=[0, 3, 4, 0], lead="bell", density=0.5, drums="light", wet=0.4),
    "giant": dict(bpm=76, length=92, root=45, scale="minor", prog=[0, 5, 6, 4], lead="pluck", density=0.4, drums="heavy", wet=0.25, pad_bright=900),
    "story": dict(bpm=68, length=104, root=60, scale="major", prog=[0, 5, 3, 4], lead="pluck", density=0.4, wet=0.4),
    "underground": dict(bpm=58, length=112, root=48, scale="phrygian", prog=[0, 1, 5, 0], lead="bell", density=0.25, drone=True, wet=0.5, pad_bright=700),
}

DISCS = {  # disc -> (music file, comparator output)
    "ancient_echoes": ("ruins", 3),
    "dragons_omen": ("dragon", 6),
    "far_beyond": ("far_lands", 9),
    "forgotten_civilization": ("story", 12),
    "ruby_resonance": ("mechanism", 14),
    "illusion": ("illusioner", 4),
    "the_last_monolith": ("underground", 1),
}


# =========================================================================== catalogue

def event_id(path):
    """'entity/red_dragon/ambient' -> 'entity.red_dragon.ambient'."""
    return path.replace("/", ".")


def main():
    sounds = {}
    durations = {}
    for path, fn in SFX.items():
        x = finish(np.asarray(fn(), dtype=float), -3.0, 0.005)
        durations[path] = write_ogg(path, x, quality=3)
        sounds[event_id(path)] = {"sounds": [{"name": f"lostfeatures:{path}"}],
                                  "subtitle": f"subtitles.lostfeatures.{event_id(path)}"}
    for part in ("melody", "harmony", "bass"):
        for i, root in enumerate(HORN_ROOTS):
            path = f"item/copper_horn/{part}_{i}"
            x = finish(horn(root, part, i), -2.0, 0.01)
            durations[path] = write_ogg(path, x, quality=3)
            sounds[f"item.copper_horn.{part}.{i}"] = {"sounds": [{"name": f"lostfeatures:{path}", "attenuation_distance": 64}],
                                                     "subtitle": "subtitles.lostfeatures.item.copper_horn"}
    catalog_path = os.path.join(ROOT, "tools", "assetgen", "audio_catalog.json")
    previous = json.load(open(catalog_path)) if os.path.exists(catalog_path) else {}
    for i, (name, spec) in enumerate(MUSIC.items()):
        if "--sfx-only" in sys.argv and "music/" + name in previous:
            durations["music/" + name] = previous["music/" + name]
        else:
            print("composing", name)
            x = compose(spec, 1000 + i)
            durations["music/" + name] = write_ogg("music/" + name, x, quality=3)
        sounds["music." + name] = {"sounds": [{"name": f"lostfeatures:music/{name}", "stream": True}]}
    jukebox_dir = os.path.join(DATA, "jukebox_song")
    os.makedirs(jukebox_dir, exist_ok=True)
    for disc, (track, comparator) in DISCS.items():
        sounds["music_disc." + disc] = {"sounds": [{"name": f"lostfeatures:music/{track}", "stream": True}]}
        json.dump({"comparator_output": comparator,
                   "description": {"translate": f"jukebox_song.lostfeatures.{disc}"},
                   "length_in_seconds": round(durations["music/" + track], 1),
                   "sound_event": f"lostfeatures:music_disc.{disc}"},
                  open(os.path.join(jukebox_dir, disc + ".json"), "w"), indent=2)
    with open(os.path.join(ASSETS, "sounds.json"), "w") as f:
        json.dump(dict(sorted(sounds.items())), f, indent=2)
    with open(os.path.join(ROOT, "tools", "assetgen", "audio_catalog.json"), "w") as f:
        json.dump({k: round(v, 2) for k, v in sorted(durations.items())}, f, indent=2)
    print(f"{len(sounds)} sound events, {len(durations)} files")


if __name__ == "__main__":
    main()
