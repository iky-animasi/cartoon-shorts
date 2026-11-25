// usage: REMOTION_TMP=.../cartoon-shorts/.remotion-tmp node scripts/shadow-msaa-test.mjs <frame> <scale> <variant>
// variant: base-lensoff | shadow2048 | msaa0 — renders ONE still with lens/DOF off (the ~54h candidate)
// plus one base-cost lever changed, times it, writes to molasses/stills-test/<variant>-<frame>.jpg
// (never touches molasses/stills/ or picture-lock files). Defaults (shadow 4096, MSAA 4) = picture lock.
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
const [frameArg, scaleArg = "0.5", variant = "base-lensoff"] = process.argv.slice(2);
const frame = Number(frameArg);
const variants = {
  "base-lensoff": { lens: false, pre: false },
  shadow2048: { lens: false, pre: false, shadow: 2048 },
  msaa0: { lens: false, pre: false, msaa: 0 },
  combo: { lens: false, pre: false, shadow: 2048, msaa: 0 },
};
const post = variants[variant];
if (!post) { console.error("unknown variant", variant); process.exit(1); }
const outDir = path.resolve("molasses/stills-test");
fs.mkdirSync(outDir, { recursive: true });
const tBundle0 = Date.now();
const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts"), publicDir: path.resolve("public") });
console.log("bundle", ((Date.now() - tBundle0) / 1000).toFixed(1) + "s");
const composition = await selectComposition({ serveUrl, id: "MolassesShort", chromiumOptions: { gl: "angle" } });
const t0 = Date.now();
await renderStill({ composition, serveUrl, frame, output: `${outDir}/${variant}-${frame}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scaleArg),
  inputProps: { post }, chromiumOptions: { gl: "angle" }, timeoutInMilliseconds: 1800000,
  onBrowserLog: (l) => { if (l.type === "error") console.log("[error]", l.text.slice(0, 300)); } });
console.log("RESULT variant", variant, "frame", frame, "scale", scaleArg, "post", JSON.stringify(post), "stillSeconds", ((Date.now() - t0) / 1000).toFixed(1));
