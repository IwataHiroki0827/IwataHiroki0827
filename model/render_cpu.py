"""Render the 3D model GIF on the CPU without a browser (small memory footprint).

    python model/render_cpu.py [--size 300] [--frames 72] [--fps 24] [--out assets/model/roki-controller.gif]

Steps: node model/export_frames.mjs (three.js geometry -> screen-space triangles/lines)
       -> painter's algorithm with PIL at 2x -> bloom (threshold + blur) -> rounded card
       with transparent corners -> GIF (PIL, 1-bit transparency, adaptive palette).
Needs: `npm install` (three), Pillow, numpy.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SS = 2  # supersampling


def load_font(size: int) -> ImageFont.ImageFont:
    for name in ("consolab.ttf", "DejaVuSansMono-Bold.ttf", "LiberationMono-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def background(w: int, h: int) -> np.ndarray:
    top = np.array([0x07, 0x0A, 0x18], dtype=np.float32) / 255
    bot = np.array([0x16, 0x0A, 0x30], dtype=np.float32) / 255
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    grad = top * (1 - t) + bot * t
    img = np.broadcast_to(grad, (h, w, 3)).copy()
    # soft violet glow behind the controller
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx - w / 2) / w, (yy - h * 0.38) / h)
    img += (np.clip(0.42 - r, 0, None) * 0.55)[..., None] * np.array([0.45, 0.2, 0.9], dtype=np.float32)
    return img


def render_frame(prims: list, size: int, bg: np.ndarray) -> Image.Image:
    W = size * SS
    canvas = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(canvas)
    for p in sorted(prims, key=lambda q: -q[1]):  # far -> near
        col = tuple(int(max(0.0, min(1.0, c)) * 255) for c in p[2])
        pts = [(p[i] * W, p[i + 1] * W) for i in range(3, len(p), 2)]
        if p[0] == 0:
            draw.polygon(pts, fill=col)
        else:
            draw.line(pts, fill=col, width=SS + 1)
    img = np.asarray(canvas, dtype=np.float32) / 255
    # bloom: bright parts blurred at two radii and added back
    lum = img.max(axis=2, keepdims=True)
    bright = img * np.clip((lum - 0.45) / 0.55, 0, 1)
    b8 = Image.fromarray((bright * 255).astype(np.uint8), "RGB")
    g1 = np.asarray(b8.filter(ImageFilter.GaussianBlur(3 * SS)), dtype=np.float32) / 255
    g2 = np.asarray(b8.filter(ImageFilter.GaussianBlur(9 * SS)), dtype=np.float32) / 255
    img = 1 - (1 - img) * (1 - np.clip(g1 * 1.1, 0, 1)) * (1 - np.clip(g2 * 0.9, 0, 1))  # screen blend
    out = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8), "RGB")
    return out.resize((size, size), Image.LANCZOS)


def card(frame: Image.Image, font: ImageFont.ImageFont, scan: float) -> Image.Image:
    size = frame.width
    rgba = frame.convert("RGBA")
    px = np.asarray(rgba).copy()
    if scan > 0:
        px[::3, :, :3] = (px[::3, :, :3].astype(np.float32) * (1 - scan)).astype(np.uint8)  # scanlines
    rgba = Image.fromarray(px, "RGBA")
    d = ImageDraw.Draw(rgba)
    # neon border: gradient cyan -> violet -> magenta, drawn as a ring
    ring = Image.new("L", (size, size), 0)
    ImageDraw.Draw(ring).rounded_rectangle([1, 1, size - 2, size - 2], radius=17, outline=255, width=2)
    t = np.linspace(0, 1, size, dtype=np.float32)
    tt = (t[None, :] + t[:, None]) / 2
    c0, c1, c2 = (np.array(c, dtype=np.float32) for c in ((0, 240, 255), (139, 92, 246), (255, 43, 214)))
    grad = np.where(tt[..., None] < 0.5, c0 + (c1 - c0) * (tt[..., None] * 2), c1 + (c2 - c1) * ((tt[..., None] - 0.5) * 2))
    border = Image.fromarray(grad.astype(np.uint8), "RGB").convert("RGBA")
    rgba.paste(border, (0, 0), ring)
    d.text((14, 12), "P1", fill=(255, 43, 214, 255), font=font)
    d.text((size - 14, 12), "ROKI.SYS", fill=(138, 144, 184, 255), font=font, anchor="ra")
    # transparent outside the rounded card
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, size - 1, size - 1], radius=18, fill=255)
    rgba.putalpha(mask)
    return rgba


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--size", type=int, default=300)
    ap.add_argument("--frames", type=int, default=60)
    ap.add_argument("--fps", type=int, default=20)
    ap.add_argument("--out", default="assets/model/roki-controller.gif")
    ap.add_argument("--colors", type=int, default=96, help="palette size (<= 255; one slot is kept for transparency)")
    ap.add_argument("--scanlines", type=float, default=0.16, help="darkening of every third row (0 = off)")
    ap.add_argument("--dither", action="store_true", help="Floyd-Steinberg dithering (smoother, much larger file)")
    ap.add_argument("--png-dir", default="", help="also save each frame as PNG here")
    args = ap.parse_args()

    with tempfile.TemporaryDirectory(prefix="roki-") as tmp:
        js = Path(tmp) / "frames.json"
        subprocess.run(["node", str(ROOT / "model" / "export_frames.mjs"), str(js), str(args.frames)], check=True)
        data = json.loads(js.read_text(encoding="utf-8"))["data"]

    bg = background(args.size * SS, args.size * SS)
    font = load_font(11)
    frames = [card(render_frame(p, args.size, bg), font, args.scanlines) for p in data]
    if args.png_dir:
        d = Path(args.png_dir)
        d.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(frames):
            f.save(d / f"f{i:03d}.png")

    # one shared palette (from a few sampled frames) so colours do not flicker between frames
    sample = Image.new("RGB", (args.size * 4, args.size))
    for k, i in enumerate(range(0, len(frames), max(1, len(frames) // 4))):
        if k < 4:
            sample.paste(frames[i].convert("RGB"), (k * args.size, 0))
    # small but vivid accents (lime / amber crystals, buttons) get lost in median cut: pin them
    pinned = [(163, 255, 18), (120, 200, 20), (255, 176, 32), (200, 140, 30), (0, 240, 255), (255, 43, 214), (255, 255, 255)]
    pal_img = sample.quantize(colors=args.colors - len(pinned), method=Image.Quantize.MEDIANCUT)
    pal = pal_img.getpalette()[: (args.colors - len(pinned)) * 3] + [v for c in pinned for v in c]
    pal_img.putpalette(pal + [0, 0, 0] * (256 - args.colors))
    dither = Image.Dither.FLOYDSTEINBERG if args.dither else Image.Dither.NONE
    gif_frames = []
    prev = None
    for f in frames:
        q = f.convert("RGB").quantize(palette=pal_img, dither=dither)
        alpha = np.asarray(f)[:, :, 3]
        full = np.asarray(q).copy()
        full[alpha < 128] = 255  # index 255 = transparent
        qa = full.copy()
        if prev is not None:
            qa[full == prev] = 255  # unchanged since the previous frame: keep it (disposal=1)
        prev = full
        g = Image.fromarray(qa, "P")
        g.putpalette(pal_img.getpalette()[: 255 * 3] + [0, 0, 0])
        g.info["transparency"] = 255
        gif_frames.append(g)
    out = ROOT / args.out
    out.parent.mkdir(parents=True, exist_ok=True)
    gif_frames[0].save(
        out, save_all=True, append_images=gif_frames[1:], duration=round(1000 / args.fps), loop=0,
        transparency=255, disposal=1, optimize=False,
    )
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB, {len(frames)} frames)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
