// Timeline of "Di Dunia Ini Kamu Bisa Baca Pikiran": 9 shots timed to the AI Studio voice
// (dunia-baca-pikiran/voice/words.json, 54.78 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (kafe 0, pasar 40, bus 80, ujian 120, koridor 160, halaman 200),
// ground level y = D0 = 6 (same convention as molasses build.ts).
export const FPS = 30;
export const TOTAL = 1658; // 54.78 s voice x 30 fps = 1643 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const KAFE: V3 = [0, D0, 0];
export const PASAR: V3 = [40, D0, 0];
export const BUS: V3 = [80, D0, 0];
export const UJIAN: V3 = [120, D0, 0];
export const KORIDOR: V3 = [160, D0, 0];
export const HALAMAN: V3 = [200, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 211, light: "day" },      // kafe: "baca pikiran" (f44), "kedengarannya keren" (f98), "dengar isinya" (f171)
  { id: 2, a: 211, b: 396, light: "day" },    // kafe: "temenmu senyum" (f211), "nggak apa-apa" (f256), "ngomel" (f325), "telat lagi" (f359)
  { id: 3, a: 396, b: 548, light: "day" },    // pasar: "tahu kapan orang bohong" (f431), "nggak bisa nipu kamu" (f509)
  { id: 4, a: 548, b: 752, light: "day" },    // bus: "kepalamu penuh" (f577), "di bus, di kantor, di warung" (f613), "tanpa izin" (f719)
  { id: 5, a: 752, b: 970, light: "day" },    // ujian: "hari ujian tiba" (f752), "duduk paling depan" (f810), "soal paling susah" (f893)
  { id: 6, a: 970, b: 1136, light: "day" },   // ujian: "dengar jelas di kepalanya" (f970), "pasti nggak ada yang bisa jawab" (f1044)
  { id: 7, a: 1136, b: 1313, light: "day" },  // ujian: "coba fokus" (f1136), "mikir jawaban" (f1237), "mikir makan siang" (f1277)
  { id: 8, a: 1313, b: 1492, light: "day" },  // koridor: "keluar ruangan" (f1313), "kepala pusing" (f1345), "isi kepala semua orang" (f1435)
  { id: 9, a: 1492, b: TOTAL, light: "day" }, // halaman: "berhenti pengen tahu" (f1531), punchline "terutama pas ujian" (f1603)
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** hard cuts between shots (no crossfade layers) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- camera ----------------
// Same grammar as molasses / episodes 1-6: symmetric smootherstep glides, slow push-ins on holds, punches on key words.
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

// hero x in shot 8: wobbly walk out of the exam room down the corridor
export const heroX8 = (f: number) => -2.6 + smooth((f - 1313) / 179) * 4.4;
// hero x in shot 9: slow relieved walk across the yard
export const heroX9 = (f: number) => -2.2 + ((f - 1492) / 166) * 3.6;
// thought-bubble pop-in scale: 0 before f0, springs to 1 over ~10 frames with a small overshoot
export const popIn = (f: number, f0: number) => {
  const u = clamp01((f - f0) / 10);
  return u <= 0 ? 0 : 1 + Math.sin(u * Math.PI) * 0.18 * (1 - u);
};

