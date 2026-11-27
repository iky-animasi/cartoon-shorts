// Cast staging v2 for "Di Dunia Ini Kamu Nggak Bisa Bohong": characters PERFORM the narration —
// real walk cycles (distance-matched phase), talking mouths on their quoted lines, gestures
// (point/shrug/cover-mouth/scratch/hips/cross/chin/cup/reach/up/phone) timed to words.json,
// listeners react (turn, nod, shake, recoil). Flat sprites from the shared molasses toon kit;
// positions in metres, y = D0 = 6 is the ground.
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
  p.poly([[142, 66], [172, 66], [172, 88], [142, 88]], "#7bc47f", 3);
  p.poly([[136, 98], [172, 98], [172, 120], [136, 120]], "#7bc47f", 3);
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

// ---------------- acting helpers ----------------
/** gesture envelope: 0 before a, ramps in over fi frames, holds, ramps out over the last fo frames */
const env = (f: number, a: number, b: number, fi = 6, fo = 8) =>
  f < a || f > b ? 0 : Math.min(smooth((f - a) / fi), 1 - smooth((f - b + fo) / fo));
const gk = (f: number, a: number, b: number, fi = 6, fo = 8) => q(env(f, a, b, fi, fo), 10);
/** talking mouth openness while speaking frames a..b (syllable-ish steps every 3 frames) */
const talk = (f: number, a: number, b: number, seed: number) =>
  f < a || f > b ? 0 : q(0.25 + 0.75 * hh(seed * 131 + Math.floor(f / 3), 7), 4);
/** nodding headTilt (degrees) between frames a..b */
const nod = (f: number, a: number, b: number, amp = 5) =>
  f < a || f > b ? 0 : q(Math.sin((f - a) * 0.4) * amp * env(f, a, b, 4, 4), 2);
/** head-shake headTilt (degrees) between frames a..b; freq ~0.8 = agitated, ~0.35 = slow disapproval */
const shake = (f: number, a: number, b: number, amp = 7, freq = 0.8) =>
  f < a || f > b ? 0 : q(Math.sin((f - a) * freq) * amp * env(f, a, b, 3, 3), 2);
/** walk-cycle phase from distance travelled (1 cycle = 1.6 m at stride 1: 2 steps x 0.8 m) */
const wph = (x: number, x0: number) => q((((x - x0) / 1.6) % 1 + 1) % 1, 120);

