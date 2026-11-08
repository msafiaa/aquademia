"""
Builds transparent-background mascot cut-outs for the Aquademia UI.

The original mascot images (frontend/static/images/characters/*.jpg|jpeg) are
opaque JPEGs on a white background. This script NEVER modifies them. It writes
new transparent PNGs to frontend/static/images/characters/cutouts/ so the
mascots can sit on the ocean background without a white box around them.

Run from the project root (needs: pip install pillow numpy scipy):
    python scripts/make_mascot_cutouts.py
"""
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "frontend" / "static" / "images" / "characters"
OUT = SRC / "cutouts"
OUT.mkdir(exist_ok=True)

TARGET_HEIGHT = 520  # px; plenty for retina display of a ~260px mascot


def remove_background(img: Image.Image) -> Image.Image:
    """Make the white/pale-lavender background (and floor shadow) transparent.

    Only background pixels that are connected to the image border are removed,
    so white highlights inside the helmets and eyes are kept.
    """
    rgba = img.convert("RGBA")
    arr = np.asarray(rgba).astype(np.int16)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]

    light = np.minimum(np.minimum(r, g), b) > 205
    neutral = (np.maximum(np.maximum(r, g), b) - np.minimum(np.minimum(r, g), b)) < 42
    candidate = light & neutral

    labels, _ = ndimage.label(candidate)
    border = np.unique(
        np.concatenate([labels[0, :], labels[-1, :], labels[:, 0], labels[:, -1]])
    )
    border = border[border != 0]
    background = np.isin(labels, border)

    # Remove 1px of the light fringe next to the outline, then soften the edge.
    foreground = ~background
    foreground = ndimage.binary_erosion(foreground, iterations=1)
    alpha = Image.fromarray((foreground * 255).astype(np.uint8)).filter(
        ImageFilter.GaussianBlur(0.8)
    )
    rgba.putalpha(alpha)
    return rgba


def split_poses(rgba: Image.Image, expected: int):
    """Split an expression sheet into one image per pose (left -> right)."""
    alpha = np.asarray(rgba)[..., 3] > 40
    merged = ndimage.binary_dilation(alpha, iterations=4)
    labels, count = ndimage.label(merged)
    sizes = ndimage.sum(alpha, labels, range(1, count + 1))
    keep = np.argsort(sizes)[::-1][:expected] + 1
    pieces = []
    for lab in keep:
        mask = (labels == lab) & alpha
        ys, xs = np.where(mask)
        box = (xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)
        piece = rgba.copy()
        a = np.asarray(piece)[..., 3].copy()
        a[~ndimage.binary_dilation(mask, iterations=3)] = 0
        piece.putalpha(Image.fromarray(a))
        pieces.append((box[0], piece.crop(box)))
    pieces.sort(key=lambda item: item[0])
    return [p for _, p in pieces]


def save(img: Image.Image, name: str):
    ratio = TARGET_HEIGHT / img.height
    img = img.resize((round(img.width * ratio), TARGET_HEIGHT), Image.LANCZOS)
    path = OUT / name
    img.save(path, optimize=True)
    print(f"{name:24s} {img.size}  {path.stat().st_size // 1024} KB")


def main():
    poses = ("happy", "thinking", "surprised")

    for who, filename in (("mal", "mal.jpg"), ("fania", "fania.jpeg")):
        sheet = remove_background(Image.open(SRC / filename))
        for pose, img in zip(poses, split_poses(sheet, 3)):
            save(img, f"{who}-{pose}.png")

    # The duo image is one picture of both mascots, so keep everything.
    duo = remove_background(Image.open(SRC / "fania & mal.jpg"))
    box = duo.getchannel("A").point(lambda v: 255 if v > 40 else 0).getbbox()
    save(duo.crop(box), "mal-and-fania.png")


if __name__ == "__main__":
    main()
