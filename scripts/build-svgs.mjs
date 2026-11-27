#!/usr/bin/env node
// Builds the self-hosted SVGs for the profile README (no npm dependencies).
//
//   node scripts/build-svgs.mjs                    # header / headings / player data / certifications / loadout (no network)
//   GITHUB_TOKEN=... node scripts/build-svgs.mjs   # + status card and model/data/contrib.json (GitHub GraphQL)
//
// Output: assets/generated/*.svg, model/data/contrib.json (input of the GitHub City GIF),
//         and the generated blocks in README.md (<!-- gen:NAME --> ... <!-- /gen:NAME -->).
// Rule: never put HTML tags inside <text>; use <tspan> for emphasis.

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { ROOT, MONO, SANS, C, esc, cells, clip, glowFilter, neonGradient, scanlines, writeSvg, readConfig, patchReadme } from "./svg-kit.mjs";

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
    ${glowFilter("lineglow", 5, { w: W, h: H })}
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
    <line x1="0" x2="${W}" y1="${horizon}" y2="${horizon}" stroke="${C.cyan}" stroke-width="2" filter="url(#lineglow)"/>

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

// ---------------------------------------------------------------- neon section heading
function headingSvg(label, sub) {
  const W = 900;
  // Taller when there is a subtitle, so the small credit line never touches the title's glow.
  const H = sub ? 74 : 64;
  const ty = 42; // title baseline
  const ly = ty - 11; // decor lines sit at the title's optical centre
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
    ${glowFilter("lineglow", 4, { w: W, h: H })}
    <clipPath id="card"><rect width="${W}" height="${H}" rx="12"/></clipPath>
    <linearGradient id="shine" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".18"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <g class="sweep"><rect x="-120" width="120" height="${H}" fill="url(#shine)"/></g>
    <!-- rects, not lines: a horizontal line has a zero-height bbox, so an objectBoundingBox gradient/filter paints nothing -->
    <g fill="url(#neon)" filter="url(#lineglow)">
      <rect x="24" y="${ly - 1}" width="${W / 2 - len / 2 - 48}" height="2"/>
      <rect x="${W / 2 + len / 2 + 24}" y="${ly - 1}" width="${W / 2 - len / 2 - 48}" height="2"/>
    </g>
    <g class="flicker"><text x="${W / 2}" y="${ty}" text-anchor="middle" font-family="${MONO}" font-size="28" font-weight="800" letter-spacing="4" fill="url(#neon)" filter="url(#glow)" textLength="${len}" lengthAdjust="spacingAndGlyphs">${esc(label)}</text></g>
    ${sub ? `<text x="${W - 24}" y="${H - 9}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.dim}" letter-spacing="2">${esc(sub)}</text>` : ""}
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
        nodes{ name stargazerCount
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
  const weeks = cc.contributionCalendar.weeks.map((w) => w.contributionDays.map((d) => ({ date: d.date, count: d.contributionCount })));
  const days = weeks.flat();
  let streak = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].count > 0) streak++;
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
    weeks,
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


// ---------------------------------------------------------------- player data (location + Kaggle rank)
const TIERS = ["NOVICE", "CONTRIBUTOR", "EXPERT", "MASTER", "GRANDMASTER"];

function polygon(cx, cy, r, n, rot = 0) {
  return Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
}
function star(cx, cy, r1, r2) {
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 ? r2 : r1;
    const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
    return `${(cx + Math.cos(a) * r).toFixed(1)},${(cy + Math.sin(a) * r).toFixed(1)}`;
  }).join(" ");
}

