// Our cast as lit flat sprites in the 3D world. Each frame every character asks for a drawing (a key + a draw call);
// the pool keeps one canvas per distinct drawing, so townsfolk in step share canvases (7 head shapes x 6 outfits).
// Characters are yaw-only billboards shaded by cardShade() (scene tint, bright floor, side gradient toward
// the sun, painted crescent in the drawing); standing ones get a soft multiply contact blob. Effects are unlit cards.
// Cards, effects and blobs live on the NOINK layer so the world ink pass never outlines their quads.
//
// Molasses staging: crowds follow story.ts (Crowd per shot) and the voice words. Reactions land 0-3 f before
// their word (LEAD). Positions are in metres; y = D0 = 6 is the street, the pool surface is D0 + 0.8 * flood.
import * as THREE from "three";
import {
  Pen, bodyFront, bodySide, townsfolk, worker, summer, ENGINEER, PAINTER, KID, fxBurst, fxCreak, fxStars, fxShadow, fxContact,
  fxDrip, fxSpoon, fxScent, fxRivet, fxMolasses, fxStretch, fxCrate, fxBoot,
  Outfit, Expr, FrontOpts, SideOpts,
} from "./toon";
import {
  FPS, D0, SHOTS, V3, smooth, clamp01, MolState, BURST, TANK, TANK_R, OFFICE, SPOON,
} from "./story";
import { NOINK } from "./ink";
import { cardShade, blobMaterial, CARD_K } from "./cardshade";

// ---------------- canvas pool ----------------
type Entry = { cv: HTMLCanvasElement; tex: THREE.CanvasTexture; w: number; h: number };
export type Req = { key: string; w: number; h: number; k: number; draw: (p: Pen) => void; tex?: THREE.CanvasTexture };
const makeEntry = (w: number, h: number): Entry => {
  const cv = document.createElement("canvas");
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  return { cv, tex, w, h };
};
export class Pool {
  private live = new Map<string, Entry>();
  private free: Entry[] = [];
  private reqs: Req[] = [];
  req(key: string, w: number, h: number, k: number, draw: (p: Pen) => void) {
    const r: Req = { key: `${w}x${h}|${key}`, w, h, k, draw };
    this.reqs.push(r);
    return r;
  }
  flush() {
    const want = new Map<string, Req[]>();
    for (const r of this.reqs) { const l = want.get(r.key); if (l) l.push(r); else want.set(r.key, [r]); }
    for (const [key, e] of this.live) if (!want.has(key)) { this.live.delete(key); this.free.push(e); }
    for (const [key, rs] of want) {
      let e = this.live.get(key);
      if (!e) {
        const r = rs[0], i = this.free.findIndex((x) => x.w === r.w && x.h === r.h);
        e = i >= 0 ? this.free.splice(i, 1)[0] : makeEntry(r.w, r.h);
        const g = e.cv.getContext("2d")!;
        g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, e.w, e.h); g.setTransform(r.k, 0, 0, r.k, 0, 0);
        r.draw(new Pen(g));
        e.tex.needsUpdate = true;
        this.live.set(key, e);
      }
      for (const r of rs) r.tex = e.tex;
    }
    this.reqs = [];
  }
}

// ---------------- sprite meshes ----------------
const blank = (() => { const c = document.createElement("canvas"); c.width = c.height = 2; return new THREE.CanvasTexture(c); })();
export const SU = 0.00216; // metres per design unit: 1000 units = 2.16 m
const BODY = (() => { const g = new THREE.PlaneGeometry(600 * SU, 1000 * SU); g.translate(0, (975 - 500) * SU, 0); return g; })();
const CARD = new THREE.PlaneGeometry(1, 1);
/** world roots that hold actors (to find the scene's sun when world.ts does not pass it) */
const ROOTS = new Set<THREE.Object3D>();

/** lit flat character: cardShade() material, receives shadows (dims to the bright floor only), casts its silhouette
 *  when world.ts says so (golden). Drawn after the contact blobs (renderOrder 1). */
