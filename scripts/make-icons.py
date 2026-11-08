#!/usr/bin/env python3
"""Draws the app icon with the game's own plate and slice visuals (port of plateRenderer.ts).

Six wedge places, four filled (strawberry, chocolate, lemon, pistachio), the two on the right empty.
Usage: python3 scripts/make-icons.py   (needs rsvg-convert; writes public/)
"""
import math
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public"
CREAM = "#fff4dd"
PLATE_FILL, PLATE_EDGE = "#fffaf0", "#cdbfa6"
R = 214.0  # plate radius
U = R / 30.0  # game pixels -> icon pixels (the game plate is about 30px in radius)
WEDGES = 6
# slot index -> (colour, accent, glyph); slots 0 and 1 (upper right to lower right) stay empty
SLOTS = {
    2: ("#e5484d", "#ffc2c4", "circle"),
    3: ("#7a4a2b", "#c9966b", "square"),
    4: ("#f2c94c", "#fff2b0", "triangle"),
    5: ("#6fbf73", "#cdeccf", "diamond"),
}


def f(v):
    return f"{v:.2f}"


def glyph(kind, x, y, s, fill):
    if kind == "circle":
        return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(s * 0.8)}" fill="{fill}"/>'
    if kind == "square":
        w = s * 1.4
        return f'<rect x="{f(x - w / 2)}" y="{f(y - w / 2)}" width="{f(w)}" height="{f(w)}" fill="{fill}"/>'
    if kind == "triangle":
        pts = [(x, y - s), (x + 0.95 * s, y + 0.75 * s), (x - 0.95 * s, y + 0.75 * s)]
    elif kind == "diamond":
        pts = [(x, y - s), (x + s, y), (x, y + s), (x - s, y)]
    else:
        raise ValueError(kind)
    return f'<polygon points="{" ".join(f"{f(a)},{f(b)}" for a, b in pts)}" fill="{fill}"/>'


def wedge_path(cx, cy, r, a0, a1):
    x0, y0 = cx + r * math.cos(a0), cy + r * math.sin(a0)
    x1, y1 = cx + r * math.cos(a1), cy + r * math.sin(a1)
    return f"M{f(cx)} {f(cy)} L{f(x0)} {f(y0)} A{f(r)} {f(r)} 0 0 1 {f(x1)} {f(y1)}Z"


def svg(scale=1.0):
    c = 256.0
    inner = R * 0.86
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
        f'<rect width="512" height="512" fill="{CREAM}"/>',
        f'<g transform="translate(256 256) scale({scale}) translate(-256 -256)">',
        f'<circle cx="{c}" cy="{c}" r="{R}" fill="{PLATE_FILL}" stroke="{PLATE_EDGE}" stroke-width="{f(2 * U)}"/>',
    ]
    step = 2 * math.pi / WEDGES
    for k in range(WEDGES):
        a0 = -math.pi / 2 + k * step
        a1 = a0 + step
        d = wedge_path(c, c, inner, a0, a1)
        if k not in SLOTS:
            parts.append(
                f'<path d="{d}" fill="none" stroke="{PLATE_EDGE}" stroke-opacity="0.5" '
                f'stroke-width="{f(U)}"/>'
            )
            continue
        color, accent, kind = SLOTS[k]
        parts.append(f'<path d="{d}" fill="{color}" stroke="#ffffff" stroke-width="{f(1.5 * U)}"/>')
        mid = (a0 + a1) / 2
        gx, gy = c + inner * 0.62 * math.cos(mid), c + inner * 0.62 * math.sin(mid)
        parts.append(glyph(kind, gx, gy, max(3 * U, R * 0.13), accent))
    parts += ["</g>", "</svg>"]
    return "\n".join(parts)


def png(src, size, name):
    subprocess.run(
        ["rsvg-convert", "-w", str(size), "-h", str(size), str(src), "-o", str(OUT / name)],
        check=True,
    )


def main():
    OUT.mkdir(exist_ok=True)
    (OUT / "icon.svg").write_text(svg(1.0))
    (OUT / "icon-maskable.svg").write_text(svg(0.8))
    png(OUT / "icon.svg", 512, "icon-512.png")
    png(OUT / "icon.svg", 192, "icon-192.png")
    png(OUT / "icon.svg", 180, "apple-touch-icon.png")
    png(OUT / "icon.svg", 32, "favicon-32.png")
    png(OUT / "icon-maskable.svg", 512, "icon-maskable-512.png")
    (OUT / "icon-maskable.svg").unlink()


main()
