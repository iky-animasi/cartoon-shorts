// Timeline of the molasses short: shots timed to the voice words (molasses/voice/words.json),
// story physics (tank burst, molasses wave, flood, train lift) and the camera grammar measured in the
// reference study: continuous slow push-ins; symmetric ease-in-out moves ~23 f (10 in / 10 out), peak ~15 px/f at 720p;
// big reframes are cuts; impacts are 7-frame kicks that flip sign every frame; no hand-held float.
//
// WORLD LAYOUT (metres; ground/street level y = D0 = 6):
//   Commercial Street runs along z, centre x = 0, half-width 10 (x -10..10), z -70..+90.
//   TANK at (0, D0, -40), radius 13.5, height 15 (front edge z = -26.5).
//   Elevated railway along z at x = +8.5, rail top y ~ D0+6.5; train car centred z = +30.
//   Houses line both sides (x beyond +-13). OFFICE set centre (55, D0, 45). SPOON set centre (-55, D0, 45).
export const FPS = 30;
export const TOTAL = 1879; // 62.64 s voice x 30 fps
export const D0 = 6.0; // street level (m)
export const TANK: V3 = [0, D0, -40];
export const TANK_R = 13.5;
export const TANK_H = 15;
export const RAIL_X = 8.5;
export const TRAIN_Z = 30;
export const OFFICE: V3 = [55, D0, 45];
export const SPOON: V3 = [-55, D0, 45];
export type V3 = [number, number, number];

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const smooth = (x: number) => { const u = clamp01(x); return u * u * (3 - 2 * u); };
export const easeOut = (u: number) => 1 - (1 - clamp01(u)) ** 4;
const lin = (pts: [number, number][], x: number) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (x <= pts[i][0]) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return pts[pts.length - 1][1];
};

// ---------------- story physics (tau = story time in seconds) ----------------
export const BURST = 27.0; // "meledak." starts f810
export const TANK_FRONT = TANK[2] + TANK_R; // -26.5
/** z of the wave front: 56 km/h = 15.6 m/s after the burst, decelerating to a stop at z = 75 ("cepat melambat") */
export const waveFront = (tau: number) =>
  tau < BURST ? TANK_FRONT : tau < 32.5 ? TANK_FRONT + 15.6 * (tau - BURST) : 59.3 + 15.7 * smooth((tau - 32.5) / 5.2);
/** 0..1 tank wall bursting open (fragments fly out over 0.6 s) */
export const burstU = (tau: number) => clamp01((tau - BURST) / 0.6);
/** 0..1 flood pool level behind the front (max depth ~0.8 m) */
export const floodU = (tau: number) => (tau < BURST ? 0 : smooth((tau - BURST) / 7));
/** tank groan shake amplitude in metres (grows while filling, gone after the burst) */
export const shakeAmp = (tau: number) => (tau < 20 || tau >= BURST ? 0 : 0.015 + 0.05 * smooth((tau - 20) / 6.5));
/** 0..1 train car lifted off the rails: the front reaches the train (z = 30) at tau 30.62, peak lift ~33.4, then it drops back askew */
export const trainLift = (tau: number) =>
  tau < 30.62 ? 0 : tau < 33.4 ? smooth((tau - 30.62) / 2.78) : 1 - 0.65 * smooth((tau - 33.4) / 2.6);

export type MolState = { burst: number; waveZ: number; flood: number; shake: number; train: number; tank: number };
export const molState = (id: number, t: number): MolState => {
  const s = SHOTS[id - 1];
  const tau = s.tau(t);
  // shot 14 is decades later: clean street, no flood, tank site empty
  if (id === 14) return { burst: 1, waveZ: 75, flood: 0, shake: 0, train: 0, tank: 0 };
  // shot 13 (office) and shot 11 (spoon set): the street state is off-camera; keep it post-flood and calm
  if (id === 13 || id === 11) return { burst: 1, waveZ: 75, flood: 1, shake: 0, train: 0.35, tank: 0 };
  const burst = burstU(tau);
  return { burst, waveZ: waveFront(tau), flood: floodU(tau), shake: shakeAmp(tau), train: trainLift(tau), tank: 1 - burst };
};

