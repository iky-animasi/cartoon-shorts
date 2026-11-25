/**
 * Note: When using the Node.JS APIs, the config file
 * doesn't apply. Instead, pass options directly to the APIs.
 *
 * All configuration options: https://remotion.dev/docs/config
 */

import { Config } from "@remotion/cli/config";

// NOTE: no Config.setRspack here — it does not exist in Remotion 4.0.290
// (the scaffold template was written for 4.0.545). Webpack bundling is used.
Config.setChromiumOpenGlRenderer("angle");
Config.setVideoImageFormat("jpeg");
