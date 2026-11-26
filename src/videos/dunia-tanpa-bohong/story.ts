// Timeline of "Di Dunia Ini Kamu Nggak Bisa Bohong": 10 shots timed to the AI Studio voice
// (dunia-tanpa-bohong/voice/words.json, 61.81 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (jalan 0, kamar 40, kantor 80, halte 120, kafe 160,
// sore 200), ground level y = D0 = 6 (same convention as molasses build.ts).
export const FPS = 30;
export const TOTAL = 1869; // 61.81 s voice x 30 fps = 1854 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const JALAN: V3 = [0, D0, 0];
export const KAMAR: V3 = [40, D0, 0];
export const KANTOR: V3 = [80, D0, 0];
export const HALTE: V3 = [120, D0, 0];
export const KAFE: V3 = [160, D0, 0];
export const SORE: V3 = [200, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 189, light: "day" },      // jalanan pagi: "nggak bisa bohong" (f49), "mulutmu selalu ngomong" (f118)
  { id: 2, a: 189, b: 389, light: "day" },    // kamar/cermin: teman nanya (f223), jawaban jujur (f295), teman pergi (f352)
  { id: 3, a: 389, b: 573, light: "day" },    // kantor: bos nanya (f389), "belum saya buka" (f512), bos bengong
  { id: 4, a: 573, b: 785, light: "day" },    // halte: "Tapi anehnya" (f573), "janji palsu" (f669), "OTW" (f716)
  { id: 5, a: 785, b: 952, light: "day" },    // kafe: "datang tepat waktu" (f785), "5 menit lagi" (f878), "masih mandi" (f910)
  { id: 6, a: 952, b: 1171, light: "day" },   // kafe: pacar nanya (f995), "paling berbahaya" (f1030), "gendutan nggak?" (f1097)
  { id: 7, a: 1171, b: 1334, light: "day" },  // kafe membeku: "langsung diam" (f1171), "jawaban aman" (f1262)
  { id: 8, a: 1334, b: 1529, light: "day" },  // kafe: "mau jawab nggak" (f1334), "ngomong sendiri" (f1394), "Sedikit" (f1450)
  { id: 9, a: 1529, b: 1727, light: "day" },  // kafe: pacar pergi (f1529), "jujur itu mahal" (f1615)
  { id: 10, a: 1727, b: TOTAL, light: "golden" }, // jalanan sore: punchline "Ke siapa pun" (f1825), kamera mundur
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

// hero x along the street in shot 1 (walks +x slowly the whole shot)
export const heroX1 = (f: number) => -2.4 + (f / 189) * 4.2;
// friend x in shot 2: stands by the mirror, storms off f352-389
export const temanX2 = (f: number) => (f < 352 ? 0.8 : 0.8 + ((f - 352) / 37) * 2.6);
// latecomer x in shot 4: hurries in f700-760 and stops at the bus stop
export const lateX4 = (f: number) => (f < 700 ? -2.9 : f < 760 ? -2.9 + ((f - 700) / 60) * 1.8 : -1.1);
// pacar x in shot 6: walks in f952-1005 to face the hero
export const pacarX6 = (f: number) => (f < 952 ? 4.6 : f < 1005 ? 4.6 - ((f - 952) / 53) * 3.45 : 1.15);
// pacar x in shot 9: walks away f1529-1620
export const pacarX9 = (f: number) => (f < 1529 ? 1.15 : 1.15 + ((f - 1529) / 91) * 4.2);
// hero x in shot 10: walks home f1727-1830, then stops
export const heroX10 = (f: number) => (f < 1830 ? -1.4 + ((f - 1727) / 103) * 0.9 : -0.5);

