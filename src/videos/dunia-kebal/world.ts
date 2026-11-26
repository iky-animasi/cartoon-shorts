// One three.js scene holding every set of "Di Dunia Ini Kamu Kebal" at x offsets
// (street 0, dapur 40, periksa 80, sungai 120, taman 160, singa 200, rumah 240).
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
  FPS, D0, SHOTS, STREET, DAPUR, PERIKSA, SUNGAI, TAMAN, SINGA, RUMAH,
  camAt, heroX1, fallX4, treeFall, treeLift, smooth, clamp01, V3, ShotDef,
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
/** asphalt crack decal: jagged dark lines radiating from a centre point (transparent bg) */
const crackTex = () => ctex("crackDK", 512, 512, (g) => {
  g.clearRect(0, 0, 512, 512);
  g.strokeStyle = "#3a3f47"; g.lineCap = "round";
  let seed = 13;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let k = 0; k < 7; k++) {
    let x = 256, y = 256, a = (k / 7) * Math.PI * 2 + rnd() * 0.5;
    g.lineWidth = 9 - k * 0.6;
    g.beginPath(); g.moveTo(x, y);
    for (let i = 0; i < 6; i++) {
      a += (rnd() - 0.5) * 0.7;
      x += Math.cos(a) * (26 + rnd() * 18); y += Math.sin(a) * (26 + rnd() * 18);
      g.lineTo(x, y);
    }
    g.stroke();
  }
  g.beginPath(); g.ellipse(256, 256, 42, 30, 0.4, 0, Math.PI * 2); g.lineWidth = 7; g.stroke();
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
  private ball: THREE.Mesh;
  private motor: THREE.Group;
  private crack: THREE.Mesh;
  private fallTree: THREE.Object3D | null;
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
    M.plaster = lam("dkPlaster", () => ({ color: "#e8dcc4" }));
    M.warm = lam("dkWarm", () => ({ color: "#eec9a0" }));
    M.pale = lam("dkPale", () => ({ color: "#cfd8dc" }));
    M.trim = lam("dkTrim", () => ({ color: "#efe3c8" }));
    M.darkWood = lam("dkWood", () => ({ color: "#6e4b33" }));
    M.glass = lam("dkGlass", () => ({ color: "#d8e8f2" }));
    M.iron = lam("dkIron", () => ({ color: "#3d414c" }));
    M.steel = lam("dkSteel", () => ({ color: "#7d8088" }));
    M.white = lam("dkWhite", () => ({ color: "#f4f6f8" }));
    M.red = lam("dkRed", () => ({ color: "#d43a2a" }));
    M.motorRed = lam("dkMotorRed", () => ({ color: "#c0392b" }));
    M.black = lam("dkBlack", () => ({ color: "#2b2b30" }));
    M.water = lam("dkWater", () => ({ color: "#3f8fc4" }));
    M.sand = lam("dkSand", () => ({ color: "#e3cf9e" }));
    M.rock = lam("dkRock", () => ({ color: "#9a958c" }));

    const b = new Batch();
    const S = STREET, D = DAPUR, P = PERIKSA, G = SUNGAI, T = TAMAN, L = SINGA, Rm = RUMAH;

    // ---- STREET set (shots 1, 4) ----
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

    // ---- DAPUR set (shot 2) ----
    b.add(quadUp(D[0] - 6, D[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(D[0] - 6, D0, 4), V(D[0] + 6, D0 + 5, 4.3), 2), M.warm);
    b.add(boxGeo(V(D[0] - 6, D0 + 4.8, 3.9), V(D[0] + 6, D0 + 5.05, 4.35)), M.trim);
    b.add(boxGeo(V(D[0] + 1.6, D0 + 1.7, 3.96), V(D[0] + 3.6, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[1.45, 3.75, 3.9, 4.05], [1.45, 3.75, 1.55, 1.7], [1.45, 1.6, 1.55, 4.05], [3.6, 3.75, 1.55, 4.05]] as const)
      b.add(boxGeo(V(D[0] + x0, D0 + y0, 3.92), V(D[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // stove counter + cutting board + vegetables
    b.add(boxGeo(V(D[0] - 1.8, D0, 0.75), V(D[0] + 1.8, D0 + 0.9, 1.55)), M.wood);
    b.add(boxGeo(V(D[0] - 1.85, D0 + 0.9, 0.7), V(D[0] + 1.85, D0 + 0.97, 1.6)), M.black);
    b.add(boxGeo(V(D[0] - 0.5, D0 + 0.97, 0.85), V(D[0] + 0.5, D0 + 1.02, 1.4)), lam("dkBoard", () => ({ color: "#d8b98e" })));
    for (const [vx, vz, vc] of [[-0.3, 1.05, "#e2453c"], [0.15, 1.2, "#e8c85a"], [-0.05, 0.95, "#8ab86a"]] as const)
      b.add(new THREE.SphereGeometry(0.09, 10, 8), lam("dkVeg" + vc, () => ({ color: vc })), new THREE.Matrix4().makeTranslation(D[0] + vx, D0 + 1.1, vz));
    // shelf + jars
    b.add(boxGeo(V(D[0] - 4.2, D0 + 2.3, 3.7), V(D[0] - 1.2, D0 + 2.38, 4.0)), M.darkWood);
    for (let i = 0; i < 4; i++)
      b.add(new THREE.CylinderGeometry(0.13, 0.13, 0.32, 10), lam("dkJar" + i, () => ({ color: ["#c9775a", "#7ba7c9", "#e8c85a", "#8ab86a"][i] })),
        new THREE.Matrix4().makeTranslation(D[0] - 3.9 + i * 0.75, D0 + 2.54, 3.85));
    // hanging lamp
    b.add(new THREE.CylinderGeometry(0.02, 0.02, 1.2, 6), M.black, new THREE.Matrix4().makeTranslation(D[0], D0 + 4.4, 0.6));
    b.add(new THREE.ConeGeometry(0.3, 0.26, 12, 1, true), lam("dkLamp", () => ({ color: "#2f5f43", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(D[0], D0 + 3.72, 0.6));

    // ---- PERIKSA / OPERASI set (shots 3, 8, 9) ----
    b.add(quadUp(P[0] - 6, P[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(P[0] - 6, D0, 4), V(P[0] + 6, D0 + 5, 4.3), 2), M.pale);
    b.add(boxGeo(V(P[0] - 6, D0 + 4.8, 3.9), V(P[0] + 6, D0 + 5.05, 4.35)), M.trim);
    // operating table (top surface at D0 + 0.95) + cushion
    b.add(boxGeo(V(P[0] - 1.5, D0, 0.0), V(P[0] + 1.1, D0 + 0.8, 0.9)), M.steel);
    b.add(boxGeo(V(P[0] - 1.6, D0 + 0.8, -0.05), V(P[0] + 1.2, D0 + 0.95, 0.95)), lam("dkCushion", () => ({ color: "#7ba7c9" })));
    b.add(boxGeo(V(P[0] + 0.7, D0 + 0.95, 0.55), V(P[0] + 1.15, D0 + 1.08, 0.9)), M.white); // pillow (head end)
    // operating lamp above the table
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 1.5, 6), M.steel, new THREE.Matrix4().makeTranslation(P[0] - 0.2, D0 + 4.2, 0.45));
    b.add(new THREE.ConeGeometry(0.55, 0.4, 14, 1, true), lam("dkOpLamp", () => ({ color: "#d8dde2", side: THREE.DoubleSide })), new THREE.Matrix4().makeTranslation(P[0] - 0.2, D0 + 3.4, 0.45));
    b.add(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.7, 1.6, 1.2) }), new THREE.Matrix4().makeTranslation(P[0] - 0.2, D0 + 3.28, 0.45));
    // stool + cabinet + IV stand
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.08, 14), M.darkWood, new THREE.Matrix4().makeTranslation(P[0] + 2.6, D0 + 0.55, 1.2));
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.55, 8), M.steel, new THREE.Matrix4().makeTranslation(P[0] + 2.6, D0 + 0.27, 1.2));
    b.add(boxGeo(V(P[0] - 5.4, D0, 3.2), V(P[0] - 3.4, D0 + 1.6, 3.9)), M.white);
    b.add(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), M.steel, new THREE.Matrix4().makeTranslation(P[0] - 2.2, D0 + 1.1, 1.4));
    b.add(boxGeo(V(P[0] - 2.32, D0 + 1.85, 1.32), V(P[0] - 2.08, D0 + 2.2, 1.48)), lam("dkIvBag", () => ({ color: "#cfe8f2" })));
    // red cross sign on the wall
    b.add(boxGeo(V(P[0] + 2.2, D0 + 2.6, 3.92), V(P[0] + 3.4, D0 + 3.8, 3.98)), M.white);
    b.add(boxGeo(V(P[0] + 2.65, D0 + 2.75, 3.9), V(P[0] + 2.95, D0 + 3.65, 3.94)), M.red);
    b.add(boxGeo(V(P[0] + 2.35, D0 + 3.05, 3.9), V(P[0] + 3.25, D0 + 3.35, 3.94)), M.red);

    // ---- SUNGAI set (shot 5) ----
    b.add(quadUp(G[0] - 26, G[0] + 26, -22, 26, 26, 24, -0.05), M.grass);
    b.add(quadUp(G[0] - 26, G[0] + 26, 2.2, 26, 26, 12, -0.02), M.water); // river behind
    b.add(quadUp(G[0] - 26, G[0] + 26, 1.2, 2.6, 26, 1, 0.0), M.sand); // sandy bank
    b.add(boxGeo(V(G[0] - 1.2, D0, 0.7), V(G[0] - 0.5, D0 + 0.35, 1.2)), M.rock);
    b.add(boxGeo(V(G[0] + 3.8, D0, 1.0), V(G[0] + 4.6, D0 + 0.5, 1.7)), M.rock);
    prop(b, kit, "canoe", G[0] + 5.5, D0, 4.5, 1.2, 0.4);
    prop(b, kit, "tree_oak", G[0] - 7, D0, -2, 7, 0.3);
    prop(b, kit, "tree_fat", G[0] + 8, D0, -3, 6, 1.1);
    prop(b, kit, "plant_bushLarge", G[0] - 4.5, D0, 1.4, 1.3, 0.6);
    prop(b, kit, "grass_large", G[0] + 2.8, D0, 1.6, 0.9, 0.2);
    prop(b, kit, "grass_large", G[0] - 2.6, D0, 1.8, 0.9, 1.3);

    // ---- TAMAN set (shot 6) ----
    b.add(quadUp(T[0] - 30, T[0] + 30, -28, 28, 30, 28, -0.05), M.grass);
    b.add(quadUp(T[0] - 2.2, T[0] + 2.2, -14, 14, 2.2, 14, 0.015), M.stone); // path
    prop(b, kit, "stall-bench", T[0] + 2.8, D0, 2.4, 1.0, -Math.PI / 2);
    prop(b, kit, "tree_fat", T[0] + 6.5, D0, 5.5, 6.5, 1.4);
    prop(b, kit, "tree-high-round", T[0] - 8, D0, -2, 8, 0.8);
    prop(b, kit, "hedge", T[0] - 4, D0, 8, 1.2, 0);
    prop(b, kit, "hedge", T[0] + 4.5, D0, 8, 1.2, 0);
    prop(b, kit, "flower_redA", T[0] - 3.2, D0, 1.2, 0.5, 0.3);
    prop(b, kit, "flower_yellowA", T[0] + 3.4, D0, 0.6, 0.5, 1.1);
    prop(b, kit, "lantern", T[0] - 3.4, D0, -3.5, 2.8);

    // ---- SINGA cage set (shot 7) ----
    b.add(quadUp(L[0] - 16, L[0] + 16, -14, 14, 16, 14, -0.05), M.grass);
    b.add(quadUp(L[0] - 5, L[0] + 5, -3, 3.4, 5, 3.2, 0.015), M.sand); // cage floor
    // back + side bars
    const barGeo = new THREE.CylinderGeometry(0.035, 0.035, 3.2, 6);
    for (let i = 0; i <= 10; i++)
      b.add(barGeo, M.iron, new THREE.Matrix4().makeTranslation(L[0] - 4 + i * 0.8, D0 + 1.6, 3.0));
    for (const sx of [-4, 4]) for (let i = 0; i <= 6; i++)
      b.add(barGeo, M.iron, new THREE.Matrix4().makeTranslation(L[0] + sx, D0 + 1.6, -2.2 + i * 0.85));
    // front gate frame (open): two posts + top bar, no bars blocking the camera
    for (const gx of [-4, 4]) b.add(boxGeo(V(L[0] + gx - 0.09, D0, -2.3), V(L[0] + gx + 0.09, D0 + 3.3, -2.1)), M.iron);
    b.add(boxGeo(V(L[0] - 4.1, D0 + 3.15, -2.3), V(L[0] + 4.1, D0 + 3.32, -2.1)), M.iron);
    b.add(boxGeo(V(L[0] - 4.1, D0 + 3.2, 2.9), V(L[0] + 4.1, D0 + 3.37, 3.1)), M.iron);
    b.add(boxGeo(V(L[0] + 2.4, D0, 1.8), V(L[0] + 3.6, D0 + 0.7, 2.8)), M.rock); // lion's rock
    prop(b, kit, "plant_bush", L[0] - 3.4, D0, 2.4, 1.0, 0.5);
    prop(b, kit, "tree_default", L[0] - 8, D0, -4, 6.5, 0.7);
    prop(b, kit, "tree_oak", L[0] + 8.5, D0, -3, 7, 0.2);

    // ---- RUMAH set (shot 10, dusk) ----
    b.add(quadUp(Rm[0] - 30, Rm[0] + 30, -28, 28, 30, 28, -0.05), M.grass);
    b.add(quadUp(Rm[0] - 1.6, Rm[0] + 1.6, -12, 4, 1.6, 8, 0.015), M.stone); // path to the door
    house(b, Rm[0] + 1.0, 5.5, Math.PI, 8, 7, 7.5, 1);
    b.add(boxGeo(V(Rm[0] + 0.2, D0, 1.6), V(Rm[0] + 1.8, D0 + 0.18, 2.2)), M.stone); // porch step
    prop(b, kit, "lantern", Rm[0] + 2.6, D0, 1.4, 2.8);
    prop(b, kit, "tree_oak", Rm[0] - 6.5, D0, 3, 7, 0.4);
    prop(b, kit, "hedge", Rm[0] - 3.5, D0, 2.5, 1.2, 0);
    prop(b, kit, "hedge", Rm[0] + 5.5, D0, 2.5, 1.2, 0);
    prop(b, kit, "flower_purpleA", Rm[0] - 2.2, D0, 1.0, 0.5, 2.0);

    b.build(R);

    // ---- kasti ball (shot 1) ----
    this.ball = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), lam("dkBall", () => ({ color: "#e2453c" })));
    this.ball.castShadow = true;
    this.ball.position.set(S[0] - 8, D0 + 0.16, S[2]);
    this.ball.visible = false;
    R.add(this.ball);

    // ---- motorcycle (shot 4): simple cartoon build, travels +x ----
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
    this.motor.position.set(S[0] - 14, D0, S[2] - 0.8);
    this.motor.visible = false;
    R.add(this.motor);

    // ---- asphalt crack (shot 4, appears f572) ----
    this.crack = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6),
      new THREE.MeshBasicMaterial({ map: crackTex(), transparent: true, depthWrite: false }));
    this.crack.rotation.x = -Math.PI / 2;
    this.crack.position.set(S[0] + 0.6, D0 + 0.03, S[2] - 0.8);
    this.crack.visible = false;
    this.crack.layers.set(NOINK);
    R.add(this.crack);

    // ---- falling tree (shot 6): Kenney clone, pivot at its base ----
    this.fallTree = kitClone(kit, "tree_oak", 5.2);
    if (this.fallTree) {
      this.fallTree.position.set(T[0] + 1.15, D0, T[2] + 0.2);
      this.fallTree.visible = false;
      R.add(this.fallTree);
    }
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
    // kasti ball (shot 1): thrown in from the left, bounces off the hero at f115
    this.ball.visible = id === 1;
    if (id === 1) {
      const hx = STREET[0] + heroX1(115);
      if (f < 115) {
        const u = clamp01((f - 88) / 27);
        this.ball.position.set(STREET[0] - 5.5 + u * (hx + 5.5), D0 + 0.9 + Math.sin(u * Math.PI) * 0.7, STREET[2]);
      } else if (f < 145) {
        const u = (f - 115) / 30;
        this.ball.position.set(hx - u * 3.2, D0 + 1.3 + Math.sin(u * Math.PI) * 1.4 - u * 1.1, STREET[2] - u * 0.8);
      } else {
        const u = clamp01((f - 145) / 15);
        this.ball.position.set(hx - 3.2 - u * 1.2, D0 + 0.16 + Math.abs(Math.sin(u * Math.PI * 2)) * 0.25 * (1 - u), STREET[2] - 0.8 - u * 0.5);
      }
    }
    // motorcycle (shot 4): races in with the hero, tips over at f452
    this.motor.visible = id === 4;
    if (id === 4) {
      if (f < 452) {
        this.motor.position.x = STREET[0] + fallX4(f);
        this.motor.rotation.set(0, 0, 0);
        this.motor.position.y = D0;
      } else {
        const tip = smooth((f - 452) / 14);
        this.motor.position.x = STREET[0] + 0.2 + tip * 0.5;
        this.motor.rotation.x = tip * 1.25;
        this.motor.position.y = D0 + tip * 0.12;
      }
    }
    this.crack.visible = id === 4 && f >= 572;
    // falling tree (shot 6): falls onto the hero f743-775, lifted onto his shoulder f799-847
    if (this.fallTree) {
      this.fallTree.visible = id === 6;
      if (id === 6) {
        const fall = treeFall(f), lift = treeLift(f);
        const ang = fall * 1.32 * (1 - lift) + lift * 0.18; // down across the hero, then up on the shoulder
        this.fallTree.rotation.set(0, 0.4, ang);
        const baseX = TAMAN[0] + 1.15, shoulderX = TAMAN[0] + 0.35;
        this.fallTree.position.set(
          baseX + (shoulderX - baseX) * lift,
          D0 + lift * 1.3,
          TAMAN[2] + 0.2,
        );
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
