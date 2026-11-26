// Timeline of "Di Dunia Ini Kamu Bisa Terbang": 10 shots timed to the AI Studio voice
// (dunia-bisa-terbang/voice/words.json, 57.69 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (langit 0, jalan 40, rumah 80, tamu 120),
// ground level y = D0 = 6 (same convention as molasses build.ts). Sky shots fly at y ~ D0 + 7.4.
export const FPS = 30;
export const TOTAL = 1746; // 57.69 s voice x 30 fps = 1731 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const LANGIT: V3 = [0, D0, 0];
export const JALAN: V3 = [40, D0, 0];
export const RUMAH: V3 = [80, D0, 0];
export const TAMU: V3 = [120, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 220, light: "day" },      // langit pagi: "bisa terbang" (f50), "lompat" (f155), "melayang" (f191)
  { id: 2, a: 220, b: 391, light: "day" },    // jalanan kosong: "kosong" (f236), "lampu merah" (f361)
  { id: 3, a: 391, b: 595, light: "day" },    // langit macet: "pindah tempat" (f422), "pelan-pelan" (f529), "antre" (f563)
  { id: 4, a: 595, b: 757, light: "day" },    // nabrak di udara: "nabrak" (f610), "malu" (f682), "pura-pura nggak lihat" (f711)
  { id: 5, a: 757, b: 944, light: "day" },    // burung minggir: "minggir" (f776), "main hape" (f912)
  { id: 6, a: 944, b: 1107, light: "day" },   // hujan deras: "hujan" (f993), "berteduh" (f1079)
  { id: 7, a: 1107, b: 1262, light: "day" },  // basah kuyup: "basah kuyup" (f1121), "payung" (f1172), "segala arah" (f1229)
  { id: 8, a: 1262, b: 1430, light: "day" },  // mendarat basah: "mendarat" (f1273), "basah total" (f1295), "kehujanan" (f1397)
  { id: 9, a: 1430, b: 1580, light: "day" },  // ruang tamu: "selesai" (f1487), "tagihan listrik" (f1531)
  { id: 10, a: 1580, b: TOTAL, light: "day" }, // punchline: "Hujan" (f1665), "Tagihan" (f1713)
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

// hero x in shot 1: cruises across the sky +x the whole shot
export const heroX1 = (f: number) => -2.6 + (f / 220) * 4.4;
// hero x in shot 3: stuck in the sky queue, creeping +x very slowly
export const heroX3 = (f: number) => -1.2 + ((f - 391) / 204) * 1.1;
// bump pair in shot 4: A flies +x, B flies -x; they meet at f610, bounce back, drift apart
export const bumpA = (f: number) => (f < 610 ? -2.2 + ((f - 595) / 15) * 1.6 : -0.6 - Math.min(1, (f - 610) / 40) * 0.75 + Math.max(0, (f - 680) / 77) * 0.2);
export const bumpB = (f: number) => (f < 610 ? 2.2 - ((f - 595) / 15) * 1.6 : 0.6 + Math.min(1, (f - 610) / 40) * 0.75 - Math.max(0, (f - 680) / 77) * 0.2);
// hero y in shot 8: descends from the sky f1262-1330, lands on the path
export const landY8 = (f: number) => (f < 1330 ? D0 + 5.6 * (1 - smooth((f - 1262) / 68)) : D0);
// hero x in shot 8: glides in from the left while descending
export const landX8 = (f: number) => (f < 1330 ? -2.2 + smooth((f - 1262) / 68) * 2.2 : 0);

