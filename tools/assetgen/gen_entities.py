"""Generates entity textures and the box-model layer code for Lost Features creatures.

Outputs:
  assets/lostfeatures/textures/entity/{red_dragon,ancestral_red_dragon,killer_bunny,giant,illusioner}.png
  src/main/java/com/lostfeatures/client/model/{RedDragonModel,KillerBunnyModel}.java (layer code)
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

from boxmodel import Box, Part, faces, java_layer, pack  # noqa: E402
from pixel import ROOT, Canvas, hex_rgb, mix, shade  # noqa: E402

JAVA_DIR = os.path.join(ROOT, "src", "main", "java", "com", "lostfeatures", "client", "model")


# ----------------------------------------------------------------------------------- Red Dragon

def red_dragon() -> Part:
    root = Part("root")
    body = root.child(Part("body", (0, 6, 0)))
    body.box("body", (-10, -8, -18), (20, 16, 36))
    for i in range(4):
        body.box("spike", (-1, -11, -13 + i * 8), (2, 3, 3))
    neck = body.child(Part("neck", (0, -2, -18), (-0.45, 0, 0)))
    neck.box("neck", (-4, -4, -12), (8, 8, 12))
    neck2 = neck.child(Part("neck2", (0, 0, -11), (0.25, 0, 0)))
    neck2.box("neck", (-3.5, -3.5, -10), (7, 7, 10))
    head = neck2.child(Part("head", (0, 0, -9), (0.2, 0, 0)))
    head.box("head", (-6, -5, -12), (12, 8, 12))
    head.box("snout", (-4, -3, -20), (8, 5, 8))
    horn_l = head.child(Part("left_horn", (3.5, -4, -2), (0.55, 0.15, 0)))
    horn_l.box("horn", (-1, -1, 0), (2, 2, 9))
    horn_r = head.child(Part("right_horn", (-3.5, -4, -2), (0.55, -0.15, 0)))
    horn_r.box("horn", (-1, -1, 0), (2, 2, 9))
    jaw = head.child(Part("jaw", (0, 3, -11)))
    jaw.box("jaw", (-3.5, 0, -9), (7, 2, 9))
    tail1 = body.child(Part("tail1", (0, -3, 17), (-0.15, 0, 0)))
    tail1.box("tail", (-5, -4, 0), (10, 8, 14))
    tail2 = tail1.child(Part("tail2", (0, 0, 13), (0.1, 0, 0)))
    tail2.box("tail", (-3.5, -3, 0), (7, 6, 14))
    tail3 = tail2.child(Part("tail3", (0, 0, 13), (0.05, 0, 0)))
    tail3.box("tail", (-2, -2, 0), (4, 4, 14))
    tail3.box("tailfin", (-4, -0.5, 9), (8, 1, 6))
    lw = body.child(Part("left_wing", (9, -6, -10)))
    lw.box("wingbone", (0, -1.5, -1.5), (28, 3, 3))
    lw.box("membrane", (0, 0, 1), (28, 0, 24))
    lwt = lw.child(Part("left_wing_tip", (28, 0, 0)))
    lwt.box("wingbone", (0, -1, -1), (26, 2, 2))
    lwt.box("membrane", (0, 0, 1), (26, 0, 22))
    rw = body.child(Part("right_wing", (-9, -6, -10)))
    rw.box("wingbone", (-28, -1.5, -1.5), (28, 3, 3))
    rw.box("membrane", (-28, 0, 1), (28, 0, 24))
    rwt = rw.child(Part("right_wing_tip", (-28, 0, 0)))
    rwt.box("wingbone", (-26, -1, -1), (26, 2, 2))
    rwt.box("membrane", (-26, 0, 1), (26, 0, 22))
    for name, x, z, size, oy in (("front_left_leg", 8, -11, (6, 12, 6), -1), ("front_right_leg", -8, -11, (6, 12, 6), -1),
                                  ("hind_left_leg", 8, 12, (7, 13, 8), -2), ("hind_right_leg", -8, 12, (7, 13, 8), -2)):
        leg = root.child(Part(name, (x, 13, z)))
        w, h, d = size
        leg.box("leg", (-w / 2, oy, -d / 2), size)
    return root


def paint_dragon(root: Part, tw: int, th: int, palette: dict, seed: int) -> Canvas:
    c = Canvas(tw, th, seed)
    scale_dark, scale, scale_light = palette["dark"], palette["base"], palette["light"]
    belly, accent, bone, eye = palette["belly"], palette["accent"], palette["bone"], palette["eye"]
    for part, box, face, x0, y0, w, h in faces(root):
        if w <= 0 or h <= 0:
            continue
        hint = box.name
        if hint in ("body", "neck", "tail", "head", "snout", "leg", "wingbone"):
            if face == "bottom" and hint not in ("wingbone",):
                # belly plates: horizontal bands
                for yy in range(h):
                    band = belly if (yy // 2) % 2 == 0 else shade(belly, 0.86)
                    c.noise_rect(x0, y0 + yy, w, 1, band, 0.05)
            else:
                base = scale_dark if face == "top" else scale
                c.noise_rect(x0, y0, w, h, base, 0.08)
                # staggered scale pattern
                for yy in range(h):
                    for xx in range(w):
                        if (xx + (yy // 2) * 2) % 4 == 0 and yy % 2 == 0:
                            c.set(x0 + xx, y0 + yy, shade(base, 0.72))
                        elif (xx + (yy // 2) * 2) % 4 == 2 and yy % 2 == 1:
                            c.set(x0 + xx, y0 + yy, scale_light)
                if face == "top" and hint in ("body", "tail", "neck"):
                    mid = x0 + w // 2
                    for yy in range(h):
                        c.set(mid, y0 + yy, accent)
                        c.set(mid - 1, y0 + yy, shade(accent, 0.8))
            if hint == "leg" and face in ("front", "back", "left", "right"):
                # claws at the bottom row
                for xx in range(0, w, 2):
                    c.set(x0 + xx, y0 + h - 1, bone)
            if hint == "head" and face in ("left", "right"):
                # eyes near the front of the head sides, slit pupil
                ex = x0 + (1 if face == "right" else w - 3)
                ey = y0 + 2
                c.rect(ex, ey, 2, 2, eye)
                c.set(ex + (1 if face == "right" else 0), ey, shade(eye, 0.4))
                c.set(ex + (1 if face == "right" else 0), ey + 1, shade(eye, 0.4))
                c.rect(ex - 1 if face == "right" else ex, ey - 1, 3, 1, scale_dark)
            if hint == "snout" and face == "front":
                c.set(x0 + 1, y0 + 1, (25, 10, 10))
                c.set(x0 + w - 2, y0 + 1, (25, 10, 10))
                for xx in range(w):
                    if xx % 2 == 0:
                        c.set(x0 + xx, y0 + h - 1, bone)
        elif hint == "jaw":
            if face == "top":
                c.noise_rect(x0, y0, w, h, (120, 30, 40), 0.1)
                for yy in range(h):
                    c.set(x0, y0 + yy, bone)
                    c.set(x0 + w - 1, y0 + yy, bone)
            else:
                c.noise_rect(x0, y0, w, h, belly if face == "bottom" else scale, 0.08)
                if face in ("front", "left", "right"):
                    for xx in range(0, w, 2):
                        c.set(x0 + xx, y0, bone)
        elif hint in ("horn", "spike"):
            for yy in range(h):
                for xx in range(w):
                    t = yy / max(1, h - 1)
                    c.set(x0 + xx, y0 + yy, mix(bone, shade(bone, 0.55), t if face != "top" else 0.2))
        elif hint == "tailfin":
            c.noise_rect(x0, y0, w, h, accent, 0.1)
        elif hint == "membrane":
            mem = palette["membrane"]
            c.noise_rect(x0, y0, w, h, mem, 0.06)
            # veins radiating along the wing
            for k in range(1, 5):
                vx = x0 + int(w * k / 5)
                for yy in range(h):
                    c.set(vx + (yy // 6), y0 + yy, shade(mem, 0.6))
            for xx in range(w):
                c.set(x0 + xx, y0, shade(mem, 0.5))
                c.set(x0 + xx, y0 + h - 1, shade(mem, 0.5))
    return c


DRAGON_PALETTES = {
    "red_dragon": dict(dark=hex_rgb("6e1414"), base=hex_rgb("9c2018"), light=hex_rgb("c8442a"), belly=hex_rgb("d89a4a"),
                       accent=hex_rgb("f0b030"), bone=hex_rgb("e8dcc0"), eye=hex_rgb("ffd23c"), membrane=hex_rgb("b8442c")),
    "ancestral_red_dragon": dict(dark=hex_rgb("3c0a10"), base=hex_rgb("5e1018"), light=hex_rgb("8e2a22"), belly=hex_rgb("b88a3a"),
                                 accent=hex_rgb("ffd75a"), bone=hex_rgb("f4e6b0"), eye=hex_rgb("ff6a1a"), membrane=hex_rgb("7a2a22")),
}


# --------------------------------------------------------------------------------- Killer Bunny

def killer_bunny() -> Part:
    root = Part("root")
    body = root.child(Part("body", (0, 19, 2)))
    body.box("fur", (-3, -3, -4), (6, 5, 8))
    head = root.child(Part("head", (0, 16.5, -2)))
    head.box("head", (-2.5, -4, -5), (5, 4, 5))
    le = head.child(Part("left_ear", (1.2, -4, -2.5), (-0.15, 0, 0.15)))
    le.box("ear", (-1, -5, -0.5), (2, 5, 1))
    re = head.child(Part("right_ear", (-1.2, -4, -2.5), (-0.15, 0, -0.15)))
    re.box("ear", (-1, -5, -0.5), (2, 5, 1))
    for name, x, z in (("front_left_leg", 1.8, -1.5), ("front_right_leg", -1.8, -1.5)):
        leg = root.child(Part(name, (x, 21, z)))
        leg.box("paw", (-1, 0, -1), (2, 3, 2))
    for name, x in (("hind_left_leg", 2.2), ("hind_right_leg", -2.2)):
        leg = root.child(Part(name, (x, 21, 4)))
        leg.box("foot", (-1, 0, -3), (2, 3, 5))
    tail = root.child(Part("tail", (0, 17, 6)))
    tail.box("tail", (-1.5, -1.5, 0), (3, 3, 2))
    return root


def paint_bunny(root: Part, tw: int, th: int) -> Canvas:
    c = Canvas(tw, th, 77)
    white = hex_rgb("f2f0ec")
    grey = hex_rgb("cfc8c0")
    for part, box, face, x0, y0, w, h in faces(root):
        if w <= 0 or h <= 0:
            continue
        c.palette_rect(x0, y0, w, h, [white, white, white, grey], None)
        if box.name == "ear" and face in ("front",):
            c.rect(x0, y0 + 1, w, h - 1, hex_rgb("e8a0a8"))
        if box.name == "head" and face == "front":
            # red eyes and a blood-stained mouth
            c.set(x0, y0 + 1, hex_rgb("d01010"))
            c.set(x0 + w - 1, y0 + 1, hex_rgb("d01010"))
            c.set(x0 + w // 2, y0 + 2, hex_rgb("e8a0a8"))
            c.rect(x0 + 1, y0 + h - 1, w - 2, 1, hex_rgb("8a0c0c"))
        if box.name == "head" and face in ("left", "right"):
            c.set(x0 + (0 if face == "right" else w - 1), y0 + 1, hex_rgb("d01010"))
        if box.name in ("paw", "foot") and face in ("front", "bottom"):
            c.rect(x0, y0 + h - 1, w, 1, hex_rgb("9a1a1a"))
    return c


# ------------------------------------------------------------------ Giant (vanilla humanoid UVs)

def humanoid_boxes():
    head = Box("head", (0, 0, 0), (8, 8, 8), uv=(0, 0))
    hat = Box("hat", (0, 0, 0), (8, 8, 8), uv=(32, 0))
    body = Box("body", (0, 0, 0), (8, 12, 4), uv=(16, 16))
    arm = Box("arm", (0, 0, 0), (4, 12, 4), uv=(40, 16))
    leg = Box("leg", (0, 0, 0), (4, 12, 4), uv=(0, 16))
    p = Part("root")
    p.boxes = [head, hat, body, arm, leg]
    return p


def paint_giant() -> Canvas:
    c = Canvas(64, 64, 12)
    skin, skin_dark = hex_rgb("b08a68"), hex_rgb("8a6a4e")
    tunic, tunic_dark = hex_rgb("6a4a2a"), hex_rgb("4c3420")
    beard = hex_rgb("6e6a64")
    belt = hex_rgb("3a2a1a")
    for part, box, face, x0, y0, w, h in faces(humanoid_boxes()):
        if box.name == "hat":
            # transparent overlay except a stone circlet on the sides
            if face in ("front", "left", "right", "back"):
                c.rect(x0, y0 + 1, w, 1, hex_rgb("8a8a80"))
                c.set(x0 + w // 2, y0 + 1, hex_rgb("c8402a"))
            continue
        if box.name == "head":
            c.noise_rect(x0, y0, w, h, skin, 0.08)
            if face == "top":
                c.noise_rect(x0, y0, w, h, beard, 0.15)
            if face == "front":
                c.rect(x0 + 1, y0 + 3, 2, 1, hex_rgb("2a2a2a"))
                c.rect(x0 + 5, y0 + 3, 2, 1, hex_rgb("2a2a2a"))
                c.set(x0 + 2, y0 + 3, hex_rgb("e0d8a0"))
                c.set(x0 + 5, y0 + 3, hex_rgb("e0d8a0"))
                c.rect(x0 + 1, y0 + 2, 6, 1, skin_dark)
                c.noise_rect(x0, y0 + 5, w, 3, beard, 0.15)
                c.rect(x0 + 3, y0 + 4, 2, 1, skin_dark)
            if face in ("left", "right", "back"):
                c.noise_rect(x0, y0, w, 3, beard, 0.15)
        elif box.name == "body":
            c.noise_rect(x0, y0, w, h, tunic, 0.12)
            if face in ("front", "back", "left", "right"):
                c.rect(x0, y0 + 7, w, 1, belt)
                if face == "front":
                    c.set(x0 + w // 2, y0 + 7, hex_rgb("c8402a"))
                    c.noise_rect(x0 + 2, y0, w - 4, 2, skin, 0.08)
                for xx in range(0, w, 3):
                    c.set(x0 + xx, y0 + h - 1, tunic_dark)
        elif box.name == "arm":
            c.noise_rect(x0, y0, w, h, skin, 0.1)
            if face in ("front", "back", "left", "right"):
                c.noise_rect(x0, y0, w, 4, tunic, 0.12)
                c.rect(x0, y0 + 8, w, 1, hex_rgb("5a4a3a"))
        elif box.name == "leg":
            c.noise_rect(x0, y0, w, h, tunic_dark, 0.12)
            if face in ("front", "back", "left", "right"):
                c.noise_rect(x0, y0 + 9, w, 3, hex_rgb("3a2818"), 0.1)
    return c


# ------------------------------------------------------------- Illusioner (vanilla illager UVs)

def illager_boxes():
    p = Part("root")
    p.boxes = [Box("head", (0, 0, 0), (8, 10, 8), uv=(0, 0)), Box("hat", (0, 0, 0), (8, 12, 8), uv=(32, 0)),
               Box("nose", (0, 0, 0), (2, 4, 2), uv=(24, 0)), Box("body", (0, 0, 0), (8, 12, 6), uv=(16, 20)),
               Box("robe", (0, 0, 0), (8, 20, 6), uv=(0, 38)), Box("arms_side", (0, 0, 0), (4, 8, 4), uv=(44, 22)),
               Box("arms_mid", (0, 0, 0), (8, 4, 4), uv=(40, 38)), Box("leg", (0, 0, 0), (4, 12, 4), uv=(0, 22)),
               Box("arm", (0, 0, 0), (4, 12, 4), uv=(40, 46))]
    return p


def paint_illusioner() -> Canvas:
    c = Canvas(64, 64, 31)
    skin = hex_rgb("9aa6a8")
    robe, robe_dark, trim = hex_rgb("2a3a7a"), hex_rgb("1c2656"), hex_rgb("b8a0ff")
    for part, box, face, x0, y0, w, h in faces(illager_boxes()):
        n = box.name
        if n == "head":
            c.noise_rect(x0, y0, w, h, skin, 0.06)
            if face == "front":
                c.rect(x0, y0 + 3, w, 1, hex_rgb("3a3a44"))
                c.set(x0 + 1, y0 + 4, hex_rgb("d0c0ff"))
                c.set(x0 + 2, y0 + 4, hex_rgb("6040c0"))
                c.set(x0 + 5, y0 + 4, hex_rgb("6040c0"))
                c.set(x0 + 6, y0 + 4, hex_rgb("d0c0ff"))
                c.rect(x0 + 2, y0 + 8, 4, 1, hex_rgb("6a7476"))
            if face == "top":
                c.noise_rect(x0, y0, w, h, robe_dark, 0.1)
        elif n == "hat":
            # hood overlay: only the top and back/sides, face left open
            if face in ("top", "back", "left", "right"):
                c.noise_rect(x0, y0, w, min(h, 6) if face != "top" else h, robe, 0.08)
            if face == "front":
                c.rect(x0, y0, w, 2, robe)
                c.set(x0 + w // 2, y0 + 1, trim)
        elif n == "nose":
            c.noise_rect(x0, y0, w, h, shade(skin, 0.9), 0.05)
        elif n in ("body", "robe"):
            c.noise_rect(x0, y0, w, h, robe, 0.08)
            if face in ("front", "back"):
                mid = x0 + w // 2
                for yy in range(h):
                    c.set(mid, y0 + yy, trim if yy % 3 else robe_dark)
                    c.set(mid - 1, y0 + yy, robe_dark)
            if face in ("front", "back", "left", "right"):
                c.rect(x0, y0 + h - 1, w, 1, trim)
        elif n in ("arms_side", "arms_mid", "arm"):
            c.noise_rect(x0, y0, w, h, robe, 0.08)
            if face in ("front", "bottom"):
                c.rect(x0, y0 + h - 2, w, 2, skin)
            c.rect(x0, y0, w, 1, trim)
        elif n == "leg":
            c.noise_rect(x0, y0, w, h, robe_dark, 0.08)
            c.rect(x0, y0 + h - 2, w, 2, hex_rgb("2a2a30"))
    return c


# ----------------------------------------------------------------------------------- Java output

DRAGON_JAVA = '''package com.lostfeatures.client.model;

import com.lostfeatures.client.renderer.RedDragonRenderState;
import net.minecraft.client.model.EntityModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.util.Mth;

/**
 * Original Red Dragon model. The layer definition below is GENERATED by tools/assetgen/gen_entities.py
 * together with the texture, so UVs and texture always match; edit the generator, not this method.
 * Animations are procedural and driven only by synched render state.
 */
public class RedDragonModel extends EntityModel<RedDragonRenderState> {
    private final ModelPart body;
    private final ModelPart neck;
    private final ModelPart neck2;
    private final ModelPart head;
    private final ModelPart jaw;
    private final ModelPart tail1;
    private final ModelPart tail2;
    private final ModelPart tail3;
    private final ModelPart leftWing;
    private final ModelPart leftWingTip;
    private final ModelPart rightWing;
    private final ModelPart rightWingTip;
    private final ModelPart frontLeftLeg;
    private final ModelPart frontRightLeg;
    private final ModelPart hindLeftLeg;
    private final ModelPart hindRightLeg;

    public RedDragonModel(ModelPart root) {
        super(root);
        this.body = root.getChild("body");
        this.neck = body.getChild("neck");
        this.neck2 = neck.getChild("neck2");
        this.head = neck2.getChild("head");
        this.jaw = head.getChild("jaw");
        this.tail1 = body.getChild("tail1");
        this.tail2 = tail1.getChild("tail2");
        this.tail3 = tail2.getChild("tail3");
        this.leftWing = body.getChild("left_wing");
        this.leftWingTip = leftWing.getChild("left_wing_tip");
        this.rightWing = body.getChild("right_wing");
        this.rightWingTip = rightWing.getChild("right_wing_tip");
        this.frontLeftLeg = root.getChild("front_left_leg");
        this.frontRightLeg = root.getChild("front_right_leg");
        this.hindLeftLeg = root.getChild("hind_left_leg");
        this.hindRightLeg = root.getChild("hind_right_leg");
    }

    @SuppressWarnings("unused")
    public static LayerDefinition createBodyLayer() {
%LAYER%
    }

    @Override
    public void setupAnim(RedDragonRenderState state) {
        super.setupAnim(state);
        float t = state.ageInTicks;
        float walk = state.walkAnimationPos;
        float walkSpeed = Math.min(state.walkAnimationSpeed, 1.0F);

        // Head look, limited so the long neck never folds through the body.
        float lookY = Mth.clamp(state.yRot, -45.0F, 45.0F) * Mth.DEG_TO_RAD;
        float lookX = Mth.clamp(state.xRot, -30.0F, 30.0F) * Mth.DEG_TO_RAD;
        neck.yRot = lookY * 0.4F;
        neck2.yRot = lookY * 0.3F;
        head.yRot = lookY * 0.3F;
        head.xRot += lookX * 0.5F;

        // Idle breathing and tail sway.
        float breathe = Mth.sin(t * 0.08F) * 0.04F;
        neck.xRot += breathe;
        tail1.yRot = Mth.sin(t * 0.07F) * 0.12F;
        tail2.yRot = Mth.sin(t * 0.07F - 0.6F) * 0.16F;
        tail3.yRot = Mth.sin(t * 0.07F - 1.2F) * 0.2F;

        // Jaw: half open while charging (telegraph), wide open while breathing fire.
        if (state.breathState == 2) {
            jaw.xRot = 0.65F + Mth.sin(t * 0.9F) * 0.05F;
            head.xRot += 0.15F;
        } else if (state.breathState == 1) {
            jaw.xRot = 0.3F;
            neck.xRot -= 0.2F;
        } else {
            jaw.xRot = Math.max(0.0F, Mth.sin(t * 0.05F)) * 0.06F;
        }

        if (state.flying) {
            float flap = Mth.sin(t * 0.32F);
            leftWing.zRot = -flap * 0.75F + 0.05F;
            rightWing.zRot = flap * 0.75F - 0.05F;
            leftWingTip.zRot = -Mth.sin(t * 0.32F - 0.7F) * 0.5F;
            rightWingTip.zRot = Mth.sin(t * 0.32F - 0.7F) * 0.5F;
            leftWing.yRot = 0.0F;
            rightWing.yRot = 0.0F;
            leftWingTip.yRot = 0.0F;
            rightWingTip.yRot = 0.0F;
            // Legs tucked back, tail streams behind.
            frontLeftLeg.xRot = 0.9F;
            frontRightLeg.xRot = 0.9F;
            hindLeftLeg.xRot = 1.1F;
            hindRightLeg.xRot = 1.1F;
            tail1.xRot += 0.15F;
            body.xRot = Mth.clamp(state.pitchHint, -0.35F, 0.35F);
        } else {
            // Wings folded along the flanks.
            leftWing.zRot = 1.15F;
            rightWing.zRot = -1.15F;
            leftWing.yRot = 1.0F;
            rightWing.yRot = -1.0F;
            leftWingTip.zRot = -2.6F;
            rightWingTip.zRot = 2.6F;
            leftWingTip.yRot = -0.2F;
            rightWingTip.yRot = 0.2F;
            body.xRot = 0.0F;
            // Quadruped gait: diagonal legs move together.
            float swing = Mth.cos(walk * 0.5F) * 0.8F * walkSpeed;
            frontLeftLeg.xRot = swing;
            hindRightLeg.xRot = swing;
            frontRightLeg.xRot = -swing;
            hindLeftLeg.xRot = -swing;
        }
    }
}
'''

BUNNY_JAVA = '''package com.lostfeatures.client.model;

import com.lostfeatures.client.renderer.KillerBunnyRenderState;
import net.minecraft.client.model.EntityModel;
import net.minecraft.client.model.geom.ModelPart;
import net.minecraft.client.model.geom.PartPose;
import net.minecraft.client.model.geom.builders.CubeListBuilder;
import net.minecraft.client.model.geom.builders.LayerDefinition;
import net.minecraft.client.model.geom.builders.MeshDefinition;
import net.minecraft.client.model.geom.builders.PartDefinition;
import net.minecraft.util.Mth;

/** Original Killer Bunny model. Layer code GENERATED by tools/assetgen/gen_entities.py. */
public class KillerBunnyModel extends EntityModel<KillerBunnyRenderState> {
    private final ModelPart body;
    private final ModelPart head;
    private final ModelPart leftEar;
    private final ModelPart rightEar;
    private final ModelPart frontLeftLeg;
    private final ModelPart frontRightLeg;
    private final ModelPart hindLeftLeg;
    private final ModelPart hindRightLeg;

    public KillerBunnyModel(ModelPart root) {
        super(root);
        this.body = root.getChild("body");
        this.head = root.getChild("head");
        this.leftEar = head.getChild("left_ear");
        this.rightEar = head.getChild("right_ear");
        this.frontLeftLeg = root.getChild("front_left_leg");
        this.frontRightLeg = root.getChild("front_right_leg");
        this.hindLeftLeg = root.getChild("hind_left_leg");
        this.hindRightLeg = root.getChild("hind_right_leg");
    }

    @SuppressWarnings("unused")
    public static LayerDefinition createBodyLayer() {
%LAYER%
    }

    @Override
    public void setupAnim(KillerBunnyRenderState state) {
        super.setupAnim(state);
        head.yRot = state.yRot * Mth.DEG_TO_RAD;
        head.xRot = state.xRot * Mth.DEG_TO_RAD;
        float hop = state.airborne ? 1.0F : 0.0F;
        float twitch = Mth.sin(state.ageInTicks * (state.aggressive ? 0.9F : 0.2F)) * 0.12F;
        leftEar.xRot = -0.15F + twitch - hop * 0.4F;
        rightEar.xRot = -0.15F - twitch - hop * 0.4F;
        float swing = Mth.cos(state.walkAnimationPos * 0.9F) * 0.6F * Math.min(1.0F, state.walkAnimationSpeed);
        frontLeftLeg.xRot = swing - hop * 0.7F;
        frontRightLeg.xRot = swing - hop * 0.7F;
        hindLeftLeg.xRot = -swing + hop * 0.9F;
        hindRightLeg.xRot = -swing + hop * 0.9F;
        body.xRot = -hop * 0.2F;
    }
}
'''


def write_java(template, root, tw, th, name):
    os.makedirs(JAVA_DIR, exist_ok=True)
    code = template.replace("%LAYER%", java_layer(root, tw, th))
    with open(os.path.join(JAVA_DIR, name), "w") as f:
        f.write(code)


def main():
    dragon = red_dragon()
    dh = pack(dragon, 256)
    for name, pal in DRAGON_PALETTES.items():
        paint_dragon(dragon, 256, dh, pal, sum(map(ord, name))).save("textures", "entity", name + ".png")
    write_java(DRAGON_JAVA, dragon, 256, dh, "RedDragonModel.java")

    bunny = killer_bunny()
    bh = pack(bunny, 64)
    paint_bunny(bunny, 64, max(bh, 32)).save("textures", "entity", "killer_bunny.png")
    write_java(BUNNY_JAVA, bunny, 64, max(bh, 32), "KillerBunnyModel.java")

    paint_giant().save("textures", "entity", "giant.png")
    paint_illusioner().save("textures", "entity", "illusioner.png")
    print(f"dragon texture 256x{dh}, bunny texture 64x{max(bh, 32)}")


if __name__ == "__main__":
    main()
