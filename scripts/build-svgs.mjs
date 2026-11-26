#!/usr/bin/env node
// Builds the self-hosted SVGs for the profile README (no npm dependencies).
//
//   node scripts/build-svgs.mjs            # header / typing / headings only (no network)
//   GITHUB_TOKEN=... node scripts/build-svgs.mjs   # + status card and stage cards (GitHub GraphQL)
//
// Output: assets/generated/*.svg
// Rule: never put HTML tags inside <text>; use <tspan> for emphasis.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "assets", "generated");
const MONO = "ui-monospace, SFMono-Regular, 'Cascadia Mono', Consolas, 'Liberation Mono', Menlo, monospace";
const C = {
  bg0: "#070a18",
  bg1: "#140a2e",
  panel: "#0b1022",
  line: "#2a2f55",
  cyan: "#00f0ff",
  violet: "#8b5cf6",
  magenta: "#ff2bd6",
  lime: "#a3ff12",
  amber: "#ffb020",
  text: "#e6e9ff",
  dim: "#8a90b8",
};

/** XML-escape text content / attribute values. */
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[ch]);

/** Display width in "half-width cells" (CJK / full-width = 2). */
function cells(str) {
  let n = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    const wide = cp >= 0x2e80 && !(cp >= 0xff61 && cp <= 0xff9f);
    n += wide ? 2 : 1;
  }
  return n;
}

/** Truncate to max cells, adding an ellipsis. */
function clip(str, max) {
  if (cells(str) <= max) return str;
  let out = "";
  for (const ch of str) {
    if (cells(out + ch) > max - 1) break;
    out += ch;
  }
  return out + "…";
}

const glowFilter = (id, std = 4) => `
    <filter id="${id}" x="-30%" y="-80%" width="160%" height="260%">
      <feGaussianBlur stdDeviation="${std}" result="b"/>
      <feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>`;

const neonGradient = (id) => `
    <linearGradient id="${id}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="${C.cyan}"/>
      <stop offset="0.5" stop-color="${C.violet}"/>
      <stop offset="1" stop-color="${C.magenta}"/>
    </linearGradient>`;

const scanlines = (id) => `
    <pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" fill="#000" opacity="0.28"/>
    </pattern>`;

