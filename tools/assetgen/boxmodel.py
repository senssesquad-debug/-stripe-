"""Box-model helpers shared by the entity model generators.

A model is a tree of parts. Each part has a pivot (PartPose offset), optional rotation, and boxes.
UVs are packed automatically with a shelf packer, then:
  * java_layer() emits the CubeListBuilder code for createBodyLayer();
  * faces() yields every face rectangle so a painter can texture it.

Minecraft box UV layout for texOffs(u, v) and size (w, h, d):
  top    (u+d,     v)      w x d       bottom (u+d+w,   v)      w x d
  right  (u,       v+d)    d x h       front  (u+d,     v+d)    w x h
  left   (u+d+w,   v+d)    d x h       back   (u+2d+w,  v+d)    w x h
"""
from __future__ import annotations

from dataclasses import dataclass, field
import math


@dataclass
class Box:
    name: str            # painter hint, e.g. "body", "membrane"
    origin: tuple        # x, y, z of the min corner relative to the pivot
    size: tuple          # w, h, d (integers)
    mirror: bool = False
    uv: tuple = (0, 0)

    @property
    def uv_size(self):
        w, h, d = self.size
        return 2 * (w + d), h + d


@dataclass
class Part:
    name: str
    pivot: tuple = (0.0, 0.0, 0.0)
    rot: tuple = (0.0, 0.0, 0.0)
    boxes: list = field(default_factory=list)
    children: list = field(default_factory=list)

    def box(self, hint, origin, size, mirror=False):
        self.boxes.append(Box(hint, origin, tuple(int(s) for s in size), mirror))
        return self

    def child(self, part):
        self.children.append(part)
        return part

    def walk(self):
        yield self
        for c in self.children:
            yield from c.walk()


def pack(root: Part, width: int) -> int:
    """Shelf-pack all boxes; returns the texture height (power of two)."""
    boxes = [b for p in root.walk() for b in p.boxes]
    order = sorted(boxes, key=lambda b: (-b.uv_size[1], -b.uv_size[0]))
    x = y = shelf_h = 0
    for b in order:
        bw, bh = b.uv_size
        bw = max(bw, 1)
        bh = max(bh, 1)
        if bw > width:
            raise ValueError(f"box {b.name} too wide ({bw}) for texture width {width}")
        if x + bw > width:
            x = 0
            y += shelf_h
            shelf_h = 0
        b.uv = (x, y)
        x += bw
        shelf_h = max(shelf_h, bh)
    total = y + shelf_h
    h = 1
    while h < total:
        h *= 2
    return h


def faces(root: Part):
    """Yields (part, box, face_name, x0, y0, w, h) for every face rectangle."""
    for part in root.walk():
        for b in part.boxes:
            u, v = b.uv
            w, h, d = b.size
            yield part, b, "top", u + d, v, w, d
            yield part, b, "bottom", u + d + w, v, w, d
            yield part, b, "right", u, v + d, d, h
            yield part, b, "front", u + d, v + d, w, h
            yield part, b, "left", u + d + w, v + d, d, h
            yield part, b, "back", u + 2 * d + w, v + d, w, h


def _f(v):
    s = f"{float(v):.4f}".rstrip("0")
    if s.endswith("."):
        s += "0"
    return s + "F"


def java_layer(root: Part, tex_w: int, tex_h: int, indent="        ") -> str:
    lines = [f"{indent}MeshDefinition mesh = new MeshDefinition();", f"{indent}PartDefinition root = mesh.getRoot();"]

    def emit(part: Part, parent_var: str):
        var = "p_" + part.name
        cubes = "CubeListBuilder.create()"
        for b in part.boxes:
            ox, oy, oz = b.origin
            w, h, d = b.size
            cubes += f".texOffs({b.uv[0]}, {b.uv[1]})"
            if b.mirror:
                cubes += ".mirror()"
            cubes += f".addBox({_f(ox)}, {_f(oy)}, {_f(oz)}, {_f(w)}, {_f(h)}, {_f(d)})"
            if b.mirror:
                cubes += ".mirror(false)"
        px, py, pz = part.pivot
        rx, ry, rz = part.rot
        if any(abs(r) > 1e-9 for r in part.rot):
            pose = f"PartPose.offsetAndRotation({_f(px)}, {_f(py)}, {_f(pz)}, {_f(rx)}, {_f(ry)}, {_f(rz)})"
        else:
            pose = f"PartPose.offset({_f(px)}, {_f(py)}, {_f(pz)})"
        lines.append(f'{indent}PartDefinition {var} = {parent_var}.addOrReplaceChild("{part.name}", {cubes}, {pose});')
        for c in part.children:
            emit(c, var)

    for c in root.children:
        emit(c, "root")
    lines.append(f"{indent}return LayerDefinition.create(mesh, {tex_w}, {tex_h});")
    return "\n".join(lines)