export class Actor {
  mesh: THREE.Mesh; mat: THREE.MeshLambertMaterial; dmat: THREE.MeshDepthMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D, geo: THREE.BufferGeometry = BODY) {
    this.mat = cardShade(new THREE.MeshLambertMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide }));
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.dmat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mesh = new THREE.Mesh(geo, this.mat);
    this.mesh.customDepthMaterial = this.dmat;
    // rim width is in output pixels: tell the card shader the render height (1920 = 1080 x 1920 frame)
    this.mesh.onBeforeRender = (r) => { const rt = r.getRenderTarget(); CARD_K.uPx.value = (rt ? rt.height : r.domElement.height) / 1920; };
    this.mesh.castShadow = false; this.mesh.receiveShadow = true; this.mesh.visible = false;
    this.mesh.rotation.order = "YXZ"; this.mesh.renderOrder = 1; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
    ROOTS.add(parent);
  }
  bind() { const t = this.r?.tex; if (t) { this.mat.map = t; this.dmat.map = t; } }
}
/** unlit effect card: hard cut-out (ink drawings), soft see-through (dust, mist) or a multiply ground blob */
export class Fx {
  mesh: THREE.Mesh; mat: THREE.MeshBasicMaterial; soft: THREE.MeshBasicMaterial; blob: THREE.MeshBasicMaterial; r: Req | null = null;
  constructor(parent: THREE.Object3D) {
    this.mat = new THREE.MeshBasicMaterial({ map: blank, alphaTest: 0.5, side: THREE.DoubleSide });
    this.mat.alphaToCoverage = false; // A2C + MSAA left 1 px sky-depth seams on blurred far cards (POST)
    this.soft = new THREE.MeshBasicMaterial({ map: blank, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    this.blob = blobMaterial(blank);
    this.mesh = new THREE.Mesh(CARD, this.mat);
    this.mesh.visible = false; this.mesh.layers.set(NOINK);
    parent.add(this.mesh);
  }
  use(soft: boolean) { this.mesh.material = soft ? this.soft : this.mat; }
  bind() {
    const t = this.r?.tex;
    if (!t) return;
    if (this.r!.key.includes("|blob|")) {
      // no mipmaps: at grazing views the mip chain averages the blob with its white surround and it fades out
      if (t.generateMipmaps) { t.generateMipmaps = false; t.minFilter = THREE.LinearFilter; t.needsUpdate = true; }
      this.blob.map = t; this.mesh.material = this.blob; this.mesh.renderOrder = 0.5;
    }
    else { this.mat.map = t; this.soft.map = t; this.mesh.renderOrder = 0; }
  }
}

// ---------------- placements ----------------
export type Place = {
  key: string; draw: (p: Pen) => void; x: number; y: number; z: number;
  scale?: number; mirror?: boolean; yaw?: number; geo?: "body" | "swing"; roll?: number; size?: [number, number, number];
};
export type FxPlace = { key: string; cw: number; ch: number; draw: (p: Pen) => void; x: number; y: number; z: number; w: number; h: number; flat?: boolean; rot?: number; soft?: boolean };
/** sun = world direction TOWARD the sun (optional: when absent the scene's shadow-casting light is used) */
export type CamInfo = { pos: THREE.Vector3; right: THREE.Vector3; sun?: THREE.Vector3 };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const FOLK = [0, 1, 2, 3, 4, 5].map((v) => townsfolk(v));
const WORK = [0, 1, 2, 3].map((v) => worker(v));
const SUMMER = [0, 1, 2, 3, 4, 5].map((v) => summer(v));
/** head-shape seed: 7 shapes, so townsfolk in step still share canvases */
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
/** drawing resolution by distance: [canvas w, h, scale from the 600 x 1000 design]; sized for the 1440 x 2560 final */
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];

// ---------------- light ----------------
const SUN = new THREE.Vector3(0.5, 0.75, -0.4).normalize();
const tmp = new THREE.Vector3();
let LNAME: "day" | "golden" = "day";
const sunOf = (root: THREE.Object3D) => {
  let s: THREE.DirectionalLight | null = null;
  root.traverse((o) => { if (!s && o instanceof THREE.DirectionalLight && o.castShadow) s = o; });
  return s as THREE.DirectionalLight | null;
};
/** the sun of the world that is calling: the attached root whose sun target sits on this camera's view axis */
const findSun = (cam: CamInfo, out: THREE.Vector3) => {
  if (cam.sun) return out.copy(cam.sun).normalize();
  let best: THREE.DirectionalLight | null = null, err = Infinity;
  for (const r of ROOTS) {
    if (!r.parent) continue;
    const s = sunOf(r);
    if (!s) continue;
    const d = tmp.copy(s.target.position).sub(cam.pos), e = Math.abs(d.dot(cam.right)) / (d.length() || 1);
    if (e < err) { err = e; best = s; }
  }
  return best ? out.copy(best.position).sub(best.target.position).normalize() : out;
};
/** canvas angle the sun comes FROM on an upright card facing the camera, in 45-degree steps (small texture cache) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sx = SUN.dot(cam.right) * (mirror ? -1 : 1), sy = -SUN.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};

/** front / side view and mirroring for someone at (x, z) walking along (dx, dz); fs = foreshortening of the walk */
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

// ---------------- life: blinks and reaction timing ----------------
/** reference expression and action changes land 0-3 f before the word onset */
const LEAD = 2 / FPS;
/** eyelid 0 open .. 1 shut. Reference: gaps 0.5-2.3 s, 4-frame blink half / shut / shut / half, plus a blink across
 *  every expression swap (the shut frames hide the swap) */
const LID = [0.5, 1, 1, 0.5];
/** expression swaps per shot (seconds): groan starts, "nggak bisa bergerak", the engineer's smile, the sniff */
const SWAPS: Record<number, number[]> = { 5: [23.0], 9: [40.37], 13: [56.7], 14: [61.2] };
const lidAt = (t: number, i: number, swaps: number[] = []) => {
  const f = Math.round(t * FPS);
  for (const ts of swaps) { const k = f - Math.round((ts - LEAD) * FPS) + 1; if (k >= 0 && k < 4) return LID[k]; }
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13)); // next blink 0.5-2.3 s later
  }
  return 0;
};
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

