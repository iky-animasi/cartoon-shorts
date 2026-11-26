// One three.js scene holding every set of "Di Dunia Ini Kamu Bisa Terbang" at x offsets
// (langit 0, jalan 40, rumah 80, tamu 120). Sky shots fly at y ~ D0 + 7.4 over the langit set.
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
  FPS, D0, SHOTS, LANGIT, JALAN, RUMAH, TAMU,
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
const SETS: Record<number, V3> = { 1: LANGIT, 2: JALAN, 3: LANGIT, 4: LANGIT, 5: LANGIT, 6: LANGIT, 7: LANGIT, 8: RUMAH, 9: TAMU, 10: TAMU };
const OUTDOOR = new Set([1, 2, 3, 4, 5, 6, 7, 8]);

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
  private rain: THREE.LineSegments; private rainBase: Float32Array;
  private lowClouds: THREE.Mesh[] = [];
  private greyClouds: THREE.Mesh[] = [];
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
    M.plaster = lam("tbPlaster", () => ({ color: "#e8dcc4" }));
    M.warm = lam("tbWarm", () => ({ color: "#eec9a0" }));
    M.pale = lam("tbPale", () => ({ color: "#cfd8dc" }));
    M.trim = lam("tbTrim", () => ({ color: "#efe3c8" }));
    M.darkWood = lam("tbWood", () => ({ color: "#6e4b33" }));
    M.glass = lam("tbGlass", () => ({ color: "#d8e8f2" }));
    M.iron = lam("tbIron", () => ({ color: "#3d414c" }));
    M.steel = lam("tbSteel", () => ({ color: "#7d8088" }));
    M.white = lam("tbWhite", () => ({ color: "#f4f6f8" }));
    M.red = lam("tbRed", () => ({ color: "#d43a2a" }));
    M.black = lam("tbBlack", () => ({ color: "#2b2b30" }));
    M.sand = lam("tbSand", () => ({ color: "#e3cf9e" }));

    const b = new Batch();
    const L = LANGIT, J = JALAN, Rm = RUMAH, T = TAMU;

    // ---- street builder (LANGIT ground far below + JALAN shot 2) ----
    const buildStreet = (Ox: number) => {
      b.add(quadUp(Ox - 30, Ox + 30, -30, 30, 30, 30, -0.05), M.grass);
      b.add(quadUp(Ox - 20, Ox + 20, -3.2, 3.2, 20, 3.2, 0.012), M.cobble); // road along x
      b.add(boxGeo(V(Ox - 20, D0, -5), V(Ox + 20, D0 + 0.14, -3.2), 2), M.stone);
      b.add(boxGeo(V(Ox - 20, D0, 3.2), V(Ox + 20, D0 + 0.14, 5), 2), M.stone);
      house(b, Ox - 7, -13, 0, 8, 8, 6.8, 0);
      house(b, Ox + 4, -13, 0, 9, 8, 7.4, 3);
      house(b, Ox + 13, -13, 0, 7, 8, 6.4, 5);
      prop(b, kit, "tree_oak", Ox - 11, D0, -7.5, 6, 0.4);
      prop(b, kit, "tree_fat", Ox + 10, D0, -7, 5.5, 1.2);
      prop(b, kit, "lantern", Ox - 5, D0, -4.2, 2.8);
      prop(b, kit, "lantern", Ox + 7, D0, 4.2, 2.8);
    };
    buildStreet(L[0]);
    buildStreet(J[0]);

    // ---- traffic light on the empty street (shot 2): red lamp lit, nobody there ----
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 3.0, 8), M.iron, new THREE.Matrix4().makeTranslation(J[0] + 1.6, D0 + 1.5, -1.2));
    b.add(boxGeo(V(J[0] + 1.38, D0 + 2.15, -1.34), V(J[0] + 1.82, D0 + 3.15, -1.06)), M.black);
    const lampRed = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.04, 14),
      new THREE.MeshBasicMaterial({ color: "#ff3b30" }));
    lampRed.rotation.x = Math.PI / 2;
    lampRed.position.set(J[0] + 1.6, D0 + 2.92, -1.04);
    lampRed.layers.set(NOINK);
    R.add(lampRed);
    for (const ly of [2.65, 2.38])
      b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 12), lam("tbLampOff", () => ({ color: "#4a4f58" })),
        new THREE.Matrix4().makeRotationX(Math.PI / 2).setPosition(J[0] + 1.6, D0 + ly, -1.04));

    // ---- RUMAH set (shot 8): house front + path + fence + tree ----
    b.add(quadUp(Rm[0] - 30, Rm[0] + 30, -30, 30, 30, 30, -0.05), M.grass);
    house(b, Rm[0], -6.5, 0, 9, 8, 7.5, 2);
    b.add(quadUp(Rm[0] - 1.1, Rm[0] + 1.1, -3.4, 3.4, 2, 3, 0.03), M.stone); // path to the door
    prop(b, kit, "tree_oak", Rm[0] - 5.5, D0, -1.5, 6.5, 0.7);
    prop(b, kit, "lantern", Rm[0] + 2.2, D0, 2.6, 2.8);
    prop(b, kit, "flower_redA", Rm[0] - 2.6, D0, 1.8, 0.7, 0.3);
    prop(b, kit, "flower_yellowA", Rm[0] + 3.1, D0, 0.9, 0.7, 1.1);

    // ---- TAMU set (shots 9-10): living room, sofa + coffee table + TV ----
    b.add(quadUp(T[0] - 6, T[0] + 6, -5, 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(T[0] - 6, D0, 4), V(T[0] + 6, D0 + 6.5, 4.3), 2), M.warm);
    b.add(boxGeo(V(T[0] - 6, D0 + 6.3, 3.9), V(T[0] + 6, D0 + 6.55, 4.35)), M.trim);
    b.add(boxGeo(V(T[0] + 1.8, D0 + 1.7, 3.96), V(T[0] + 4.2, D0 + 3.9, 4.0)), M.glass);
    for (const [x0, x1, y0, y1] of [[1.65, 4.35, 3.9, 4.05], [1.65, 4.35, 1.55, 1.7], [1.65, 1.8, 1.55, 4.05], [4.2, 4.35, 1.55, 4.05]] as const)
      b.add(boxGeo(V(T[0] + x0, D0 + y0, 3.92), V(T[0] + x1, D0 + y1, 4.02)), M.darkWood);
    // sofa (seat top at D0 + 0.55), hero sits at x T-0.5, z +0.9
    b.add(boxGeo(V(T[0] - 1.7, D0, 0.55), V(T[0] + 0.7, D0 + 0.55, 1.35)), lam("tbSofa", () => ({ color: "#b5653f" })));
    b.add(boxGeo(V(T[0] - 1.7, D0 + 0.55, 1.05), V(T[0] + 0.7, D0 + 1.15, 1.35)), lam("tbSofa", () => ({ color: "#b5653f" })));
    b.add(boxGeo(V(T[0] - 1.85, D0 + 0.3, 0.55), V(T[0] - 1.6, D0 + 0.8, 1.35)), lam("tbSofa", () => ({ color: "#b5653f" })));
    b.add(boxGeo(V(T[0] + 0.6, D0 + 0.3, 0.55), V(T[0] + 0.85, D0 + 0.8, 1.35)), lam("tbSofa", () => ({ color: "#b5653f" })));
    // coffee table + the electricity bill lying on it
    b.add(boxGeo(V(T[0] - 1.1, D0 + 0.44, -0.15), V(T[0] + 0.3, D0 + 0.5, 0.55)), M.wood);
    for (const [lx, lz] of [[-1.0, -0.05], [0.2, -0.05], [-1.0, 0.45], [0.2, 0.45]] as const)
      b.add(boxGeo(V(T[0] + lx, D0, lz), V(T[0] + lx + 0.08, D0 + 0.44, lz + 0.08)), M.darkWood);
    b.add(boxGeo(V(T[0] - 0.15, D0 + 0.5, 0.05), V(T[0] + 0.15, D0 + 0.53, 0.4)), M.white);
    // picture frame on the back wall
    b.add(boxGeo(V(T[0] - 2.9, D0 + 2.4, 3.94), V(T[0] - 1.5, D0 + 3.5, 4.0)), M.darkWood);
    b.add(boxGeo(V(T[0] - 2.78, D0 + 2.52, 3.92), V(T[0] - 1.62, D0 + 3.38, 3.95)), lam("tbPic", () => ({ color: "#a8d8b9" })));
    b.add(boxGeo(V(T[0] - 2.2, D0 + 0.02, -0.9), V(T[0] + 1.4, D0 + 0.06, 1.9)), lam("tbRug", () => ({ color: "#7ba7c9" })));
    prop(b, kit, "plant_bush", T[0] + 4.8, D0, 2.6, 1.1, 0.4);
    prop(b, kit, "lantern", T[0] - 4.9, D0, 0.6, 1.6);

    b.build(R);

    // ---- ceiling fan (tamu shots 9-10): hub with 3 blades, spins in update ----
    for (const [fx, fz] of [[T[0] - 0.2, 1.4]] as const) {
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
      fan.position.set(fx, D0 + 3.55, fz);
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
    // rain streaks (shots 6-7): 220 short line segments falling around the focus
    const NR = 220;
    this.rainBase = new Float32Array(NR * 3);
    let rseed = 13; const rrnd = () => { rseed = (rseed * 16807) % 2147483647; return rseed / 2147483647; };
    for (let i = 0; i < NR; i++) {
      this.rainBase[i * 3] = (rrnd() - 0.5) * 16; this.rainBase[i * 3 + 1] = rrnd() * 9; this.rainBase[i * 3 + 2] = (rrnd() - 0.5) * 12;
    }
    const rainGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(NR * 6), 3));
    this.rain = new THREE.LineSegments(rainGeo, new THREE.LineBasicMaterial({ color: "#bfe3ff", transparent: true, opacity: 0.7 }));
    this.rain.visible = false; this.rain.frustumCulled = false; this.rain.layers.set(NOINK);
    R.add(this.rain);
    // low clouds drifting BELOW/BEHIND the flight path over the langit set + grey storm clouds (shots 6-7)
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], transparent: true, depthWrite: false, fog: false, opacity: 0.9 }));
      const w = 8 + (i % 3) * 3;
      m.scale.set(w, w / 2.2, 1);
      m.userData = { bx: L[0] - 14 + i * 5.5, y: D0 + 3.6 + (i % 3) * 1.1, z: -9 - (i % 3) * 2.5, sp: 0.5 + (i % 3) * 0.22 };
      m.visible = false; m.layers.set(NOINK);
      this.lowClouds.push(m); R.add(m);
    }
    for (let i = 0; i < 3; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
        new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[(i + 1) % 4], color: new THREE.Color(0.42, 0.45, 0.52), transparent: true, depthWrite: false, fog: false, opacity: 0.97 }));
      const w = 22 + i * 5;
      m.scale.set(w, w / 2.4, 1);
      m.userData = { bx: L[0] - 9 + i * 8, y: D0 + 11.8 + i * 0.9, z: -11 - i * 2.5, sp: 0.35 + i * 0.12 };
      m.visible = false; m.layers.set(NOINK);
      this.greyClouds.push(m); R.add(m);
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
      ["grass_large", 2, J[0] - 6.5, -4.6], ["plant_bush", 2, J[0] + 5.5, 4.0],
      ["grass_large", 8, Rm[0] - 4.5, 2.2], ["plant_bush", 8, Rm[0] + 4.6, 1.4],
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
    // falling leaves near the trees (jalan shot 2 / rumah shot 8)
    const leafTree: Record<number, [number, number]> = { 2: [JALAN[0] - 11, -6], 8: [RUMAH[0] - 5.5, -1.5] };
    const lt = leafTree[id];
    this.leaves.forEach((m, i) => {
      m.visible = !!lt;
      if (!lt) return;
      const u = (t * 0.16 + i * 0.173) % 1;
      m.position.set(lt[0] + Math.sin(i * 2.4) * 1.4 + Math.sin(t * 0.9 + i * 3.1) * 0.35 + u * 0.8,
        D0 + 4.4 - u * 4.3, lt[1] + Math.cos(i * 1.9) * 1.2);
      m.rotation.set(t * (1 + i * 0.13), t * 0.7 + i, Math.sin(t * 1.3 + i) * 0.6);
    });
    // rain streaks (shots 6-7): fall fast around the focus, wrap in a 9 m column
    this.rain.visible = id === 6 || id === 7;
    if (this.rain.visible) {
      const pos = this.rain.geometry.getAttribute("position") as THREE.BufferAttribute;
      for (let i = 0; i < pos.count / 2; i++) {
        const bx = ctr[0] + this.rainBase[i * 3], bz = ctr[2] + this.rainBase[i * 3 + 2];
        const y = D0 + 3 + ((this.rainBase[i * 3 + 1] - t * 7.5) % 9 + 9) % 9;
        pos.setXYZ(i * 2, bx, y, bz);
        pos.setXYZ(i * 2 + 1, bx - 0.06, y - 0.42, bz);
      }
      pos.needsUpdate = true;
    }
    // low clouds drift at flight height (sky shots); grey storm clouds for the rain shots
    const skyShot = id === 1 || id === 3 || id === 4 || id === 5 || id === 6 || id === 7;
    for (const m of this.lowClouds) {
      m.visible = skyShot;
      if (!skyShot) continue;
      const u = m.userData as { bx: number; y: number; z: number; sp: number };
      m.position.set(LANGIT[0] + (((u.bx - LANGIT[0] + t * u.sp + 18) % 36) - 18), u.y, u.z);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
    }
    for (const m of this.greyClouds) {
      m.visible = id === 6 || id === 7;
      if (!m.visible) continue;
      const u = m.userData as { bx: number; y: number; z: number; sp: number };
      m.position.set(LANGIT[0] + (((u.bx - LANGIT[0] + t * u.sp + 18) % 36) - 18), u.y, u.z);
      m.lookAt(cam.position.x, m.position.y, cam.position.z);
    }
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
    // fireflies: not used in this episode (no dusk shot)
    this.fireflies.forEach((sp) => { sp.visible = false; });
    // swaying bushes / grass
    for (const sb of this.swayBushes) {
      sb.obj.visible = sb.shot === id;
      if (sb.shot === id) sb.obj.rotation.z = Math.sin(t * 1.25 + sb.phase) * 0.045;
    }
    // ceiling fan spins (tamu shots 9-10)
    this.fans.forEach((fan) => {
      fan.visible = id === 9 || id === 10;
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
