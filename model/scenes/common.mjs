// Helpers shared by the scenes in this folder.
//
// A scene module exports
//   meta          : { out, labelLeft, labelRight, size?: [w, h], pins?, bgTop?, bgBottom?, glow?, glowY?, border? }
//                   (read by model/render_cpu.py; colours are [r, g, b] 0-255)
//   createScene(data) -> { scene, camera, update(p) }   p = loop phase in [0, 1)
// export_frames.mjs reads the fog, the HemisphereLight and every PointLight straight from the scene.
// Materials: MeshBasicMaterial = unlit colour, MeshStandardMaterial = lit (colour, emissive, roughness).
// userData.noFog on a mesh/line skips fog; userData.doubleSide on a mesh disables back-face culling.
import * as THREE from "three";

export const COLORS = {
  CYAN: 0x00f0ff,
  MAGENTA: 0xff2bd6,
  VIOLET: 0x8b5cf6,
  LIME: 0xa3ff12,
  AMBER: 0xffb020,
  VERMILION: 0xff4a1c,
  CORAL: 0xd97757,
  WHITE: 0xffffff,
};

export const edgeMat = (color, opacity = 0.95) => new THREE.LineBasicMaterial({ color, transparent: true, opacity });

/** Mesh + its neon outline (EdgesGeometry) in one group. */
export function withEdges(geo, mat, color, angle = 18) {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(geo, mat));
  g.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, angle), edgeMat(color)));
  return g;
}

export const lit = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, flatShading: true, ...extra });
export const glow = (color, intensity = 0.9, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensity, roughness: 0.3, ...extra });

/** Camera helper: perspective camera looking at a target, matrices updated. */
export function makeCamera(fov, aspect, pos, target) {
  const camera = new THREE.PerspectiveCamera(fov, aspect, 0.1, 100);
  camera.position.set(...pos);
  camera.lookAt(...target);
  camera.updateMatrixWorld();
  return camera;
}

/** Neon floor grid (scrolls with update phase via `scrollGrid`). */
export function floorGrid(y, size = 16, div = 24) {
  const grid = new THREE.GridHelper(size, div, COLORS.MAGENTA, COLORS.VIOLET);
  grid.position.y = y;
  grid.material.transparent = true;
  grid.material.opacity = 0.45;
  grid.userData.step = size / div;
  return grid;
}
export const scrollGrid = (grid, p) => {
  grid.position.z = (p * grid.userData.step) % grid.userData.step;
};

// Own 5-row pixel glyphs for voxel words (only the characters the scenes need).
export const GLYPHS = {
  R: ["1110", "1001", "1110", "1010", "1001"],
  O: ["0110", "1001", "1001", "1001", "0110"],
  K: ["1001", "1010", "1100", "1010", "1001"],
  I: ["111", "010", "010", "010", "111"],
  T: ["111", "010", "010", "010", "010"],
  X: ["101", "101", "010", "101", "101"],
  Y: ["101", "101", "010", "010", "010"],
  0: ["0110", "1001", "1001", "1001", "0110"],
  5: ["1111", "1000", "1110", "0001", "1110"],
  8: ["0110", "1001", "0110", "1001", "0110"],
  " ": ["0", "0", "0", "0", "0"],
};

/**
 * Voxel word: one small cube per lit pixel, coloured along a gradient.
 * Children carry userData.col (column index) so a scene can run a light wave across them.
 */
export function voxelWord(word, { vox = 0.17, from = COLORS.MAGENTA, to = COLORS.CYAN } = {}) {
  const logo = new THREE.Group();
  const cube = new THREE.BoxGeometry(vox * 0.9, vox * 0.9, vox * 0.9);
  const cubeEdges = new THREE.EdgesGeometry(cube);
  const chars = [...word];
  const widths = chars.map((ch) => GLYPHS[ch][0].length);
  const totalW = widths.reduce((p, w) => p + w, 0) + (chars.length - 1);
  const cA = new THREE.Color(from), cB = new THREE.Color(to);
  let cursor = 0;
  chars.forEach((ch, li) => {
    GLYPHS[ch].forEach((row, r) => {
      [...row].forEach((bit, c) => {
        if (bit !== "1") return;
        const col = cursor + c;
        const color = cA.clone().lerp(cB, col / Math.max(1, totalW - 1));
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
  logo.userData.width = totalW * vox;
  return logo;
}

/** Light wave across a voxelWord (call from update). */
export function waveVoxels(logo, p, speed = 0.45) {
  logo.children.forEach((g) => {
    const w = Math.max(0, Math.sin(p * Math.PI * 2 - g.userData.col * speed));
    g.children[0].material.emissiveIntensity = 0.35 + 0.55 * w;
    g.position.z = w * 0.05;
  });
}

/** One quad (two triangles) as a BufferGeometry; vertices a-b-c-d in order. */
export function quadGeo(a, b, c, d) {
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  return g;
}

/** Deterministic pseudo-random numbers (same GIF every run). */
export function rng(seed = 7) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
