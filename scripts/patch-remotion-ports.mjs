// Re-applies the Remotion port-probe fix after `npm install` / `npm ci`.
// Run: node scripts/patch-remotion-ports.mjs
//
// WHY: on this VM the network layer accepts TCP connects to the wildcard
// addresses '::' and '0.0.0.0' even when nothing listens there, so Remotion's
// port probe (which connects to each candidate port on every host in
// getHostsToTry) concludes every port 3000-3100 is in use and every render
// fails with "Error: No available ports found". Probing loopback only
// ('::1', '127.0.0.1') is sufficient: serveStatic retries on EADDRINUSE if
// the chosen port turns out to be taken on another interface.
// Patches both the CJS build (used by the `remotion` CLI) and the ESM bundle
// (used by .mjs scripts such as scripts/bridge-stills.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const NOTE = "    // PATCHED (VM quirk): wildcard hosts '::'/'0.0.0.0' removed from probe; see scripts/patch-remotion-ports.mjs\n";

const targets = [
  {
    file: "node_modules/@remotion/renderer/dist/port-config.js",
    from: "        (0, exports.isIpV6Supported)(flattened) ? '::' : null,\n        '0.0.0.0',\n",
    to: NOTE,
  },
  {
    file: "node_modules/@remotion/renderer/dist/esm/index.mjs",
    from: '    isIpV6Supported(flattened) ? "::" : null,\n    "0.0.0.0"\n',
    to: NOTE,
  },
];

let changed = 0;
for (const t of targets) {
  const p = path.join(root, t.file);
  if (!fs.existsSync(p)) {
    console.log(`SKIP (missing): ${t.file}`);
    continue;
  }
  const src = fs.readFileSync(p, "utf8");
  if (src.includes("PATCHED (VM quirk)")) {
    console.log(`already patched: ${t.file}`);
    continue;
  }
  if (!src.includes(t.from)) {
    console.log(`WARNING: pattern not found in ${t.file} — Remotion version may have changed; check getHostsToTry manually.`);
    continue;
  }
  fs.writeFileSync(p, src.replace(t.from, t.to));
  console.log(`patched: ${t.file}`);
  changed++;
}
console.log(changed ? `Done (${changed} file(s) patched).` : "Done (nothing to patch).");
