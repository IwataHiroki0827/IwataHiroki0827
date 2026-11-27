// Shared pieces for the self-hosted SVGs (build-svgs.mjs, spotify.mjs). No npm dependencies.
// Rule: never put HTML tags inside <text>; use <tspan> for emphasis.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const OUT = join(ROOT, "assets", "generated");
export const MONO = "ui-monospace, SFMono-Regular, 'Cascadia Mono', Consolas, 'Liberation Mono', Menlo, monospace";
export const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', Meiryo, sans-serif";
export const C = {
  bg0: "#070a18",
  bg1: "#140a2e",
  panel: "#0b1022",
  line: "#2a2f55",
  cyan: "#00f0ff",
  violet: "#8b5cf6",
  magenta: "#ff2bd6",
  lime: "#a3ff12",
  amber: "#ffb020",
  coral: "#ff8c69",
  text: "#e6e9ff",
  dim: "#8a90b8",
};

/** XML-escape text content / attribute values. */
export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);

/** Display width in "half-width cells" (CJK / full-width = 2). */
export function cells(str) {
  let n = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const wide = cp >= 0x2e80 && !(cp >= 0xff61 && cp <= 0xff9f);
    n += wide ? 2 : 1;
  }
  return n;
}

/** Truncate to max cells, adding an ellipsis. */
export function clip(str, max) {
  if (cells(str) <= max) return str;
  let out = "";
  for (const ch of str) {
    if (cells(out + ch) > max - 1) break;
    out += ch;
  }
  return out + "…";
}

// Pass `area` ({ w, h }) for thin lines: a bbox-relative filter region on a 0-2px tall shape
// is empty or clips the blur, so the line vanishes. userSpaceOnUse covers the whole canvas instead.
export const glowFilter = (id, std = 4, area = null) => `
    <filter id="${id}" ${area ? `filterUnits="userSpaceOnUse" x="0" y="0" width="${area.w}" height="${area.h}"` : `x="-30%" y="-80%" width="160%" height="260%"`}>
      <feGaussianBlur stdDeviation="${std}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;

export const neonGradient = (id) => `
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.cyan}"/>
      <stop offset="0.5" stop-color="${C.violet}"/>
      <stop offset="1" stop-color="${C.magenta}"/>
    </linearGradient>`;

export const scanlines = (id) => `
    <pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#000" opacity="0.28"/>
    </pattern>`;

/** Write an SVG into assets/generated after the "no HTML inside <text>" check. */
export async function writeSvg(name, svg) {
  if (/<text[^>]*>[^<]*<(b|strong|code|i|em|p|table)\b/i.test(svg)) throw new Error(`HTML tag inside <text> in ${name}`);
  await mkdir(OUT, { recursive: true });
  await writeFile(join(OUT, name), svg, "utf-8");
  console.log(`wrote assets/generated/${name} (${svg.length} bytes)`);
}

export const readConfig = async () => JSON.parse(await readFile(join(ROOT, "profile.config.json"), "utf-8"));

/**
 * Replace generated blocks in README.md:  <!-- gen:NAME -->...<!-- /gen:NAME -->
 * Returns true when README.md changed.
 */
export async function patchReadme(blocks) {
  const file = join(ROOT, "README.md");
  const before = await readFile(file, "utf-8");
  let after = before;
  for (const [name, body] of Object.entries(blocks)) {
    const re = new RegExp(`(<!-- gen:${name} -->)[\\s\\S]*?(<!-- /gen:${name} -->)`);
    if (!re.test(after)) throw new Error(`README.md has no <!-- gen:${name} --> block`);
    after = after.replace(re, (_, a, b) => `${a}\n${body}\n${b}`);
  }
  if (after === before) return false;
  await writeFile(file, after, "utf-8");
  console.log(`patched README.md: ${Object.keys(blocks).join(", ")}`);
  return true;
}