// ---------------- shots ----------------
export type Light = "day" | "golden";
export type Crowd = "none" | "flee" | "workers" | "stuck" | "summer";
export type ShotDef = { id: number; a: number; b: number; light: Light; crowd: Crowd; tau: (t: number) => number; towns?: boolean; sunAz?: number; sunEl?: number };
export const SHOTS: ShotDef[] = [
  { id: 1, a: 0, b: 117, light: "day", crowd: "flee", tau: (t) => 31.0 + t }, // hook, flash-forward: the wave mid-rush
  { id: 2, a: 117, b: 322, light: "day", crowd: "none", tau: (t) => t, towns: true }, // setting: Boston aerial -> tank
  { id: 3, a: 322, b: 461, light: "day", crowd: "none", tau: (t) => t }, // tank leaking CU
  { id: 4, a: 461, b: 604, light: "day", crowd: "workers", tau: (t) => t }, // buckets + painter
  { id: 5, a: 604, b: 761, light: "day", crowd: "workers", tau: (t) => t }, // filling + groan
  { id: 6, a: 761, b: 935, light: "day", crowd: "none", tau: (t) => t }, // snap: explosion + rivets
  { id: 7, a: 935, b: 1047, light: "day", crowd: "flee", tau: (t) => t }, // wave rush + train lift
  { id: 8, a: 1047, b: 1136, light: "day", crowd: "none", tau: (t) => t }, // luckily: the wave slows
  { id: 9, a: 1136, b: 1228, light: "day", crowd: "stuck", tau: (t) => t }, // unluckily: stuck in the pool
  { id: 10, a: 1228, b: 1362, light: "day", crowd: "stuck", tau: (t) => t }, // mystery: the stuck boot
  { id: 11, a: 1362, b: 1470, light: "golden", crowd: "none", tau: (t) => t }, // honey spoon CU
  { id: 12, a: 1470, b: 1585, light: "golden", crowd: "none", tau: (t) => 31.0 + (t - 49) * 0.35, sunAz: 115, sunEl: 20 }, // the walking wall (slow-motion re-show; front ends z~57, stays ahead of the lens; sun behind the camera — any az < 90 leaves the wave face in shade)
  { id: 13, a: 1585, b: 1753, light: "day", crowd: "none", tau: (t) => t }, // consequence: the engineer signs
  { id: 14, a: 1753, b: TOTAL, light: "golden", crowd: "summer", tau: (t) => t }, // twist: summer street, crane out
];
/** crossfades (frames) at place/time changes; a white 4-frame flash after the hook */
export const XFADE: Record<number, number> = { 11: 8, 13: 8, 14: 8 };
export const FLASH_AT = 117;

export const shotAt = (f: number) => SHOTS.find((s) => f >= s.a && f < s.b) ?? SHOTS[SHOTS.length - 1];
/** layers to draw at frame f: base shot, plus the next shot fading in during a crossfade */
export const layersAt = (f: number): { id: number; alpha: number }[] => {
  for (const s of SHOTS) {
    const x = XFADE[s.id];
    if (x && f >= s.a - x / 2 && f < s.a + x / 2) return [{ id: s.id - 1, alpha: 1 }, { id: s.id, alpha: (f - (s.a - x / 2) + 1) / (x + 1) }];
  }
  return [{ id: shotAt(f).id, alpha: 1 }];
};

