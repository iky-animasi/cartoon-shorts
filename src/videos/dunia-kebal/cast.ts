// Cast staging for "Di Dunia Ini Kamu Kebal": one hero ("kamu") plus doctor and ibu, flat sprites
// from the shared molasses toon kit. Reactions land on their words (words.json); positions in
// metres, y = D0 = 6 is the ground. Crocodile + lion are flat fx cards in the same style.
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxStars, fxPuff, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, INK,
} from "../molasses/toon";
import {
  FPS, D0, STREET, DAPUR, PERIKSA, SUNGAI, TAMAN, SINGA, RUMAH,
  heroX1, fallX4, crocX, lionX, smooth, clamp01,
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
const DOCTOR: Outfit = { jacket: "#f4f6f8", pants: "#3b3f52", boots: "#1d1b22", hat: "hair", hair: "#4a3426", glasses: true, skin: SKINS[2] };
const IBU: Outfit = { jacket: "#c25a7a", pants: "#5a4a6a", boots: "#5a3b2a", hat: "hair", hair: "#3a2a20", skin: SKINS[1] };
const hero: Who = { i: 1, o: HERO, okey: "hero" };
const doctor: Who = { i: 10, o: DOCTOR, okey: "doctor" };
const ibu: Who = { i: 20, o: IBU, okey: "ibu" };

// ---------------- custom fx drawings (design space = canvas px) ----------------
/** kitchen knife: sharp (pointy, bright edge) or dull (rounded tip, grey edge) */
const fxKnife = (p: Pen, dull: boolean) => {
  const tip: [number, number] = dull ? [252, 128] : [268, 118];
  const blade: [number, number][] = dull
    ? [[96, 104], [210, 96], [246, 108], tip, [238, 146], [150, 152], [96, 148]]
    : [[96, 104], [220, 94], tip, [190, 150], [96, 148]];
  p.poly(blade, "#cfd6de", 5);
  p.stroke([[104, 140], [190, 140]], 5, dull ? "#8a929c" : "#ffffff"); // cutting edge
  p.poly([[40, 108], [96, 104], [96, 148], [40, 152]], "#6e4b33", 5); // handle
  p.dot(58, 130, 4, "#d8c9a8"); p.dot(80, 129, 4, "#d8c9a8");
};
/** syringe: straight needle or bent (kinked at the skin) */
const fxSyringe = (p: Pen, bent: boolean) => {
  // barrel diagonal, needle down-left
  p.poly([[150, 40], [196, 66], [118, 196], [72, 170]], "#bfe3ff", 5);
  p.poly([[150, 40], [196, 66], [186, 84], [140, 58]], "#e2453c", 4); // plunger cap
  p.stroke([[168, 46], [206, 22]], 9, INK); // plunger rod
  p.stroke([[88, 178], [70, 206]], 8, "#9aa0ab"); // hub
  if (bent) p.stroke([[70, 206], [44, 238], [64, 262]], 6, "#7d8088");
  else p.stroke([[70, 206], [38, 262]], 6, "#7d8088");
  for (let i = 0; i < 3; i++) p.stroke([[150 - i * 18, 84 + i * 30], [162 - i * 18, 78 + i * 30]], 4, INK); // measure ticks
};
/** crocodile side view (600x300 canvas), head at RIGHT (toward the hero): teeth=true has fangs, false = toothless gums */
const fxCroc = (p: Pen, teeth: boolean, chomp: number) => {
  const body = "#4e9b47", belly = "#a8d08d", dark = "#35702f";
  // tail (left)
  p.poly([[170, 150], [20, 120], [40, 168], [160, 178]], body, 5);
  // body
  p.ell(270, 160, 150, 58, body, 6);
  p.ell(270, 178, 140, 40, belly, 0);
  // back spikes
  for (let i = 0; i < 6; i++) {
    const x = 190 + i * 42;
    p.poly([[x, 112], [x + 16, 92], [x + 32, 112]], dark, 4);
  }
  // legs
  for (const lx of [180, 340]) p.poly([[lx, 196], [lx + 26, 196], [lx + 30, 238], [lx - 4, 238]], dark, 5);
  // head + snout (right), jaw opens by chomp 0..1
  const jy = chomp * 26;
  p.poly([[540, 128], [390, 108], [370, 150], [390, 178], [530, 178]], body, 6); // upper jaw
  p.poly([[534, 178], [386, 178], [394, 196 + jy], [516, 196 + jy]], belly, 5); // lower jaw
  // eye
  p.ell(404, 118, 13, 15, "#ffffff", 4);
  p.dot(408, 120, 6);
  p.ell(400, 104, 16, 9, dark, 3); // brow bump
  // nostril
  p.dot(520, 140, 5, dark);
  if (teeth) {
    for (let i = 0; i < 6; i++) {
      const x = 398 + i * 20;
      p.poly([[x, 176], [x + 9, 196], [x + 18, 176]], "#ffffff", 3);
      p.poly([[x + 6, 196 + jy], [x + 14, 182 + jy], [x + 22, 196 + jy]], "#ffffff", 3);
    }
  } else {
    p.stroke([[400, 184], [516, 184]], 6, "#e8a0a8"); // bare gums
  }
};
/** flying teeth burst (u = 0..1 progress) */
const fxTeethFly = (p: Pen, u: number) => {
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 1.6 - 0.4, d = 40 + u * 120;
    const x = 150 + Math.cos(a) * d, y = 150 + Math.sin(a) * d * 0.7 - u * 30;
    const s = 12 - u * 3;
    p.poly([[x - s, y], [x, y + s * 1.4], [x + s, y]], "#ffffff", 3);
  }
};
/** lion front view (400x360): mane + face; scared = ears down, sweat, wobbly mouth */
const fxLion = (p: Pen, scared: boolean) => {
  const mane = "#c97b2e", face = "#e8b26a";
  // body + tail under the mane (drawn first, mane overlaps the neck)
  p.ell(200, 316, 86, 44, "#e0a458", 5);
  p.stroke([[128, 300], [86, 268], [92, 232]], 10, "#e0a458");
  p.ell(92, 226, 14, 18, mane, 4); // tail tuft
  for (const lx of [152, 232]) p.poly([[lx, 332], [lx + 24, 332], [lx + 26, 356], [lx - 2, 356]], "#c98f45", 4);
  // mane: scalloped circle
  const pts: [number, number][] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2, r = 128 + (i % 2 ? 16 : 0);
    pts.push([200 + Math.cos(a) * r, 170 + Math.sin(a) * r]);
  }
  p.poly(pts, mane, 6);
  // ears
  for (const s of [-1, 1]) p.ell(200 + s * 92, 96 + (scared ? 16 : 0), 24, 20, mane, 5);
  // face
  p.ell(200, 178, 92, 84, face, 5);
  // muzzle
  p.ell(200, 222, 46, 30, "#f4d9a8", 4);
  p.poly([[188, 204], [212, 204], [200, 218]], "#8c4a3a", 3); // nose
  if (scared) {
    p.stroke([[182, 240], [192, 234], [202, 240], [212, 234], [220, 240]], 5, INK); // wobbly mouth
    for (const s of [-1, 1]) { // worried brows + small eyes
      p.stroke([[200 + s * 52, 138], [200 + s * 30, 150]], 6, INK);
      p.dot(200 + s * 38, 168, 6);
    }
    p.ell(292, 120, 9, 14, "#7bc4e8", 3); // sweat drop
  } else {
    p.stroke([[184, 236], [200, 244], [216, 236]], 5, INK);
    for (const s of [-1, 1]) {
      p.stroke([[200 + s * 54, 146], [200 + s * 28, 146]], 6, INK);
      p.ell(200 + s * 38, 168, 9, 11, INK, 0);
    }
  }
};
/** scalpel: whole or snapped in two */
const fxScalpel = (p: Pen, broken: boolean) => {
  if (!broken) {
    p.poly([[60, 140], [150, 132], [150, 152], [60, 158]], "#7d8088", 4); // handle
    p.poly([[150, 130], [252, 140], [150, 154]], "#cfd6de", 4); // blade
  } else {
    p.poly([[44, 128], [128, 122], [122, 142], [44, 146]], "#7d8088", 4);
    p.poly([[128, 120], [150, 130], [122, 142]], "#cfd6de", 4);
    p.poly([[196, 168], [262, 184], [190, 190]], "#cfd6de", 4); // snapped tip piece, dropped
  }
};
/** tray with three snapped scalpels */
const fxTray = (p: Pen) => {
  p.poly([[40, 170], [260, 170], [240, 206], [60, 206]], "#9aa0ab", 5);
  p.poly([[40, 170], [260, 170], [254, 182], [46, 182]], "#c3c9d2", 4);
  for (let i = 0; i < 3; i++) {
    const y = 140 - i * 26;
    p.poly([[70, y], [140, y - 6], [138, y + 8], [70, y + 12]], "#7d8088", 4);
    p.poly([[150, y + 4], [196, y + 14], [148, y + 14]], "#cfd6de", 4);
  }
};
/** phone with a charging bolt (same drawing as episode 1) */
const fxPhone = (p: Pen) => {
  p.poly([[112, 30], [188, 30], [188, 230], [112, 230]], "#2e3138", 6);
  p.poly([[122, 48], [178, 48], [178, 212], [122, 212]], "#bfe3ff", 0);
  p.poly([[156, 92], [136, 140], [152, 140], [142, 172], [168, 128], [152, 128]], "#f2c94c", 3);
};

