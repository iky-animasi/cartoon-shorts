// Cast staging for "Di Dunia Ini Kamu Bisa Baca Pikiran": hero ("kamu") plus friend, lecturer
// (boss outfit) and cafe/bus/exam townsfolk, flat sprites from the shared molasses toon kit.
// Thoughts are drawn as in-world bubbles above heads (fxThought). Reactions land on their
// words (words.json); positions in metres, y = D0 = 6 is the ground.
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxStars, fxPuff, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, townsfolk, INK,
} from "../molasses/toon";
import {
  FPS, D0, KAFE, PASAR, BUS, UJIAN, KORIDOR, HALAMAN,
  heroX8, heroX9, popIn, smooth, clamp01,
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
const hero: Who = { i: 1, o: HERO, okey: "hero" };
const teman: Who = { i: 3, o: TEMAN, okey: "teman" };
const dosen: Who = { i: 5, o: BOS, okey: "dosen" };
const folk = (v: number): Who => ({ i: 30 + v, o: townsfolk(v), okey: `folk${v}` });

// ---------------- custom fx drawings (design space = canvas px) ----------------
type ThoughtKind = "biasa" | "ngomel" | "bohong" | "soal" | "jawaban" | "makan";
/** thought bubble (in-world element above a head): wavy cloud + trailing dots + icon */
const fxThought = (p: Pen, kind: ThoughtKind) => {
  const cx = 150, cy = 105;
  const pts: [number, number][] = [];
  for (let i = 0; i < 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    const r = 78 + Math.sin(a * 3 + 0.6) * 10;
    pts.push([cx + Math.cos(a) * r * 1.12, cy + Math.sin(a) * r * 0.78]);
  }
  p.poly(pts, "#ffffff", 6);
  // trailing dots down toward the head
  p.ell(cx - 38, cy + 82, 11, 9, "#ffffff", 4);
  p.ell(cx - 58, cy + 108, 7, 6, "#ffffff", 4);
  if (kind === "biasa") {
    for (let i = 0; i < 3; i++) p.dot(cx - 26 + i * 26, cy, 7, "#9aa7b4");
  } else if (kind === "ngomel") {
    // lightning bolt + angry scribbles
    p.poly([[cx + 8, cy - 42], [cx - 20, cy + 6], [cx - 2, cy + 6], [cx - 10, cy + 44], [cx + 24, cy - 8], [cx + 4, cy - 8]], "#e8c85a", 5);
    p.stroke([[cx - 52, cy - 28], [cx - 34, cy - 16]], 6, "#e2453c");
    p.stroke([[cx + 40, cy - 30], [cx + 54, cy - 18]], 6, "#e2453c");
  } else if (kind === "bohong") {
    // price tag with a money line
    p.poly([[cx - 42, cy - 26], [cx + 30, cy - 26], [cx + 48, cy], [cx + 30, cy + 26], [cx - 42, cy + 26]], "#ffe9a8", 5);
    p.dot(cx - 28, cy, 6, "#ffffff");
    p.stroke([[cx - 12, cy - 10], [cx + 24, cy - 10]], 6, "#2f8f6a");
    p.stroke([[cx - 12, cy + 8], [cx + 14, cy + 8]], 6, "#2f8f6a");
  } else if (kind === "soal") {
    // big question mark
    p.arc(cx, cy - 8, 30, 30, -160, 130, 13, "#2e3138");
    p.stroke([[cx, cy + 18], [cx, cy + 36]], 13, "#2e3138");
    p.dot(cx, cy + 52, 8, "#2e3138");
  } else if (kind === "jawaban") {
    // star (got the answer)
    const star: [number, number][] = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2, r = i % 2 ? 17 : 40;
      star.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    p.poly(star, "#e8c85a", 5);
  } else if (kind === "makan") {
    // plate of rice (thinking about lunch)
    p.ell(cx, cy + 16, 46, 16, "#eef1f4", 5);
    p.ell(cx - 4, cy + 2, 24, 13, "#ffffff", 4);
    p.ell(cx + 24, cy + 8, 10, 7, "#c96a3f", 3);
  }
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

  // thought bubble above a head: pops in at f0 (popIn), then bobs gently
  const thought = (kind: ThoughtKind, x: number, headTop: number, z: number, f0: number, big = 1) => {
    const s = popIn(f, f0);
    if (s <= 0) return;
    out.fx.push({ key: `thought-${kind}`, cw: 300, ch: 280, draw: (p) => fxThought(p, kind),
      x: x + 0.12, y: headTop + 0.35 + Math.sin(t * 1.4 + x * 2.1) * 0.03, z, w: 0.62 * big * s, h: 0.58 * big * s, rot: Math.sin(t * 0.9 + x) * 0.03 });
  };
  const sweat = (x: number, y: number, z: number) => {
    const u = q((t * 0.5) % 1, 30);
    out.fx.push({ key: `sweat${u}`, cw: 300, ch: 280, draw: (p) => fxSweat(p, u), x, y, z, w: 0.8, h: 0.75 });
  };

  if (id === 1) {
    // cafe: hero seated; thoughts pop around him until he really hears them (f171)
    const hx = KAFE[0] + 0.1, hz = KAFE[2] + 1.1;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 171 ? "nervous" : f >= 98 ? "grin" : "smile", blink: blink(1),
        headTilt: idleHead(1, 0.9), look: idleLook(1) }, {}));
    const a1x = KAFE[0] - 0.95, a1z = KAFE[2] + 1.15;
    out.places.push(person(cam, folk(0), a1x, D0 + 0.5 + idleBob(30), a1z, { side: false, mirror: false },
      { mode: "sit", expr: "neutral", blink: blink(30), headTilt: idleHead(30, 0.9), look: 0.4 }, {}, 0.95));
    thought("biasa", a1x, D0 + 2.35, a1z, 60);
    const a2x = KAFE[0] + 1.2, a2z = KAFE[2] + 1.05;
    out.places.push(person(cam, folk(3), a2x, D0 + 0.5 + idleBob(33), a2z, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: blink(33), headTilt: idleHead(33, 0.9), look: -0.4 }, {}, 0.95));
    thought("makan", a2x, D0 + 2.35, a2z, 110);
  } else if (id === 2) {
    // cafe: friend smiles "nggak apa-apa" (f256) while his head grumbles (f325)
    const hx = KAFE[0] + 0.1, hz = KAFE[2] + 1.1;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 325 ? "shock" : "smile", blink: blink(1),
        headTilt: idleHead(1, 0.9), look: 0.5 }, {}));
    const tx = KAFE[0] + 1.2, tz = KAFE[2] + 1.05;
    out.places.push(person(cam, teman, tx, D0 + 0.5 + idleBob(3), tz, { side: false, mirror: false },
      { mode: "sit", expr: "smile_closed", blink: blink(3), headTilt: idleHead(3, 0.8), look: -0.5,
        wave: f >= 238 && f < 290 ? q(0.3 + Math.sin(t * 2.2) * 0.08, 6) : undefined }, {}));
    thought("ngomel", tx, D0 + 2.4, tz, 325, 1.1);
  } else if (id === 3) {
    // market: hero knows the seller is lying about the price (f446)
    const hx = PASAR[0] - 0.7, hz = PASAR[2] + 0.3;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 446 ? "grin" : "neutral", blink: blink(1),
        headTilt: idleHead(1, 0.9), look: 0.5,
        wave: f >= 446 && f < 520 ? q(0.35 + Math.sin(t * 2.4) * 0.1, 6) : undefined }, {}));
    blob(out, cam, hx, D0, hz);
    const sx = PASAR[0] + 0.9, sz = PASAR[2] - 1.3;
    out.places.push(person(cam, folk(4), sx, D0 + idleBob(34), sz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 509 ? "nervous" : "smile", blink: blink(34), headTilt: idleHead(34, 0.8), look: -0.5 }, {}, 0.95));
    blob(out, cam, sx, D0, sz);
    thought("bohong", sx, D0 + 2.4, sz, 446);
  } else if (id === 4) {
    // bus: thoughts pour in from every seat; hero's head fills up (f577+)
    const hx = BUS[0] - 0.3, hz = BUS[2] + 1.2;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 719 ? "dazed" : f >= 577 ? "nervous" : "neutral", blink: blink(1),
        headTilt: (f >= 577 ? 13 : 0) + idleHead(1, 0.7), look: idleLook(1) }, {}));
    if (f >= 719) sweat(hx, D0 + 2.35, hz);
    const b1x = BUS[0] + 0.9, b1z = BUS[2] + 1.3;
    out.places.push(person(cam, folk(0), b1x, D0 + 0.5 + idleBob(30), b1z, { side: false, mirror: false },
      { mode: "sit", expr: "neutral", blink: blink(30), headTilt: idleHead(30, 0.9), look: idleLook(30) }, {}, 0.95));
    thought("biasa", b1x, D0 + 2.35, b1z, 613);
    const b2x = BUS[0] - 1.3, b2z = BUS[2] + 1.25;
    out.places.push(person(cam, folk(2), b2x, D0 + 0.5 + idleBob(32), b2z, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: blink(32), headTilt: idleHead(32, 0.9), look: idleLook(32) }, {}, 0.95));
    thought("makan", b2x, D0 + 2.35, b2z, 638);
    const b3x = BUS[0] + 0.2, b3z = BUS[2] + 2.45;
    out.places.push(person(cam, folk(5), b3x, D0 + 0.5 + idleBob(35), b3z, { side: false, mirror: false },
      { mode: "sit", expr: "stern", blink: blink(35), headTilt: idleHead(35, 0.9), look: idleLook(35) }, {}, 0.9));
    thought("ngomel", b3x, D0 + 2.3, b3z, 662, 0.9);
  } else if (id === 5 || id === 6 || id === 7) {
    // exam room: hero front row; lecturer thinks up the hardest question (f885);
    // classmates' thoughts mix in (f1237 jawaban, f1277 makan siang)
    const hx = UJIAN[0] - 0.6, hz = UJIAN[2] + 1.15;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: id === 6 ? (f >= 1064 ? "shock" : "nervous") : id === 7 ? "dazed" : f >= 885 ? "nervous" : "neutral", blink: blink(1),
        headTilt: (id === 7 ? 10 : 0) + idleHead(1, 0.7), look: id === 7 ? q(Math.sin(t * 1.7) * 0.8, 4) : 0.5 }, {}));
    if (id === 6 && f >= 1064) sweat(hx, D0 + 2.35, hz);
    const dx = UJIAN[0] + 1.7, dz = UJIAN[2] + 2.6;
    out.places.push(person(cam, dosen, dx, D0 + idleBob(5), dz, { side: false, mirror: false },
      { mode: "stand", expr: "stern", blink: blink(5), headTilt: 8 + idleHead(5, 0.6), look: -0.4 }, {}));
    blob(out, cam, dx, D0, dz);
    thought("soal", dx, D0 + 2.2, dz, 885, id >= 6 ? 1.25 : 1);
    const c1x = UJIAN[0] + 0.8, c1z = UJIAN[2] + 1.9;
    out.places.push(person(cam, folk(1), c1x, D0 + 0.5 + idleBob(31), c1z, { side: false, mirror: false },
      { mode: "sit", expr: id === 7 && f >= 1237 ? "grin" : "neutral", blink: blink(31), headTilt: 9 + idleHead(31, 0.6), look: idleLook(31) }, {}, 0.95));
    if (id === 7) thought("jawaban", c1x, D0 + 2.3, c1z, 1237, 0.9);
    const c2x = UJIAN[0] - 1.4, c2z = UJIAN[2] + 2.1;
    out.places.push(person(cam, folk(6), c2x, D0 + 0.5 + idleBob(36), c2z, { side: false, mirror: false },
      { mode: "sit", expr: id === 7 && f >= 1277 ? "smile_closed" : "neutral", blink: blink(36), headTilt: 9 + idleHead(36, 0.6), look: idleLook(36) }, {}, 0.95));
    if (id === 7) thought("makan", c2x, D0 + 2.3, c2z, 1277, 0.9);
  } else if (id === 8) {
    // corridor: hero stumbles out with a spinning head
    const hx = KORIDOR[0] + heroX8(f), hz = KORIDOR[2] + 0.9;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "march", phase: t * 1.2, expr: "dazed", blink: blink(1),
        headTilt: 12 + q(Math.sin(t * 1.9) * 5, 2), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
    if (f >= 1345) sweat(hx, D0 + 1.9, hz);
    stars(hx + 0.15, D0 + 2.25, hz, 11);
  } else if (id === 9) {
    // yard: relieved slow walk; punchline lands at "terutama pas ujian" (f1603)
    const hx = HALAMAN[0] + heroX9(f), hz = HALAMAN[2];
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "march", phase: t * 1.1, expr: f >= 1603 ? "smile_closed" : "relief", blink: blink(1),
        headTilt: (f >= 1603 ? 0 : 6) + idleHead(1, 0.7), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
  }
  return out;
};
