// GitHub City: the last year of contributions as a neon low-poly city.
// One block per day (53 weeks x 7 days); building height follows the day's contribution count.
// Data: model/data/contrib.json written by scripts/build-svgs.mjs
//   { user, total, from, to, weeks: [[{ date, count }, ...], ...] }
import * as THREE from "three";
import { COLORS, withEdges, lit, makeCamera, floorGrid } from "./common.mjs";

const { CYAN, MAGENTA, VIOLET } = COLORS;
const TAU = Math.PI * 2;

export const meta = {
  out: "assets/model/github-city.gif",
  size: [600, 320],
  frames: 40,
  colors: 72,
  labelLeft: "CITY",
  labelLeftColor: [0, 240, 255],
  glow: [90, 50, 200],
  glowY: 0.5,
  stars: 30,
  pins: [[0, 240, 255], [255, 43, 214], [163, 255, 18], [255, 255, 255]],
};
/** Card label from the data (export_frames merges it into meta). */
export const metaFor = (data) => ({
  labelRight: data ? `${data.total} CONTRIBUTIONS / ${data.from.slice(0, 7)} - ${data.to.slice(0, 7)}` : "",
  stamp: data ? { user: data.user, total: data.total, from: data.from, to: data.to } : {},
});

// building colour by level (quartiles of the non-zero days), low -> high
const LEVELS = [0x3b1d8f, 0x6d28d9, 0xa21caf, 0xff2bd6];
const EDGES = [0x7c5cff, 0xb48cff, 0xff6be6, CYAN];

export function createScene(data) {
  if (!data) throw new Error("city needs contribution data: --data model/data/contrib.json");
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070a18, 11, 24);
  const camera = makeCamera(30, 600 / 320, [0, 4.2, 11.2], [0, 0.35, 0]);
  scene.add(new THREE.HemisphereLight(0x8b5cf6, 0x05040d, 1.5));
  const keyL = new THREE.PointLight(CYAN, 36, 22);
  keyL.position.set(4, 5, 5);
  const rimL = new THREE.PointLight(MAGENTA, 30, 22);
  rimL.position.set(-4, 3, -4);
  scene.add(keyL, rimL);

  const weeks = data.weeks;
  const counts = weeks.flat().map((d) => d.count).filter((c) => c > 0).sort((a, b) => a - b);
  const q = (f) => counts[Math.min(counts.length - 1, Math.floor(f * counts.length))] ?? 1;
  const cuts = [q(0.25), q(0.5), q(0.75)];
  const level = (c) => (c <= cuts[0] ? 0 : c <= cuts[1] ? 1 : c <= cuts[2] ? 2 : 3);
  const max = counts.at(-1) ?? 1;

  const city = new THREE.Group();
  const cell = 0.2, foot = 0.15;
  const W = weeks.length * cell, D = 7 * cell;
  const base = withEdges(new THREE.BoxGeometry(W + 0.3, 0.12, D + 0.3), lit(0x1a1e40, { roughness: 0.8 }), VIOLET, 10);
  base.position.y = -0.06;
  city.add(base);
  // empty days: low dim blocks with a faint outline, so the whole year reads as a street grid
  const tileMat = new THREE.MeshBasicMaterial({ color: 0x262d5c });
  const tileGeo = new THREE.BoxGeometry(foot, 0.03, foot);
  const tileEdges = new THREE.EdgesGeometry(tileGeo);
  const tileLine = new THREE.LineBasicMaterial({ color: 0x5b4bb0 });
  const mats = LEVELS.map((c) => lit(c, { roughness: 0.4, emissive: c, emissiveIntensity: 0.35 }));
  const beacons = [];
  weeks.forEach((week, wi) => {
    week.forEach((day) => {
      const dow = new Date(`${day.date}T00:00:00Z`).getUTCDay();
      const x = (wi - (weeks.length - 1) / 2) * cell;
      const z = (dow - 3) * cell;
      if (day.count <= 0) {
        const t = new THREE.Mesh(tileGeo, tileMat);
        t.position.set(x, 0.015, z);
        const e = new THREE.LineSegments(tileEdges, tileLine);
        e.position.copy(t.position);
        city.add(t, e);
        return;
      }
      const lv = level(day.count);
      const h = 0.12 + 1.5 * Math.sqrt(day.count / max);
      const geo = new THREE.BoxGeometry(foot, h, foot);
      geo.translate(0, h / 2, 0);
      const b = withEdges(geo, mats[lv], EDGES[lv], 10);
      b.position.set(x, 0, z);
      city.add(b);
      if (lv === 3) beacons.push({ x, z, h });
    });
  });
  // beacons on the tallest days blink in turn
  const beaconMeshes = beacons.map((bc, i) => {
    const m = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    m.position.set(bc.x, bc.h + 0.08, bc.z);
    m.userData.i = i;
    city.add(m);
    return m;
  });
  scene.add(city);
  const grid = floorGrid(-0.6, 30, 40);
  scene.add(grid);
  const white = new THREE.Color(0xffffff), cyan = new THREE.Color(CYAN);

  function update(p) {
    // eased turn: lingers on the long sides of the city
    city.rotation.y = -(p * TAU - 0.38 * Math.sin(2 * p * TAU));
    beaconMeshes.forEach((m) => {
      const on = Math.sin(p * TAU * 4 + m.userData.i * 1.7) > 0.3;
      m.material.color.copy(on ? white : cyan).multiplyScalar(on ? 1 : 0.4);
    });
    // the floor grid stays still here: a static background keeps the GIF small (unchanged pixels are skipped)
    keyL.position.x = Math.cos(p * TAU) * 4.5;
    scene.updateMatrixWorld(true);
  }
  return { scene, camera, update };
}
