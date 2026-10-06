#!/usr/bin/env python3
"""
Shorecrest site build: brand photos, fonts, logo, and photo data.
(Products come from Printify through the Worker; this only handles the photography.)

  python tools/build.py            # process anything new or changed
  python tools/build.py --force    # re-process every photo

Reads ../Shorecrest (photo catalog) and ../Shorecrest_Launch_Kit (brand kit).
Requires Python 3.9+ with:  pip install pillow fonttools brotli
"""
import base64
import io
import json
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

from PIL import Image, ImageFilter, ImageOps

Image.MAX_IMAGE_PIXELS = None

SITE = Path(__file__).resolve().parent.parent
MASTER = SITE.parent
SRC = MASTER / "Shorecrest"
KIT = MASTER / "Shorecrest_Launch_Kit"
IMG = SITE / "assets" / "img"
TOOLS = SITE / "tools"
CACHE_FILE = TOOLS / ".build-cache.json"

WIDTHS = [480, 960, 1600]
LARGE = {"SC-019", "SC-058", "SC-061", "SC-025"}   # photos shown full screen get a 2400px size too
FEATURED_ORDER = ["SC-003", "SC-004", "SC-019", "SC-031", "SC-035", "SC-025",
                  "SC-058", "SC-045", "SC-010", "SC-022", "SC-061", "SC-063"]


def fresh(out, src):
    return out.exists() and out.stat().st_mtime >= src.stat().st_mtime


def widths_for(native, ladder):
    ws = [w for w in ladder if w < native]
    ws.append(min(native, ladder[-1]))
    return sorted(set(ws))


def fit_width(im, w):
    return im if im.width <= w else im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)


def process(job):
    sid, src, force = job
    src = Path(src)
    im = ImageOps.exif_transpose(Image.open(src)).convert("RGB")
    out = {"id": sid, "w": im.width, "h": im.height}
    ladder = WIDTHS + ([2400] if sid in LARGE else [])
    ws = widths_for(im.width, ladder)
    for w in ws:
        dest = IMG / "photo" / f"{sid}-{w}.webp"
        if force or not fresh(dest, src):
            r = fit_width(im, w)
            if w >= 1600:
                # The masters were sharpened for print; a whisper of smoothing removes pixel noise
                # WebP can't compress, with no visible loss on screen.
                r = r.filter(ImageFilter.GaussianBlur(0.6))
                q = 68
            elif w > 480:
                q = 74
            else:
                r = r.filter(ImageFilter.UnsharpMask(radius=0.6, percent=35, threshold=2))
                q = 78
            r.save(dest, "WEBP", quality=q, method=6)
    out["photo"] = ws
    out["color"] = "#{:02x}{:02x}{:02x}".format(*im.resize((1, 1), Image.BOX).getpixel((0, 0)))
    small = im.copy()
    small.thumbnail((24, 24))
    buf = io.BytesIO()
    small.save(buf, "WEBP", quality=45)
    out["lqip"] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
    return out


def load_catalog():
    scenes = []
    for part in ("Catalog1", "Catalog2", "Catalog3"):
        scenes += json.loads((SRC / part / "catalog.json").read_text(encoding="utf-8"))
    scenes.sort(key=lambda s: s["id"])
    notes = json.loads((TOOLS / "scene-notes.json").read_text(encoding="utf-8"))
    for s in scenes:
        master = next(a for a in s["assets"] if a["kind"] == "Photo master")
        s["_src"] = SRC / "Masters" / Path(master["file"]).name
        s["_notes"] = notes.get(s["id"], {})
    return scenes


def build_font():
    from fontTools.ttLib import TTFont
    src = KIT / "01_Identity" / "Fonts" / "Safi.ttf"
    dest = SITE / "assets" / "fonts" / "safi.woff2"
    if not fresh(dest, src):
        f = TTFont(src)
        f.flavor = "woff2"
        f.save(dest)
    woff = KIT / "04_Website" / "Fonts" / "Safi.woff"
    if woff.exists() and not fresh(SITE / "assets" / "fonts" / "safi.woff", woff):
        (SITE / "assets" / "fonts" / "safi.woff").write_bytes(woff.read_bytes())