type Who = { i: number; o: Outfit; okey: string };
/** one character drawing in the 600 x 1000 design space, sized by distance, lit from the scene's sun */
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place & { tierKey: string } => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return {
    key, x, y, z, scale, mirror, tierKey: `${w}`,
    draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)),
    size: [w, h, k],
  };
};

/** ground shadow under a standing / sitting card (review rounds 2-4), multiply, blue-violet: a TIGHT contact pool right under
 *  the feet (~.5 on screen at the core) so nobody floats, plus by day (cards cast no real shadow) a lighter soft tail
 *  stretched AWAY from the sun, length ~1.6 m / tan(sun elevation), capped. Golden: world.ts casts real card shadows. */
const CONTACT: Record<"day" | "golden", [number, number, number]> = { day: [0.2, 0.21, 0.33], golden: [0.24, 0.2, 0.33] };
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
/** dark molasses ring where a stuck body meets the pool surface */
const MOL_LINE = hexOf([0.25, 0.15, 0.08], 1);
const blob = (out: Stage, x: number, y: number, z: number, sc = 1, k = 1) => {
  const hl = Math.hypot(SUN.x, SUN.z) || 1, ox = -SUN.x / hl, oz = -SUN.z / hl, rot = Math.atan2(-ox, -oz);
  if (LNAME === "day") {
    const el = Math.asin(Math.min(0.99, Math.max(0.1, SUN.y)));
    const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h; // feet at v = .2 of the card
    const tc = hexOf(TAIL, k);
    out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c,
      w: 0.72 * sc, h, flat: true, rot });
  }
  const cc = hexOf(CONTACT[LNAME], k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc,
    w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};
/** molasses clinging where a stuck body meets the pool surface (multiply, dark brown) */
const molRing = (out: Stage, x: number, y: number, z: number) =>
  out.fx.push({ key: `blob|contact|${MOL_LINE}`, cw: 128, ch: 128, draw: (p) => fxContact(p, MOL_LINE), x, y: y + 0.02, z, w: 0.9, h: 0.7, flat: true });

