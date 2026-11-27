"""Render a 3D scene (model/scenes/<name>.mjs) to a looping GIF on the CPU, without a browser.

    python model/render_cpu.py --scene controller            # every scene: controller kyoto gpu octopus city
    python model/render_cpu.py --scene all                   # all scenes that need no data
    python model/render_cpu.py --scene city --data model/data/contrib.json --if-changed

Steps: node model/export_frames.mjs (three.js geometry -> screen-space triangles/lines)
       -> painter's algorithm with PIL at 2x -> bloom (threshold + blur) -> rounded card
       with transparent corners -> GIF (PIL, 1-bit transparency, one shared palette).
The card size, labels, colours and output path come from the scene's `meta`.
Needs: `npm install` (three), Pillow, numpy (see requirements.txt).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
SS = 2  # supersampling
STATIC_SCENES = ["controller", "kyoto", "gpu", "octopus"]
DEFAULTS = {
    "size": [300, 300],
    "frames": 60,
    "fps": 20,
    "colors": 96,
    "bgTop": [0x07, 0x0A, 0x18],
    "bgBottom": [0x16, 0x0A, 0x30],
    "glow": [115, 51, 230],
    "glowY": 0.38,
    "stars": 0,
    "border": [[0, 240, 255], [139, 92, 246], [255, 43, 214]],
    "labelLeft": "P1",
    "labelLeftColor": [255, 43, 214],
    "labelRight": "",
    "pins": [[0, 240, 255], [255, 43, 214], [255, 255, 255]],
}


def load_font(size: int) -> ImageFont.ImageFont:
    for name in ("consolab.ttf", "DejaVuSansMono-Bold.ttf", "LiberationMono-Bold.ttf"):
        try:
            return ImageFont.truetype(name, size)
        except OSError:
            continue
    return ImageFont.load_default()


def background(w: int, h: int, meta: dict) -> np.ndarray:
    top = np.array(meta["bgTop"], dtype=np.float32) / 255
    bot = np.array(meta["bgBottom"], dtype=np.float32) / 255
    t = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    grad = top * (1 - t) + bot * t
    img = np.broadcast_to(grad, (h, w, 3)).copy()
    # soft glow behind the model
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    r = np.hypot((xx - w / 2) / w, (yy - h * meta["glowY"]) / h)
    img += (np.clip(0.42 - r, 0, None) * 0.55)[..., None] * (np.array(meta["glow"], dtype=np.float32) / 255)
    # fixed star field (deterministic)
    rs = np.random.default_rng(11)
    for _ in range(int(meta["stars"])):
        x, y = int(rs.random() * w), int(rs.random() * h * 0.55)
        a = 0.35 + rs.random() * 0.5
        img[y : y + SS, x : x + SS] = img[y : y + SS, x : x + SS] * (1 - a) + a * np.array([0.85, 0.9, 1.0])
    return img


def render_frame(prims: list, w: int, h: int, bg: np.ndarray) -> Image.Image:
    W, H = w * SS, h * SS
    canvas = Image.fromarray((np.clip(bg, 0, 1) * 255).astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(canvas)
    for p in sorted(prims, key=lambda q: -q[1]):  # far -> near
        col = tuple(int(max(0.0, min(1.0, c)) * 255) for c in p[2])
        pts = [(p[i] * W, p[i + 1] * H) for i in range(3, len(p), 2)]
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
    return out.resize((w, h), Image.LANCZOS)


def card(frame: Image.Image, font: ImageFont.ImageFont, scan: float, meta: dict) -> Image.Image:
    w, h = frame.size
    rgba = frame.convert("RGBA")
    px = np.asarray(rgba).copy()
    if scan > 0:
        px[::3, :, :3] = (px[::3, :, :3].astype(np.float32) * (1 - scan)).astype(np.uint8)  # scanlines
    rgba = Image.fromarray(px, "RGBA")
    d = ImageDraw.Draw(rgba)
    # neon border: three-stop diagonal gradient, drawn as a ring
    ring = Image.new("L", (w, h), 0)
    ImageDraw.Draw(ring).rounded_rectangle([1, 1, w - 2, h - 2], radius=17, outline=255, width=2)
    tt = ((np.linspace(0, 1, w, dtype=np.float32)[None, :] + np.linspace(0, 1, h, dtype=np.float32)[:, None]) / 2)[..., None]
    c0, c1, c2 = (np.array(c, dtype=np.float32) for c in meta["border"])
    grad = np.where(tt < 0.5, c0 + (c1 - c0) * (tt * 2), c1 + (c2 - c1) * ((tt - 0.5) * 2))
    border = Image.fromarray(grad.astype(np.uint8), "RGB").convert("RGBA")
    rgba.paste(border, (0, 0), ring)
    d.text((14, 12), meta["labelLeft"], fill=(*meta["labelLeftColor"], 255), font=font)
    d.text((w - 14, 12), meta["labelRight"], fill=(138, 144, 184, 255), font=font, anchor="ra")
    # transparent outside the rounded card
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=18, fill=255)
    rgba.putalpha(mask)
    return rgba


def write_gif(frames: list[Image.Image], out: Path, colors: int, pins: list, fps: int, dither: bool) -> None:
    w, h = frames[0].size
    # one shared palette (from a few sampled frames) so colours do not flicker between frames
    picks = list(range(0, len(frames), max(1, len(frames) // 4)))[:4]
    sample = Image.new("RGB", (w * len(picks), h))
    for k, i in enumerate(picks):
        sample.paste(frames[i].convert("RGB"), (k * w, 0))
    # small but vivid accents get lost in median cut: pin them
    pal_img = sample.quantize(colors=colors - len(pins), method=Image.Quantize.MEDIANCUT)
    pal = pal_img.getpalette()[: (colors - len(pins)) * 3] + [v for c in pins for v in c]
    pal_img.putpalette(pal + [0, 0, 0] * (256 - colors))
    mode = Image.Dither.FLOYDSTEINBERG if dither else Image.Dither.NONE
    gif_frames = []
    prev = None
    for f in frames:
        q = f.convert("RGB").quantize(palette=pal_img, dither=mode)
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
    out.parent.mkdir(parents=True, exist_ok=True)
    gif_frames[0].save(
        out, save_all=True, append_images=gif_frames[1:], duration=round(1000 / fps), loop=0,
        transparency=255, disposal=1, optimize=False,
    )


def render(scene: str, args: argparse.Namespace) -> None:
    data_path = Path(args.data).resolve() if args.data else None
    with tempfile.TemporaryDirectory(prefix="roki-") as tmp:
        js = Path(tmp) / "frames.json"
        # meta first (1 frame) so --frames/--if-changed can use the scene's defaults
        cmd = ["node", str(ROOT / "model" / "export_frames.mjs"), scene, str(js)]
        meta0 = {**DEFAULTS}
        subprocess.run([*cmd, "1", *([str(data_path)] if data_path else [])], check=True, stdout=subprocess.DEVNULL)
        meta0.update(json.loads(js.read_text(encoding="utf-8"))["meta"])
        n = args.frames or meta0["frames"]
        out = ROOT / (args.out or meta0["out"])
        stamp = out.with_suffix(".json")
        digest = ""
        if data_path:
            h = hashlib.sha256(data_path.read_bytes())
            h.update(json.dumps(meta0, sort_keys=True).encode("utf-8"))
            h.update(str(n).encode("utf-8"))
            for src in ("export_frames.mjs", "render_cpu.py", f"scenes/{scene}.mjs", "scenes/common.mjs"):
                h.update((ROOT / "model" / src).read_bytes())
            digest = h.hexdigest()
            if args.if_changed and out.exists() and stamp.exists():
                if json.loads(stamp.read_text(encoding="utf-8")).get("sha256") == digest:
                    print(f"{out.relative_to(ROOT)}: input unchanged, skipped")
                    return
        subprocess.run([*cmd, str(n), *([str(data_path)] if data_path else [])], check=True)
        payload = json.loads(js.read_text(encoding="utf-8"))
    meta = {**DEFAULTS, **payload["meta"]}
    w, h = (args.size, args.size) if args.size else meta["size"]
    bg = background(w * SS, h * SS, meta)
    font = load_font(11)
    frames = [card(render_frame(p, w, h, bg), font, args.scanlines, meta) for p in payload["data"]]
    if args.png_dir:
        d = Path(args.png_dir) / scene
        d.mkdir(parents=True, exist_ok=True)
        for i, f in enumerate(frames):
            f.save(d / f"f{i:03d}.png")
    write_gif(frames, out, args.colors or meta["colors"], meta["pins"], args.fps or meta["fps"], args.dither)
    if digest:
        stamp.write_text(json.dumps({"sha256": digest, **meta.get("stamp", {})}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {out.relative_to(ROOT)} ({out.stat().st_size / 1024:.0f} KB, {len(frames)} frames, {w}x{h})")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--scene", default="controller", help="scene name in model/scenes/, or 'all' (scenes without data)")
    ap.add_argument("--data", default="", help="JSON passed to createScene (city: contribution calendar)")
    ap.add_argument("--if-changed", action="store_true", help="skip when the data and the renderer are unchanged")
    ap.add_argument("--size", type=int, default=0, help="square size override (default: scene meta)")
    ap.add_argument("--frames", type=int, default=0)
    ap.add_argument("--fps", type=int, default=0)
    ap.add_argument("--out", default="")
    ap.add_argument("--colors", type=int, default=0, help="palette size (<= 255; one slot is kept for transparency)")
    ap.add_argument("--scanlines", type=float, default=0.16, help="darkening of every third row (0 = off)")
    ap.add_argument("--dither", action="store_true", help="Floyd-Steinberg dithering (smoother, much larger file)")
    ap.add_argument("--png-dir", default="", help="also save each frame as PNG under <dir>/<scene>/")
    args = ap.parse_args()
    scenes = STATIC_SCENES if args.scene == "all" else [args.scene]
    for s in scenes:
        render(s, args)
    return 0


if __name__ == "__main__":
    sys.exit(main())
