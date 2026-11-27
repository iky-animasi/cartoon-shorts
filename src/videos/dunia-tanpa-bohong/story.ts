// Timeline of "Di Dunia Ini Kamu Nggak Bisa Bohong" v2: same 10 shots / frame boundaries as v1
// (audio sync unchanged), but the camera now cuts to a NEW ANGLE every 2-3 s inside each shot
// (32 angles total), characters perform the narration, and the FULL post profile is on
// (DOF via dofAt below). Shot cuts land on each line's first word (voice/words.json, 61.81 s).
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

// ---------------- shots (boundaries identical to v1: audio is locked to them) ----------------
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
/** 0.4 s dip to cream at location changes (skill): layer alpha dips to ~0 across each shot cut */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  let alpha = 1;
  for (const s of SHOTS) {
    if (s.a === 0) continue;
    const d = Math.abs(f - s.a + 0.5);
    if (d < 6) alpha = Math.min(alpha, smooth(d / 6));
  }
  return [{ id: shotAt(f).id, alpha }];
};

// ---------------- camera ----------------
// v2 grammar: hard CUT to a new angle every 2-3 s inside each shot; inside every angle the
// camera still travels (push/track/crane, ~10% frame width/s) plus the continuous micro-drift.
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

// ---------------- character paths (natural speeds; phase in cast.ts is distance-based) ----------------
// hero shot 1: walks the whole shot at ~1.25 m/s
export const heroX1 = (f: number) => -4.2 + (f / 189) * 7.9;
// friend shot 2: stands by the mirror, storms off f352-389 at ~1.95 m/s
export const temanX2 = (f: number) => (f < 352 ? 0.8 : 0.8 + ((f - 352) / 37) * 2.4);
// latecomer shot 4: hurries in f700-760 at ~1.75 m/s and stops at the bus stop
export const lateX4 = (f: number) => (f < 700 ? -4.6 : f < 760 ? -4.6 + ((f - 700) / 60) * 3.5 : -1.1);
// pacar shot 6: walks in f952-1005 at ~1.5 m/s to face the hero
export const pacarX6 = (f: number) => (f < 952 ? 3.6 : f < 1005 ? 3.6 - ((f - 952) / 53) * 2.7 : 0.9);
// pacar shot 9: walks away f1529-1620 at ~1.5 m/s
export const pacarX9 = (f: number) => (f < 1529 ? 0.9 : 0.9 + ((f - 1529) / 91) * 4.5);
// hero shot 10: tired stroll home f1727-1830 at ~0.9 m/s, then stops
export const heroX10 = (f: number) => (f < 1830 ? -2.6 + ((f - 1727) / 103) * 3.1 : 0.5);

const J = JALAN, K = KAMAR, O = KANTOR, H = HALTE, C = KAFE, S = SORE;
const hx1 = (f: number) => J[0] + heroX1(f);
const lx4 = (f: number) => H[0] + lateX4(f);
const px6 = (f: number) => C[0] + pacarX6(f);
const px9 = (f: number) => C[0] + pacarX9(f);
const hx10 = (f: number) => S[0] + heroX10(f);

