"""Bundle the site into one self-contained HTML file.

Inlines i18n.js and embeds every photo from img/ as a data URI, so the result
can be opened or sent as a single file. Usage: python3 build.py
"""
import base64
import json
from pathlib import Path

ROOT = Path(__file__).parent
OUT = ROOT / "dist" / "regula-lv-concept.html"

html = (ROOT / "index.html").read_text(encoding="utf-8")
i18n = (ROOT / "i18n.js").read_text(encoding="utf-8")

images = {
    path.stem: "data:image/webp;base64," + base64.b64encode(path.read_bytes()).decode()
    for path in sorted((ROOT / "img").glob("*.webp"))
}

tag = '<script src="i18n.js"></script>'
assert html.count(tag) == 1, "i18n.js script tag not found"
inline = f"<script>\n{i18n}\nwindow.EMBEDDED_IMAGES = {json.dumps(images)};\n</script>"
html = html.replace(tag, inline)

OUT.parent.mkdir(exist_ok=True)
OUT.write_text(html, encoding="utf-8")
print(f"{OUT.relative_to(ROOT)}: {len(images)} images, {OUT.stat().st_size / 1024:.0f} KB")
