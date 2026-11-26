// Timeline of "Di Dunia Ini Kamu Selalu Beruntung": 10 shots timed to the AI Studio voice
// (dunia-selalu-beruntung/voice/words.json, 72.34 s). Shot cuts land on each line's first word.
// Sets sit at x offsets in one scene (jalan 0, kantor 40, kafe 80, kantin 120, sore 160, dapur 200),
// ground level y = D0 = 6 (same convention as molasses build.ts).
export const FPS = 30;
export const TOTAL = 2185; // 72.34 s voice x 30 fps = 2170 frames + 15-frame tail
export const D0 = 6.0;
export type V3 = [number, number, number];

export const JALAN: V3 = [0, D0, 0];
export const KANTOR: V3 = [40, D0, 0];
export const KAFE: V3 = [80, D0, 0];
export const KANTIN: V3 = [120, D0, 0];
export const SORE: V3 = [160, D0, 0];
export const DAPUR: V3 = [200, D0, 0];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
export const easeIn = (u: number) => clamp01(u) ** 2;

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type ShotDef = { id: number; a: number; b: number; light: Light };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 305, light: "day" },      // jalanan: "beruntung" (f51), "nemu uang" (f107), "menang" (f171), "hujan" (f205), "payung" (f271)
  { id: 2, a: 305, b: 535, light: "day" },    // kantor: "berantakan" (f326), "gaya baru" (f392), "telat" (f444), "rapatnya juga ikut telat" (f472)
  { id: 3, a: 535, b: 755, light: "day" },    // kafe kartu: "jaga jarak" (f596), "main kartu" (f638), "selalu menang" (f721)
  { id: 4, a: 755, b: 943, light: "day" },    // kantin: "makan sendiri" (f793), "dibenci" (f848), "capek kalah" (f913)
  { id: 5, a: 943, b: 1173, light: "day" },   // kafe kuis: "sengaja mau kalah" (f997), "asal jawab kuis" (f1043), "tetap aja menang" (f1127)
  { id: 6, a: 1173, b: 1388, light: "golden" }, // jalanan sore: "baru sadar" (f1187), "sepi" (f1250), "nggak bisa kalah" (f1344)
  { id: 7, a: 1388, b: 1543, light: "day" },  // dapur: "pulang ke rumah" (f1402), "ibu lagi masak" (f1440), "kenapa pulang cepet" (f1496)
  { id: 8, a: 1543, b: 1721, light: "day" },  // dapur: "cerita semuanya" (f1552), "makanya jangan sombong" (f1646)
  { id: 9, a: 1721, b: 1955, light: "day" },  // dapur: "padahal nggak sombong" (f1721), "mau jawab" (f1799), "kata-kata ibu" (f1882)
  { id: 10, a: 1955, b: TOTAL, light: "day" }, // punchline: "seberuntung apa pun" (f2008), "debat sama ibu" (f2135)
];
export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** hard cuts between shots (no crossfade layers) */
export const layersAt = (f: number): { id: number; alpha: number }[] => [{ id: shotAt(f).id, alpha: 1 }];

// ---------------- camera ----------------
// Same grammar as molasses / episodes 1-5: symmetric smootherstep glides, slow push-ins on holds, punches on key words.
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

// hero x in shot 1: walks +x, stops at the money (f107), stays for the umbrella beat
export const heroX1 = (f: number) => (f < 107 ? -2.4 + (f / 107) * 2.2 : -0.2);
// umbrella friend x in shot 1: enters from the right when the drizzle starts
export const payungX1 = (f: number) => (f < 230 ? 4.2 : 4.2 - smooth((f - 230) / 45) * 3.45);
// hero x in shot 6: slow lonely walk home at dusk
export const heroX6 = (f: number) => -2.2 + ((f - 1173) / 215) * 3.4;
// hero x in shot 7: comes in through the kitchen door (left) and stops mid-room
export const heroX7 = (f: number) => (f < 1402 ? -3.4 : -3.4 + smooth((f - 1402) / 55) * 2.7);
// card friends in shot 3: slide their chairs away from the hero at "jaga jarak" (f596)
export const jarak3 = (f: number) => (f < 596 ? 0 : smooth((f - 596) / 30) * 0.35);