// ---------------- staging ----------------
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const f = Math.round(t * FPS);
  const blink = (i: number) => lidAt(t, i);
  // idle secondary motion (filler only — actions below carry the beats)
  const idleHead = (i: number, amp = 1.4) => q(Math.sin(t * 1.35 + i * 2.1) * amp, 2);
  const idleBob = (i: number) => Math.sin(t * 1.7 + i * 1.3) * 0.008;
  const idleLook = (i: number) => q(Math.sin(t * 0.55 + i * 1.9) * 0.6, 4);
  /** slow phase for idle arm sway on standing/seated characters */
  const idlePhase = (i: number) => q(((t * 0.32 + i * 0.37) % 1 + 1) % 1, 60);
  const SW = (i: number) => ({ phase: idlePhase(i), sway: 0.4 });

  if (id === 1) {
    // hero walks the street at a natural pace; shakes his head on "bohong" (f49), smiles on "mulutmu" (f118)
    const x = JALAN[0] + heroX1(f), z = JALAN[2];
    const view = viewOf(cam, x, z, 1, 0);
    const phase = wph(heroX1(f), -4.2);
    const expr: Expr = f >= 118 ? "smile" : "neutral";
    out.places.push(person(cam, hero, x, D0, z, view,
      { phase, mode: "march", expr, blink: blink(1), headTilt: shake(f, 49, 78, 6, 0.7) + idleHead(1, 0.8), look: f >= 28 && f < 60 ? 0.8 : idleLook(1) },
      { phase, mode: "march", expr, blink: blink(1), stomp: 1.0, stride: view.fs }));
    blob(out, cam, x, D0, z);
  } else if (id === 2) {
    // friend checks himself in the mirror, asks with a shrug, gets the honest answer, storms off
    const recoil = env(f, 295, 352, 4, 20) * 0.12;
    const tx = KAMAR[0] + temanX2(f) + recoil, tz = KAMAR[2] + 0.25;
    if (f < 352) {
      const texpr: Expr = f < 295 ? "smile" : f < 327 ? "shock" : "stern";
      const asking = f >= 223 && f <= 248;
      out.places.push(person(cam, teman, tx, D0 + idleBob(3), tz, { side: false, mirror: false },
        { mode: "stand", ...SW(3), expr: texpr, blink: blink(3), facing: -1,
          headTilt: idleHead(3) + shake(f, 327, 352, 5, 0.5) + (asking ? 5 : 0),
          look: f < 223 ? 0.7 : -0.8, // mirror first, then turns to the hero
          talk: asking ? talk(f, 223, 248, 3) : undefined,
          armR: f < 215 ? { kind: "scratch", k: gk(f, 189, 215, 8, 8) } : f >= 295 && f < 327 ? { kind: "cover", k: gk(f, 295, 327, 4, 6) } : f >= 327 ? { kind: "cross", k: gk(f, 327, 352, 6, 4) } : asking ? { kind: "shrug", k: gk(f, 223, 248, 5, 5) } : { kind: "hips", k: gk(f, 248, 295, 8, 6) },
          armL: f >= 327 ? { kind: "cross", k: gk(f, 327, 352, 6, 4) } : asking ? { kind: "shrug", k: gk(f, 223, 248, 5, 5) } : f >= 248 && f < 295 ? { kind: "hips", k: gk(f, 248, 295, 8, 6) } : undefined,
        }, {}));
    } else {
      const view = viewOf(cam, tx, tz, 1, 0);
      const phase = wph(temanX2(f), 0.8);
      out.places.push(person(cam, teman, tx, D0, tz, view,
        { phase, mode: "march", expr: "stern", blink: blink(3), lift: 78 },
        { phase, mode: "march", expr: "stern", blink: blink(3), stomp: 1.15, stride: view.fs }));
    }
    blob(out, cam, tx, D0, tz);
    const hx = KAMAR[0] - 0.6, hz = KAMAR[2] + 0.25;
    const answering = f >= 295 && f <= 337;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", ...SW(1), expr: f >= 352 ? "nervous" : answering ? "grin" : "smile", blink: blink(1), facing: 1,
        headTilt: idleHead(1) + nod(f, 240, 262, 4),
        look: f >= 352 ? 1 : 0.9, // watches the friend, then watches him leave
        talk: answering ? talk(f, 295, 337, 1) : undefined,
        armL: answering ? { kind: "point", k: gk(f, 295, 337, 5, 6) } : f >= 352 ? { kind: "shrug", k: gk(f, 355, 389, 8, 4) } : undefined,
        armR: f >= 260 && f < 295 ? { kind: "chin", k: gk(f, 260, 295, 8, 6) } : f >= 352 ? { kind: "shrug", k: gk(f, 355, 389, 8, 4) } : undefined,
      }, {}));
    blob(out, cam, hx, D0, hz);
  } else if (id === 3) {
    // boss asks about the report (points at the papers); hero shrugs the truth; boss stunned
    const hx = KANTOR[0] - 0.55, hz = KANTOR[2] + 0.25;
    const answering = f >= 512 && f <= 549;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", ...SW(1), expr: answering ? "smile" : f >= 549 ? "nervous" : "smile", blink: blink(1), facing: 1,
        headTilt: idleHead(1) + nod(f, 440, 462, 4) + (f >= 549 ? 4 : 0),
        look: f >= 549 ? -0.8 : 0.9,
        talk: answering ? talk(f, 512, 549, 1) : undefined,
        armL: answering ? { kind: "shrug", k: gk(f, 512, 549, 5, 6) } : undefined,
        armR: answering ? { kind: "shrug", k: gk(f, 512, 549, 5, 6) }
          : f >= 480 && f < 512 ? { kind: "scratch", k: gk(f, 480, 512, 8, 6) }
          : f >= 549 ? { kind: "scratch", k: gk(f, 552, 573, 6, 4) } : undefined,
      }, {}));
    blob(out, cam, hx, D0, hz);
    const bx = KANTOR[0] + 0.75, bz = KANTOR[2] + 1.15;
    const asking = f >= 424 && f <= 453;
    out.places.push(person(cam, bos, bx, D0 + idleBob(5), bz, { side: false, mirror: false },
      { mode: "stand", ...SW(5), expr: f >= 549 ? "shock" : "stern", blink: blink(5), facing: -1,
        tilt: (asking ? 3 : 0) + (f >= 549 ? -3 : 0),
        headTilt: idleHead(5, 1.0) + (f >= 549 ? 7 : 0),
        look: -0.9,
        talk: asking ? talk(f, 424, 453, 5) : undefined,
        armL: asking ? { kind: "point", k: gk(f, 424, 453, 5, 6) } : f < 424 ? { kind: "cross", k: gk(f, 389, 424, 8, 6) } : undefined,
        armR: f >= 549 ? { kind: "cover", k: gk(f, 549, 573, 5, 4) } : f < 424 ? { kind: "cross", k: gk(f, 389, 424, 8, 6) } : undefined,
      }, {}));
    blob(out, cam, bx, D0, bz);
  } else if (id === 4) {
    // bus stop: hero checks the clock, types "OTW", the latecomer hurries in and catches his breath
    const hx = HALTE[0] + 0.2, hz = HALTE[2];
    const onPhone = f >= 700 && f < 775;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", ...SW(1), expr: "smile", blink: blink(1),
        headTilt: idleHead(1) + nod(f, 762, 782, 4),
        look: f >= 640 && f < 700 ? 1 : f >= 760 ? -0.9 : idleLook(1), // clock (right), then the latecomer (left)
        armR: onPhone ? { kind: "reach", k: gk(f, 700, 775, 6, 6) * 0.75 } : undefined,
        armL: f >= 640 && f < 700 ? { kind: "chin", k: gk(f, 640, 700, 8, 8) } : undefined,
      }, {}));
    blob(out, cam, hx, D0, hz);
    if (onPhone) {
      const dots = 1 + (Math.floor(t * 1.5) % 3);
      out.fx.push({ key: `phonechat${dots}`, cw: 300, ch: 280, draw: (p) => fxPhoneChat(p, dots),
        x: hx + 0.42, y: D0 + 1.12, z: hz - 0.05, w: 0.36, h: 0.34, rot: -0.08 });
    }
    const f0x = HALTE[0] + 1.7, f0z = HALTE[2] + 0.8;
    out.places.push(person(cam, folk(0), f0x, D0 + idleBob(30), f0z, { side: false, mirror: false },
      { mode: "stand", ...SW(30), expr: f >= 760 ? "smile" : "neutral", blink: blink(30), headTilt: idleHead(30),
        look: f >= 760 ? -1 : idleLook(30),
        armR: f >= 600 && f < 640 ? { kind: "phone", k: gk(f, 600, 640, 8, 8) } : undefined,
      }, {}));
    blob(out, cam, f0x, D0, f0z);
    const f2x = HALTE[0] - 1.45, f2z = HALTE[2] + 0.9;
    out.places.push(person(cam, folk(2), f2x, D0 + 0.5 + idleBob(32), f2z, { side: false, mirror: false },
      { mode: "sit", ...SW(32), expr: "smile", blink: blink(32), headTilt: idleHead(32, 1.0) + nod(f, 640, 665, 3),
        look: f >= 705 ? 1 : idleLook(32), // watches the latecomer run past
        talk: f >= 655 && f <= 685 ? talk(f, 655, 685, 32) : undefined,
      }, {}));
    // latecomer hurries in f700-760 along z -0.2 (S4c camera watches from across the street, z- side),
    // then catches his breath and checks the clock
    const lx = HALTE[0] + lateX4(f), lz = HALTE[2] - 0.2;
    if (f < 760) {
      const view = viewOf(cam, lx, lz, 1, 0);
      const phase = wph(lateX4(f), -4.6);
      out.places.push(person(cam, folk(4), lx, D0, lz, view,
        { phase, mode: "march", expr: "nervous", blink: blink(34), lift: 84 },
        { phase, mode: "march", expr: "nervous", blink: blink(34), stomp: 1.25, stride: view.fs }));
    } else {
      out.places.push(person(cam, folk(4), lx, D0 + idleBob(34), lz, { side: false, mirror: false },
        { mode: "stand", ...SW(34), expr: "relief", blink: blink(34),
          tilt: 10 * env(f, 760, 778, 4, 10), // bent over, hands on knees
          headTilt: -8 + idleHead(34, 0.8), look: 1, // up at the clock
          armL: { kind: "hips", k: gk(f, 760, 785, 4, 6) },
          armR: f >= 772 ? { kind: "scratch", k: gk(f, 772, 785, 5, 4) } : { kind: "hips", k: gk(f, 760, 772, 4, 4) }, // wipes his brow
        }, {}));
    }
    blob(out, cam, lx, D0, lz);
    const u = q((t * 0.08) % 1, 48);
    out.fx.push({ key: `clock${u}`, cw: 300, ch: 300, draw: (p) => fxClock(p, u),
      x: HALTE[0] + 1.4, y: D0 + 2.55, z: HALTE[2] + 0.2, w: 0.95, h: 0.95 });
  } else if (id === 5) {
    // cafe, everyone on time: hero sips coffee, holds up a hand on "5 menit lagi", teman laughs
    const hx = KAFE[0] - 0.55, hz = KAFE[2] + 1.0;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", ...SW(1), expr: f >= 910 ? "grin" : "smile", blink: blink(1), facing: 1,
        headTilt: idleHead(1, 1.0) + (f >= 800 && f < 830 ? -5 : 0) + nod(f, 855, 875, 3),
        look: 0.9,
        talk: f >= 878 && f <= 900 ? talk(f, 878, 900, 1) : undefined,
        armR: f >= 800 && f < 830 ? { kind: "cup", k: gk(f, 800, 830, 8, 8) }
          : f >= 878 && f < 905 ? { kind: "up", k: gk(f, 878, 905, 5, 6) } : undefined,
      }, {}));
    const tx = KAFE[0] + 0.75, tz = KAFE[2] + 1.6;
    out.places.push(person(cam, teman, tx, D0 + 0.5 + idleBob(3), tz, { side: false, mirror: false },
      { mode: "sit", ...SW(3), expr: f >= 905 ? "laugh" : f >= 878 ? "grin" : "smile", blink: blink(3), facing: -1,
        headTilt: idleHead(3, 1.0) + (f >= 905 ? -4 : 0) + nod(f, 880, 900, 3),
        look: -0.9,
        talk: f >= 810 && f <= 840 ? talk(f, 810, 840, 3) : undefined,
        armR: f >= 878 && f < 905 ? { kind: "point", k: gk(f, 878, 905, 5, 6) } : undefined,
      }, {}));
    const b1x = KAFE[0] - 2.3, b1z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(1), b1x, D0 + 0.5 + idleBob(31), b1z, { side: false, mirror: false },
      { mode: "sit", ...SW(31), expr: "neutral", blink: blink(31), headTilt: idleHead(31, 1.0), look: idleLook(31),
        armR: f >= 850 && f < 880 ? { kind: "cup", k: gk(f, 850, 880, 8, 8) } : undefined,
      }, {}));
    const b3x = KAFE[0] + 2.3, b3z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(3), b3x, D0 + 0.5 + idleBob(33), b3z, { side: false, mirror: false },
      { mode: "sit", ...SW(33), expr: f >= 915 ? "laugh" : "smile", blink: blink(33), headTilt: idleHead(33, 1.0) + (f >= 915 ? -4 : 0), look: idleLook(33) }, {}));
  } else if (id === 6 || id === 7 || id === 8 || id === 9) {
    const frozen = id === 7; // shot 7: the whole cafe freezes mid-gesture (camera still drifts)
    // hero: seated until the f1005 cut, then standing; seated again after the f1650 cut in shot 9
    const heroSit = (id === 6 && f < 1005) || (id === 9 && f >= 1650);
    const hx = KAFE[0] + (heroSit ? -0.55 : -0.35), hz = KAFE[2] + (heroSit ? 1.0 : 0.6);
    const hexpr: Expr = frozen ? "shock" : id === 8 ? "nervous" : id === 9 ? (f >= 1650 ? "dazed" : "nervous") : f >= 1097 ? "nervous" : "smile";
    const heroTalk = id === 8 && f >= 1450 && f <= 1508 ? talk(f, 1450, 1508, 1)
      : id === 8 && f >= 1364 && f <= 1426 ? talk(f, 1364, 1426, 1) * 0.7 : undefined;
    out.places.push(person(cam, hero, hx, D0 + (heroSit ? 0.5 : 0) + (frozen ? 0 : idleBob(1)), hz, { side: false, mirror: false },
      { mode: heroSit ? "sit" : "stand", phase: idlePhase(1), sway: frozen ? 0 : 0.4, expr: hexpr, blink: frozen ? 0 : blink(1), facing: 1,
        tilt: id === 9 && f >= 1580 && f < 1650 ? 6 * env(f, 1580, 1650, 10, 6) : 0,
        headTilt: frozen ? 0
          : id === 8 ? shake(f, 1334, 1440, 6, 0.8) + idleHead(1, 1.6)
          : id === 9 ? (f >= 1650 ? 12 + idleHead(1, 0.6) : 8 * env(f, 1580, 1650, 10, 6) + idleHead(1, 0.7))
          : idleHead(1, 1.2) + nod(f, 1010, 1032, 4),
        look: frozen ? q(Math.sin(t * 1.8) * 1, 2) // only his eyes still move
          : id === 9 && f < 1650 ? -1 : 0.9, // watches her leave (screen-left), else toward pacar
        talk: heroTalk,
        armL: id === 8 && f >= 1491 ? { kind: "shrug", k: gk(f, 1491, 1529, 6, 4) }
          : id === 9 && f >= 1540 && f < 1580 ? { kind: "reach", k: gk(f, 1540, 1580, 6, 8) } : undefined,
        armR: frozen ? { kind: "up", k: 0.45 }
          : id === 6 && f >= 990 && f < 1005 ? { kind: "up", k: gk(f, 990, 1005, 6, 4) } // waves back, seated
          : id === 8 && f >= 1380 && f < 1445 ? { kind: "cover", k: gk(f, 1380, 1445, 5, 5) } // tries to hold his mouth shut
          : id === 8 && f >= 1491 ? { kind: "shrug", k: gk(f, 1491, 1529, 6, 4) }
          : id === 9 && f >= 1600 && f < 1650 ? { kind: "scratch", k: gk(f, 1600, 1650, 8, 6) }
          : id === 9 && f >= 1650 ? { kind: "chin", k: gk(f, 1650, 1727, 8, 4) } : undefined, // head in hand
      }, {}));
    blob(out, cam, hx, D0, hz);
    if (id === 8) { // sweat flying off the hero's head while his mouth talks on its own
      const u = q((t * 0.9) % 1, 30);
      out.fx.push({ key: `sweat${u}`, cw: 300, ch: 280, draw: (p) => fxSweat(p, u), x: hx, y: D0 + 1.95, z: hz, w: 0.9, h: 0.85 });
    }
    // pacar: walks in (shot 6), asks the question, freezes (7), arms crossed (8), walks away (9)
    const px = KAFE[0] + (id === 9 ? pacarX9(f) : id === 6 ? pacarX6(f) : 0.9), pz = KAFE[2] + 0.2; // z 0.2: her path clears the cafe tables (z 0.75..1.85)
    const pexpr: Expr = frozen ? "nervous" : id === 9 ? "stern" : id === 8 ? (f >= 1450 ? "stern" : "neutral") : f >= 1097 ? "nervous" : "smile";
    let pacarPlaced = true;
    if ((id === 6 && f < 1005) || (id === 9 && f >= 1529 && f < 1620)) {
      const dir = id === 9 ? 1 : -1;
      const view = viewOf(cam, px, pz, dir, 0);
      const phase = wph(id === 9 ? pacarX9(f) : pacarX6(f), id === 9 ? 0.9 : 3.6);
      out.places.push(person(cam, pacar, px, D0, pz, view,
        { phase, mode: "march", expr: pexpr, blink: blink(8), lift: id === 9 ? 74 : 60 },
        { phase, mode: "march", expr: pexpr, blink: blink(8), stomp: id === 9 ? 1.1 : 1.0, stride: view.fs,
          armAng: id === 6 && f >= 990 ? 140 * env(f, 990, 1005, 6, 3) : undefined }, // waves hello as she arrives
        ));
    } else if (id !== 9 || f < 1529) {
      const asking = id === 6 && f >= 1097 && f <= 1145;
      out.places.push(person(cam, pacar, px, D0 + (frozen ? 0 : idleBob(8)), pz, { side: false, mirror: false },
        { mode: "stand", phase: idlePhase(8), sway: frozen ? 0 : 0.4, expr: pexpr, blink: frozen ? 0 : blink(8), facing: -1,
          headTilt: frozen ? 0 : idleHead(8, 1.0) + (asking ? 6 : 0) + shake(f, 1470, 1500, 4, 0.35),
          look: frozen ? 0 : -0.9,
          talk: asking ? talk(f, 1097, 1145, 8) : undefined,
          armL: frozen || asking ? { kind: "hips", k: frozen ? 1 : gk(f, 1097, 1171, 6, 6) }
            : id === 8 && f >= 1460 ? { kind: "cross", k: gk(f, 1460, 1529, 6, 4) }
            : id === 6 && f >= 1020 ? { kind: "hips", k: gk(f, 1020, 1097, 8, 6) } : undefined,
          armR: frozen || asking ? { kind: "hips", k: frozen ? 1 : gk(f, 1097, 1171, 6, 6) }
            : id === 8 && f >= 1460 ? { kind: "cross", k: gk(f, 1460, 1529, 6, 4) }
            : id === 6 && f >= 1020 ? { kind: "hips", k: gk(f, 1020, 1097, 8, 6) } : undefined,
        }, {}));
    } else pacarPlaced = false; // shot 9 after f1620: she has left the set
    if (pacarPlaced) blob(out, cam, px, D0, pz);
    // bystanders: seated patrons + one at the counter (all freeze mid-gesture in shot 7)
    const b1x = KAFE[0] - 2.3, b1z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(1), b1x, D0 + 0.5 + (frozen ? 0 : idleBob(31)), b1z, { side: false, mirror: false },
      { mode: "sit", phase: idlePhase(31), sway: frozen ? 0 : 0.4, expr: frozen ? "shock" : "neutral", blink: frozen ? 0 : blink(31),
        headTilt: frozen ? -5 : idleHead(31, 1.0), look: frozen ? 0 : f >= 1097 ? 1 : idleLook(31),
        armR: frozen ? { kind: "cup", k: 1 } : id === 6 && f >= 1040 && f < 1070 ? { kind: "cup", k: gk(f, 1040, 1070, 8, 8) } : undefined,
      }, {}));
    const b3x = KAFE[0] + 2.3, b3z = KAFE[2] + 1.6;
    out.places.push(person(cam, folk(3), b3x, D0 + 0.5 + (frozen ? 0 : idleBob(33)), b3z, { side: false, mirror: false },
      { mode: "sit", phase: idlePhase(33), sway: frozen ? 0 : 0.4, expr: frozen ? "laugh" : "smile", blink: frozen ? 0 : blink(33),
        headTilt: frozen ? -4 : idleHead(33, 1.0) + shake(f, 1660, 1690, 4, 0.4),
        look: frozen ? 0 : f >= 1097 ? -1 : idleLook(33),
      }, {}));
    const b5x = KAFE[0] + 2.4, b5z = KAFE[2] + 2.9;
    out.places.push(person(cam, folk(5), b5x, D0 + (frozen ? 0 : idleBob(35)), b5z, { side: false, mirror: false },
      { mode: "stand", phase: idlePhase(35), sway: frozen ? 0 : 0.4, expr: frozen ? "shock" : "neutral", blink: frozen ? 0 : blink(35),
        headTilt: frozen ? 0 : idleHead(35, 1.0), look: frozen ? 0 : f >= 1097 ? -1 : idleLook(35),
        armR: frozen ? { kind: "reach", k: 0.8 } : id === 6 && f >= 1020 && f < 1060 ? { kind: "reach", k: gk(f, 1020, 1060, 8, 8) * 0.8 } : undefined,
      }, {}));
  } else if (id === 10) {
    // tired stroll home at dusk; stops, looks up, shakes his head at the punchline
    const x = SORE[0] + heroX10(f), z = SORE[2];
    const walking = f < 1830;
    const view = viewOf(cam, x, z, 1, 0);
    const phase = wph(heroX10(f), -2.6);
    out.places.push(person(cam, hero, x, D0 + (walking ? 0 : idleBob(1)), z, view,
      { phase, sway: 0.4, mode: walking ? "stroll" : "stand", expr: walking ? "dazed" : "neutral", blink: blink(1),
        headTilt: walking ? 7 : -3 + shake(f, 1840, 1862, 4, 0.5) + idleHead(1, 0.6),
        look: walking ? 0 : idleLook(1) },
      { phase, mode: walking ? "march" : "stand", expr: walking ? "dazed" : "neutral", blink: blink(1), stomp: 0.75, stride: view.fs * 0.85 }));
    blob(out, cam, x, D0, z);
  }
  return out;
};
