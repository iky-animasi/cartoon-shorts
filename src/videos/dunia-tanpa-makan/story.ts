// Timeline of "Di Dunia Ini Kamu Nggak Perlu Makan": 9 shots timed to the AI Studio voice
// (dunia-tanpa-makan/voice/words.json, 59.03 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (dapur 0, kantor 40, jalan 80, kamar 120, malam 160,
// warung luar 200, warung dalam 240), ground level y = D0 = 6 (same convention as molasses build.ts).
export const FPS = 30;
export const TOTAL = 1786; // 59.03 s voice x 30 fps = 1771 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const DAPUR: V3 = [0, D0, 0];
export const KANTOR: V3 = [40, D0, 0];
export const JALAN: V3 = [80, D0, 0];
export const KAMAR: V3 = [120, D0, 0];
export const MALAM: V3 = [160, D0, 0];
export const LUAR: V3 = [200, D0, 0];
export const DALAM: V3 = [240, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 266, light: "day" },      // dapur pagi: "nggak perlu makan" (f47), "langsung berangkat" (f199), "tanpa sarapan" (f215)
  { id: 2, a: 266, b: 439, light: "day" },    // kantor: "nggak ada lagi jam makan siang" (f297), "semua kerja terus" (f347)
  { id: 3, a: 439, b: 600, light: "day" },    // jalanan: "warung-warung mulai tutup" (f453), "nggak ada yang butuh makan" (f547)
  { id: 4, a: 600, b: 856, light: "golden" }, // kamar malam: "kamu kangen" (f629), "kangen pedas" (f752), "kangen gurih" (f785), "kangen manis" (f818)
  { id: 5, a: 856, b: 1048, light: "golden" }, // jalanan malam: "keliling kota" (f886), "nyari satu warung" (f928), "kebanyakan sudah tutup" (f986)
  { id: 6, a: 1048, b: 1235, light: "golden" }, // depan warung: "nemu satu warung indomie" (f1065), "lampunya nyala" (f1153), "di dalamnya rame" (f1201)
  { id: 7, a: 1235, b: 1412, light: "golden" }, // dalam warung: "kamu masuk" (f1235), "makan pelan-pelan" (f1298), "ngobrol dan ketawa" (f1355)
  { id: 8, a: 1412, b: 1590, light: "golden" }, // dalam warung: "kamu pesan satu" (f1412), "bukan karena lapar" (f1454), "bareng orang-orang" (f1550)
  { id: 9, a: 1590, b: TOTAL, light: "golden" }, // punchline: "warung indomie tetap rame" (f1636), "tapi karena kangen" (f1714)
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** hard cuts between shots (no crossfade layers) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- camera ----------------
// Same grammar as molasses / episodes 1-7: symmetric smootherstep glides, slow push-ins on holds, punches on key words.
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

// hero x in shot 1: leaves the empty breakfast table and heads out the kitchen door
export const heroX1 = (f: number) => (f < 166 ? 0.6 : 0.6 - smooth((f - 166) / 90) * 3.8);
// hero x in shot 3: walks past the shuttered stalls
export const heroX3 = (f: number) => -2.4 + ((f - 439) / 161) * 4.6;
// hero x in shot 5: night search across town
export const heroX5 = (f: number) => -2.6 + ((f - 856) / 192) * 4.5;
// hero x in shot 6: stops in front of the lit warung, then steps toward the door
export const heroX6 = (f: number) => (f < 1153 ? -1.8 + smooth((f - 1048) / 60) * 1.2 : -0.6 + smooth((f - 1153) / 70) * 0.9);
// thought-bubble pop-in scale (same helper as episode 7)
export const popIn = (f: number, f0: number) => {
  const u = clamp01((f - f0) / 10);
  return u <= 0 ? 0 : 1 + Math.sin(u * Math.PI) * 0.18 * (1 - u);
};

