// Timeline of "Di Dunia Ini Kamu Nggak Bisa Merasa Sakit": 11 shots timed to the AI Studio voice
// (dunia-tanpa-sakit/voice/words.json, 62.74 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (street 0, room 40, warung 80, dapur 120, lapangan 160,
// atap 200, xray 240, taman 280), ground level y = D0 = 6 (same convention as molasses build.ts).
export const FPS = 30;
export const TOTAL = 1898; // 62.74 s voice x 30 fps = 1883 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const STREET: V3 = [0, D0, 0];
export const ROOM: V3 = [40, D0, 0];
export const WARUNG: V3 = [80, D0, 0];
export const DAPUR: V3 = [120, D0, 0];
export const LAPANGAN: V3 = [160, D0, 0];
export const ATAP: V3 = [200, D0, 0];
export const ROOF_Y = D0 + 12; // rooftop surface (12 m building)
export const XRAY: V3 = [240, D0, 0];
export const TAMAN: V3 = [280, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 122, light: "day" },      // jalanan: kejedot tiang ("sakit," f67)
  { id: 2, a: 122, b: 275, light: "day" },    // kamar: kelingking vs meja (stub f160)
  { id: 3, a: 275, b: 418, light: "day" },    // warung: cabai sekilo ("sekiloh" f312)
  { id: 4, a: 418, b: 604, light: "day" },    // dapur: wajan panas (tangan f440, perut bunyi f555)
  { id: 5, a: 604, b: 757, light: "day" },    // lapangan: cabut paku (f646), nendang bola (f711)
  { id: 6, a: 757, b: 934, light: "day" },    // alarm tubuh (bunyi f821, mati f887)
  { id: 7, a: 934, b: 1081, light: "day" },   // ketabrak motor (hit f934, bangun f977)
  { id: 8, a: 1081, b: 1289, light: "day" },  // didorong dari atap (dorong f1081, mendarat f1142)
  { id: 9, a: 1289, b: 1443, light: "day" },  // kesetrum (f1298), rambut berdiri (f1337), ngecas (f1404)
  { id: 10, a: 1443, b: 1672, light: "day" }, // rontgen (17 paku f1511, 3 jarum f1544, 1 sendok f1576)
  { id: 11, a: 1672, b: TOTAL, light: "golden" }, // taman: "kita temenan aja ya" (f1822), kamera mundur
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** hard cuts between shots (no crossfade layers) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- camera ----------------
// Same grammar as molasses: symmetric smootherstep glides, slow push-ins on holds, punches on key words.
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
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });

// hero x along the street in shot 1 (walks +x, pole at x = 0.6, bump at f67)
export const heroX1 = (f: number) => (f < 67 ? -4.2 + (f / 67) * 4.35 : f < 80 ? 0.15 : 0.15 + ((f - 80) / 42) * 3.4);
// hero x in the room, shot 2 (walks +x, table near leg at x = ROOM.x - 0.15, stub at f160)
export const heroX2 = (f: number) => {
  const rel = f - 122;
  return rel < 38 ? -3.6 + (rel / 38) * 3.7 : rel < 52 ? 0.1 : 0.1 + ((rel - 52) / 100) * 4.2;
};
// hero fall in shot 8: pushed at f1085, lands at f1142 (gravity ease-in), roof y -> ground y
export const fallY = (f: number) => (f < 1085 ? ROOF_Y : f >= 1142 ? D0 : ROOF_Y - (ROOF_Y - D0) * easeIn((f - 1085) / 57));
export const fallX = (f: number) => (f < 1085 ? 0.4 : 0.4 + 2.6 * smooth((f - 1085) / 57));