def _rdp(points, eps):
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5 or 1e-9
        idx, dmax = -1, 0.0
        for i in range(a + 1, b):
            px, py = points[i]
            d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > dmax:
                idx, dmax = i, d
        if dmax > eps and idx > 0:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def simplify_path(d, eps=0.32):
    """Flatten the traced logo path (tiny cubic segments) and simplify each subpath."""
    tokens = re.findall(r"[MCLZmclz]|-?\d*\.?\d+(?:e-?\d+)?", d)
    subpaths, cur, i, cmd, pos = [], [], 0, None, (0.0, 0.0)
    while i < len(tokens):
        t = tokens[i]
        if t in "MCLZmclz":
            cmd = t
            i += 1
            if cmd in "Zz":
                if cur:
                    subpaths.append(cur)
                cur = []
                continue
        if cmd == "M":
            x, y = float(tokens[i]), float(tokens[i + 1]); i += 2
            if cur:
                subpaths.append(cur)
            cur, pos, cmd = [(x, y)], (x, y), "L"
        elif cmd == "L":
            x, y = float(tokens[i]), float(tokens[i + 1]); i += 2
            cur.append((x, y)); pos = (x, y)
        elif cmd == "C":
            x1, y1, x2, y2, x, y = (float(v) for v in tokens[i:i + 6]); i += 6
            m = lambda a, b, c, d: (a + 3 * b + 3 * c + d) / 8
            cur += [(m(pos[0], x1, x2, x), m(pos[1], y1, y2, y)), (x, y)]
            pos = (x, y)
        else:
            i += 1
    if cur:
        subpaths.append(cur)

    def fmt(v):
        s = f"{v:.1f}"
        s = s[:-2] if s.endswith(".0") else s
        s = s[1:] if s.startswith("0.") else ("-" + s[2:] if s.startswith("-0.") else s)
        return "0" if s in ("-0", "") else s

    def join(vals):
        txt = ""
        for v in vals:
            txt += v if (not txt or v.startswith("-")) else " " + v
        return txt

    out = []
    for sp in subpaths:
        if len(sp) < 3:
            continue
        x0, y0 = sp[0]
        k = max(range(len(sp)), key=lambda j: (sp[j][0] - x0) ** 2 + (sp[j][1] - y0) ** 2)
        if k == 0:
            continue
        simp = _rdp(sp[:k + 1], eps)[:-1] + _rdp(sp[k:] + [sp[0]], eps)[:-1]
        if len(simp) < 3:
            continue
        px, py = round(simp[0][0], 1), round(simp[0][1], 1)
        vals = []
        for (x, y) in simp[1:]:
            rx, ry = round(x, 1), round(y, 1)
            vals += [fmt(rx - px), fmt(ry - py)]
            px, py = rx, ry
        out.append(f"M{join([fmt(round(simp[0][0], 1)), fmt(round(simp[0][1], 1))])}l{join(vals)}z")
    return "".join(out)


def build_logo():
    svg = (KIT / "01_Identity" / "Logos" / "shorecrest-primary-tide-pine.svg").read_text(encoding="utf-8")
    vb = " ".join(f"{float(v):g}" for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split())
    paths = re.findall(r'<path d="([^"]+)"[^>]*fill="(#[0-9A-Fa-f]{6})"', svg)
    td = simplify_path(next(p for p, c in paths if c.upper() == "#304458"))
    pd = simplify_path(next(p for p, c in paths if c.upper() == "#21463A"))

    def doc(a, b):
        return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb}" role="img" aria-label="Shorecrest"><title>Shorecrest</title>'
                f'<path fill="{a}" fill-rule="evenodd" d="{td}"/><path fill="{b}" fill-rule="evenodd" d="{pd}"/></svg>')

    brand = SITE / "assets" / "brand"
    brand.mkdir(parents=True, exist_ok=True)
    (brand / "logo-primary.svg").write_text(doc("#304458", "#21463A"), encoding="utf-8")
    (brand / "logo-cloud.svg").write_text(doc("#DFE5E1", "#DFE5E1"), encoding="utf-8")
    (brand / "logo-ink.svg").write_text(doc("#192928", "#192928"), encoding="utf-8")
    (SITE / "assets" / "js" / "logo-data.js").write_text(
        "/* Generated by tools/build.py from the approved Shorecrest wordmark. */\n"
        "window.SC_LOGO=" + json.dumps({"viewBox": vb, "tide": td, "pine": pd}, separators=(",", ":")) + ";\n", encoding="utf-8")