// ---------------- crowd by shot ----------------
export type Stage = { places: Place[]; fx: FxPlace[] };

/** townsfolk running ahead of the wave (shots 1 + 7): they stay a fixed distance ahead of the front, running
 *  toward the camera (+z) at a fast cadence while the camera pulls back with the front */
const fleeCrowd = (cam: CamInfo, t: number, b: MolState, out: Stage, n: number, off: number) => {
  const EX: Expr[] = ["shock", "shock", "nervous", "shock", "nervous"];
  for (let k = 0; k < n; k++) {
    const i = off + k;
    const x = -6.5 + (k % 5) * 3.2 + (hh(i, 1) - 0.5) * 1.2 + 0.3 * Math.sin(t * 2 + i);
    // centre runners hug the wave, side runners further out: nobody drifts near the lens (a DOF blob)
    const z = b.waveZ + 4.5 + (Math.abs(x) / 6.5) * 2.8 + hh(i, 2) * 0.5;
    const kid = k % 6 === 4;
    const who: Who = kid ? { i, o: KID, okey: "kid" } : { i, o: FOLK[i % 6], okey: `f${i % 6}` };
    const view = viewOf(cam, x, z, 0, 1);
    const phase = q((t * 3.2 + k * 0.17) % 1, 120);
    const expr = EX[k % 5], blink = lidAt(t, i);
    const fo: FrontOpts = { phase, mode: "march", expr, blink, lift: 70 };
    const so: SideOpts = { phase, mode: "march", expr, blink, stomp: 1.4, stride: view.fs };
    out.places.push(person(cam, who, x, D0, z, view, fo, so, kid ? 0.72 : 1));
    blob(out, x, D0, z, kid ? 0.72 : 1);
  }
};

/** background townsfolk on the sidewalks (shot 2, towns): two thirds stroll, one third stands and chats */
const townsfolkAt = (cam: CamInfo, t: number, out: Stage) => {
  const t0 = 3.9; // shot 2 starts (frame 117)
  const EX: Expr[] = ["smile", "neutral", "smile_closed", "grin"];
  for (let i = 0; i < 20; i++) {
    const side = i % 2 ? 1 : -1;
    const kid = i % 7 === 3;
    const walk = i % 3 !== 0;
    const v = (0.4 + hh(i, 4) * 0.3) * (i % 4 < 2 ? 1 : -1);
    let z0 = -34 + i * 4.1 + hh(i, 2) * 2.5;
    if (side > 0 && z0 > -4 && z0 < 14) z0 += 18; // keep clear of the low S2c camera at (10, 5)
    const z = walk ? z0 + v * (t - t0) : z0;
    const x = side * (10.8 + hh(i, 3) * 1.4);
    const who: Who = kid ? { i: i + 200, o: KID, okey: "kid" } : { i: i + 200, o: FOLK[i % 6], okey: `f${i % 6}` };
    const phase = q((((t - t0) * Math.abs(v)) / 1.4 + i * 0.17) % 1, 120);
    const view = walk ? viewOf(cam, x, z, 0, Math.sign(v)) : { side: false, mirror: false, fs: 1 };
    const expr = EX[i % 4], blink = lidAt(t, i + 40);
    const fo: FrontOpts = { phase, mode: walk ? "stroll" : "stand", expr, blink, look: Math.round(Math.sin(t * 0.6 + i)) };
    const so: SideOpts = { phase, mode: "march", expr, blink, stomp: 0.55, stride: 0.875 * view.fs };
    out.places.push(person(cam, who, x, D0, z, view, fo, so, kid ? 0.72 : 1));
    blob(out, x, D0, z, kid ? 0.72 : 1);
  }
};