const D = DAPUR, O = KANTOR, J = JALAN, K = KAMAR, M = MALAM, L = LUAR, W = DALAM;
// shot 1: kitchen MS, hero leaves without breakfast; punch on "langsung berangkat" f199
const S1a = (f: number) => dolly([D[0] + 0.2, D0 + 1.9, D[2] - 8.0], [D[0] + 0.1, D0 + 1.3, D[2] + 0.3], pushK(f, 0, 0.0014), { fov: 44 });
const S1b = (f: number) => dolly([D[0] - 0.2, D0 + 1.75, D[2] - 7.2], [D[0] - 0.4, D0 + 1.25, D[2] + 0.3], pushK(f, 195, 0.0014, 0.003, 30), { fov: 44 });
// shot 2: office, everyone works through lunch; punch on "semua kerja terus" f347
const S2a = (f: number) => dolly([O[0] + 0.0, D0 + 1.9, O[2] - 8.4], [O[0] - 0.1, D0 + 1.3, O[2] + 0.3], pushK(f, 266, 0.0012), { fov: 44 });
const S2b = (f: number) => dolly([O[0] + 0.15, D0 + 1.75, O[2] - 7.6], [O[0] - 0.05, D0 + 1.25, O[2] + 0.3], pushK(f, 340, 0.0012, 0.003, 30), { fov: 44 });
// shot 3: shuttered stalls on an empty street; punch on "mulai tutup" f482
const S3a = (f: number) => dolly([J[0] - 0.4, D0 + 1.9, J[2] + 8.8], [J[0] - 0.2, D0 + 1.3, J[2]], pushK(f, 439, 0.0016), { fov: 44 });
const S3b = (f: number) => dolly([J[0] + 0.4, D0 + 1.75, J[2] + 7.8], [J[0] + 0.3, D0 + 1.25, J[2]], pushK(f, 478, 0.0016, 0.003, 30), { fov: 42 });
// shot 4: bedroom at night, food thoughts drift by; punch on "kangen rasa" f713
const S4a = (f: number) => dolly([K[0] + 0.2, D0 + 1.85, K[2] - 7.8], [K[0] + 0.1, D0 + 1.3, K[2] + 0.3], pushK(f, 600, 0.0012), { fov: 44 });
const S4b = (f: number) => dolly([K[0] + 0.3, D0 + 1.7, K[2] - 7.0], [K[0] + 0.15, D0 + 1.25, K[2] + 0.3], pushK(f, 708, 0.0012, 0.003, 30), { fov: 44 });
// shot 5: night street search; punch on "kebanyakan sudah tutup" f986
const S5a = (f: number) => dolly([M[0] - 0.5, D0 + 2.0, M[2] + 9.0], [M[0] - 0.3, D0 + 1.3, M[2]], pushK(f, 856, 0.0016), { fov: 44 });
const S5b = (f: number) => dolly([M[0] + 0.6, D0 + 1.8, M[2] + 7.8], [M[0] + 0.6, D0 + 1.25, M[2]], pushK(f, 980, 0.0016, 0.003, 30), { fov: 42 });
// shot 6: the one lit warung; punch on "lampunya nyala" f1153
const S6a = (f: number) => dolly([L[0] - 0.4, D0 + 1.9, L[2] + 8.8], [L[0] + 0.1, D0 + 1.35, L[2]], pushK(f, 1048, 0.0016), { fov: 44 });
const S6b = (f: number) => dolly([L[0] + 0.3, D0 + 1.75, L[2] + 7.6], [L[0] + 0.3, D0 + 1.3, L[2]], pushK(f, 1148, 0.0016, 0.003, 30), { fov: 42 });
// shot 7: inside the warung, everyone eating slowly; punch on "ketawa" f1380
const S7a = (f: number) => dolly([W[0] + 0.1, D0 + 1.9, W[2] - 8.2], [W[0] + 0.15, D0 + 1.3, W[2] + 0.3], pushK(f, 1235, 0.0012), { fov: 44 });
const S7b = (f: number) => dolly([W[0] + 0.25, D0 + 1.75, W[2] - 7.4], [W[0] + 0.2, D0 + 1.25, W[2] + 0.3], pushK(f, 1372, 0.0012, 0.003, 30), { fov: 44 });
// shot 8: hero orders one and sits with everyone; punch on "bareng orang-orang" f1550
const S8a = (f: number) => dolly([W[0] + 0.15, D0 + 1.85, W[2] - 7.8], [W[0] + 0.2, D0 + 1.28, W[2] + 0.3], pushK(f, 1412, 0.0012), { fov: 44 });
const S8b = (f: number) => dolly([W[0] + 0.3, D0 + 1.7, W[2] - 7.1], [W[0] + 0.25, D0 + 1.22, W[2] + 0.3], pushK(f, 1542, 0.0012, 0.003, 30), { fov: 44 });
// shot 9: punchline, slow push to the last frame (steam and fan keep moving)
const S9a = (f: number) => dolly([W[0] + 0.2, D0 + 1.85, W[2] - 7.6], [W[0] + 0.25, D0 + 1.28, W[2] + 0.3], pushK(f, 1590, 0.001), { fov: 44 });
const S9b = (f: number) => dolly([W[0] + 0.3, D0 + 1.75, W[2] - 6.9], [W[0] + 0.3, D0 + 1.24, W[2] + 0.3], pushK(f, 1708, 0.0012, 0.003, 30), { fov: 42 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 195, dur: 28, s: S1b }],
  2: [{ f: 266, s: S2a }, { f: 340, dur: 28, s: S2b }],
  3: [{ f: 439, s: S3a }, { f: 478, dur: 28, s: S3b }],
  4: [{ f: 600, s: S4a }, { f: 708, dur: 28, s: S4b }],
  5: [{ f: 856, s: S5a }, { f: 980, dur: 28, s: S5b }],
  6: [{ f: 1048, s: S6a }, { f: 1148, dur: 28, s: S6b }],
  7: [{ f: 1235, s: S7a }, { f: 1372, dur: 28, s: S7b }],
  8: [{ f: 1412, s: S8a }, { f: 1542, dur: 28, s: S8b }],
  9: [{ f: 1590, s: S9a }, { f: 1708, dur: 30, s: S9b }],
};

// impact kicks: 7-frame sign-flipping offsets on finding the warung and the punchline
const KICKS: [number, number][] = [[1089 / FPS, 0.4], [1714 / FPS, 0.55]];

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
