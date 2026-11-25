// One three.js scene holding every set of "Di Dunia Ini Kamu Nggak Bisa Merasa Sakit" at x offsets
// (street 0, room 40, warung 80, dapur 120, lapangan 160, atap 200, xray 240, taman 280).
// update(id, f, camera, scene) poses everything for shot `id` at frame f (pure function of id + f).
// Shared machinery (Batch, lam, prop, paint, lights, shade, ink) is imported from the molasses kit.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getInputProps, staticFile } from "remotion";
import { Batch, Strand, boxGeo, quad, V, lam, prop, house, Kit } from "../molasses/build";
import { ctex, cobbleHD, grassHD, stoneHD, cloudHD, planksHD, beam, rep, facadeHD } from "../molasses/paint";
import { LIGHTS, LOOK, LightPreset } from "../molasses/lights";
import { TONE, CHAR, untone } from "../molasses/shade";
import { NOINK } from "../molasses/ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, D0, ROOF_Y, SHOTS, STREET, ROOM, WARUNG, DAPUR, LAPANGAN, ATAP, XRAY, TAMAN,
  camAt, smooth, clamp01, V3, ShotDef,
} from "./story";

const KENNEY = ["tree_oak", "tree_default", "tree_fat", "tree-high-round", "plant_bushLarge", "plant_bush",
  "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "lantern", "cart",
  "stall-red", "stall-green", "stall-bench", "banner-green"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

const discTex = () => ctex("sunDisc", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 58, 64, 64, 64); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const haloTex = () => ctex("sunHalo", 256, 256, (g) => {
  const im = g.createImageData(256, 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const u = Math.hypot(x - 127.5, y - 127.5) / 128;
    const a = (0.55 * Math.exp(-((u / 0.25) ** 2)) + 0.35 * Math.exp(-((u / 0.6) ** 2))) * (1 - Math.min(1, Math.max(0, (u - 0.8) / 0.2)));
    const i = (y * 256 + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = 255; im.data[i + 3] = Math.round(255 * Math.min(1, a));
  }
  g.putImageData(im, 0, 0);
});
/** xray lightbox picture: skeleton on dark blue-grey, nails (yellow), needle, spoon (orange) glowing inside */
const xrayTex = () => ctex("xrayDTS", 512, 640, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 640);
  gr.addColorStop(0, "#2c3e4e"); gr.addColorStop(1, "#1c2836");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 640);
  const bone = "#dfe8ee", dim = "#9fb4c4";
  g.strokeStyle = bone; g.lineWidth = 7; g.lineCap = "round";
  // skull
  g.beginPath(); g.ellipse(256, 96, 52, 60, 0, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#1c2836";
  g.beginPath(); g.ellipse(236, 92, 11, 14, 0, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.ellipse(276, 92, 11, 14, 0, 0, Math.PI * 2); g.fill();
  g.strokeStyle = bone; g.beginPath(); g.moveTo(238, 140); g.lineTo(274, 140); g.stroke();
  // spine
  for (let i = 0; i < 9; i++) { g.fillStyle = dim; g.fillRect(244, 168 + i * 26, 24, 16); }
  // ribs
  g.strokeStyle = bone; g.lineWidth = 6;
  for (let i = 0; i < 5; i++) {
    const y = 190 + i * 34, w = 92 - i * 9;
    g.beginPath(); g.ellipse(256, y, w, 26, 0, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }
  // pelvis + legs
  g.beginPath(); g.ellipse(256, 408, 66, 30, 0, 0, Math.PI * 2); g.stroke();
  g.lineWidth = 9;
  g.beginPath(); g.moveTo(228, 428); g.lineTo(216, 520); g.lineTo(222, 592); g.stroke();
  g.beginPath(); g.moveTo(284, 428); g.lineTo(296, 520); g.lineTo(290, 592); g.stroke();
  // arms
  g.lineWidth = 8;
  g.beginPath(); g.moveTo(196, 196); g.lineTo(150, 300); g.lineTo(142, 396); g.stroke();
  g.beginPath(); g.moveTo(316, 196); g.lineTo(362, 300); g.lineTo(370, 396); g.stroke();
  // nails (bright yellow): scattered in torso + legs
  g.strokeStyle = "#ffd94a"; g.lineWidth = 6;
  const nails: [number, number, number][] = [[220, 250, 0.4], [290, 290, -0.5], [250, 330, 0.9], [300, 360, 0.2], [230, 470, -0.7], [292, 500, 0.6], [240, 540, 0.1], [160, 330, 1.1], [352, 340, -0.3]];
  for (const [x, y, a] of nails) {
    const dx = Math.cos(a) * 17, dy = Math.sin(a) * 17;
    g.beginPath(); g.moveTo(x - dx, y - dy); g.lineTo(x + dx, y + dy); g.stroke();
    g.beginPath(); g.moveTo(x - dx - Math.sin(a) * 7, y - dy + Math.cos(a) * 7); g.lineTo(x - dx + Math.sin(a) * 7, y - dy - Math.cos(a) * 7); g.stroke();
  }
  // needle (thin, in the arm)
  g.strokeStyle = "#aee2ff"; g.lineWidth = 3;
  g.beginPath(); g.moveTo(150, 352); g.lineTo(196, 322); g.stroke();
  // spoon (orange, in the belly)
  g.strokeStyle = "#ffb84a"; g.lineWidth = 6;
  g.beginPath(); g.ellipse(262, 372, 15, 21, 0.5, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.moveTo(252, 388); g.lineTo(228, 424); g.stroke();
});

type Mats = Record<string, THREE.Material>;

export class World {
  root = new THREE.Group();
  private pool = new Pool();
  private actors: Actor[] = [];
  private fxs: Fx[] = [];
  private hemi: THREE.HemisphereLight; private sun: THREE.DirectionalLight; private fill: THREE.DirectionalLight;
  private sky: THREE.Mesh; private skyMat: THREE.ShaderMaterial;
  private fog = new THREE.Fog("#bccbec", 25, 420);
  private sunDisc: THREE.Sprite; private sunHalo: THREE.Sprite;
  private sunCache = new Map<number, THREE.Vector3>();
  private cloudMaps: Record<"day" | "golden", THREE.Texture[]>;
  private clouds: THREE.Mesh[] = [];
  private table: THREE.Group;
  private ball: THREE.Mesh;
  private motor: THREE.Group;
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light (same rig as molasses) ----
    this.skyMat = new THREE.ShaderMaterial({
      uniforms: { c0: { value: new THREE.Color() }, c1: { value: new THREE.Color() }, c2: { value: new THREE.Color() },
        c3: { value: new THREE.Color() }, c4: { value: new THREE.Color() }, e: { value: new THREE.Vector4() } },
      vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
      fragmentShader: `uniform vec3 c0, c1, c2, c3, c4; uniform vec4 e; varying vec3 vP;
        void main(){ float el = asin(clamp(normalize(vP).y, -1.0, 1.0));
          vec3 c = mix(c0, c1, smoothstep(0.0, e.x, el));
          c = mix(c, c2, smoothstep(e.x, e.y, el));
          c = mix(c, c3, smoothstep(e.y, e.z, el));
          c = mix(c, c4, smoothstep(e.z, e.w, el));
          gl_FragColor = vec4(c, 1.0); }`,
      side: THREE.BackSide, depthWrite: false, fog: false,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1100, 48, 24), this.skyMat);
    this.sky.renderOrder = -1; this.sky.frustumCulled = false; this.sky.layers.set(NOINK);
    R.add(this.sky);
    this.sunDisc = new THREE.Sprite(new THREE.SpriteMaterial({ map: discTex(), color: new THREE.Color(6.0, 4.4, 2.4), fog: false, depthWrite: false }));
    this.sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: haloTex(), color: new THREE.Color(1, 1, 1), fog: false, depthWrite: false, depthTest: true,
      transparent: true, blending: THREE.AdditiveBlending }));
    this.sunDisc.renderOrder = -0.5; this.sunHalo.renderOrder = 5;
    for (const m of [this.sunDisc, this.sunHalo]) { m.frustumCulled = false; m.layers.set(NOINK); R.add(m); }
    this.hemi = new THREE.HemisphereLight("#cfe6ff", "#6c5c8c", 1.1);
    this.sun = new THREE.DirectionalLight("#fff0d6", 2.6);
    this.sun.castShadow = true;
    const shadowSize = (getInputProps() as { post?: { shadow?: number } }).post?.shadow ?? 2048;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(140 + Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- shared materials ----
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.stone = lam("copeHD", () => ({ map: stoneHD("copeHD") }));
    M.planks = lam("planksHD", () => ({ map: planksHD() }));
    M.wood = lam("wood", () => ({ map: beam() }));
    M.plaster = lam("dtsPlaster", () => ({ color: "#e8dcc4" }));
    M.warm = lam("dtsWarm", () => ({ color: "#eec9a0" }));
    M.pale = lam("dtsPale", () => ({ color: "#cfd8dc" }));
    M.trim = lam("dtsTrim", () => ({ color: "#efe3c8" }));
    M.darkWood = lam("dtsWood", () => ({ color: "#6e4b33" }));
    M.glass = lam("dtsGlass", () => ({ color: "#d8e8f2" }));
    M.iron = lam("dtsIron", () => ({ color: "#3d414c" }));
    M.steel = lam("dtsSteel", () => ({ color: "#7d8088" }));
    M.white = lam("dtsWhite", () => ({ color: "#f4f6f8" }));
    M.red = lam("dtsRed", () => ({ color: "#d43a2a" }));
    M.motorRed = lam("dtsMotorRed", () => ({ color: "#c0392b" }));
    M.black = lam("dtsBlack", () => ({ color: "#2b2b30" }));

    const b = new Batch();
    const S = STREET, Rm = ROOM, W = WARUNG, D = DAPUR, L = LAPANGAN, A = ATAP, X = XRAY, T = TAMAN;

    // ---- STREET set (shots 1, 7) ----
    b.add(quadUp(S[0] - 30, S[0] + 30, -30, 30, 30, 30, -0.05), M.grass);
    b.add(quadUp(S[0] - 20, S[0] + 20, -3.2, 3.2, 20, 3.2, 0.012), M.cobble); // road along x
    b.add(boxGeo(V(S[0] - 20, D0, -5), V(S[0] + 20, D0 + 0.14, -3.2), 2), M.stone);
    b.add(boxGeo(V(S[0] - 20, D0, 3.2), V(S[0] + 20, D0 + 0.14, 5), 2), M.stone);
    house(b, S[0] - 7, -10.5, 0, 8, 8, 7.5, 0);
    house(b, S[0] + 4, -10.5, 0, 9, 8, 8.4, 3);
    house(b, S[0] + 13, -10.5, 0, 7, 8, 7, 5);
    prop(b, kit, "tree_oak", S[0] - 11, D0, -6, 6, 0.4);
    prop(b, kit, "tree_fat", S[0] + 10, D0, -5.5, 5.5, 1.2);
    prop(b, kit, "lantern", S[0] - 5, D0, -4.2, 2.8);
    prop(b, kit, "lantern", S[0] + 7, D0, 4.2, 2.8);
    prop(b, kit, "cart", S[0] - 9, D0, 4.4, 1.6, 0.5);
    // the lamp pole the hero bumps into (shot 1), at x = +0.6 on his path
    b.add(new THREE.CylinderGeometry(0.07, 0.09, 4.2, 10), M.iron, new THREE.Matrix4().makeTranslation(S[0] + 0.6, D0 + 2.1, 0));
    b.add(new THREE.CylinderGeometry(0.16, 0.2, 0.3, 10), M.iron, new THREE.Matrix4().makeTranslation(S[0] + 0.6, D0 + 0.15, 0));
    b.add(new THREE.SphereGeometry(0.17, 12, 10), M.white, new THREE.Matrix4().makeTranslation(S[0] + 0.6, D0 + 4.3, 0));

    // ---- ROOM set (shots 2, 6, 9) ----
    b.add(quadUp(Rm[0] - 6, Rm[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(Rm[0] - 6, D0, 4), V(Rm[0] + 6, D0 + 5, 4.3), 2), M.plaster);
    b.add(boxGeo(V(Rm[0] - 6, D0 + 4.8, 3.9), V(Rm[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(Rm[0] - 3.6, D0 + 1.7, 3.96), V(Rm[0] - 1.6, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[-3.75, -1.45, 3.9, 4.05], [-3.75, -1.45, 1.55, 1.7], [-3.75, -3.6, 1.55, 4.05], [-1.6, -1.45, 1.55, 4.05]] as const)
      b.add(boxGeo(V(Rm[0] + x0, D0 + y0, 3.92), V(Rm[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // bed + rug + side cabinet
    b.add(boxGeo(V(Rm[0] - 5.2, D0, 1.8), V(Rm[0] - 3.2, D0 + 0.55, 3.6)), M.darkWood);
    b.add(boxGeo(V(Rm[0] - 5.1, D0 + 0.55, 1.9), V(Rm[0] - 3.3, D0 + 0.75, 3.5)), lam("dtsBed", () => ({ color: "#7ba7c9" })));
    b.add(boxGeo(V(Rm[0] - 5.0, D0 + 0.75, 3.0), V(Rm[0] - 3.9, D0 + 0.92, 3.5)), M.white);
    b.add(boxGeo(V(Rm[0] - 2.2, D0 + 0.02, -0.8), V(Rm[0] + 2.6, D0 + 0.06, 1.8)), lam("dtsRug", () => ({ color: "#b5653f" })));
    b.add(boxGeo(V(Rm[0] + 4.2, D0, 3.0), V(Rm[0] + 5.2, D0 + 1.1, 3.9)), M.darkWood);
    // wall socket (shot 9)
    b.add(boxGeo(V(Rm[0] + 2.05, D0 + 0.32, 3.9), V(Rm[0] + 2.35, D0 + 0.52, 4.02)), M.white);
    // picture frame on the back wall (visible in shots 2, 6, 9)
    b.add(boxGeo(V(Rm[0] - 0.15, D0 + 2.45, 3.92), V(Rm[0] + 1.35, D0 + 3.65, 4.0)), M.darkWood);
    b.add(boxGeo(V(Rm[0] + 0.0, D0 + 2.6, 3.9), V(Rm[0] + 1.2, D0 + 3.5, 3.96)), lam("dtsPoster", () => ({ color: "#7ba7c9" })));
    b.add(boxGeo(V(Rm[0] + 0.15, D0 + 2.75, 3.88), V(Rm[0] + 0.55, D0 + 3.15, 3.92)), lam("dtsPosterSun", () => ({ color: "#e8c85a" })));
    prop(b, kit, "lantern", Rm[0] + 4.6, D0, 1.2, 1.5);

    // ---- WARUNG set (shot 3) ----
    b.add(quadUp(W[0] - 14, W[0] + 14, -14, 14, 14, 14, -0.05), M.grass);
    b.add(quadUp(W[0] - 7, W[0] + 7, -4, 5, 7, 4.5, 0.012), M.stone);
    prop(b, kit, "stall-red", W[0], D0, 1.9, 3.4, Math.PI);
    b.add(boxGeo(V(W[0] - 2.2, D0, 0.75), V(W[0] + 2.2, D0 + 0.95, 1.35)), M.wood); // counter
    b.add(boxGeo(V(W[0] - 2.3, D0 + 0.95, 0.7), V(W[0] + 2.3, D0 + 1.02, 1.4)), M.darkWood);
    // chili pile: little red cones heaped on the counter + a basket
    b.add(new THREE.CylinderGeometry(0.42, 0.34, 0.3, 12), M.wood, new THREE.Matrix4().makeTranslation(W[0] - 0.2, D0 + 1.17, 1.05));
    const chiliGeo = new THREE.ConeGeometry(0.045, 0.2, 6);
    let seed = 7;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 26; i++) {
      const a = rnd() * Math.PI * 2, r = rnd() * 0.34, x = W[0] - 0.2 + Math.cos(a) * r, z = 1.05 + Math.sin(a) * r * 0.7;
      const m = new THREE.Matrix4().compose(V(x, D0 + 1.3 + rnd() * 0.1, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 1.2 - 0.6, rnd() * 6.3, rnd() * 1.2 - 0.6)), V(1, 1, 1));
      b.add(chiliGeo, M.red, m);
    }
    for (let i = 0; i < 8; i++) { // a few loose chilies on the counter
      const m = new THREE.Matrix4().compose(V(W[0] - 1.4 + rnd() * 2.6, D0 + 1.06, 0.9 + rnd() * 0.4),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, rnd() * 6.3, 0)), V(1, 1, 1));
      b.add(chiliGeo, M.red, m);
    }
    b.add(boxGeo(V(W[0] + 2.9, D0, 0.4), V(W[0] + 3.7, D0 + 0.6, 1.2)), M.wood); // crate
    prop(b, kit, "tree_default", W[0] - 6.5, D0, -3, 6, 0.9);
    prop(b, kit, "banner-green", W[0] + 5.2, D0, 0.5, 3.2, -0.4);

    // ---- DAPUR set (shot 4) ----
    b.add(quadUp(D[0] - 6, D[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(D[0] - 6, D0, 4), V(D[0] + 6, D0 + 5, 4.3), 2), M.warm);
    b.add(boxGeo(V(D[0] - 6, D0 + 4.8, 3.9), V(D[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(D[0] + 1.6, D0 + 1.7, 3.96), V(D[0] + 3.6, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[1.45, 3.75, 3.9, 4.05], [1.45, 3.75, 1.55, 1.7], [1.45, 1.6, 1.55, 4.05], [3.6, 3.75, 1.55, 4.05]] as const)
      b.add(boxGeo(V(D[0] + x0, D0 + y0, 3.92), V(D[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // stove counter + burners + the hot pan
    b.add(boxGeo(V(D[0] - 1.8, D0, 0.75), V(D[0] + 1.8, D0 + 0.9, 1.55)), M.wood);
    b.add(boxGeo(V(D[0] - 1.85, D0 + 0.9, 0.7), V(D[0] + 1.85, D0 + 0.97, 1.6)), M.black);
    for (const bx of [-0.9, 1.15]) b.add(new THREE.CylinderGeometry(0.24, 0.24, 0.04, 16), M.iron, new THREE.Matrix4().makeTranslation(D[0] + bx, D0 + 0.99, 1.15));
    b.add(new THREE.CylinderGeometry(0.32, 0.28, 0.09, 18), M.iron, new THREE.Matrix4().makeTranslation(D[0] + 1.15, D0 + 1.05, 1.15)); // pan (beside the hero so it reads)
    b.add(boxGeo(V(D[0] + 1.45, D0 + 1.05, 1.1), V(D[0] + 1.92, D0 + 1.1, 1.2)), M.black); // pan handle
    // shelf + jars
    b.add(boxGeo(V(D[0] - 4.2, D0 + 2.3, 3.7), V(D[0] - 1.2, D0 + 2.38, 4.0)), M.darkWood);
    for (let i = 0; i < 4; i++)
      b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 10), lam("dtsJar" + i, () => ({ color: ["#c9775a", "#7ba7c9", "#e8c85a", "#8ab86a"][i] })),
        new THREE.Matrix4().makeTranslation(D[0] - 3.9 + i * 0.75, D0 + 2.54, 3.85));
    // hanging lamp
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), M.black, new THREE.Matrix4().makeTranslation(D[0], D0 + 4.4, 0.6));
    b.add(new THREE.ConeGeometry(0.3, 0.26, 12, 1, true), lam("dtsLamp", () => ({ color: "#2f5f43", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(D[0], D0 + 3.72, 0.6));

    // ---- LAPANGAN set (shot 5) ----
    b.add(quadUp(L[0] - 26, L[0] + 26, -22, 26, 26, 24, -0.05), M.grass);
    b.add(boxGeo(V(L[0] - 9, D0 + 0.01, 2.4), V(L[0] + 9, D0 + 0.05, 2.7)), M.white); // field line
    // goal at z = +6
    for (const s of [-1, 1]) b.add(boxGeo(V(L[0] + s * 2.2 - 0.07, D0, 5.93), V(L[0] + s * 2.2 + 0.07, D0 + 2.2, 6.07)), M.white);
    b.add(boxGeo(V(L[0] - 2.27, D0 + 2.06, 5.93), V(L[0] + 2.27, D0 + 2.2, 6.07)), M.white);
    prop(b, kit, "tree_oak", L[0] - 9, D0, 9, 7, 0.3);
    prop(b, kit, "tree_fat", L[0] + 10, D0, 8, 6, 1.1);
    prop(b, kit, "hedge", L[0] - 6, D0, 12, 1.2, 0);
    prop(b, kit, "hedge", L[0] + 6, D0, 12, 1.2, 0);
    prop(b, kit, "plant_bush", L[0] + 7, D0, -4, 1.1, 0.5);

    // ---- ATAP set (shot 8): flat-roof building, roof surface at ROOF_Y ----
    b.add(quadUp(A[0] - 26, A[0] + 26, -24, 24, 26, 24, -0.05), M.grass);
    b.add(quadUp(A[0] - 14, A[0] + 14, -6, 8, 14, 7, 0.012), M.cobble);
    const facade = lam("dtsFacade", () => ({ map: facadeHD("dtsFacade", 10, 12, { wall: "#e2c49a", shutter: "#2f5f6a", door: true }), side: THREE.DoubleSide }));
    const sideM = lam("dtsSide", () => ({ color: "#d8b98e", side: THREE.DoubleSide }));
    const bw = 5, bd = 4, bh = 12;
    b.add(quad(V(A[0] - bw, D0, A[2] - bd), V(A[0] + bw, D0, A[2] - bd), V(A[0] + bw, D0 + bh, A[2] - bd), V(A[0] - bw, D0 + bh, A[2] - bd)), facade);
    b.add(quad(V(A[0] + bw, D0, A[2] + bd), V(A[0] - bw, D0, A[2] + bd), V(A[0] - bw, D0 + bh, A[2] + bd), V(A[0] + bw, D0 + bh, A[2] + bd)), sideM);
    b.add(quad(V(A[0] - bw, D0, A[2] + bd), V(A[0] - bw, D0, A[2] - bd), V(A[0] - bw, D0 + bh, A[2] - bd), V(A[0] - bw, D0 + bh, A[2] + bd)), sideM);
    b.add(quad(V(A[0] + bw, D0, A[2] - bd), V(A[0] + bw, D0, A[2] + bd), V(A[0] + bw, D0 + bh, A[2] + bd), V(A[0] + bw, D0 + bh, A[2] - bd)), sideM);
    b.add(quadUp(A[0] - bw, A[0] + bw, A[2] - bd, A[2] + bd, 5, 4, bh + 0.0), M.stone); // roof slab at ROOF_Y
    for (const [x0, x1, z0, z1] of [[-bw, bw, -bd, -bd + 0.25], [-bw, bw, bd - 0.25, bd], [-bw, -bw + 0.25, -bd, bd], [bw - 0.25, bw, -bd, bd]] as const)
      b.add(boxGeo(V(A[0] + x0, ROOF_Y, A[2] + z0), V(A[0] + x1, ROOF_Y + 0.5, A[2] + z1), 2), M.stone); // parapet
    b.add(boxGeo(V(A[0] - 3.4, ROOF_Y, A[2] + 1.8), V(A[0] - 1.6, ROOF_Y + 1.1, A[2] + 3.4)), M.darkWood); // roof shed
    house(b, A[0] - 13, -8, 0.3, 8, 8, 7, 2);
    prop(b, kit, "tree_default", A[0] + 9, D0, 3, 6.5, 0.7);

    // ---- XRAY set (shot 10) ----
    b.add(quadUp(X[0] - 6, X[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(X[0] - 6, D0, 4), V(X[0] + 6, D0 + 5, 4.3), 2), M.pale);
    b.add(boxGeo(V(X[0] - 6, D0 + 4.8, 3.9), V(X[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(X[0] - 1.3, D0 + 0.5, 2.05), V(X[0] + 1.3, D0 + 3.3, 2.25)), M.iron); // lightbox frame
    b.add(boxGeo(V(X[0] - 3.4, D0, 0.6), V(X[0] - 1.6, D0 + 0.75, 1.6)), M.steel); // exam table
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14), M.darkWood, new THREE.Matrix4().makeTranslation(X[0] + 2.6, D0 + 0.55, 1.2));
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), M.steel, new THREE.Matrix4().makeTranslation(X[0] + 2.6, D0 + 0.27, 1.2));
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 2.6), new THREE.MeshBasicMaterial({ map: xrayTex() }));
    screen.position.set(X[0], D0 + 1.9, 2.04); screen.rotation.y = Math.PI;
    R.add(screen);

    // ---- TAMAN set (shot 11, golden) ----
    b.add(quadUp(T[0] - 30, T[0] + 30, -28, 28, 30, 28, -0.05), M.grass);
    b.add(quadUp(T[0] - 2.2, T[0] + 2.2, -14, 14, 2.2, 14, 0.015), M.stone); // path
    prop(b, kit, "stall-bench", T[0] + 2.6, D0, 2.2, 1.0, -Math.PI / 2);
    prop(b, kit, "tree_oak", T[0] - 5.5, D0, 4.5, 7.5, 0.2);
    prop(b, kit, "tree_fat", T[0] + 6.5, D0, 5.5, 6.5, 1.4);
    prop(b, kit, "tree-high-round", T[0] - 8, D0, -2, 8, 0.8);
    prop(b, kit, "hedge", T[0] - 4, D0, 8, 1.2, 0);
    prop(b, kit, "hedge", T[0] + 4.5, D0, 8, 1.2, 0);
    prop(b, kit, "flower_redA", T[0] - 3.2, D0, 1.2, 0.5, 0.3);
    prop(b, kit, "flower_yellowA", T[0] + 3.4, D0, 0.6, 0.5, 1.1);
    prop(b, kit, "flower_purpleA", T[0] - 2.6, D0, -1.6, 0.5, 2.0);
    prop(b, kit, "plant_bushLarge", T[0] + 5.5, D0, -2.5, 1.4, 0.6);
    prop(b, kit, "lantern", T[0] - 3.4, D0, -3.5, 2.8);

    b.build(R);

    // ---- room table (shot 2): slides when the toe hits it ----
    this.table = new THREE.Group();
    const tTop = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.08, 0.95), M.wood);
    tTop.position.y = 0.74; tTop.castShadow = true; tTop.receiveShadow = true;
    this.table.add(tTop);
    for (const [lx, lz] of [[-0.75, -0.38], [0.75, -0.38], [-0.75, 0.38], [0.75, 0.38]] as const) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.74, 0.09), M.darkWood);
      leg.position.set(lx, 0.37, lz); leg.castShadow = true; this.table.add(leg);
    }
    this.table.position.set(ROOM[0] + 0.6, D0, ROOM[2] + 0.6);
    R.add(this.table);

    // ---- charger cable on the room floor (shot 9) ----
    const cable = new Strand(10, 0.05, 0.05, lam("dtsCable", () => ({ color: "#2b2b30" })), 1, false);
    cable.set([
      V(ROOM[0] + 2.2, D0 + 0.42, 3.95), V(ROOM[0] + 2.15, D0 + 0.1, 3.4), V(ROOM[0] + 1.9, D0 + 0.05, 2.6),
      V(ROOM[0] + 1.5, D0 + 0.05, 1.9), V(ROOM[0] + 1.7, D0 + 0.05, 1.3), V(ROOM[0] + 1.3, D0 + 0.05, 0.5),
      V(ROOM[0] + 1.55, D0 + 0.06, 0.0), V(ROOM[0] + 1.35, D0 + 0.35, -0.15), V(ROOM[0] + 1.3, D0 + 0.7, -0.2),
      V(ROOM[0] + 1.35, D0 + 0.95, -0.2),
    ]);
    R.add(cable.mesh);

    // ---- soccer ball (shot 5) ----
    const ballTex = ctex("dtsBall", 256, 128, (g) => {
      g.fillStyle = "#f4f6f8"; g.fillRect(0, 0, 256, 128);
      g.fillStyle = "#2b2b30";
      for (const [x, y] of [[32, 32], [96, 80], [160, 28], [224, 84], [64, 108], [192, 112]] as const) {
        g.beginPath(); g.arc(x, y, 13, 0, Math.PI * 2); g.fill();
      }
    });
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 18, 14), lam("dtsBall", () => ({ map: ballTex })));
    this.ball.castShadow = true;
    this.ball.position.set(LAPANGAN[0] + 0.35, D0 + 0.22, LAPANGAN[2] + 1.35);
    R.add(this.ball);

    // ---- motorcycle (shot 7): simple cartoon build, travels +x ----
    this.motor = new THREE.Group();
    const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.1, 16); wheelGeo.rotateX(Math.PI / 2);
    for (const wx of [-0.62, 0.62]) {
      const w = new THREE.Mesh(wheelGeo, M.black);
      w.position.set(wx, 0.32, 0); w.castShadow = true; this.motor.add(w);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.12, 10).rotateX(Math.PI / 2), M.steel);
      hub.position.set(wx, 0.32, 0); this.motor.add(hub);
    }
    const mBody = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.3, 0.24), M.motorRed);
    mBody.position.set(-0.05, 0.62, 0); mBody.rotation.z = 0.12; mBody.castShadow = true; this.motor.add(mBody);
    const tank2 = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.24, 0.26), M.motorRed);
    tank2.position.set(0.28, 0.8, 0); tank2.rotation.z = -0.15; tank2.castShadow = true; this.motor.add(tank2);
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.24), M.black);
    seat.position.set(-0.38, 0.82, 0); seat.castShadow = true; this.motor.add(seat);
    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.85, 8), M.steel);
    fork.position.set(0.55, 0.62, 0); fork.rotation.z = 0.35; this.motor.add(fork);
    const bars = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.55, 8).rotateX(Math.PI / 2), M.steel);
    bars.position.set(0.42, 1.02, 0); this.motor.add(bars);
    const lampM = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.9) }));
    lampM.position.set(0.66, 0.88, 0); this.motor.add(lampM);
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 8).rotateZ(Math.PI / 2), M.steel);
    exhaust.position.set(-0.35, 0.3, 0.14); this.motor.add(exhaust);
    this.motor.position.set(STREET[0] - 14, D0, STREET[2] - 0.8);
    this.motor.visible = false;
    R.add(this.motor);
  }

  /** camera-relative sun, frozen per shot (same approach as molasses) */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const az = THREE.MathUtils.degToRad(L.az), el = THREE.MathUtils.degToRad(L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az);
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], L = LIGHTS[s.light];
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK);
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30);
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0;
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    const su = this.skyMat.uniforms;
    K.sky.c.forEach((h, i) => untone(h, su["c" + i].value));
    const e = K.sky.e.map((deg) => THREE.MathUtils.degToRad(deg));
    su.e.value.set(e[1], e[2], e[3], e[4]);
    this.sky.position.copy(cam.position);
    untone(L.fog, this.fog.color); this.fog.near = L.fogNear; this.fog.far = L.fogFar;
    scene.fog = this.fog; scene.background = null;
    const showSun = s.light === "golden";
    this.sunDisc.visible = this.sunHalo.visible = showSun;
    if (showSun) {
      this.sunDisc.position.copy(cam.position).addScaledVector(sunDir, 900);
      this.sunDisc.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(1.7)));
      this.sunHalo.position.copy(this.sunDisc.position); this.sunHalo.scale.setScalar(2 * 900 * Math.tan(THREE.MathUtils.degToRad(24)));
      (this.sunHalo.material as THREE.SpriteMaterial).color.set(L.sunDisc).multiplyScalar(1.3);
    }
    for (let i = 0; i < this.clouds.length; i++) {
      const m = this.clouds[i], mat = m.material as THREE.MeshBasicMaterial;
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- animated props ----
    // room table slides +x when the toe hits it (f160)
    this.table.position.x = ROOM[0] + 0.6 + 0.55 * smooth((f - 160) / 16);
    // soccer ball: rest -> kicked at f711 -> arcs into the goal
    if (f < 711) this.ball.position.set(LAPANGAN[0] + 0.35, D0 + 0.22, LAPANGAN[2] + 1.35);
    else if (f < 756) {
      const u = (f - 711) / 45;
      this.ball.position.set(
        LAPANGAN[0] + 0.35 + u * 1.1,
        D0 + 0.22 + Math.sin(u * Math.PI) * 1.9,
        LAPANGAN[2] + 1.35 + u * 4.6,
      );
      this.ball.rotation.x = -u * 9;
    } else this.ball.position.set(LAPANGAN[0] + 1.45, D0 + 0.22, LAPANGAN[2] + 5.95);
    // motorcycle: races in during shot 7, hits at f945, tips over
    this.motor.visible = id === 7;
    if (id === 7) {
      if (f < 945) {
        const u = (f - 934) / 11;
        this.motor.position.x = STREET[0] - 3.4 + u * 2.5; // enters frame ~f936, hits at f945
        this.motor.rotation.set(0, 0, 0);
        this.motor.position.y = D0;
      } else {
        const tip = smooth((f - 945) / 14);
        this.motor.position.x = STREET[0] - 0.9 + tip * 0.7;
        this.motor.rotation.x = tip * 1.25;
        this.motor.position.y = D0 + tip * 0.12;
      }
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, { pos: cam.position, right, sun: sunDir });
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    let ai = 0;
    const used: Actor[] = [];
    for (const p of st.places) {
      const sc2 = p.scale ?? 1;
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y + 1.1 * sc2, p.z), 3.5))) continue;
      const a = this.actor(ai++);
      const [w, h, k] = p.size ?? [300, 500, 0.5];
      a.r = this.pool.req(p.key, w, h, k, p.draw);
      a.mesh.visible = true;
      a.mesh.position.set(p.x, p.y, p.z);
      a.mesh.rotation.set(0, p.yaw ?? Math.atan2(cam.position.x - p.x, cam.position.z - p.z), p.roll ?? 0);
      a.mesh.scale.set(p.mirror ? -sc2 : sc2, sc2, sc2);
      a.mesh.castShadow = L.actorShadow;
      used.push(a);
    }
    for (let i = ai; i < this.actors.length; i++) this.actors[i].mesh.visible = false;
    let fi = 0;
    const fused: Fx[] = [];
    for (const p of st.fx) {
      if (!this.frustum.intersectsSphere(this.sph.set(this.v.set(p.x, p.y, p.z), Math.max(p.w, p.h)))) continue;
      const e = this.fx(fi++);
      e.r = this.pool.req(p.key, p.cw, p.ch, 1, p.draw);
      e.use(!!p.soft);
      e.mesh.visible = true;
      e.mesh.position.set(p.x, p.y, p.z);
      if (p.flat) e.mesh.rotation.set(-Math.PI / 2, 0, p.rot ?? 0);
      else { e.mesh.quaternion.copy(cam.quaternion); e.mesh.rotateZ(p.rot ?? 0); }
      e.mesh.scale.set(p.w, p.h, 1);
      fused.push(e);
    }
    for (let i = fi; i < this.fxs.length; i++) this.fxs[i].mesh.visible = false;
    this.pool.flush();
    for (const a of used) a.bind();
    for (const e of fused) e.bind();
    return focus;
  }
}

/** horizontal quad facing up at height D0 + dy covering x0..x1, z0..z1 (z0 < z1) */
function quadUp(x0: number, x1: number, z0: number, z1: number, u: number, v: number, dy = 0) {
  const y = D0 + dy, g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute([x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0], 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, u, 0, u, v, 0, 0, u, v, 0, v], 2));
  return g;
}