/** the bucket crew at the tank base + the painter on his crate (shot 4) */
const bucketCrew = (cam: CamInfo, t: number, out: Stage) => {
  // crew under the dripping seam; z = tank wall + ~0.5 m toward the street
  const wallZ = (x: number) => TANK[2] + Math.sqrt(Math.max(1, TANK_R * TANK_R - x * x));
  const CREW: { x: number; v: number; kid?: boolean; expr: Expr; lookUp?: boolean }[] = [
    { x: -6.5, v: 0, expr: "grin" },
    { x: -3, v: 1, expr: "smile", lookUp: true },
    { x: 1.5, v: 2, expr: "laugh" },
    { x: 5, v: 3, expr: "smile" },
    { x: -1, v: 0, kid: true, expr: "grin" },
  ];
  CREW.forEach((c, i) => {
    const z = wallZ(c.x) + 0.5;
    const who: Who = c.kid ? { i: 40 + i, o: KID, okey: "kid" } : { i: 40 + i, o: WORK[c.v], okey: `w${c.v}` };
    const fo: FrontOpts = { mode: "stand", expr: c.expr, prop: "bucket", blink: lidAt(t, 40 + i), headTilt: c.lookUp ? -8 : 0 };
    out.places.push(person(cam, who, c.x, D0, z, { side: false, mirror: false }, fo, {}, c.kid ? 0.72 : 1));
    blob(out, c.x, D0, z, c.kid ? 0.72 : 1);
    // a drip falls into each bucket on its own loop (seam ~D0+1.4, bucket rim ~D0+0.95)
    const bx = c.x - cam.right.x * 0.35, bz = z - cam.right.z * 0.35; // the bucket hangs at the camera-left hand
    const u = q(((t + i * 0.37) % 1.3) / 1.3, 30);
    out.fx.push({ key: `drip${u}`, cw: 200, ch: 500, draw: (p) => fxDrip(p, u), x: bx, y: D0 + 1.2, z: bz, w: 0.24, h: 0.6 });
  });
  // the painter on his crate, brushing the tank brown (side view, facing +x along the wall)
  out.fx.push({ key: "crate", cw: 200, ch: 200, draw: fxCrate, x: 4.2, y: D0 + 0.45, z: -26.0, w: 0.9, h: 0.9 });
  const so: SideOpts = { mode: "stand", expr: "smile", prop: "brush", blink: lidAt(t, 50) };
  out.places.push(person(cam, { i: 50, o: PAINTER, okey: "painter" }, 4.2, D0 + 0.8, -26.0, { side: true, mirror: false }, {}, so));
  blob(out, 4.2, D0 + 0.8, -26.0, 1, 0.7);
};

/** workers by the filling pipe, going nervous as the groan builds (shot 5) */
const fillCrew = (cam: CamInfo, t: number, out: Stage) => {
  const GROAN = 23.0; // the groan builds from ~f690 ("12 ribu ton sirup...")
  const nervous = t >= GROAN - LEAD;
  const CREW: { x: number; z: number; v: number; bucket?: boolean }[] = [
    { x: -4.5, z: -23, v: 1, bucket: true },
    { x: -6.5, z: -20.5, v: 2 },
    { x: -2.5, z: -21.5, v: 0 },
  ];
  CREW.forEach((c, i) => {
    const who: Who = { i: 60 + i, o: WORK[c.v], okey: `w${c.v}` };
    const fo: FrontOpts = { mode: "stand", expr: nervous ? "nervous" : i % 2 ? "smile" : "neutral",
      prop: c.bucket ? "bucket" : null, blink: lidAt(t, 60 + i, SWAPS[5]), headTilt: nervous ? -10 : 0 };
    out.places.push(person(cam, who, c.x, D0, c.z, { side: false, mirror: false }, fo, {}));
    blob(out, c.x, D0, c.z);
  });
};