const J = JALAN, O = KANTOR, C = KAFE, N = KANTIN, S = SORE, D = DAPUR;
// shot 1: street MS following the hero, punch on "nemu uang" f107
const S1a = (f: number) => dolly([J[0] - 0.6, D0 + 1.9, J[2] + 8.6], [J[0] - 0.4, D0 + 1.25, J[2]], pushK(f, 0, 0.0022), { fov: 42 });
const S1b = (f: number) => dolly([J[0] + 0.4, D0 + 1.7, J[2] + 7.4], [J[0] + 0.3, D0 + 1.2, J[2]], pushK(f, 100, 0.002, 0.004, 30), { fov: 42 });
// shot 2: office MS, hero at the board, boss at the desk; punch on "gaya baru" f392
const S2a = (f: number) => dolly([O[0] + 0.2, D0 + 1.9, O[2] - 7.6], [O[0] + 0.1, D0 + 1.3, O[2] + 0.3], pushK(f, 305, 0.002), { fov: 42 });
const S2b = (f: number) => dolly([O[0] + 0.3, D0 + 1.7, O[2] - 6.6], [O[0] + 0.15, D0 + 1.25, O[2] + 0.2], pushK(f, 385, 0.002, 0.004, 30), { fov: 42 });
// shot 3: cafe card table MS, punch on "selalu menang" f721
const S3a = (f: number) => dolly([C[0] + 0.2, D0 + 1.9, C[2] - 8.4], [C[0] + 0.1, D0 + 1.2, C[2] + 0.2], pushK(f, 535, 0.0012), { fov: 44 });
const S3b = (f: number) => dolly([C[0] + 0.3, D0 + 1.7, C[2] - 7.6], [C[0] + 0.1, D0 + 1.15, C[2] + 0.2], pushK(f, 715, 0.0012, 0.003, 30), { fov: 44 });
// shot 4: canteen, hero alone in front, laughing table behind; punch on "capek kalah" f913
const S4a = (f: number) => dolly([N[0] - 0.1, D0 + 1.9, N[2] - 8.4], [N[0] + 0.35, D0 + 1.2, N[2] + 0.3], pushK(f, 755, 0.0012), { fov: 44 });
const S4b = (f: number) => dolly([N[0] + 0.2, D0 + 1.7, N[2] - 7.6], [N[0] + 0.35, D0 + 1.15, N[2] + 0.3], pushK(f, 905, 0.0012, 0.003, 30), { fov: 44 });
// shot 5: cafe quiz MS, punch on "tetap aja menang" f1127
const S5a = (f: number) => dolly([C[0] + 0.1, D0 + 1.9, C[2] - 8.2], [C[0] + 0.15, D0 + 1.2, C[2] + 0.2], pushK(f, 943, 0.0012), { fov: 44 });
const S5b = (f: number) => dolly([C[0] + 0.25, D0 + 1.7, C[2] - 7.4], [C[0] + 0.15, D0 + 1.15, C[2] + 0.2], pushK(f, 1120, 0.0012, 0.003, 30), { fov: 44 });
// shot 6: dusk street, slow crane following the lonely walk
const S6a = (f: number) => dolly([S[0] - 0.5, D0 + 2.0, S[2] + 9.0], [S[0] - 0.3, D0 + 1.3, S[2]], pushK(f, 1173, 0.0018), { fov: 44 });
const S6b = (f: number) => dolly([S[0] + 0.5, D0 + 1.8, S[2] + 7.8], [S[0] + 0.4, D0 + 1.25, S[2]], pushK(f, 1245, 0.0018, 0.0035, 30), { fov: 42 });
// shot 7: kitchen MS, ibu at the stove, hero enters; punch on "kenapa pulang cepet" f1496
const S7a = (f: number) => dolly([D[0] + 0.1, D0 + 1.9, D[2] - 8.2], [D[0] + 0.15, D[1] + 1.3, D[2] + 0.3], pushK(f, 1388, 0.0012), { fov: 44 });
const S7b = (f: number) => dolly([D[0] + 0.2, D0 + 1.7, D[2] - 7.4], [D[0] + 0.15, D[1] + 1.25, D[2] + 0.3], pushK(f, 1490, 0.0012, 0.003, 30), { fov: 44 });
// shot 8: kitchen two-shot, punch on "makanya jangan sombong" f1646
const S8a = (f: number) => dolly([D[0] + 0.1, D0 + 1.85, D[2] - 8.0], [D[0] + 0.15, D[1] + 1.28, D[2] + 0.3], pushK(f, 1543, 0.0012), { fov: 44 });
const S8b = (f: number) => dolly([D[0] + 0.2, D0 + 1.7, D[2] - 7.2], [D[0] + 0.2, D[1] + 1.22, D[2] + 0.3], pushK(f, 1640, 0.0012, 0.003, 30), { fov: 44 });
// shot 9: kitchen, hero tries to answer and loses; punch on "kata-kata ibu" f1882
const S9a = (f: number) => dolly([D[0] + 0.1, D0 + 1.85, D[2] - 7.8], [D[0] + 0.15, D[1] + 1.28, D[2] + 0.3], pushK(f, 1721, 0.0012), { fov: 44 });
const S9b = (f: number) => dolly([D[0] + 0.2, D0 + 1.7, D[2] - 7.1], [D[0] + 0.2, D[1] + 1.22, D[2] + 0.3], pushK(f, 1875, 0.0012, 0.003, 30), { fov: 44 });
// shot 10: punchline, slow push to the last frame (picture keeps moving)
const S10a = (f: number) => dolly([D[0] + 0.15, D0 + 1.85, D[2] - 7.6], [D[0] + 0.2, D[1] + 1.28, D[2] + 0.3], pushK(f, 1955, 0.001), { fov: 44 });
const S10b = (f: number) => dolly([D[0] + 0.25, D0 + 1.75, D[2] - 6.9], [D[0] + 0.25, D[1] + 1.24, D[2] + 0.3], pushK(f, 2128, 0.0012, 0.003, 30), { fov: 42 });

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 100, dur: 28, s: S1b }],
  2: [{ f: 305, s: S2a }, { f: 385, dur: 28, s: S2b }],
  3: [{ f: 535, s: S3a }, { f: 715, dur: 28, s: S3b }],
  4: [{ f: 755, s: S4a }, { f: 905, dur: 28, s: S4b }],
  5: [{ f: 943, s: S5a }, { f: 1120, dur: 28, s: S5b }],
  6: [{ f: 1173, s: S6a }, { f: 1245, dur: 30, s: S6b }],
  7: [{ f: 1388, s: S7a }, { f: 1490, dur: 28, s: S7b }],
  8: [{ f: 1543, s: S8a }, { f: 1640, dur: 28, s: S8b }],
  9: [{ f: 1721, s: S9a }, { f: 1875, dur: 28, s: S9b }],
  10: [{ f: 1955, s: S10a }, { f: 2128, dur: 30, s: S10b }],
};

// impact kicks: 7-frame sign-flipping offsets on the quiz win and the punchline
const KICKS: [number, number][] = [[1141 / FPS, 0.45], [2135 / FPS, 0.6]];

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
