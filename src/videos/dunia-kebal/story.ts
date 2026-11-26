// Timeline of "Di Dunia Ini Kamu Kebal": 10 shots timed to the AI Studio voice
// (dunia-kebal/voice/words.json, 51.75 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (street 0, dapur 40, periksa 80, sungai 120,
// taman 160, singa 200, rumah 240), ground level y = D0 = 6 (same convention as molasses build.ts).
export const FPS = 30;
export const TOTAL = 1568; // 51.75 s voice x 30 fps = 1553 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const STREET: V3 = [0, D0, 0];
export const DAPUR: V3 = [40, D0, 0];
export const PERIKSA: V3 = [80, D0, 0];
export const SUNGAI: V3 = [120, D0, 0];
export const TAMAN: V3 = [160, D0, 0];
export const SINGA: V3 = [200, D0, 0];
export const RUMAH: V3 = [240, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 160, light: "day" },      // jalanan: bola kasti mental (kena f115)
  { id: 2, a: 160, b: 283, light: "day" },    // dapur: pisau meleset (f188), tumpul (f250)
  { id: 3, a: 283, b: 431, light: "day" },    // ruang periksa: jarum masuk (f313), bengkok (f350), dokter bingung (f397)
  { id: 4, a: 431, b: 607, light: "day" },    // jatuh dari motor (f431), bangun (f499), aspal retak (f572)
  { id: 5, a: 607, b: 743, light: "day" },    // tepi sungai: digigit buaya (f613), gigi copot (f655), kapok (f706)
  { id: 6, a: 743, b: 892, light: "day" },    // taman: ketiban pohon (f743), angkat (f799), "kayak sapu" (f847)
  { id: 7, a: 892, b: 1015, light: "day" },   // kandang singa: masuk (f892), singa mundur (f973)
  { id: 8, a: 1015, b: 1222, light: "day" },  // ruang operasi: operasi (f1120), membedah (f1171), pisau patah
  { id: 9, a: 1222, b: 1371, light: "day" },  // tiga pisau patah (f1253), dokter nyerah (f1304)
  { id: 10, a: 1371, b: TOTAL, light: "golden" }, // depan rumah malam: "omongan ibumu" (f1477), kamera mundur
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** hard cuts between shots (no crossfade layers) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- camera ----------------
// Same grammar as molasses / episode 1: symmetric smootherstep glides, slow push-ins on holds, punches on key words.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
export const glide = (u: number) => { const x = clamp01(u); return x * x * x * (x * (6 * x - 15) + 10); };
const mix = (a: Cam, b: Cam, k: number): Cam => ({
  pos: a.pos.map((v, i) => v + (b.pos[i] - v) * k) as V3, look: a.look.map((v, i) => v + (b.look[i] - v) * k) as V3,
  fov: a.fov + (b.fov - a.fov) * k, roll: a.roll + (b.roll - a.roll) * k,
});
const full = (c: Shot): Cam => ({ fov: 40, roll: 0, ...c });
const run = (keys: Key[], f: number) => {
  let cur = full(keys[0].s(f));
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    if (f < k.f) break;
    cur = k.cut ? full(k.s(f)) : mix(cur, full(k.s(f)), glide((f - k.f) / (k.dur ?? 24)));
  }
  return cur;
};
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });

// hero x along the street in shot 1 (walks +x slowly, ball hits him at f115, keeps walking)
export const heroX1 = (f: number) => -3.4 + (f / 160) * 5.2;
// hero/motor x in shot 4: ride in f431-452, hero slides to a stop at x = +0.6, stands at f499
export const fallX4 = (f: number) => (f < 431 ? -3.6 : f < 452 ? -3.6 + ((f - 431) / 21) * 3.8 : 0.2 + Math.min(1, (f - 452) / 30) * 0.4);
// tree in shot 6: falls from f743 (standing) to f775 (on the hero), lifted f799-f847
export const treeFall = (f: number) => smooth((f - 743) / 32); // 0 standing -> 1 fallen
export const treeLift = (f: number) => smooth((f - 799) / 48); // 0 on ground -> 1 on shoulder
// croc x in shot 5: lunges in f607-620, backs off f706+
export const crocX = (f: number) => (f < 620 ? 3.2 - ((f - 607) / 13) * 2.3 : f < 706 ? 0.9 : 0.9 + ((f - 706) / 37) * 2.2);
// lion x in shot 7: near the gate, backs to the corner f973+
export const lionX = (f: number) => (f < 973 ? 1.35 : 1.35 + ((f - 973) / 42) * 2.0);