const J = JALAN, K = KAMAR, O = KANTOR, H = HALTE, C = KAFE, S = SORE;
// shot 1: street MS, tracks the walk, punch on "Mulutmu" f118
const S1a = (f: number) => dolly([J[0] - 0.4, D0 + 1.9, J[2] + 8.4], [J[0] + 0.2, D0 + 1.3, J[2]], pushK(f, 0, 0.0032), { fov: 42 });
const S1b = (f: number) => dolly([J[0] + 0.6, D0 + 1.7, J[2] + 7.2], [J[0] + 0.5, D0 + 1.25, J[2]], pushK(f, 110, 0.003, 0.006, 30), { fov: 40 });
// shot 2: bedroom MS, punch on the honest answer f295
const S2a = (f: number) => dolly([K[0] + 0.3, D0 + 1.9, K[2] - 7.2], [K[0], D0 + 1.3, K[2] + 0.3], pushK(f, 189, 0.003), { fov: 42 });
const S2b = (f: number) => dolly([K[0] + 0.4, D0 + 1.6, K[2] - 5.8], [K[0] + 0.15, D0 + 1.1, K[2] + 0.2], pushK(f, 290, 0.0026, 0.005, 30), { fov: 42 });
// shot 3: office MS, punch on "belum saya buka" f512, settle on the stunned boss
const S3a = (f: number) => dolly([O[0], D0 + 1.9, O[2] - 7.4], [O[0], D0 + 1.3, O[2] + 0.4], pushK(f, 389, 0.003), { fov: 42 });
const S3b = (f: number) => dolly([O[0] + 0.1, D0 + 1.7, O[2] - 6.2], [O[0] + 0.1, D0 + 1.25, O[2] - 0.2], pushK(f, 500, 0.0026, 0.005, 30), { fov: 42 });
// shot 4: bus stop wide, push as the latecomer hurries in, tilt to the clock side
const S4a = (f: number) => dolly([H[0] - 0.6, D0 + 2.1, H[2] + 10.5], [H[0] + 0.3, D0 + 1.2, H[2] - 0.4], pushK(f, 573, 0.0024), { fov: 44 });
const S4b = (f: number) => dolly([H[0] + 0.2, D0 + 1.9, H[2] + 9.2], [H[0] + 0.3, D0 + 1.1, H[2] - 0.4], pushK(f, 660, 0.003, 0.005, 30), { fov: 44 });
const S4c = (f: number) => dolly([H[0] + 0.3, D0 + 1.7, H[2] + 8.4], [H[0] + 0.4, D0 + 1.0, H[2] - 0.4], pushK(f, 740, 0.003, 0.005, 30), { fov: 42 });
// shot 5: cafe MS, punch on "5 menit lagi" f878
const S5a = (f: number) => dolly([C[0] + 0.4, D0 + 1.9, C[2] - 8.2], [C[0] + 0.3, D0 + 1.15, C[2]], pushK(f, 785, 0.003), { fov: 42 });
const S5b = (f: number) => dolly([C[0] + 0.45, D0 + 1.7, C[2] - 7.0], [C[0] + 0.25, D0 + 1.1, C[2]], pushK(f, 870, 0.0026, 0.006, 30), { fov: 42 });
// shot 6: cafe MS, slight pull as the pacar walks in, push on the dangerous question f1097
const S6a = (f: number) => dolly([C[0] - 0.4, D0 + 2.2, C[2] - 9.6], [C[0], D0 + 1.5, C[2]], pushK(f, 952, 0.0024), { fov: 44 });
const S6b = (f: number) => dolly([C[0] + 0.3, D0 + 1.9, C[2] - 8.2], [C[0] + 0.2, D0 + 1.4, C[2]], pushK(f, 1080, 0.003, 0.005, 32), { fov: 42 });
// shot 7: cafe frozen — camera keeps drifting (camAt), slow push only
const S7a = (f: number) => dolly([C[0] - 0.6, D0 + 1.9, C[2] - 8.6], [C[0] + 0.3, D0 + 1.25, C[2]], pushK(f, 1171, 0.0026), { fov: 42 });
const S7b = (f: number) => dolly([C[0] + 0.2, D0 + 1.7, C[2] - 7.2], [C[0] + 0.6, D0 + 1.2, C[2]], pushK(f, 1240, 0.0026), { fov: 42 });
// shot 8: cafe MS, mid pan toward the hero, punch on "Sedikit" f1450
const S8a = (f: number) => dolly([C[0], D0 + 2.0, C[2] - 7.6], [C[0], D0 + 1.35, C[2] + 0.4], pushK(f, 1334, 0.0026), { fov: 42 });
const S8m = (f: number) => dolly([C[0] - 0.3, D0 + 1.9, C[2] - 7.0], [C[0] - 0.1, D0 + 1.3, C[2] + 0.45], pushK(f, 1390, 0.0026), { fov: 42 });
const S8b = (f: number) => dolly([C[0] + 0.1, D0 + 1.8, C[2] - 6.6], [C[0] + 0.1, D0 + 1.25, C[2] + 0.5], pushK(f, 1440, 0.003, 0.005, 32), { fov: 40 });
// shot 9: same cafe, push as she leaves, back for the lonely hero
const S9a = (f: number) => dolly([C[0] + 0.2, D0 + 1.8, C[2] - 6.4], [C[0] + 0.3, D0 + 1.2, C[2] + 0.3], pushK(f, 1529, 0.003, 0.005, 30), { fov: 40 });
const S9b = (f: number) => dolly([C[0] - 0.2, D0 + 1.9, C[2] - 7.4], [C[0], D0 + 1.3, C[2] + 0.4], pushK(f, 1600, 0.0026), { fov: 42 });
// shot 10: street at dusk, slow crane out to the end (picture moving to the last frame)
const S10a = (f: number) => dolly([S[0], D0 + 1.9, S[2] + 6.8], [S[0] - 0.3, D0 + 1.35, S[2]], pushK(f, 1727, 0.0018), { fov: 40 });
const S10b = (f: number): Shot => {
  const a = S10a(1800), s = glide((f - 1800) / 69);
  const B: V3 = [S[0] + 5.0, D0 + 6.0, S[2] + 16], L2: V3 = [S[0], D0 + 1.6, S[2] - 1];
  return { pos: [0, 1, 2].map((i) => a.pos[i] + (B[i] - a.pos[i]) * s) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L2[i] - a.look[i]) * s) as V3, fov: 40 + 4 * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 110, dur: 26, s: S1b }],
  2: [{ f: 189, s: S2a }, { f: 290, dur: 26, s: S2b }],
  3: [{ f: 389, s: S3a }, { f: 500, dur: 28, s: S3b }],
  4: [{ f: 573, s: S4a }, { f: 660, dur: 28, s: S4b }, { f: 740, dur: 28, s: S4c }],
  5: [{ f: 785, s: S5a }, { f: 870, dur: 28, s: S5b }],
  6: [{ f: 952, s: S6a }, { f: 1080, dur: 28, s: S6b }],
  7: [{ f: 1171, s: S7a }, { f: 1240, dur: 28, s: S7b }],
  8: [{ f: 1334, s: S8a }, { f: 1390, dur: 30, s: S8m }, { f: 1440, dur: 28, s: S8b }],
  9: [{ f: 1529, s: S9a }, { f: 1600, dur: 28, s: S9b }],
  10: [{ f: 1727, s: S10a }, { f: 1800, cut: true, s: S10b }],
};

// impact kicks: 7-frame sign-flipping offsets on the dangerous question and the honest answer
const KICKS: [number, number][] = [[1127 / FPS, 0.6], [1450 / FPS, 0.5]];
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
