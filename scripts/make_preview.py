"""Wrap GitHub-rendered README HTML in a frame that resembles the profile page (dark / light).

    gh api markdown -F text=@README.md -f mode=gfm -f context=IwataHiroki0827/IwataHiroki0827 > rendered.html
    python scripts/make_preview.py rendered.html            # -> preview.html (gitignored)

The theme follows prefers-color-scheme, so emulate dark/light in the browser to see both.
Image paths stay relative, so open preview.html from the repository root.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

TEMPLATE = """<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>preview: IwataHiroki0827 profile README</title>
<style>
  :root { --bg:#ffffff; --fg:#1f2328; --muted:#59636e; --border:#d1d9e0; --box:#ffffff; --av:#eaeef2; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#0d1117; --fg:#f0f6fc; --muted:#9198a1; --border:#3d444d; --box:#0d1117; --av:#151b23; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg);
         font: 14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif; }
  .top { height:62px; border-bottom:1px solid var(--border); display:flex; align-items:center; padding:0 16px;
         color:var(--muted); font-size:13px; }
  .wrap { max-width:1280px; margin:0 auto; padding:24px 32px; display:flex; gap:24px; }
  .side { width:296px; flex:none; }
  .avatar { width:296px; height:296px; border-radius:50%; background:var(--av); border:1px solid var(--border); }
  .side h1 { font-size:24px; margin:16px 0 0; line-height:1.25; }
  .side .login { font-size:20px; font-weight:300; color:var(--muted); }
  .main { flex:1; min-width:0; }
  .box { border:1px solid var(--border); border-radius:6px; background:var(--box); padding:24px; }
  .box .label { font-size:12px; color:var(--muted); margin-bottom:12px; font-family: ui-monospace, Consolas, monospace; }
  .markdown-body p { margin:0 0 16px; }
  .markdown-body img { max-width:100%; box-sizing:content-box; }
  .markdown-body a { color:#4493f8; }
  @media (max-width: 767px) {
    .wrap { display:block; padding:16px; }
    .side { width:auto; display:flex; gap:16px; align-items:center; margin-bottom:16px; }
    .avatar { width:72px; height:72px; }
    .side h1 { margin:0; font-size:20px; }
    .box { padding:16px; }
  }
</style>
</head>
<body>
<div class="top">github.com/IwataHiroki0827 (preview)</div>
<div class="wrap">
  <aside class="side"><div class="avatar"></div><div><h1>ROKI_NUO_SAIKYOU</h1><div class="login">IwataHiroki0827</div></div></aside>
  <main class="main"><div class="box"><div class="label">IwataHiroki0827 / README.md</div>
  <article class="markdown-body">
__BODY__
  </article></div></main>
</div>
</body>
</html>
"""


def main() -> int:
    if len(sys.argv) < 2:
        print(__doc__)
        return 2
    body = Path(sys.argv[1]).read_text(encoding="utf-8")
    out = ROOT / "preview.html"
    out.write_text(TEMPLATE.replace("__BODY__", body), encoding="utf-8", newline="\n")
    print(f"wrote {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