function profileSvg(cfg) {
  const W = 500;
  const H = 300;
  const k = cfg.kaggle;
  const tierIdx = Math.max(0, TIERS.indexOf(String(k.tier).toUpperCase()));
  const kUrl = k.url.replace(/^https?:\/\/(www\.)?/, "");
  const mx = 74, my = 176; // medal centre
  const pips = TIERS.map((t, i) => {
    const x = 150 + i * 62;
    const on = i <= tierIdx;
    const cur = i === tierIdx;
    return `
    <rect x="${x}" y="226" width="54" height="8" rx="2" fill="${on ? (cur ? "url(#rank)" : C.violet) : "#1a2044"}" ${on ? "" : `stroke="${C.line}"`} opacity="${on && !cur ? 0.55 : 1}"/>
    <text x="${x + 27}" y="248" text-anchor="middle" font-size="8" letter-spacing="0.5" fill="${cur ? C.text : C.dim}" ${cur ? 'font-weight="800"' : ""}>${t}</text>`;
  });
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">PLAYER DATA: based in ${esc(cfg.location)}. Kaggle ${esc(k.category)} ${esc(k.tier)} (${esc(kUrl)})</title>
  <style>
    .pulse { animation: p 2.4s ease-in-out infinite; }
    @keyframes p { 0%,100% { opacity: .6; } 50% { opacity: 1; } }
    .spin { animation: s 6s linear infinite; transform-origin: ${mx}px ${my}px; }
    @keyframes s { to { transform: rotate(360deg); } }
  </style>
  <defs>
    ${neonGradient("neon")}
    ${glowFilter("glow", 3)}
    ${glowFilter("medalglow", 5)}
    ${scanlines("scan")}
    <linearGradient id="rank" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#c4a1ff"/>
      <stop offset="1" stop-color="${C.magenta}"/>
    </linearGradient>
    <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#card)" font-family="${MONO}" font-size="14">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <rect x="10" y="10" width="${W - 20}" height="${H - 20}" rx="8" fill="none" stroke="#dfe4ff" stroke-opacity="0.75" stroke-width="2"/>
    <text x="26" y="44" font-size="20" font-weight="800" letter-spacing="3" fill="url(#neon)" filter="url(#glow)">ID CARD</text>
    <text x="${W - 26}" y="44" text-anchor="end" fill="${C.dim}" font-size="12">@${esc(cfg.user)}</text>

    <path d="M38 64 c-7 0 -12 5 -12 12 c0 9 12 21 12 21 s12 -12 12 -21 c0 -7 -5 -12 -12 -12 z" fill="none" stroke="${C.coral}" stroke-width="2.5" filter="url(#glow)"/>
    <circle cx="38" cy="76" r="4" fill="${C.coral}"/>
    <text x="60" y="76" fill="${C.dim}" font-size="11" letter-spacing="2">LOCATION</text>
    <text x="60" y="96" fill="${C.text}" font-size="20" font-weight="800" letter-spacing="3">${esc(String(cfg.location).toUpperCase())}<tspan font-family="${SANS}" font-size="14" font-weight="700" fill="${C.coral}" letter-spacing="1">  ${esc(cfg.locationLocal ?? "")}</tspan></text>
    <text x="${W - 26}" y="96" text-anchor="end" fill="${C.dim}" font-size="11">UTC+9</text>
    <line x1="26" y1="114" x2="${W - 26}" y2="114" stroke="${C.line}" stroke-width="1.5"/>

    <g filter="url(#medalglow)">
      <polygon points="${mx - 22},${my + 26} ${mx - 34},${my + 66} ${mx - 20},${my + 56} ${mx - 10},${my + 70} ${mx - 4},${my + 30}" fill="#5b21b6"/>
      <polygon points="${mx + 22},${my + 26} ${mx + 34},${my + 66} ${mx + 20},${my + 56} ${mx + 10},${my + 70} ${mx + 4},${my + 30}" fill="#5b21b6"/>
      <polygon points="${polygon(mx, my, 42, 6, Math.PI / 6)}" fill="#1b1240" stroke="url(#rank)" stroke-width="4"/>
    </g>
    <g class="spin"><polygon points="${polygon(mx, my, 32, 6, Math.PI / 6)}" fill="none" stroke="${C.violet}" stroke-width="1.5" stroke-dasharray="6 5"/></g>
    <polygon points="${star(mx, my, 17, 7)}" fill="url(#rank)"/>

    <text x="150" y="146" fill="${C.dim}" font-size="11" letter-spacing="3">KAGGLE  ·  RANK</text>
    <text x="150" y="172" fill="${C.text}" font-size="18" font-weight="800" letter-spacing="2">${esc(String(k.category).toUpperCase())}</text>
    <text x="150" y="206" font-size="30" font-weight="800" letter-spacing="4" fill="url(#rank)" filter="url(#glow)">${esc(String(k.tier).toUpperCase())}</text>
    ${pips.join("")}

    <text x="26" y="${H - 26}" fill="${C.dim}" font-size="11">MSG <tspan font-family="${SANS}" fill="${C.text}" font-size="13">${esc(clip(cfg.tagline ?? "", 40))}</tspan></text>
    <text x="${W - 26}" y="${H - 26}" text-anchor="end" fill="${C.cyan}" font-size="11" font-weight="700" class="pulse">${esc(kUrl)} ▶</text>
    <rect width="${W}" height="${H}" fill="url(#scan)"/>
  </g>
</svg>
`;
}

// ---------------------------------------------------------------- certifications (badges from profile.config.json)
const ISSUER_COLORS = { IPA: C.cyan, JDLA: C.lime, AWS: C.amber };

function certsSvg(certs) {
  const cols = 3;
  const bw = 184, bh = 76, gx = 16, gy = 14;
  const W = cols * bw + (cols - 1) * gx + 4;
  const rows = Math.max(1, Math.ceil(certs.length / cols));
  const H = rows * bh + (rows - 1) * gy + 4;
  const badge = (c, i) => {
    const x = 2 + (i % cols) * (bw + gx);
    const y = 2 + Math.floor(i / cols) * (bh + gy);
    const col = ISSUER_COLORS[c.issuer] ?? C.violet;
    const k = 12; // chamfer
    const shape = `M${x + k},${y} H${x + bw} V${y + bh - k} L${x + bw - k},${y + bh} H${x} V${y + k} Z`;
    const short = String(c.short);
    const fs = cells(short) > 7 ? 18 : 24;
    return `
    <g>
      <title>${esc(c.name)}${c.issuer ? ` (${esc(c.issuer)})` : ""}</title>
      <path d="${shape}" fill="${C.panel}" stroke="${col}" stroke-width="1.6"/>
      <rect x="${x + 1}" y="${y + k}" width="5" height="${bh - k - 1}" fill="${col}" opacity="0.85"/>
      <text x="${x + 18}" y="${y + 22}" font-size="10" letter-spacing="2" fill="${col}" font-weight="700">${esc(c.issuer ?? "")}</text>
      <path d="M${x + bw - 30} ${y + 16} l5 5 l9 -10" fill="none" stroke="${col}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" class="pulse" style="animation-delay:${(i * 0.3).toFixed(1)}s"/>
      <text x="${x + 18}" y="${y + 56}" font-family="${MONO}, ${SANS}" font-size="${fs}" font-weight="800" letter-spacing="1" fill="${C.text}" filter="url(#glow)">${esc(short)}</text>
    </g>`;
  };
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">CERTIFICATIONS: ${esc(certs.map((c) => c.name).join(" / "))}</title>
  <style>
    .pulse { animation: p 2.4s ease-in-out infinite; }
    @keyframes p { 0%,100% { opacity: .45; } 50% { opacity: 1; } }
  </style>
  <defs>${glowFilter("glow", 2.2)}</defs>
  <g font-family="${MONO}">${certs.map(badge).join("")}
  </g>
</svg>
`;
}