// ---------------- camera ----------------
// Grammar (motion.md): every move is a symmetric smootherstep glide of 18-40 f (peak speed = 1.875 x distance / dur,
// so dur >= 0.075 x the move in 720p px keeps the peak near the reference 14-25 px/f); a reframe bigger than about
// half a frame width or 40 % zoom is a hard cut on its key frame. Glides are centred on the old key frame (the
// whoosh in the sound mix peaks there), so a glide key starts dur/2 earlier. Holds push in (dolly toward the look
// point or a fov zoom near walls/towers): 0.15-0.35 %/f, ~0.6 %/f for ~35 f on the punch words. Rolls of 4-8 deg
// over >= 18 f on emphasis beats, held tilt <= 0.07 rad.
export type Cam = { pos: V3; look: V3; fov: number; roll: number };
type Shot = Partial<Cam> & { pos: V3; look: V3 };
type Key = { f: number; dur?: number; cut?: boolean; s: (f: number) => Shot };
/** reference camera ease: symmetric smootherstep (attack = release, ~10 f each on a 23 f move) */
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
const T = (f: number) => f / FPS;
/** wave-front z at frame f in shot id (for cameras that stay ahead of the front) */
const Wz = (id: number, f: number) => waveFront(SHOTS[id - 1].tau(T(f)));
/** push-in factor since f0: the subject grows ~rate per frame; `punch` raises it (with 8 f soft edges) for the first n frames */
const pushK = (f: number, f0: number, rate: number, punch = 0, n = 35) => {
  const x = Math.max(0, f - f0);
  let s = rate * x;
  if (punch > rate) for (let i = 0; i < Math.min(x, n); i++) s += (punch - rate) * Math.max(0, Math.min(1, (i + 0.5) / 8, (n - i - 0.5) / 8));
  return Math.exp(-s);
};
/** dolly push: camera slides toward the look point by factor k */
const dolly = (pos: V3, look: V3, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos: [look[0] + (pos[0] - look[0]) * k, look[1] + (pos[1] - look[1]) * k, look[2] + (pos[2] - look[2]) * k], look, ...rest });
/** zoom push (camera stays put, for lenses next to walls/towers): tan(fov/2) shrinks by k */
const zoom = (pos: V3, look: V3, fov: number, k: number, rest: Partial<Cam> = {}): Shot =>
  ({ pos, look, fov: (360 / Math.PI) * Math.atan(Math.tan((fov * Math.PI) / 360) * k), ...rest });
/** a roll-only move on top of an existing framing */
const rolled = (s: (f: number) => Shot, roll: number) => (f: number): Shot => ({ ...s(f), roll });

