// Timeline of "Di Dunia Ini Kamu Nggak Pernah Ngantuk": 9 shots timed to the AI Studio voice
// (dunia-tanpa-ngantuk/voice/words.json, 48.36 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (kamar 0, tv 40, kantor 80, satpam 120, koridor 160,
// dapur 200, dokter 240), ground level y = D0 = 6 (same convention as molasses build.ts).
export const FPS = 30;
export const TOTAL = 1466; // 48.36 s voice x 30 fps = 1451 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const KAMAR: V3 = [0, D0, 0];
export const TV: V3 = [40, D0, 0];
export const KANTOR: V3 = [80, D0, 0];
export const SATPAM: V3 = [120, D0, 0];
export const KORIDOR: V3 = [160, D0, 0];
export const DAPUR: V3 = [200, D0, 0];
export const DOKTER: V3 = [240, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 162, light: "golden" },     // kamar malam: melek terus, jam berputar ("24 jam" f113)
  { id: 2, a: 162, b: 322, light: "day" },      // meja belajar: teman tumbang (f272)
  { id: 3, a: 322, b: 501, light: "day" },      // ruang TV: maraton series, tamat (f427), spoiler (f456)
  { id: 4, a: 501, b: 606, light: "day" },      // kantor malam: bos curiga "robot" (f579)
  { id: 5, a: 606, b: 778, light: "golden" },   // pos satpam: maling capek nunggu (f740)
  { id: 6, a: 778, b: 926, light: "day" },      // koridor gelap: bayangan (f883)
  { id: 7, a: 926, b: 1081, light: "golden" },  // dapur jam 3 pagi: ngobrol sama kulkas (f955), diam aja (f1013)
  { id: 8, a: 1081, b: 1259, light: "day" },    // ruang dokter: kolaps (f1134), "nanti aja" (f1196)
  { id: 9, a: 1259, b: TOTAL, light: "golden" }, // kasur: nungguin balasan chat (f1369), mata merem, kamera mundur
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

// hero x in the corridor (shot 6): slow walk +x
export const heroX6 = (f: number) => -2.6 + ((f - 778) / 148) * 3.4;
// maling x in shot 5: crouched in the bush, gives up and walks off f740+
export const malingX = (f: number) => (f < 740 ? 1.6 : 1.6 + ((f - 740) / 38) * 3.4);