// ---- shot 1 (3 angles): wide side track -> 3/4 front track -> close on "sebenarnya" ----
const S1a = (f: number) => dolly([hx1(f) - 0.5, D0 + 2.0, J[2] + 9.5], [hx1(f) + 0.3, D0 + 1.2, J[2]], pushK(f, 0, 0.0022), { fov: 44 });
const S1b = (f: number) => dolly([hx1(f) + 3.2, D0 + 1.8, J[2] + 6.8], [hx1(f), D0 + 1.25, J[2]], pushK(f, 70, 0.003), { fov: 42 });
const S1c = (f: number) => dolly([hx1(f) + 1.2, D0 + 1.6, J[2] + 5.0], [hx1(f) + 0.1, D0 + 1.3, J[2]], pushK(f, 130, 0.003, 0.005, 25), { fov: 40 });
// ---- shot 2 (4 angles): wide -> teman close (asks) -> hero close (answers) -> teman storms off ----
const S2a = (f: number) => dolly([K[0] + 0.1, D0 + 1.9, K[2] - 7.4], [K[0] + 0.1, D0 + 1.25, K[2] + 0.3], pushK(f, 189, 0.0026), { fov: 42 });
const S2b = (f: number) => dolly([K[0] + 1.1, D0 + 1.7, K[2] - 4.6], [K[0] + 0.75, D0 + 1.35, K[2] + 0.25], pushK(f, 232, 0.003), { fov: 40 });
const S2c = (f: number) => dolly([K[0] - 0.9, D0 + 1.7, K[2] - 4.4], [K[0] - 0.55, D0 + 1.3, K[2] + 0.25], pushK(f, 300, 0.003, 0.005, 25), { fov: 40 });
const S2d = (f: number) => dolly([K[0] + 0.7, D0 + 1.8, K[2] - 7.8], [K[0] + 0.7, D0 + 1.2, K[2] + 0.25], pushK(f, 355, 0.0026), { fov: 44 });
// ---- shot 3 (4 angles): wide -> bos close (asks, points at report) -> hero close (answers) -> bos stunned ----
const S3a = (f: number) => dolly([O[0], D0 + 1.9, O[2] - 7.6], [O[0] + 0.1, D0 + 1.25, O[2] + 0.5], pushK(f, 389, 0.0026), { fov: 42 });
const S3b = (f: number) => dolly([O[0] + 0.9, D0 + 1.75, O[2] - 3.4], [O[0] + 0.7, D0 + 1.3, O[2] + 1.1], pushK(f, 435, 0.003), { fov: 40 });
const S3c = (f: number) => dolly([O[0] - 0.8, D0 + 1.7, O[2] - 3.8], [O[0] - 0.5, D0 + 1.3, O[2] + 0.3], pushK(f, 505, 0.003, 0.005, 25), { fov: 40 });
const S3d = (f: number) => dolly([O[0] + 0.85, D0 + 1.7, O[2] - 3.0], [O[0] + 0.75, D0 + 1.35, O[2] + 1.15], pushK(f, 548, 0.002), { fov: 40 });
// ---- shot 4 (4 angles): wide halte -> hero + clock -> track latecomer running in -> group settled ----
const S4a = (f: number) => dolly([H[0] - 0.4, D0 + 2.1, H[2] + 11.5], [H[0] + 0.4, D0 + 1.2, H[2]], pushK(f, 573, 0.0022), { fov: 44 });
const S4b = (f: number) => dolly([H[0] + 0.5, D0 + 1.9, H[2] + 6.4], [H[0] + 0.6, D0 + 1.5, H[2] + 0.1], pushK(f, 640, 0.003), { fov: 42 });
const S4c = (f: number) => dolly([lx4(f) + 1.2, D0 + 1.9, H[2] - 5.6], [lx4(f), D0 + 1.25, H[2] - 0.2], pushK(f, 705, 0.0026), { fov: 42 }); // from across the street: bench/posts stay behind the runner
const S4d = (f: number) => dolly([H[0] + 0.1, D0 + 1.8, H[2] + 9.8], [H[0] + 0.1, D0 + 1.15, H[2] + 0.2], pushK(f, 760, 0.0026), { fov: 44 });
// ---- shot 5 (3 angles): wide cafe -> two-shot ("5 menit lagi") -> hero sips, teman laughs ----
const S5a = (f: number) => dolly([C[0] + 0.2, D0 + 1.95, C[2] - 8.4], [C[0] + 0.2, D0 + 1.15, C[2] + 0.8], pushK(f, 785, 0.0026), { fov: 42 });
const S5b = (f: number) => dolly([C[0] + 0.15, D0 + 1.7, C[2] - 5.6], [C[0] + 0.1, D0 + 1.15, C[2] + 1.2], pushK(f, 845, 0.003, 0.005, 25), { fov: 40 });
const S5c = (f: number) => dolly([C[0] - 0.7, D0 + 1.65, C[2] - 4.2], [C[0] - 0.45, D0 + 1.2, C[2] + 1.0], pushK(f, 900, 0.003), { fov: 40 });
// ---- shot 6 (3 angles): pacar walks in -> two-shot (hero stood up) -> pacar close asks ----
const S6a = (f: number) => dolly([px6(f) - 0.6, D0 + 2.0, C[2] - 8.8], [px6(f) - 0.3, D0 + 1.3, C[2] + 0.2], pushK(f, 952, 0.0022), { fov: 44 });
const S6b = (f: number) => dolly([C[0] + 0.25, D0 + 1.85, C[2] - 6.4], [C[0] + 0.25, D0 + 1.3, C[2] + 0.4], pushK(f, 1005, 0.0026), { fov: 42 });
const S6c = (f: number) => dolly([C[0] + 1.15, D0 + 1.7, C[2] - 4.0], [C[0] + 0.85, D0 + 1.35, C[2] + 0.2], pushK(f, 1080, 0.003, 0.005, 30), { fov: 40 });
// ---- shot 7 (2 angles): wide frozen cafe -> slow push on the hero's darting eyes ----
const S7a = (f: number) => dolly([C[0] - 0.3, D0 + 1.9, C[2] - 8.8], [C[0] + 0.25, D0 + 1.25, C[2] + 0.4], pushK(f, 1171, 0.002), { fov: 42 });
const S7b = (f: number) => dolly([C[0] - 0.5, D0 + 1.7, C[2] - 4.6], [C[0] - 0.3, D0 + 1.35, C[2] + 0.6], pushK(f, 1240, 0.0032), { fov: 40 });
// ---- shot 8 (3 angles): two-shot -> hero close (struggle, blurts "Sedikit") -> two-shot (shrug) ----
const S8a = (f: number) => dolly([C[0] + 0.25, D0 + 1.85, C[2] - 6.2], [C[0] + 0.25, D0 + 1.3, C[2] + 0.4], pushK(f, 1334, 0.0026), { fov: 42 });
const S8b = (f: number) => dolly([C[0] - 0.55, D0 + 1.7, C[2] - 3.9], [C[0] - 0.35, D0 + 1.35, C[2] + 0.6], pushK(f, 1400, 0.003, 0.005, 25), { fov: 40 });
const S8c = (f: number) => dolly([C[0] + 0.3, D0 + 1.8, C[2] - 5.8], [C[0] + 0.3, D0 + 1.3, C[2] + 0.4], pushK(f, 1460, 0.0026, 0.005, 25), { fov: 40 });
// ---- shot 9 (3 angles): track pacar leaving -> hero alone (reach, slump) -> hero seated, lonely ----
const S9a = (f: number) => dolly([px9(f) - 0.4, D0 + 1.85, C[2] - 7.0], [px9(f), D0 + 1.3, C[2] + 0.2], pushK(f, 1529, 0.0024), { fov: 42 });
const S9b = (f: number) => dolly([C[0] - 0.5, D0 + 1.75, C[2] - 4.8], [C[0] - 0.3, D0 + 1.3, C[2] + 0.6], pushK(f, 1590, 0.003), { fov: 40 });
const S9c = (f: number) => dolly([C[0] - 0.2, D0 + 1.8, C[2] - 6.8], [C[0] - 0.2, D0 + 1.15, C[2] + 1.0], pushK(f, 1650, 0.0026), { fov: 42 });
// ---- shot 10 (3 angles): side track -> front 3/4 -> crane out to the end ----
const S10a = (f: number) => dolly([hx10(f) - 0.3, D0 + 1.9, S[2] + 8.6], [hx10(f) + 0.2, D0 + 1.25, S[2]], pushK(f, 1727, 0.0024), { fov: 42 });
const S10b = (f: number) => dolly([hx10(f) + 2.6, D0 + 1.7, S[2] + 5.6], [hx10(f), D0 + 1.3, S[2]], pushK(f, 1785, 0.003), { fov: 40 });
const S10c = (f: number): Shot => {
  const a = S10b(1825), s = glide((f - 1825) / 44);
  const B: V3 = [S[0] + 4.5, D0 + 5.5, S[2] + 15], L2: V3 = [S[0] - 0.5, D0 + 1.5, S[2] - 1];
  return { pos: [0, 1, 2].map((i) => a.pos[i] + (B[i] - a.pos[i]) * s) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L2[i] - a.look[i]) * s) as V3, fov: 40 + 4 * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [{ f: 0, s: S1a }, { f: 70, cut: true, s: S1b }, { f: 130, cut: true, s: S1c }],
  2: [{ f: 189, s: S2a }, { f: 232, cut: true, s: S2b }, { f: 300, cut: true, s: S2c }, { f: 355, cut: true, s: S2d }],
  3: [{ f: 389, s: S3a }, { f: 435, cut: true, s: S3b }, { f: 505, cut: true, s: S3c }, { f: 548, cut: true, s: S3d }],
  4: [{ f: 573, s: S4a }, { f: 640, cut: true, s: S4b }, { f: 705, cut: true, s: S4c }, { f: 760, cut: true, s: S4d }],
  5: [{ f: 785, s: S5a }, { f: 845, cut: true, s: S5b }, { f: 900, cut: true, s: S5c }],
  6: [{ f: 952, s: S6a }, { f: 1005, cut: true, s: S6b }, { f: 1080, cut: true, s: S6c }],
  7: [{ f: 1171, s: S7a }, { f: 1240, cut: true, s: S7b }],
  8: [{ f: 1334, s: S8a }, { f: 1400, cut: true, s: S8b }, { f: 1460, cut: true, s: S8c }],
  9: [{ f: 1529, s: S9a }, { f: 1590, cut: true, s: S9b }, { f: 1650, cut: true, s: S9c }],
  10: [{ f: 1727, s: S10a }, { f: 1785, cut: true, s: S10b }, { f: 1825, cut: true, s: S10c }],
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
  // continuous micro-drift so no angle is ever dead still: slow look sway + a micro-orbit
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

