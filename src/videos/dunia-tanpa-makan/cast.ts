// Cast staging for "Di Dunia Ini Kamu Nggak Perlu Makan": hero ("kamu") plus office coworkers
// and warung townsfolk, flat sprites from the shared molasses toon kit. Food thoughts reuse
// episode 7's in-world thought bubbles. Reactions land on their words (words.json);
// positions in metres, y = D0 = 6 is the ground.
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxStars, fxPuff, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, townsfolk, INK,
} from "../molasses/toon";
import {
  FPS, D0, DAPUR, KANTOR, JALAN, KAMAR, MALAM, LUAR, DALAM,
  heroX1, heroX3, heroX5, heroX6, popIn, smooth, clamp01,
} from "./story";

export { Pool, Actor, Fx };
export type { Place, FxPlace, CamInfo, Stage };

const hh = (i: number, s = 0) => { const v = Math.sin(i * 127.1 + s * 311.7) * 43758.5453; return v - Math.floor(v); };
const q = (v: number, n = 120) => Math.round(v * n) / n;
const tmp = new THREE.Vector3();
const tier = (d: number): [number, number, number] =>
  d < 3.2 ? [1800, 3000, 3.0] : d < 6.5 ? [1080, 1800, 1.8] : d < 16 ? [480, 800, 0.8] : [240, 400, 0.4];
const seedOf = (i: number) => ((i * 5 + 3) % 7) + 1;
const fkey = (o: object) => JSON.stringify(o, (_k, v) => (typeof v === "number" ? q(v) : v));

const LID = [0.5, 1, 1, 0.5];
const lidAt = (t: number, i: number) => {
  const f = Math.round(t * FPS);
  let s = Math.round(-60 * hh(i, 9));
  for (let n = 0; s <= f && n < 400; n++) {
    const k = f - s;
    if (k >= 0 && k < 4) return LID[k];
    s += Math.round(15 + 54 * hh(i * 31 + n, 13));
  }
  return 0;
};

/** canvas angle the sun comes FROM on an upright card facing the camera (45-degree steps) */
const light2D = (cam: CamInfo, mirror: boolean) => {
  const sun = cam.sun ?? new THREE.Vector3(0.5, 0.75, -0.4).normalize();
  const sx = sun.dot(cam.right) * (mirror ? -1 : 1), sy = -sun.y;
  return Math.round(Math.atan2(sy, sx) / (Math.PI / 4)) * (Math.PI / 4);
};
const viewOf = (cam: CamInfo, x: number, z: number, dx: number, dz: number) => {
  const tx = cam.pos.x - x, tz = cam.pos.z - z, tl = Math.hypot(tx, tz) || 1;
  const c = (tx * dx + tz * dz) / tl;
  return { side: c < 0.57, mirror: dx * cam.right.x + dz * cam.right.z < 0, fs: Math.round(Math.sqrt(Math.max(0, 1 - c * c)) * 20) / 20 };
};

type Who = { i: number; o: Outfit; okey: string };
const person = (cam: CamInfo, who: Who, x: number, y: number, z: number, view: { side: boolean; mirror: boolean }, fo: FrontOpts, so: SideOpts, scale = 1): Place => {
  const d = cam.pos.distanceTo(tmp.set(x, y + 1.2, z)) / scale;
  const [w, h, k] = tier(d);
  const mirror = view.side && view.mirror, light = light2D(cam, mirror), seed = seedOf(who.i);
  const f2: FrontOpts = { ...fo, light, seed }, s2: SideOpts = { ...so, light, seed };
  const key = view.side ? `S|${who.okey}|${fkey(s2)}` : `F|${who.okey}|${fkey(f2)}`;
  return { key, x, y, z, scale, mirror, draw: (p) => (view.side ? bodySide(p, who.o, s2) : bodyFront(p, who.o, f2)), size: [w, h, k] };
};

const CONTACT: [number, number, number] = [0.2, 0.21, 0.33];
const TAIL: [number, number, number] = [0.42, 0.44, 0.62];
const toSrgb = (v: number) => { const c = clamp01(v); return c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055; };
const hexOf = (c: [number, number, number], k: number) => "#" + c.map((v) => Math.round(255 * toSrgb(1 - (1 - v) * k)).toString(16).padStart(2, "0")).join("");
const blob = (out: Stage, cam: CamInfo, x: number, y: number, z: number, sc = 1, k = 1) => {
  const sun = cam.sun ?? new THREE.Vector3(0.5, 0.75, -0.4).normalize();
  const hl = Math.hypot(sun.x, sun.z) || 1, ox = -sun.x / hl, oz = -sun.z / hl, rot = Math.atan2(-ox, -oz);
  const el = Math.asin(Math.min(0.99, Math.max(0.1, sun.y)));
  const len = Math.min(2.4, Math.max(0.5, 1.6 / Math.tan(el))) * sc, h = len + 0.55 * sc, c = 0.3 * h;
  const tc = hexOf(TAIL, k);
  out.fx.push({ key: `blob|shadow|${tc}`, cw: 128, ch: 256, draw: (p) => fxShadow(p, tc), x: x + ox * c, y: y + 0.018, z: z + oz * c, w: 0.72 * sc, h, flat: true, rot });
  const cc = hexOf(CONTACT, k);
  out.fx.push({ key: `blob|contact|${cc}`, cw: 128, ch: 128, draw: (p) => fxContact(p, cc), x: x + ox * 0.03 * sc, y: y + 0.022, z: z + oz * 0.03 * sc, w: 0.52 * sc, h: 0.4 * sc, flat: true, rot });
};

