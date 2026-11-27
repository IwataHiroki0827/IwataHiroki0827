// Original neon Kyoto: a floating low-poly island with a five-storey pagoda, a torii gate,
// stone lanterns and a glowing stream that runs under the gate and falls off the edge.
import * as THREE from "three";
import { COLORS, withEdges, lit, glow, makeCamera, floorGrid, scrollGrid, quadGeo, rng } from "./common.mjs";

const { CYAN, MAGENTA, VIOLET, AMBER, VERMILION } = COLORS;
const TAU = Math.PI * 2;

export const meta = {
  out: "assets/model/neon-kyoto.gif",
  labelLeft: "JP",
  labelLeftColor: [255, 90, 54],
  labelRight: "KYOTO.SYS",
  bgTop: [0x05, 0x08, 0x16],
  bgBottom: [0x1a, 0x08, 0x26],
  glow: [70, 60, 200],
  glowY: 0.45,
  stars: 40,
  border: [[0, 240, 255], [255, 74, 28], [255, 43, 214]],
  frames: 50,
  pins: [[255, 74, 28], [255, 150, 90], [255, 176, 32], [0, 240, 255], [150, 250, 255], [255, 122, 184], [255, 255, 255]],
};

function pagoda() {
  const g = new THREE.Group();
  const body = lit(0x2a0c18, { roughness: 0.6 });
  const roof = lit(0x1b1030, { roughness: 0.5 });
  const base = withEdges(new THREE.BoxGeometry(0.95, 0.12, 0.95), lit(0x221a3a), VIOLET);
  base.position.y = 0.06;
  g.add(base);
  let y = 0.12;
  for (let i = 0; i < 5; i++) {
    const w = 0.56 - i * 0.065;
    const bh = i === 0 ? 0.26 : 0.17;
    const b = withEdges(new THREE.BoxGeometry(w, bh, w), body, VERMILION, 10);
    b.position.y = y + bh / 2;
    g.add(b);
    y += bh;
    // flared square roof: frustum with 4 sides, rotated so the sides face the walls
    const rw = w * 1.5;
    const rg = new THREE.CylinderGeometry(w * 0.42, rw * 0.72, 0.09, 4, 1);
    rg.rotateY(Math.PI / 4);
    const r = withEdges(rg, roof, i % 2 ? CYAN : AMBER, 10);
    r.position.y = y + 0.045;
    g.add(r);
    y += 0.09;
  }
  // spire (sorin) with rings
  const spire = withEdges(new THREE.CylinderGeometry(0.018, 0.025, 0.5, 5), glow(AMBER, 0.7), AMBER);
  spire.position.y = y + 0.25;
  g.add(spire);
  for (let k = 0; k < 4; k++) {
    const ring = withEdges(new THREE.CylinderGeometry(0.06, 0.06, 0.018, 8), glow(AMBER, 0.8), AMBER);
    ring.position.y = y + 0.1 + k * 0.08;
    g.add(ring);
  }
  const jewel = withEdges(new THREE.OctahedronGeometry(0.05, 0), glow(CYAN, 1), 0xffffff, 1);
  jewel.position.y = y + 0.53;
  g.add(jewel);
  return g;
}

function torii() {
  const g = new THREE.Group();
  const red = glow(VERMILION, 0.75, { color: 0xc0300f });
  const dark = lit(0x15101f);
  for (const x of [-0.42, 0.42]) {
    const p = withEdges(new THREE.CylinderGeometry(0.055, 0.068, 1.05, 6), red, 0xffb08a);
    p.position.set(x, 0.525, 0);
    g.add(p);
    const foot = withEdges(new THREE.CylinderGeometry(0.085, 0.085, 0.08, 6), dark, VIOLET);
    foot.position.set(x, 0.04, 0);
    g.add(foot);
  }
  // kasagi (top beam, dark cap) with upturned ends
  const kasagi = withEdges(new THREE.BoxGeometry(1.05, 0.07, 0.13), dark, 0xffb08a);
  kasagi.position.y = 1.12;
  g.add(kasagi);
  for (const s of [-1, 1]) {
    const tip = withEdges(new THREE.BoxGeometry(0.26, 0.07, 0.13), dark, 0xffb08a);
    tip.position.set(s * 0.63, 1.15, 0);
    tip.rotation.z = s * 0.22;
    g.add(tip);
  }
  const shimaki = withEdges(new THREE.BoxGeometry(1.2, 0.06, 0.11), red, 0xffb08a);
  shimaki.position.y = 1.055;
  g.add(shimaki);
  const nuki = withEdges(new THREE.BoxGeometry(1.08, 0.055, 0.08), red, 0xffb08a);
  nuki.position.y = 0.84;
  g.add(nuki);
  const gaku = withEdges(new THREE.BoxGeometry(0.09, 0.17, 0.09), glow(AMBER, 0.6), AMBER);
  gaku.position.y = 0.94;
  g.add(gaku);
  return g;
}