// ---------------------------------------------------------------- loadout (skill icons, vendored, MIT)
async function skillsSvg(items) {
  const cols = 5;
  const tile = 64, cw = 104, ch = 98, pad = 18;
  const W = cols * cw + pad * 2;
  const H = Math.ceil(items.length / cols) * ch + pad * 2 - 6;
  const parts = await Promise.all(
    items.map(async (it, i) => {
      const x = pad + (i % cols) * cw + (cw - tile) / 2;
      const y = pad + Math.floor(i / cols) * ch;
      let inner;
      if (it.icon) {
        const raw = await readFile(join(ROOT, "assets", "icons", "skill-icons", it.icon), "utf-8");
        const body = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
        // namespace ids so gradients / clip paths of different icons never collide
        inner = body.replace(/id="([^"]+)"/g, `id="i${i}-$1"`).replace(/url\(#([^)]+)\)/g, `url(#i${i}-$1)`);
      } else {
        // own tile for tools without an icon in the set: plain text, no logo
        inner = `<rect width="256" height="256" rx="60" fill="#242938"/>
        <text x="128" y="${it.text2 ? 122 : 150}" text-anchor="middle" font-family="${MONO}" font-size="${it.textSize ?? 64}" font-weight="800" fill="#ffffff">${esc(it.text ?? it.label)}</text>
        ${it.text2 ? `<text x="128" y="196" text-anchor="middle" font-family="${MONO}" font-size="${it.textSize ?? 64}" font-weight="800" fill="${C.cyan}">${esc(it.text2)}</text>` : ""}`;
      }
      return `
    <g>
      <title>${esc(it.label)}</title>
      <svg x="${x}" y="${y}" width="${tile}" height="${tile}" viewBox="0 0 256 256">${inner}</svg>
      <text x="${x + tile / 2}" y="${y + tile + 20}" text-anchor="middle" font-family="${MONO}" font-size="12" fill="${C.text}">${esc(it.label)}</text>
    </g>`;
    }),
  );
  return `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">LOADOUT: ${esc(items.map((i) => i.label).join(", "))}</title>
  <rect width="${W}" height="${H}" rx="14" fill="${C.panel}"/>
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="13.5" fill="none" stroke="${C.line}" stroke-width="1.5"/>${parts.join("")}
</svg>
`;
}

