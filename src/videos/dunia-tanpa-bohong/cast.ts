// Cast staging for "Di Dunia Ini Kamu Nggak Bisa Bohong": hero ("kamu") plus friend, boss,
// pacar and cafe bystanders, flat sprites from the shared molasses toon kit. Reactions land on
// their words (words.json); positions in metres, y = D0 = 6 is the ground.
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxStars, fxPuff, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, townsfolk, INK,
} from "../molasses/toon";
import {
  FPS, D0, JALAN, KAMAR, KANTOR, HALTE, KAFE, SORE,
  heroX1, temanX2, lateX4, pacarX6, pacarX9, heroX10, smooth, clamp01,
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
const PACAR: Outfit = { jacket: "#e08a3c", pants: "#5a4a6a", boots: "#5a3b2a", hat: "hair", hair: "#3a2a20", skin: SKINS[1] };
const hero: Who = { i: 1, o: HERO, okey: "hero" };
const teman: Who = { i: 3, o: TEMAN, okey: "teman" };
const bos: Who = { i: 5, o: BOS, okey: "bos" };
const pacar: Who = { i: 8, o: PACAR, okey: "pacar" };
const folk = (v: number): Who => ({ i: 30 + v, o: townsfolk(v), okey: `folk${v}` });

// ---------------- custom fx drawings (design space = canvas px) ----------------
/** big station clock with hands (u = minute-hand turns, quantized by caller) */
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
/** phone with a chat thread (the "OTW" gag: sent bubbles, no reply needed) */
const fxPhoneChat = (p: Pen, dots: number) => {
  p.poly([[112, 30], [188, 30], [188, 230], [112, 230]], "#2e3138", 6);
  p.poly([[122, 48], [178, 48], [178, 212], [122, 212]], "#e8f2fb", 0);
  // own sent bubbles (right, green)
  p.poly([[142, 66], [172, 66], [172, 88], [142, 88]], "#7bc47f", 3);
  p.poly([[136, 98], [172, 98], [172, 120], [136, 120]], "#7bc47f", 3);
  // typing dots that never become a message
  for (let i = 0; i < 3; i++) p.dot(134 + i * 12, 150, 3.5, i < dots ? "#9aa7b4" : "#d5dde5");
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

  if (id === 1) {
    const x = JALAN[0] + heroX1(f), z = JALAN[2];
    const view = viewOf(cam, x, z, 1, 0);
    const phase = q(((x + 3.4) / 1.4) % 1, 120);
    const expr: Expr = f >= 118 ? "smile" : "neutral";
    out.places.push(person(cam, hero, x, D0, z, view,
      { phase, mode: "march", expr, blink: blink(1) },
      { phase, mode: "march", expr, blink: blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, x, D0, z);
  } else if (id === 2) {
    // friend checks the mirror, asks; hero answers honestly; friend storms off f352+
    const tx = KAMAR[0] + temanX2(f), tz = KAMAR[2] + 0.25;
    if (f < 352) {
      const texpr: Expr = f < 295 ? "smile" : f < 327 ? "shock" : "stern";
      out.places.push(person(cam, teman, tx, D0 + idleBob(3), tz, { side: false, mirror: false },
        { mode: "stand", expr: texpr, blink: blink(3), facing: -1, headTilt: idleHead(3), look: idleLook(3) }, {}));
    } else {
      const view = viewOf(cam, tx, tz, 1, 0);
      const phase = q(((tx - KAMAR[0] - 0.8) / 1.4) % 1, 120);
      out.places.push(person(cam, teman, tx, D0, tz, view,
        { phase, mode: "march", expr: "stern", blink: blink(3) },
        { phase, mode: "march", expr: "stern", blink: blink(3), stomp: 0.9, stride: view.fs }));
    }
    blob(out, cam, tx, D0, tz);
    const hx = KAMAR[0] - 0.6, hz = KAMAR[2] + 0.25;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 352 ? "nervous" : f >= 295 ? "grin" : "smile", blink: blink(1), facing: 1, headTilt: idleHead(1), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
  } else if (id === 3) {
    const hx = KANTOR[0] - 0.55, hz = KANTOR[2] + 0.25;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: "smile", blink: blink(1), facing: 1, headTilt: (f >= 512 ? 4 : 0) + idleHead(1), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
    const bx = KANTOR[0] + 0.75, bz = KANTOR[2] + 1.15;
    out.places.push(person(cam, bos, bx, D0 + idleBob(5), bz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 542 ? "shock" : "stern", blink: blink(5), facing: -1, headTilt: (f >= 542 ? 7 : 0) + idleHead(5, 1.0), look: idleLook(5) }, {}));
    blob(out, cam, bx, D0, bz);
  } else if (id === 4) {
    const hx = HALTE[0] + 0.2, hz = HALTE[2];
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: "smile", blink: blink(1), headTilt: idleHead(1), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
    if (f >= 700 && f < 775) { // "OTW" chat gag on the hero's phone
      const dots = 1 + (Math.floor(t * 1.5) % 3);
      out.fx.push({ key: `phonechat${dots}`, cw: 300, ch: 280, draw: (p) => fxPhoneChat(p, dots),
        x: hx + 0.42, y: D0 + 1.12, z: hz - 0.05, w: 0.36, h: 0.34, rot: -0.08 });
    }
    const f0x = HALTE[0] + 2.2, f0z = HALTE[2] + 0.8;
    out.places.push(person(cam, folk(0), f0x, D0 + idleBob(30), f0z, { side: false, mirror: false },
      { mode: "stand", expr: "neutral", blink: blink(30), headTilt: idleHead(30), look: idleLook(30) }, {}));
    blob(out, cam, f0x, D0, f0z);
    const f2x = HALTE[0] - 2.3, f2z = HALTE[2] + 0.9;
    out.places.push(person(cam, folk(2), f2x, D0 + 0.5 + idleBob(32), f2z, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: blink(32), headTilt: idleHead(32, 1.0), look: idleLook(32) }, {}));
    // latecomer hurries in f700-760, then checks the clock
    const lx = HALTE[0] + lateX4(f), lz = HALTE[2] - 0.2;
    if (f < 760) {
      const view = viewOf(cam, lx, lz, 1, 0);
      const phase = q(((lx - HALTE[0] + 2.9) / 1.4) % 1, 120);
      out.places.push(person(cam, folk(4), lx, D0, lz, view,
        { phase, mode: "march", expr: "nervous", blink: blink(34) },
        { phase, mode: "march", expr: "nervous", blink: blink(34), stomp: 0.9, stride: view.fs }));
    } else {
      out.places.push(person(cam, folk(4), lx, D0 + idleBob(34), lz, { side: false, mirror: false },
        { mode: "stand", expr: "relief", blink: blink(34), headTilt: -8 + idleHead(34, 0.8), look: idleLook(34) }, {}));
    }
    blob(out, cam, lx, D0, lz);
    const u = q((t * 0.08) % 1, 48);
    out.fx.push({ key: `clock${u}`, cw: 300, ch: 300, draw: (p) => fxClock(p, u),
      x: HALTE[0] + 1.4, y: D0 + 2.55, z: HALTE[2] + 0.2, w: 0.95, h: 0.95 });
  } else if (id === 5) {
    // cafe, everyone on time: hero + friend at a table, patrons at side tables
    const hx = KAFE[0] - 0.55, hz = KAFE[2] + 1.0;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: blink(1), facing: 1, headTilt: idleHead(1, 1.0), look: idleLook(1), wave: f >= 878 ? q(0.35 + Math.sin(t * 2.4) * 0.15, 6) : undefined }, {}));
    const tx = KAFE[0] + 0.75, tz = KAFE[2] + 1.6;
    out.places.push(person(cam, teman, tx, D0 + 0.5 + idleBob(3), tz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 878 ? "grin" : "smile", blink: blink(3), facing: -1, headTilt: idleHead(3, 1.0), look: idleLook(3) }, {}));
    const b1x = KAFE[0] - 2.3, b1z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(1), b1x, D0 + 0.5 + idleBob(31), b1z, { side: false, mirror: false },
      { mode: "sit", expr: "neutral", blink: blink(31), headTilt: idleHead(31, 1.0), look: idleLook(31) }, {}));
    const b3x = KAFE[0] + 2.3, b3z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(3), b3x, D0 + 0.5 + idleBob(33), b3z, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: blink(33), headTilt: idleHead(33, 1.0), look: idleLook(33) }, {}));
  } else if (id === 6 || id === 7 || id === 8 || id === 9) {
    const frozen = id === 7; // shot 7: the whole cafe freezes (camera still drifts via camAt)
    const hx = KAFE[0] - 0.35, hz = KAFE[2] + 0.3;
    const hexpr: Expr = frozen ? "shock" : id === 8 ? "nervous" : id === 9 ? "dazed" : f >= 1097 ? "nervous" : "smile";
    out.places.push(person(cam, hero, hx, D0 + (frozen ? 0 : idleBob(1)), hz, { side: false, mirror: false },
      { mode: "stand", expr: hexpr, blink: frozen ? 0 : blink(1), facing: 1,
        headTilt: frozen ? 0 : id === 9 ? 12 + idleHead(1, 0.7) : idleHead(1, id === 8 ? 2.0 : 1.2),
        look: frozen ? 0 : idleLook(1),
        wave: id === 8 && f >= 1450 ? q(0.3 + Math.sin(t * 2.6) * 0.15, 6) : undefined }, {}));
    blob(out, cam, hx, D0, hz);
    if (id === 8) { // sweat flying off the hero's head while his mouth talks on its own
      const u = q((t * 0.9) % 1, 30);
      out.fx.push({ key: `sweat${u}`, cw: 300, ch: 280, draw: (p) => fxSweat(p, u), x: hx, y: D0 + 2.05, z: hz, w: 1.1, h: 1.0 });
    }
    // pacar: walks in (shot 6), stands frozen/talking (7-8), walks away (shot 9)
    const px = KAFE[0] + (id === 9 ? pacarX9(f) : id === 6 ? pacarX6(f) : 1.15), pz = KAFE[2] + 0.3;
    const pexpr: Expr = frozen ? "nervous" : id === 9 ? "stern" : id === 8 ? (f >= 1450 ? "stern" : "neutral") : f >= 1097 ? "nervous" : "smile";
    if ((id === 6 && f < 1005) || (id === 9 && f >= 1529)) {
      const dir = id === 9 ? 1 : -1;
      const view = viewOf(cam, px, pz, dir, 0);
      const phase = q(((px - KAFE[0] + 4.6) / 1.4) % 1, 120);
      out.places.push(person(cam, pacar, px, D0, pz, view,
        { phase, mode: "march", expr: pexpr, blink: blink(8) },
        { phase, mode: "march", expr: pexpr, blink: blink(8), stomp: 0.9, stride: view.fs }));
    } else {
      out.places.push(person(cam, pacar, px, D0 + (frozen ? 0 : idleBob(8)), pz, { side: false, mirror: false },
        { mode: "stand", expr: pexpr, blink: frozen ? 0 : blink(8), facing: -1,
          headTilt: frozen ? 0 : idleHead(8, 1.0), look: frozen ? 0 : idleLook(8) }, {}));
    }
    blob(out, cam, px, D0, pz);
    // bystanders: seated patrons + one at the counter (all freeze in shot 7)
    const b1x = KAFE[0] - 2.3, b1z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(1), b1x, D0 + 0.5 + (frozen ? 0 : idleBob(31)), b1z, { side: false, mirror: false },
      { mode: "sit", expr: frozen ? "shock" : "neutral", blink: frozen ? 0 : blink(31), headTilt: frozen ? 0 : idleHead(31, 1.0), look: frozen ? 0 : idleLook(31) }, {}));
    const b3x = KAFE[0] + 2.3, b3z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(3), b3x, D0 + 0.5 + (frozen ? 0 : idleBob(33)), b3z, { side: false, mirror: false },
      { mode: "sit", expr: frozen ? "nervous" : "smile", blink: frozen ? 0 : blink(33), headTilt: frozen ? 0 : idleHead(33, 1.0), look: frozen ? 0 : idleLook(33) }, {}));
    const b5x = KAFE[0] + 2.4, b5z = KAFE[2] + 2.9;
    out.places.push(person(cam, folk(5), b5x, D0 + (frozen ? 0 : idleBob(35)), b5z, { side: false, mirror: false },
      { mode: "stand", expr: frozen ? "shock" : "neutral", blink: frozen ? 0 : blink(35), headTilt: frozen ? 0 : idleHead(35, 1.0), look: frozen ? 0 : idleLook(35) }, {}));
  } else if (id === 10) {
    const x = SORE[0] + heroX10(f), z = SORE[2];
    const walking = f < 1830;
    const view = viewOf(cam, x, z, 1, 0);
    const phase = q(((x - SORE[0] + 1.4) / 1.4) % 1, 120);
    out.places.push(person(cam, hero, x, D0 + (walking ? 0 : idleBob(1)), z, view,
      { phase, mode: walking ? "march" : "stand", expr: walking ? "dazed" : "neutral", blink: blink(1), headTilt: walking ? 6 : 4 + idleHead(1, 0.8), look: walking ? 0 : idleLook(1) },
      { phase, mode: walking ? "march" : "stand", expr: walking ? "dazed" : "neutral", blink: blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, x, D0, z);
  }
  return out;
};
