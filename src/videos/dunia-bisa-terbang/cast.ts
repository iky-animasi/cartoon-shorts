// Cast staging for "Di Dunia Ini Kamu Bisa Terbang": hero ("kamu") plus friend and sky
// townsfolk, flat sprites from the shared molasses toon kit. Flyers use the "fall" pose with
// a ~1.35 rad roll (body horizontal) + gentle bob. Reactions land on their words (words.json);
// positions in metres, y = D0 = 6 is the ground, sky shots fly at y ~ D0 + 7.4.
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxStars, fxPuff, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, townsfolk, INK,
} from "../molasses/toon";
import {
  FPS, D0, LANGIT, JALAN, RUMAH, TAMU,
  heroX1, heroX3, bumpA, bumpB, landX8, landY8, smooth, clamp01,
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
const hero: Who = { i: 1, o: HERO, okey: "hero" };
const teman: Who = { i: 3, o: TEMAN, okey: "teman" };
const folk = (v: number): Who => ({ i: 30 + v, o: townsfolk(v), okey: `folk${v}` });

// ---------------- custom fx drawings (design space = canvas px) ----------------
/** inverted umbrella (canopy flipped up by the wind, u = wobble phase) */
const fxUmbrella = (p: Pen, u: number) => {
  const wob = Math.sin(u * Math.PI * 2) * 10;
  const cx = 150 + wob, cy = 120;
  // flipped canopy: shallow bowl opening upward, ribs splayed
  p.poly([[cx - 95, cy + 30], [cx - 60, cy - 8], [cx, cy - 22], [cx + 60, cy - 8], [cx + 95, cy + 30], [cx + 60, cy + 18], [cx, cy + 8], [cx - 60, cy + 18]], "#c94a7a", 6);
  for (const dx of [-70, -35, 0, 35, 70])
    p.stroke([[cx, cy + 4], [cx + dx * 1.25, cy + 26]], 4, INK);
  // shaft down to the handle
  p.stroke([[cx, cy + 6], [cx - 6, cy + 95]], 7, INK);
  p.stroke([[cx - 6, cy + 95], [cx - 20, cy + 110], [cx - 34, cy + 100]], 7, INK);
  // rain streaks bouncing off
  for (let i = 0; i < 4; i++) {
    const x = cx - 80 + i * 52, y = cy - 60 + (i % 2) * 18;
    p.stroke([[x, y], [x - 8, y + 26]], 4, "#7bc4e8");
  }
};
/** electricity bill paper (white sheet, text lines, red total stamp) */
const fxBill = (p: Pen) => {
  p.poly([[95, 25], [205, 25], [205, 235], [95, 235]], "#ffffff", 6);
  p.poly([[108, 42], [192, 42], [192, 62], [108, 62]], "#2f6fb2", 0);
  for (let r = 0; r < 4; r++)
    p.poly([[108, 80 + r * 22], [170 - (r % 2) * 25, 80 + r * 22], [170 - (r % 2) * 25, 90 + r * 22], [108, 90 + r * 22]], "#9aa7b4", 0);
  // big red total box
  p.poly([[108, 180], [192, 180], [192, 218], [108, 218]], "#e2453c", 5);
  p.poly([[118, 192], [182, 192], [182, 206], [118, 206]], "#ffffff", 0);
};
/** water drips falling off a soaked character (u = 0..1 progress, quantized by caller) */
const fxDrips = (p: Pen, u: number) => {
  for (let i = 0; i < 6; i++) {
    const x = 60 + i * 36, y = 40 + ((u + i * 0.17) % 1) * 180;
    const s = 9;
    p.poly([[x, y - s * 1.5], [x + s * 0.8, y + s * 0.4], [x + s * 0.35, y + s], [x - s * 0.35, y + s], [x - s * 0.8, y + s * 0.4]], "#7bc4e8", 3);
  }
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
  // flyer: "fall" pose rolled horizontal (dir +1 flies +x), gentle bob + roll wobble.
  // (x, y) is the body centre; the card origin (soles) sits ~1.05 m behind it.
  const flyer = (who: Who, x: number, y: number, z: number, dir: 1 | -1, expr: Expr, i: number, scale = 1, extra: Partial<FrontOpts> = {}) => {
    const p = person(cam, who, x - dir * 1.05 * scale, y + Math.sin(t * 1.3 + i * 1.7) * 0.12, z, { side: false, mirror: false },
      { mode: "fall", expr, blink: blink(i), ...extra }, {}, scale);
    p.roll = -dir * (1.35 + Math.sin(t * 0.9 + i * 2.3) * 0.06);
    out.places.push(p);
  };
  const FY = D0 + 7.4; // cruising height for sky shots

  if (id === 1) {
    const hx = LANGIT[0] + heroX1(f);
    flyer(hero, hx, FY, LANGIT[2], 1, f >= 155 ? "grin" : "smile", 1);
    flyer(folk(0), LANGIT[0] - 2.2 + (f / 220) * 4.6, FY + 0.7, LANGIT[2] - 2.5, 1, "smile", 30, 0.8);
    flyer(folk(2), LANGIT[0] - 0.8 + (f / 220) * 2.6, FY - 0.8, LANGIT[2] - 0.5, 1, "neutral", 32, 0.85);
    flyer(folk(4), LANGIT[0] - 5.5 + (f / 220) * 6.0, FY + 1.4, LANGIT[2] - 5, 1, "smile", 34, 0.55);
  } else if (id === 2) {
    // empty street: one distant flyer crosses high above (everyone else is up there too)
    flyer(folk(1), JALAN[0] - 6 + ((f - 220) / 171) * 12, D0 + 7.2, JALAN[2] - 4, 1, "neutral", 31, 0.55);
  } else if (id === 3) {
    // sky traffic jam: a slow queue creeping +x, hero stuck in the middle
    const hx = LANGIT[0] + heroX3(f);
    flyer(hero, hx, FY, LANGIT[2], 1, f >= 529 ? "dazed" : "neutral", 1, 1, { headTilt: idleHead(1, 1.0) });
    flyer(folk(0), hx - 1.55, FY + 0.15, LANGIT[2] - 0.4, 1, "dazed", 30, 0.9);
    flyer(folk(2), hx + 1.55, FY - 0.1, LANGIT[2] + 0.3, 1, "neutral", 32, 0.95);
    flyer(folk(3), hx + 3.05, FY + 0.2, LANGIT[2] - 0.2, 1, "dazed", 33, 0.9);
    flyer(folk(5), hx - 3.05, FY - 0.15, LANGIT[2] + 0.2, 1, "neutral", 35, 0.85);
    flyer(folk(6), hx + 4.55, FY + 0.1, LANGIT[2] - 0.5, 1, "smile", 36, 0.8);
  } else if (id === 4) {
    // hero and friend bump mid-air at f610, bounce back, pretend not to see each other
    const bumped = f >= 610;
    const ax = LANGIT[0] + bumpA(f), bx = LANGIT[0] + bumpB(f);
    flyer(hero, ax, FY, LANGIT[2], 1, bumped ? (f >= 682 ? "nervous" : "shock") : "smile", 1, 1,
      { look: f >= 711 ? -1 : 0 });
    flyer(teman, bx, FY + 0.1, LANGIT[2], -1, bumped ? (f >= 682 ? "nervous" : "shock") : "smile", 3, 1,
      { look: f >= 711 ? 1 : 0 });
    if (bumped && f < 645) stars(LANGIT[0], FY + 0.5, LANGIT[2], 9);
  } else if (id === 5) {
    const hx = LANGIT[0] - 1.5 + ((f - 757) / 187) * 3.0;
    flyer(hero, hx, FY, LANGIT[2], 1, "smile", 1, 1, { headTilt: 8 });
    if (f >= 895) { // flying while on the phone
      const dots = 1 + (Math.floor(t * 1.5) % 3);
      out.fx.push({ key: `phonechat${dots}`, cw: 300, ch: 280, draw: (p) => fxPhoneChat(p, dots),
        x: hx + 0.85, y: FY + 0.15, z: LANGIT[2] - 0.05, w: 0.5, h: 0.47, rot: 0.1 });
    }
    flyer(folk(2), LANGIT[0] + 2.2 + ((f - 757) / 187) * 2.6, FY + 0.6, LANGIT[2] - 2.2, 1, "neutral", 32, 0.8);
    flyer(folk(4), LANGIT[0] - 4.0 + ((f - 757) / 187) * 3.4, FY - 0.7, LANGIT[2] + 1.6, 1, "smile", 34, 0.85);
  } else if (id === 6) {
    // rain: everyone panicking, bobbing harder, looking for shelter that isn't there
    const hx = LANGIT[0] - 0.8 + ((f - 944) / 163) * 1.6;
    flyer(hero, hx, FY, LANGIT[2], 1, f >= 993 ? "nervous" : "smile", 1, 1, { headTilt: idleHead(1, 2.2) });
    flyer(folk(0), LANGIT[0] + 1.8 + ((f - 944) / 163) * 1.4, FY + 0.5, LANGIT[2] - 1.8, 1, "nervous", 30, 0.85);
    flyer(folk(3), LANGIT[0] - 3.2 + ((f - 944) / 163) * 1.8, FY - 0.6, LANGIT[2] + 1.4, 1, "shock", 33, 0.9);
    flyer(folk(5), LANGIT[0] + 3.8 + ((f - 944) / 163) * 1.2, FY + 1.1, LANGIT[2] - 3.2, 1, "nervous", 35, 0.6);
  } else if (id === 7) {
    // soaked through; hero's umbrella has flipped inside out
    const hx = LANGIT[0] + 0.3 + ((f - 1107) / 155) * 0.8;
    flyer(hero, hx, FY, LANGIT[2], 1, "dazed", 1, 1, { headTilt: 6 });
    const u = q((t * 0.7) % 1, 24);
    out.fx.push({ key: `umb${u}`, cw: 300, ch: 260, draw: (p) => fxUmbrella(p, u),
      x: hx + 0.75, y: FY + 0.55, z: LANGIT[2], w: 1.35, h: 1.15, rot: -0.15 });
    flyer(folk(1), LANGIT[0] - 2.4 + ((f - 1107) / 155) * 1.0, FY - 0.5, LANGIT[2] + 1.2, 1, "dazed", 31, 0.9);
    flyer(folk(4), LANGIT[0] + 2.6 + ((f - 1107) / 155) * 0.9, FY + 0.7, LANGIT[2] - 2.0, 1, "nervous", 34, 0.8);
  } else if (id === 8) {
    // hero glides down and lands in front of the house, dripping wet
    const hx = RUMAH[0] + landX8(f), hy = landY8(f);
    if (f < 1330) {
      flyer(hero, hx, hy + 0.6, RUMAH[2], 1, "dazed", 1);
    } else {
      out.places.push(person(cam, hero, hx, D0 + idleBob(1), RUMAH[2], { side: false, mirror: false },
        { mode: "stand", expr: f >= 1397 ? "smile_closed" : "dazed", blink: blink(1), headTilt: 8 + idleHead(1, 0.8), look: idleLook(1) }, {}));
      blob(out, cam, hx, D0, RUMAH[2]);
    }
    const u = q((t * 0.55) % 1, 30);
    out.fx.push({ key: `drips${u}`, cw: 300, ch: 280, draw: (p) => fxDrips(p, u),
      x: hx + (f < 1330 ? 0.4 : 0), y: (f < 1330 ? hy + 0.2 : D0 + 0.9), z: RUMAH[2], w: 0.8, h: 0.75 });
  } else if (id === 9) {
    const hx = TAMU[0] - 0.5, hz = TAMU[2] + 0.9;
    out.places.push(person(cam, hero, hx, D0 + 0.55 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 1538 ? "shock" : "smile", blink: blink(1),
        headTilt: (f >= 1526 ? 10 : 0) + idleHead(1, 1.0), look: f >= 1526 ? 0.7 : idleLook(1) }, {}));
  } else if (id === 10) {
    const hx = TAMU[0] - 0.5, hz = TAMU[2] + 0.9;
    out.places.push(person(cam, hero, hx, D0 + 0.55 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 1713 ? "nervous" : f >= 1665 ? "dazed" : "shock", blink: blink(1),
        headTilt: 12 + idleHead(1, 0.8), look: 0.4, wave: f >= 1713 ? q(0.3 + Math.sin(t * 2.6) * 0.12, 6) : undefined }, {}));
    out.fx.push({ key: "bill", cw: 300, ch: 280, draw: (p) => fxBill(p),
      x: hx + 0.48, y: D0 + 1.05, z: hz - 0.15, w: 0.42, h: 0.39, rot: -0.06 });
  }
  return out;
};