/** townsfolk waist-deep in the pool (shot 9): sit mode with the seat at the pool surface, legs hidden below it */
const stuckCrowd = (cam: CamInfo, t: number, b: MolState, out: Stage) => {
  const surf = D0 + 0.8 * b.flood;
  const SPOTS: [number, number][] = [[-4.5, 50], [-1.5, 52.5], [2, 50.5], [4.5, 53], [-3, 55], [0.5, 55.5], [6, 48.5]];
  const EX: Expr[] = ["dazed", "pained", "dazed", "pained", "shock", "dazed", "pained"];
  SPOTS.forEach(([x, z], i) => {
    const who: Who = { i: 70 + i, o: FOLK[i % 6], okey: `f${i % 6}` };
    const fo: FrontOpts = { mode: "sit", expr: EX[i], blink: lidAt(t, 70 + i, SWAPS[9]),
      tilt: i % 3 === 0 ? q(2 * Math.sin(t * 1.8 + i), 30) : 0 }; // a faint struggle wobble
    out.places.push(person(cam, who, x, surf, z, { side: false, mirror: false }, fo, {}));
    molRing(out, x, surf, z);
    if (EX[i] === "dazed" && i % 2 === 0) { // circling stars over the dazed ones
      const u = q((t * 0.9 + hh(i, 5)) % 1, 30);
      out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x, y: surf + 1.55, z, w: 0.75, h: 0.375 });
    }
  });
};

/** the stuck boot (shot 10): one man heaving at his trapped shoe, molasses stretching beneath it */
const bootPull = (cam: CamInfo, t: number, b: MolState, out: Stage) => {
  const surf = D0 + 0.8 * b.flood;
  // the pull: a 1.5 s heave, hold, and sink-back
  const ph = ((t - 40.94) % 1.5) / 1.5;
  const pull = ph < 0.4 ? smooth(ph / 0.4) : ph < 0.6 ? 1 : 1 - smooth((ph - 0.6) / 0.4);
  const pq = q(pull, 30);
  const fo: FrontOpts = { mode: "stand", expr: "pained", blink: lidAt(t, 80), tilt: q(3 * Math.sin(t * 2.4), 30) };
  out.places.push(person(cam, { i: 80, o: FOLK[1], okey: "f1" }, 0, D0, 51.5, { side: false, mirror: false }, fo, {}));
  // the stuck boot lifts a little with every pull, molasses stretching beneath it
  const lift = 0.18 * pull;
  out.fx.push({ key: "boot", cw: 300, ch: 240, draw: fxBoot, x: 0.18, y: surf - 0.18 + lift, z: 51.75, w: 0.55, h: 0.44, rot: -0.06 + 0.1 * pull });
  if (pull > 0.15) {
    const h = 0.06 + 1.25 * lift; // strand spans the pool surface to the lifted sole
    out.fx.push({ key: `stretch${pq}`, cw: 300, ch: 600, draw: (p) => fxStretch(p, pq), x: 0.14, y: surf + 0.4 * h, z: 51.7, w: 0.3, h });
    out.fx.push({ key: `stretch2${pq}`, cw: 300, ch: 600, draw: (p) => fxStretch(p, pq), x: 0.28, y: surf + 0.4 * h, z: 51.8, w: 0.18, h: h * 0.8 });
  }
  // two more stuck townsfolk behind
  const BACK: [number, number, Expr][] = [[-3.5, 49, "dazed"], [3, 48.5, "pained"]];
  BACK.forEach(([x, z, expr], i) => {
    const who: Who = { i: 81 + i, o: FOLK[(i + 3) % 6], okey: `f${(i + 3) % 6}` };
    out.places.push(person(cam, who, x, surf, z, { side: false, mirror: false }, { mode: "sit", expr, blink: lidAt(t, 81 + i) }, {}));
    molRing(out, x, surf, z);
  });
};

/** the honey spoon set (shot 11): one big spoon card + drips falling off the bowl lip, over and over */
const spoonSet = (cam: CamInfo, t: number, out: Stage) => {
  const u = q(((t - 45.42) * 0.35) % 1, 30); // the strand grows slowly: "pelan banget"
  out.fx.push({ key: `spoon${u}`, cw: 600, ch: 800, draw: (p) => fxSpoon(p, u),
    x: SPOON[0], y: D0 + 2.05, z: SPOON[2], w: 2.2, h: 2.93 });
  for (let k = 0; k < 2; k++) {
    const du = q((((t - 45.42) + k * 0.85) % 1.7) / 1.7, 30);
    out.fx.push({ key: `spdrip${k}${du}`, cw: 200, ch: 500, draw: (p) => fxDrip(p, du),
      x: SPOON[0] + (k ? 0.06 : -0.71), y: D0 + 0.87, z: SPOON[2] + 0.3, w: 0.28, h: 0.9 });
  }
};

