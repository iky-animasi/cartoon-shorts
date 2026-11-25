// Cast staging for "Di Dunia Ini Kamu Nggak Bisa Merasa Sakit": one hero ("kamu") plus seller, friend,
// doctor and gebetan, all flat sprites from the shared molasses toon kit. Reactions land on their words
// (words.json); positions in metres, y = D0 = 6 is the ground (roof = ROOF_Y).
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxStars, fxPuff, fxShadow, fxContact, fxRing,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, worker, summer, INK,
} from "../molasses/toon";
import {
  FPS, D0, ROOF_Y, STREET, ROOM, WARUNG, DAPUR, LAPANGAN, ATAP, XRAY, TAMAN,
  heroX1, heroX2, fallY, fallX, smooth, clamp01, SHOTS,
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
const SELLER: Outfit = worker(2);
const FRIEND: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "cap", cap: "#e2453c", skin: SKINS[1] };
const DOCTOR: Outfit = { jacket: "#f4f6f8", pants: "#3b3f52", boots: "#1d1b22", hat: "hair", hair: "#4a3426", glasses: true, skin: SKINS[2] };
const GIRL: Outfit = summer(1);
const hero: Who = { i: 1, o: HERO, okey: "hero" };

// ---------------- custom fx drawings (design space = canvas px) ----------------
/** alarm clock on the chest: ringing (u = wobble phase 0..1) or dead (grey, droopy bells, X eyes) */
const fxAlarm = (p: Pen, u: number, dead: boolean) => {
  const cx = 150, cy = 160, R = 95;
  const body = dead ? "#9a9aa2" : "#e2453c", face = dead ? "#d8d8de" : "#fff6e0";
  const wob = dead ? 0 : Math.sin(u * Math.PI * 2) * 6;
  // bells
  for (const s of [-1, 1]) {
    const bx = cx + s * 78, by = cy - 88 + (dead ? 14 : 0);
    p.ell(bx, by, 30, 20, dead ? "#8a8a92" : "#f2c94c", 5, 0, 360, s * 30);
    p.stroke([[cx + s * 40, cy - 70], [bx, by + 8]], 9, INK);
  }
  // legs
  for (const s of [-1, 1]) p.stroke([[cx + s * 55, cy + 78], [cx + s * 72, cy + 108]], 10, INK);
  // body + face
  p.ell(cx, cy, R, R, body, 6);
  p.ell(cx, cy, R - 18, R - 18, face, 4);
  // ticks
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, r1 = R - 30, r2 = R - 22;
    p.stroke([[cx + Math.cos(a) * r1, cy + Math.sin(a) * r1], [cx + Math.cos(a) * r2, cy + Math.sin(a) * r2]], 5, INK);
  }
  if (dead) {
    // hands drooped to 6:30, X eyes
    p.stroke([[cx, cy], [cx, cy + 52]], 9, INK);
    p.stroke([[cx, cy], [cx - 30, cy + 30]], 7, INK);
    for (const s of [-1, 1]) {
      const ex = cx + s * 30, ey = cy - 22;
      p.stroke([[ex - 9, ey - 9], [ex + 9, ey + 9]], 6, INK);
      p.stroke([[ex + 9, ey - 9], [ex - 9, ey + 9]], 6, INK);
    }
  } else {
    // hands at 12:00, shaking with the ring
    p.stroke([[cx, cy], [cx + wob, cy - 58]], 9, INK);
    p.stroke([[cx, cy], [cx + 40 + wob * 0.5, cy - 12]], 7, INK);
    p.dot(cx, cy, 8);
    // ring arcs
    for (const s of [-1, 1]) for (let k = 0; k < 2; k++)
      p.arc(cx + s * (R + 16 + k * 18), cy - 40, 26 + k * 14, 26 + k * 14, s < 0 ? 120 : -60, s < 0 ? 240 : 60, 6, "#f2c94c");
  }
};
/** heart above the head: whole, or cracked (jagged split + falling chip) */
const heartPts = (cx: number, cy: number, s: number): [number, number][] => {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3, y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([cx + (x * s) / 16, cy - (y * s) / 16]);
  }
  return pts;
};
const fxHeart = (p: Pen, cracked: boolean) => {
  const cx = 150, cy = 140, s = 95;
  p.poly(heartPts(cx, cy, s), cracked ? "#c25a7a" : "#e2455e", 6);
  if (cracked) {
    const crack: [number, number][] = [[cx + 4, cy - 62], [cx - 14, cy - 28], [cx + 10, cy - 2], [cx - 8, cy + 28], [cx + 2, cy + 58]];
    p.stroke(crack, 7, INK);
    p.poly([[cx + 58, cy + 46], [cx + 78, cy + 62], [cx + 54, cy + 74]], "#c25a7a", 5); // fallen chip
  } else {
    p.ell(cx - 34, cy - 30, 16, 10, "rgba(255,255,255,0.55)", 0, 0, 360, -30); // shine
  }
};
/** stomach rumble bubble: round bubble + zigzag "krruk" lines */
const fxRumble = (p: Pen, u: number) => {
  const cx = 150, cy = 110;
  p.ell(cx, cy, 105, 72, "#ffffff", 6);
  p.poly([[cx - 30, cy + 58], [cx - 52, cy + 104], [cx + 6, cy + 66]], "#ffffff", 6);
  const wob = Math.sin(u * Math.PI * 2) * 4;
  for (let r = 0; r < 2; r++) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 8; i++) pts.push([cx - 64 + i * 16, cy - 16 + r * 34 + (i % 2 ? -9 : 9) + wob * (r ? -1 : 1)]);
    p.stroke(pts, 7, "#e08a2e");
  }
};
/** electric sparks around the hand */
const fxSparks = (p: Pen, u: number) => {
  const cx = 150, cy = 150;
  const bolt = (x0: number, y0: number, dx: number, dy: number, s: number) => {
    const pts: [number, number][] = [[x0, y0]];
    let x = x0, y = y0;
    for (let i = 0; i < 4; i++) { x += dx * s * 0.25 + (i % 2 ? 14 : -14) * s; y += dy * s * 0.25; pts.push([x, y]); }
    p.stroke(pts, 9, "#f7c65a");
    p.stroke(pts, 4, "#fff3b0");
  };
  const a = u * Math.PI * 2;
  for (let k = 0; k < 4; k++) {
    const th = a + (k * Math.PI) / 2;
    bolt(cx + Math.cos(th) * 30, cy + Math.sin(th) * 30, Math.cos(th), Math.sin(th), 1.6);
  }
  p.dot(cx, cy, 14, "#fff3b0");
};
/** spiky hair overlay after the shock (sits on top of the head) */
const fxHairSpike = (p: Pen) => {
  const cx = 150, base = 190;
  const pts: [number, number][] = [[cx - 95, base]];
  const spikes = 7;
  for (let i = 0; i <= spikes; i++) {
    const x = cx - 95 + (i * 190) / spikes;
    pts.push([x, base - 20 - (i % 2 ? 62 : 26) - Math.abs(i - spikes / 2) * -4]);
    if (i < spikes) pts.push([x + 190 / spikes / 2, base - 34]);
  }
  pts.push([cx + 95, base]);
  p.poly(pts, "#2a201a", 5);
};
/** a pulled nail with a drip of... nothing (he feels no pain) — just the nail */
const fxNail = (p: Pen) => {
  p.poly([[140, 40], [160, 40], [152, 190], [148, 190]], "#b9bec7", 4);
  p.ell(150, 38, 26, 9, "#9aa0ab", 4);
};
/** phone with a charging bolt */
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
    const walking = f < 67 || f >= 80;
    const view = viewOf(cam, x, z, 1, 0);
    const phase = q(((x + 4.2) / 1.4) % 1, 120);
    const expr: Expr = f >= 67 ? "smile" : "neutral";
    out.places.push(person(cam, hero, x, D0, z, view,
      { phase, mode: walking ? "march" : "stand", expr, blink: blink(1) },
      { phase, mode: walking ? "march" : "stand", expr, blink: blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, x, D0, z);
    if (f >= 67 && f < 95) stars(x, D0 + 2.25, z, 1);
  } else if (id === 2) {
    const x = ROOM[0] + heroX2(f), z = ROOM[2] + 0.6;
    const rel = f - 122, walking = rel < 38 || rel >= 52;
    const view = viewOf(cam, x, z, 1, 0);
    const phase = q(((x - ROOM[0] + 3.6) / 1.4) % 1, 120);
    const expr: Expr = rel >= 38 ? "smile" : "neutral";
    out.places.push(person(cam, hero, x, D0, z, view,
      { phase, mode: walking ? "march" : "stand", expr, blink: blink(1) },
      { phase, mode: walking ? "march" : "stand", expr, blink: blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, x, D0, z);
    if (rel >= 38 && rel < 66) stars(x, D0 + 2.25, z, 2);
  } else if (id === 3) {
    const hx = WARUNG[0] - 0.95, hz = WARUNG[2] + 0.2;
    const expr: Expr = f < 312 ? "neutral" : f < 346 ? "grin" : "smile";
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr, blink: blink(1), facing: 1 }, {}));
    blob(out, cam, hx, D0, hz);
    const sx = WARUNG[0] + 0.95, sz = WARUNG[2] + 1.35;
    const sexpr: Expr = f < 371 ? "smile" : "nervous";
    out.places.push(person(cam, { i: 3, o: SELLER, okey: "seller" }, sx, D0, sz, { side: false, mirror: false },
      { mode: "stand", expr: sexpr, blink: blink(3), facing: -1 }, {}));
    blob(out, cam, sx, D0, sz);
  } else if (id === 4) {
    const hx = DAPUR[0] + 0.5, hz = DAPUR[2] + 0.25;
    const rumble = f >= 555;
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: rumble ? "smile" : "neutral", blink: blink(1), headTilt: rumble ? 10 : 4 }, {}));
    blob(out, cam, hx, D0, hz);
    // pan smoke: two looping puffs above the stove (pan at DAPUR + (1.15, ~0.95, 1.1))
    for (let k = 0; k < 2; k++) {
      const u = q(((t * 0.55 + k * 0.5) % 1), 30);
      out.fx.push({ key: `puff${k}${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x: DAPUR[0] + 1.15 + (k ? 0.12 : -0.1), y: D0 + 1.35 + u * 0.7, z: DAPUR[2] + 1.1, w: 0.55 + u * 0.5, h: 0.55 + u * 0.5, soft: true });
    }
    if (rumble) {
      const u = q((t * 1.4) % 1, 30);
      out.fx.push({ key: `rumble${u}`, cw: 300, ch: 240, draw: (p) => fxRumble(p, u), x: hx + 0.55, y: D0 + 1.55, z: hz, w: 0.85, h: 0.68 });
    }
  } else if (id === 5) {
    const hx = LAPANGAN[0], hz = LAPANGAN[2] + 1;
    if (f < 680) {
      // sitting, pulling the nail out (pull lands f646)
      const pulled = f >= 646;
      out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
        { mode: "sit", expr: pulled ? "grin" : "neutral", blink: blink(1), headTilt: pulled ? 0 : 8 }, {}));
      if (f >= 620 && f < 700)
        out.fx.push({ key: "nail", cw: 300, ch: 260, draw: fxNail, x: hx + 0.42, y: D0 + 0.35 + (pulled ? 0.25 : 0), z: hz + 0.25, w: 0.42, h: 0.36, rot: pulled ? 0.5 : 0 });
    } else {
      const hop = f >= 711 && f < 722 ? 0.14 * Math.sin(((f - 711) / 11) * Math.PI) : 0;
      out.places.push(person(cam, hero, hx, D0 + hop, hz, { side: false, mirror: false },
        { mode: "stand", expr: "grin", blink: blink(1) }, {}));
      blob(out, cam, hx, D0, hz);
    }
  } else if (id === 6) {
    const hx = ROOM[0], hz = ROOM[2] + 0.6;
    const dead = f >= 887;
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: dead ? "neutral" : "smile", blink: blink(1) }, {}));
    blob(out, cam, hx, D0, hz);
    const u = q((t * 6) % 1, 30);
    out.fx.push({ key: `alarm${dead ? "dead" : u}`, cw: 300, ch: 300, draw: (p) => fxAlarm(p, u, dead),
      x: hx, y: D0 + 1.18, z: hz - 0.12, w: 0.62, h: 0.62, rot: dead ? 0.12 : Math.sin(u * Math.PI * 2) * 0.06 });
  } else if (id === 7) {
    const hz = STREET[2] - 0.8;
    if (f < 945) {
      const x = STREET[0] - 3.2 + ((f - 934) / 11) * 2.6;
      const view = viewOf(cam, x, hz, 1, 0);
      const phase = q(((x + 3.2) / 1.4) % 1, 120);
      out.places.push(person(cam, hero, x, D0, hz, view,
        { phase, mode: "march", expr: "neutral", blink: blink(1) },
        { phase, mode: "march", expr: "neutral", blink: blink(1), stomp: 0.9, stride: view.fs }));
      blob(out, cam, x, D0, hz);
    } else if (f < 977) {
      const x = STREET[0] + 0.2;
      out.places.push(person(cam, hero, x, D0, hz, { side: false, mirror: false },
        { mode: "fall", expr: "dazed", blink: blink(1) }, {}));
      out.places[out.places.length - 1].roll = -1.35; // knocked flat on the road
      stars(x + 1.2, D0 + 0.8, hz, 7);
    } else {
      const x = STREET[0] + 0.2;
      out.places.push(person(cam, hero, x, D0, hz, { side: false, mirror: false },
        { mode: "stand", expr: "smile", blink: blink(1) }, {}));
      blob(out, cam, x, D0, hz);
    }
  } else if (id === 8) {
    // friend on the roof behind the hero: pushes him off the front edge, then looks down in shock
    const fx2 = ATAP[0] - 0.7, fz = ATAP[2] - 1.2, roofZ = ATAP[2] - 2.2, fallZ = ATAP[2] - 4.6;
    const pushing = f >= 1081 && f < 1095;
    out.places.push(person(cam, { i: 8, o: FRIEND, okey: "friend" }, fx2, ROOF_Y, fz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 1142 ? "shock" : "grin", blink: blink(8), tilt: pushing ? 6 : 0, headTilt: f >= 1095 ? 14 : 0, facing: 1 }, {}));
    blob(out, cam, fx2, ROOF_Y, fz);
    // hero: on roof -> falling in front of the facade -> landed -> stands dazed
    if (f < 1085) {
      out.places.push(person(cam, hero, ATAP[0] + 0.4, ROOF_Y, roofZ, { side: false, mirror: false },
        { mode: "stand", expr: "smile", blink: blink(1) }, {}));
      blob(out, cam, ATAP[0] + 0.4, ROOF_Y, roofZ);
    } else if (f < 1142) {
      const x = ATAP[0] + fallX(f), y = fallY(f);
      out.places.push(person(cam, hero, x, y, fallZ, { side: false, mirror: false },
        { mode: "fall", expr: "shock", blink: blink(1) }, {}));
    } else if (f < 1166) {
      const x = ATAP[0] + fallX(f);
      out.places.push(person(cam, hero, x, D0, fallZ, { side: false, mirror: false },
        { mode: "fall", expr: "dazed", blink: blink(1) }, {}));
      out.places[out.places.length - 1].roll = 1.35; // flat on the ground after the landing (head toward +x for this camera)
      stars(x + 1.7, D0 + 0.8, fallZ, 8);
      const u = q(((f - 1142) / 24), 30);
      if (u < 1) out.fx.push({ key: `landpuff${u}`, cw: 300, ch: 300, draw: (p) => fxPuff(p, u), x, y: D0 + 0.4, z: fallZ, w: 1.4, h: 1.0, soft: true });
    } else {
      const x = ATAP[0] + fallX(f);
      const look = f >= 1225 ? Math.round(Math.sin((f - 1225) * 0.12)) : 0;
      out.places.push(person(cam, hero, x, D0, fallZ, { side: false, mirror: false },
        { mode: "stand", expr: f >= 1225 ? "neutral" : "dazed", blink: blink(1), look }, {}));
      blob(out, cam, x, D0, fallZ);
      if (f < 1230) stars(x, D0 + 2.25, fallZ, 8);
    }
  } else if (id === 9) {
    const hx = ROOM[0] + 1.1, hz = ROOM[2] - 0.4; // in front of the table, by the charger cable
    const shocking = f >= 1298 && f < 1312;
    const jx = shocking ? Math.sin(f * 2.7) * 0.07 : 0;
    const expr: Expr = f < 1298 ? "neutral" : f < 1330 ? "shock" : "smile";
    out.places.push(person(cam, hero, hx + jx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr, blink: blink(1) }, {}));
    blob(out, cam, hx, D0, hz);
    if (shocking) {
      const u = 0.35 + 0.65 * q((t * 8) % 1, 30);
      out.fx.push({ key: `sparks${u}`, cw: 300, ch: 300, draw: (p) => fxSparks(p, u), x: hx + 0.45, y: D0 + 1.0, z: hz, w: 1.4, h: 1.4 });
    }
    if (f >= 1337) out.fx.push({ key: "hairspike", cw: 300, ch: 240, draw: fxHairSpike, x: hx, y: D0 + 1.84, z: hz, w: 0.7, h: 0.56 });
    if (f >= 1404) out.fx.push({ key: "phone", cw: 300, ch: 280, draw: fxPhone, x: hx + 0.42, y: D0 + 0.98, z: hz - 0.05, w: 0.38, h: 0.35, rot: -0.1 });
  } else if (id === 10) {
    const hx = XRAY[0] - 0.95, hz = XRAY[2] + 0.5;
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: "neutral", blink: blink(1), tilt: f >= 1636 ? 3 : 0, facing: 1 }, {}));
    blob(out, cam, hx, D0, hz);
    const dx = XRAY[0] + 1.0, dz = XRAY[2] + 0.8;
    const dexpr: Expr = f < 1511 ? "neutral" : f < 1600 ? "shock" : "nervous";
    out.places.push(person(cam, { i: 10, o: DOCTOR, okey: "doctor" }, dx, D0, dz, { side: false, mirror: false },
      { mode: "stand", expr: dexpr, blink: blink(10), facing: -1 }, {}));
    blob(out, cam, dx, D0, dz);
    // highlight rings on the xray screen as each count lands (screen at XRAY + (0, ~1.9, 2.2))
    const rings: [number, number, number][] = [[1511, -0.55, 2.3], [1544, 0.35, 1.75], [1576, 0.15, 1.15]];
    for (const [f0, ox, oy] of rings) {
      if (f < f0) continue;
      const u = q(Math.min(1, (f - f0) / 18), 30);
      out.fx.push({ key: `ring${f0}${u}`, cw: 300, ch: 300, draw: (p) => fxRing(p, u), x: XRAY[0] + ox, y: D0 + oy, z: XRAY[2] + 2.05, w: 0.85, h: 0.85 });
    }
  } else if (id === 11) {
    const hx = TAMAN[0] - 0.75, hz = TAMAN[2];
    const cracked = f >= 1822;
    out.places.push(person(cam, hero, hx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: cracked ? "dazed" : "smile", blink: blink(1), facing: 1, headTilt: cracked ? 8 : 0 }, {}));
    blob(out, cam, hx, D0, hz);
    const gx = TAMAN[0] + 0.75;
    out.places.push(person(cam, { i: 11, o: GIRL, okey: "girl" }, gx, D0, hz, { side: false, mirror: false },
      { mode: "stand", expr: "smile_closed", blink: blink(11), facing: -1 }, {}));
    blob(out, cam, gx, D0, hz);
    const bob = Math.sin(t * 1.6) * 0.06;
    out.fx.push({ key: `heart${cracked ? "c" : "w"}`, cw: 300, ch: 300, draw: (p) => fxHeart(p, cracked),
      x: hx, y: D0 + 2.55 + bob, z: hz, w: 0.55, h: 0.55, rot: cracked ? 0.1 : 0 });
  }
  return out;
};
