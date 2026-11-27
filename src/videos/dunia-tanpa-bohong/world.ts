// One three.js scene holding every set of "Di Dunia Ini Kamu Nggak Bisa Bohong" at x offsets
// (jalan 0, kamar 40, kantor 80, halte 120, kafe 160, sore 200).
// update(id, f, camera, scene) poses everything for shot `id` at frame f (pure function of id + f).
// Shared machinery (Batch, lam, prop, paint, lights, shade, ink) is imported from the molasses kit.
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getInputProps, staticFile } from "remotion";
import { Batch, boxGeo, quad, V, lam, prop, house, kitClone, Kit } from "../molasses/build";
import { ctex, cobbleHD, grassHD, stoneHD, cloudHD, planksHD, beam, facadeHD } from "../molasses/paint";
import { LIGHTS, LOOK, LightPreset } from "../molasses/lights";
import { TONE, CHAR, untone } from "../molasses/shade";
import { NOINK } from "../molasses/ink";
import { Pool, Actor, Fx, stage } from "./cast";
import {
  FPS, D0, SHOTS, JALAN, KAMAR, KANTOR, HALTE, KAFE, SORE,
  camAt, smooth, clamp01, V3, ShotDef,
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
type Mats = Record<string, THREE.Material>;

/** soft round sprite texture for steam / fireflies / glow */
const softTex = () => ctex("softDot", 128, 128, (g) => {
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.5, "rgba(255,255,255,0.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
});
const SETS: Record<number, V3> = { 1: JALAN, 2: KAMAR, 3: KANTOR, 4: HALTE, 5: KAFE, 6: KAFE, 7: KAFE, 8: KAFE, 9: KAFE, 10: SORE };
const OUTDOOR = new Set([1, 4, 10]);

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
  // ---- motion-upgrade ambient systems ----
  private birds: THREE.Group[] = [];
  private leaves: THREE.Mesh[] = [];
  private steam: THREE.Sprite[] = [];
  private fans: THREE.Group[] = [];
  private dust: THREE.Points; private dustBase: Float32Array;
  private fireflies: THREE.Sprite[] = [];
  private swayBushes: { obj: THREE.Object3D; shot: number; phase: number }[] = [];
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
    const shadowSize = (getInputProps() as { post?: { shadow?: number } }).post?.shadow ?? 4096;
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
    M.plaster = lam("bhPlaster", () => ({ color: "#e8dcc4" }));
    M.warm = lam("bhWarm", () => ({ color: "#eec9a0" }));
    M.pale = lam("bhPale", () => ({ color: "#cfd8dc" }));
    M.trim = lam("bhTrim", () => ({ color: "#efe3c8" }));
    M.darkWood = lam("bhWood", () => ({ color: "#6e4b33" }));
    M.glass = lam("bhGlass", () => ({ color: "#d8e8f2" }));
    M.mirror = lam("bhMirror", () => ({ color: "#cfe4ee" }));
    M.iron = lam("bhIron", () => ({ color: "#3d414c" }));
    M.steel = lam("bhSteel", () => ({ color: "#7d8088" }));
    M.white = lam("bhWhite", () => ({ color: "#f4f6f8" }));
    M.red = lam("bhRed", () => ({ color: "#d43a2a" }));
    M.black = lam("bhBlack", () => ({ color: "#2b2b30" }));
    M.sand = lam("bhSand", () => ({ color: "#e3cf9e" }));

    const b = new Batch();
    const J = JALAN, K = KAMAR, O = KANTOR, H = HALTE, C = KAFE, S = SORE;

    // ---- street builder (JALAN shot 1, SORE shot 10) ----
    const buildStreet = (Ox: number) => {
      b.add(quadUp(Ox - 30, Ox + 30, -30, 30, 30, 30, -0.05), M.grass);
      b.add(quadUp(Ox - 20, Ox + 20, -3.2, 3.2, 20, 3.2, 0.012), M.cobble); // road along x
      b.add(boxGeo(V(Ox - 20, D0, -5), V(Ox + 20, D0 + 0.14, -3.2), 2), M.stone);
      b.add(boxGeo(V(Ox - 20, D0, 3.2), V(Ox + 20, D0 + 0.14, 5), 2), M.stone);
      house(b, Ox - 7, -10.5, 0, 8, 8, 7.5, 0);
      house(b, Ox + 4, -10.5, 0, 9, 8, 8.4, 3);
      house(b, Ox + 13, -10.5, 0, 7, 8, 7, 5);
      prop(b, kit, "tree_oak", Ox - 11, D0, -6, 6, 0.4);
      prop(b, kit, "tree_fat", Ox + 10, D0, -5.5, 5.5, 1.2);
      prop(b, kit, "lantern", Ox - 5, D0, -4.2, 2.8);
      prop(b, kit, "lantern", Ox + 7, D0, 4.2, 2.8);
      prop(b, kit, "cart", Ox - 9, D0, 4.4, 1.6, 0.5);
    };
    buildStreet(J[0]);
    buildStreet(S[0]);

    // ---- KAMAR set (shot 2): bed + desk + mirror on the back wall ----
    b.add(quadUp(K[0] - 6, K[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(K[0] - 6, D0, 4), V(K[0] + 6, D0 + 6.5, 4.3), 2), M.plaster);
    b.add(boxGeo(V(K[0] - 6, D0 + 6.3, 3.9), V(K[0] + 6, D0 + 6.55, 4.35)), M.trim);
    b.add(boxGeo(V(K[0] - 4.4, D0 + 1.7, 3.96), V(K[0] - 2.4, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[-4.55, -2.25, 3.9, 4.05], [-4.55, -2.25, 1.55, 1.7], [-4.55, -4.4, 1.55, 4.05], [-2.4, -2.25, 1.55, 4.05]] as const)
      b.add(boxGeo(V(K[0] + x0, D0 + y0, 3.92), V(K[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // mirror: wardrobe panel + reflective glass (friend stands in front of it)
    b.add(boxGeo(V(K[0] + 0.25, D0, 3.55), V(K[0] + 1.55, D0 + 2.5, 3.95)), M.darkWood);
    b.add(boxGeo(V(K[0] + 0.38, D0 + 0.55, 3.5), V(K[0] + 1.42, D0 + 2.35, 3.56)), M.mirror);
    // bed along the back-left wall (top surface at D0 + 0.72), clear of the actors
    b.add(boxGeo(V(K[0] - 3.6, D0, 2.4), V(K[0] - 0.4, D0 + 0.5, 3.7)), M.darkWood);
    b.add(boxGeo(V(K[0] - 3.5, D0 + 0.5, 2.5), V(K[0] - 0.5, D0 + 0.72, 3.6)), lam("bhBed", () => ({ color: "#7ba7c9" })));
    b.add(boxGeo(V(K[0] - 1.0, D0 + 0.72, 3.15), V(K[0] - 0.5, D0 + 0.88, 3.55)), M.white);
    // study desk on the right + book stacks + lamp
    b.add(boxGeo(V(K[0] + 2.2, D0 + 0.72, 0.85), V(K[0] + 4.2, D0 + 0.78, 1.7)), M.wood);
    for (const [lx, lz] of [[2.35, 1.0], [4.05, 1.0], [2.35, 1.55], [4.05, 1.55]] as const)
      b.add(boxGeo(V(K[0] + lx, D0, lz), V(K[0] + lx + 0.09, D0 + 0.72, lz + 0.09)), M.darkWood);
    const bookCols = ["#c0392b", "#2f6fb2", "#2f8f6a", "#e8c85a", "#7b5ac9"];
    for (let i = 0; i < 4; i++)
      b.add(boxGeo(V(K[0] + 3.4, D0 + 0.78 + i * 0.07, 1.05), V(K[0] + 3.85, D0 + 0.85 + i * 0.07, 1.4)), lam("bhBook" + i, () => ({ color: bookCols[i] })));
    b.add(new THREE.CylinderGeometry(0.03, 0.05, 0.4, 8), M.iron, new THREE.Matrix4().makeTranslation(K[0] + 2.7, D0 + 0.98, 1.5));
    b.add(new THREE.ConeGeometry(0.16, 0.18, 10, 1, true), lam("bhDeskLamp", () => ({ color: "#e8c85a", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(K[0] + 2.7, D0 + 1.2, 1.5));

    // ---- KANTOR set (shot 3): boss desk + side desk with monitor + cabinet ----
    b.add(quadUp(O[0] - 6, O[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(O[0] - 6, D0, 4), V(O[0] + 6, D0 + 6.5, 4.3), 2), M.pale);
    b.add(boxGeo(V(O[0] - 6, D0 + 6.3, 3.9), V(O[0] + 6, D0 + 6.55, 4.35)), M.trim);
    b.add(boxGeo(V(O[0] - 3.6, D0 + 1.7, 3.96), V(O[0] - 0.6, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[-3.75, -0.45, 3.9, 4.05], [-3.75, -0.45, 1.55, 1.7], [-3.75, -3.6, 1.55, 4.05], [-0.6, -0.45, 1.55, 4.05]] as const)
      b.add(boxGeo(V(O[0] + x0, D0 + y0, 3.92), V(O[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // boss desk (top at D0 + 0.78), boss stands behind it at z +1.15
    b.add(boxGeo(V(O[0] + 0.1, D0, 0.65), V(O[0] + 1.6, D0 + 0.72, 1.05)), M.wood);
    b.add(boxGeo(V(O[0] + 0.05, D0 + 0.72, 0.6), V(O[0] + 1.65, D0 + 0.78, 1.1)), M.darkWood);
    b.add(boxGeo(V(O[0] + 0.5, D0 + 0.78, 0.72), V(O[0] + 0.95, D0 + 0.82, 1.0)), M.white); // report papers
    b.add(boxGeo(V(O[0] + 1.1, D0 + 0.78, 0.75), V(O[0] + 1.4, D0 + 0.84, 1.0)), lam("bhFolder", () => ({ color: "#c0392b" })));
    // side desk + monitor + keyboard
    b.add(boxGeo(V(O[0] - 2.6, D0 + 0.72, 1.2), V(O[0] - 0.8, D0 + 0.78, 2.0)), M.wood);
    for (const [lx, lz] of [[-2.45, 1.35], [-0.95, 1.35], [-2.45, 1.85], [-0.95, 1.85]] as const)
      b.add(boxGeo(V(O[0] + lx, D0, lz), V(O[0] + lx + 0.09, D0 + 0.72, lz + 0.09)), M.darkWood);
    b.add(boxGeo(V(O[0] - 2.0, D0 + 0.95, 1.75), V(O[0] - 1.1, D0 + 1.55, 1.85)), M.black);
    b.add(boxGeo(V(O[0] - 1.95, D0 + 1.0, 1.74), V(O[0] - 1.15, D0 + 1.5, 1.76)), lam("bhMonScr", () => ({ color: "#9fd8f2" })));
    b.add(boxGeo(V(O[0] - 1.9, D0 + 0.78, 1.35), V(O[0] - 1.2, D0 + 0.83, 1.6)), M.black);
    b.add(boxGeo(V(O[0] + 3.4, D0, 3.2), V(O[0] + 5.2, D0 + 1.8, 3.9)), M.steel);
    b.add(boxGeo(V(O[0] + 3.5, D0 + 1.85, 3.3), V(O[0] + 4.1, D0 + 2.1, 3.8)), lam("bhBox1", () => ({ color: "#c9a86a" })));
    b.add(boxGeo(V(O[0] + 4.3, D0 + 1.85, 3.35), V(O[0] + 4.9, D0 + 2.05, 3.75)), lam("bhBox2", () => ({ color: "#b5653f" })));

    // ---- HALTE set (shot 4): shelter + bench + clock pole + sign ----
    b.add(quadUp(H[0] - 30, H[0] + 30, -30, 30, 30, 30, -0.05), M.grass);
    b.add(quadUp(H[0] - 20, H[0] + 20, -3.2, 3.2, 20, 3.2, 0.012), M.cobble);
    b.add(boxGeo(V(H[0] - 20, D0, 3.2), V(H[0] + 20, D0 + 0.14, 5), 2), M.stone);
    house(b, H[0] - 7, -10.5, 0, 8, 8, 7.5, 2);
    house(b, H[0] + 6, -10.5, 0, 9, 8, 8.4, 6);
    // shelter: 4 posts + roof slab (characters stand in front, camera side)
    for (const [px, pz] of [[-2.6, 2.0], [2.6, 2.0], [-2.6, 3.2], [2.6, 3.2]] as const)
      b.add(boxGeo(V(H[0] + px - 0.07, D0, pz - 0.07), V(H[0] + px + 0.07, D0 + 2.75, pz + 0.07)), M.iron);
    b.add(boxGeo(V(H[0] - 3.0, D0 + 2.75, 1.6), V(H[0] + 3.0, D0 + 2.87, 3.6)), M.red);
    b.add(boxGeo(V(H[0] - 3.0, D0 + 2.87, 1.6), V(H[0] + 3.0, D0 + 3.03, 3.6)), lam("bhRoofTop", () => ({ color: "#a83226" })));
    // bench (seat top at D0 + 0.5), folk(2) sits here
    b.add(boxGeo(V(H[0] - 2.4, D0 + 0.44, 0.75), V(H[0] - 1.2, D0 + 0.5, 1.05)), M.darkWood);
    b.add(boxGeo(V(H[0] - 2.4, D0 + 0.5, 0.98), V(H[0] - 1.2, D0 + 0.95, 1.05)), M.darkWood);
    for (const lx of [-2.3, -1.3]) b.add(boxGeo(V(H[0] + lx, D0, 0.8), V(H[0] + lx + 0.1, D0 + 0.44, 1.0)), M.iron);
    // clock pole (clock face is an fx card from cast.ts)
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 8), M.iron, new THREE.Matrix4().makeTranslation(H[0] + 1.4, D0 + 1.3, 0.2));
    b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.1, 10), M.iron, new THREE.Matrix4().makeTranslation(H[0] + 1.4, D0 + 2.62, 0.2));
    // bus stop sign: pole + painted board (in-world label, no text)
    b.add(new THREE.CylinderGeometry(0.04, 0.04, 2.2, 8), M.iron, new THREE.Matrix4().makeTranslation(H[0] - 3.4, D0 + 1.1, 0.4));
    b.add(boxGeo(V(H[0] - 3.75, D0 + 1.7, 0.36), V(H[0] - 3.05, D0 + 2.3, 0.44)), lam("bhSign", () => ({ color: "#2f6fb2" })));
    b.add(boxGeo(V(H[0] - 3.6, D0 + 1.95, 0.34), V(H[0] - 3.2, D0 + 2.08, 0.38)), M.white);
    prop(b, kit, "tree_oak", H[0] - 8, D0, 3, 7, 0.3);
    prop(b, kit, "tree_fat", H[0] + 8.5, D0, 2.5, 6, 1.1);
    prop(b, kit, "lantern", H[0] + 4.2, D0, -1.5, 2.8);

    // ---- KAFE set (shots 5-9): counter, tables, chairs, hanging lamps, menu board ----
    b.add(quadUp(C[0] - 6, C[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(C[0] - 6, D0, 4), V(C[0] + 6, D0 + 6.5, 4.3), 2), M.warm);
    b.add(boxGeo(V(C[0] - 6, D0 + 6.3, 3.9), V(C[0] + 6, D0 + 6.55, 4.35)), M.trim);
    b.add(boxGeo(V(C[0] - 4.6, D0 + 1.7, 3.96), V(C[0] - 2.6, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[-4.75, -2.45, 3.9, 4.05], [-4.75, -2.45, 1.55, 1.7], [-4.75, -4.6, 1.55, 4.05], [-2.6, -2.45, 1.55, 4.05]] as const)
      b.add(boxGeo(V(C[0] + x0, D0 + y0, 3.92), V(C[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // menu board (in-world label: dark board with light menu lines, no readable text needed)
    b.add(boxGeo(V(C[0] - 0.4, D0 + 2.3, 3.92), V(C[0] + 1.6, D0 + 3.6, 3.98)), lam("bhMenu", () => ({ color: "#3a3f47" })));
    for (let r = 0; r < 4; r++)
      b.add(boxGeo(V(C[0] - 0.2, D0 + 3.3 - r * 0.24, 3.9), V(C[0] + 0.9 - (r % 2) * 0.25, D0 + 3.38 - r * 0.24, 3.94)), M.white);
    // counter (top at D0 + 1.1) + coffee machine + cups
    b.add(boxGeo(V(C[0] + 1.8, D0, 2.6), V(C[0] + 4.4, D0 + 1.05, 3.3)), M.darkWood);
    b.add(boxGeo(V(C[0] + 1.75, D0 + 1.05, 2.55), V(C[0] + 4.45, D0 + 1.12, 3.35)), M.wood);
    b.add(boxGeo(V(C[0] + 2.6, D0 + 1.12, 2.85), V(C[0] + 3.3, D0 + 1.62, 3.2)), M.steel);
    b.add(boxGeo(V(C[0] + 2.75, D0 + 1.3, 2.8), V(C[0] + 3.15, D0 + 1.45, 2.87)), M.black);
    for (let i = 0; i < 3; i++)
      b.add(new THREE.CylinderGeometry(0.055, 0.045, 0.09, 10), M.white, new THREE.Matrix4().makeTranslation(C[0] + 2.1 + i * 0.22, D0 + 1.17, 2.8));
    // tables (round tops at D0 + 0.74) + chairs (seat top at D0 + 0.5)
    const cafeTable = (tx: number, tz: number) => {
      b.add(new THREE.CylinderGeometry(0.55, 0.55, 0.05, 16), M.wood, new THREE.Matrix4().makeTranslation(C[0] + tx, D0 + 0.74, tz));
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.72, 8), M.iron, new THREE.Matrix4().makeTranslation(C[0] + tx, D0 + 0.36, tz));
      b.add(new THREE.CylinderGeometry(0.22, 0.26, 0.04, 12), M.iron, new THREE.Matrix4().makeTranslation(C[0] + tx, D0 + 0.02, tz));
    };
    const cafeChair = (cx: number, cz: number) => {
      b.add(boxGeo(V(C[0] + cx - 0.24, D0 + 0.44, cz - 0.24), V(C[0] + cx + 0.24, D0 + 0.5, cz + 0.24)), M.darkWood);
      b.add(boxGeo(V(C[0] + cx - 0.24, D0 + 0.5, cz + 0.16), V(C[0] + cx + 0.24, D0 + 1.0, cz + 0.24)), M.darkWood);
      for (const [lx, lz] of [[-0.2, -0.2], [0.14, -0.2], [-0.2, 0.14], [0.14, 0.14]] as const)
        b.add(boxGeo(V(C[0] + cx + lx, D0, cz + lz), V(C[0] + cx + lx + 0.06, D0 + 0.44, cz + lz + 0.06)), M.darkWood);
    };
    cafeTable(0.1, 1.3); cafeChair(-0.55, 1.0); cafeChair(0.75, 1.6);
    cafeTable(-2.3, 1.3); cafeChair(-2.3, 1.6);
    cafeTable(2.3, 1.3); cafeChair(2.3, 1.6);
    // foreground table near the camera side: low, reads as soft DOF depth in cafe angles
    cafeTable(-1.8, -2.2);
    b.add(new THREE.CylinderGeometry(0.055, 0.045, 0.09, 10), lam("bhCupBlue", () => ({ color: "#7bc4e8" })), new THREE.Matrix4().makeTranslation(C[0] - 1.65, D0 + 0.81, -2.32));
    // coffee cups on the main table
    for (const [cx, cz] of [[-0.15, 1.15], [0.35, 1.45]] as const)
      b.add(new THREE.CylinderGeometry(0.055, 0.045, 0.09, 10), M.white, new THREE.Matrix4().makeTranslation(C[0] + cx, D0 + 0.81, cz));
    // hanging lamps
    for (const lx of [-1.5, 1.5]) {
      b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), M.black, new THREE.Matrix4().makeTranslation(C[0] + lx, D0 + 4.4, 0.8));
      b.add(new THREE.ConeGeometry(0.3, 0.26, 12, 1, true), lam("bhCafeLamp", () => ({ color: "#2f5f43", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(C[0] + lx, D0 + 3.72, 0.8));
    }
    prop(b, kit, "plant_bush", C[0] - 4.8, D0, 2.8, 1.1, 0.5);
    prop(b, kit, "plant_bush", C[0] + 5.0, D0, 1.2, 1.1, 1.3);

    b.build(R);

    // ---- ceiling fans (kamar shot 2, kafe shots 5-9): hub with 3 blades, spins in update ----
    for (const [fx, fz] of [[K[0] + 0.2, 2.2], [C[0] + 0.2, 1.6]] as const) {
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

    // ---- motion upgrade: ambient life (all cheap, pure functions of t) ----
    const soft = softTex();
    // birds: 4 two-triangle flappers crossing the sky on outdoor shots
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
    // falling leaves near the trees
    const leafCols = ["#6fae4e", "#8ab86a", "#d8a04a", "#5d9b45"];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.17),
        new THREE.MeshBasicMaterial({ color: leafCols[i % 4], side: THREE.DoubleSide }));
      m.visible = false; this.leaves.push(m); R.add(m);
    }
    // steam over the cafe coffee machine (shots 5-9)
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: "#ffffff", transparent: true, opacity: 0, depthWrite: false }));
      sp.position.set(C[0] + 2.95, D0 + 1.75, 3.0);
      sp.visible = false; sp.layers.set(NOINK);
      this.steam.push(sp); R.add(sp);
    }
    // dust motes drifting in indoor light
    const ND = 36;
    this.dustBase = new Float32Array(ND * 3);
    let dseed = 7; const drnd = () => { dseed = (dseed * 16807) % 2147483647; return dseed / 2147483647; };
    for (let i = 0; i < ND; i++) {
      this.dustBase[i * 3] = (drnd() - 0.5) * 7; this.dustBase[i * 3 + 1] = 0.4 + drnd() * 2.8; this.dustBase[i * 3 + 2] = (drnd() - 0.5) * 5;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(this.dustBase), 3));
    this.dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: "#fff3cf", size: 0.045, transparent: true, opacity: 0.5, depthWrite: false }));
    this.dust.visible = false; this.dust.frustumCulled = false; this.dust.layers.set(NOINK);
    R.add(this.dust);
    // fireflies at dusk (shot 10)
    for (let i = 0; i < 10; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: "#ffe98a", transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      sp.scale.setScalar(0.16); sp.visible = false; sp.layers.set(NOINK);
      this.fireflies.push(sp); R.add(sp);
    }
    // swaying standalone bushes / grass tufts on outdoor sets
    const swaySpots: [string, number, number, number][] = [
      ["grass_large", 1, J[0] - 6.5, -4.6], ["plant_bush", 1, J[0] + 5.5, 4.0],
      ["grass_large", 4, H[0] - 5.0, 3.4], ["plant_bush", 4, H[0] + 4.8, 2.2],
      ["grass_large", 10, S[0] - 6.5, -4.6], ["plant_bush", 10, S[0] + 3.8, 1.2],
    ];
    swaySpots.forEach(([name, shot, x, z], i) => {
      const o = kitClone(kit, name, name === "grass_large" ? 0.85 : 1.1);
      if (!o) return;
      o.position.set(x, D0, z); o.visible = false;
      this.swayBushes.push({ obj: o, shot, phase: i * 1.37 });
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
    const ctr = SETS[id], outdoor = OUTDOOR.has(id);
    // birds cross the sky on outdoor shots
    this.birds.forEach((g, i) => {
      g.visible = outdoor;
      if (!outdoor) return;
      const span = 64, u = ((t * 2.6 + i * 17) % span) - span / 2;
      g.position.set(ctr[0] + u, D0 + 8.5 + (i % 3) * 1.3 + Math.sin(t * 1.1 + i * 2) * 0.35, ctr[2] - 6 - (i % 2) * 3);
      g.rotation.y = Math.PI / 2;
      const flap = Math.sin(t * 9 + i * 1.7) * 0.55;
      (g.userData.wl as THREE.Mesh).rotation.z = flap;
      (g.userData.wr as THREE.Mesh).rotation.z = -flap;
    });
    // falling leaves near the trees (jalan / halte / sore)
    const leafTree: Record<number, [number, number]> = { 1: [JALAN[0] - 11, -6], 4: [HALTE[0] - 8, 3], 10: [SORE[0] - 11, -6] };
    const lt = leafTree[id];
    this.leaves.forEach((m, i) => {
      m.visible = !!lt;
      if (!lt) return;
      const u = (t * 0.16 + i * 0.173) % 1;
      m.position.set(lt[0] + Math.sin(i * 2.4) * 1.4 + Math.sin(t * 0.9 + i * 3.1) * 0.35 + u * 0.8,
        D0 + 4.4 - u * 4.3, lt[1] + Math.cos(i * 1.9) * 1.2);
      m.rotation.set(t * (1 + i * 0.13), t * 0.7 + i, Math.sin(t * 1.3 + i) * 0.6);
    });
    // steam over the cafe coffee machine (shots 5-9)
    this.steam.forEach((sp, i) => {
      sp.visible = id >= 5 && id <= 9;
      if (id < 5 || id > 9) return;
      const u = (t * 0.32 + i / 5) % 1;
      sp.position.set(KAFE[0] + 2.95 + Math.sin(t * 1.4 + i * 2.2) * 0.06, D0 + 1.75 + u * 0.95, 3.0);
      sp.scale.setScalar(0.16 + u * 0.5);
      (sp.material as THREE.SpriteMaterial).opacity = 0.34 * Math.sin(u * Math.PI);
    });
    // dust motes indoors
    this.dust.visible = !outdoor;
    if (!outdoor) {
      const pos = this.dust.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        pos.setXYZ(i,
          ctr[0] + this.dustBase[i * 3] + Math.sin(t * 0.24 + i * 1.7) * 0.22,
          D0 + this.dustBase[i * 3 + 1] + Math.sin(t * 0.17 + i * 2.3) * 0.14,
          ctr[2] + this.dustBase[i * 3 + 2] + Math.cos(t * 0.2 + i * 1.3) * 0.18);
      }
      pos.needsUpdate = true;
    }
    // fireflies at dusk (shot 10)
    this.fireflies.forEach((sp, i) => {
      sp.visible = id === 10;
      if (id !== 10) return;
      sp.position.set(SORE[0] - 3 + Math.sin(t * 0.23 + i * 2.6) * 3.4 + i * 0.7,
        D0 + 0.7 + Math.sin(t * 0.5 + i * 1.9) * 0.45, SORE[2] - 1 + Math.cos(t * 0.19 + i * 3.1) * 2.2);
      (sp.material as THREE.SpriteMaterial).opacity = 0.15 + 0.6 * Math.max(0, Math.sin(t * 1.6 + i * 2.4)) ** 3;
    });
    // swaying bushes / grass
    for (const sb of this.swayBushes) {
      sb.obj.visible = sb.shot === id;
      if (sb.shot === id) sb.obj.rotation.z = Math.sin(t * 1.25 + sb.phase) * 0.045;
    }
    // ceiling fans spin (kamar shot 2, kafe shots 5-9)
    this.fans.forEach((fan, i) => {
      fan.visible = i === 0 ? id === 2 : id >= 5 && id <= 9;
      if (fan.visible) (fan.userData.hub as THREE.Group).rotation.y = t * 5.2;
    });
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