// ---------------------------------------------------------------- header
function headerSvg(cfg) {
  const W = 1200;
  const H = 300;
  const horizon = 196;
  const vx = W / 2;
  // perspective floor: vertical rays
  const rays = [];
  for (let i = -12; i <= 12; i++) {
    const xb = vx + i * 110;
    rays.push(`<line x1="${vx}" y1="${horizon}" x2="${xb}" y2="${H}"/>`);
  }
  // perspective floor: scrolling horizontal lines (SMIL, sampled curve)
  const N = 7;
  const SAMPLES = 12;
  const rows = [];
  for (let k = 0; k < N; k++) {
    const ys = [];
    for (let s = 0; s <= SAMPLES; s++) {
      const t = (k + s / SAMPLES) / N;
      ys.push((horizon + (H - horizon) * t * t).toFixed(1));
    }
    const v = ys.join(";");
    rows.push(
      `<line x1="0" x2="${W}" y1="${ys[0]}" y2="${ys[0]}">` +
        `<animate attributeName="y1" values="${v}" dur="2.4s" repeatCount="indefinite"/>` +
        `<animate attributeName="y2" values="${v}" dur="2.4s" repeatCount="indefinite"/></line>`,
    );
  }
  // stars (deterministic)
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = [];
  for (let i = 0; i < 46; i++) {
    const x = (rnd() * W).toFixed(0);
    const y = (rnd() * (horizon - 30)).toFixed(0);
    const r = (0.6 + rnd() * 1.2).toFixed(1);
    const d = (1.5 + rnd() * 3).toFixed(1);
    stars.push(
      `<circle cx="${x}" cy="${y}" r="${r}"><animate attributeName="opacity" values="0.2;1;0.2" dur="${d}s" repeatCount="indefinite"/></circle>`,
    );
  }
  // retro sun with cut stripes
  const sunR = 88;
  const sunStripes = [0, 1, 2, 3, 4]
    .map((i) => `<rect x="${vx - sunR}" y="${horizon - 44 + i * 9}" width="${sunR * 2}" height="${2 + i}" fill="${C.bg1}"/>`)
    .join("");

  const name = cfg.displayName;
  const titleLen = Math.min(900, name.length * 54);
  const title = (extra) =>
    `<text x="${vx}" y="128" text-anchor="middle" font-family="${MONO}" font-size="74" font-weight="800" textLength="${titleLen}" lengthAdjust="spacingAndGlyphs" ${extra}>${esc(name)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">${esc(name)} — PLAYER 1 / @${esc(cfg.user)}</title>
  <style>
    .blink { animation: blink 1.1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
    .gl1 { animation: g1 3.6s steps(1) infinite; }
    .gl2 { animation: g2 3.6s steps(1) infinite; }
    @keyframes g1 { 0%,86%,100% { transform: translate(0,0); opacity: 0; } 88% { transform: translate(-6px,2px); opacity: .9; } 91% { transform: translate(5px,-1px); opacity: .9; } 94% { transform: translate(-3px,0); opacity: .7; } }
    @keyframes g2 { 0%,86%,100% { transform: translate(0,0); opacity: 0; } 88% { transform: translate(6px,-2px); opacity: .9; } 91% { transform: translate(-5px,1px); opacity: .9; } 94% { transform: translate(3px,0); opacity: .7; } }
    .flicker { animation: fl 5s linear infinite; }
    @keyframes fl { 0%,40%,44%,100% { opacity: 1; } 42% { opacity: .55; } 70% { opacity: .9; } }
  </style>
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.bg0}"/>
      <stop offset="0.65" stop-color="${C.bg1}"/>
      <stop offset="1" stop-color="#05040d"/>
    </linearGradient>
    <linearGradient id="sun" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.amber}"/>
      <stop offset="1" stop-color="${C.magenta}"/>
    </linearGradient>
    <linearGradient id="floorFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${C.bg1}" stop-opacity="1"/>
      <stop offset="0.35" stop-color="${C.bg1}" stop-opacity="0"/>
    </linearGradient>
    ${neonGradient("neon")}
    ${glowFilter("glow", 5)}
    ${glowFilter("soft", 2.5)}
    ${scanlines("scan")}
    <clipPath id="card"><rect width="${W}" height="${H}" rx="20"/></clipPath>
    <clipPath id="sky"><rect width="${W}" height="${horizon}"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <g fill="#cfe9ff">${stars.join("")}</g>
    <g clip-path="url(#sky)" opacity="0.85">
      <circle cx="${vx}" cy="${horizon}" r="${sunR}" fill="url(#sun)" filter="url(#soft)"/>
      ${sunStripes}
    </g>
    <g stroke="${C.magenta}" stroke-width="1.4" opacity="0.75" filter="url(#soft)">
      ${rays.join("\n      ")}
      ${rows.join("\n      ")}
    </g>
    <rect y="${horizon}" width="${W}" height="${H - horizon}" fill="url(#floorFade)"/>
    <line x1="0" x2="${W}" y1="${horizon}" y2="${horizon}" stroke="${C.cyan}" stroke-width="2" filter="url(#glow)"/>

    <g font-family="${MONO}" font-size="16" font-weight="700" letter-spacing="3">
      <text x="34" y="44" fill="${C.magenta}">1UP</text>
      <text x="34" y="66" fill="${C.text}">@${esc(cfg.user)}</text>
      <text x="${W - 34}" y="44" fill="${C.cyan}" text-anchor="end">CREDIT 01</text>
    </g>

    <g class="gl1" opacity="0">${title(`fill="${C.cyan}"`)}</g>
    <g class="gl2" opacity="0">${title(`fill="${C.magenta}"`)}</g>
    <g class="flicker">${title(`fill="url(#neon)" filter="url(#glow)"`)}</g>
    ${title(`fill="none" stroke="#ffffff" stroke-opacity="0.35" stroke-width="1"`)}

    <text x="${vx}" y="166" text-anchor="middle" font-family="${MONO}" font-size="18" letter-spacing="8" fill="${C.text}">PLAYER 1  <tspan fill="${C.cyan}">▸</tspan>  READY</text>
    <g class="blink"><text x="${vx}" y="272" text-anchor="middle" font-family="${MONO}" font-size="20" font-weight="700" letter-spacing="6" fill="#ffffff" filter="url(#soft)">▶ PRESS START</text></g>

    <rect width="${W}" height="${H}" fill="url(#scan)"/>
  </g>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="19" fill="none" stroke="url(#neon)" stroke-width="2" opacity="0.9"/>
</svg>
`;
}

