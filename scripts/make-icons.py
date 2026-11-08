#!/usr/bin/env python3
"""Draws the app icon: a plate with six slice places, four filled, the two on the right left empty.

Usage: python3 scripts/make-icons.py   (needs rsvg-convert; writes public/)
"""
import math
import subprocess
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public"
CREAM = "#fff4dd"
# strawberry, chocolate, lemon, pistachio (the first four game flavours), clockwise from lower right
FILLS = ["#e5484d", "#7a4a2b", "#f2c94c", "#6fbf73"]
TOPS = ["#ffc2c4", "#c9966b", "#fff2b0", "#cdeccf"]


def pt(r, deg):
    a = math.radians(deg)
    return 256 + r * math.cos(a), 256 + r * math.sin(a)


def wedge(a0, a1, r_out, r_in, inset):
    """Wedge between two angles, shrunk by `inset` so neighbours show a gap."""
    s0, s1 = a0 + inset, a1 - inset
    x0, y0 = pt(r_out, s0)
    x1, y1 = pt(r_out, s1)
    xi0, yi0 = pt(r_in, s0)
    xi1, yi1 = pt(r_in, s1)
    return (
        f"M{xi0:.1f} {yi0:.1f} L{x0:.1f} {y0:.1f} "
        f"A{r_out} {r_out} 0 0 1 {x1:.1f} {y1:.1f} L{xi1:.1f} {yi1:.1f} "
        f"A{r_in} {r_in} 0 0 0 {xi0:.1f} {yi0:.1f}Z"
    )


def svg(scale=1.0):
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">',
        f'<rect width="512" height="512" fill="{CREAM}"/>',
        f'<g transform="translate(256 256) scale({scale}) translate(-256 -256)">',
        # soft shadow, plate rim, plate well
        '<ellipse cx="256" cy="274" rx="214" ry="206" fill="#d8c8a8" opacity="0.55"/>',
        '<circle cx="256" cy="256" r="214" fill="#fffdf7" stroke="#d9cdb4" stroke-width="8"/>',
        '<circle cx="256" cy="256" r="172" fill="#f6efe0" stroke="#e4d9c0" stroke-width="6"/>',
    ]
    # six places, 60 degrees each; the two centred on the right (-60..60) stay empty
    for i in range(6):
        a0 = -60 + 60 * i
        a1 = a0 + 60
        if i < 2:
            parts.append(
                f'<path d="{wedge(a0, a1, 148, 20, 3)}" fill="none" stroke="#cdbfa6" '
                f'stroke-width="7" stroke-dasharray="14 12" stroke-linejoin="round"/>'
            )
        else:
            k = i - 2
            # stroke in the same colour rounds the corners; wedge radii are shrunk by half of it
            parts.append(
                f'<path d="{wedge(a0, a1, 141, 27, 4)}" fill="{FILLS[k]}" stroke="{FILLS[k]}" '
                f'stroke-width="14" stroke-linejoin="round"/>'
            )
            mid = a0 + 30
            x, y = pt(96, mid)
            parts.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="12" fill="{TOPS[k]}"/>')
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
