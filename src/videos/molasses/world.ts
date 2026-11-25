// The whole place as one three.js scene: sky, Commercial Street with its 1919 Boston houses, the molasses tank,
// the wave and the flood, the elevated railway with its train, the office and spoon sets, chimney smoke, clouds
// and the cast. update(id, f, camera) poses everything for shot `id` at frame f (pure function of id + f).
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getInputProps, staticFile } from "remotion";
import { Batch, Strand, boxGeo, V, lam, buildTown, chimneyTops, Kit, Ray, kitClone } from "./build";
import { ctex, cobbleHD, grassHD, stoneHD, cloudHD, tankHD, molassesHD, planksHD, beam, rep } from "./paint";
import { Pen } from "./toon";
import { LIGHTS, LOOK, LightPreset } from "./lights";
import { TONE, CHAR, twoTone, untone } from "./shade";
import { NOINK } from "./ink";
import { Pool, Actor, Fx, stage, snapFx, splashFx, creakFx } from "./cast";
import { FPS, D0, SHOTS, BURST, TANK, TANK_R, TANK_H, RAIL_X, TRAIN_Z, OFFICE, SPOON, camAt, molState, MolState, V3, smooth, FOREGROUND, ShotDef } from "./story";

// ---------------- assets ----------------
const KENNEY = ["tree_oak", "tree_default", "tree_detailed", "tree_fat", "tree_cone", "tree-high-round", "tree", "plant_bushLarge", "plant_bushDetailed",
  "plant_bush", "hedge", "flower_redA", "flower_yellowA", "flower_purpleA", "grass_large", "grass", "lily_large", "lantern", "cart", "stall-red",
  "stall-green", "stall-bench", "banner-red", "banner-green", "windmill", "canoe"];
let kitP: Promise<Kit> | null = null;
export const loadKit = () => {
  if (!kitP) {
    const loader = new GLTFLoader();
    kitP = Promise.all(KENNEY.map((n) => loader.loadAsync(staticFile(`bridge/kenney/${n}.glb`)).then((g) => [n, g.scene] as const).catch(() => [n, null] as const)))
      .then((list) => Object.fromEntries(list.filter((e) => e[1]).map(([n, s]) => [n, s!])) as Kit);
  }
  return kitP;
};

// ---------------- molasses geometry constants ----------------
const TANK_FRONT = TANK[2] + TANK_R; // -26.5, the street-facing edge of the tank
const WAVE_H = 8; // the wave wall is 8 m tall (SCRIPT.md)
const TRAIN_LIFT = 2.2; // metres the car rises off the rails at peak lift
const RAIL_TOP = D0 + 6.8; // top of the running rails
/** points on the tank wall where the groan creaks show (shot 5): on the cylinder at the given angles */
const CREAK_PTS: V3[] = [0.45, -0.4, 0.1].map((th, i) =>
  [TANK[0] + TANK_R * Math.sin(th), D0 + [9, 6, 12][i], TANK[2] + TANK_R * Math.cos(th)] as V3);

const beamBetween = (a: THREE.Vector3, b: THREE.Vector3, th: number) => {
  const g = new THREE.BoxGeometry(th, a.distanceTo(b), th);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};
const pipeBetween = (a: THREE.Vector3, b: THREE.Vector3, r: number) => {
  const g = new THREE.CylinderGeometry(r, r, a.distanceTo(b), 10);
  const m = new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5),
    new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize()), V(1, 1, 1));
  return g.applyMatrix4(m);
};
/** sun disc (solid, soft rim) and the flat golden halo (lighting.md 6 / depth.md 6.4: r50 13-26 % of the frame width) */
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
/** per-shot sun override (story.ts ShotDef sunAz/sunEl win if present); the molasses shots need none: the day and
 *  golden presets cover the street, and both golden sets (spoon, walking wall) want the low backlit sun as is */
const SUN_SHOT: Record<number, { az?: number; el?: number }> = {};
const smokeTex = () => ctex("smoke", 256, 256, (g) => {
  const p = new Pen(g);
  for (const [x, y, r, c] of [[90, 150, 60, "#8f8d96"], [150, 120, 70, "#a3a1aa"], [170, 165, 55, "#8f8d96"], [120, 100, 50, "#b4b2ba"]] as const) p.ell(x, y, r, r * 0.85, c, 0);
});
/** train car side: deep red-brown body, seven pale windows with a diagonal glint (Boston Elevated, 1919) */
const trainTex = () => ctex("trainSide", 1024, 256, (g) => {
  g.fillStyle = "#7a3b2e"; g.fillRect(0, 0, 1024, 256);
  g.fillStyle = "#8a4436"; g.fillRect(0, 0, 1024, 26);
  g.fillStyle = "rgba(0,0,0,0.18)"; g.fillRect(0, 210, 1024, 46);
  for (let i = 0; i < 7; i++) {
    const x = 40 + i * 138;
    g.fillStyle = "#e8e2d2"; g.fillRect(x - 4, 52, 108, 116);
    const gg = g.createLinearGradient(x, 52, x, 168); gg.addColorStop(0, "#a8c8e0"); gg.addColorStop(1, "#5a7fa8");
    g.fillStyle = gg; g.fillRect(x, 56, 100, 108);
    g.fillStyle = "rgba(255,255,255,0.5)";
    g.beginPath(); g.moveTo(x + 8, 164); g.lineTo(x + 55, 56); g.lineTo(x + 75, 56); g.lineTo(x + 8, 140); g.fill();
    g.fillStyle = "#e8e2d2"; g.fillRect(x + 48, 56, 4, 108);
  }
  g.fillStyle = "#5a2a20"; g.fillRect(0, 200, 1024, 8);
});
/** the engineer's blueprint: white linework on blueprint blue — tank elevation, dimensions, signature box */
const blueprintTex = () => ctex("blueprint", 512, 360, (g) => {
  g.fillStyle = "#1e4f8a"; g.fillRect(0, 0, 512, 360);
  g.strokeStyle = "rgba(255,255,255,0.22)"; g.lineWidth = 1;
  for (let x = 0; x <= 512; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 360); g.stroke(); }
  for (let y = 0; y <= 360; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(512, y); g.stroke(); }
  g.strokeStyle = "#eef4ff"; g.lineWidth = 3;
  g.strokeRect(90, 60, 220, 180);
  g.beginPath(); g.ellipse(200, 60, 110, 26, 0, Math.PI, 0); g.stroke();
  g.beginPath(); g.moveTo(90, 240); g.lineTo(310, 240); g.moveTo(200, 240); g.lineTo(200, 300); g.stroke();
  g.fillStyle = "#eef4ff"; g.font = "bold 26px sans-serif"; g.fillText("TANK 50 FT", 330, 120);
  g.font = "20px sans-serif"; g.fillText("DIA 90 FT", 330, 155);
  g.strokeRect(360, 250, 120, 70);
  g.font = "italic 22px sans-serif"; g.fillText("Approved", 372, 285);
  g.strokeStyle = "#eef4ff"; g.lineWidth = 2;
  g.beginPath(); g.moveTo(372, 302); g.quadraticCurveTo(410, 290, 440, 304); g.stroke();
});

