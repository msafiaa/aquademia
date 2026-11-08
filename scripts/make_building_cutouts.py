"""
Builds transparent-background building cut-outs for the Aquademia 3D world.

The originals in frontend/static/images/buildings/*.jpg have a checkerboard
"fake transparency" pattern baked into the pixels. This script NEVER modifies
them. It writes transparent PNGs to frontend/static/images/buildings/cutouts/
so the buildings can stand in the 3D city without a checkerboard box.

Only neutral grey/white pixels connected to the image border are removed, and
only the biggest remaining blob is kept (this also drops the floating bubbles).

Run from the project root (needs: pip install pillow numpy scipy):
    python scripts/make_building_cutouts.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "static" / "images" / "buildings"
OUT = SRC / "cutouts"
OUT.mkdir(exist_ok=True)

TARGET_HEIGHT = 768  # px; keeps GPU textures small but crisp
NAMES = ["quiz_academy", "aqua_lab", "my_aquarium", "aqua_shop", "learning_cove"]


def remove_checkerboard(img: Image.Image) -> Image.Image:
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).astype(np.int16)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    bright = np.minimum(np.minimum(r, g), b) > 178
    neutral = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < 11
    candidate = bright & neutral
    # Close the thin JPEG-blurred seams between checker squares
    candidate = ndimage.binary_closing(candidate, iterations=2) | candidate

    labels, _ = ndimage.label(candidate)
    border = np.unique(
        np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
    )
    border = border[border != 0]
    background = np.isin(labels, border)

    foreground = ~background
    # keep only the biggest blob (the building) - drops floating bubbles/specks
    fl, n = ndimage.label(foreground)
    sizes = ndimage.sum(foreground, fl, range(1, n + 1))
    foreground = fl == (np.argmax(sizes) + 1)
    foreground = ndimage.binary_fill_holes(foreground)
    foreground = ndimage.binary_erosion(foreground, iterations=2)

    alpha = Image.fromarray((foreground * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(1.0)
    )
    rgba.putalpha(alpha)
    return rgba


def main():
    for name in NAMES:
        img = remove_checkerboard(Image.open(SRC / f"{name}.jpg"))
        box = img.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
        img = img.crop(box)
        ratio = TARGET_HEIGHT / img.height
        img = img.resize((round(img.width * ratio), TARGET_HEIGHT), Image.LANCZOS)
        path = OUT / f"{name}.png"
        img.save(path, optimize=True)
        print(f"{name:14s} {img.size}  {path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