const S = STREET, D = DAPUR, P = PERIKSA, G = SUNGAI, T = TAMAN, L = SINGA, R = RUMAH;
// shot 1: street MS, tracks the walk, push on the ball hit
const S1a = (f: number) => dolly([S[0] - 0.4, D0 + 1.9, S[2] + 8.4], [S[0] + 0.2, D0 + 1.3, S[2]], pushK(f, 0, 0.0032), { fov: 42 });
const S1b = (f: number) => dolly([S[0] + 0.6, D0 + 1.7, S[2] + 7.2], [S[0] + 0.5, D0 + 1.25, S[2]], pushK(f, 100, 0.003, 0.006, 30), { fov: 40 });
// shot 2: kitchen MS, push to the knife slip
const S2a = (f: number) => dolly([D[0] + 0.3, D0 + 1.9, D[2] - 7.2], [D[0], D0 + 1.3, D[2] + 0.3], pushK(f, 160, 0.003), { fov: 42 });
const S2b = (f: number) => dolly([D[0] + 0.5, D0 + 1.6, D[2] - 5.8], [D[0] + 0.3, D0 + 1.1, D[2] + 0.2], pushK(f, 230, 0.003, 0.005, 30), { fov: 38 });
// shot 3: exam room MS, push on the bent needle, settle on the doctor
const S3a = (f: number) => dolly([P[0], D0 + 1.9, P[2] - 7.4], [P[0], D0 + 1.3, P[2] + 0.4], pushK(f, 283, 0.003), { fov: 42 });
const S3b = (f: number) => dolly([P[0] + 0.1, D0 + 1.7, P[2] - 6.2], [P[0] + 0.1, D0 + 1.25, P[2] - 0.2], pushK(f, 330, 0.003, 0.005, 30), { fov: 40 });
// shot 4: street wide for the fall, push as he stands, tilt down to the cracked asphalt
const S4a = (f: number) => dolly([S[0] - 0.8, D0 + 2.1, S[2] + 10.0], [S[0], D0 + 1.2, S[2] - 0.4], pushK(f, 431, 0.0024), { fov: 44 });
const S4b = (f: number) => dolly([S[0] + 0.5, D0 + 1.8, S[2] + 8.2], [S[0] + 0.5, D0 + 1.1, S[2] - 0.4], pushK(f, 490, 0.003, 0.005, 30), { fov: 40 });
const S4c = (f: number) => dolly([S[0] + 0.8, D0 + 1.5, S[2] + 6.8], [S[0] + 0.6, D0 + 0.7, S[2] - 0.4], pushK(f, 560, 0.003, 0.005, 30), { fov: 38 });
// shot 5: riverbank MS, push on the teeth pop
const S5a = (f: number) => dolly([G[0] + 0.4, D0 + 1.9, G[2] - 8.2], [G[0] + 0.3, D0 + 1.15, G[2]], pushK(f, 607, 0.003), { fov: 42 });
const S5b = (f: number) => dolly([G[0] + 0.6, D0 + 1.7, G[2] - 6.8], [G[0] + 0.5, D0 + 1.1, G[2]], pushK(f, 640, 0.003, 0.006, 30), { fov: 40 });
// shot 6: park MS, slight pull as the tree falls, push on the lift
const S6a = (f: number) => dolly([T[0] - 0.4, D0 + 2.2, T[2] - 9.6], [T[0], D0 + 1.5, T[2]], pushK(f, 743, 0.0024), { fov: 44 });
const S6b = (f: number) => dolly([T[0] + 0.3, D0 + 1.9, T[2] - 8.2], [T[0] + 0.2, D0 + 1.4, T[2]], pushK(f, 790, 0.003, 0.005, 32), { fov: 40 });
// shot 7: cage MS through the bars, slow push as the lion retreats
const S7a = (f: number) => dolly([L[0] - 0.6, D0 + 1.9, L[2] - 8.6], [L[0] + 0.3, D0 + 1.25, L[2]], pushK(f, 892, 0.0026), { fov: 42 });
const S7b = (f: number) => dolly([L[0] + 0.2, D0 + 1.7, L[2] - 7.2], [L[0] + 0.6, D0 + 1.2, L[2]], pushK(f, 960, 0.003), { fov: 40 });
// shot 8: operating room MS, push to the scalpel
const S8a = (f: number) => dolly([P[0], D0 + 2.0, P[2] - 7.6], [P[0], D0 + 1.35, P[2] + 0.4], pushK(f, 1015, 0.0026), { fov: 42 });
const S8b = (f: number) => dolly([P[0] + 0.1, D0 + 1.8, P[2] - 6.6], [P[0] + 0.1, D0 + 1.25, P[2] + 0.5], pushK(f, 1140, 0.003, 0.005, 32), { fov: 38 });
// motion upgrade: mid-shot pan across the long S8 hold (from the hero toward the doctor)
const S8m = (f: number) => dolly([P[0] - 0.55, D0 + 1.9, P[2] - 7.0], [P[0] - 0.35, D0 + 1.3, P[2] + 0.45], pushK(f, 1080, 0.0026), { fov: 40 });
// shot 9: same room, push to the tray of broken scalpels, back for the surrender
const S9a = (f: number) => dolly([P[0] + 0.2, D0 + 1.8, P[2] - 6.4], [P[0] + 0.3, D0 + 1.2, P[2] + 0.3], pushK(f, 1222, 0.003, 0.005, 30), { fov: 40 });
const S9b = (f: number) => dolly([P[0] - 0.2, D0 + 1.9, P[2] - 7.4], [P[0], D0 + 1.3, P[2] + 0.4], pushK(f, 1290, 0.0026), { fov: 42 });
// shot 10: house front at dusk, slow crane out to the end (picture moving to the last frame)
const S10a = (f: number) => dolly([R[0], D0 + 1.9, R[2] - 6.8], [R[0], D0 + 1.35, R[2]], pushK(f, 1371, 0.0018), { fov: 40 });
const S10b = (f: number): Shot => {
  const a = S10a(1470), s = glide((f - 1470) / 98);
  const B: V3 = [R[0] + 5.0, D0 + 6.0, R[2] - 16], L2: V3 = [R[0], D0 + 1.6, R[2] + 1];
  return { pos: [0, 1, 2].map((i) => a.pos[i] + (B[i] - a.pos[i]) * s) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L2[i] - a.look[i]) * s) as V3, fov: 40 + 4 * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 100, dur: 26, s: S1b }],
  2: [{ f: 160, s: S2a }, { f: 230, dur: 26, s: S2b }],
  3: [{ f: 283, s: S3a }, { f: 330, dur: 28, s: S3b }],
  4: [{ f: 431, s: S4a }, { f: 490, dur: 28, s: S4b }, { f: 560, dur: 28, s: S4c }],
  5: [{ f: 607, s: S5a }, { f: 640, dur: 28, s: S5b }],
  6: [{ f: 743, s: S6a }, { f: 790, dur: 28, s: S6b }],
  7: [{ f: 892, s: S7a }, { f: 960, dur: 28, s: S7b }],
  8: [{ f: 1015, s: S8a }, { f: 1080, dur: 30, s: S8m }, { f: 1140, dur: 28, s: S8b }],
  9: [{ f: 1222, s: S9a }, { f: 1290, dur: 28, s: S9b }],
  10: [{ f: 1371, s: S10a }, { f: 1470, cut: true, s: S10b }],
};