def build_brand_files():
    ident = KIT / "01_Identity"
    copies = {
        ident / "Marks" / "shorecrest-crest-tide-pine.svg": SITE / "assets" / "brand" / "crest.svg",
        ident / "Marks" / "shorecrest-crest-reversed.svg": SITE / "assets" / "brand" / "crest-cloud.svg",
        ident / "Icons" / "favicon.svg": SITE / "favicon.svg",
        ident / "Icons" / "favicon.ico": SITE / "favicon.ico",
        ident / "Icons" / "apple-touch-icon.png": SITE / "apple-touch-icon.png",
        ident / "Icons" / "icon-192.png": SITE / "icon-192.png",
        ident / "Icons" / "icon-512.png": SITE / "icon-512.png",
    }
    for s, d in copies.items():
        if s.exists() and not fresh(d, s):
            d.write_bytes(s.read_bytes())
    og = KIT / "05_Social" / "Ready_To_Post" / "19-open-graph.png"
    dest = IMG / "og" / "shorecrest.jpg"
    if og.exists() and not fresh(dest, og):
        im = ImageOps.fit(ImageOps.exif_transpose(Image.open(og)).convert("RGB"), (1200, 630), Image.LANCZOS)
        im.save(dest, "JPEG", quality=86, optimize=True, progressive=True)


def main():
    force = "--force" in sys.argv
    for sub in ("photo", "og"):
        (IMG / sub).mkdir(parents=True, exist_ok=True)
    print("Brand assets")
    build_font()
    build_logo()
    build_brand_files()

    scenes = load_catalog()
    cache = json.loads(CACHE_FILE.read_text(encoding="utf-8")) if CACHE_FILE.exists() and not force else {}
    jobs = []
    for s in scenes:
        key = f"{s['_src'].stat().st_mtime:.0f}-{'L' if s['id'] in LARGE else 'S'}"
        c = cache.get(s["id"], {})
        if force or c.get("_key") != key or "lqip" not in c:
            jobs.append((s["id"], str(s["_src"]), force))
    print(f"Photos: {len(jobs)} to process")
    if jobs:
        with ProcessPoolExecutor() as ex:
            for res in ex.map(process, jobs):
                s = next(x for x in scenes if x["id"] == res["id"])
                res["_key"] = f"{s['_src'].stat().st_mtime:.0f}-{'L' if s['id'] in LARGE else 'S'}"
                cache[res["id"]] = res
                print("  " + res["id"])
        CACHE_FILE.write_text(json.dumps(cache), encoding="utf-8")

    feat = {sid: i for i, sid in enumerate(FEATURED_ORDER)}
    rows = []
    for s in scenes:
        c, n = cache[s["id"]], s["_notes"]
        rows.append({
            "id": s["id"], "title": s["title"], "place": s["collection"],
            "line": n.get("line", ""), "alt": n.get("alt", f"{s['title']}, {s['collection']}."), "moods": n.get("moods", []),
            "w": c["w"], "h": c["h"], "photo": c["photo"], "color": c["color"], "lqip": c["lqip"],
            "featured": feat.get(s["id"], -1),
        })
    additional = TOOLS / "additional-photos.json"
    if additional.exists():
        rows.extend(json.loads(additional.read_text(encoding="utf-8")))
    (SITE / "assets" / "js" / "catalog.js").write_text(
        "/* Generated by tools/build.py: original photographs and tools/additional-photos.json. Edit the photo sources, then rebuild. */\n"
        "window.SC_CATALOG=" + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";\n", encoding="utf-8")
    print(f"Done: {len(rows)} photographs.")


if __name__ == "__main__":
    main()

