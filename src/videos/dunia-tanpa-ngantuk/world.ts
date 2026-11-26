// One three.js scene holding every set of "Di Dunia Ini Kamu Nggak Pernah Ngantuk" at x offsets
// (kamar 0, tv 40, kantor 80, satpam 120, koridor 160, dapur 200, dokter 240).
// update(id, f, camera, scene) poses everything for shot `id` at frame f (pure function of id + f).
// Shared machinery (Batch, lam, prop, paint, lights, shade, ink) is imported from the molasses kit.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getInputProps, staticFile } from "remotion";
import { Batch, boxGeo, quad, V, lam, prop, house, kitClone, Kit } from "../molasses/build";
import { ctex, cobbleHD, grassHD, stoneHD, cloudHD, planksHD, beam } from "../molasses/paint";
import { LIGHTS, LOOK, LightPreset } from "../molasses/lights";
import { TONE, CHAR, untone } from "../molasses/shade";
import { NOINK } from "../molasses/ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, D0, SHOTS, KAMAR, TV, KANTOR, SATPAM, KORIDOR, DAPUR, DOKTER,
  camAt, V3, ShotDef,
} from "./story";

const KENNEY = ["tree_oak", "tree_default", "tree_fat", "tree-high-round", "plant_bushLarge", "plant_bush",
  "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "lantern", "cart",
  "stall-bench", "banner-green", "canoe"];
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
/** TV screen picture: a colourful "series" still (hero silhouette + explosion sky) */
const tvTex = () => ctex("tvTN", 512, 320, (g) => {
  const gr = g.createLinearGradient(0, 0, 0, 320);
  gr.addColorStop(0, "#7a4a9e"); gr.addColorStop(0.6, "#e86a4a"); gr.addColorStop(1, "#f2c94c");
  g.fillStyle = gr; g.fillRect(0, 0, 512, 320);
  g.fillStyle = "#fff3b0";
  g.beginPath(); g.arc(380, 90, 46, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#3a2a4a";
  g.fillRect(0, 250, 512, 70);
  for (const [x, w, h] of [[30, 60, 90], [110, 45, 60], [330, 70, 110], [430, 55, 75]] as const) g.fillRect(x, 250 - h, w, h);
  // lone figure on a rooftop
  g.fillStyle = "#241726";
  g.beginPath(); g.arc(196, 196, 14, 0, Math.PI * 2); g.fill();
  g.fillRect(186, 208, 20, 42);
  g.fillRect(210, 216, 26, 7);
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillRect(18, 16, 120, 26);
  g.fillStyle = "#c0392b";
  g.beginPath(); g.arc(34, 29, 7, 0, Math.PI * 2); g.fill();
});

type Mats = Record<string, THREE.Material>;

/** soft round sprite texture for steam / fireflies / glow */
const softTex = () => ctex("softDot", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const SETS: Record<number, V3> = { 1: KAMAR, 2: KAMAR, 3: TV, 4: KANTOR, 5: SATPAM, 6: KORIDOR, 7: DAPUR, 8: DOKTER, 9: KAMAR };

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
  private kernels: THREE.Group;
  // ---- motion-upgrade ambient systems ----
  private tvScreen: THREE.Mesh;
  private fans: THREE.Group[] = [];
  private curtain: THREE.Mesh;
  private steam: THREE.Sprite[] = [];
  private dust: THREE.Points; private dustBase: Float32Array;
  private lampGlows: THREE.Sprite[] = [];
  private monGlow: THREE.Mesh;
  private birds: THREE.Group[] = [];
  private fireflies: THREE.Sprite[] = [];
  private moths: THREE.Sprite[] = [];
  private swayBushes: { obj: THREE.Object3D; phase: number }[] = [];
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
      m.position.set(120 + Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- shared materials ----
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.stone = lam("copeHD", () => ({ map: stoneHD("copeHD") }));
    M.planks = lam("planksHD", () => ({ map: planksHD() }));
    M.wood = lam("wood", () => ({ map: beam() }));
    M.plaster = lam("tnPlaster", () => ({ color: "#e8dcc4" }));
    M.warm = lam("tnWarm", () => ({ color: "#eec9a0" }));
    M.pale = lam("tnPale", () => ({ color: "#cfd8dc" }));
    M.trim = lam("tnTrim", () => ({ color: "#efe3c8" }));
    M.darkWood = lam("tnWood", () => ({ color: "#6e4b33" }));
    M.glass = lam("tnGlass", () => ({ color: "#d8e8f2" }));
    M.iron = lam("tnIron", () => ({ color: "#3d414c" }));
    M.steel = lam("tnSteel", () => ({ color: "#7d8088" }));
    M.white = lam("tnWhite", () => ({ color: "#f4f6f8" }));
    M.red = lam("tnRed", () => ({ color: "#d43a2a" }));
    M.black = lam("tnBlack", () => ({ color: "#2b2b30" }));
    M.darkWall = lam("tnDarkWall", () => ({ color: "#5a5f6e" }));
    M.fridge = lam("tnFridge", () => ({ color: "#dfe6ea" }));

    const b = new Batch();
    const K = KAMAR, Tv = TV, O = KANTOR, P = SATPAM, C = KORIDOR, D = DAPUR, X = DOKTER;

    // ---- KAMAR set (shots 1, 2, 9): bed + study desk ----
    b.add(quadUp(K[0] - 6, K[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(K[0] - 6, D0, 4), V(K[0] + 6, D0 + 5, 4.3), 2), M.plaster);
    b.add(boxGeo(V(K[0] - 6, D0 + 4.8, 3.9), V(K[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(K[0] - 4.4, D0 + 1.7, 3.96), V(K[0] - 2.4, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[-4.55, -2.25, 3.9, 4.05], [-4.55, -2.25, 1.55, 1.7], [-4.55, -4.4, 1.55, 4.05], [-2.4, -2.25, 1.55, 4.05]] as const)
      b.add(boxGeo(V(K[0] + x0, D0 + y0, 3.92), V(K[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // bed along the back-left (top surface at D0 + 0.72), long in x for the lying shot
    b.add(boxGeo(V(K[0] - 2.0, D0, 0.1), V(K[0] + 1.6, D0 + 0.5, 1.5)), M.darkWood);
    b.add(boxGeo(V(K[0] - 1.9, D0 + 0.5, 0.2), V(K[0] + 1.5, D0 + 0.72, 1.4)), lam("tnBed", () => ({ color: "#7ba7c9" })));
    b.add(boxGeo(V(K[0] + 0.95, D0 + 0.72, 0.9), V(K[0] + 1.5, D0 + 0.88, 1.35)), M.white); // pillow (head end)
    b.add(boxGeo(V(K[0] + 1.5, D0 + 0.5, 0.1), V(K[0] + 1.65, D0 + 1.15, 1.5)), M.darkWood); // headboard (head end)
    // study desk (shot 2) on the right + book stacks + lamp
    b.add(boxGeo(V(K[0] + 0.2, D0 + 0.72, 0.85), V(K[0] + 2.4, D0 + 0.78, 1.7)), M.wood);
    for (const [lx, lz] of [[0.35, 1.0], [2.25, 1.0], [0.35, 1.55], [2.25, 1.55]] as const)
      b.add(boxGeo(V(K[0] + lx, D0, lz), V(K[0] + lx + 0.09, D0 + 0.72, lz + 0.09)), M.darkWood);
    const bookCols = ["#c0392b", "#2f6fb2", "#2f8f6a", "#e8c85a", "#7b5ac9"];
    for (let i = 0; i < 5; i++)
      b.add(boxGeo(V(K[0] + 1.7, D0 + 0.78 + i * 0.07, 1.05), V(K[0] + 2.15, D0 + 0.85 + i * 0.07, 1.4)), lam("tnBook" + i, () => ({ color: bookCols[i] })));
    for (let i = 0; i < 3; i++)
      b.add(boxGeo(V(K[0] + 0.45, D0 + 0.78 + i * 0.07, 1.1), V(K[0] + 0.85, D0 + 0.85 + i * 0.07, 1.45)), lam("tnBookB" + i, () => ({ color: bookCols[(i + 2) % 5] })));
    b.add(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8), M.iron, new THREE.Matrix4().makeTranslation(K[0] + 1.15, D0 + 0.98, 1.5));
    b.add(new THREE.ConeGeometry(0.16, 0.18, 10, 1, true), lam("tnDeskLamp", () => ({ color: "#e8c85a", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(K[0] + 1.15, D0 + 1.2, 1.5));
    b.add(boxGeo(V(K[0] - 2.2, D0 + 0.02, -0.8), V(K[0] + 2.6, D0 + 0.06, 1.8)), lam("tnRug", () => ({ color: "#b5653f" })));
    prop(b, kit, "lantern", K[0] + 4.6, D0, 1.2, 1.5);

    // ---- TV set (shot 3) ----
    b.add(quadUp(Tv[0] - 6, Tv[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(Tv[0] - 6, D0, 4), V(Tv[0] + 6, D0 + 5, 4.3), 2), M.warm);
    b.add(boxGeo(V(Tv[0] - 6, D0 + 4.8, 3.9), V(Tv[0] + 6, D0 + 5.05, 4.35)), M.trim);
    // sofa (seat top at D0 + 0.55)
    b.add(boxGeo(V(Tv[0] - 1.5, D0, 0.4), V(Tv[0] + 1.3, D0 + 0.55, 1.3)), lam("tnSofa", () => ({ color: "#c25a4a" })));
    b.add(boxGeo(V(Tv[0] - 1.5, D0 + 0.55, 1.05), V(Tv[0] + 1.3, D0 + 1.25, 1.3)), lam("tnSofaB", () => ({ color: "#a84a3c" })));
    b.add(boxGeo(V(Tv[0] - 1.5, D0 + 0.55, 0.4), V(Tv[0] - 1.15, D0 + 0.95, 1.3)), lam("tnSofaB2", () => ({ color: "#a84a3c" })));
    b.add(boxGeo(V(Tv[0] + 0.95, D0 + 0.55, 0.4), V(Tv[0] + 1.3, D0 + 0.95, 1.3)), lam("tnSofaB3", () => ({ color: "#a84a3c" })));
    // TV stand + frame (screen added below as a basic-material plane)
    b.add(boxGeo(V(Tv[0] - 1.6, D0, 2.6), V(Tv[0] + 1.6, D0 + 0.5, 3.1)), M.darkWood);
    b.add(boxGeo(V(Tv[0] - 1.45, D0 + 0.55, 2.75), V(Tv[0] + 1.45, D0 + 2.2, 2.9)), M.black);
    // popcorn bowl on the sofa arm
    b.add(new THREE.CylinderGeometry(0.2, 0.13, 0.16, 12), lam("tnBowl", () => ({ color: "#e2453c" })), new THREE.Matrix4().makeTranslation(Tv[0] + 1.12, D0 + 1.03, 0.85));
    // side table + lamp
    b.add(boxGeo(V(Tv[0] - 2.6, D0, 0.6), V(Tv[0] - 2.0, D0 + 0.6, 1.2)), M.wood);
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 6), M.iron, new THREE.Matrix4().makeTranslation(Tv[0] - 2.3, D0 + 0.85, 0.9));
    b.add(new THREE.ConeGeometry(0.2, 0.22, 10, 1, true), lam("tnLampShade", () => ({ color: "#e8c85a", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(Tv[0] - 2.3, D0 + 1.15, 0.9));
    this.tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.7, 1.5), new THREE.MeshBasicMaterial({ map: tvTex() }));
    this.tvScreen.position.set(Tv[0], D0 + 1.37, 2.74); this.tvScreen.rotation.y = Math.PI;
    R.add(this.tvScreen);

    // ---- KANTOR set (shot 4) ----
    b.add(quadUp(O[0] - 6, O[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(O[0] - 6, D0, 4), V(O[0] + 6, D0 + 5, 4.3), 2), M.pale);
    b.add(boxGeo(V(O[0] - 6, D0 + 4.8, 3.9), V(O[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(O[0] - 3.6, D0 + 1.7, 3.96), V(O[0] - 0.6, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[-3.75, -0.45, 3.9, 4.05], [-3.75, -0.45, 1.55, 1.7], [-3.75, -3.6, 1.55, 4.05], [-0.6, -0.45, 1.55, 4.05]] as const)
      b.add(boxGeo(V(O[0] + x0, D0 + y0, 3.92), V(O[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // desk + monitor + keyboard (hero sits at O-0.9, desk in front at z 0.9)
    b.add(boxGeo(V(O[0] - 2.2, D0 + 0.72, 0.85), V(O[0] + 0.6, D0 + 0.78, 1.7)), M.wood);
    for (const [lx, lz] of [[-2.05, 1.0], [0.45, 1.0], [-2.05, 1.55], [0.45, 1.55]] as const)
      b.add(boxGeo(V(O[0] + lx, D0, lz), V(O[0] + lx + 0.09, D0 + 0.72, lz + 0.09)), M.darkWood);
    b.add(boxGeo(V(O[0] - 1.0, D0 + 0.95, 1.45), V(O[0] - 0.1, D0 + 1.55, 1.55)), M.black); // monitor
    b.add(boxGeo(V(O[0] - 0.95, D0 + 1.0, 1.44), V(O[0] - 0.15, D0 + 1.5, 1.46)), lam("tnMonScr", () => ({ color: "#9fd8f2" })));
    b.add(boxGeo(V(O[0] - 0.9, D0 + 0.78, 1.05), V(O[0] - 0.2, D0 + 0.83, 1.3)), M.black); // keyboard
    b.add(boxGeo(V(O[0] + 3.4, D0, 3.2), V(O[0] + 5.2, D0 + 1.8, 3.9)), M.steel); // cabinet
    b.add(boxGeo(V(O[0] + 3.5, D0 + 1.85, 3.3), V(O[0] + 4.1, D0 + 2.1, 3.8)), lam("tnBox1", () => ({ color: "#c9a86a" })));
    b.add(boxGeo(V(O[0] + 4.3, D0 + 1.85, 3.35), V(O[0] + 4.9, D0 + 2.05, 3.75)), lam("tnBox2", () => ({ color: "#b5653f" })));

    // ---- SATPAM set (shot 5) ----
    b.add(quadUp(P[0] - 26, P[0] + 26, -22, 26, 26, 24, -0.05), M.grass);
    b.add(quadUp(P[0] - 20, P[0] + 20, -3.2, 3.2, 20, 3.2, 0.012), M.cobble); // road
    b.add(boxGeo(V(P[0] - 20, D0, 3.2), V(P[0] + 20, D0 + 0.14, 5), 2), M.stone);
    // guard hut: walls + pyramid-ish roof + window
    b.add(boxGeo(V(P[0] - 2.2, D0, 1.6), V(P[0] - 0.4, D0 + 2.4, 3.2)), M.plaster);
    b.add(boxGeo(V(P[0] - 2.4, D0 + 2.4, 1.4), V(P[0] - 0.2, D0 + 2.55, 3.4)), M.red);
    b.add(boxGeo(V(P[0] - 2.1, D0 + 2.55, 1.6), V(P[0] - 0.5, D0 + 2.95, 3.2)), M.red);
    b.add(boxGeo(V(P[0] - 1.9, D0 + 1.2, 1.58), V(P[0] - 0.7, D0 + 2.0, 1.64)), M.glass);
    b.add(boxGeo(V(P[0] - 1.5, D0, 1.58), V(P[0] - 1.1, D0 + 1.15, 1.64)), M.darkWood); // door
    // barrier gate arm (striped) beside the hut
    b.add(boxGeo(V(P[0] - 0.2, D0, 1.2), V(P[0] + 0.05, D0 + 1.0, 1.45)), M.iron);
    for (let i = 0; i < 5; i++)
      b.add(boxGeo(V(P[0] + 0.05 + i * 0.62, D0 + 0.92, 1.26), V(P[0] + 0.67 + i * 0.62, D0 + 1.04, 1.4)), i % 2 ? M.white : M.red);
    prop(b, kit, "lantern", P[0] - 3.2, D0, -1.5, 2.8);
    prop(b, kit, "plant_bushLarge", P[0] + 1.7, D0, 1.0, 1.5, 0.6); // the bush the maling hides in
    prop(b, kit, "plant_bush", P[0] + 3.4, D0, 1.6, 1.1, 0.2);
    prop(b, kit, "tree_oak", P[0] - 8, D0, 4, 7, 0.3);
    prop(b, kit, "tree_fat", P[0] + 9, D0, 5, 6, 1.1);
    house(b, P[0] + 8, 12, Math.PI, 8, 8, 7.5, 2);

    // ---- KORIDOR set (shot 6) ----
    b.add(quadUp(C[0] - 8, C[0] + 8, -4, 4, 8, 4, 0.02), M.planks);
    b.add(boxGeo(V(C[0] - 8, D0, 3.2), V(C[0] + 8, D0 + 4.2, 3.5), 2), M.darkWall); // back wall
    b.add(boxGeo(V(C[0] - 8, D0 + 4.0, -3.4), V(C[0] + 8, D0 + 4.2, 3.5)), M.darkWall); // ceiling strip
    for (const dx of [-5.5, -2.5, 0.5, 3.5, 6.0]) { // doors along the back wall
      b.add(boxGeo(V(C[0] + dx, D0, 3.14), V(C[0] + dx + 1.0, D0 + 2.4, 3.22)), M.darkWood);
      b.add(new THREE.SphereGeometry(0.05, 8, 6), M.steel, new THREE.Matrix4().makeTranslation(C[0] + dx + 0.85, D0 + 1.15, 3.1));
    }
    for (const lx of [-4, 0, 4]) { // dim ceiling lamps
      b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), M.black, new THREE.Matrix4().makeTranslation(C[0] + lx, D0 + 3.7, 0.4));
      b.add(new THREE.ConeGeometry(0.28, 0.24, 10, 1, true), lam("tnCorrLamp", () => ({ color: "#e8c85a", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(C[0] + lx, D0 + 3.3, 0.4));
    }
    b.add(boxGeo(V(C[0] + 4.6, D0, 2.2), V(C[0] + 5.4, D0 + 1.1, 3.0)), M.wood); // crate at the dark end

    // ---- DAPUR set (shot 7) ----
    b.add(quadUp(D[0] - 6, D[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(D[0] - 6, D0, 4), V(D[0] + 6, D0 + 5, 4.3), 2), M.warm);
    b.add(boxGeo(V(D[0] - 6, D0 + 4.8, 3.9), V(D[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(D[0] - 4.4, D0 + 1.7, 3.96), V(D[0] - 2.4, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[-4.55, -2.25, 3.9, 4.05], [-4.55, -2.25, 1.55, 1.7], [-4.55, -4.4, 1.55, 4.05], [-2.4, -2.25, 1.55, 4.05]] as const)
      b.add(boxGeo(V(D[0] + x0, D0 + y0, 3.92), V(D[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // the fridge (hero talks to it): tall box, door split, handle, magnets
    b.add(boxGeo(V(D[0] + 0.85, D0, 0.45), V(D[0] + 1.75, D0 + 1.95, 1.35)), M.fridge);
    b.add(boxGeo(V(D[0] + 0.85, D0 + 1.32, 0.43), V(D[0] + 1.75, D0 + 1.36, 0.47)), M.steel); // door split
    b.add(boxGeo(V(D[0] + 0.92, D0 + 0.95, 0.38), V(D[0] + 0.98, D0 + 1.28, 0.46)), M.steel); // handle
    for (const [mx, my, mc] of [[1.15, 1.65, "#e2453c"], [1.35, 1.55, "#e8c85a"], [1.25, 1.8, "#2f8f6a"]] as const)
      b.add(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 10).rotateX(Math.PI / 2), lam("tnMagnet" + mc, () => ({ color: mc })),
        new THREE.Matrix4().makeTranslation(D[0] + mx, D0 + my, 0.43));
    // stove counter + shelf
    b.add(boxGeo(V(D[0] - 3.4, D0, 0.75), V(D[0] - 1.2, D0 + 0.9, 1.55)), M.wood);
    b.add(boxGeo(V(D[0] - 3.45, D0 + 0.9, 0.7), V(D[0] - 1.15, D0 + 0.97, 1.6)), M.black);
    b.add(boxGeo(V(D[0] - 4.2, D0 + 2.3, 3.7), V(D[0] - 1.2, D0 + 2.38, 4.0)), M.darkWood);
    for (let i = 0; i < 4; i++)
      b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 10), lam("tnJar" + i, () => ({ color: ["#c9775a", "#7ba7c9", "#e8c85a", "#8ab86a"][i] })),
        new THREE.Matrix4().makeTranslation(D[0] - 3.9 + i * 0.75, D0 + 2.54, 3.85));
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), M.black, new THREE.Matrix4().makeTranslation(D[0] - 0.5, D0 + 4.4, 0.6));
    b.add(new THREE.ConeGeometry(0.3, 0.26, 12, 1, true), lam("tnLamp", () => ({ color: "#2f5f43", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(D[0] - 0.5, D0 + 3.72, 0.6));

    // ---- DOKTER set (shot 8) ----
    b.add(quadUp(X[0] - 6, X[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(X[0] - 6, D0, 4), V(X[0] + 6, D0 + 5, 4.3), 2), M.pale);
    b.add(boxGeo(V(X[0] - 6, D0 + 4.8, 3.9), V(X[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(X[0] - 1.4, D0, 0.9), V(X[0] + 0.4, D0 + 0.75, 1.7)), M.steel); // exam table
    b.add(boxGeo(V(X[0] - 1.4, D0 + 0.75, 0.9), V(X[0] + 0.4, D0 + 0.88, 1.7)), lam("tnCushion", () => ({ color: "#7ba7c9" })));
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14), M.darkWood, new THREE.Matrix4().makeTranslation(X[0] + 2.6, D0 + 0.55, 1.2));
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), M.steel, new THREE.Matrix4().makeTranslation(X[0] + 2.6, D0 + 0.27, 1.2));
    b.add(boxGeo(V(X[0] + 3.6, D0, 3.2), V(X[0] + 5.4, D0 + 1.6, 3.9)), M.white);
    b.add(boxGeo(V(X[0] - 1.2, D0 + 2.6, 3.92), V(X[0] + 0.0, D0 + 3.8, 3.98)), M.white); // red cross sign
    b.add(boxGeo(V(X[0] - 0.75, D0 + 2.75, 3.9), V(X[0] - 0.45, D0 + 3.65, 3.94)), M.red);
    b.add(boxGeo(V(X[0] - 1.05, D0 + 3.05, 3.9), V(X[0] - 0.15, D0 + 3.35, 3.94)), M.red);
    // eye chart
    b.add(boxGeo(V(X[0] + 1.6, D0 + 2.4, 3.92), V(X[0] + 2.6, D0 + 3.9, 3.98)), M.white);
    for (let r = 0; r < 4; r++) for (let cc = 0; cc < 3; cc++)
      b.add(boxGeo(V(X[0] + 1.75 + cc * 0.3, D0 + 3.55 - r * 0.32, 3.9), V(X[0] + 1.9 + cc * 0.3, D0 + 3.68 - r * 0.32, 3.94)), M.black);

    b.build(R);

    // ---- popcorn kernels (shot 3): heaped until "tamat" f427, then gone ----
    this.kernels = new THREE.Group();
    const kGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const kMat = lam("tnPopcorn", () => ({ color: "#f7ead0" }));
    let seed = 5;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(kGeo, kMat);
      const a = rnd() * Math.PI * 2, r = rnd() * 0.13;
      m.position.set(Tv[0] + 1.12 + Math.cos(a) * r, D0 + 1.13 + rnd() * 0.05, 0.85 + Math.sin(a) * r);
      this.kernels.add(m);
    }
    R.add(this.kernels);

    // ---- motion upgrade: ambient life (all cheap, pure functions of t) ----
    const soft = softTex();
    // ceiling fans (kamar + kantor): hub with 3 blades, spins in update
    for (const [fx, fz] of [[K[0] + 0.2, 2.6], [O[0] - 0.8, 2.6]] as const) {
      const fan = new THREE.Group();
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), M.iron);
      rod.position.y = 0.45; fan.add(rod);
      const hub = new THREE.Group();
      for (let i = 0; i < 3; i++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.02, 0.17), M.darkWood);
        blade.position.x = 0.42;
        const holder = new THREE.Group(); holder.rotation.y = (i / 3) * Math.PI * 2; holder.add(blade);
        hub.add(holder);
      }
      fan.add(hub); fan.userData.hub = hub;
      fan.position.set(fx, D0 + 4.05, fz);
      fan.visible = false;
      this.fans.push(fan); R.add(fan);
    }
    // bedroom curtain swaying at the window (shots 1, 2, 9)
    const curtGeo = new THREE.PlaneGeometry(1.7, 2.3); curtGeo.translate(0, -1.15, 0);
    this.curtain = new THREE.Mesh(curtGeo, lam("tnCurtain", () => ({ color: "#7ba7c9", side: THREE.DoubleSide })));
    this.curtain.position.set(K[0] - 3.4, D0 + 3.95, 3.88);
    this.curtain.visible = false;
    R.add(this.curtain);
    // cold mist spilling from the fridge door (shot 7)
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: "#dfefff", transparent: true, opacity: 0, depthWrite: false }));
      sp.position.set(D[0] + 1.3, D0 + 0.3, 0.42);
      sp.visible = false; sp.layers.set(NOINK);
      this.steam.push(sp); R.add(sp);
    }
    // dust motes drifting in indoor light
    const ND = 36;
    this.dustBase = new Float32Array(ND * 3);
    let dseed = 11; const drnd = () => { dseed = (dseed * 16807) % 2147483647; return dseed / 2147483647; };
    for (let i = 0; i < ND; i++) {
      this.dustBase[i * 3] = (drnd() - 0.5) * 7; this.dustBase[i * 3 + 1] = 0.4 + drnd() * 2.8; this.dustBase[i * 3 + 2] = (drnd() - 0.5) * 5;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.dustBase), 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: "#fff3cf", size: 0.045, transparent: true, opacity: 0.5, depthWrite: false }));
    this.dust.visible = false; this.dust.frustumCulled = false; this.dust.layers.set(NOINK);
    R.add(this.dust);
    // corridor lamp glows (shot 6) + satpam lantern glow (shot 5)
    for (const lx of [-4, 0, 4]) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: "#ffe9a8", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.position.set(C[0] + lx, D0 + 3.22, 0.4); sp.scale.setScalar(0.85);
      sp.visible = false; sp.layers.set(NOINK);
      this.lampGlows.push(sp); R.add(sp);
    }
    const lant = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: "#ffd98a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    lant.position.set(P[0] - 3.2, D0 + 2.35, -1.5); lant.scale.setScalar(1.15);
    lant.visible = false; lant.layers.set(NOINK);
    this.lampGlows.push(lant); R.add(lant);
    // moths orbiting the satpam lantern
    for (let i = 0; i < 2; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: "#e8e2d0", transparent: true, opacity: 0.85, depthWrite: false }));
      sp.scale.setScalar(0.07); sp.visible = false; sp.layers.set(NOINK);
      this.moths.push(sp); R.add(sp);
    }
    // monitor glow flicker plane (shot 4), just in front of the baked screen
    this.monGlow = new THREE.Mesh(new THREE.PlaneGeometry(0.78, 0.48),
      new THREE.MeshBasicMaterial({ color: "#9fd8f2", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.monGlow.position.set(O[0] - 0.55, D0 + 1.25, 1.435); this.monGlow.rotation.y = Math.PI;
    this.monGlow.visible = false; this.monGlow.layers.set(NOINK);
    R.add(this.monGlow);
    // birds crossing the sky at the guard post (shot 5)
    const birdMat = new THREE.MeshBasicMaterial({ color: "#2e3138", side: THREE.DoubleSide });
    for (let i = 0; i < 4; i++) {
      const g = new THREE.Group();
      const wgeo = new THREE.PlaneGeometry(0.55, 0.16); wgeo.translate(0.27, 0, 0);
      const wl = new THREE.Mesh(wgeo, birdMat); wl.rotation.y = Math.PI;
      const wr = new THREE.Mesh(wgeo, birdMat);
      g.add(wl, wr); g.userData = { wl, wr };
      g.visible = false; g.layers.set(NOINK); wl.layers.set(NOINK); wr.layers.set(NOINK);
      this.birds.push(g); R.add(g);
    }
    // fireflies at dusk (shot 5)
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: "#ffe98a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(0.16); sp.visible = false; sp.layers.set(NOINK);
      this.fireflies.push(sp); R.add(sp);
    }
    // swaying standalone bushes / grass at the guard post (shot 5)
    const swaySpots: [string, number, number][] = [
      ["plant_bush", P[0] + 2.7, 2.3], ["grass_large", P[0] - 1.6, -2.3], ["grass_large", P[0] + 4.4, 0.4],
    ];
    swaySpots.forEach(([name, x, z], i) => {
      const o = kitClone(kit, name, name === "grass_large" ? 0.85 : 1.1);
      if (!o) return;
      o.position.set(x, D0, z); o.visible = false;
      this.swayBushes.push({ obj: o, phase: i * 1.53 });
      R.add(o);
    });
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
      // motion upgrade: clouds drift slowly across the sky
      if (m.userData.bx === undefined) m.userData.bx = m.position.x;
      m.position.x = 120 + (((m.userData.bx - 120 + t * 1.6 + 750) % 1500) - 750);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
      mat.map = this.cloudMaps[s.light][i % 4];
    }
    // ---- motion upgrade: ambient life ----
    const ctr = SETS[id];
    // ceiling fans spin (kamar shots 1/2/9, kantor shot 4)
    this.fans.forEach((fan, i) => {
      fan.visible = i === 0 ? (id === 1 || id === 2 || id === 9) : id === 4;
      if (fan.visible) (fan.userData.hub as THREE.Group).rotation.y = t * 5.2;
    });
    // bedroom curtain sway
    this.curtain.visible = id === 1 || id === 2 || id === 9;
    if (this.curtain.visible) this.curtain.rotation.z = Math.sin(t * 0.85) * 0.035;
    // cold mist from the fridge door (shot 7): spills out and sinks
    this.steam.forEach((sp, i) => {
      sp.visible = id === 7;
      if (id !== 7) return;
      const u = (t * 0.28 + i / 5) % 1;
      sp.position.set(DAPUR[0] + 1.3 + Math.sin(t * 1.1 + i * 2.2) * 0.08, D0 + 0.42 - u * 0.3, 0.42 - u * 0.55);
      sp.scale.setScalar(0.22 + u * 0.55);
      (sp.material as THREE.SpriteMaterial).opacity = 0.26 * Math.sin(u * Math.PI);
    });
    // dust motes indoors (everywhere except the guard post)
    this.dust.visible = id !== 5;
    if (this.dust.visible) {
      const pos = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i,
          ctr[0] + this.dustBase[i * 3] + Math.sin(t * 0.24 + i * 1.7) * 0.22,
          D0 + this.dustBase[i * 3 + 1] + Math.sin(t * 0.17 + i * 2.3) * 0.14,
          ctr[2] + this.dustBase[i * 3 + 2] + Math.cos(t * 0.2 + i * 1.3) * 0.18);
      }
      pos.needsUpdate = true;
    }
    // corridor lamp glows with a faulty middle lamp (shot 6); satpam lantern glow (shot 5)
    this.lampGlows.forEach((sp, i) => {
      if (i < 3) {
        sp.visible = id === 6;
        if (id !== 6) return;
        let o = 0.32 + 0.05 * Math.sin(t * 9 + i * 3.7);
        if (i === 1 && Math.sin(t * 13.7) < -0.82) o *= 0.25; // faulty lamp dips
        (sp.material as THREE.SpriteMaterial).opacity = o;
      } else {
        sp.visible = id === 5;
        if (id === 5) (sp.material as THREE.SpriteMaterial).opacity = 0.3 + 0.07 * Math.sin(t * 3.1);
      }
    });
    // moths around the satpam lantern
    this.moths.forEach((sp, i) => {
      sp.visible = id === 5;
      if (id !== 5) return;
      const a = t * (2.2 + i * 0.7) + i * 3.1;
      sp.position.set(SATPAM[0] - 3.2 + Math.cos(a) * 0.3, D0 + 2.35 + Math.sin(t * 3.3 + i * 2) * 0.14, -1.5 + Math.sin(a) * 0.3);
    });
    // TV picture flicker (shot 3) + monitor glow flicker (shot 4)
    (this.tvScreen.material as THREE.MeshBasicMaterial).color.setScalar(id === 3 ? 0.96 + 0.05 * Math.sin(t * 21) + 0.03 * Math.sin(t * 7.7) : 1);
    this.monGlow.visible = id === 4;
    if (id === 4) (this.monGlow.material as THREE.MeshBasicMaterial).opacity = 0.1 + 0.05 * Math.sin(t * 17) + 0.03 * Math.sin(t * 5.3);
    // birds + fireflies + swaying bushes at the guard post (shot 5)
    this.birds.forEach((g, i) => {
      g.visible = id === 5;
      if (id !== 5) return;
      const span = 64, u = ((t * 2.6 + i * 17) % span) - span / 2;
      g.position.set(SATPAM[0] + u, D0 + 8.5 + (i % 3) * 1.3 + Math.sin(t * 1.1 + i * 2) * 0.35, SATPAM[2] - 6 - (i % 2) * 3);
      g.rotation.y = Math.PI / 2;
      const flap = Math.sin(t * 9 + i * 1.7) * 0.55;
      (g.userData.wl as THREE.Mesh).rotation.z = flap;
      (g.userData.wr as THREE.Mesh).rotation.z = -flap;
    });
    this.fireflies.forEach((sp, i) => {
      sp.visible = id === 5;
      if (id !== 5) return;
      sp.position.set(SATPAM[0] - 4 + Math.sin(t * 0.23 + i * 2.6) * 3.6 + i * 0.8,
        D0 + 0.7 + Math.sin(t * 0.5 + i * 1.9) * 0.45, SATPAM[2] - 1 + Math.cos(t * 0.19 + i * 3.1) * 2.2);
      (sp.material as THREE.SpriteMaterial).opacity = 0.15 + 0.6 * Math.max(0, Math.sin(t * 1.6 + i * 2.4)) ** 3;
    });
    for (const sb of this.swayBushes) {
      sb.obj.visible = id === 5;
      if (id === 5) sb.obj.rotation.z = Math.sin(t * 1.25 + sb.phase) * 0.045;
    }
    // ---- animated props ----
    this.kernels.visible = id === 3 && f < 427; // popcorn runs out when the series ends
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
