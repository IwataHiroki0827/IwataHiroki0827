// Original low-poly octopus in Claude-like coral / terracotta tones, wearing a neon gaming headset.
// "P2 / CLAUDE.SYS": the AI partner next to player 1. Not a copy of any official artwork or logo.
import * as THREE from "three";
import { COLORS, withEdges, lit, glow, makeCamera, floorGrid, scrollGrid } from "./common.mjs";

const { CYAN, MAGENTA, AMBER } = COLORS;
const TAU = Math.PI * 2;
const TERRACOTTA = 0xd97757;
const CORAL_LIGHT = 0xffb39a;

export const meta = {
  out: "assets/model/claude-octopus.gif",
  labelLeft: "P2",
  labelLeftColor: [255, 140, 105],
  labelRight: "CLAUDE.SYS",
  bgTop: [0x0a, 0x08, 0x16],
  bgBottom: [0x26, 0x0c, 0x1c],
  glow: [230, 110, 80],
  glowY: 0.42,
  border: [[255, 179, 154], [217, 119, 87], [255, 43, 214]],
  pins: [[217, 119, 87], [255, 179, 154], [255, 140, 105], [0, 240, 255], [255, 43, 214], [255, 255, 255]],
};

const SEGS = 7; // segments per tentacle
const SEG_LEN = [0.26, 0.24, 0.22, 0.2, 0.18, 0.16, 0.14];
const radius = (i) => 0.15 * (1 - i / SEGS) + 0.03;

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0a0816, 10, 19);
  const camera = makeCamera(34, 1, [0, 1.6, 8.2], [0, 0.15, 0]);
  scene.add(new THREE.HemisphereLight(0xffc2a8, 0x0a0410, 0.85));
  const keyL = new THREE.PointLight(CYAN, 30, 20);
  keyL.position.set(3, 3, 4);
  const warmL = new THREE.PointLight(0xff9a70, 30, 20);
  warmL.position.set(-3, 2, 3);
  scene.add(keyL, warmL);

  const body = new THREE.Group();
  const skin = lit(TERRACOTTA, { roughness: 0.6, emissive: TERRACOTTA, emissiveIntensity: 0.04 });
  // mantle: a coarse sphere, taller than wide
  const mantleGeo = new THREE.SphereGeometry(0.95, 8, 6);
  mantleGeo.scale(1, 1.08, 0.95);
  const mantle = withEdges(mantleGeo, skin, CORAL_LIGHT, 12);
  mantle.position.y = 1.0;
  body.add(mantle);
  // eyes: dark lenses with a cyan glint
  for (const s of [-1, 1]) {
    const eyeGeo = new THREE.SphereGeometry(0.17, 7, 5);
    eyeGeo.scale(0.8, 1.05, 0.5);
    const eye = withEdges(eyeGeo, lit(0x120812, { roughness: 0.2 }), 0x3a2030, 30);
    eye.position.set(s * 0.32, 0.86, 0.74);
    eye.rotation.y = s * 0.35;
    body.add(eye);
    const glint = new THREE.Mesh(new THREE.OctahedronGeometry(0.045, 0), new THREE.MeshBasicMaterial({ color: 0xe8ffff }));
    glint.position.set(s * 0.32 + 0.05, 0.93, 0.82);
    body.add(glint);
  }
  // cheeks
  for (const s of [-1, 1]) {
    const ch = new THREE.Mesh(new THREE.CircleGeometry(0.09, 6), new THREE.MeshBasicMaterial({ color: 0xff8a8a }));
    ch.position.set(s * 0.55, 0.66, 0.79);
    ch.rotation.y = s * 0.6;
    body.add(ch);
  }
  // gaming headset: band over the mantle + glowing ear cups + a mic boom
  const band = withEdges(new THREE.TorusGeometry(1.02, 0.05, 4, 14, Math.PI), lit(0x1c1a2c), CYAN, 20);
  band.position.y = 1.0;
  body.add(band);
  for (const s of [-1, 1]) {
    const cupGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.16, 8);
    cupGeo.rotateZ(Math.PI / 2);
    const cup = withEdges(cupGeo, lit(0x1c1a2c), CYAN, 20);
    cup.position.set(s * 1.0, 0.98, 0);
    body.add(cup);
    const ringGeo = new THREE.TorusGeometry(0.17, 0.035, 4, 10);
    ringGeo.rotateY(Math.PI / 2);
    const ring = new THREE.Mesh(ringGeo, glow(MAGENTA, 1.1));
    ring.position.set(s * 1.09, 0.98, 0);
    ring.userData.doubleSide = true;
    body.add(ring);
  }
  const boomPts = [new THREE.Vector3(1.0, 0.9, 0.1), new THREE.Vector3(0.85, 0.62, 0.55), new THREE.Vector3(0.45, 0.5, 0.82)];
  const boom = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([boomPts[0], boomPts[1], boomPts[1], boomPts[2]]),
    new THREE.LineBasicMaterial({ color: CYAN }),
  );
  body.add(boom);
  const mic = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), glow(AMBER, 1));
  mic.position.copy(boomPts[2]);
  body.add(mic);

  // tentacles: chains of tapered segments, posed every frame
  const tentacles = [];
  const segGeos = SEG_LEN.map((len, i) => {
    const g = new THREE.CylinderGeometry(radius(i + 1), radius(i), len, 6, 1);
    g.translate(0, len / 2, 0); // pivot at the base
    return g;
  });
  for (let k = 0; k < 8; k++) {
    const az = (k / 8) * TAU + TAU / 16;
    const segs = segGeos.map((g, i) => {
      const m = withEdges(g, i % 2 ? skin : lit(0xb85a3e, { roughness: 0.6, emissive: TERRACOTTA, emissiveIntensity: 0.03 }), CORAL_LIGHT, 25);
      body.add(m);
      return m;
    });
    // glowing tip
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.05, 0), glow(k % 2 ? CYAN : MAGENTA, 1));
    body.add(tip);
    tentacles.push({ az, segs, tip, phase: k * 0.37 });
  }

  // bubbles rising behind
  const bubbles = [];
  for (let k = 0; k < 5; k++) {
    const b = withEdges(new THREE.IcosahedronGeometry(0.08 + (k % 3) * 0.03, 0), new THREE.MeshBasicMaterial({ color: 0x10223a }), CYAN, 1);
    scene.add(b);
    bubbles.push(b);
  }

  const pivot = new THREE.Group();
  pivot.add(body);
  pivot.position.y = 0.0;
  pivot.scale.setScalar(0.92);
  scene.add(pivot);
  const grid = floorGrid(-1.85);
  scene.add(grid);

  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  function poseTentacle(t, p) {
    // work in the tentacle's vertical plane: r = outward, y = up
    const out = new THREE.Vector3(Math.cos(t.az), 0, Math.sin(t.az));
    let r = 0.62, y = 0.42;
    let ang = -1.05; // start pointing down-outwards
    t.segs.forEach((m, i) => {
      const wave = Math.sin(p * TAU * 2 - i * 0.7 + t.phase);
      ang += 0.2 + 0.22 * wave + (i > 3 ? 0.18 : 0); // curl upward towards the tip
      dir.copy(out).multiplyScalar(Math.cos(ang)).setY(Math.sin(ang)).normalize();
      m.position.set(out.x * r, y, out.z * r);
      m.quaternion.setFromUnitVectors(up, dir);
      r += Math.cos(ang) * SEG_LEN[i];
      y += Math.sin(ang) * SEG_LEN[i];
    });
    t.tip.position.set(out.x * r, y, out.z * r);
  }

  function update(p) {
    pivot.rotation.y = -(p * TAU - 0.35 * Math.sin(2 * p * TAU));
    body.position.y = Math.sin(p * TAU * 2) * 0.1;
    body.rotation.z = Math.sin(p * TAU) * 0.05;
    tentacles.forEach((t) => poseTentacle(t, p));
    bubbles.forEach((b, k) => {
      const t = (p * 2 + k / bubbles.length) % 1;
      b.position.set(-1.9 + k * 0.95, -1.4 + t * 4.0, -1.4 + (k % 2) * 0.6);
      b.visible = t < 0.95;
    });
    scrollGrid(grid, p);
    keyL.position.x = Math.cos(p * TAU) * 3.2;
    scene.updateMatrixWorld(true);
  }
  return { scene, camera, update };
}
