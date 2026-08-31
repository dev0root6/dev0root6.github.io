#!/usr/bin/env python3
"""Renders the Signal Ping app icons — no image libraries required.

    python3 scripts/generate-icons.py

Writes public/icons/{icon-192,icon-512,icon-maskable-512}.png. The mark is a
filled dot with two expanding rings: a ping. Re-run after changing ACCENT.
"""

import math
import struct
import zlib
from pathlib import Path

BG = (16, 18, 20)        # matches --bg (dark) and the manifest theme colour
ACCENT = (91, 140, 255)  # matches --accent (dark)

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"


def write_png(path, size, pixels):
    """pixels: flat list of (r, g, b) rows, length size*size."""
    raw = b"".join(
        b"\x00" + b"".join(bytes(pixels[y * size + x]) for x in range(size))
        for y in range(size)
    )

    def chunk(tag, data):
        body = tag + data
        return struct.pack(">I", len(data)) + body + struct.pack(">I", zlib.crc32(body))

    png = (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))
        + chunk(b"IDAT", zlib.compress(raw, 9))
        + chunk(b"IEND", b"")
    )
    path.write_bytes(png)


def blend(bottom, top, alpha):
    return tuple(round(b + (t - b) * alpha) for b, t in zip(bottom, top))


def render(size, content_scale):
    """content_scale < 1 keeps the mark inside a maskable icon's safe zone."""
    cx = cy = (size - 1) / 2
    unit = size * content_scale / 2  # radius of the drawable area

    dot_r = unit * 0.26
    rings = [(unit * 0.55, unit * 0.085), (unit * 0.88, unit * 0.085)]
    corner = size * 0.22  # rounded-square background

    pixels = []
    for y in range(size):
        for x in range(size):
            # Rounded-square background mask (only used for the non-maskable
            # icons; maskable ones fill the whole canvas and let the OS clip).
            if content_scale < 1:
                inside_bg = 1.0
            else:
                dx = max(abs(x - cx) - (size / 2 - corner), 0)
                dy = max(abs(y - cy) - (size / 2 - corner), 0)
                inside_bg = clamp_edge(corner - math.hypot(dx, dy))

            colour = blend((0, 0, 0), BG, inside_bg)

            d = math.hypot(x - cx, y - cy)

            # Centre dot.
            colour = blend(colour, ACCENT, clamp_edge(dot_r - d) * inside_bg)

            # Two rings around it.
            for radius, thickness in rings:
                coverage = clamp_edge(thickness / 2 - abs(d - radius))
                # Rings fade as they expand, like a signal travelling outward.
                fade = 0.9 if radius < unit * 0.7 else 0.6
                colour = blend(colour, ACCENT, coverage * fade * inside_bg)

            pixels.append(colour)
    return pixels


def clamp_edge(value):
    """1 inside, 0 outside, with a 1px antialiased edge."""
    return max(0.0, min(1.0, value + 0.5))


OUT.mkdir(parents=True, exist_ok=True)
for name, size, scale in [
    ("icon-192.png", 192, 1.0),
    ("icon-512.png", 512, 1.0),
    # Maskable icons must keep their content within the middle ~80%.
    ("icon-maskable-512.png", 512, 0.72),
]:
    write_png(OUT / name, size, render(size, scale))
    print("wrote", OUT / name)
