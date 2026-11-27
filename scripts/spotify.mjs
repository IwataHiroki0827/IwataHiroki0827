#!/usr/bin/env node
// "RECENTLY PLAYED" card from the Spotify Web API (no npm dependencies).
//
//   SPOTIFY_CLIENT_ID=... SPOTIFY_CLIENT_SECRET=... SPOTIFY_REFRESH_TOKEN=... node scripts/spotify.mjs
//   node scripts/spotify.mjs --sample        # demo data, for previewing the layout (does not touch README.md)
//
// Without the three SPOTIFY_* variables it does nothing and exits 0, so the workflow step is skipped.
// With them: writes assets/generated/spotify.svg and turns on the <!-- gen:spotify --> block in README.md.
// Runs once a day in Actions, so the card shows the *recently played* tracks at build time, not what is playing now.
// The refresh token needs the scope user-read-recently-played (see scripts/spotify-auth.mjs).
import { MONO, SANS, C, esc, clip, glowFilter, neonGradient, scanlines, writeSvg, patchReadme } from "./svg-kit.mjs";

const LIMIT = 5;

async function accessToken(id, secret, refresh) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }),
  });
  if (!res.ok) throw new Error(`Spotify token HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return (await res.json()).access_token;
}

async function recentlyPlayed(token) {
  const res = await fetch(`https://api.spotify.com/v1/me/player/recently-played?limit=${LIMIT * 3}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Spotify recently-played HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const items = (await res.json()).items ?? [];
  // the same track played several times in a row appears once
  const seen = new Set();
  const out = [];
  for (const it of items) {
    const t = it.track;
    if (!t || seen.has(t.id)) continue;
    seen.add(t.id);
    out.push({ title: t.name, artist: (t.artists ?? []).map((a) => a.name).join(", "), playedAt: it.played_at });
    if (out.length === LIMIT) break;
  }
  return out;
}

/** "11/27 23:10" in Japan time. */
function jst(iso) {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  const p = (n) => String(n).padStart(2, "0");
  return `${p(d.getUTCMonth() + 1)}/${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

function spotifySvg(tracks, builtAt) {
  const W = 600;
  const rowH = 46;
  const top = 64;
  const H = top + Math.max(1, tracks.length) * rowH + 30;
  const bars = (x, y, i) =>
    [0, 1, 2, 3]
      .map((k) => {
        const d = (0.7 + ((i * 3 + k * 5) % 7) * 0.09).toFixed(2);
        return `<rect x="${x + k * 6}" y="${y - 18}" width="4" height="18" rx="1" fill="url(#neon)" style="transform-origin:${x + k * 6 + 2}px ${y}px; animation: eq ${d}s ease-in-out ${(k * 0.13).toFixed(2)}s infinite alternate"/>`;
      })
      .join("");
  const rows = tracks.map((t, i) => {
    const y = top + i * rowH + 26;
    return `
    ${bars(28, y, i)}
    <text x="64" y="${y - 6}" font-family="${SANS}" font-size="15" font-weight="700" fill="${C.text}">${esc(clip(t.title, 46))}</text>
    <text x="64" y="${y + 12}" font-family="${SANS}" font-size="12" fill="${C.dim}">${esc(clip(t.artist, 52))}</text>
    <text x="${W - 26}" y="${y - 6}" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.cyan}">${esc(jst(t.playedAt))}</text>
    <line x1="64" y1="${y + 22}" x2="${W - 26}" y2="${y + 22}" stroke="${C.line}" stroke-width="1"/>`;
  });
  const empty = `<text x="${W / 2}" y="${top + 28}" text-anchor="middle" font-family="${MONO}" font-size="13" fill="${C.dim}">NO TRACKS IN THE LAST DAYS</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="title">
  <title id="title">RECENTLY PLAYED on Spotify: ${esc(tracks.map((t) => `${t.title} / ${t.artist}`).join("; ") || "none")}</title>
  <style>
    @keyframes eq { from { transform: scaleY(0.25); } to { transform: scaleY(1); } }
  </style>
  <defs>
    ${neonGradient("neon")}
    ${glowFilter("glow", 3)}
    ${scanlines("scan")}
    <clipPath id="card"><rect width="${W}" height="${H}" rx="14"/></clipPath>
  </defs>
  <g clip-path="url(#card)">
    <rect width="${W}" height="${H}" fill="${C.panel}"/>
    <text x="26" y="40" font-family="${MONO}" font-size="18" font-weight="800" letter-spacing="3" fill="url(#neon)" filter="url(#glow)">RECENTLY PLAYED</text>
    <text x="${W - 26}" y="40" text-anchor="end" font-family="${MONO}" font-size="11" fill="${C.dim}">via Spotify</text>
    ${tracks.length ? rows.join("") : empty}
    <text x="${W - 26}" y="${H - 12}" text-anchor="end" font-family="${MONO}" font-size="10" fill="${C.dim}">updated ${esc(jst(builtAt))} JST (daily, not live)</text>
    <rect width="${W}" height="${H}" fill="url(#scan)"/>
  </g>
  <rect x="0.75" y="0.75" width="${W - 1.5}" height="${H - 1.5}" rx="13.5" fill="none" stroke="${C.line}" stroke-width="1.5"/>
</svg>
`;
}

const BLOCK_ON = `<p align="center">
  <img src="assets/generated/h-spotify.svg" width="100%" alt="RECENTLY PLAYED">
</p>

<p align="center">
  <img src="assets/generated/spotify.svg" width="600" alt="Spotify で最近聞いた曲(1日1回更新)">
</p>`;

async function main() {
  if (process.argv.includes("--sample")) {
    const now = new Date().toISOString();
    const ago = (h) => new Date(Date.now() - h * 3600e3).toISOString();
    const sample = [
      { title: "[曲名のサンプル 1]", artist: "[アーティスト名]", playedAt: ago(2) },
      { title: "[曲名のサンプル 2]", artist: "[アーティスト名]", playedAt: ago(3) },
      { title: "[Sample Track 3]", artist: "[Artist]", playedAt: ago(5) },
      { title: "[Sample Track 4]", artist: "[Artist]", playedAt: ago(9) },
      { title: "[Sample Track 5]", artist: "[Artist]", playedAt: ago(20) },
    ];
    await writeSvg("spotify-sample.svg", spotifySvg(sample, now));
    return;
  }
  const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret, SPOTIFY_REFRESH_TOKEN: refresh } = process.env;
  if (!id || !secret || !refresh) {
    console.log("SPOTIFY_* secrets not set: skipped (README keeps the Spotify block hidden)");
    return;
  }
  const token = await accessToken(id, secret, refresh);
  const tracks = await recentlyPlayed(token);
  await writeSvg("spotify.svg", spotifySvg(tracks, new Date().toISOString()));
  await patchReadme({ spotify: BLOCK_ON });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