// ---------------- outfits ----------------
const HERO: Outfit = { jacket: "#2f8f6a", pants: "#3b3f52", boots: "#f4f1ea", hat: "hair", hair: "#2a201a", skin: SKINS[0] };
const TEMAN: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "cap", cap: "#e2453c", skin: SKINS[1] };
const BOS: Outfit = { jacket: "#2e3138", pants: "#23262b", boots: "#1d1b22", hat: "hair", hair: "#3a2e24", bowtie: "#8c3b4a", glasses: true, skin: SKINS[2] };
const IBU: Outfit = { jacket: "#c25a7a", pants: "#5a4a6a", boots: "#5a3b2a", hat: "hair", hair: "#3a2a20", skin: SKINS[1] };
const hero: Who = { i: 1, o: HERO, okey: "hero" };
const teman: Who = { i: 3, o: TEMAN, okey: "teman" };
const bos: Who = { i: 5, o: BOS, okey: "bos" };
const ibu: Who = { i: 20, o: IBU, okey: "ibu" };
const folk = (v: number): Who => ({ i: 30 + v, o: townsfolk(v), okey: `folk${v}` });

// ---------------- custom fx drawings (design space = canvas px) ----------------
/** wall clock with fast-moving hands (u = minute-hand turns, quantized by caller) — from episode 4 */
const fxClock = (p: Pen, u: number) => {
  const cx = 150, cy = 150, R = 105;
  p.ell(cx, cy, R, R, "#f4f6f8", 7);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    p.stroke([[cx + Math.cos(a) * (R - 22), cy + Math.sin(a) * (R - 22)], [cx + Math.cos(a) * (R - 12), cy + Math.sin(a) * (R - 12)]], i % 3 === 0 ? 7 : 4, INK);
  }
  const ma = u * Math.PI * 2 - Math.PI / 2, ha = (u / 12) * Math.PI * 2 - Math.PI / 2;
  p.stroke([[cx, cy], [cx + Math.cos(ha) * 52, cy + Math.sin(ha) * 52]], 10, INK);
  p.stroke([[cx, cy], [cx + Math.cos(ma) * 78, cy + Math.sin(ma) * 78]], 7, "#e2453c");
  p.dot(cx, cy, 8);
};
/** food thought bubble (in-world element above a head, from episode 7): wavy cloud + plate icon */
const fxThoughtFood = (p: Pen) => {
  const cx = 150, cy = 105;
  const pts: [number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 78 + Math.sin(a * 3 + 0.6) * 10;
    pts.push([cx + Math.cos(a) * r * 1.12, cy + Math.sin(a) * r * 0.78]);
  }
  p.poly(pts, "#ffffff", 6);
  p.ell(cx - 38, cy + 82, 11, 9, "#ffffff", 4);
  p.ell(cx - 58, cy + 108, 7, 6, "#ffffff", 4);
  // plate of rice with a chili (pedas/gurih/manis daydreams)
  p.ell(cx, cy + 16, 46, 16, "#eef1f4", 5);
  p.ell(cx - 4, cy + 2, 24, 13, "#ffffff", 4);
  p.ell(cx + 24, cy + 8, 10, 7, "#c96a3f", 3);
  p.stroke([[cx + 30, cy - 18], [cx + 40, cy - 26]], 5, "#e2453c");
};
/** a steaming bowl of noodles (u = steam phase, quantized by caller) */
const fxBowl = (p: Pen, u: number) => {
  // steam curls
  for (let i = 0; i < 3; i++) {
    const x = 115 + i * 35, y = 60 + ((u + i * 0.33) % 1) * -18;
    p.stroke([[x, y + 30], [x - 8, y + 12], [x + 6, y - 4]], 5, "#cfd8dc");
  }
  // bowl
  p.poly([[55, 130], [245, 130], [215, 200], [85, 200]], "#2f6fb2", 6);
  p.ell(150, 130, 95, 20, "#f4f6f8", 5);
  // noodles + egg + chili
  p.ell(150, 126, 78, 15, "#f2d38a", 3);
  p.ell(122, 122, 20, 10, "#ffffff", 3);
  p.dot(122, 122, 6, "#e8a33c");
  p.ell(178, 124, 12, 7, "#e2453c", 3);
  // chopsticks
  p.stroke([[205, 118], [252, 66]], 6, "#6e4b33");
  p.stroke([[192, 122], [236, 62]], 6, "#6e4b33");
};
/** sweat drops flying off a panicking head (u = 0..1 progress, quantized by caller) */
const fxSweat = (p: Pen, u: number) => {
  for (let i = 0; i < 5; i++) {
    const a = -0.6 + i * 0.55, d = 30 + u * 95;
    const x = 150 + Math.sin(a) * d, y = 120 - Math.cos(a) * d * 0.55 + u * 55;
    const s = 20 - u * 5;
    p.poly([[x, y - s * 1.5], [x + s * 0.8, y + s * 0.4], [x + s * 0.35, y + s], [x - s * 0.35, y + s], [x - s * 0.8, y + s * 0.4]], "#7bc4e8", 3);
  }
};
// ---------------- staging ----------------
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const f = Math.round(t * FPS);
  const blink = (i: number) => lidAt(t, i);
  // motion upgrade: idle secondary motion for standing/sitting characters (quantized so
  // canvas redraws stay cheap; the y bob is free — it only moves the placed card)
  const idleHead = (i: number, amp = 1.4) => q(Math.sin(t * 1.35 + i * 2.1) * amp, 2);
  const idleBob = (i: number) => Math.sin(t * 1.7 + i * 1.3) * 0.008;
  const idleLook = (i: number) => q(Math.sin(t * 0.55 + i * 1.9) * 0.6, 4);
  const stars = (x: number, y: number, z: number, i: number) => {
    const u = q((t * 0.9 + hh(i, 5)) % 1, 30);
    out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x, y, z, w: 0.75, h: 0.375 });
  };
  const foodThought = (x: number, headTop: number, z: number, f0: number, big = 1) => {
    const s = popIn(f, f0);
    if (s <= 0) return;
    out.fx.push({ key: "thought-food", cw: 300, ch: 280, draw: (p) => fxThoughtFood(p),
      x: x + 0.12, y: headTop + 0.35 + Math.sin(t * 1.4 + x * 2.1) * 0.03, z, w: 0.62 * big * s, h: 0.58 * big * s, rot: Math.sin(t * 0.9 + x) * 0.03 });
  };

  if (id === 1) {
    // morning kitchen: hero walks past the empty breakfast table and out the door (f166+)
    const hx = DAPUR[0] + heroX1(f), hz = DAPUR[2] + 1.0;
    const leaving = f >= 166;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: leaving ? "march" : "stand", phase: leaving ? t * 1.7 : 0,
        expr: f >= 199 ? "grin" : "smile", blink: blink(1), headTilt: idleHead(1, 0.8), look: leaving ? -0.6 : idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
  } else if (id === 2) {
    // office: everyone works straight through lunch; the wall clock spins
    const hx = KANTOR[0] - 1.35, hz = KANTOR[2] + 0.85;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: "neutral", blink: blink(1), headTilt: 8 + idleHead(1, 0.6), look: 0.2 }, {}));
    const a1x = KANTOR[0] + 1.15, a1z = KANTOR[2] + 1.5;
    out.places.push(person(cam, folk(0), a1x, D0 + 0.5 + idleBob(30), a1z, { side: false, mirror: false },
      { mode: "sit", expr: "neutral", blink: blink(30), headTilt: 8 + idleHead(30, 0.6), look: idleLook(30) }, {}, 0.95));
    const a2x = KANTOR[0] + 0.2, a2z = KANTOR[2] + 2.2;
    out.places.push(person(cam, folk(2), a2x, D0 + idleBob(32), a2z, { side: false, mirror: false },
      { mode: "stand", expr: "neutral", blink: blink(32), headTilt: idleHead(32, 0.8), look: idleLook(32),
        wave: q(0.3 + Math.sin(t * 2.0) * 0.08, 6) }, {}, 0.95));
    blob(out, cam, a2x, D0, a2z);
    const cu = q((t * 0.55) % 1, 48);
    out.fx.push({ key: `clock${cu}`, cw: 300, ch: 300, draw: (p) => fxClock(p, cu),
      x: KANTOR[0] + 0.4, y: D0 + 3.1, z: KANTOR[2] + 3.85, w: 0.85, h: 0.85 });
  } else if (id === 3) {
    // empty street: hero walks past shuttered stalls
    const hx = JALAN[0] + heroX3(f), hz = JALAN[2] + 0.4;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "march", phase: t * 1.5, expr: f >= 482 ? "nervous" : "neutral", blink: blink(1),
        headTilt: idleHead(1, 0.8), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
  } else if (id === 4) {
    // bedroom at night: hero daydreams about flavors (food bubbles pop at pedas/gurih/manis)
    const hx = KAMAR[0] - 0.8, hz = KAMAR[2] + 1.1;
    out.places.push(person(cam, hero, hx, D0 + 0.72 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 638 ? "dazed" : "neutral", blink: blink(1),
        headTilt: 10 + idleHead(1, 0.6), look: idleLook(1) }, {}));
    foodThought(hx - 0.5, D0 + 2.5, hz, 752, 0.95);
    foodThought(hx + 0.55, D0 + 2.65, hz, 785, 1.05);
    foodThought(hx - 0.1, D0 + 2.85, hz, 818, 1.15);
  } else if (id === 5) {
    // night street: hero searches for one open warung
    const hx = MALAM[0] + heroX5(f), hz = MALAM[2] + 0.4;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "march", phase: t * 1.6, expr: f >= 986 ? "nervous" : "neutral", blink: blink(1),
        headTilt: idleHead(1, 0.9), look: q(Math.sin(t * 0.9) * 0.8, 4) }, {}));
    blob(out, cam, hx, D0, hz);
  } else if (id === 6) {
    // in front of the one lit warung: hero stops, grins, steps toward the door
    const hx = LUAR[0] + heroX6(f), hz = LUAR[2] + 1.6;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: f >= 1153 ? "march" : "stand", phase: f >= 1153 ? t * 1.4 : 0,
        expr: f >= 1065 ? "grin" : "neutral", blink: blink(1), headTilt: idleHead(1, 0.8), look: 0.3 }, {}));
    blob(out, cam, hx, D0, hz);
    // silhouettes eating inside, seen through the warung window
    const s1x = LUAR[0] - 0.9, s1z = LUAR[2] - 1.6;
    out.places.push(person(cam, folk(1), s1x, D0 + 0.5 + idleBob(31), s1z, { side: false, mirror: false },
      { mode: "sit", expr: "laugh", blink: blink(31), headTilt: idleHead(31, 1.4), look: idleLook(31) }, {}, 0.9));
    const s2x = LUAR[0] + 0.7, s2z = LUAR[2] - 1.5;
    out.places.push(person(cam, folk(3), s2x, D0 + 0.5 + idleBob(33), s2z, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: blink(33), headTilt: idleHead(33, 1.4), look: idleLook(33) }, {}, 0.9));
  } else if (id === 7 || id === 8 || id === 9) {
    // inside the warung: people eat slowly, chat and laugh; hero joins them
    const hx = DALAM[0] - 0.6, hz = DALAM[2] + 1.1;
    if (id === 7 && f < 1298) {
      const ex = DALAM[0] - 2.6 + smooth((f - 1235) / 63) * 2.0;
      out.places.push(person(cam, hero, ex, D0 + idleBob(1), hz, { side: false, mirror: false },
        { mode: "march", phase: t * 1.5, expr: "smile", blink: blink(1), headTilt: idleHead(1, 0.8), look: 0.5 }, {}));
      blob(out, cam, ex, D0, hz);
    } else {
      out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
        { mode: "sit", expr: id === 9 ? "smile_closed" : "smile", blink: blink(1),
          headTilt: idleHead(1, 0.9), look: idleLook(1) }, {}));
      const bu = q((t * 0.6) % 1, 24);
      out.fx.push({ key: `bowl${bu}`, cw: 300, ch: 280, draw: (p) => fxBowl(p, bu),
        x: hx + 0.15, y: D0 + 0.95, z: hz - 0.35, w: 0.6, h: 0.56, rot: 0.02 });
    }
    const w1x = DALAM[0] + 1.05, w1z = DALAM[2] + 1.05;
    out.places.push(person(cam, folk(1), w1x, D0 + 0.5 + idleBob(31), w1z, { side: false, mirror: false },
      { mode: "sit", expr: "laugh", blink: blink(31), headTilt: idleHead(31, 1.5), look: idleLook(31),
        wave: q(0.3 + Math.sin(t * 1.6 + 1) * 0.08, 6) }, {}, 0.95));
    const w2x = DALAM[0] - 1.9, w2z = DALAM[2] + 1.9;
    out.places.push(person(cam, folk(3), w2x, D0 + 0.5 + idleBob(33), w2z, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: blink(33), headTilt: idleHead(33, 1.3), look: idleLook(33) }, {}, 0.95));
    const w3x = DALAM[0] + 2.0, w3z = DALAM[2] + 2.0;
    out.places.push(person(cam, folk(5), w3x, D0 + 0.5 + idleBob(35), w3z, { side: false, mirror: false },
      { mode: "sit", expr: "laugh", blink: blink(35), headTilt: idleHead(35, 1.5), look: idleLook(35) }, {}, 0.9));
  }
  return out;
};