// impact kicks: 7-frame sign-flipping offsets on the ball hit, motor fall, tree landing, scalpel snap
const KICKS: [number, number][] = [[115 / FPS, 0.5], [452 / FPS, 1.1], [775 / FPS, 1.0], [1190 / FPS, 0.5]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  let c = run(CAMS[id], f);
  // motion upgrade: gentle continuous drift so no shot is ever dead still —
  // slow look sway (pan/tilt breathing) + a micro-orbit of the camera around the look point
  const t = f / FPS;
  const swx = Math.sin(t * 0.45 + id * 1.3) * 0.055, swy = Math.sin(t * 0.32 + id * 2.1) * 0.035;
  const orb = Math.sin(t * 0.21 + id * 1.7) * 0.014; // ~0.8 degree max
  const dx0 = c.pos[0] - c.look[0], dz0 = c.pos[2] - c.look[2];
  const co = Math.cos(orb), si = Math.sin(orb);
  c = {
    ...c,
    pos: [c.look[0] + dx0 * co - dz0 * si, c.pos[1] + Math.sin(t * 0.26 + id) * 0.03, c.look[2] + dx0 * si + dz0 * co],
    look: [c.look[0] + swx, c.look[1] + swy, c.look[2]],
    roll: c.roll + Math.sin(t * 0.18 + id * 0.7) * 0.004,
  };
  const a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

/** DOF is OFF in the light profile; kept for interface parity with the shared post chain */
export const dofAt = (_f: number) => ({ cInf: 0, focus: undefined as ((f: number) => V3) | undefined });
