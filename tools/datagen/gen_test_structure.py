"""Writes the GameTest template structure (a 9x5x9 box with a stone floor) as gzipped NBT.
Minimal NBT writer so no third-party structure files are copied. Run: python3 tools/datagen/gen_test_structure.py"""
import gzip
import os
import struct

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
DATA_VERSION = 4903  # SharedConstants.WORLD_VERSION for Minecraft 26.2

TAG_END, TAG_INT, TAG_STRING, TAG_LIST, TAG_COMPOUND = 0, 3, 8, 9, 10


def name(n):
    b = n.encode("utf-8")
    return struct.pack(">H", len(b)) + b


def t_int(n, v):
    return bytes([TAG_INT]) + name(n) + struct.pack(">i", v)


def t_string(n, v):
    return bytes([TAG_STRING]) + name(n) + name(v)


def t_list_int(n, values):
    return bytes([TAG_LIST]) + name(n) + bytes([TAG_INT]) + struct.pack(">i", len(values)) + b"".join(struct.pack(">i", v) for v in values)


def t_list_compound(n, payloads):
    out = bytes([TAG_LIST]) + name(n) + bytes([TAG_COMPOUND if payloads else TAG_END]) + struct.pack(">i", len(payloads))
    return out + b"".join(p + bytes([TAG_END]) for p in payloads)


def main():
    size = (9, 5, 9)
    palette = [t_string("Name", "minecraft:stone")]
    blocks = [t_list_int("pos", [x, 0, z]) + t_int("state", 0) for x in range(size[0]) for z in range(size[2])]
    body = (t_int("DataVersion", DATA_VERSION) + t_list_int("size", list(size)) + t_list_compound("palette", palette)
            + t_list_compound("blocks", blocks) + t_list_compound("entities", []))
    root = bytes([TAG_COMPOUND]) + name("") + body + bytes([TAG_END])
    path = os.path.join(ROOT, "src", "gameTest", "resources", "data", "lostfeatures", "structure", "empty.nbt")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with gzip.open(path, "wb") as f:
        f.write(root)
    print("wrote", path)


if __name__ == "__main__":
    main()
