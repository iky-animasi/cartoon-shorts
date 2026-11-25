// usage: BRIDGE_GL=vulkan BRIDGE_CHROME_MODE=chrome-for-testing node scripts/bridge-stills-gpu.mjs <outPrefix> <frame,frame,...> [scale]
// Varian GPU dari bridge-stills.mjs untuk tes Colab v2.
// Bedanya dengan bridge-stills.mjs (dipakai tes v1):
//   - GL renderer bisa dipilih lewat BRIDGE_GL (vulkan | angle-egl | angle ...)
//   - Chrome mode bisa dipilih lewat BRIDGE_CHROME_MODE (chrome-for-testing | headless-shell)
// Tes v1 memakai gl:"angle" + chromeMode default (headless-shell), yang menurut
// docs Remotion tidak bisa memakai driver GPU di Linux — jadi hasil SwiftShader
// di v1 belum membuktikan Colab tidak bisa memakai T4.
// Remotion 4.0.290 terpasang: GL valid = swangle, angle, egl, swiftshader, vulkan,
// angle-egl; chromeMode valid = headless-shell, chrome-for-testing.
import fs from "node:fs";
if (process.env.REMOTION_TMP) { fs.mkdirSync(process.env.REMOTION_TMP, { recursive: true }); process.env.TEMP = process.env.TMP = process.env.REMOTION_TMP; }
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import path from "node:path";
const [prefix, frames, scale = "0.5"] = process.argv.slice(2);
const compositionId = process.env.BRIDGE_COMP || "MolassesShort";
const gl = process.env.BRIDGE_GL || "vulkan";
const chromeMode = process.env.BRIDGE_CHROME_MODE || "chrome-for-testing";
const chromiumOptions = { gl };
console.log(`bridge-stills-gpu: gl=${gl} chromeMode=${chromeMode} frames=${frames} scale=${scale}`);
const serveUrl = await bundle({ entryPoint: path.resolve(process.env.BRIDGE_ENTRY || "src/index.ts"), publicDir: path.resolve("public") });
const composition = await selectComposition({ serveUrl, id: compositionId, chromiumOptions, chromeMode });
const onBrowserLog = (l) => { if (l.type === "error" || l.type === "warning") console.log(`[${l.type}]`, l.text.slice(0, 300)); };
for (const f of frames.split(",").map(Number)) {
  const t0 = Date.now();
  await renderStill({ composition, serveUrl, frame: f, output: `${prefix}${f}.jpg`, imageFormat: "jpeg", jpegQuality: 88, scale: Number(scale),
    chromiumOptions, chromeMode, timeoutInMilliseconds: 180000, onBrowserLog });
  console.log("still", f, ((Date.now() - t0) / 1000).toFixed(1) + "s");
}
