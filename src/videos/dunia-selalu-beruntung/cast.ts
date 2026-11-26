// Cast staging for "Di Dunia Ini Kamu Selalu Beruntung": hero ("kamu") plus friend, boss,
// cafe/kantin townsfolk and ibu (pink, from episode 2), flat sprites from the shared molasses
// toon kit. Reactions land on their words (words.json); positions in metres, y = D0 = 6 is the ground.
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxStars, fxPuff, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, townsfolk, INK,
} from "../molasses/toon";
import {
  FPS, D0, JALAN, KANTOR, KAFE, KANTIN, SORE, DAPUR,
  heroX1, payungX1, heroX6, heroX7, jarak3, smooth, clamp01,
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
/** a found banknote (green bill with a circle seal and corner marks) */
const fxMoney = (p: Pen) => {
  p.poly([[45, 105], [255, 95], [258, 195], [48, 205]], "#7bc47f", 6);
  p.poly([[60, 118], [242, 110], [244, 182], [62, 190]], "#a8d8a8", 3);
  p.ell(150, 150, 30, 26, "#e8f2d8", 4);
  p.dot(150, 150, 9, "#2f8f6a");
  for (const [x, y] of [[72, 126], [228, 120], [74, 180], [230, 172]] as const)
    p.poly([[x - 8, y], [x + 8, y], [x + 8, y + 7], [x - 8, y + 7]], "#2f8f6a", 0);
};
/** open umbrella held over someone (u = sway phase) */
const fxUmbrellaOpen = (p: Pen, u: number) => {
  const cx = 150 + Math.sin(u * Math.PI * 2) * 6, cy = 110;
  p.poly([[cx - 105, cy + 28], [cx - 70, cy - 18], [cx - 25, cy - 38], [cx + 25, cy - 38], [cx + 70, cy - 18], [cx + 105, cy + 28],
    [cx + 70, cy + 16], [cx + 35, cy + 26], [cx, cy + 16], [cx - 35, cy + 26], [cx - 70, cy + 16]], "#3f7fbf", 6);
  for (const dx of [-70, -35, 0, 35, 70])
    p.stroke([[cx, cy - 30], [cx + dx * 1.3, cy + 24]], 4, INK);
  p.stroke([[cx, cy - 34], [cx, cy - 52]], 6, INK);
  p.stroke([[cx, cy + 14], [cx, cy + 120]], 7, INK);
  p.stroke([[cx, cy + 120], [cx + 16, cy + 132], [cx + 30, cy + 120]], 7, INK);
};
/** messy presentation board (whiteboard with a scribbled chart) */
const fxBoard = (p: Pen) => {
  p.poly([[35, 35], [265, 35], [265, 225], [35, 225]], "#f4f6f8", 7);
  // axes
  p.stroke([[60, 195], [60, 60]], 5, "#9aa7b4");
  p.stroke([[60, 195], [240, 195]], 5, "#9aa7b4");
  // chaotic chart line
  p.stroke([[65, 180], [95, 90], [120, 165], [150, 70], [175, 150], [205, 85], [235, 140]], 6, "#e2453c");
  // scribble bars + a circled blob
  for (let i = 0; i < 3; i++)
    p.poly([[75 + i * 55, 185 - (i * 37) % 60], [95 + i * 55, 185 - (i * 37) % 60], [95 + i * 55, 193], [75 + i * 55, 193]], "#7bc4e8", 3);
  p.ell(200, 95, 26, 20, null, 5);
  p.stroke([[80, 55], [150, 55]], 6, "#2e3138");
  p.stroke([[80, 70], [125, 70]], 5, "#2e3138");
};
/** a fan of winning cards held up */
const fxCards = (p: Pen) => {
  const cards: [number, number, number][] = [[-0.35, 95, 150], [-0.12, 115, 140], [0.12, 135, 140], [0.35, 155, 150]];
  for (const [rot, cx, cy] of cards) {
    const c = Math.cos(rot), s = Math.sin(rot), w = 34, h = 48;
    const pts: [number, number][] = [[-w, -h], [w, -h], [w, h], [-w, h]].map(([x, y]) => [cx + x * c - y * s, cy + x * s + y * c] as [number, number]);
    p.poly(pts, "#ffffff", 5);
  }
  p.dot(125, 128, 8, "#e2453c"); p.dot(143, 138, 8, "#2e3138"); p.dot(105, 140, 7, "#e2453c");
};
/** a plate of rice with a spoon (canteen lunch) */
const fxPlate = (p: Pen) => {
  p.ell(150, 165, 95, 34, "#eef1f4", 6);
  p.ell(150, 158, 72, 24, "#dbe3ea", 3);
  p.ell(140, 142, 44, 22, "#ffffff", 4); // rice mound
  p.ell(185, 150, 20, 12, "#c96a3f", 3); // side dish
  p.stroke([[205, 120], [228, 158]], 7, "#9aa7b4"); // spoon handle
  p.ell(202, 114, 12, 9, "#c9d2da", 3);
};
/** quiz card with a big question mark */
const fxQuiz = (p: Pen) => {
  p.poly([[70, 30], [230, 30], [230, 240], [70, 240]], "#fff3cf", 7);
  p.poly([[70, 30], [230, 30], [230, 62], [70, 62]], "#e2453c", 5);
  // question mark: arc + stem + dot
  p.arc(150, 118, 34, 34, -160, 130, 13, "#2e3138");
  p.stroke([[150, 148], [150, 172]], 13, "#2e3138");
  p.dot(150, 196, 9, "#2e3138");
  // answer lines
  p.stroke([[95, 218], [205, 218]], 5, "#9aa7b4");
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
    // street: hero walks, finds money (f107), wins a raffle (f171), gets an umbrella in the drizzle (f242)
    const hx = JALAN[0] + heroX1(f);
    const walking = f < 107;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), JALAN[2], { side: false, mirror: false },
      { mode: walking ? "march" : "stand", phase: walking ? t * 1.6 : 0,
        expr: f >= 171 ? "grin" : f >= 107 ? "smile" : "neutral", blink: blink(1),
        headTilt: (f >= 107 && f < 150 ? 12 : 0) + idleHead(1, 0.8), look: f >= 107 ? 0.5 : idleLook(1) }, {}));
    blob(out, cam, hx, D0, JALAN[2]);
    if (f >= 95) { // the banknote: on the ground, then lifted into his hand at "uang" (f123)
      const lift = smooth((f - 123) / 18);
      out.fx.push({ key: "money", cw: 300, ch: 280, draw: (p) => fxMoney(p),
        x: hx + 0.55, y: D0 + 0.16 + lift * 0.75, z: JALAN[2] - 0.1, w: 0.42, h: 0.39, rot: -0.08 + lift * 0.1, flat: lift < 0.5 });
    }
    if (f >= 171 && f < 215) stars(hx + 0.2, D0 + 2.1, JALAN[2], 4); // raffle win sparkle
    if (f >= 230) { // a passerby shares an umbrella when the drizzle starts
      const px = JALAN[0] + payungX1(f);
      out.places.push(person(cam, folk(2), px, D0 + idleBob(32), JALAN[2] + 0.15, { side: false, mirror: false },
        { mode: f < 275 ? "march" : "stand", phase: f < 275 ? t * 1.5 : 0, expr: "smile", blink: blink(32), look: -0.5 }, {}, 0.95));
      blob(out, cam, px, D0, JALAN[2] + 0.15);
      const u = q((t * 0.6) % 1, 24);
      out.fx.push({ key: `umbopen${u}`, cw: 300, ch: 280, draw: (p) => fxUmbrellaOpen(p, u),
        x: px - 0.35, y: D0 + 2.35, z: JALAN[2] + 0.1, w: 1.5, h: 1.4, rot: 0.06 });
    }
  } else if (id === 2) {
    // office: hero presents a messy chart; the boss loves it; hero is late but so is the meeting
    const hx = KANTOR[0] - 0.9, hz = KANTOR[2] + 0.6;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 472 ? "relief" : f >= 392 ? "grin" : f >= 326 ? "nervous" : "smile", blink: blink(1),
        headTilt: idleHead(1, 0.9), look: 0.6, wave: f >= 326 && f < 392 ? q(0.35 + Math.sin(t * 2.2) * 0.1, 6) : undefined }, {}));
    blob(out, cam, hx, D0, hz);
    out.fx.push({ key: "board", cw: 300, ch: 280, draw: (p) => fxBoard(p),
      x: hx - 0.95, y: D0 + 1.75, z: hz + 0.35, w: 1.25, h: 1.17, rot: 0.02 });
    const bx = KANTOR[0] + 1.15, bz = KANTOR[2] + 1.5;
    out.places.push(person(cam, bos, bx, D0 + 0.5 + idleBob(5), bz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 392 ? "grin" : "stern", blink: blink(5),
        headTilt: idleHead(5, 0.7), look: -0.5,
        wave: (f >= 392 && f < 460) || (f >= 472 && f < 520) ? q(0.45 + Math.sin(t * 3.2) * 0.15, 6) : undefined }, {}));
  } else if (id === 3) {
    // cafe card game: friends slide away (f596), hero wins again (f721)
    const hx = KAFE[0] + 0.1, hz = KAFE[2] + 1.1, jr = jarak3(f);
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 721 ? "grin" : f >= 596 ? "nervous" : "smile", blink: blink(1),
        headTilt: idleHead(1, 0.9), look: idleLook(1) }, {}));
    if (f >= 721) out.fx.push({ key: "cards", cw: 300, ch: 280, draw: (p) => fxCards(p),
      x: hx + 0.42, y: D0 + 1.2, z: hz - 0.2, w: 0.5, h: 0.47, rot: -0.05 });
    const tx = KAFE[0] - 1.0 - jr, tz = KAFE[2] + 1.15;
    out.places.push(person(cam, teman, tx, D0 + 0.5 + idleBob(3), tz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 721 ? "dazed" : f >= 596 ? "nervous" : "smile", blink: blink(3),
        headTilt: (f >= 721 ? q(Math.sin(t * 2.4) * 4, 2) : idleHead(3, 0.9)), look: f >= 596 ? -0.8 : 0.4 }, {}));
    const fx2 = KAFE[0] + 1.25 + jr, fz2 = KAFE[2] + 1.05;
    out.places.push(person(cam, folk(3), fx2, D0 + 0.5 + idleBob(33), fz2, { side: false, mirror: false },
      { mode: "sit", expr: f >= 721 ? "dazed" : "neutral", blink: blink(33),
        headTilt: (f >= 721 ? q(Math.sin(t * 2.1 + 1) * 4, 2) : idleHead(33, 0.9)), look: f >= 596 ? 0.8 : -0.4 }, {}, 0.95));
  } else if (id === 4) {
    // canteen: hero eats alone in front; a full laughing table behind
    const hx = KANTIN[0] - 0.7, hz = KANTIN[2] + 0.9;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 913 ? "dazed" : f >= 848 ? "nervous" : "neutral", blink: blink(1),
        headTilt: 9 + idleHead(1, 0.7), look: f >= 848 && f < 905 ? 0.8 : idleLook(1) }, {}));
    out.fx.push({ key: "plate", cw: 300, ch: 280, draw: (p) => fxPlate(p),
      x: hx + 0.1, y: D0 + 0.78, z: hz - 0.35, w: 0.55, h: 0.51, rot: 0.03 });
    const bg: [Who, number, number, number][] = [[folk(0), 1.5, 1.9, 30], [folk(4), 2.3, 1.75, 34], [folk(5), 3.1, 1.95, 35]];
    for (const [who, ox, oz, i] of bg)
      out.places.push(person(cam, who, KANTIN[0] + ox, D0 + 0.5 + idleBob(i), KANTIN[2] + oz, { side: false, mirror: false },
        { mode: "sit", expr: "laugh", blink: blink(i), headTilt: idleHead(i, 1.6), look: idleLook(i) }, {}, 0.9));
  } else if (id === 5) {
    // cafe quiz: hero answers at random and still wins; friend shakes his head
    const hx = KAFE[0] + 0.1, hz = KAFE[2] + 1.1;
    out.places.push(person(cam, hero, hx, D0 + 0.5 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 1127 ? "grin" : f >= 1043 ? "smile_closed" : "neutral", blink: blink(1),
        headTilt: idleHead(1, 0.9), look: 0.4,
        wave: f >= 1043 && f < 1127 ? q(0.3 + Math.sin(t * 1.8) * 0.08, 6) : undefined }, {}));
    out.fx.push({ key: "quiz", cw: 300, ch: 280, draw: (p) => fxQuiz(p),
      x: hx + 0.5, y: D0 + 1.25, z: hz - 0.15, w: 0.44, h: 0.41, rot: -0.04 });
    if (f >= 1127 && f < 1173) stars(hx + 0.3, D0 + 2.2, hz, 7);
    const tx = KAFE[0] + 1.25, tz = KAFE[2] + 1.05;
    out.places.push(person(cam, teman, tx, D0 + 0.5 + idleBob(3), tz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 1127 ? "dazed" : "neutral", blink: blink(3),
        headTilt: (f >= 1141 ? q(Math.sin(t * 3.0) * 5, 2) : idleHead(3, 0.9)), look: -0.5 }, {}));
  } else if (id === 6) {
    // dusk: hero walks home alone, realising always-lucky is lonely
    const hx = SORE[0] + heroX6(f);
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), SORE[2], { side: false, mirror: false },
      { mode: "march", phase: t * 1.15, expr: f >= 1250 ? "dazed" : "neutral", blink: blink(1),
        headTilt: 11 + idleHead(1, 0.6), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, SORE[2]);
  } else if (id === 7 || id === 8 || id === 9 || id === 10) {
    // kitchen: ibu cooks at the stove (right), hero comes in (left) and tells his story;
    // ibu's words always win the argument
    const ix = DAPUR[0] + 1.35, iz = DAPUR[2] + 2.55;
    const hx = DAPUR[0] + (id === 7 ? heroX7(f) : -1.2), hz = DAPUR[2] + 0.95;
    const ngomel = (id === 8 && f >= 1646) || (id === 9 && f >= 1834) || id === 10;
    out.places.push(person(cam, ibu, ix, D0 + idleBob(20), iz, { side: false, mirror: false },
      { mode: "stand", expr: ngomel ? "stern" : id === 7 ? "neutral" : "smile", blink: blink(20),
        headTilt: idleHead(20, 0.8), look: -0.6,
        wave: ngomel ? q(0.5 + Math.sin(t * 3.4) * 0.14, 6) : (id === 7 && f >= 1488 ? q(0.35 + Math.sin(t * 2.4) * 0.1, 6) : undefined) }, {}));
    blob(out, cam, ix, D0, iz);
    const entering = id === 7 && f < 1457;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: entering ? "march" : "stand", phase: entering ? t * 1.6 : 0,
        expr: id === 10 ? "nervous" : id === 9 ? (f >= 1799 && f < 1858 ? "shock" : "dazed")
          : id === 8 ? (f >= 1680 ? "shock" : "smile") : "nervous", blink: blink(1),
        headTilt: (id === 9 && f >= 1858 ? 12 : 0) + idleHead(1, 0.8), look: 0.6,
        wave: id === 8 && f < 1646 ? q(0.4 + Math.sin(t * 2.6) * 0.12, 6) : undefined }, {}));
    blob(out, cam, hx, D0, hz);
    if (id === 10) { // sweat flying off the hero at the punchline
      const u = q((t * 0.5) % 1, 30);
      out.fx.push({ key: `sweat${u}`, cw: 300, ch: 280, draw: (p) => fxSweat(p, u),
        x: hx, y: D0 + 1.85, z: hz, w: 0.8, h: 0.75 });
    }
  }
  return out;
};
