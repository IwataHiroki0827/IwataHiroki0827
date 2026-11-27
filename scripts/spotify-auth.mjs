#!/usr/bin/env node
// One-time helper, run by the account owner on their own PC: gets a Spotify refresh token.
//
//   $env:SPOTIFY_CLIENT_ID="..."; $env:SPOTIFY_CLIENT_SECRET="..."; node scripts/spotify-auth.mjs
//
// 1. Register http://127.0.0.1:8888/callback as a Redirect URI of your Spotify app first
//    (Spotify accepts loopback IPs over http; "localhost" is not allowed).
// 2. The script prints a URL. Open it, log in to Spotify and press "Agree".
// 3. The browser comes back to 127.0.0.1:8888 and the script prints the refresh token.
//    Store it as the GitHub secret SPOTIFY_REFRESH_TOKEN. Never commit it or paste it anywhere else.
// Scope: user-read-recently-played only (read the listening history; nothing can be changed).
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";

const PORT = 8888;
const REDIRECT = `http://127.0.0.1:${PORT}/callback`;
const SCOPE = "user-read-recently-played";
const { SPOTIFY_CLIENT_ID: id, SPOTIFY_CLIENT_SECRET: secret } = process.env;
if (!id || !secret) {
  console.error("Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET first.");
  process.exit(2);
}
const state = randomBytes(12).toString("hex");
const url = `https://accounts.spotify.com/authorize?${new URLSearchParams({
  response_type: "code",
  client_id: id,
  scope: SCOPE,
  redirect_uri: REDIRECT,
  state,
})}`;

const server = createServer(async (req, res) => {
  const u = new URL(req.url, REDIRECT);
  if (u.pathname !== "/callback") {
    res.writeHead(404).end();
    return;
  }
  const finish = (status, text) => {
    res.writeHead(status, { "Content-Type": "text/plain; charset=utf-8" }).end(text);
    server.close();
  };
  if (u.searchParams.get("state") !== state) return finish(400, "state mismatch: start again");
  const code = u.searchParams.get("code");
  if (!code) return finish(400, `no code: ${u.searchParams.get("error") ?? "unknown error"}`);
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: REDIRECT }),
  });
  const json = await r.json();
  if (!r.ok || !json.refresh_token) {
    console.error("token exchange failed:", JSON.stringify(json).slice(0, 300));
    return finish(500, "token exchange failed: see the terminal");
  }
  console.log("\nSPOTIFY_REFRESH_TOKEN (keep it secret; store it with `gh secret set SPOTIFY_REFRESH_TOKEN`):\n");
  console.log(json.refresh_token);
  finish(200, "Done. Go back to the terminal. You can close this tab.");
});
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Open this URL in your browser and press "Agree":\n\n${url}\n`);
});