const L = LANGIT, J = JALAN, R = RUMAH, T = TAMU;
// shot 1: sky MS, crane up with the cruisers, punch on "lompat" f155
const S1a = (f: number) => dolly([L[0] - 0.6, D0 + 7.0, L[2] + 11.0], [L[0] - 0.9, D0 + 7.3, L[2]], pushK(f, 0, 0.0006), { fov: 44 });
const S1b = (f: number) => dolly([L[0] + 0.6, D0 + 7.6, L[2] + 10.6], [L[0] + 0.8, D0 + 7.35, L[2]], pushK(f, 150, 0.0008, 0.002, 30), { fov: 44 });
// shot 2: empty street wide, push toward the traffic light on "lampu merah" f361
const S2a = (f: number) => dolly([J[0] - 1.2, D0 + 2.3, J[2] + 10.0], [J[0] + 0.2, D0 + 3.0, J[2] - 1.0], pushK(f, 220, 0.0008), { fov: 44 });
const S2b = (f: number) => dolly([J[0] + 0.6, D0 + 2.9, J[2] + 9.0], [J[0] + 1.3, D0 + 3.2, J[2] - 1.0], pushK(f, 350, 0.001, 0.0025, 30), { fov: 42 });
// shot 3: sky queue MS, punch on "pelan-pelan" f529
const S3a = (f: number) => dolly([L[0] - 0.5, D0 + 7.6, L[2] + 11.5], [L[0] - 0.2, D0 + 7.3, L[2]], pushK(f, 391, 0.0006), { fov: 44 });
const S3b = (f: number) => dolly([L[0] + 0.3, D0 + 7.4, L[2] + 10.8], [L[0], D0 + 7.25, L[2]], pushK(f, 520, 0.0008, 0.002, 30), { fov: 44 });
// shot 4: mid-air bump, punch on the contact f610
const S4a = (f: number) => dolly([L[0], D0 + 7.5, L[2] + 11.0], [L[0], D0 + 7.3, L[2]], pushK(f, 595, 0.0006), { fov: 44 });
const S4b = (f: number) => dolly([L[0] + 0.1, D0 + 7.4, L[2] + 10.4], [L[0], D0 + 7.28, L[2]], pushK(f, 600, 0.0008, 0.0025, 24), { fov: 42 });
// shot 5: birds give way, punch on "main hape" f912
const S5a = (f: number) => dolly([L[0] - 0.4, D0 + 7.7, L[2] + 11.0], [L[0] - 0.2, D0 + 7.35, L[2]], pushK(f, 757, 0.0006), { fov: 44 });
const S5b = (f: number) => dolly([L[0] + 0.4, D0 + 7.5, L[2] + 10.4], [L[0] + 0.4, D0 + 7.3, L[2]], pushK(f, 900, 0.0008, 0.002, 30), { fov: 44 });
// shot 6: rain hits, punch on "hujan" f993
const S6a = (f: number) => dolly([L[0], D0 + 7.6, L[2] + 11.0], [L[0], D0 + 7.3, L[2]], pushK(f, 944, 0.0006), { fov: 44 });
const S6b = (f: number) => dolly([L[0] + 0.2, D0 + 7.4, L[2] + 10.4], [L[0] + 0.1, D0 + 7.28, L[2]], pushK(f, 990, 0.0008, 0.002, 30), { fov: 42 });
// shot 7: soaked + inverted umbrella, punch on "payung" f1172
const S7a = (f: number) => dolly([L[0] - 0.2, D0 + 7.5, L[2] + 10.8], [L[0] + 0.2, D0 + 7.3, L[2]], pushK(f, 1107, 0.0006), { fov: 44 });
const S7b = (f: number) => dolly([L[0] + 0.3, D0 + 7.35, L[2] + 10.2], [L[0] + 0.3, D0 + 7.28, L[2]], pushK(f, 1160, 0.0008, 0.002, 30), { fov: 42 });
// shot 8: landing in front of the house, camera tilts down with him
const S8a = (f: number) => dolly([R[0], D0 + 3.2, R[2] + 8.6], [R[0], D0 + 2.2, R[2]], pushK(f, 1262, 0.0026), { fov: 42 });
const S8b = (f: number) => dolly([R[0] + 0.3, D0 + 1.9, R[2] + 7.2], [R[0] + 0.2, D0 + 1.2, R[2]], pushK(f, 1330, 0.003, 0.005, 30), { fov: 40 });
// shot 9: living room MS, punch on "tagihan listrik" f1531
const S9a = (f: number) => dolly([T[0] - 0.2, D0 + 1.9, T[2] - 7.6], [T[0] - 0.4, D0 + 1.15, T[2] + 0.4], pushK(f, 1430, 0.001), { fov: 42 });
const S9b = (f: number) => dolly([T[0] - 0.1, D0 + 1.75, T[2] - 6.8], [T[0] - 0.4, D0 + 1.05, T[2] + 0.5], pushK(f, 1520, 0.001, 0.002, 30), { fov: 42 });
// shot 10: living room, slow push to the punchline (picture moving to the last frame)
const S10a = (f: number) => dolly([T[0] - 0.3, D0 + 1.9, T[2] - 7.0], [T[0] - 0.45, D0 + 1.2, T[2] + 0.45], pushK(f, 1580, 0.0008), { fov: 40 });
const S10b = (f: number) => dolly([T[0] - 0.2, D0 + 1.8, T[2] - 6.2], [T[0] - 0.45, D0 + 1.15, T[2] + 0.45], pushK(f, 1700, 0.001, 0.002, 30), { fov: 40 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 150, dur: 26, s: S1b }],
  2: [{ f: 220, s: S2a }, { f: 350, dur: 28, s: S2b }],
  3: [{ f: 391, s: S3a }, { f: 520, dur: 28, s: S3b }],
  4: [{ f: 595, s: S4a }, { f: 600, dur: 24, s: S4b }],
  5: [{ f: 757, s: S5a }, { f: 900, dur: 28, s: S5b }],
  6: [{ f: 944, s: S6a }, { f: 990, dur: 28, s: S6b }],
  7: [{ f: 1107, s: S7a }, { f: 1160, dur: 28, s: S7b }],
  8: [{ f: 1262, s: S8a }, { f: 1330, dur: 30, s: S8b }],
  9: [{ f: 1430, s: S9a }, { f: 1520, dur: 28, s: S9b }],
  10: [{ f: 1580, s: S10a }, { f: 1700, dur: 30, s: S10b }],
};

// impact kicks: 7-frame sign-flipping offsets on the mid-air bump and the punchline
const KICKS: [number, number][] = [[610 / FPS, 0.7], [1713 / FPS, 0.5]];

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