/** the engineer signing the blueprint (shot 13): stern while he writes, a small smile at the end */
const engineer = (cam: CamInfo, t: number, out: Stage) => {
  // seated on a chair behind the desk; the mesh is raised so the writing hand (0.27 m above the card origin)
  // clears the 1.05 m desk top (the 0.75 m in the old comment was wrong: the desk slab is D0+0.95..1.05)
  const ph = (t * 0.8) % 1;
  const k = q(ph < 0.7 ? ph / 0.7 : 1 - (ph - 0.7) / 0.3, 30); // across the page, then back
  const smile = t >= 56.7 - LEAD;
  const fo: FrontOpts = { mode: "sit", expr: smile ? "smile_closed" : "stern", prop: ["pen", k], blink: lidAt(t, 90, SWAPS[13]) };
  out.places.push(person(cam, { i: 90, o: ENGINEER, okey: "eng" }, OFFICE[0], D0 + 0.85, OFFICE[2] + 0.5, { side: false, mirror: false }, fo, {}));
};

/** summer pedestrians decades later (shot 14): strollers, kids, and three sniffers who stop on "mencium" */
const summerCrowd = (cam: CamInfo, t: number, out: Stage) => {
  const t0 = 58.44, SNIFF = 61.2; // "mencium" f1836
  const sniffing = t >= SNIFF - LEAD;
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1;
    const v = (0.4 + hh(i, 4) * 0.3) * (i % 4 < 2 ? 1 : -1);
    const z0 = 4 + Math.floor(i / 2) * 4.5 + hh(i, 2) * 1.5;
    const z = z0 + v * (t - t0), x = side * (6 + hh(i, 3) * 5);
    const who: Who = { i: 100 + i, o: SUMMER[i % 6], okey: `su${i % 6}` };
    const phase = q((((t - t0) * Math.abs(v)) / 1.4 + i * 0.17) % 1, 120);
    const view = viewOf(cam, x, z, 0, Math.sign(v));
    const expr: Expr = (["smile", "smile_closed", "neutral", "grin"] as Expr[])[i % 4];
    const blink = lidAt(t, 100 + i);
    const fo: FrontOpts = { phase, mode: "stroll", expr, blink };
    const so: SideOpts = { phase, mode: "march", expr, blink, stomp: 0.55, stride: 0.875 * view.fs };
    out.places.push(person(cam, who, x, D0, z, view, fo, so));
    blob(out, x, D0, z);
  }
  // the sniffers: they stop, tip their heads back, and smell molasses on the summer air
  const SNIFFERS: [number, number, number][] = [[-2, 14, 0], [3, 10, 2], [-5, 20, 4]];
  SNIFFERS.forEach(([x, z, v], i) => {
    const who: Who = { i: 110 + i, o: SUMMER[v], okey: `su${v}` };
    const fo: FrontOpts = { mode: "stand", expr: sniffing ? "smile_closed" : "neutral",
      blink: lidAt(t, 110 + i, SWAPS[14]), headTilt: sniffing ? -12 : 0, look: sniffing ? 0 : Math.round(Math.sin(t * 0.7 + i)) };
    out.places.push(person(cam, who, x, D0, z, { side: false, mirror: false }, fo, {}));
    blob(out, x, D0, z);
    if (sniffing) {
      const u = q((t * 0.7 + i * 0.31) % 1, 30);
      out.fx.push({ key: `scent${u}`, cw: 300, ch: 300, draw: (p) => fxScent(p, u), x, y: D0 + 2.35, z, w: 0.6, h: 0.6 });
    }
  });
  // kids: one with an ice cream
  const KIDS: [number, number, boolean][] = [[1.5, 16, true], [-4, 8, false], [5, 18, false]];
  KIDS.forEach(([x, z, ice], i) => {
    const who: Who = { i: 120 + i, o: KID, okey: "kid" };
    const lick = ice && (t * 0.7 + i) % 1 < 0.45;
    const fo: FrontOpts = { mode: "stand", expr: lick ? "lick" : "smile", prop: ice ? "icecream" : null, blink: lidAt(t, 120 + i) };
    out.places.push(person(cam, who, x, D0, z, { side: false, mirror: false }, fo, {}, 0.72));
    blob(out, x, D0, z, 0.72);
  });
};