// ---- framings (f -> camera); each pushes in from the frame its key starts ----
// shot 1 (hook): low down the street at the oncoming wall, closer + lower as it nears, ending ~11 m ahead of the front
const S1a = (f: number) => { const W = Wz(1, f); return dolly([0, D0 + 2.6, W + 22], [0, D0 + 4.5, W], pushK(f, 0, 0.0025), { fov: 44 }); };
const S1b = (f: number) => { const W = Wz(1, f); return dolly([2.5, D0 + 1.4, W + 14], [0, D0 + 3.5, W], pushK(f, 38, 0.002), { fov: 40, roll: -0.04 }); };
const S1c = (f: number) => { const W = Wz(1, f); return dolly([-2, D0 + 1.1, W + 12], [0, D0 + 4, W], pushK(f, 78, 0.003), { fov: 38, roll: 0.04 }); };
// shot 2 (setting): high aerial of the street + tank, then closer on the tank ("tangki" f204), then low with people
const S2a = (f: number) => zoom([30, 26, 30], [0, D0 + 4, -20], 44, pushK(f, 117, 0.002));
const S2b = (f: number) => zoom([18, D0 + 9, -5], [0, D0 + 8, -40], 42, pushK(f, 185, 0.002));
const S2c = (f: number) => zoom([10, D0 + 3, 5], [0, D0 + 6, -38], 40, pushK(f, 255, 0.0015, 0.006, 35));
// shot 3: tank-base CU on the leaking seam, then down to the drip puddle
const S3a = (f: number) => dolly([6, D0 + 1.9, -21.5], [5, D0 + 1.4, -27.6], pushK(f, 322, 0.0025), { fov: 36 });
const S3b = (f: number) => dolly([4.5, D0 + 0.7, -23], [5.5, D0 + 0.15, -27.2], pushK(f, 395, 0.002), { fov: 34 });
// shot 4: MS of the bucket crew at the tank base, then the painter up the ladder ("cokelat" f553)
const S4a = (f: number) => dolly([-8, D0 + 2.1, -17], [0, D0 + 1.4, -26.5], pushK(f, 461, 0.002), { fov: 40 });
const S4b = (f: number) => dolly([7.5, D0 + 2.6, -19], [4.2, D0 + 1.8, -26.0], pushK(f, 535, 0.002), { fov: 38, roll: -0.03 });
// shot 5: tanker pipe + tank wide, then closer as the groan builds ("mengerang" f741)
const S5a = (f: number) => dolly([-14, D0 + 4.5, -6], [0, D0 + 7, -36], pushK(f, 604, 0.002), { fov: 42 });
const S5b = (f: number) => dolly([-6, D0 + 2.2, -15], [0, D0 + 6, -31], pushK(f, 690, 0.0015, 0.006, 30), { fov: 38, roll: 0.035 });
// shot 6: tank wide in anticipation, then a high angle retreating ahead of the newborn wave (burst f810), rivets past the lens ("beterbangan" f840)
const S6a = (f: number) => dolly([12, D0 + 5, 2], [0, D0 + 7, -38], pushK(f, 761, 0.002), { fov: 42 });
const S6b = (f: number) => { const W = Wz(6, f); return dolly([10, D0 + 14, W + 26], [0, D0 + 4, W - 10], pushK(f, 800, 0.0025, 0.006, 35), { fov: 42 }); };
const S6c = (f: number) => { const W = Wz(6, f); return dolly([-12, D0 + 12, W + 14], [0, D0 + 4, W - 4], pushK(f, 858, 0.002), { fov: 40, roll: -0.04 }); };
// shot 7: low ahead of the rushing front, cut to the railway as the train lifts ("kereta" f1017), then a high wide
const S7a = (f: number) => { const W = Wz(7, f); return dolly([0, D0 + 2.2, W + 16], [0, D0 + 4, W], pushK(f, 935, 0.002), { fov: 42 }); };
const S7b = (f: number) => dolly([-6, D0 + 4.5, 16], [RAIL_X, D0 + 9.8, TRAIN_Z], pushK(f, 985, 0.0025), { fov: 38, roll: 0.03 });
const S7c = (f: number) => dolly([14, D0 + 8, 56], [0, D0 + 3, 22], pushK(f, 1020, 0.002), { fov: 44 });
// shot 8: the stopped front, thick and still looming (shared location with shot 9)
const S8a = (f: number) => dolly([5, D0 + 2.1, 82], [0, D0 + 2.5, 73], pushK(f, 1047, 0.0018), { fov: 40, roll: -0.03 });
// shot 9: waist-deep townsfolk in the pool, closer on "nggak bisa bergerak" (f1211)
const S9a = (f: number) => dolly([3.5, D0 + 1.6, 62], [0, D0 + 0.9, 52], pushK(f, 1136, 0.0018), { fov: 40 });
const S9b = (f: number) => dolly([2, D0 + 1.2, 58], [0, D0 + 0.8, 51], pushK(f, 1185, 0.002), { fov: 37, roll: 0.04 });
// shot 10: the stuck boot CU, molasses stretching as he pulls (cameras stay above the pool surface, D0+0.8)
const S10a = (f: number) => dolly([1.6, D0 + 1.25, 54.6], [0.1, D0 + 0.9, 51.6], pushK(f, 1228, 0.002), { fov: 36 });
const S10b = (f: number) => dolly([1.3, D0 + 1.1, 54.0], [0.15, D0 + 0.85, 51.6], pushK(f, 1300, 0.0025), { fov: 34, roll: -0.03 });
// shot 11: the honey spoon (golden): big spoon card on the table, drip close
const S11a = (f: number) => dolly([SPOON[0], D0 + 2.3, SPOON[2] - 8.5], [SPOON[0], D0 + 1.9, SPOON[2]], pushK(f, 1362, 0.002), { fov: 38 });
const S11b = (f: number) => dolly([SPOON[0] + 0.6, D0 + 1.9, SPOON[2] - 7], [SPOON[0], D0 + 1.9, SPOON[2]], pushK(f, 1410, 0.0025), { fov: 34 });
// shot 12: the walking wall (golden): low, the wall advances and looms, never reaching the lens
const S12a = (f: number) => dolly([0, D0 + 3.2, 64], [0, D0 + 5.5, 44], pushK(f, 1470, 0.0016), { fov: 42 });
const S12b = (f: number) => dolly([-3, D0 + 2.4, 62], [0, D0 + 6, 46], pushK(f, 1525, 0.002, 0.006, 30), { fov: 40, roll: 0.04 });
// shot 13: the engineer at his desk, closer on the signing ("insinyur" f1665)
const S13a = (f: number) => dolly([OFFICE[0], D0 + 2.1, OFFICE[2] - 8], [OFFICE[0], D0 + 1.6, OFFICE[2]], pushK(f, 1585, 0.002), { fov: 40 });
const S13b = (f: number) => dolly([OFFICE[0] + 1.4, D0 + 1.9, OFFICE[2] - 4.5], [OFFICE[0] + 0.3, D0 + 1.35, OFFICE[2]], pushK(f, 1645, 0.0025), { fov: 36 });
// shot 14: summer street, people sniffing the air, then a crane out to the end (picture moving to the last frame)
const S14a = (f: number) => dolly([6, D0 + 2.6, 32], [0, D0 + 2, 12], pushK(f, 1753, 0.002), { fov: 40 });
const S14b = (f: number) => dolly([3, D0 + 2.2, 26], [0, D0 + 1.9, 14], pushK(f, 1790, 0.0015, 0.006, 32), { fov: 38 });
const CRANE: V3[] = [[0, 18, -16], [17, 15, -44], [0, 7, 2]];
const S14c = (f: number): Shot => {
  const a = S14b(1820), s = glide((f - 1820) / 59), r = 1 - s, [C, B, L] = CRANE;
  return { pos: [0, 1, 2].map((i) => r * r * a.pos[i] + 2 * s * r * C[i] + s * s * B[i]) as V3,
    look: [0, 1, 2].map((i) => a.look[i] + (L[i] - a.look[i]) * s) as V3, fov: (a.fov ?? 40) + (44 - (a.fov ?? 40)) * s, roll: 0 };
};

