/* =============================================================================
 * USD Viewer — lighting config
 * -----------------------------------------------------------------------------
 * Edit the values below to change how the embedded OpenUSD scene is lit, then
 * refresh the page. Nothing else needs to change.
 *
 * The scene is lit in three layers, all optional and combined:
 *   1. environment  — an HDR image that provides soft, realistic "image-based"
 *                     lighting and reflections (the main look).
 *   2. exposure / toneMapping — the overall brightness dial and film response.
 *   3. ambient + keyLight — extra direct lights layered on top for fill/contrast.
 *
 * Tip: if the model looks too dark or too bright, adjust `exposure` first.
 * ========================================================================== */

window.USD_VIEWER_LIGHTING = {

  // --- Image-based lighting (the HDR environment) --------------------------
  // Options:
  //   "neutral"     soft, even studio lighting (default, bundled)
  //   "room"        three.js RoomEnvironment — brighter, showroom-like
  //   "helicopter"  outdoor landing-pad HDR (bundled)
  //   "none"        no environment lighting (rely on ambient/keyLight below)
  //   "environments/my.hdr"  or a full URL to your own .hdr / .exr / .ktx2
  environment: "neutral",

  // --- Overall brightness --------------------------------------------------
  // 1.0 = default. Lower = darker, higher = brighter.
  // Useful range: ~0.5 (dim) to ~3.0 (bright).
  exposure: 0.9,

  // --- Film response / tone mapping ---------------------------------------
  //   "agx"      filmic, gentle highlight roll-off (default)
  //   "neutral"  Khronos PBR Neutral — preserves material colors
  //   "none"     linear, no tone mapping (can look harsh/blown out)
  toneMapping: "agx",

  // --- Background ----------------------------------------------------------
  // null            transparent — the page background shows through (default)
  // "#0b1320"       any hex color drawn behind the model
  // "environment"   show the HDR environment image itself as the backdrop
  background: "#0b1320",

  // --- Authored USD lights -------------------------------------------------
  // USD Lux intensities are much stronger than their three.js counterparts.
  authoredLightIntensityScale: 0.0018,

  // --- Bundled episode ground presentation --------------------------------
  // Applied only when the named mesh exists, so arbitrary USD files are left
  // at their authored scale and materials.
  ground: {
    enabled: true,
    name: "Mesh_ground_id0_geom",
    size: 2.0,
    color: "#344154",
    metalness: 0,
    roughness: 0.92,
    envMapIntensity: 0.55,
  },

  // --- Ambient fill light --------------------------------------------------
  // A uniform light that lifts shadows from every direction.
  ambient: {
    enabled: false,
    color: "#ffffff",
    intensity: 0.4,
  },

  // --- Hemisphere fill light ----------------------------------------------
  fillLight: {
    enabled: true,
    skyColor: "#d7e7ff",
    groundColor: "#101827",
    intensity: 0.35,
  },

  // --- Key (directional) light ---------------------------------------------
  // A single sun-like light. `direction` is the vector the light travels
  // toward the scene origin, in scene units (x right, y up, z toward camera).
  keyLight: {
    enabled: true,
    color: "#fff0dc",
    intensity: 2.6,
    direction: [3, 5, 4],
    castShadow: true,
  },

  // --- Soft contact shadows ------------------------------------------------
  shadow: {
    mapSize: 1024,
    mobileMapSize: 512,
    cameraSize: 1.25,
    near: 0.1,
    far: 12,
    bias: -0.00035,
    normalBias: 0.012,
    radius: 4,
  },
};
