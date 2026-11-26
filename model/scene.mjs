// Original low-poly game controller + voxel "ROKI" logo + orbiting crystals.
// Shared by scene.html (WebGL + bloom in a browser) and export_frames.mjs (Node, no browser).
import * as THREE from "three";

export const COLORS = { CYAN: 0x00f0ff, MAGENTA: 0xff2bd6, VIOLET: 0x8b5cf6, LIME: 0xa3ff12, AMBER: 0xffb020 };
const { CYAN, MAGENTA, VIOLET, LIME, AMBER } = COLORS;

const edgeMat = (color) => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.95 });
function withEdges(geo, mat, color, angle = 18) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), edgeMat(color)));
  return g;
}

export function createScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x070a18, 9, 18);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0, 0.55, 8.2);
  camera.lookAt(0, -0.05, 0);
  camera.updateMatrixWorld();

  scene.add(new THREE.HemisphereLight(0x8b5cf6, 0x05040d, 1.4));
  const keyL = new THREE.PointLight(CYAN, 40, 20);
  keyL.position.set(3, 3, 4);
  const rimL = new THREE.PointLight(MAGENTA, 40, 20);
  rimL.position.set(-3, 1, -3);
  scene.add(keyL, rimL);

  // ---------- controller body (extruded outline, few curve segments = low-poly)
  const s = new THREE.Shape();
  s.moveTo(-1.15, 0.62);
  s.lineTo(1.15, 0.62);
  s.quadraticCurveTo(1.75, 0.62, 1.9, 0.05);
  s.lineTo(2.05, -0.75);
  s.quadraticCurveTo(2.1, -1.15, 1.7, -1.15);
  s.quadraticCurveTo(1.35, -1.15, 1.05, -0.55);
  s.lineTo(-1.05, -0.55);
  s.quadraticCurveTo(-1.35, -1.15, -1.7, -1.15);
  s.quadraticCurveTo(-2.1, -1.15, -2.05, -0.75);
  s.lineTo(-1.9, 0.05);
  s.quadraticCurveTo(-1.75, 0.62, -1.15, 0.62);
  const bodyGeo = new THREE.ExtrudeGeometry(s, {
    depth: 0.42, curveSegments: 3, bevelEnabled: true, bevelThickness: 0.12, bevelSize: 0.1, bevelSegments: 1,
  });
  bodyGeo.translate(0, 0.2, -0.21);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1b1240, metalness: 0.35, roughness: 0.55, flatShading: true });
  const controller = new THREE.Group();
  controller.add(withEdges(bodyGeo, bodyMat, CYAN, 20));

  const front = 0.34; // z of the front face
  // d-pad
  const dp = new THREE.Shape();
  const a = 0.11, b = 0.32;
  dp.moveTo(-a, b); dp.lineTo(a, b); dp.lineTo(a, a); dp.lineTo(b, a); dp.lineTo(b, -a); dp.lineTo(a, -a);
  dp.lineTo(a, -b); dp.lineTo(-a, -b); dp.lineTo(-a, -a); dp.lineTo(-b, -a); dp.lineTo(-b, a); dp.lineTo(-a, a); dp.lineTo(-a, b);
  const dpGeo = new THREE.ExtrudeGeometry(dp, { depth: 0.08, bevelEnabled: false });
  const dpad = withEdges(dpGeo, new THREE.MeshStandardMaterial({ color: 0x0c0a1c, roughness: 0.4 }), MAGENTA);
  dpad.position.set(-1.15, 0.38, front);
  controller.add(dpad);
  // face buttons
  const btnGeo = new THREE.CylinderGeometry(0.13, 0.13, 0.1, 8);
  btnGeo.rotateX(Math.PI / 2);
  [[1.15, 0.65, CYAN], [1.43, 0.38, MAGENTA], [0.87, 0.38, LIME], [1.15, 0.11, AMBER]].forEach(([x, y, c]) => {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.9, roughness: 0.3 });
    const btn = withEdges(btnGeo, m, 0xffffff, 30);
    btn.position.set(x, y, front + 0.03);
    controller.add(btn);
  });
  // sticks
  const stickBase = new THREE.CylinderGeometry(0.26, 0.3, 0.1, 8);
  stickBase.rotateX(Math.PI / 2);
  const stickTop = new THREE.CylinderGeometry(0.2, 0.2, 0.14, 8);
  stickTop.rotateX(Math.PI / 2);
  [[-0.5, -0.12], [0.5, -0.12]].forEach(([x, y]) => {
    const base = withEdges(stickBase, new THREE.MeshStandardMaterial({ color: 0x0c0a1c, roughness: 0.5 }), VIOLET);
    base.position.set(x, y, front + 0.02);
    const top = withEdges(stickTop, new THREE.MeshStandardMaterial({ color: 0x241a55, roughness: 0.4 }), CYAN);
    top.position.set(x, y, front + 0.13);
    controller.add(base, top);
  });
  // center lights
  for (let i = 0; i < 3; i++) {
    const led = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.05, 0.04),
      new THREE.MeshBasicMaterial({ color: i === 0 ? LIME : 0x3a3f6a }),
    );
    led.position.set(-0.2 + i * 0.2, 0.62, front - 0.02);
    controller.add(led);
  }
  // shoulder triggers
  const trig = new THREE.BoxGeometry(0.85, 0.16, 0.42);
  [-1.3, 1.3].forEach((x) => {
    const t = withEdges(trig, new THREE.MeshStandardMaterial({ color: 0x241a55, roughness: 0.5, flatShading: true }), MAGENTA);
    t.position.set(x, 0.92, -0.05);
    t.rotation.z = x > 0 ? -0.08 : 0.08;
    controller.add(t);
  });
  controller.scale.setScalar(0.78);
  const ctrlPivot = new THREE.Group();
  ctrlPivot.add(controller);
  ctrlPivot.position.y = 0.72;
  scene.add(ctrlPivot);

  // ---------- orbiting crystals
  const crystals = new THREE.Group();
  const octa = new THREE.OctahedronGeometry(0.16, 0);
  octa.scale(1, 1.6, 1);
  [CYAN, MAGENTA, LIME].forEach((c) => {
    const m = new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, flatShading: true, transparent: true, opacity: 0.85 });
    crystals.add(withEdges(octa, m, 0xffffff, 1));
  });
  scene.add(crystals);

  // ---------- voxel "ROKI" (own 5-row pixel glyphs)
  const GLYPHS = {
    R: ["1110", "1001", "1110", "1010", "1001"],
    O: ["0110", "1001", "1001", "1001", "0110"],
    K: ["1001", "1010", "1100", "1010", "1001"],
    I: ["111", "010", "010", "010", "111"],
  };
  const word = "ROKI";
  const vox = 0.17;
  const logo = new THREE.Group();
  const cube = new THREE.BoxGeometry(vox * 0.9, vox * 0.9, vox * 0.9);
  const cubeEdges = new THREE.EdgesGeometry(cube);
  const widths = [...word].map((ch) => GLYPHS[ch][0].length);
  const totalW = widths.reduce((p, w) => p + w, 0) + (word.length - 1);
  const cMagenta = new THREE.Color(MAGENTA), cCyan = new THREE.Color(CYAN);
  let cursor = 0;
  [...word].forEach((ch, li) => {
    GLYPHS[ch].forEach((row, r) => {
      [...row].forEach((bit, c) => {
        if (bit !== "1") return;
        const col = cursor + c;
        const color = cMagenta.clone().lerp(cCyan, col / (totalW - 1));
        const mesh = new THREE.Mesh(cube, new THREE.MeshStandardMaterial({ color: 0x120c2a, emissive: color, emissiveIntensity: 0.55, roughness: 0.4 }));
        const lines = new THREE.LineSegments(cubeEdges, new THREE.LineBasicMaterial({ color }));
        const g = new THREE.Group();
        g.add(mesh, lines);
        g.position.set((col - (totalW - 1) / 2) * vox, (2 - r) * vox, 0);
        g.userData = { col, r };
        logo.add(g);
      });
    });
    cursor += widths[li] + 1;
  });
  logo.position.set(0, -1.18, 0.6);
  logo.rotation.x = -0.12;
  scene.add(logo);

  // ---------- floor grid
  const grid = new THREE.GridHelper(16, 24, MAGENTA, VIOLET);
  grid.position.y = -1.85;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  scene.add(grid);

  /** Pose everything for loop phase p in [0, 1). */
  function update(p) {
    const TAU = Math.PI * 2;
    ctrlPivot.rotation.y = p * TAU;
    ctrlPivot.rotation.x = 0.28 + Math.sin(p * TAU) * 0.06;
    ctrlPivot.position.y = 0.72 + Math.sin(p * TAU * 2) * 0.06;
    crystals.children.forEach((c, k) => {
      const ang = p * TAU + (k * TAU) / 3;
      c.position.set(Math.cos(ang) * 2.05, 0.75 + Math.sin(ang * 2) * 0.18, Math.sin(ang) * 1.25);
      c.rotation.y = p * TAU * 2;
    });
    // a wave of light runs across the voxel letters
    logo.children.forEach((g) => {
      const w = Math.max(0, Math.sin(p * TAU - g.userData.col * 0.45));
      g.children[0].material.emissiveIntensity = 0.35 + 0.55 * w;
      g.position.z = w * 0.06;
    });
    grid.position.z = (p * (16 / 24)) % (16 / 24);
    keyL.position.x = Math.cos(p * TAU) * 3.2;
    rimL.position.x = -Math.cos(p * TAU) * 3.2;
    scene.updateMatrixWorld(true);
  }

  return { scene, camera, update, lights: { keyL, rimL } };
}