function lantern() {
  const g = new THREE.Group();
  const stone = lit(0x2b2a44);
  const parts = [
    [new THREE.BoxGeometry(0.16, 0.05, 0.16), 0.025, stone, VIOLET],
    [new THREE.CylinderGeometry(0.03, 0.04, 0.2, 6), 0.15, stone, VIOLET],
    [new THREE.BoxGeometry(0.13, 0.11, 0.13), 0.305, glow(AMBER, 1.2), 0xffe2a8],
    [new THREE.ConeGeometry(0.13, 0.09, 4), 0.405, stone, VIOLET],
  ];
  for (const [geo, y, mat, edge] of parts) {
    if (geo.type === "ConeGeometry") geo.rotateY(Math.PI / 4);
    const m = withEdges(geo, mat, edge, 10);
    m.position.y = y;
    g.add(m);
  }
  return g;
}

/** Flat ribbon along a curve: one quad per segment, each with its own material (animated). */
function stream(curve, n, width, y) {
  const segs = [];
  const group = new THREE.Group();
  const pts = curve.getSpacedPoints(n);
  const side = (i) => {
    const t = curve.getTangentAt(Math.min(1, i / n)).setY(0).normalize();
    return new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(width / 2);
  };
  const bankL = [], bankR = [];
  for (let i = 0; i < n; i++) {
    const a = pts[i], b = pts[i + 1];
    const sa = side(i), sb = side(i + 1);
    const l0 = a.clone().add(sa).setY(y), r0 = a.clone().sub(sa).setY(y);
    const l1 = b.clone().add(sb).setY(y), r1 = b.clone().sub(sb).setY(y);
    let geo = quadGeo(l0.toArray(), l1.toArray(), r1.toArray(), r0.toArray());
    geo.computeVertexNormals();
    if (geo.attributes.normal.getY(0) < 0) geo = quadGeo(l0.toArray(), r0.toArray(), r1.toArray(), l1.toArray());
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x0a2f5a }));
    mesh.userData = { s: i / n, depthBias: -0.15 };
    group.add(mesh);
    segs.push(mesh);
    bankL.push(l0, l1);
    bankR.push(r0, r1);
  }
  const banks = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints([...bankL, ...bankR]),
    new THREE.LineBasicMaterial({ color: CYAN }),
  );
  banks.userData.depthBias = -0.16;
  group.add(banks);
  return { group, segs, end: pts[n], endSide: side(n) };
}

/** Vertical ribbon falling from `top` (double-sided), segments animated like the stream. */
function waterfall(top, side, drop, n) {
  const group = new THREE.Group();
  const segs = [];
  for (let i = 0; i < n; i++) {
    const y0 = top.y - (drop * i) / n, y1 = top.y - (drop * (i + 1)) / n;
    const spread = 1 + i * 0.03;
    const s0 = side.clone().multiplyScalar(spread), s1 = side.clone().multiplyScalar(spread + 0.03);
    const a = top.clone().add(s0).setY(y0), b = top.clone().sub(s0).setY(y0);
    const c = top.clone().sub(s1).setY(y1), d = top.clone().add(s1).setY(y1);
    const mesh = new THREE.Mesh(quadGeo(a.toArray(), b.toArray(), c.toArray(), d.toArray()), new THREE.MeshBasicMaterial({ color: 0x0a2f5a }));
    mesh.userData = { s: i / n, doubleSide: true, depthBias: -0.02 };
    group.add(mesh);
    segs.push(mesh);
  }
  return { group, segs };
}

