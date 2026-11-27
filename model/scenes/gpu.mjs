// Original low-poly graphics card with the words "RTX 5080" (the GPU in this PC).
// No maker logos or trade dress: a generic two-fan card, graphite shroud, neon edges.
import * as THREE from "three";
import { COLORS, withEdges, lit, glow, makeCamera, floorGrid, scrollGrid, quadGeo, voxelWord, waveVoxels } from "./common.mjs";

const { CYAN, MAGENTA, VIOLET, AMBER } = COLORS;
const TAU = Math.PI * 2;

export const meta = {
  out: "assets/model/rtx-5080.gif",
  labelLeft: "RIG",
  labelLeftColor: [0, 240, 255],
  labelRight: "GPU.SYS",
  glow: [40, 120, 220],
  pins: [[0, 240, 255], [255, 43, 214], [255, 176, 32], [190, 200, 220], [255, 255, 255]],
};

const L = 3.3, H = 1.3, T = 0.44; // card length (x), height (y), thickness (z)
const FAN_X = [-0.82, 0.82], FAN_R = 0.5;

function fan(radius) {
  const g = new THREE.Group();
  const ring = withEdges(new THREE.TorusGeometry(radius, 0.045, 4, 18), lit(0x3a3f55, { metalness: 0.6, roughness: 0.3 }), MAGENTA, 30);
  g.add(ring);
  const hub = withEdges(new THREE.CylinderGeometry(0.15, 0.17, 0.08, 10).rotateX(Math.PI / 2), lit(0x1c1f2c), CYAN, 20);
  g.add(hub);
  const rotor = new THREE.Group();
  const bladeMat = lit(0x3a3478, { roughness: 0.35, emissive: 0x1a1450, emissiveIntensity: 0.6 });
  const N = 9;
  for (let k = 0; k < N; k++) {
    const a0 = (k / N) * TAU;
    const p = (r, a) => [Math.cos(a) * r, Math.sin(a) * r, 0];
    // swept blade: root narrow, tip wide and twisted forward
    const geo = quadGeo(p(0.16, a0), p(radius - 0.06, a0 + 0.12), p(radius - 0.06, a0 + 0.55), p(0.16, a0 + 0.3));
    const blade = new THREE.Mesh(geo, bladeMat);
    blade.userData.doubleSide = true;
    rotor.add(blade);
    const edge = new THREE.LineSegments(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(...p(0.16, a0)), new THREE.Vector3(...p(radius - 0.06, a0 + 0.12)),
        new THREE.Vector3(...p(radius - 0.06, a0 + 0.12)), new THREE.Vector3(...p(radius - 0.06, a0 + 0.55)),
      ]),
      new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.9 }),
    );
    rotor.add(edge);
  }
  rotor.position.z = -0.07;
  g.add(rotor);
  // dark well behind the blades
  const well = new THREE.Mesh(new THREE.CircleGeometry(radius, 18), new THREE.MeshBasicMaterial({ color: 0x07080f }));
  well.position.z = -0.3;
  g.add(well);
  g.userData.rotor = rotor;
  return g;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070a18, 10, 19);
  const camera = makeCamera(34, 1, [0, 2.2, 8.6], [0, 0.1, 0]);
  scene.add(new THREE.HemisphereLight(0x7aa0ff, 0x05040d, 1.5));
  const keyL = new THREE.PointLight(CYAN, 40, 20);
  keyL.position.set(3, 3, 4);
  const rimL = new THREE.PointLight(MAGENTA, 36, 20);
  rimL.position.set(-3, 1.5, -3);
  scene.add(keyL, rimL);

  const card = new THREE.Group();
  // shroud: chamfered rectangle extruded, graphite
  const s = new THREE.Shape();
  const c = 0.16;
  s.moveTo(-L / 2 + c, -H / 2);
  s.lineTo(L / 2 - c, -H / 2);
  s.lineTo(L / 2, -H / 2 + c);
  s.lineTo(L / 2, H / 2 - c);
  s.lineTo(L / 2 - c, H / 2);
  s.lineTo(-L / 2 + c, H / 2);
  s.lineTo(-L / 2, H / 2 - c);
  s.lineTo(-L / 2, -H / 2 + c);
  s.lineTo(-L / 2 + c, -H / 2);
  // fan openings go through the shroud, so the blades are not hidden behind its front face
  for (const x of FAN_X) {
    const hole = new THREE.Path();
    hole.absarc(x, 0, FAN_R + 0.04, 0, TAU, true);
    s.holes.push(hole);
  }
  const shroudGeo = new THREE.ExtrudeGeometry(s, { curveSegments: 9, depth: T, bevelEnabled: true, bevelThickness: 0.04, bevelSize: 0.04, bevelSegments: 1 });
  shroudGeo.translate(0, 0, -T / 2);
  card.add(withEdges(shroudGeo, lit(0x2c2f3c, { metalness: 0.5, roughness: 0.35 }), CYAN, 20));
  const front = T / 2 + 0.045;

  // two fans on the front
  const fans = FAN_X.map((x) => {
    const f = fan(FAN_R);
    f.position.set(x, 0, front - 0.02);
    card.add(f);
    return f;
  });
  // centre fin stack between the fans
  for (let k = 0; k < 6; k++) {
    const fin = new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.9, 0.04), lit(0x6b7390, { metalness: 0.8, roughness: 0.3 }));
    fin.position.set(-0.13 + k * 0.052, 0, front);
    card.add(fin);
  }
  // light bar along the top front edge: segments light up in a running wave
  const bar = [];
  for (let k = 0; k < 14; k++) {
    const seg = new THREE.Mesh(new THREE.BoxGeometry(L / 16, 0.035, 0.03), glow(CYAN, 0.4));
    seg.position.set(-L / 2 + 0.2 + (k + 0.5) * ((L - 0.4) / 14), H / 2 - 0.05, front + 0.005);
    seg.userData.k = k;
    card.add(seg);
    bar.push(seg);
  }
  // backplate vents (diagonal lines on the back face)
  const vent = [];
  for (let k = 0; k < 9; k++) {
    const x = 0.25 + k * 0.13;
    vent.push(new THREE.Vector3(x, -0.4, -front + 0.002), new THREE.Vector3(x + 0.25, 0.4, -front + 0.002));
  }
  // backplate panel outline and screw dots
  const bx = [-1.45, 0.1], by = [-0.48, 0.48], bz = -front + 0.002;
  const corners = [[bx[0], by[0]], [bx[1], by[0]], [bx[1], by[1]], [bx[0], by[1]]];
  corners.forEach(([x, y], i) => {
    const [x2, y2] = corners[(i + 1) % 4];
    vent.push(new THREE.Vector3(x, y, bz), new THREE.Vector3(x2, y2, bz));
  });
  for (let k = 0; k < 5; k++) vent.push(new THREE.Vector3(-1.35 + k * 0.32, -0.25, bz), new THREE.Vector3(-1.35 + k * 0.32 + 0.18, 0.25, bz));
  card.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(vent), new THREE.LineBasicMaterial({ color: VIOLET })));
  // bracket with display outputs
  const bracket = withEdges(new THREE.BoxGeometry(0.05, H + 0.2, T + 0.12), lit(0x9aa3b8, { metalness: 0.9, roughness: 0.25 }), 0xffffff, 20);
  bracket.position.set(-L / 2 - 0.08, 0.05, 0);
  card.add(bracket);
  for (let k = 0; k < 4; k++) {
    const port = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.1, 0.22), new THREE.MeshBasicMaterial({ color: 0x0a0b12 }));
    port.position.set(-L / 2 - 0.11, -0.42 + k * 0.26, 0);
    card.add(port);
  }
  // PCIe edge connector (gold) and the power connector on top
  const pcie = withEdges(new THREE.BoxGeometry(1.5, 0.12, 0.05), glow(AMBER, 0.5, { color: 0xb07a10 }), AMBER, 20);
  pcie.position.set(-0.55, -H / 2 - 0.08, 0);
  card.add(pcie);
  const power = withEdges(new THREE.BoxGeometry(0.34, 0.12, 0.16), lit(0x15161f), MAGENTA, 20);
  power.position.set(0.95, H / 2 + 0.07, 0);
  card.add(power);

  const pivot = new THREE.Group();
  pivot.add(card);
  pivot.position.y = 0.55;
  pivot.scale.setScalar(0.98);
  scene.add(pivot);

  // floating voxel label (always faces the camera)
  const word = voxelWord("RTX 5080", { vox: 0.104, from: CYAN, to: MAGENTA });
  word.position.set(0, -1.15, 0.6);
  word.rotation.x = -0.15;
  scene.add(word);

  const grid = floorGrid(-1.85);
  scene.add(grid);

  function update(p) {
    // eased turn: lingers on the front and the back, passes the thin edge-on views quickly
    pivot.rotation.y = -(p * TAU - 0.4 * Math.sin(2 * p * TAU));
    pivot.rotation.x = 0.18 + Math.sin(p * TAU) * 0.05;
    pivot.position.y = 0.55 + Math.sin(p * TAU * 2) * 0.05;
    // two turns per loop: ~12 degrees per frame reads as forward spin (larger steps strobe backwards)
    fans.forEach((f, i) => (f.userData.rotor.rotation.z = (i ? -1 : 1) * p * TAU * 2));
    bar.forEach((seg) => {
      const w = Math.max(0, Math.sin(p * TAU * 2 - seg.userData.k * 0.45)) ** 2;
      seg.material.emissiveIntensity = 0.25 + 1.1 * w;
    });
    waveVoxels(word, p);
    scrollGrid(grid, p);
    keyL.position.x = Math.cos(p * TAU) * 3.2;
    rimL.position.x = -Math.cos(p * TAU) * 3.2;
    scene.updateMatrixWorld(true);
  }
  return { scene, camera, update };
}