const CAMS: Record<number, Key[]> = {
  1: [
    { f: 0, s: S1a },
    { f: 38, dur: 32, s: S1b }, // centred on 54, roll to -0.04
    { f: 78, dur: 28, s: S1c }, // centred on 92, roll -0.04 -> +0.04
  ],
  2: [
    { f: 117, s: S2a },
    { f: 185, dur: 18, s: S2b }, // centred on 194, just before "tangki" f204
    { f: 255, dur: 18, s: S2c },
  ],
  3: [
    { f: 322, s: S3a }, // cut on "Tangki itu dibangun"
    { f: 395, dur: 30, s: S3b }, // centred on 410, down to the puddle
  ],
  4: [
    { f: 461, s: S4a }, // cut on "Warga nampungin"
    { f: 535, dur: 28, s: S4b }, // centred on 549, just before "cokelat" f553
  ],
  5: [
    { f: 604, s: S5a }, // cut on "Sehari sebelumnya"
    { f: 690, dur: 30, s: S5b }, // centred on 705, push + roll as the groan builds
  ],
  6: [
    { f: 761, s: S6a }, // cut on "Jam setengah satu"
    { f: 800, cut: true, s: S6b }, // cut just before "meledak" f810 (+ kick)
    { f: 858, dur: 24, s: S6c }, // centred on 870, rivets past the lens
  ],
  7: [
    { f: 935, s: S7a }, // cut on "meluncur" f935
    { f: 985, cut: true, s: S7b }, // cut to the railway, lift peaks as "kereta" f1017 lands
    { f: 1020, cut: true, s: S7c }, // cut to the high wide on "relnya"
  ],
  8: [{ f: 1047, s: S8a }],
  9: [
    { f: 1136, s: S9a }, // cut on "Sayangnya"
    { f: 1185, dur: 20, s: S9b }, // centred on 1195, closer before "nggak bisa bergerak" f1211
  ],
  10: [
    { f: 1228, s: S10a }, // cut on "Tunggu"
    { f: 1300, dur: 24, s: S10b }, // centred on 1312, on "40 persen"
  ],
  11: [
    { f: 1362, s: S11a }, // cut (xfade) on "Pernah nuang madu"
    { f: 1410, dur: 24, s: S11b }, // centred on 1422, the drip
  ],
  12: [
    { f: 1470, s: S12a }, // cut on "dijatuhin" f1474
    { f: 1525, dur: 28, s: S12b }, // centred on 1539, "tembok berjalan" f1567-1585
  ],
  13: [
    { f: 1585, s: S13a }, // cut (xfade) on "Boston lalu mewajibkan"
    { f: 1645, dur: 24, s: S13b }, // centred on 1657, just before "insinyur" f1665
  ],
  14: [
    { f: 1753, s: S14a }, // cut (xfade) on "Puluhan tahun kemudian"
    { f: 1790, dur: 30, s: S14b }, // centred on 1805, on "musim panas" f1797
    { f: 1820, cut: true, s: S14c }, // crane pull-out to the end
  ],
};