/** Flat disc (y = 0, facing up) split into rings x sectors, matching a CylinderGeometry's corners. */
function polarCap(r, sectors, rings) {
  const v = [];
  const pt = (i, k) => {
    const a = (k / sectors) * Math.PI * 2;
    const rr = (r * i) / rings;
    return [Math.sin(a) * rr, 0, Math.cos(a) * rr];
  };
  for (let i = 0; i < rings; i++)
    for (let k = 0; k < sectors; k++) {
      const a = pt(i, k), b = pt(i, k + 1), c = pt(i + 1, k + 1), d = pt(i + 1, k);
      if (i > 0) v.push(...a, ...c, ...b);
      v.push(...a, ...d, ...c);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return g;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x050816, 10, 22);
  const camera = makeCamera(34, 1, [0, 2.6, 9.5], [0, 0.2, 0]);
  scene.add(new THREE.HemisphereLight(0x6b5cf6, 0x05040d, 1.4));
  const keyL = new THREE.PointLight(CYAN, 34, 20);
  keyL.position.set(3, 3.5, 4);
  const rimL = new THREE.PointLight(VERMILION, 40, 20);
  rimL.position.set(-3, 2, -3);
  scene.add(keyL, rimL);

  // ---------- backdrop: moon and a mountain ridge (static, does not rotate)
  const moon = new THREE.Mesh(new THREE.CircleGeometry(0.9, 14), new THREE.MeshBasicMaterial({ color: 0xffe6c2 }));
  moon.position.set(-1.6, 2.0, -9);
  moon.userData.noFog = true;
  const halo = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CircleGeometry(1.08, 14)), new THREE.LineBasicMaterial({ color: MAGENTA }));
  halo.position.copy(moon.position);
  halo.userData.noFog = true;
  scene.add(moon, halo);
  const R = rng(5);
  const ridge = [];
  for (let i = 0; i <= 12; i++) ridge.push(new THREE.Vector3(-11 + i * 1.85, -0.4 + R() * 1.6 + (i % 2) * 0.6, -9.5));
  const ridgeTris = [];
  for (let i = 0; i < ridge.length - 1; i++) {
    const a = ridge[i], b = ridge[i + 1];
    ridgeTris.push(a.x, -3, a.z, b.x, -3, b.z, b.x, b.y, b.z, a.x, -3, a.z, b.x, b.y, b.z, a.x, a.y, a.z);
  }
  const ridgeGeo = new THREE.BufferGeometry();
  ridgeGeo.setAttribute("position", new THREE.Float32BufferAttribute(ridgeTris, 3));
  const ridgeMesh = new THREE.Mesh(ridgeGeo, new THREE.MeshBasicMaterial({ color: 0x0b0a20 }));
  ridgeMesh.userData = { noFog: true, doubleSide: true };
  const ridgeLine = new THREE.LineSegments(
    new THREE.BufferGeometry().setFromPoints(ridge.flatMap((p, i) => (i ? [ridge[i - 1], p] : []))),
    new THREE.LineBasicMaterial({ color: VIOLET }),
  );
  ridgeLine.userData.noFog = true;
  scene.add(ridgeMesh, ridgeLine);

  // ---------- floating island
  const island = new THREE.Group();
  // side wall + a finely split top cap: small triangles keep the painter's sort right for the stream
  const sideGeo = new THREE.CylinderGeometry(2.3, 1.9, 0.38, 9, 1, true);
  sideGeo.translate(0, -0.19, 0);
  island.add(withEdges(sideGeo, lit(0x1a1530, { roughness: 0.8 }), VIOLET, 10));
  island.add(new THREE.Mesh(polarCap(2.3, 9, 6), lit(0x1a1530, { roughness: 0.8 })));
  const rockGeo = new THREE.ConeGeometry(1.9, 1.7, 9, 1);
  rockGeo.rotateX(Math.PI);
  rockGeo.translate(0, -0.38 - 0.85, 0);
  island.add(withEdges(rockGeo, lit(0x120e24, { roughness: 0.9 }), 0x4c2a8a, 10));
  // moss patches (flat low-poly tiles)
  const mossMat = lit(0x14302a, { roughness: 0.9 });
  [[-1.4, 0.7, 0.5], [1.3, -0.9, 0.45], [-0.2, 1.5, 0.35]].forEach(([x, z, r]) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.02, 6), mossMat);
    m.position.set(x, 0.01, z);
    island.add(m);
  });

  const pg = pagoda();
  pg.position.set(-0.75, 0, -0.55);
  island.add(pg);
  const gate = torii();
  gate.position.set(0.85, 0, 0.75);
  island.add(gate);
  [[0.15, 0.95], [1.55, 0.55], [-1.5, -0.2]].forEach(([x, z]) => {
    const l = lantern();
    l.position.set(x, 0, z);
    island.add(l);
  });

  // ---------- the stream: from a spring behind the pagoda, under the torii, off the edge
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.2, 0, -1.75),
    new THREE.Vector3(0.35, 0, -1.0),
    new THREE.Vector3(0.95, 0, -0.25),
    new THREE.Vector3(0.85, 0, 0.75),
    new THREE.Vector3(0.95, 0, 1.6),
    new THREE.Vector3(1.12, 0, 2.18),
  ]);
  const st = stream(curve, 40, 0.34, 0.03);
  island.add(st.group);
  const spring = withEdges(new THREE.CylinderGeometry(0.22, 0.22, 0.04, 8), glow(CYAN, 0.8), 0xffffff);
  spring.position.set(-0.2, 0.03, -1.75);
  island.add(spring);
  const fall = waterfall(st.end.clone().setY(0.025), st.endSide, 2.6, 16);
  island.add(fall.group);
  // droplets falling beside the waterfall
  const drops = [];
  const dropGeo = new THREE.OctahedronGeometry(0.045, 0);
  for (let k = 0; k < 7; k++) {
    const d = withEdges(dropGeo, glow(CYAN, 1), 0xffffff, 1);
    d.userData = { k };
    island.add(d);
    drops.push(d);
  }
  island.position.y = 0.15;
  scene.add(island);

  // sakura petals drifting around the island
  const petals = [];
  const petalGeo = new THREE.TetrahedronGeometry(0.07, 0);
  for (let k = 0; k < 6; k++) {
    const pt = withEdges(petalGeo, glow(0xff7ab8, 0.8), 0xffd0e6, 1);
    scene.add(pt);
    petals.push(pt);
  }

  const grid = floorGrid(-2.9);
  scene.add(grid);

  const deep = new THREE.Color(0x0a2f5a), bright = new THREE.Color(0x7ff8ff);
  const flow = (s, p, k = 5) => Math.max(0, Math.sin(TAU * (s * k - p * 3))) ** 4;

  function update(p) {
    island.rotation.y = -p * TAU;
    island.position.y = 0.15 + Math.sin(p * TAU * 2) * 0.05;
    st.segs.forEach((m) => m.material.color.copy(deep).lerp(bright, 0.15 + 0.85 * flow(m.userData.s, p)));
    fall.segs.forEach((m) => {
      const fade = 1 - m.userData.s * 0.75;
      m.material.color.copy(deep).lerp(bright, (0.2 + 0.8 * flow(m.userData.s, p * 2, 3)) * fade).multiplyScalar(0.4 + 0.6 * fade);
    });
    drops.forEach((d) => {
      const t = (p * 2 + d.userData.k / drops.length) % 1;
      const s = d.userData.k % 2 ? 1 : -1;
      d.position.set(st.end.x + st.endSide.x * s * 0.9, 0.0 - t * 2.4, st.end.z + st.endSide.z * s * 0.9 + 0.08);
      d.visible = t < 0.92;
    });
    petals.forEach((pt, k) => {
      const a = p * TAU + (k * TAU) / petals.length;
      pt.position.set(Math.cos(a) * 2.7, 1.2 + Math.sin(a * 2 + k) * 0.5, Math.sin(a) * 1.6);
      pt.rotation.set(a * 2, a * 3, 0);
    });
    scrollGrid(grid, p);
    keyL.position.x = Math.cos(p * TAU) * 3.2;
    scene.updateMatrixWorld(true);
  }
  return { scene, camera, update };
}