// ---------------- staging ----------------
export const stage = (id: number, t: number, cam: CamInfo): Stage => {
  const out: Stage = { places: [], fx: [] };
  const f = Math.round(t * FPS);
  const blink = (i: number) => lidAt(t, i);
  const stars = (x: number, y: number, z: number, i: number) => {
    const u = q((t * 0.9 + hh(i, 5)) % 1, 30);
    out.fx.push({ key: `stars${u}`, cw: 420, ch: 210, draw: (p) => fxStars(p, u), x, y, z, w: 0.75, h: 0.375 });
  };

  if (id === 1) {
    const x = STREET[0] + heroX1(f), z = STREET[2];
    const view = viewOf(cam, x, z, 1, 0);
    const phase = q(((x + 3.4) / 1.4) % 1, 120);
    const expr: Expr = f >= 115 ? "smile" : "neutral";
    out.places.push(person(cam, hero, x, D0, z, view,
      { phase, mode: "march", expr, blink: blink(1) },
      { phase, mode: "march", expr, blink: blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, x, D0, z);
    if (f >= 115 && f < 140) stars(x, D0 + 2.25, z, 1);
  } else if (id === 2) {
    const hx = DAPUR[0] + 0.1, hz = DAPUR[2] + 0.25;
    const dull = f >= 250;
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: dull ? "smile" : "neutral", blink: blink(1), headTilt: f >= 188 ? 6 : 0 }, {}));
    blob(out, cam, hx, D0, hz);
    // knife in hand: slips down + rotates f188-210, then held up dull
    const slip = smooth((f - 188) / 22);
    const ky = D0 + 1.05 - slip * 0.35 + (dull ? 0.3 : 0);
    out.fx.push({ key: `knife${dull ? "d" : "s"}`, cw: 300, ch: 300, draw: (p) => fxKnife(p, dull),
      x: hx + 0.42, y: ky, z: hz - 0.1, w: 0.55, h: 0.55, rot: -0.5 - slip * 0.5 + (dull ? 0.4 : 0) });
  } else if (id === 3) {
    const hx = PERIKSA[0] - 0.75, hz = PERIKSA[2] - 0.55;
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: "smile", blink: blink(1), facing: 1 }, {}));
    blob(out, cam, hx, D0, hz);
    const dx = PERIKSA[0] + 0.85, dz = PERIKSA[2] - 0.35;
    const dexpr: Expr = f < 350 ? "neutral" : f < 397 ? "shock" : "nervous";
    out.places.push(person(cam, doctor, dx, D0, dz, { side: false, mirror: false },
      { mode: "stand", expr: dexpr, blink: blink(10), facing: -1, headTilt: f >= 397 ? 8 : 0 }, {}));
    blob(out, cam, dx, D0, dz);
    const bent = f >= 350;
    out.fx.push({ key: `syringe${bent ? "b" : "s"}`, cw: 300, ch: 300, draw: (p) => fxSyringe(p, bent),
      x: hx + 0.42, y: D0 + 1.12, z: hz - 0.05, w: 0.5, h: 0.5, rot: 0.15 });
  } else if (id === 4) {
    const hz = STREET[2] - 0.8;
    if (f < 445) {
      // riding the motor in (sit on the seat)
      const x = STREET[0] + fallX4(f);
      out.places.push(person(cam, hero, x, D0 + 0.82, hz, { side: false, mirror: false },
        { mode: "sit", expr: "neutral", blink: blink(1) }, {}));
    } else if (f < 460) {
      // thrown off, falling to the asphalt
      const u = (f - 445) / 15;
      const x = STREET[0] + fallX4(f);
      out.places.push(person(cam, hero, x, D0 + 0.82 * (1 - u), hz, { side: false, mirror: false },
        { mode: "fall", expr: "shock", blink: blink(1) }, {}));
    } else if (f < 499) {
      const x = STREET[0] + fallX4(f);
      out.places.push(person(cam, hero, x, D0, hz, { side: false, mirror: false },
        { mode: "fall", expr: "dazed", blink: blink(1) }, {}));
      out.places[out.places.length - 1].roll = -1.35; // flat on the asphalt
      stars(x + 1.2, D0 + 0.8, hz, 4);
      const u = q(((f - 460) / 24), 30);
      if (u < 1) out.fx.push({ key: `landpuff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y: D0 + 0.4, z: hz, w: 1.3, h: 0.9, soft: true });
    } else {
      const x = STREET[0] + fallX4(f);
      out.places.push(person(cam, hero, x, D0, hz, { side: false, mirror: false },
        { mode: "stand", expr: "smile", blink: blink(1) }, {}));
      blob(out, cam, x, D0, hz);
    }
  } else if (id === 5) {
    const hx = SUNGAI[0] - 0.6, hz = SUNGAI[2];
    const bitten = f >= 613 && f < 706;
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 655 ? "grin" : "smile", blink: blink(1), facing: 1, tilt: bitten ? 3 : 0 }, {}));
    blob(out, cam, hx, D0, hz);
    const cx = SUNGAI[0] + crocX(f), cz = SUNGAI[2] + 0.35;
    const teeth = f < 655;
    const chomp = bitten ? 0.5 + 0.5 * Math.sin(t * 9) : 0.15;
    const chompQ = q(chomp, 12);
    out.fx.push({ key: `croc${teeth ? "t" : "n"}${chompQ}`, cw: 600, ch: 300, draw: (p) => fxCroc(p, teeth, chompQ),
      x: cx, y: D0 + 0.62, z: cz, w: 2.7, h: 1.35 });
    if (f >= 655 && f < 695) {
      const u = q((f - 655) / 40, 30);
      out.fx.push({ key: `teethfly${u}`, cw: 300, ch: 300, draw: (p) => fxTeethFly(p, u), x: hx + 0.7, y: D0 + 1.1, z: hz, w: 1.1, h: 1.1 });
    }
  } else if (id === 6) {
    const hx = TAMAN[0], hz = TAMAN[2];
    if (f < 775) {
      out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
        { mode: "stand", expr: "smile", blink: blink(1) }, {}));
      blob(out, cam, hx, D0, hz);
    } else if (f < 799) {
      // flattened under the tree
      out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
        { mode: "fall", expr: "dazed", blink: blink(1) }, {}));
      out.places[out.places.length - 1].roll = -1.35;
      stars(hx + 1.2, D0 + 0.8, hz, 6);
    } else {
      // lifts the tree onto his shoulder, then holds it like a broom
      const lift = smooth((f - 799) / 48);
      out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
        { mode: "stand", expr: "grin", blink: blink(1), tilt: -4 * (1 - lift) }, {}));
      blob(out, cam, hx, D0, hz);
    }
  } else if (id === 7) {
    const hz = SINGA[2];
    const walkU = clamp01((f - 892) / 48);
    const hx = SINGA[0] - 2.6 + walkU * 2.3;
    const walking = f < 940;
    const view = viewOf(cam, hx, hz, 1, 0);
    const phase = q(((hx - SINGA[0] + 2.6) / 1.4) % 1, 120);
    out.places.push(person(cam, hero, hx, D0, hz, view,
      { phase, mode: walking ? "march" : "stand", expr: f >= 973 ? "grin" : "smile", blink: blink(1) },
      { phase, mode: walking ? "march" : "stand", expr: f >= 973 ? "grin" : "smile", blink: blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, hx, D0, hz);
    if (f >= 928) out.fx.push({ key: "phone", cw: 300, ch: 280, draw: fxPhone, x: hx + 0.42, y: D0 + 1.15, z: hz - 0.05, w: 0.36, h: 0.34, rot: -0.08 });
    const lx = SINGA[0] + lionX(f);
    const scared = f >= 973;
    out.fx.push({ key: `lion${scared ? "s" : "c"}`, cw: 400, ch: 360, draw: (p) => fxLion(p, scared),
      x: lx, y: D0 + 0.82, z: hz + 0.6, w: 1.7, h: 1.53, rot: scared ? Math.sin(t * 10) * 0.02 : 0 });
  } else if (id === 8) {
    // hero lying on the operating table (table top at D0 + 0.95 in world.ts), doctor tries to cut
    const hx = PERIKSA[0] - 1.0, hz = PERIKSA[2] + 0.45;
    out.places.push(person(cam, hero, hx, D0 + 0.95, hz, { side: false, mirror: false },
      { mode: "fall", expr: "smile", blink: blink(1) }, {}));
    out.places[out.places.length - 1].roll = 1.35; // flat on his back on the table
    const dx = PERIKSA[0] - 0.3, dz = PERIKSA[2] + 1.15;
    const snapped = f >= 1190;
    out.places.push(person(cam, doctor, dx, D0, dz, { side: false, mirror: false },
      { mode: "stand", expr: snapped ? "shock" : "neutral", blink: blink(10), facing: -1, headTilt: 6 }, {}));
    blob(out, cam, dx, D0, dz);
    out.fx.push({ key: `scalpel${snapped ? "b" : "w"}`, cw: 300, ch: 300, draw: (p) => fxScalpel(p, snapped),
      x: PERIKSA[0] - 0.1, y: D0 + 1.38, z: hz + 0.15, w: 0.5, h: 0.5, rot: -0.3 });
  } else if (id === 9) {
    const hx = PERIKSA[0] - 0.2, hz = PERIKSA[2] + 0.4;
    out.places.push(person(cam, hero, hx, D0 + 0.95, hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 1304 ? "grin" : "smile", blink: blink(1) }, {}));
    const dx = PERIKSA[0] + 1.05, dz = PERIKSA[2] + 0.7;
    out.places.push(person(cam, doctor, dx, D0, dz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 1288 ? "nervous" : "shock", blink: blink(10), facing: -1, tilt: f >= 1288 ? 4 : 0, headTilt: f >= 1288 ? 10 : 0 }, {}));
    blob(out, cam, dx, D0, dz);
    out.fx.push({ key: "tray", cw: 300, ch: 260, draw: fxTray, x: dx - 0.45, y: D0 + 1.05, z: dz - 0.1, w: 0.62, h: 0.54 });
  } else if (id === 10) {
    const hz = RUMAH[2];
    const walkU = clamp01((f - 1371) / 99);
    const hx = RUMAH[0] - 3.2 + walkU * 2.4;
    const walking = f < 1470;
    const down = f >= 1477;
    const view = viewOf(cam, hx, hz, 1, 0);
    const phase = q(((hx - RUMAH[0] + 3.2) / 1.4) % 1, 120);
    out.places.push(person(cam, hero, hx, D0, hz, view,
      { phase, mode: walking ? "march" : "stand", expr: down ? "dazed" : "smile", blink: blink(1), headTilt: down ? 12 : 0 },
      { phase, mode: walking ? "march" : "stand", expr: down ? "dazed" : "smile", blink: blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, hx, D0, hz);
    const ix = RUMAH[0] + 1.0;
    out.places.push(person(cam, ibu, ix, D0, hz + 0.3, { side: false, mirror: false },
      { mode: "stand", expr: "stern", blink: blink(20), facing: -1 }, {}));
    blob(out, cam, ix, D0, hz + 0.3);
  }
  return out;
};
