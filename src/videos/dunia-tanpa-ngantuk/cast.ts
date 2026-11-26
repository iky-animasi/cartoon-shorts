// Cast staging for "Di Dunia Ini Kamu Nggak Pernah Ngantuk": hero ("kamu") plus friend, boss,
// maling and doctor, flat sprites from the shared molasses toon kit. Reactions land on their
// words (words.json); positions in metres, y = D0 = 6 is the ground.
import * as THREE from "three";
import { Pool, Actor, Fx, Place, FxPlace, CamInfo, Stage } from "../molasses/cast";
import {
  Pen, bodyFront, bodySide, fxShadow, fxContact,
  Outfit, Expr, FrontOpts, SideOpts, SKINS, worker, INK,
} from "../molasses/toon";
import {
  FPS, D0, KAMAR, TV, KANTOR, SATPAM, KORIDOR, DAPUR, DOKTER,
  heroX6, malingX, smooth, clamp01,
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
const FRIEND: Outfit = { jacket: "#7b5ac9", pants: "#3b3f52", boots: "#5a3b2a", hat: "cap", cap: "#e2453c", skin: SKINS[1] };
const BOSS: Outfit = { jacket: "#2e3138", pants: "#23262b", boots: "#1d1b22", hat: "hair", hair: "#3a2e24", bowtie: "#8c3b4a", glasses: true, skin: SKINS[2] };
const SATPAM_O: Outfit = worker(1);
const MALING: Outfit = { jacket: "#33383f", pants: "#23262b", boots: "#1d1b22", hat: "cap", cap: "#1d1b22", skin: SKINS[3] };
const DOCTOR: Outfit = { jacket: "#f4f6f8", pants: "#3b3f52", boots: "#1d1b22", hat: "hair", hair: "#4a3426", glasses: true, skin: SKINS[2] };
const hero: Who = { i: 1, o: HERO, okey: "hero" };
const friend: Who = { i: 3, o: FRIEND, okey: "friend" };
const boss: Who = { i: 5, o: BOSS, okey: "boss" };
const satpam: Who = { i: 1, o: SATPAM_O, okey: "satpam" }; // same hero, work outfit
const maling: Who = { i: 7, o: MALING, okey: "maling" };
const doctor: Who = { i: 10, o: DOCTOR, okey: "doctor" };

// ---------------- custom fx drawings (design space = canvas px) ----------------
/** wall clock with hands spinning fast (u = minute-hand turns, quantized by caller) */
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
/** "Zzz" sleep bubble (u = bob phase) */
const fxZzz = (p: Pen, u: number) => {
  const bob = Math.sin(u * Math.PI * 2) * 8;
  const z = (x: number, y: number, s: number) => p.stroke([[x - s, y - s], [x + s, y - s], [x - s, y + s], [x + s, y + s]], s * 0.55, "#5a7bc9");
  z(90, 190 + bob, 18); z(140, 130 + bob * 0.7, 26); z(200, 70 + bob * 0.4, 36);
};
/** dark shadow figure for the corridor (wobbly silhouette, u = flicker phase) */
const fxShadowFig = (p: Pen, u: number) => {
  const wob = Math.sin(u * Math.PI * 2) * 6;
  const col = "rgba(24,20,38,0.92)";
  p.ell(150 + wob, 78, 52, 58, col, 0); // head
  const body: [number, number][] = [[92, 150], [208, 150], [226, 300], [74, 300]];
  p.poly(body, col, 0);
  // hollow eyes
  p.ell(132 + wob, 74, 7, 10, "#e8e4f2", 0);
  p.ell(168 + wob, 74, 7, 10, "#e8e4f2", 0);
};
/** phone with an empty chat (waiting for a reply that never comes) */
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

  if (id === 1) {
    // sitting on the bed edge, eyes wide open (blink forced off), clock spinning on the wall
    const hx = KAMAR[0] - 0.2, hz = KAMAR[2] + 0.6;
    out.places.push(person(cam, hero, hx, D0 + 0.72 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: "smile", blink: 0, headTilt: idleHead(1, 1.0), look: idleLook(1) }, {}));
    const u = q((t * 0.55) % 1, 24);
    out.fx.push({ key: `clock${u}`, cw: 300, ch: 300, draw: (p) => fxClock(p, u),
      x: KAMAR[0] + 1.5, y: D0 + 2.7, z: KAMAR[2] + 3.85, w: 0.85, h: 0.85 });
  } else if (id === 2) {
    const hx = KAMAR[0] - 0.35, hz = KAMAR[2] - 0.3;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: "smile", blink: blink(1), facing: 1, headTilt: idleHead(1), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
    // friend asleep face-down on the desk from f272 (slumps over f260-275)
    const fx2 = KAMAR[0] + 1.1, fz = KAMAR[2] + 0.7;
    const slump = smooth((f - 260) / 15);
    out.places.push(person(cam, friend, fx2, D0 + 0.45 + (slump > 0.5 ? Math.sin(t * 0.9) * 0.006 : idleBob(3)), fz, { side: false, mirror: false },
      { mode: "sit", expr: slump > 0.5 ? "smile_closed" : "neutral", blink: slump > 0.5 ? 1 : blink(3), headTilt: 6 + slump * 22 + (slump > 0.5 ? 0 : idleHead(3, 1.0)), look: slump > 0.5 ? 0 : idleLook(3) }, {}));
    if (f >= 275) {
      const u = q((t * 0.5) % 1, 30);
      out.fx.push({ key: `zzz${u}`, cw: 300, ch: 280, draw: (p) => fxZzz(p, u), x: fx2 - 0.05, y: D0 + 1.8, z: fz, w: 0.7, h: 0.65 });
    }
  } else if (id === 3) {
    const hx = TV[0] - 0.1, hz = TV[2] + 0.6;
    out.places.push(person(cam, hero, hx, D0 + 0.55 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "sit", expr: f >= 427 ? "grin" : "smile", blink: 0, headTilt: idleHead(1, 0.9), look: idleLook(1) }, {})); // eyes glued open the whole marathon
  } else if (id === 4) {
    const hx = KANTOR[0] - 0.55, hz = KANTOR[2] + 0.5;
    const typing = Math.sin(t * 9) * 0.012;
    const robot = f >= 579;
    out.places.push(person(cam, hero, hx, D0 + 0.45 + typing, hz, { side: false, mirror: false },
      { mode: "sit", expr: robot ? "neutral" : "smile", blink: blink(1), tilt: robot ? 0 : 2, headTilt: robot ? 0 : 4 + idleHead(1, 0.9), look: robot ? 0 : idleLook(1) }, {}));
    const bx = KANTOR[0] + 0.95, bz = KANTOR[2] + 0.7;
    out.places.push(person(cam, boss, bx, D0 + idleBob(5), bz, { side: false, mirror: false },
      { mode: "stand", expr: "stern", blink: blink(5), facing: -1, headTilt: (f >= 542 ? 6 : 0) + idleHead(5, 1.0), look: idleLook(5) }, {}));
    blob(out, cam, bx, D0, bz);
  } else if (id === 5) {
    const hx = SATPAM[0] - 0.8, hz = SATPAM[2];
    out.places.push(person(cam, satpam, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: "smile", blink: 0, headTilt: idleHead(1), look: idleLook(1) }, {})); // never sleeps on duty
    blob(out, cam, hx, D0, hz);
    // maling crouched in the bush; yawns, gives up at f740 and walks off
    const mx = SATPAM[0] + malingX(f), mz = SATPAM[2] + 0.35;
    if (f < 740) {
      out.places.push(person(cam, maling, mx, D0 + 0.1 + idleBob(7), mz, { side: false, mirror: false },
        { mode: "sit", expr: f >= 696 ? "dazed" : "neutral", blink: f >= 696 ? 0.7 : blink(7), headTilt: (f >= 696 ? 10 : 4) + idleHead(7, 0.9), look: idleLook(7) }, {}));
    } else {
      const view = viewOf(cam, mx, mz, 1, 0);
      const phase = q(((mx - SATPAM[0] - 1.6) / 1.4) % 1, 120);
      out.places.push(person(cam, maling, mx, D0, mz, view,
        { phase, mode: "march", expr: "dazed", blink: 0.5 },
        { phase, mode: "march", expr: "dazed", blink: 0.5, stomp: 0.9, stride: view.fs }));
      blob(out, cam, mx, D0, mz);
    }
  } else if (id === 6) {
    const hx = KORIDOR[0] + heroX6(f), hz = KORIDOR[2] + 0.6;
    const view = viewOf(cam, hx, hz, 1, 0);
    const phase = q(((hx - KORIDOR[0] + 2.6) / 1.4) % 1, 120);
    const rubbing = f >= 900;
    out.places.push(person(cam, hero, hx, D0, hz, view,
      { phase, mode: "march", expr: f >= 883 ? "shock" : "neutral", blink: rubbing ? 1 : blink(1), headTilt: rubbing ? 8 : 0 },
      { phase, mode: "march", expr: f >= 883 ? "shock" : "neutral", blink: rubbing ? 1 : blink(1), stomp: 0.9, stride: view.fs }));
    blob(out, cam, hx, D0, hz);
    // the shadow that isn't there: appears at the corridor end f883, flickers, gone by f920
    if (f >= 883 && f < 922) {
      const u = q((t * 3) % 1, 12);
      const flick = f > 905 ? (Math.sin(t * 30) > 0 ? 1 : 0) : 1;
      if (flick) out.fx.push({ key: `shadowfig${u}`, cw: 300, ch: 320, draw: (p) => fxShadowFig(p, u),
        x: KORIDOR[0] + 1.7, y: D0 + 1.05, z: KORIDOR[2] + 2.2, w: 1.1, h: 1.17 });
    }
  } else if (id === 7) {
    const hx = DAPUR[0] - 0.5, hz = DAPUR[2] + 0.3;
    const talking = Math.sin(t * 2.2) > 0;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: talking ? "grin" : "smile", blink: blink(1), facing: 1, headTilt: 4 + idleHead(1, 1.6), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
  } else if (id === 8) {
    const hx = DOKTER[0] - 0.5, hz = DOKTER[2] + 0.4;
    const shrug = f >= 1196;
    out.places.push(person(cam, hero, hx, D0 + idleBob(1), hz, { side: false, mirror: false },
      { mode: "stand", expr: shrug ? "grin" : "smile", blink: blink(1), facing: 1, tilt: shrug ? 4 : 0, headTilt: idleHead(1), look: idleLook(1) }, {}));
    blob(out, cam, hx, D0, hz);
    const dx = DOKTER[0] + 0.8, dz = DOKTER[2] + 0.6;
    const shake = f >= 1134 ? Math.round(Math.sin((f - 1134) * 0.22) * 7) : 0; // head shake, quantized
    out.places.push(person(cam, doctor, dx, D0 + idleBob(10), dz, { side: false, mirror: false },
      { mode: "stand", expr: f >= 1134 ? "nervous" : "neutral", blink: blink(10), facing: -1, headTilt: shake + idleHead(10, 0.8), look: idleLook(10) }, {}));
    blob(out, cam, dx, D0, dz);
  } else if (id === 9) {
    // lying on the bed (bed top at D0 + 0.72 in world.ts), phone up, eyes slowly closing at the end
    const hx = KAMAR[0] - 0.2, hz = KAMAR[2] + 0.6;
    const closing = clamp01((f - 1395) / 55); // 0 -> 1, fully closed by f1450
    out.places.push(person(cam, hero, hx, D0 + 0.72 + Math.sin(t * 0.9) * 0.006, hz, { side: false, mirror: false },
      { mode: "fall", expr: "neutral", blink: closing }, {})); // slow breathing as he drifts off
    out.places[out.places.length - 1].roll = 1.35; // flat on his back
    const dots = 1 + (Math.floor(t * 1.5) % 3);
    out.fx.push({ key: `phonechat${dots}`, cw: 300, ch: 280, draw: (p) => fxPhoneChat(p, dots),
      x: hx + 1.45, y: D0 + 1.3, z: hz - 0.05, w: 0.4, h: 0.37, rot: 0.12 });
    if (closing > 0.6) {
      const u = q((t * 0.5) % 1, 30);
      out.fx.push({ key: `zzz9${u}`, cw: 300, ch: 280, draw: (p) => fxZzz(p, u), x: hx + 1.1, y: D0 + 1.6, z: hz, w: 0.6, h: 0.56 });
    }
  }
  return out;
};