// impact kicks (reference v14): the image offset flips sign every frame (~3 px at 720p per unit), decays to 0 in
// 7 f, roll +-0.23 deg per unit; they start on the first frame at/after the event. No hand-held float.
// [time seconds, gain]: the burst, the wave surge on "meluncur", the train dropping back askew.
const KICKS: [number, number][] = [[BURST, 1.2], [31.18, 0.6], [33.4, 0.8]];
export const kickAt = (t: number) => {
  let a = 0;
  for (const [t0, g] of KICKS) {
    const n = Math.floor((t - t0) * FPS + 1e-6);
    if (n >= 0 && n < 7) a += g * (n % 2 ? -1 : 1) * (1 - n / 7) ** 1.5;
  }
  return a;
};
export const camAt = (id: number, f: number): Cam => {
  const c = run(CAMS[id], f), a = kickAt(T(f));
  if (!a) return c;
  const d: V3 = [c.look[0] - c.pos[0], c.look[1] - c.pos[1], c.look[2] - c.pos[2]];
  const L = Math.hypot(...d), h = Math.hypot(d[0], d[2]) || 1;
  const m = (3 / 640) * Math.tan((c.fov * Math.PI) / 360) * L * a; // metres at the look distance for 3 px x a
  return { ...c, look: [c.look[0] - (d[2] / h) * m, c.look[1] + 0.6 * m, c.look[2] + (d[0] / h) * m], roll: c.roll + a * 0.004 };
};
/** frame at which the current key's move has finished (for picking billboard views per key, not per frame) */
export const keyEnd = (id: number, f: number) => {
  let e = 0;
  for (const k of CAMS[id]) if (f >= k.f) e = k.f + (k.cut ? 0 : k.dur ?? 24);
  return Math.max(f, e);
};

// ---------------- lens: depth of field + foreground framing ----------------
/** Lens blur per shot (thin lens). cInf = blur-disc radius in px at 1080x1920 for things at infinity; 0 = all sharp.
 *  Reference: DOF on in ~1/3 of shots; when on, background sigma720 CU 4.2, MS 4.0, FS 2.7, WS 1.9,
 *  foreground objects 4-8 (disc radius at 1080p = 3 x sigma720). Establishing/wide/most full shots stay sharp.
 *  Entries switch on cuts (no dur) or ramp with the camera glide they share f/dur with. focus = world point (else the
 *  camera look point). */
