// Export every frame of the scene as screen-space primitives (no browser, no GPU).
//   node model/export_frames.mjs <out.json> [frames=72]
// Each frame: list of [kind, depth, color(r,g,b 0..1), x0,y0, x1,y1, (x2,y2)]
//   kind 0 = filled triangle (flat-shaded, fogged), kind 1 = line segment.
// x/y are in [0,1] (origin top-left); depth is view-space distance (larger = farther).
// render_cpu.py rasterises these with the painter's algorithm and adds a bloom.
import { writeFileSync } from "node:fs";
import * as THREE from "three";
import { createScene } from "./scene.mjs";

const out = process.argv[2] ?? "frames.json";
const FRAMES = Number(process.argv[3] ?? 72);
const { scene, camera, update, lights } = createScene();
const fogColor = new THREE.Color(0x070a18);
const FOG_NEAR = 9, FOG_FAR = 18;

const hemiSky = new THREE.Color(0x8b5cf6), hemiGround = new THREE.Color(0x05040d);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), tmpC = new THREE.Vector3();
const n = new THREE.Vector3(), centre = new THREE.Vector3(), toL = new THREE.Vector3(), toCam = new THREE.Vector3();

const project = (v) => {
  const p = v.clone().project(camera);
  return [(p.x + 1) / 2, (1 - p.y) / 2];
};
const viewDepth = (v) => v.distanceTo(camera.position);
// near-plane handling: points behind the camera would project mirrored
const NEAR = 0.5;
const camZ = (v) => -v.clone().applyMatrix4(camera.matrixWorldInverse).z; // distance along view axis
const inFront = (v) => camZ(v) > NEAR;
/** Clip segment a-b (world space, mutated) to the part in front of the near plane. */
function clipToNear(a, b) {
  const za = camZ(a), zb = camZ(b);
  if (za <= NEAR && zb <= NEAR) return false;
  if (za > NEAR && zb > NEAR) return true;
  const t = (NEAR - za) / (zb - za);
  const hit = a.clone().lerp(b, t);
  if (za <= NEAR) a.copy(hit);
  else b.copy(hit);
  return true;
}
const fog = (c, d) => {
  const f = THREE.MathUtils.clamp((d - FOG_NEAR) / (FOG_FAR - FOG_NEAR), 0, 1);
  return c.clone().lerp(fogColor, f);
};
const rgb = (c) => [+c.r.toFixed(3), +c.g.toFixed(3), +c.b.toFixed(3)];
const r4 = (x) => +x.toFixed(4);

function shade(mat, normal, pos) {
  const base = mat.color ? mat.color.clone() : new THREE.Color(1, 1, 1);
  if (mat.isMeshBasicMaterial) return base;
  // hemisphere ambient
  const up = THREE.MathUtils.clamp(normal.y * 0.5 + 0.5, 0, 1);
  const amb = hemiGround.clone().lerp(hemiSky, up).multiplyScalar(1.1);
  const col = base.clone().multiply(amb);
  // two point lights, lambert + a little specular
  for (const L of [lights.keyL, lights.rimL]) {
    toL.copy(L.position).sub(pos);
    const dist = toL.length();
    toL.normalize();
    const ndl = Math.max(0, normal.dot(toL));
    const att = Math.max(0, 1 - dist / L.distance) ** 2 * 2.2;
    col.add(base.clone().multiply(L.color).multiplyScalar(ndl * att * 1.6));
    toCam.copy(camera.position).sub(pos).normalize();
    const h = toL.clone().add(toCam).normalize();
    const spec = Math.max(0, normal.dot(h)) ** 24 * att * (1 - (mat.roughness ?? 0.5)) * 1.2;
    col.add(L.color.clone().multiplyScalar(spec));
  }
  if (mat.emissive) col.add(mat.emissive.clone().multiplyScalar(mat.emissiveIntensity ?? 1));
  return col;
}

const frames = [];
for (let f = 0; f < FRAMES; f++) {
  update(f / FRAMES);
  const prims = [];
  scene.traverse((obj) => {
    if (!obj.visible) return;
    const geo = obj.geometry;
    if (!geo) return;
    const pos = geo.attributes.position;
    const m = obj.matrixWorld;
    const objPos = new THREE.Vector3().setFromMatrixPosition(m);
    if (obj.isMesh) {
      const idx = geo.index;
      const count = idx ? idx.count : pos.count;
      for (let i = 0; i < count; i += 3) {
        const ia = idx ? idx.getX(i) : i, ib = idx ? idx.getX(i + 1) : i + 1, ic = idx ? idx.getX(i + 2) : i + 2;
        tmpA.fromBufferAttribute(pos, ia).applyMatrix4(m);
        tmpB.fromBufferAttribute(pos, ib).applyMatrix4(m);
        tmpC.fromBufferAttribute(pos, ic).applyMatrix4(m);
        n.subVectors(tmpC, tmpB).cross(tmpA.clone().sub(tmpB)).normalize();
        centre.copy(tmpA).add(tmpB).add(tmpC).divideScalar(3);
        // back-face culling (closed meshes)
        if (n.dot(toCam.copy(camera.position).sub(centre)) <= 0) continue;
        if (![tmpA, tmpB, tmpC].every(inFront)) continue;
        const d = viewDepth(centre);
        // light each object from its own origin so coplanar triangles shade identically (no blotches)
        const c = fog(shade(obj.material, n, objPos), d);
        const [x0, y0] = project(tmpA), [x1, y1] = project(tmpB), [x2, y2] = project(tmpC);
        prims.push([0, r4(d), rgb(c), r4(x0), r4(y0), r4(x1), r4(y1), r4(x2), r4(y2)]);
      }
    } else if (obj.isLineSegments) {
      const colAttr = geo.attributes.color;
      for (let i = 0; i < pos.count; i += 2) {
        tmpA.fromBufferAttribute(pos, i).applyMatrix4(m);
        tmpB.fromBufferAttribute(pos, i + 1).applyMatrix4(m);
        if (!clipToNear(tmpA, tmpB)) continue;
        centre.copy(tmpA).add(tmpB).multiplyScalar(0.5);
        const d = viewDepth(centre) - 0.03; // draw edges just above their faces
        let c = colAttr ? new THREE.Color().fromBufferAttribute(colAttr, i) : obj.material.color.clone();
        c = fog(c.multiplyScalar(obj.material.opacity ?? 1), d);
        const [x0, y0] = project(tmpA), [x1, y1] = project(tmpB);
        prims.push([1, r4(d), rgb(c), r4(x0), r4(y0), r4(x1), r4(y1)]);
      }
    }
  });
  frames.push(prims);
}
writeFileSync(out, JSON.stringify({ frames: FRAMES, data: frames }), "utf-8");
console.log(`wrote ${out}: ${FRAMES} frames, ${frames[0].length} primitives in frame 0`);