const C = KAFE, P = PASAR, B = BUS, U = UJIAN, K = KORIDOR, H = HALAMAN;
// shot 1: cafe MS, thought bubbles pop around the hero; punch on "dengar isinya" f171
const S1a = (f: number) => dolly([C[0] + 0.2, D0 + 1.9, C[2] - 8.2], [C[0] + 0.15, D0 + 1.3, C[2] + 0.2], pushK(f, 0, 0.0014), { fov: 44 });
const S1b = (f: number) => dolly([C[0] + 0.3, D0 + 1.75, C[2] - 7.4], [C[0] + 0.15, D0 + 1.25, C[2] + 0.2], pushK(f, 165, 0.0014, 0.003, 30), { fov: 44 });
// shot 2: cafe two-shot, punch on "ngomel" f325
const S2a = (f: number) => dolly([C[0] + 0.1, D0 + 1.85, C[2] - 7.8], [C[0] + 0.15, D0 + 1.28, C[2] + 0.2], pushK(f, 211, 0.0014), { fov: 44 });
const S2b = (f: number) => dolly([C[0] + 0.25, D0 + 1.7, C[2] - 7.0], [C[0] + 0.2, D0 + 1.22, C[2] + 0.2], pushK(f, 320, 0.0014, 0.003, 30), { fov: 44 });
// shot 3: market stall MS, punch on "orang bohong" f467
const S3a = (f: number) => dolly([P[0] - 0.3, D0 + 1.9, P[2] + 8.6], [P[0] + 0.2, D0 + 1.25, P[2]], pushK(f, 396, 0.0016), { fov: 44 });
const S3b = (f: number) => dolly([P[0] + 0.3, D0 + 1.7, P[2] + 7.6], [P[0] + 0.3, D0 + 1.2, P[2]], pushK(f, 460, 0.0016, 0.003, 30), { fov: 42 });
// shot 4: bus interior MS, bubbles crowd in; punch on "tanpa izin" f719
const S4a = (f: number) => dolly([B[0] + 0.1, D0 + 1.9, B[2] - 7.8], [B[0] + 0.1, D0 + 1.3, B[2] + 0.3], pushK(f, 548, 0.0012), { fov: 44 });
const S4b = (f: number) => dolly([B[0] + 0.2, D0 + 1.75, B[2] - 7.0], [B[0] + 0.15, D0 + 1.25, B[2] + 0.3], pushK(f, 712, 0.0012, 0.003, 30), { fov: 44 });
// shot 5: exam room, hero front row, lecturer at the board; punch on "soal paling susah" f893
const S5a = (f: number) => dolly([U[0] + 0.1, D0 + 1.9, U[2] - 8.4], [U[0] + 0.15, D0 + 1.3, U[2] + 0.4], pushK(f, 752, 0.0012), { fov: 44 });
const S5b = (f: number) => dolly([U[0] + 0.25, D0 + 1.75, U[2] - 7.6], [U[0] + 0.2, D0 + 1.25, U[2] + 0.4], pushK(f, 885, 0.0012, 0.003, 30), { fov: 44 });
// shot 6: exam room, punch on "pasti nggak ada yang bisa jawab" f1044
const S6a = (f: number) => dolly([U[0] + 0.15, D0 + 1.85, U[2] - 8.0], [U[0] + 0.2, D0 + 1.28, U[2] + 0.4], pushK(f, 970, 0.0012), { fov: 44 });
const S6b = (f: number) => dolly([U[0] + 0.3, D0 + 1.7, U[2] - 7.2], [U[0] + 0.25, D0 + 1.22, U[2] + 0.4], pushK(f, 1038, 0.0012, 0.003, 30), { fov: 44 });
// shot 7: exam room wider, classmates' thoughts mix in; punch on "makan siang" f1277
const S7a = (f: number) => dolly([U[0] + 0.1, D0 + 1.9, U[2] - 8.6], [U[0] + 0.2, D0 + 1.3, U[2] + 0.4], pushK(f, 1136, 0.0012), { fov: 44 });
const S7b = (f: number) => dolly([U[0] + 0.25, D0 + 1.75, U[2] - 7.8], [U[0] + 0.2, D0 + 1.25, U[2] + 0.4], pushK(f, 1270, 0.0012, 0.003, 30), { fov: 44 });
// shot 8: corridor, hero stumbles out; punch on "kepala pusing" f1345
const S8a = (f: number) => dolly([K[0] - 0.3, D0 + 1.9, K[2] - 8.4], [K[0] + 0.1, D0 + 1.3, K[2] + 0.3], pushK(f, 1313, 0.0014), { fov: 44 });
const S8b = (f: number) => dolly([K[0] + 0.4, D0 + 1.75, K[2] - 7.6], [K[0] + 0.4, D0 + 1.25, K[2] + 0.3], pushK(f, 1340, 0.0014, 0.003, 30), { fov: 44 });
// shot 9: yard, slow push to the punchline (picture keeps moving)
const S9a = (f: number) => dolly([H[0] - 0.4, D0 + 1.9, H[2] + 8.8], [H[0] - 0.2, D0 + 1.3, H[2]], pushK(f, 1492, 0.0014), { fov: 44 });
const S9b = (f: number) => dolly([H[0] + 0.4, D0 + 1.75, H[2] + 7.8], [H[0] + 0.3, D0 + 1.25, H[2]], pushK(f, 1598, 0.0014, 0.003, 30), { fov: 42 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 165, dur: 28, s: S1b }],
  2: [{ f: 211, s: S2a }, { f: 320, dur: 28, s: S2b }],
  3: [{ f: 396, s: S3a }, { f: 460, dur: 28, s: S3b }],
  4: [{ f: 548, s: S4a }, { f: 712, dur: 28, s: S4b }],
  5: [{ f: 752, s: S5a }, { f: 885, dur: 28, s: S5b }],
  6: [{ f: 970, s: S6a }, { f: 1038, dur: 28, s: S6b }],
  7: [{ f: 1136, s: S7a }, { f: 1270, dur: 28, s: S7b }],
  8: [{ f: 1313, s: S8a }, { f: 1340, dur: 28, s: S8b }],
  9: [{ f: 1492, s: S9a }, { f: 1598, dur: 30, s: S9b }],
};

// impact kicks: 7-frame sign-flipping offsets on the lecturer's thought and the punchline
const KICKS: [number, number][] = [[1064 / FPS, 0.45], [1603 / FPS, 0.55]];

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
