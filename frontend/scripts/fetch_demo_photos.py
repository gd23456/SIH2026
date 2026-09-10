"""Download real, commercially-licensed craft photos into frontend/public/demo/.

Names each file by the exact slug the resolver expects (see
frontend/src/lib/productImage.js). Uses the keyless Openverse CC image API
(commercial licenses), falling back to Wikimedia Commons, then center-crops to a
square ~1000px JPEG <= ~200 KB and writes ATTRIBUTIONS.md.

    python frontend/scripts/fetch_demo_photos.py      # from repo root
    python scripts/fetch_demo_photos.py               # from frontend/

Any slug that can't download is simply skipped — the app's gradient placeholder
covers it, so nothing breaks. Re-run, or hand-drop a JPG for that slug.
Needs Pillow (pip install pillow).
"""
import io, json, os, ssl, sys, urllib.parse, urllib.request

from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "demo")
os.makedirs(OUT, exist_ok=True)
UA = {"User-Agent": "KarigarAI/1.0 (SIH hackathon demo)"}
CTX = ssl.create_default_context()
QUERIES = {
    "bamboo": "bamboo basket handicraft product",
    "terracotta": "terracotta vase pottery decorative",
    "silk": "silk saree fabric textile",
    "channapatna": "colourful wooden toys handmade",
    "jute": "jute bag tote handmade",
    "brass": "brass vessel handicraft decorative",
    "craft": "indian handicraft souvenir",
}

try:
    sys.stdout.reconfigure(encoding="utf-8")
except Exception:
    pass


def _open(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30, context=CTX)


def openverse(q):
    u = ("https://api.openverse.org/v1/images/?q=" + urllib.parse.quote(q) +
         "&license_type=commercial&mature=false&size=medium&page_size=8")
    data = json.load(_open(u))
    return [(r.get("url"), r.get("creator"), r.get("license"), r.get("foreign_landing_url"))
            for r in data.get("results", []) if r.get("url")]


def wikimedia(q):
    u = ("https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search"
         "&gsrnamespace=6&gsrlimit=8&gsrsearch=" + urllib.parse.quote(q) +
         "&prop=imageinfo&iiprop=url|mime&iiurlwidth=1200")
    d = json.load(_open(u))
    out = []
    for p in d.get("query", {}).get("pages", {}).values():
        ii = (p.get("imageinfo") or [{}])[0]
        if str(ii.get("mime", "")).startswith("image/"):
            out.append((ii.get("thumburl") or ii.get("url"), "Wikimedia Commons", "see source", ii.get("descriptionurl")))
    return out


def save_square(raw, path):
    im = Image.open(io.BytesIO(raw)).convert("RGB")
    w, h = im.size
    s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((1000, 1000))
    q = 85
    while q >= 60:
        buf = io.BytesIO()
        im.save(buf, "JPEG", quality=q, optimize=True)
        if buf.tell() <= 200_000 or q == 60:
            open(path, "wb").write(buf.getvalue())
            return buf.tell()
        q -= 5


ATTR_PATH = os.path.join(OUT, "ATTRIBUTIONS.md")

# Merge with any existing attributions so re-fetching only some slugs never
# drops the credits for the others.
lines = {}
if os.path.exists(ATTR_PATH):
    for ln in open(ATTR_PATH, encoding="utf-8"):
        if ln.startswith("- **") and ".jpg**" in ln:
            lines[ln.split("**")[1]] = ln.rstrip("\n")

for slug, q in QUERIES.items():
    got = False
    for source in (openverse, wikimedia):
        try:
            for url, creator, lic, land in source(q):
                try:
                    raw = _open(url).read()
                    if len(raw) < 8000:  # skip tiny/broken
                        continue
                    n = save_square(raw, os.path.join(OUT, slug + ".jpg"))
                    lines[slug + ".jpg"] = f"- **{slug}.jpg** — {creator or 'Unknown'} · {lic or 'CC'} · {land or url}"
                    print(f"OK {slug}.jpg  ({n} bytes)  <- {source.__name__}")
                    got = True
                    break
                except Exception:
                    continue
        except Exception as e:
            print(f"  {source.__name__} failed for {slug}: {e}")
        if got:
            break
    if not got:
        print(f"MISS {slug} — kept existing file / gradient placeholder.")

body = ["# Demo photo attributions", "",
        "Sourced via the Openverse API and Wikimedia Commons under Creative-Commons",
        "commercial-use licenses by `fetch_demo_photos.py`. Swap any file freely.", ""]
body += [lines[k] for k in sorted(lines)]
open(ATTR_PATH, "w", encoding="utf-8").write("\n".join(body) + "\n")
print("Done. Wrote ATTRIBUTIONS.md")