const K = KAMAR, V = TV, O = KANTOR, P = SATPAM, C = KORIDOR, D = DAPUR, X = DOKTER;
// shot 1: bedroom MS, slow push toward the wide-awake hero + spinning clock
const S1a = (f: number) => dolly([K[0] - 0.3, D0 + 1.9, K[2] - 6.8], [K[0], D0 + 1.3, K[2] + 0.4], pushK(f, 0, 0.003), { fov: 42 });
const S1b = (f: number) => dolly([K[0] + 0.2, D0 + 1.7, K[2] - 5.6], [K[0] + 0.2, D0 + 1.3, K[2] + 0.4], pushK(f, 100, 0.003, 0.004, 30), { fov: 40 });
// shot 2: study desk MS, push as the friend slumps
const S2a = (f: number) => dolly([K[0], D0 + 1.9, K[2] - 7.2], [K[0], D0 + 1.25, K[2] + 0.5], pushK(f, 162, 0.003), { fov: 42 });
const S2b = (f: number) => dolly([K[0] + 0.2, D0 + 1.6, K[2] - 6.0], [K[0] + 0.2, D0 + 1.1, K[2] + 0.5], pushK(f, 250, 0.003, 0.005, 30), { fov: 40 });
// shot 3: TV room MS, push on "tamat"
const S3a = (f: number) => dolly([V[0] - 0.3, D0 + 1.9, V[2] - 7.4], [V[0], D0 + 1.3, V[2] + 0.5], pushK(f, 322, 0.0026), { fov: 42 });
const S3b = (f: number) => dolly([V[0] + 0.2, D0 + 1.7, V[2] - 6.2], [V[0] + 0.2, D0 + 1.25, V[2] + 0.5], pushK(f, 410, 0.003, 0.005, 30), { fov: 40 });
// shot 4: office MS, push to the boss's suspicion
const S4a = (f: number) => dolly([O[0], D0 + 1.9, O[2] - 7.4], [O[0], D0 + 1.3, O[2] + 0.4], pushK(f, 501, 0.003), { fov: 42 });
const S4b = (f: number) => dolly([O[0] + 0.15, D0 + 1.7, O[2] - 6.2], [O[0] + 0.15, D0 + 1.25, O[2] + 0.4], pushK(f, 555, 0.003, 0.006, 30), { fov: 40 });
// shot 5: guard post wide MS, slow push; maling gives up in the bush
const S5a = (f: number) => dolly([P[0] - 0.5, D0 + 2.0, P[2] - 9.4], [P[0] + 0.2, D0 + 1.3, P[2]], pushK(f, 606, 0.0024), { fov: 44 });
const S5b = (f: number) => dolly([P[0] + 0.2, D0 + 1.8, P[2] - 7.8], [P[0] + 0.3, D0 + 1.25, P[2]], pushK(f, 720, 0.0026), { fov: 42 });
// motion upgrade: mid-shot pan across the long S5 hold (toward the bush where the maling hides)
const S5m = (f: number) => dolly([P[0] + 0.4, D0 + 1.9, P[2] - 8.4], [P[0] + 0.5, D0 + 1.25, P[2] + 0.2], pushK(f, 665, 0.0024), { fov: 43 });
// shot 6: corridor MS tracking the slow walk, punch on the shadow
const S6a = (f: number) => dolly([C[0] - 0.4, D0 + 1.9, C[2] - 7.6], [C[0] + 0.2, D0 + 1.3, C[2] + 0.6], pushK(f, 778, 0.0026), { fov: 42 });
const S6b = (f: number) => dolly([C[0] + 0.6, D0 + 1.7, C[2] - 6.4], [C[0] + 0.8, D0 + 1.25, C[2] + 0.6], pushK(f, 865, 0.003, 0.006, 30), { fov: 40, roll: 0.02 });
// shot 7: kitchen MS, push toward hero + fridge
const S7a = (f: number) => dolly([D[0] - 0.2, D0 + 1.9, D[2] - 7.2], [D[0] + 0.3, D0 + 1.3, D[2] + 0.4], pushK(f, 926, 0.003), { fov: 42 });
const S7b = (f: number) => dolly([D[0] + 0.4, D0 + 1.7, D[2] - 6.0], [D[0] + 0.5, D0 + 1.25, D[2] + 0.4], pushK(f, 1000, 0.003), { fov: 40 });
// shot 8: doctor room MS, push on "kolaps", settle on the shrug
const S8a = (f: number) => dolly([X[0], D0 + 1.9, X[2] - 7.4], [X[0], D0 + 1.3, X[2] + 0.4], pushK(f, 1081, 0.003), { fov: 42 });
const S8b = (f: number) => dolly([X[0] + 0.15, D0 + 1.7, X[2] - 6.2], [X[0] + 0.15, D0 + 1.25, X[2] + 0.4], pushK(f, 1115, 0.003, 0.005, 30), { fov: 40 });
// shot 9: bed MS, very slow pull-back to the end as the eyes close (picture moving to the last frame)
const S9a = (f: number) => dolly([K[0] + 0.4, D0 + 1.8, K[2] - 5.8], [K[0] + 0.4, D0 + 1.1, K[2] + 0.6], pushK(f, 1259, 0.0016), { fov: 40 });
const S9b = (f: number): Shot => {
  const a = S9a(1360), s = glide((f - 1360) / 106);
  const B: V3 = [K[0] + 2.2, D0 + 3.2, K[2] - 10.0], L2: V3 = [K[0] + 0.4, D0 + 1.2, K[2] + 1];
  return { pos: [0, 1, 2].map((i) => a.pos[i] + (B[i] - a.pos[i]) * s) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L2[i] - a.look[i]) * s) as V3, fov: 40 + 4 * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 100, dur: 26, s: S1b }],
  2: [{ f: 162, s: S2a }, { f: 250, dur: 28, s: S2b }],
  3: [{ f: 322, s: S3a }, { f: 410, dur: 28, s: S3b }],
  4: [{ f: 501, s: S4a }, { f: 555, dur: 26, s: S4b }],
  5: [{ f: 606, s: S5a }, { f: 665, dur: 30, s: S5m }, { f: 720, dur: 28, s: S5b }],
  6: [{ f: 778, s: S6a }, { f: 865, dur: 28, s: S6b }],
  7: [{ f: 926, s: S7a }, { f: 1000, dur: 28, s: S7b }],
  8: [{ f: 1081, s: S8a }, { f: 1115, dur: 28, s: S8b }],
  9: [{ f: 1259, s: S9a }, { f: 1360, cut: true, s: S9b }],
};

// one small kick: the shadow apparition in the corridor
const KICKS: [number, number][] = [[883 / FPS, 0.7]];
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