export type Dof = { f: number; dur?: number; cInf: number; focus?: (f: number) => V3 };
export const DOF: Dof[] = [
  { f: 0, cInf: 15, focus: (f) => [0, D0 + 4, Wz(1, f)] }, // hook: the wall sharp, street soft
  { f: 117, cInf: 0 }, // setting aerial (establishing, under the flash)
  { f: 185, dur: 18, cInf: 10, focus: () => [0, D0 + 8, -40] }, // tank MS, town soft behind
  { f: 322, cInf: 14, focus: () => [5, D0 + 1.4, -27.6] }, // leak seam CU
  { f: 395, dur: 30, cInf: 14, focus: () => [5.5, D0 + 0.15, -27.2] }, // drip puddle CU
  { f: 461, cInf: 10, focus: () => [0, D0 + 1.4, -26.5] }, // bucket crew MS
  { f: 535, dur: 28, cInf: 12, focus: () => [4.2, D0 + 1.8, -26.0] }, // painter MS
  { f: 604, cInf: 0 }, // filling wide
  { f: 761, cInf: 0 }, // explosion: keep everything readable
  { f: 935, cInf: 10, focus: (f) => [0, D0 + 4, Wz(7, f)] }, // rushing front MS
  { f: 985, cInf: 12, focus: () => [RAIL_X, D0 + 9.8, TRAIN_Z] }, // train lift
  { f: 1020, cInf: 0 }, // high wide
  { f: 1047, cInf: 8, focus: () => [0, D0 + 2.5, 73] }, // stopped front
  { f: 1136, cInf: 12, focus: () => [0, D0 + 0.9, 52] }, // stuck faces
  { f: 1228, cInf: 15, focus: () => [0.15, D0 + 0.85, 51.6] }, // boot CU
  { f: 1362, cInf: 12, focus: () => [SPOON[0], D0 + 1.9, SPOON[2]] }, // spoon CU
  { f: 1470, cInf: 0 }, // walking wall wide
  { f: 1585, cInf: 10, focus: () => [OFFICE[0], D0 + 1.6, OFFICE[2]] }, // engineer MS
  { f: 1645, dur: 24, cInf: 14, focus: () => [OFFICE[0] + 0.3, D0 + 1.35, OFFICE[2]] }, // signing CU
  { f: 1753, cInf: 0 }, // summer street + crane out, sharp
];
export const dofAt = (f: number) => {
  let i = 0; while (i + 1 < DOF.length && f >= DOF[i + 1].f) i++;
  const d = DOF[i], p = DOF[Math.max(0, i - 1)];
  const k = d.dur ? Math.min(1, (f - d.f) / d.dur) : 1;
  return { cInf: p.cInf + (d.cInf - p.cInf) * k, focus: d.focus };
};
/** what the lens focuses on (DOF): the DOF table's focus point, else the camera look point */
export const focusAt = (id: number, f: number): V3 => {
  const d = dofAt(f);
  return d.focus ? d.focus(f) : camAt(id, f).look;
};

/** near framing objects: visible while a <= f < b; kit = a GLB name accepted by build.ts prop() */
// pos = base point (prop()'s x, y, z: the model's base sits on y), s = height in metres (prop()'s h), yaw in radians.
// They sit at 0.3-0.5 x the focus distance and cover 10-25 % of one frame edge, never a face; they are meant to be
// in front of the lens, so build them outside prop()'s sight-line test.
export type Fg = { a: number; b: number; kit: string; pos: V3; s?: number; yaw?: number };
export const FOREGROUND: Fg[] = [
  // ranges stay inside one shot (world.ts shows an entry only inside its own shot, so crossfade layers never see it).
  // bucket crew (S4a, focus ~10 m): a cart in the bottom-left corner at ~3 m from the lens
  { a: 461, b: 535, kit: "cart", pos: [-6.5, D0, -20.5], s: 0.85, yaw: 0.6 },
  // stuck townsfolk (S9a, focus ~10 m): a barrel (lantern kit reads as a small post; use a stall instead) in the pool edge
  { a: 1136, b: 1228, kit: "stall-bench", pos: [5.5, D0, 57.5], s: 0.9, yaw: -0.4 },
];