const S = STREET, R = ROOM, W = WARUNG, D = DAPUR, L = LAPANGAN, A = ATAP, X = XRAY, T = TAMAN;
// shot 1: street MS, camera tracks the walk slightly, push on the bump
const S1a = (f: number) => dolly([S[0] - 0.6, D0 + 1.9, S[2] + 8.6], [S[0] + 0.2, D0 + 1.3, S[2]], pushK(f, 0, 0.0022), { fov: 42 });
const S1b = (f: number) => dolly([S[0] + 0.4, D0 + 1.7, S[2] + 7.4], [S[0] + 0.6, D0 + 1.25, S[2]], pushK(f, 55, 0.002, 0.006, 30), { fov: 40 });
// shot 2: room MS, hero walks past the table
const S2a = (f: number) => dolly([R[0] - 0.4, D0 + 1.9, R[2] - 7.2], [R[0] + 0.2, D0 + 1.2, R[2] + 0.6], pushK(f, 122, 0.002), { fov: 42 });
const S2b = (f: number) => dolly([R[0] + 0.5, D0 + 1.6, R[2] - 6.2], [R[0] + 0.4, D0 + 1.0, R[2] + 0.4], pushK(f, 150, 0.002, 0.005, 30), { fov: 40 });
// shot 3: warung front MS, push on "datar"
const S3a = (f: number) => dolly([W[0], D0 + 1.9, W[2] - 7.6], [W[0], D0 + 1.35, W[2]], pushK(f, 275, 0.002), { fov: 42 });
const S3b = (f: number) => dolly([W[0] - 0.1, D0 + 1.7, W[2] - 6.4], [W[0], D0 + 1.3, W[2]], pushK(f, 330, 0.002, 0.005, 30), { fov: 40 });
// shot 4: kitchen MS, push down to the stomach rumble
const S4a = (f: number) => dolly([D[0] + 0.4, D0 + 2.0, D[2] - 7.4], [D[0], D0 + 1.3, D[2] + 0.4], pushK(f, 418, 0.002), { fov: 42 });
const S4b = (f: number) => dolly([D[0] + 0.6, D0 + 1.6, D[2] - 6.0], [D[0] + 0.5, D0 + 1.05, D[2] + 0.2], pushK(f, 540, 0.002, 0.006, 32), { fov: 38 });
// shot 5: field MS, slight pan following the kicked ball
const S5a = (f: number) => dolly([L[0] - 0.5, D0 + 2.0, L[2] - 8.4], [L[0], D0 + 1.2, L[2] + 1], pushK(f, 604, 0.0018), { fov: 42 });
const S5b = (f: number) => dolly([L[0] + 1.2, D0 + 1.9, L[2] - 8.0], [L[0] + 2.6, D0 + 1.3, L[2] + 3.5], pushK(f, 700, 0.0018), { fov: 42 });
// shot 6: alarm CU push-in, punch on "mati total"
const S6a = (f: number) => dolly([R[0], D0 + 1.8, R[2] - 4.6], [R[0], D0 + 1.35, R[2] + 0.6], pushK(f, 757, 0.0022), { fov: 38 });
const S6b = (f: number) => dolly([R[0], D0 + 1.7, R[2] - 3.9], [R[0], D0 + 1.3, R[2] + 0.6], pushK(f, 870, 0.002, 0.007, 35), { fov: 36, roll: 0.03 });
// shot 7: street wide MS for the motor hit, push as he stands
const S7a = (f: number) => dolly([S[0] - 1.2, D0 + 2.2, S[2] + 10.5], [S[0], D0 + 1.2, S[2]], pushK(f, 934, 0.0016), { fov: 44 });
const S7b = (f: number) => dolly([S[0] + 0.3, D0 + 1.8, S[2] + 8.6], [S[0] + 0.4, D0 + 1.15, S[2]], pushK(f, 965, 0.002, 0.005, 30), { fov: 40 });
// shot 8: roof level -> follow the fall down -> ground MS
const S8a = (f: number) => dolly([A[0] + 1.6, ROOF_Y + 2.4, A[2] - 8.2], [A[0] + 0.4, ROOF_Y + 1.1, A[2] - 2.2], pushK(f, 1081, 0.002), { fov: 42 });
const S8b = (f: number): Shot => {
  const y = fallY(f), x = A[0] + fallX(f);
  return { pos: [x + 1.4, Math.max(D0 + 2.0, y + 2.2), A[2] - 9.5], look: [x, y + 1.1, A[2] - 4.6], fov: 42, roll: 0 };
};
const S8c = (f: number) => dolly([A[0] + 5.4, D0 + 2.0, A[2] - 10.2], [A[0] + 4.0, D0 + 0.5, A[2] - 4.2], pushK(f, 1142, 0.0016), { fov: 40 });
const S8d = (f: number) => dolly([A[0] + 4.4, D0 + 1.9, A[2] - 9.6], [A[0] + 3.0, D0 + 1.1, A[2] - 4.6], pushK(f, 1166, 0.0016), { fov: 40 });
// shot 9: room MS, push on the shock, settle for the plug
const S9a = (f: number) => dolly([R[0] + 0.6, D0 + 1.9, R[2] - 7.0], [R[0] + 0.8, D0 + 1.25, R[2] - 0.2], pushK(f, 1289, 0.002, 0.006, 30), { fov: 40 });
const S9b = (f: number) => dolly([R[0] + 1.0, D0 + 1.7, R[2] - 6.0], [R[0] + 1.1, D0 + 1.15, R[2] - 0.2], pushK(f, 1380, 0.002), { fov: 38 });
// shot 10: xray room MS, push to the screen for the counts, back for the shrug
const S10a = (f: number) => dolly([X[0], D0 + 2.0, X[2] - 7.8], [X[0], D0 + 1.4, X[2] + 0.6], pushK(f, 1443, 0.0018), { fov: 42 });
const S10b = (f: number) => dolly([X[0] + 0.2, D0 + 1.9, X[2] - 6.6], [X[0], D0 + 1.5, X[2] + 1.0], pushK(f, 1495, 0.001, 0.0025, 35), { fov: 38 });
const S10c = (f: number) => dolly([X[0] - 0.4, D0 + 1.9, X[2] - 7.0], [X[0] - 0.3, D0 + 1.3, X[2] + 0.4], pushK(f, 1600, 0.0018), { fov: 40 });
// shot 11: park MS, slow crane out to the end (picture moving to the last frame)
const S11a = (f: number) => dolly([T[0], D0 + 1.9, T[2] - 6.4], [T[0], D0 + 1.35, T[2]], pushK(f, 1672, 0.0012), { fov: 40 });
const S11b = (f: number): Shot => {
  const a = S11a(1800), s = glide((f - 1800) / 98);
  const B: V3 = [T[0] + 5.5, D0 + 6.5, T[2] - 17], L2: V3 = [T[0], D0 + 1.6, T[2] + 1];
  return { pos: [0, 1, 2].map((i) => a.pos[i] + (B[i] - a.pos[i]) * s) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L2[i] - a.look[i]) * s) as V3, fov: 40 + 4 * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 55, dur: 26, s: S1b }],
  2: [{ f: 122, s: S2a }, { f: 150, dur: 26, s: S2b }],
  3: [{ f: 275, s: S3a }, { f: 330, dur: 28, s: S3b }],
  4: [{ f: 418, s: S4a }, { f: 540, dur: 28, s: S4b }],
  5: [{ f: 604, s: S5a }, { f: 700, dur: 26, s: S5b }],
  6: [{ f: 757, s: S6a }, { f: 870, dur: 28, s: S6b }],
  7: [{ f: 934, s: S7a }, { f: 965, dur: 28, s: S7b }],
  8: [{ f: 1081, s: S8a }, { f: 1085, cut: true, s: S8b }, { f: 1142, cut: true, s: S8c }, { f: 1166, dur: 20, s: S8d }],
  9: [{ f: 1289, s: S9a }, { f: 1380, dur: 28, s: S9b }],
  10: [{ f: 1443, s: S10a }, { f: 1495, dur: 28, s: S10b }, { f: 1600, dur: 28, s: S10c }],
  11: [{ f: 1672, s: S11a }, { f: 1800, cut: true, s: S11b }],
};

// impact kicks: 7-frame sign-flipping offsets on the pole bump, motor hit and roof landing
const KICKS: [number, number][] = [[67 / FPS, 0.7], [945 / FPS, 1.2], [1142 / FPS, 1.0], [1298 / FPS, 0.8]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(f / FPS);
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a;
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};

/** DOF is OFF in the light profile; kept for interface parity with the shared post chain */
export const dofAt = (_f: number) => ({ cInf: 0, focus: undefined as ((f: number) => V3) | undefined });