/** every lens position of the film looking at its subject: centre, sides and top of frame (houses there are left out) */
const sightLines = (): Ray[] => {
  const out: Ray[] = [];
  for (const s of SHOTS) for (let f = s.a - 8; f < s.b + 8; f += 2) {
    const c = camAt(s.id, Math.max(0, f)), o = V(...c.pos), look = V(...c.look);
    const fw = look.clone().sub(o), len = fw.length();
    fw.normalize();
    const rt = fw.clone().cross(V(0, 1, 0)).normalize(), up = rt.clone().cross(fw);
    const ty = Math.tan((c.fov * Math.PI) / 360), tx = ty * (9 / 16);
    for (const [sx, sy] of [[0, 0], [-0.6, 0], [0.6, 0], [0, 0.6], [0, -0.4]])
      out.push({ o, d: fw.clone().addScaledVector(rt, sx * tx).addScaledVector(up, sy * ty), len, core: sx === 0 && sy === 0 });
  }
  return out;
};

type Mats = Record<string, THREE.Material>;
/** one flying tank fragment: ballistic from the burst, tumbling, resting where it lands (tLand precomputed) */
type Frag = { mesh: THREE.Mesh; x0: number; y0: number; z0: number; dx: number; dz: number; v: number; vy: number; spin: number; axis: THREE.Vector3; tLand: number };

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
  private fgs: { o: THREE.Object3D; a: number; b: number }[] = [];
  private tank: THREE.Group;
  private frags: Frag[] = [];
  private wave: THREE.Group; private wall: THREE.Mesh; private crest: THREE.Mesh; private blobs: THREE.Mesh[] = [];
  private poolMesh: THREE.Mesh; private poolTex: THREE.Texture;
  private train: THREE.Group;
  private breakSeg: THREE.Group;
  private ladder: THREE.Group;
  private puddle: THREE.Mesh;
  private smoke: { m: THREE.Mesh; mat: THREE.MeshLambertMaterial; top: V3; k: number }[] = [];
  private clouds: THREE.Mesh[] = [];
  private frustum = new THREE.Frustum();
  private m4 = new THREE.Matrix4(); private v = new THREE.Vector3(); private sph = new THREE.Sphere();
  private qF = new THREE.Quaternion();

  constructor(kit: Kit) {
    const R = this.root, M: Mats = {};
    // ---- sky + light ----
    // sky: 5 colour stops by elevation (textures.md 5.2 #5 + depth.md 2/6.5), written as tone-map-inverted linear values
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
    /** Test-still A/B only (inputProps `{ post: { shadow: 2048 } }`); default 4096 = picture lock. */
    const shadowSize = (getInputProps() as { post?: { shadow?: number } }).post?.shadow ?? 4096;
    this.sun.shadow.mapSize.set(shadowSize, shadowSize);
    this.fill = new THREE.DirectionalLight("#9fb8ff", 0.35);
    R.add(this.hemi, this.sun, this.sun.target, this.fill, this.fill.target);
    this.cloudMaps = { day: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.day.cloud)), golden: [0, 1, 2, 3].map((k) => cloudHD(k, LOOK.golden.cloud)) };
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3, d = 620 + (i % 3) * 60;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.cloudMaps.day[i % 4], color: new THREE.Color(1.1, 1.1, 1.1), transparent: true, depthWrite: false, fog: false }));
      const w = 130 + (i % 4) * 30;
      m.position.set(Math.cos(a) * d, 120 + (i % 4) * 38, Math.sin(a) * d); m.scale.set(w, w / 2, 1);
      m.layers.set(NOINK);
      this.clouds.push(m); R.add(m);
    }

    // ---- ground, street, railway, sets (static batch) ----
    const b = new Batch();
    M.grass = lam("grassHD", () => ({ map: grassHD() }));
    M.cobble = lam("cobbleHD", () => ({ map: cobbleHD() }));
    M.cope = lam("copeHD", () => ({ map: stoneHD("copeHD") }));
    // iron: a coloured dark (navy, L* 16-22 in shade, never black) with one soft metal highlight (lighting.md 9.3)
    M.iron = twoTone(new THREE.MeshPhongMaterial({ color: "#3d414c", specular: "#8a8a8a", shininess: 60 }), 0.15);
    M.steel = twoTone(new THREE.MeshPhongMaterial({ color: "#7d8088", specular: "#b0b0b0", shininess: 45 }), 0.15); // rails + pipes
    M.wood = lam("wood", () => ({ map: beam() }));
    M.planks = lam("planksHD", () => ({ map: planksHD() }));
    M.plaster = lam("officePlaster", () => ({ color: "#d8cbb2" }));
    M.warm = lam("spoonWall", () => ({ color: "#e8c9a0" }));
    M.trim = lam("officeTrim", () => ({ color: "#efe3c8" }));
    M.darkWood = lam("officeWood", () => ({ color: "#6e4b33" }));
    M.glass = lam("glassPale", () => ({ color: "#d8e8f2" }));
    M.hose = lam("hoseRubber", () => ({ color: "#3a3230" }));
    // ground + Commercial Street (cobbles x -10..10, z -70..+90) + raised sidewalks
    b.add(quadUp(-900, 900, -900, 900, 450, 450, -0.05), M.grass);
    b.add(quadUp(-10, 10, -70, 90, 5, 40, 0.012), M.cobble);
    b.add(boxGeo(V(-13, D0, -70), V(-10, D0 + 0.14, 90), 2), M.cope);
    b.add(boxGeo(V(10, D0, -70), V(13, D0 + 0.14, 90), 2), M.cope);
    // stone foundation ring under the tank
    b.add(new THREE.CylinderGeometry(TANK_R + 0.5, TANK_R + 0.7, 0.4, 48), M.cope, new THREE.Matrix4().makeTranslation(TANK[0], D0 + 0.2, TANK[2]));
    // molasses barrels by the tank base
    for (const [bx, bz] of [[7.5, -24.5], [8.4, -23.6], [-6.5, -24.8], [6.8, -23.2]] as const)
      b.add(new THREE.CylinderGeometry(0.35, 0.35, 0.9, 12), M.wood, new THREE.Matrix4().makeTranslation(bx, D0 + 0.45, bz));
    // ---- elevated railway (x = RAIL_X): trestle posts + girders + deck + rails; the z 24..36 span is a
    // separate mesh (breakSeg) that sags when the wave snaps it
    for (let z = -64; z <= 88; z += 8) {
      for (const s of [-1, 1]) b.add(boxGeo(V(RAIL_X + s * 0.9 - 0.18, D0, z - 0.18), V(RAIL_X + s * 0.9 + 0.18, D0 + 6.2, z + 0.18)), M.iron);
      b.add(boxGeo(V(RAIL_X - 1.15, D0 + 5.9, z - 0.2), V(RAIL_X + 1.15, D0 + 6.3, z + 0.2)), M.iron);
      b.add(beamBetween(V(RAIL_X - 0.9, D0 + 0.2, z), V(RAIL_X + 0.9, D0 + 5.9, z), 0.12), M.iron);
    }
    for (const [z0, z1] of [[-64, 24], [36, 88]] as const) {
      for (const s of [-1, 1]) b.add(boxGeo(V(RAIL_X + s * 0.75 - 0.13, D0 + 6.2, z0), V(RAIL_X + s * 0.75 + 0.13, D0 + 6.5, z1)), M.iron);
      b.add(boxGeo(V(RAIL_X - 1.2, D0 + 6.5, z0), V(RAIL_X + 1.2, D0 + 6.65, z1)), M.iron);
      for (const s of [-1, 1]) b.add(boxGeo(V(RAIL_X + s * 0.7 - 0.06, D0 + 6.65, z0), V(RAIL_X + s * 0.7 + 0.06, D0 + 6.8, z1)), M.steel);
      for (let z = z0 + 0.6; z < z1; z += 1.2) b.add(boxGeo(V(RAIL_X - 1.1, D0 + 6.65, z - 0.15), V(RAIL_X + 1.1, D0 + 6.73, z + 0.15)), M.wood);
    }
    // ---- filler pipe + hose by the tank (shot 5) ----
    b.add(new THREE.CylinderGeometry(0.28, 0.28, 11, 12), M.steel, new THREE.Matrix4().makeTranslation(10.5, D0 + 5.5, -31.2));
    b.add(pipeBetween(V(10.5, D0 + 11, -31.2), V(9.3, D0 + 11, -32.2), 0.26), M.steel);
    b.add(pipeBetween(V(17, D0 + 0.35, -26.5), V(10.5, D0 + 0.35, -31.2), 0.22), M.steel);
    b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8), M.steel, new THREE.Matrix4().makeTranslation(13.5, D0 + 0.55, -28.8));
    const wheel = new THREE.TorusGeometry(0.25, 0.045, 8, 20); wheel.rotateX(Math.PI / 2);
    b.add(wheel, M.iron, new THREE.Matrix4().makeTranslation(13.5, D0 + 0.82, -28.8));
    // ---- office set (shot 13): floor, back wall + cornice, window, desk, chair, cabinet, picture ----
    b.add(quadUp(OFFICE[0] - 6, OFFICE[0] + 6, OFFICE[2] - 5, OFFICE[2] + 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(OFFICE[0] - 6, D0, OFFICE[2] + 4), V(OFFICE[0] + 6, D0 + 5, OFFICE[2] + 4.3), 2), M.plaster);
    b.add(boxGeo(V(OFFICE[0] - 6, D0 + 4.8, OFFICE[2] + 3.9), V(OFFICE[0] + 6, D0 + 5.05, OFFICE[2] + 4.35)), M.trim);
    b.add(boxGeo(V(OFFICE[0] - 3.4, D0 + 1.6, OFFICE[2] + 3.96), V(OFFICE[0] - 1.4, D0 + 3.8, OFFICE[2] + 4.0)), M.glass); // window glass
    for (const [x0, x1, y0, y1] of [[-3.55, -1.25, 3.8, 3.95], [-3.55, -1.25, 1.45, 1.6], [-3.55, -3.4, 1.45, 3.95], [-1.4, -1.25, 1.45, 3.95]] as const)
      b.add(boxGeo(V(OFFICE[0] + x0, D0 + y0, OFFICE[2] + 3.92), V(OFFICE[0] + x1, D0 + y1, OFFICE[2] + 4.02)), M.darkWood);
    b.add(boxGeo(V(OFFICE[0] - 1.5, D0 + 0.95, OFFICE[2] - 0.7), V(OFFICE[0] + 1.5, D0 + 1.05, OFFICE[2] + 0.7)), M.wood); // desk top
    for (const s of [-1, 1]) b.add(boxGeo(V(OFFICE[0] + s * 1.38 - 0.06, D0, OFFICE[2] - 0.6), V(OFFICE[0] + s * 1.38 + 0.06, D0 + 0.95, OFFICE[2] + 0.6)), M.darkWood);
    b.add(boxGeo(V(OFFICE[0] + 0.7, D0 + 0.45, OFFICE[2] - 0.55), V(OFFICE[0] + 1.32, D0 + 0.95, OFFICE[2] + 0.55)), M.darkWood); // drawer block
    b.add(boxGeo(V(OFFICE[0] - 0.25, D0 + 0.48, OFFICE[2] - 1.35), V(OFFICE[0] + 0.25, D0 + 0.54, OFFICE[2] - 0.85)), M.darkWood); // chair seat
    b.add(boxGeo(V(OFFICE[0] - 0.25, D0 + 0.54, OFFICE[2] - 0.91), V(OFFICE[0] + 0.25, D0 + 1.15, OFFICE[2] - 0.85)), M.darkWood); // chair back
    for (const [lx, lz] of [[-0.2, -1.3], [0.2, -1.3], [-0.2, -0.9], [0.2, -0.9]] as const)
      b.add(boxGeo(V(OFFICE[0] + lx - 0.03, D0, OFFICE[2] + lz - 0.03), V(OFFICE[0] + lx + 0.03, D0 + 0.48, OFFICE[2] + lz + 0.03)), M.darkWood);
    b.add(boxGeo(V(OFFICE[0] + 2.6, D0, OFFICE[2] + 3.3), V(OFFICE[0] + 3.6, D0 + 1.3, OFFICE[2] + 3.9)), M.darkWood); // filing cabinet
    b.add(boxGeo(V(OFFICE[0] + 2.4, D0 + 2.5, OFFICE[2] + 3.94), V(OFFICE[0] + 3.6, D0 + 3.3, OFFICE[2] + 3.98)), M.darkWood); // picture frame
    b.add(boxGeo(V(OFFICE[0] + 2.5, D0 + 2.6, OFFICE[2] + 3.92), V(OFFICE[0] + 3.5, D0 + 3.2, OFFICE[2] + 3.96)), M.glass);
    // ---- spoon set (shot 11): floor, warm back wall + cornice, round table, picture ----
    b.add(quadUp(SPOON[0] - 6, SPOON[0] + 6, SPOON[2] - 5, SPOON[2] + 5, 6, 5, 0.02), M.planks);
    b.add(boxGeo(V(SPOON[0] - 6, D0, SPOON[2] + 4), V(SPOON[0] + 6, D0 + 5, SPOON[2] + 4.3), 2), M.warm);
    b.add(boxGeo(V(SPOON[0] - 6, D0 + 4.8, SPOON[2] + 3.9), V(SPOON[0] + 6, D0 + 5.05, SPOON[2] + 4.35)), M.trim);
    b.add(new THREE.CylinderGeometry(1.3, 1.3, 0.09, 28), M.wood, new THREE.Matrix4().makeTranslation(SPOON[0], D0 + 1.0, SPOON[2]));
    b.add(new THREE.CylinderGeometry(0.1, 0.14, 0.95, 10), M.darkWood, new THREE.Matrix4().makeTranslation(SPOON[0], D0 + 0.5, SPOON[2]));
    b.add(new THREE.CylinderGeometry(0.5, 0.55, 0.07, 20), M.darkWood, new THREE.Matrix4().makeTranslation(SPOON[0], D0 + 0.035, SPOON[2]));
    b.add(boxGeo(V(SPOON[0] - 3.1, D0 + 2.5, SPOON[2] + 3.94), V(SPOON[0] - 1.9, D0 + 3.3, SPOON[2] + 3.98)), M.darkWood);
    b.add(boxGeo(V(SPOON[0] - 3.0, D0 + 2.6, SPOON[2] + 3.92), V(SPOON[0] - 2.0, D0 + 3.2, SPOON[2] + 3.96)), M.glass);
    b.build(R);
    buildTown(R, kit, sightLines());

    // hose from the ground pipe to the tank inlet (static sag; Strand is set once, never per frame)
    const hose = new Strand(8, 0.16, 0.16, M.hose, 1);
    const hp = Array.from({ length: 8 }, (_, i) => {
      const u = i / 7;
      return V(10.5 + (7.5 - 10.5) * u, D0 + 0.4 + (0.5 - 0.4) * u - 0.3 * 4 * u * (1 - u), -31.2 + (-28.8 + 31.2) * u);
    });
    hose.set(hp);
    R.add(hose.mesh);

    // ---- the tank: riveted brown steel cylinder + cone roof; shakes with the groan, vanishes at the burst ----
    const tankMat = lam("tankHD", () => ({ map: rep(tankHD(), 8, 2), side: THREE.DoubleSide }));
    const roofMat = lam("tankRoof", () => ({ color: "#5a4632" }));
    this.tank = new THREE.Group();
    const wallGeo = new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 48, 1, true);
    const wallMesh = new THREE.Mesh(wallGeo, tankMat);
    wallMesh.castShadow = true; wallMesh.receiveShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(TANK_R + 0.15, 1.7, 48), roofMat);
    roof.position.y = TANK_H / 2 + 0.85; roof.castShadow = true; roof.receiveShadow = true;
    this.tank.add(wallMesh, roof);
    this.tank.position.set(TANK[0], D0 + TANK_H / 2, TANK[2]);
    R.add(this.tank);
    // burst fragments: 4 curved wall panels + the roof, ballistic from the burst (landings kept on the street)
    const mkFrag = (mesh: THREE.Mesh, x0: number, y0: number, z0: number, dx: number, dz: number, v: number, vy: number, spin: number, rest: number) => {
      const tLand = (vy + Math.sqrt(vy * vy + 4 * 4.9 * Math.max(0, y0 - rest))) / 9.8;
      const axis = new THREE.Vector3(dz, 0, -dx).normalize();
      mesh.castShadow = true; mesh.visible = false;
      R.add(mesh);
      this.frags.push({ mesh, x0, y0, z0, dx, dz, v, vy, spin, axis, tLand });
    };
    const wallFrag = (thMid: number, thLen: number, h: number, y0: number, v: number, vy: number, spin: number) => {
      const g = new THREE.CylinderGeometry(TANK_R, TANK_R, h, 10, 1, true, thMid - thLen / 2, thLen);
      const px = TANK_R * Math.sin(thMid), pz = TANK_R * Math.cos(thMid);
      g.translate(-px, 0, -pz); // arc midpoint at the origin, so the tumble spins around the panel itself
      mkFrag(new THREE.Mesh(g, tankMat), TANK[0] + px, D0 + y0, TANK[2] + pz, Math.sin(thMid), Math.cos(thMid), v, vy, spin, D0 + 0.5);
    };
    wallFrag(0.15, 0.9, 6, 8, 9, 5, 2.2);
    wallFrag(-0.5, 0.8, 5, 6, 4, 6, -1.8);
    wallFrag(0.55, 0.7, 7, 9, 4, 4, 1.5);
    wallFrag(2.6, 0.8, 5, 7, 4, 7, -2.6);
    const roofFrag = new THREE.Mesh(new THREE.ConeGeometry(TANK_R + 0.15, 1.7, 24), roofMat);
    mkFrag(roofFrag, TANK[0], D0 + TANK_H + 0.85, TANK[2], 0.3, 0.95, 2, 9, 1.2, D0 + 0.8);
    // drip puddle at the tank base (the shot-3 close-up), gone once the flood covers it
    const puddleMat = twoTone(new THREE.MeshPhongMaterial({ map: rep(molassesHD(), 1, 1), specular: new THREE.Color("#a8824f"), shininess: 80 }), 0.15);
    const puddleGeo = new THREE.CircleGeometry(1.3, 24); puddleGeo.rotateX(-Math.PI / 2);
    this.puddle = new THREE.Mesh(puddleGeo, puddleMat);
    this.puddle.position.set(5.5, D0 + 0.03, -27.2); this.puddle.receiveShadow = true;
    R.add(this.puddle);

    // ---- the wave: street-wide wall + rolling crest, DoubleSide so a lens inside it still sees brown ----
    const molMat = twoTone(new THREE.MeshPhongMaterial({ map: rep(molassesHD(), 2, 1), specular: new THREE.Color("#a8824f"), shininess: 75, side: THREE.DoubleSide }), 0.15);
    this.wave = new THREE.Group();
    this.wall = new THREE.Mesh(new THREE.BoxGeometry(20, WAVE_H, 3), molMat);
    this.wall.position.set(0, WAVE_H / 2, -1.5); // front face at the group's z = waveZ
    this.wall.castShadow = true; this.wall.receiveShadow = false; // the front face stays cleanly lit: house shadows across it read as a giant dark blob (r2b-1560)
    const crestGeo = new THREE.CylinderGeometry(1.25, 1.25, 20, 12); crestGeo.rotateZ(Math.PI / 2);
    this.crest = new THREE.Mesh(crestGeo, molMat);
    this.crest.position.set(0, WAVE_H, -0.5); this.crest.castShadow = true;
    const blobGeo = new THREE.SphereGeometry(1, 10, 8);
    for (const bx of [-6.5, 0.5, 6.5]) {
      const bl = new THREE.Mesh(blobGeo, molMat);
      bl.scale.set(2.4, 1.3, 1.9); bl.position.set(bx, WAVE_H + 0.2, -0.9); bl.castShadow = true;
      this.blobs.push(bl); this.wave.add(bl);
    }
    this.wave.add(this.wall, this.crest);
    this.wave.position.set(0, D0, TANK_FRONT);
    this.wave.visible = false;
    R.add(this.wave);
    // ---- the flood pool: a flat glossy sheet from the tank to the front, depth 0.8 m x flood ----
    this.poolTex = rep(molassesHD(), 2, 1);
    const poolMat = twoTone(new THREE.MeshPhongMaterial({ map: this.poolTex, specular: new THREE.Color("#a8824f"), shininess: 90, side: THREE.DoubleSide }), 0.15);
    const poolGeo = new THREE.PlaneGeometry(20, 1); poolGeo.rotateX(-Math.PI / 2);
    this.poolMesh = new THREE.Mesh(poolGeo, poolMat);
    this.poolMesh.receiveShadow = true; this.poolMesh.visible = false;
    R.add(this.poolMesh);

    // ---- the train car on the elevated railway (lifted + tilted by poseWorld) ----
    this.train = new THREE.Group();
    const bodyMat = lam("trainBody", () => ({ color: "#6e352a" }));
    const trainRoofMat = lam("trainRoof", () => ({ color: "#4a4442" }));
    const sideMat = lam("trainSide", () => ({ map: trainTex(), side: THREE.DoubleSide }));
    for (const s of [-1, 1]) {
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.55, 2.6), M.iron);
      bogie.position.set(0, 0.28, s * 4); bogie.castShadow = true; this.train.add(bogie);
    }
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.7, 12), bodyMat);
    body.position.y = 1.9; body.castShadow = true; body.receiveShadow = true; this.train.add(body);
    const troof = new THREE.Mesh(new THREE.BoxGeometry(2.85, 0.28, 12.3), trainRoofMat);
    troof.position.y = 3.4; troof.castShadow = true; this.train.add(troof);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(11.8, 2.5), sideMat);
      side.position.set(s * 1.31, 1.9, 0); side.rotation.y = s * Math.PI / 2; this.train.add(side);
    }
    this.train.position.set(RAIL_X, RAIL_TOP, TRAIN_Z);
    R.add(this.train);
    // ---- the breakable girder span (z 24..36): sags when the wave front passes it ----
    this.breakSeg = new THREE.Group();
    const bb = new Batch();
    bb.add(boxGeo(V(RAIL_X - 1.2, D0 + 6.5, 24), V(RAIL_X + 1.2, D0 + 6.65, 36)), M.iron);
    for (const s of [-1, 1]) bb.add(boxGeo(V(RAIL_X + s * 0.75 - 0.13, D0 + 6.2, 24), V(RAIL_X + s * 0.75 + 0.13, D0 + 6.5, 36)), M.iron);
    for (const s of [-1, 1]) bb.add(boxGeo(V(RAIL_X + s * 0.7 - 0.06, D0 + 6.65, 24), V(RAIL_X + s * 0.7 + 0.06, D0 + 6.8, 36)), M.steel);
    for (let z = 24.6; z < 36; z += 1.2) bb.add(boxGeo(V(RAIL_X - 1.1, D0 + 6.65, z - 0.15), V(RAIL_X + 1.1, D0 + 6.73, z + 0.15)), M.wood);
    bb.build(this.breakSeg);
    // pivot at the z = 24 end, deck height: shift the built meshes (world coords) so the group origin sits there
    // (Batch.build freezes the meshes' matrices, so update them by hand after the shift)
    this.breakSeg.children.forEach((c) => { c.position.set(0, -(D0 + 6.2), -24); c.updateMatrix(); });
    this.breakSeg.position.set(0, D0 + 6.2, 24);
    R.add(this.breakSeg);

    // ---- painter's ladder against the tank (shot 4), knocked away by the burst ----
    this.ladder = new THREE.Group();
    const ladMat = M.wood;
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(beamBetween(V(4 + s * 0.35, D0, -25.0), V(4 + s * 0.35, D0 + 7.2, -27.15), 0.09), ladMat);
      rail.castShadow = true; this.ladder.add(rail);
    }
    for (let i = 1; i <= 8; i++) {
      const u = i / 9, rung = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.07, 0.07), ladMat);
      rung.position.set(4, D0 + 7.2 * u, -25.0 - 2.15 * u); rung.castShadow = true; this.ladder.add(rung);
    }
    R.add(this.ladder);

    // ---- office desk props: the blueprint on the desk + a banker's lamp; honey jar on the spoon table ----
    const bp = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.15), lam("blueprint", () => ({ map: blueprintTex() })));
    bp.rotation.set(-Math.PI / 2, 0, Math.PI + 0.08); // +PI: canvas-up must point away from the camera or the text reads upside-down
    bp.position.set(OFFICE[0], D0 + 1.06, OFFICE[2]);
    bp.receiveShadow = true;
    R.add(bp);
    const lamp = new THREE.Group();
    const lampGreen = lam("lampGreen", () => ({ color: "#2f5f43" }));
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.05, 12), M.iron);
    lampBase.position.y = 0.025;
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.35, 8), M.iron);
    lampStem.position.y = 0.22;
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.15, 12, 1, true), lampGreen);
    lampShade.position.y = 0.44;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.8, 1.5, 0.9) }));
    bulb.position.y = 0.39;
    lamp.add(lampBase, lampStem, lampShade, bulb);
    lamp.position.set(OFFICE[0] + 1.2, D0 + 1.05, OFFICE[2] - 0.4);
    R.add(lamp);
    const jarMat = twoTone(new THREE.MeshPhongMaterial({ color: "#c07a1e", specular: new THREE.Color("#ffcc88"), shininess: 90 }), 0.15);
    const jar = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.35, 16), jarMat);
    jar.position.set(SPOON[0] + 0.7, D0 + 1.05 + 0.175, SPOON[2] + 0.5); jar.castShadow = true;
    const jarLid = new THREE.Mesh(new THREE.CylinderGeometry(0.23, 0.23, 0.05, 16), M.darkWood);
    jarLid.position.set(SPOON[0] + 0.7, D0 + 1.05 + 0.375, SPOON[2] + 0.5);
    R.add(jar, jarLid);

    // ---- chimney smoke: three house chimneys spread along the street ----
    const smokeT = smokeTex();
    const tops = chimneyTops().filter((c) => Math.abs(c[0]) > 13).sort((a, b) => a[2] - b[2]);
    const chosen = tops.length ? [0.25, 0.5, 0.75].map((f) => tops[Math.min(tops.length - 1, Math.floor(f * tops.length))]) : [];
    for (const top of [...new Map(chosen.map((c) => [c.join(","), c])).values()])
      for (let k = 0; k < 5; k++) {
        const mat = new THREE.MeshLambertMaterial({ map: smokeT, transparent: true, depthWrite: false });
        const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), mat);
        m.layers.set(NOINK);
        this.smoke.push({ m, mat, top, k: k / 5 }); R.add(m);
      }
    // the CAM agent's near framing objects: built once, never passed through the sight-line filter, toggled per frame
    for (const fg of FOREGROUND) {
      const o = kitClone(kit, fg.kit, fg.s ?? 1);
      if (!o) continue;
      o.position.set(...fg.pos); o.rotation.y = fg.yaw ?? 0; o.visible = false;
      this.fgs.push({ o, a: fg.a, b: fg.b }); R.add(o);
    }
  }

  /** camera-relative sun, frozen per shot: the shot's mean view direction turned by az toward screen right, lifted by el */
  private shotSun(id: number, s: ShotDef, L: LightPreset) {
    let v = this.sunCache.get(id);
    if (v) return v;
    let fx = 0, fz = 0;
    for (let f = s.a; f < s.b; f += 3) {
      const c = camAt(id, f), x = c.look[0] - c.pos[0], z = c.look[2] - c.pos[2], n = Math.hypot(x, z) || 1;
      fx += x / n; fz += z / n;
    }
    const n = Math.hypot(fx, fz) || 1; fx /= n; fz /= n;
    const ss = s as ShotDef & { sunAz?: number; sunEl?: number };
    const az = THREE.MathUtils.degToRad(ss.sunAz ?? SUN_SHOT[id]?.az ?? L.az), el = THREE.MathUtils.degToRad(ss.sunEl ?? SUN_SHOT[id]?.el ?? L.el);
    const hx = fx * Math.cos(az) - fz * Math.sin(az), hz = fz * Math.cos(az) + fx * Math.sin(az); // screen right = (-fz, fx)
    v = new THREE.Vector3(hx * Math.cos(el), Math.sin(el), hz * Math.cos(el)).normalize();
    this.sunCache.set(id, v);
    return v;
  }

  private actor(i: number) { while (this.actors.length <= i) this.actors.push(new Actor(this.root)); return this.actors[i]; }
  private fx(i: number) { while (this.fxs.length <= i) this.fxs.push(new Fx(this.root)); return this.fxs[i]; }

  update(id: number, f: number, cam: THREE.PerspectiveCamera, scene: THREE.Scene) {
    const t = f / FPS, s = SHOTS[id - 1], tau = s.tau(t), b = molState(id, t), L = LIGHTS[s.light];
    // ---- camera ----
    const c = camAt(id, f);
    cam.position.set(...c.pos); cam.up.set(0, 1, 0); cam.lookAt(...c.look); cam.rotateZ(c.roll);
    cam.fov = c.fov; cam.near = 0.2; cam.far = 1500; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
    const focus = V(...c.look), dist = cam.position.distanceTo(focus);
    cam.layers.enable(NOINK); // sky, clouds, smoke and sun sprites live on the no-ink layer but are still rendered
    // ---- light rig (lighting.md 9.4): camera-relative sun frozen per shot, two-tone uniforms, shadow fit ----
    const K = LOOK[s.light], sunDir = this.shotSun(id, s, L);
    this.hemi.color.set(L.sky); this.hemi.groundColor.set(L.ground); this.hemi.intensity = L.hemiI;
    this.sun.color.set(L.sunCol); this.sun.intensity = L.sunI;
    let Rr = THREE.MathUtils.clamp(dist * 1.15 + 7, 12, 95);
    if (s.light === "golden") Rr = Math.max(Rr, 30); // el 7: 2 m cards throw ~16 m shadows, houses much longer
    this.sun.position.copy(focus).addScaledVector(sunDir, 220); this.sun.target.position.copy(focus);
    const sc = this.sun.shadow.camera;
    sc.left = -Rr; sc.right = Rr; sc.top = Rr; sc.bottom = -Rr; sc.near = 20; sc.far = 480; sc.updateProjectionMatrix();
    this.sun.shadow.bias = L.bias; this.sun.shadow.normalBias = L.normalBias * (Rr / 12);
    this.fill.intensity = 0; // not used by the two-tone shading
    TONE.uLitCol.value.set(...L.lit); TONE.uShadeCol.value.set(...L.shade); TONE.uShadeLift.value.set(...L.lift);
    TONE.uLambert.value = L.lambert; TONE.uSideK.value = L.sideK; TONE.uTerm.value = L.term; TONE.uBounce.value.set(...LOOK[s.light].bounce); TONE.uSat.value = LOOK[s.light].sat;
    CHAR.uCharTint.value.set(...L.charTint); CHAR.uCharShade.value = L.charShade; CHAR.uGrad.value = L.charGrad;
    CHAR.uBodyGrad.value = L.bodyGrad; CHAR.uSideTint.value.set(...L.sideTint);
    // ---- sky, fog (colour = horizon colour, linear fogNear -> fogFar), sun disc + halo, clouds ----
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
    // ---- foreground framing objects: inside their frames AND their own shot (so a crossfade layer never shows them) ----
    for (const g of this.fgs) g.o.visible = f >= g.a && f < g.b && g.a < s.b && g.b > s.a;
    // ---- the molasses world: tank, wave, flood, train ----
    this.poseWorld(b, t, tau, id);
    for (const sm of this.smoke) {
      const u = (t * 0.11 + sm.k) % 1, sz = 3 + u * 9;
      sm.m.position.set(sm.top[0] - u * 18, sm.top[1] + u * 13 + u * u * 4, sm.top[2] + u * 3);
      sm.m.scale.set(sz, sz, 1); sm.m.quaternion.copy(cam.quaternion);
      sm.mat.opacity = 0.85 * (1 - u) ** 1.2;
    }
    // ---- cast + effects ----
    const right = V(0, 0, 0).setFromMatrixColumn(cam.matrixWorld, 0);
    const st = stage(id, t, b, { pos: cam.position, right });
    if (id === 6) { // the burst: the tank wall blows out, the wave is born
      snapFx(tau, [TANK[0], D0 + 7, TANK_FRONT], st);
      splashFx(tau, st);
    }
    if (id === 7) splashFx(tau, st); // the wave hits the railway and rushes on
    if (id === 5 && tau >= 20 && tau < BURST) creakFx(t, CREAK_PTS, st, 0.9); // the tank groans while it fills
    this.frustum.setFromProjectionMatrix(this.m4.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
    const tint = s.light === "golden" ? "#ffcf9e" : "#ffffff";
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
      if (a.mat.emissiveMap) a.mat.emissive.set(tint); // legacy emissive card until the CHAR agent's cardShade lands
      a.mesh.castShadow = L.actorShadow; // day: soft contact blobs instead (CHAR agent)
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

  /** per-frame molasses physics: tank shake + burst fragments, wave wall + crest, flood pool, train lift, broken girder */
  private poseWorld(b: MolState, t: number, tau: number, id: number) {
    const clean = id === 14; // decades later: clean street, no wave, no pool, no debris
    // tank: groan shake while it fills, then gone the instant the wall bursts
    this.tank.visible = b.burst === 0;
    if (this.tank.visible) {
      this.tank.position.x = TANK[0] + b.shake * Math.sin(t * 23.0);
      this.tank.position.z = TANK[2] + b.shake * Math.cos(t * 19.0);
      this.tank.rotation.y = b.shake * 0.01 * Math.sin(t * 17.0);
    }
    // fragments: ballistic from the burst, tumbling, resting where they land
    const dt = Math.max(0, tau - BURST);
    for (const fr of this.frags) {
      fr.mesh.visible = b.burst > 0 && !clean;
      if (!fr.mesh.visible) continue;
      const u = Math.min(dt, fr.tLand);
      fr.mesh.position.set(fr.x0 + fr.dx * fr.v * u, fr.y0 + fr.vy * u - 4.9 * u * u, fr.z0 + fr.dz * fr.v * u);
      this.qF.setFromAxisAngle(fr.axis, fr.spin * u);
      fr.mesh.quaternion.copy(this.qF);
    }
    // wave: front wall + rolling crest follow waveZ, slumping as the front stops (waveZ 59.3 -> 75)
    const hF = 1 - 0.35 * smooth((b.waveZ - 59.3) / 15.7);
    this.wave.visible = b.burst > 0 && !clean;
    if (this.wave.visible) {
      this.wave.position.z = b.waveZ;
      this.wall.scale.y = hF; this.wall.position.y = (WAVE_H / 2) * hF;
      this.crest.position.y = WAVE_H * hF;
      for (const bl of this.blobs) bl.position.y = WAVE_H * hF + 0.2;
    }
    // pool: flat glossy sheet from the tank to the front, depth 0.8 m x flood
    const len = Math.max(0.1, b.waveZ - TANK_FRONT);
    this.poolMesh.visible = b.flood > 0.01 && !clean;
    if (this.poolMesh.visible) {
      this.poolMesh.position.set(0, D0 + 0.8 * b.flood, TANK_FRONT + len / 2);
      this.poolMesh.scale.set(1, 1, len);
      this.poolTex.repeat.set(2, Math.max(1, len / 8));
    }
    // train: lifted off the rails as the front passes, then dropped back askew (tilt follows b.train)
    const yLift = tau < 30.62 ? 0 : tau < 33.4 ? TRAIN_LIFT * smooth((tau - 30.62) / 2.78) : TRAIN_LIFT * (1 - smooth((tau - 33.4) / 2.6));
    this.train.position.y = RAIL_TOP + yLift;
    this.train.rotation.z = 0.18 * b.train;
    this.train.rotation.x = 0.03 * b.train;
    // the girder span sags once the front passes it (repaired by shot 14)
    const sag = clean ? 0 : smooth((b.waveZ - 24) / 12);
    this.breakSeg.rotation.x = sag * 0.1;
    this.breakSeg.position.y = D0 + 6.2 - sag * 0.15;
    // ladder + drip puddle: only while the tank stands
    this.ladder.visible = b.burst < 0.3;
    this.puddle.visible = b.burst === 0;
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
