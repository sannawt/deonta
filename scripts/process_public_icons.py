#!/usr/bin/env python3
"""Process marketing PNGs → frontend/public + src/assets/brand (visible on white UI)."""

from __future__ import annotations

from pathlib import Path

from PIL import Image

REPO = Path(__file__).resolve().parents[1]
OUT_PUBLIC = REPO / "frontend" / "public"
OUT_ASSETS = REPO / "frontend" / "src" / "assets" / "brand"
ASSETS = REPO.parent / ".cursor" / "projects" / "Users-sannawong-toropainen-compliance-calculator" / "assets"
MAX_SIZE = 128


def is_checkerboard_pixel(r: int, g: int, b: int) -> bool:
    if abs(r - g) > 10 or abs(g - b) > 10:
        return False
    return 170 <= r <= 250


def flatten_on_white(src: Path, dst: Path) -> None:
    """Checkerboard → white; keep icon pixels opaque (visible in browser)."""
    src_im = Image.open(src).convert("RGBA")
    w, h = src_im.size
    out = Image.new("RGBA", (w, h), (255, 255, 255, 255))
    src_px = src_im.load()
    out_px = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = src_px[x, y]
            if is_checkerboard_pixel(r, g, b):
                continue
            out_px[x, y] = (r, g, b, 255)
    if max(w, h) > MAX_SIZE:
        out.thumbnail((MAX_SIZE, MAX_SIZE), Image.Resampling.LANCZOS)
    out.save(dst, "PNG", optimize=True)
    print(f"wrote {dst} ({out.size[0]}x{out.size[1]})")


def main() -> None:
    assets = ASSETS if ASSETS.is_dir() else REPO / "assets"
    OUT_ASSETS.mkdir(parents=True, exist_ok=True)
    mapping = [
        (
            "7875e2c8-e16a-4647-9b34-1e25ea1957a1-b27178d7-1ee3-4a1e-9af0-abbeb2e72e7b.png",
            "document.png",
        ),
        (
            "scale_with_sand-644babe7-65fe-4c46-ad19-7a9fd8123512.png",
            "scale.png",
        ),
        (
            "hour_glass-be935fb1-7160-4f4c-9750-8a8961155ab6.png",
            "hourglass.png",
        ),
        (
            "ComplianceTWin_website_materials-a259ec22-eedb-4640-8872-7e7157dcc3c9.png",
            "legal-sand.png",
        ),
        (
            "79aabd18-3fbd-48f6-b1fa-85a0ca64a856-0f8fe4ed-bc02-44c7-a2b3-65e2bbbaab6e.png",
            "product-console.png",
        ),
    ]
    for src_name, out_name in mapping:
        src = assets / src_name
        if not src.is_file():
            print(f"skip missing {src}")
            continue
        for out_dir in (OUT_PUBLIC, OUT_ASSETS):
            flatten_on_white(src, out_dir / out_name)


if __name__ == "__main__":
    main()