// ---------------------------------------------------------------- typing terminal
function typingSvg(cfg) {
  const W = 900;
  const lines = cfg.terminal;
  const fs = 18;
  const cw = 10.8; // forced cell width via textLength
  const lh = 32;
  const top = 74;
  const H = top + lines.length * lh + 16;
  const prompt = "$ ";
  const charDur = 0.055;
  const pauseAfterCmd = 0.5;
  const hold = 4;

  // schedule
  let t = 0.6;
  const sched = lines.map((ln) => {
    const isCmd = "cmd" in ln;
    const text = isCmd ? ln.cmd : ln.out;
    const n = [...text].length;
    const start = t;
    const end = isCmd ? start + n * charDur : start; // outputs appear at once
    t = end + (isCmd ? pauseAfterCmd : 0.35);
    return { isCmd, text, n, start, end };
  });
  const total = t + hold;
  const kt = (x) => (x / total).toFixed(4);

  const body = sched
    .map((s, i) => {
      const y = top + i * lh;
      const x0 = 28;
      const px = s.isCmd ? x0 + cells(prompt) * cw : x0;
      const w = cells(s.text) * cw;
      const clipId = `c${i}`;
      // width keyframes (discrete): 0 until start, char-by-char for commands, full until end of cycle
      let values = ["0"];
      let times = ["0"];
      if (s.isCmd) {
        const chars = [...s.text];
        let acc = 0;
        chars.forEach((ch, j) => {
          acc += cells(ch) * cw;
          values.push(acc.toFixed(1));
          times.push(kt(s.start + j * charDur));
        });
      } else {
        values.push(w.toFixed(1));
        times.push(kt(s.start));
      }
      const promptEl = s.isCmd
        ? `<text x="${x0}" y="${y}" fill="${C.lime}" font-weight="700" opacity="0"><animate attributeName="opacity" values="0;1" keyTimes="0;${kt(s.start - 0.15)}" calcMode="discrete" dur="${total.toFixed(2)}s" repeatCount="indefinite"/>${esc(prompt.trim())}</text>`
        : "";
      const fill = s.isCmd ? C.text : C.cyan;
      return `
    <clipPath id="${clipId}"><rect x="${px}" y="${y - fs - 4}" width="0" height="${lh}"><animate attributeName="width" values="${values.join(";")}" keyTimes="${times.join(";")}" calcMode="discrete" dur="${total.toFixed(2)}s" repeatCount="indefinite"/></rect></clipPath>
    ${promptEl}
    <text x="${px}" y="${y}" fill="${fill}" textLength="${w.toFixed(1)}" lengthAdjust="spacingAndGlyphs" clip-path="url(#${clipId})">${esc(s.text)}</text>`;
    })
    .join("");

  // cursor: follows the end of the currently typed command, sits on the next prompt line at the end
  const cx = [];
  const cy = [];
  const ct = [];
  sched.forEach((s, i) => {
    const y = top + i * lh;
    const base = 28 + (s.isCmd ? cells(prompt) * cw : 0);
    if (!s.isCmd) return;
    let acc = 0;
    [...s.text].forEach((ch, j) => {
      acc += cells(ch) * cw;
      cx.push((base + acc + 2).toFixed(1));
      cy.push(y - fs + 2);
      ct.push(kt(s.start + j * charDur));
    });
  });
  const lastY = top + sched.length * lh;
  // initial and final positions
  const firstBase = 28 + cells(prompt) * cw;
  const xs = [firstBase.toFixed(1), ...cx, "28"];
  const ys = [top - fs + 2, ...cy, lastY - fs + 2];
  const ts = ["0", ...ct, kt(sched[sched.length - 1].start + 0.4)];

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">${esc(sched.map((s) => (s.isCmd ? prompt + s.text : s.text)).join(" / "))}</title>
  <style>
    .cur { animation: blink 0.9s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
  <defs>
    ${neonGradient("neon")}
    ${scanlines("scan")}
    <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <rect width="${W}" height="36" fill="#141a36"/>
    <circle cx="22" cy="18" r="6" fill="#ff5f57"/><circle cx="42" cy="18" r="6" fill="#febc2e"/><circle cx="62" cy="18" r="6" fill="#28c840"/>
    <text x="${W / 2}" y="23" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${C.dim}" letter-spacing="1">roki@player1: ~</text>
    <g font-family="${MONO}" font-size="${fs}" xml:space="preserve">${body}
    </g>
    <rect class="cur" x="${xs[0]}" y="${ys[0]}" width="10" height="${fs + 2}" fill="${C.magenta}">
      <animate attributeName="x" values="${xs.join(";")}" keyTimes="${ts.join(";")}" calcMode="discrete" dur="${total.toFixed(2)}s" repeatCount="indefinite"/>
      <animate attributeName="y" values="${ys.join(";")}" keyTimes="${ts.join(";")}" calcMode="discrete" dur="${total.toFixed(2)}s" repeatCount="indefinite"/>
    </rect>
    <rect width="${W}" height="${H}" fill="url(#scan)"/>
  </g>
  <rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13" fill="none" stroke="url(#neon)" stroke-width="1.5" opacity="0.8"/>
</svg>
`;
}

// ---------------------------------------------------------------- neon section heading
function headingSvg(label, sub) {
  const W = 900;
  const H = 64;
  const len = Math.min(560, cells(label) * 26);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">${esc(label)}</title>
  <style>
    .flicker { animation: fl 6s linear infinite; }
    @keyframes fl { 0%,30%,33%,36%,100% { opacity: 1; } 31.5% { opacity: .35; } 34.5% { opacity: .6; } }
    .sweep { animation: sw 3.2s ease-in-out infinite; }
    @keyframes sw { 0% { transform: translateX(-140px); } 100% { transform: translateX(${W + 140}px); } }
  </style>
  <defs>
    ${neonGradient("neon")}
    ${glowFilter("glow", 4)}
    <clipPath id="card"><rect width="${W}" height="${H}" rx="12"/></clipPath>
    <linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <g class="sweep"><rect x="-120" width="120" height="${H}" fill="url(#shine)"/></g>
    <g stroke="url(#neon)" stroke-width="2" filter="url(#glow)">
      <line x1="24" x2="${W / 2 - len / 2 - 24}" y1="${H / 2}" y2="${H / 2}"/>
      <line x1="${W / 2 + len / 2 + 24}" x2="${W - 24}" y1="${H / 2}" y2="${H / 2}"/>
    </g>
    <g class="flicker"><text x="${W / 2}" y="${H / 2 + 10}" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="800" letter-spacing="4" fill="url(#neon)" filter="url(#glow)" textLength="${len}" lengthAdjust="spacingAndGlyphs">${esc(label)}</text></g>
    ${sub ? `<text x="${W - 24}" y="${H - 8}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.dim}" letter-spacing="2">${esc(sub)}</text>` : ""}
  </g>
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="11.5" fill="none" stroke="${C.line}" stroke-width="1.5"/>
</svg>
`;
}

// ---------------------------------------------------------------- GitHub data
async function fetchStats(user, token) {
  const query = `query($login:String!){
    user(login:$login){
      createdAt
      contributionsCollection{
        contributionCalendar{ totalContributions weeks{ contributionDays{ contributionCount date } } }
        totalCommitContributions totalPullRequestContributions totalIssueContributions
      }
      repositories(ownerAffiliations:OWNER, isFork:false, privacy:PUBLIC, first:100){
        totalCount
        nodes{ name description stargazerCount forkCount pushedAt
          primaryLanguage{ name color }
          languages(first:10, orderBy:{field:SIZE, direction:DESC}){ edges{ size node{ name color } } } }
      }
    }
  }`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { Authorization: `bearer ${token}`, "Content-Type": "application/json", "User-Agent": "profile-svg-builder" },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  if (!res.ok) throw new Error(`GraphQL HTTP ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(`GraphQL: ${JSON.stringify(json.errors).slice(0, 300)}`);
  const u = json.data.user;
  const cc = u.contributionsCollection;
  const repos = u.repositories.nodes;
  const lang = new Map();
  for (const r of repos)
    for (const e of r.languages.edges) {
      const cur = lang.get(e.node.name) ?? { size: 0, color: e.node.color ?? C.dim };
      cur.size += e.size;
      lang.set(e.node.name, cur);
    }
  const langTotal = [...lang.values()].reduce((a, b) => a + b.size, 0) || 1;
  const languages = [...lang.entries()]
    .map(([name, v]) => ({ name, color: v.color, pct: (v.size / langTotal) * 100 }))
    .sort((a, b) => b.pct - a.pct);
  // current streak (days with >=1 contribution, counting back from today/yesterday)
  const days = cc.contributionCalendar.weeks.flatMap((w) => w.contributionDays);
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].contributionCount > 0) streak++;
    else if (i === days.length - 1) continue; // today may still be empty
    else break;
  }
  return {
    createdAt: u.createdAt,
    contributions: cc.contributionCalendar.totalContributions,
    commits: cc.totalCommitContributions,
    prs: cc.totalPullRequestContributions,
    issues: cc.totalIssueContributions,
    repoCount: u.repositories.totalCount,
    stars: repos.reduce((a, r) => a + r.stargazerCount, 0),
    streak,
    languages,
    repos: Object.fromEntries(repos.map((r) => [r.name, r])),
  };
}

/** Next "round" cap above v for bar maxima: 10, 20, 50, 100, 200, 500 ... */
function cap(v) {
  const steps = [1, 2, 5];
  let p = 1;
  for (;;) {
    for (const s of steps) if (s * p > v) return s * p;
    p *= 10;
  }
}

// ---------------------------------------------------------------- status card
function statusSvg(cfg, st) {
  const W = 520;
  const H = 320;
  const since = new Date(st.createdAt);
  const level = Math.max(1, new Date().getUTCFullYear() - since.getUTCFullYear());
  const cls = st.languages.slice(0, 2).map((l) => l.name).join(" / ") || "—";
  const bar = (y, label, value, color) => {
    const max = cap(value);
    const bw = 250;
    const fw = Math.max(4, (value / max) * bw);
    return `
    <text x="26" y="${y}" fill="${color}" font-weight="800">${esc(label)}</text>
    <rect x="80" y="${y - 12}" width="${bw}" height="14" rx="3" fill="#1a2044" stroke="${C.line}"/>
    <rect x="80" y="${y - 12}" width="0" height="14" rx="3" fill="${color}">
      <animate attributeName="width" from="0" to="${fw.toFixed(1)}" dur="1.2s" fill="freeze"/>
    </rect>
    <text x="${80 + bw + 12}" y="${y}" fill="${C.text}">${value}<tspan fill="${C.dim}"> / ${max}</tspan></text>`;
  };
  const skills = st.languages.slice(0, 4).map((l, i) => {
    const y = 236 + i * 18;
    const bw = 150;
    return `
    <circle cx="32" cy="${y - 4}" r="4" fill="${esc(l.color)}"/>
    <text x="44" y="${y}" fill="${C.text}" font-size="12">${esc(clip(l.name, 12))}</text>
    <rect x="140" y="${y - 9}" width="${bw}" height="7" rx="2" fill="#1a2044"/>
    <rect x="140" y="${y - 9}" width="${Math.max(2, (l.pct / 100) * bw).toFixed(1)}" height="7" rx="2" fill="${esc(l.color)}"/>
    <text x="${140 + bw + 8}" y="${y}" fill="${C.dim}" font-size="11">${l.pct.toFixed(1)}%</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">STATUS: ${st.contributions} contributions in the last year, ${st.commits} commits, ${st.prs} pull requests, ${st.repoCount} public repositories, ${st.stars} stars</title>
  <style>
    .blink { animation: blink 1s steps(1) infinite; }
    @keyframes blink { 50% { opacity: 0; } }
  </style>
  <defs>
    ${neonGradient("neon")}
    ${glowFilter("glow", 3)}
    ${scanlines("scan")}
    <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#card)" font-family="${MONO}" font-size="14">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="#dfe4ff" stroke-opacity="0.75" stroke-width="2"/>
    <text x="26" y="44" font-size="20" font-weight="800" letter-spacing="3" fill="url(#neon)" filter="url(#glow)">STATUS</text>
    <text x="${W - 26}" y="44" text-anchor="end" fill="${C.dim}" font-size="12">since ${since.toISOString().slice(0, 7)}</text>

    <text x="26" y="78" fill="${C.text}" font-size="16" font-weight="700">${esc(cfg.displayName)}</text>
    <text x="${W - 26}" y="78" text-anchor="end" fill="${C.amber}" font-weight="800">LV ${level}</text>
    <text x="26" y="100" fill="${C.dim}" font-size="12">CLASS  <tspan fill="${C.cyan}">${esc(cls)}</tspan></text>
    ${bar(136, "HP", st.contributions, C.lime)}
    ${bar(162, "MP", st.commits, C.cyan)}
    ${bar(188, "EXP", st.prs + st.issues, C.magenta)}
    <text x="26" y="214" fill="${C.dim}" font-size="11">HP=contributions(1y)  MP=commits(1y)  EXP=PR+issues(1y)</text>
    ${skills.join("")}
    <g font-size="12">
      <text x="${W - 26}" y="236" text-anchor="end" fill="${C.dim}">REPOS <tspan fill="${C.text}" font-weight="700">${st.repoCount}</tspan></text>
      <text x="${W - 26}" y="256" text-anchor="end" fill="${C.dim}">STARS <tspan fill="${C.amber}" font-weight="700">★ ${st.stars}</tspan></text>
      <text x="${W - 26}" y="276" text-anchor="end" fill="${C.dim}">STREAK <tspan fill="${C.lime}" font-weight="700">${st.streak}d</tspan></text>
    </g>
    <text x="${W - 26}" y="${H - 22}" text-anchor="end" fill="${C.text}" font-size="11" class="blink">▼</text>
    <rect width="${W}" height="${H}" fill="url(#scan)"/>
  </g>
</svg>
`;
}

// ---------------------------------------------------------------- stage card
function stageSvg(index, stage, repo) {
  const W = 420;
  const H = 132;
  const desc = clip(stage.description ?? repo?.description ?? "", 56);
  const lang = repo?.primaryLanguage;
  const no = String(index + 1).padStart(2, "0");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">STAGE ${no}: ${esc(stage.repo)}${desc ? " — " + esc(desc) : ""}</title>
  <style>
    .pulse { animation: p 2.4s ease-in-out infinite; }
    @keyframes p { 0%,100% { opacity: .55; } 50% { opacity: 1; } }
  </style>
  <defs>
    ${neonGradient("neon")}
    ${glowFilter("glow", 3)}
    ${scanlines("scan")}
    <clipPath id="card"><rect width="${W}" height="${H}" rx="12"/></clipPath>
  </defs>
  <g clip-path="url(#card)" font-family="${MONO}">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <rect width="6" height="${H}" fill="url(#neon)"/>
    <text x="24" y="30" font-size="12" font-weight="800" letter-spacing="3" fill="${C.magenta}">STAGE ${no}</text>
    <text x="${W - 18}" y="30" text-anchor="end" font-size="12" fill="${C.amber}">★ ${repo?.stargazerCount ?? 0}</text>
    <text x="24" y="62" font-size="20" font-weight="800" fill="${C.text}" ${cells(stage.repo) > 26 ? `textLength="${W - 48}" lengthAdjust="spacingAndGlyphs"` : ""}>${esc(stage.repo)}</text>
    <text x="24" y="88" font-size="13" fill="${C.dim}">${esc(desc)}</text>
    ${lang ? `<circle cx="29" cy="111" r="5" fill="${esc(lang.color ?? C.dim)}"/><text x="40" y="115" font-size="12" fill="${C.text}">${esc(lang.name)}</text>` : ""}
    <text x="${W - 18}" y="115" text-anchor="end" font-size="12" font-weight="700" fill="${C.cyan}" class="pulse">ENTER ▶</text>
    <rect width="${W}" height="${H}" fill="url(#scan)"/>
  </g>
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="11.5" fill="none" stroke="${C.line}" stroke-width="1.5"/>
</svg>
`;
}

// ---------------------------------------------------------------- main
async function main() {
  const cfg = JSON.parse(await readFile(join(ROOT, "profile.config.json"), "utf-8"));
  cfg.terminal = cfg.terminal.map((ln) =>
    Object.fromEntries(Object.entries(ln).map(([k, v]) => [k, String(v).replaceAll("{tagline}", cfg.tagline ?? "")])),
  );
  await mkdir(OUT, { recursive: true });
  const write = async (name, svg) => {
    if (/<text[^>]*>[^<]*<(b|strong|code|i|em|p|table)\b/i.test(svg)) throw new Error(`HTML tag inside <text> in ${name}`);
    await writeFile(join(OUT, name), svg, "utf-8");
    console.log(`wrote assets/generated/${name} (${svg.length} bytes)`);
  };

  await write("header.svg", headerSvg(cfg));
  await write("typing.svg", typingSvg(cfg));
  await write("h-status.svg", headingSvg("PLAYER STATUS", "updated daily by GitHub Actions"));
  await write("h-stages.svg", headingSvg("SELECT STAGE"));
  await write("h-terrain.svg", headingSvg("CONTRIBUTION TERRAIN", "github-profile-3d-contrib"));
  await write("h-snake.svg", headingSvg("SNAKE MODE", "Platane/snk"));

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.log("GITHUB_TOKEN not set: skipped status.svg and stage cards");
    return;
  }
  const st = await fetchStats(cfg.user, token);
  await write("status.svg", statusSvg(cfg, st));
  for (const [i, stage] of cfg.stages.entries()) {
    await write(`stage-${i + 1}.svg`, stageSvg(i, stage, st.repos[stage.repo]));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