/** everything with a face in shot `id` at time t */
export const stage = (id: number, t: number, b: MolState, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const s = SHOTS[id - 1];
  LNAME = s.light;
  findSun(cam, SUN);
  if (s.towns) townsfolkAt(cam, t, out);
  switch (s.crowd) {
    case "flee": fleeCrowd(cam, t, b, out, id === 1 ? 12 : 10, id === 1 ? 0 : 20); break;
    case "workers": if (id === 4) bucketCrew(cam, t, out); else fillCrew(cam, t, out); break;
    case "stuck": if (id === 9) stuckCrowd(cam, t, b, out); else bootPull(cam, t, b, out); break;
    case "summer": summerCrowd(cam, t, out); break;
    default: break;
  }
  if (id === 11) spoonSet(cam, t, out);
  if (id === 13) engineer(cam, t, out);
  return out;
};

// ---------------- one-off effects ----------------
/** the tank bursting open: a yellow-brown flash, then rivets flying out like machine-gun fire.
 *  `at` = the burst centre (tank front, mid-height, e.g. [0, D0 + 7, -33]); world.ts calls this in shot 6. */
export const snapFx = (tau: number, at: V3, out: Stage) => {
  const u = (tau - BURST) / 0.5;
  if (u >= 0 && u < 1)
    out.fx.push({ key: `bigburst${q(u, 30)}`, cw: 500, ch: 500, draw: (p) => fxBurst(p, q(u, 30), "#f7c65a", 12), x: at[0], y: at[1], z: at[2], w: 10, h: 10 });
  const r = (tau - BURST) / 1.8;
  if (r >= 0 && r < 1) {
    const rq = q(r, 30);
    for (let k = 0; k < 6; k++) {
      const a = (-60 + k * 30) * (Math.PI / 180), d = 2 + 30 * r; // fan biased toward the camera (+z), faster than the wave (15.6 m/s) so the rivets stay ahead of the front
      out.fx.push({ key: `rivet${k}${rq}`, cw: 300, ch: 300, draw: (p) => fxRivet(p, rq),
        x: at[0] + Math.sin(a) * d, y: at[1] + 2 + 7 * r - 10 * r * r, z: at[2] + 2 + Math.cos(a) * d, w: 2.2, h: 2.2, rot: r * (k % 2 ? 1.5 : -1.5) });
    }
  }
};
/** molasses splashes where the wave front hits: each spot fires when the front (56 km/h) reaches it.
 *  world.ts calls this in shots 1 and 7; the card base sits on the street (D0). */
export const splashFx = (tau: number, out: Stage) => {
  const front = TANK[2] + TANK_R; // -26.5
  const trig = (z: number) => BURST + (z - front) / 15.6;
  const SPOTS: [number, number, number][] = [[-6, 0, 1], [7, 12, 0.9], [8.5, 30, 1.3], [-5, 45, 1], [4, 60, 0.9]];
  for (const [x, z, s] of SPOTS) {
    const u = (tau - trig(z)) / 1.2;
    if (u < 0 || u >= 1) continue;
    const h = 6 * s;
    out.fx.push({ key: `msplash${q(u, 30)}`, cw: 800, ch: 800, draw: (p) => fxMolasses(p, q(u, 30)), x, y: D0 - 0.39 * h, z, w: h, h });
  }
};
export const creakFx = (t: number, pts: V3[], out: Stage, size = 0.8) =>
  pts.forEach(([x, y, z], i) => {
    const u = q((t * 1.3 + i * 0.37) % 1, 30);
    out.fx.push({ key: `creak${u}`, cw: 300, ch: 300, draw: (p) => fxCreak(p, u), x, y, z, w: size, h: size, rot: i * 0.6 - 0.6 });
  });
export { FPS };