// ---------------- DOF (full profile: lens blur ON, focus = camera look point on the subject) ----------------
// cInf = blur-disc radius (px at 1080x1920) at infinity; wides soft, closes stronger, final crane sharp.
type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
const DOF: Dof[] = [
  { f: 0, cInf: 8 }, { f: 70, dur: 8, cInf: 10 }, { f: 130, dur: 8, cInf: 12 },
  { f: 189, dur: 8, cInf: 8 }, { f: 232, dur: 8, cInf: 12 }, { f: 300, dur: 8, cInf: 12 }, { f: 355, dur: 8, cInf: 10 },
  { f: 389, dur: 8, cInf: 8 }, { f: 435, dur: 8, cInf: 12 }, { f: 505, dur: 8, cInf: 12 }, { f: 548, dur: 8, cInf: 14 },
  { f: 573, dur: 8, cInf: 6 }, { f: 640, dur: 8, cInf: 10 }, { f: 705, dur: 8, cInf: 10 }, { f: 760, dur: 8, cInf: 10 },
  { f: 785, dur: 8, cInf: 6 }, { f: 845, dur: 8, cInf: 10 }, { f: 900, dur: 8, cInf: 12 },
  { f: 952, dur: 8, cInf: 8 }, { f: 1005, dur: 8, cInf: 10 }, { f: 1080, dur: 8, cInf: 12 },
  { f: 1171, dur: 8, cInf: 8 }, { f: 1240, dur: 8, cInf: 12 },
  { f: 1334, dur: 8, cInf: 10 }, { f: 1400, dur: 8, cInf: 14 }, { f: 1460, dur: 8, cInf: 10 },
  { f: 1529, dur: 8, cInf: 10 }, { f: 1590, dur: 8, cInf: 12 }, { f: 1650, dur: 8, cInf: 10 },
  { f: 1727, dur: 8, cInf: 8 }, { f: 1785, dur: 8, cInf: 10 }, { f: 1825, dur: 20, cInf: 0 },
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
