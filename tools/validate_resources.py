"""Static validation of Lost Features resources. Exits non-zero on any problem.

Checks: JSON parses; blockstate -> model -> texture chains resolve; item model definitions resolve;
sounds.json files exist; every registered block/item/entity id (scraped from the registry classes)
has a lang entry and an item model; every recipe/loot reference to a lostfeatures id exists;
recipe ids are unique and namespaced; painting textures match their declared size.
Run: python3 tools/validate_resources.py
"""
import glob
import json
import os
import re
import sys

from PIL import Image

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
NS = "lostfeatures"
SRC = [os.path.join(ROOT, "src", "main", "resources"), os.path.join(ROOT, "src", "generated", "resources")]
problems = []


def find(rel):
    for base in SRC:
        p = os.path.join(base, rel)
        if os.path.exists(p):
            return p
    return None


def load_all(pattern):
    out = {}
    for base in SRC:
        for path in glob.glob(os.path.join(base, pattern), recursive=True):
            try:
                out[os.path.relpath(path, base)] = json.load(open(path))
            except Exception as e:  # noqa: BLE001
                problems.append(f"invalid JSON {path}: {e}")
    return out


def split(ref):
    ns, _, path = ref.partition(":") if ":" in ref else ("minecraft", "", ref)
    return ns, path


def check_texture(ref, where):
    ns, path = split(ref)
    if ns != NS:
        return
    if not find(f"assets/{NS}/textures/{path}.png"):
        problems.append(f"missing texture {ref} (from {where})")


def check_model(ref, where, seen=set()):
    ns, path = split(ref)
    if ns != NS or ref in seen:
        return
    seen.add(ref)
    p = find(f"assets/{NS}/models/{path}.json")
    if not p:
        problems.append(f"missing model {ref} (from {where})")
        return
    model = json.load(open(p))
    for tex in model.get("textures", {}).values():
        if not tex.startswith("#"):
            check_texture(tex, ref)
    if "parent" in model:
        check_model(model["parent"], ref)


def walk_models(obj, where):
    if isinstance(obj, dict):
        if "model" in obj and isinstance(obj["model"], str):
            check_model(obj["model"], where)
        for v in obj.values():
            walk_models(v, where)
    elif isinstance(obj, list):
        for v in obj:
            walk_models(v, where)


def registered_ids():
    java = os.path.join(ROOT, "src", "main", "java", "com", "lostfeatures", "registry")
    blocks = set(re.findall(r'register(?:Block|SimpleBlock)\("([a-z0-9_]+)"', open(os.path.join(java, "ModBlocks.java")).read()))
    items_src = open(os.path.join(java, "ModItems.java")).read()
    items = set(re.findall(r'(?:registerItem|lore|disc)\("([a-z0-9_]+)"', items_src))
    items |= blocks  # every block has a block item
    items.discard("charred_remains_unused")
    entities = set(re.findall(r'registerEntityType\("([a-z0-9_]+)"', open(os.path.join(java, "ModEntities.java")).read()))
    return blocks, items, entities


def main():
    for rel in ("assets", "data"):
        load_all(f"{rel}/**/*.json")

    for rel, state in load_all(f"assets/{NS}/blockstates/*.json").items():
        walk_models(state, rel)
    for rel, item in load_all(f"assets/{NS}/items/*.json").items():
        walk_models(item, rel)

    sounds = json.load(open(find(f"assets/{NS}/sounds.json")))
    for event, entry in sounds.items():
        for s in entry["sounds"]:
            name = s if isinstance(s, str) else s["name"]
            ns, path = split(name)
            if ns == NS and not find(f"assets/{NS}/sounds/{path}.ogg"):
                problems.append(f"missing sound file for {event}: {name}")

    lang = json.load(open(find(f"assets/{NS}/lang/en_us.json")))
    blocks, items, entities = registered_ids()
    for b in blocks:
        if f"block.{NS}.{b}" not in lang:
            problems.append(f"missing lang block.{NS}.{b}")
        if not find(f"assets/{NS}/blockstates/{b}.json"):
            problems.append(f"missing blockstate {b}")
    for i in items:
        if i not in blocks and f"item.{NS}.{i}" not in lang:
            problems.append(f"missing lang item.{NS}.{i}")
        if not find(f"assets/{NS}/items/{i}.json"):
            problems.append(f"missing item model definition {i}")
    for e in entities:
        if f"entity.{NS}.{e}" not in lang:
            problems.append(f"missing lang entity.{NS}.{e}")

    known = {f"{NS}:{x}" for x in items | blocks}
    recipe_ids = set()
    for rel, recipe in load_all(f"data/{NS}/recipe/*.json").items():
        rid = os.path.basename(rel)[:-5]
        if rid in recipe_ids:
            problems.append(f"duplicate recipe id {rid}")
        recipe_ids.add(rid)
        for ref in re.findall(r'"(lostfeatures:[a-z0-9_/]+)"', json.dumps(recipe)):
            if ref not in known:
                problems.append(f"recipe {rid} references unknown {ref}")
    for rel, table in load_all(f"data/{NS}/loot_table/**/*.json").items():
        for ref in re.findall(r'"name": "(lostfeatures:[a-z0-9_/]+)"', json.dumps(table)):
            if ref not in known:
                problems.append(f"loot table {rel} references unknown {ref}")

    for rel, variant in load_all(f"data/{NS}/painting_variant/*.json").items():
        ns, path = split(variant["asset_id"])
        tex = find(f"assets/{NS}/textures/painting/{path}.png")
        if not tex:
            problems.append(f"missing painting texture {path}")
            continue
        w, h = Image.open(tex).size
        if (w, h) != (variant["width"] * 16, variant["height"] * 16):
            problems.append(f"painting {path} is {w}x{h}, expected {variant['width'] * 16}x{variant['height'] * 16}")

    print(f"blocks={len(blocks)} items={len(items)} entities={len(entities)} recipes={len(recipe_ids)} sounds={len(sounds)} lang={len(lang)}")
    if problems:
        print(f"{len(problems)} problem(s):")
        for p in problems:
            print("  -", p)
        sys.exit(1)
    print("all resource checks passed")


if __name__ == "__main__":
    main()