// ---------------------------------------------------------------- main
async function main() {
  const cfg = await readConfig();

  await writeSvg("header.svg", headerSvg(cfg));
  await writeSvg("h-status.svg", headingSvg("PLAYER STATUS", "updated daily by GitHub Actions"));
  await writeSvg("h-data.svg", headingSvg("PLAYER DATA"));
  await writeSvg("h-certs.svg", headingSvg("CERTIFICATIONS"));
  await writeSvg("h-loadout.svg", headingSvg("LOADOUT", "skill icons: tandpfun/skill-icons (MIT)"));
  await writeSvg("h-party.svg", headingSvg("RIG & PARTY"));
  await writeSvg("h-city.svg", headingSvg("GITHUB CITY", "rebuilt daily from the contribution calendar"));
  await writeSvg("h-terrain.svg", headingSvg("CONTRIBUTION TERRAIN", "github-profile-3d-contrib"));
  await writeSvg("h-snake.svg", headingSvg("SNAKE MODE", "Platane/snk"));
  await writeSvg("h-spotify.svg", headingSvg("RECENTLY PLAYED", "Spotify Web API, updated daily"));
  await writeSvg("profile.svg", profileSvg(cfg));
  await writeSvg("certs.svg", certsSvg(cfg.certifications));
  await writeSvg("skills.svg", await skillsSvg(cfg.loadout));

  // README blocks that depend on the config (links and tooltips cannot live inside an <img> SVG)
  const certTitle = cfg.certifications.map((c) => `${c.short}: ${c.name}`).join(" / ");
  await patchReadme({
    kaggle: `<a href="${esc(cfg.kaggle.url)}"><img src="assets/generated/profile.svg" width="500" alt="${esc(`PLAYER DATA: ${cfg.location} 在住 / Kaggle ${cfg.kaggle.category} ${cfg.kaggle.tier}`)}" title="${esc(`Kaggle ${cfg.kaggle.category} ${cfg.kaggle.tier} — ${cfg.kaggle.url}`)}"></a>`,
    certs: `<img src="assets/generated/certs.svg" width="600" alt="${esc(`保有資格: ${certTitle}`)}" title="${esc(certTitle)}">`,
  });

  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) {
    console.log("GITHUB_TOKEN not set: skipped status.svg and model/data/contrib.json");
    return;
  }
  const st = await fetchStats(cfg.user, token);
  await writeSvg("status.svg", statusSvg(cfg, st));
  const days = st.weeks.flat();
  const contrib = { user: cfg.user, total: st.contributions, from: days[0]?.date ?? "", to: days.at(-1)?.date ?? "", weeks: st.weeks };
  await mkdir(join(ROOT, "model", "data"), { recursive: true });
  await writeFile(join(ROOT, "model", "data", "contrib.json"), JSON.stringify(contrib) + "\n", "utf-8");
  console.log(`wrote model/data/contrib.json (${days.length} days, ${st.contributions} contributions)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
