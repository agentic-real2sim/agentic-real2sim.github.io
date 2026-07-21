import MaterialX from "../bin/JsMaterialXGenShader.js";
import { debug, waitForNetworkIdle } from "./utils.js";
import { renderPMREMToEquirect, renderPMREMToPrefilteredEquirect } from "./utils.texture.js";
import { CubeUVReflectionMapping, Light, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, PMREMGenerator, Scene, Texture } from "three";
import { registerLights, getLightData } from "./materialx.helper.js";
import { whiteTexture } from "./utils.texture.js";
import { VERSION } from "./constants.js";

/**
 * Accept Texture instances from any Three.js copy. Tooling like the fidelity
 * renderer can host scenes with a different Three.js module instance than this
 * package, so `instanceof Texture` is too strict here.
 * @param {unknown} value
 * @returns {value is Texture}
 */
function isTextureLike(value) {
    return !!value && typeof value === "object" && /** @type {{ isTexture?: unknown }} */(value).isTexture === true;
}

function isNodeRuntime() {
    return !!globalThis.process?.versions?.node && globalThis.process?.type !== "renderer";
}

async function getNodePackageAssetPaths() {
    const nodeUrlModule = "node:url";
    const { fileURLToPath } = await import(/* @vite-ignore */ nodeUrlModule);
    const binDirectory = ["..", "bin"].join("/") + "/";
    return [
        "JsMaterialXCore.wasm",
        "JsMaterialXGenShader.wasm",
        "JsMaterialXGenShader.data.txt",
    ].map(fileName => fileURLToPath(new URL(binDirectory + fileName, import.meta.url)));
}


/**
 * Preloads the MaterialX WebAssembly module.
 * @type {import("./materialx.js").preloadWasm}
 */
export async function preloadWasm(trigger) {
    if (trigger === "immediately") {
        // Load the WASM module immediately
        return ready();
    } else if (trigger === "network_idle") {
        // Wait for network to be idle before loading
        return waitForNetworkIdle().then(ready);
    }
}



export const state = new class {
    /** @type {import("./materialx.types.js").MaterialX.MODULE | null} */
    materialXModule = null;
    /** @type {any} */
    materialXGenerator = null;
    /** @type {any} */
    materialXGenContext = null;
    /** @type {any} */
    materialXStdLib = null;
    /** @type {Promise<void> | null} */
    materialXInitPromise = null;
}

/** 
 * Wait for the MaterialX WASM module to be ready.
 * @returns {Promise<void>}
 */
export async function ready() {
    if (state.materialXInitPromise) {
        return state.materialXInitPromise;
    }
    return state.materialXInitPromise = (async () => {
        if (state.materialXModule) return; // Already initialized
        if (debug) console.log(`[MaterialX v${VERSION}] Initializing WASM module...`);
        try {

            // NOTE: This must be a plain string literal (not a template) so that the
            // makeFilesLocal Vite plugin can statically detect and localize this URL.
            const defaultBaseUrl = "https://cdn.needle.tools/static/materialx/1.7.0/";

            /** @type {Array<string>} */
            let urls;

            const location = globalThis.NEEDLE_MATERIALX_LOCATION;

            if (isNodeRuntime()) {
                urls = await getNodePackageAssetPaths();
            }
            else if (location === "package" || location === "bin/" || location === "./bin/" || location === "../bin/") {
                // Use local files from the @needle-tools/materialx npm package.
                // Vite's ?url suffix copies these files to the output directory
                // and returns their URL automatically — no CDN download needed.
                urls = /** @type {string[]} */ (await Promise.all([
                    import('../bin/JsMaterialXCore.wasm?url').then(m => m.default || m),
                    import('../bin/JsMaterialXGenShader.wasm?url').then(m => m.default || m),
                    import('../bin/JsMaterialXGenShader.data.txt?url').then(m => m.default || m),
                ]));
            }
            else if (location) {
                // Custom path: use as base URL for CDN or self-hosted files
                urls = [
                    location + "JsMaterialXCore.wasm",
                    location + "JsMaterialXGenShader.wasm",
                    location + "JsMaterialXGenShader.data.txt",
                ];
            }
            else {
                // Default: fetch from CDN (or from local files if makeFilesLocal rewrites this URL)
                urls = [
                    defaultBaseUrl + "JsMaterialXCore.wasm",
                    defaultBaseUrl + "JsMaterialXGenShader.wasm",
                    defaultBaseUrl + "JsMaterialXGenShader.data.txt",
                ];
            }
            const [JsMaterialXCore, JsMaterialXGenShader, JsMaterialXGenShader_data] = urls;

            const module = await MaterialX({
                locateFile: (/** @type {string} */ path, /** @type {string} */ scriptDirectory) => {
                    if (debug) console.debug("[MaterialX]  locateFile called:", { path, scriptDirectory });

                    if (path.includes("JsMaterialXCore.wasm")) {
                        return JsMaterialXCore; // Use the URL for the core WASM file
                    }
                    else if (path.includes("JsMaterialXGenShader.wasm")) {
                        return JsMaterialXGenShader; // Use the URL for the shader WASM file
                    }
                    else if (path.includes("JsMaterialXGenShader.data")) {
                        return JsMaterialXGenShader_data; // Use the URL for the shader data file
                    }

                    return scriptDirectory + path;
                },
            });
            if (debug) console.log("[MaterialX] module loaded", module);
            state.materialXModule = /** @type {import("./materialx.types.js").MaterialX.MODULE} */ (module);

            // Initialize shader generator and context
            state.materialXGenerator = module.EsslShaderGenerator.create();
            state.materialXGenContext = new module.GenContext(state.materialXGenerator);

            // Load standard libraries
            const tempDoc = module.createDocument();
            state.materialXStdLib = module.loadStandardLibraries(state.materialXGenContext);
            tempDoc.setDataLibrary(state.materialXStdLib);

            // TODO ShaderInterfaceType.SHADER_INTERFACE_REDUCED would be better, but doesn't actually seem to be supported in the MaterialX javascript bindings
            state.materialXGenContext.getOptions().shaderInterfaceType = state.materialXModule.ShaderInterfaceType.SHADER_INTERFACE_COMPLETE;

            // SPECULAR_ENVIRONMENT_NONE: Do not use specular environment maps.
            // SPECULAR_ENVIRONMENT_FIS: Use Filtered Importance Sampling for specular environment/indirect lighting.
            // SPECULAR_ENVIRONMENT_PREFILTER: Use pre-filtered environment maps for specular environment/indirect lighting.
            state.materialXGenContext.getOptions().hwSpecularEnvironmentMethod = state.materialXModule.HwSpecularEnvironmentMethod.SPECULAR_ENVIRONMENT_PREFILTER;

            // TRANSMISSION_REFRACTION: Use a refraction approximation for transmission rendering.
            // TRANSMISSION_OPACITY: Use opacity for transmission rendering.
            // state.materialXGenContext.getOptions().hwTransmissionRenderMethod = state.materialXModule.HwTransmissionRenderMethod.TRANSMISSION_REFRACTION;

            // Turned off because we're doing color space conversion the three.js way
            state.materialXGenContext.getOptions().hwSrgbEncodeOutput = false;

            // NOTE: Emscripten's getOptions() returns a temporary wrapper — property
            // writes don't persist across separate getOptions() calls. Per-generate
            // options (hwTexcoordVerticalFlip, fileTextureVerticalFlip, hwTransparency)
            // are set in loader.three.js right before generate().

            // Enables the generation of a prefiltered environment map.
            // TODO Would be great to use but requires setting more uniforms (like u_envPrefilterMip).
            // When set to true, the u_envRadiance map is expected to be a prefiltered environment map.
            // state.materialXGenContext.getOptions().hwWriteEnvPrefilter = true;

            // Set a reasonable default for max active lights
            state.materialXGenContext.getOptions().hwMaxActiveLightSources = 4;

            // We use Three.js shadow maps instead of MaterialX's own shadow implementation
            // state.materialXGenContext.getOptions().hwShadowMap = true;

            // This prewarms the shader generation context to have all light types
            await registerLights(state.materialXModule, state.materialXGenContext);

            if (debug) console.log(`[MaterialX v${VERSION}] Generator initialized successfully`);
        } catch (error) {
            console.error(`[MaterialX v${VERSION}] Failed to load MaterialX module:`, error);
            throw error;
        }
    })();
}

/**
 * @typedef {Object} EnvironmentTextureSet
 * @property {Texture | null} radianceTexture
 * @property {Texture | null} irradianceTexture
 * @property {() => void} [dispose]
 */

/**
 * MaterialXEnvironment manages the environment settings for MaterialX materials. 
 */
// @dont-generate-component
export class MaterialXEnvironment {

    /**
     * @param {Scene} scene
     * @returns {MaterialXEnvironment | null}
     */
    static get(scene) {
        return this.getEnvironment(scene);
    }

    /** @type {WeakMap<Scene, MaterialXEnvironment>} */
    static _environments = new WeakMap();

    /**
     * @param {Scene} scene
     * @returns {MaterialXEnvironment}
     */
    static getEnvironment(scene) {
        if (this._environments.has(scene)) {
            return /** @type {MaterialXEnvironment} */ (this._environments.get(scene));
        }
        const env = new MaterialXEnvironment(scene);
        this._environments.set(scene, env);
        return env;
    }

    /** @type {Array<Light>} */
    _lights = [];
    /** @type {import("./materialx.helper.js").LightData[] | null} */
    _lightData = null;
    /** @type {number} */
    _lightCount = 0;

    /** @type {Promise<boolean> | null} */
    _initializePromise = null;
    /** @type {boolean} */
    _isInitialized = false;
    /** @type {number} */
    _lastUpdateFrame = -1;

    /**
     * @param {Scene} _scene
     */
    constructor(_scene) {
        this._scene = _scene;
        if (debug) console.log("[MaterialX] Environment created");
    }

    /**
     * Initialize with Needle Engine context
     * @param {import("three").WebGLRenderer} renderer
     * @returns {Promise<boolean>}
     */
    async initialize(renderer) {
        if (this._initializePromise) {
            return this._initializePromise;
        }
        this._initializePromise = this._initialize(renderer);
        return this._initializePromise;
    }

    /**
     * @param {number} frame
     * @param {Scene} scene
     * @param {import("three").WebGLRenderer} renderer
     */
    update(frame, scene, renderer) {
        if (!this._initializePromise) {
            this.initialize(renderer);
            return;
        }
        if (!this._isInitialized) {
            return;
        }
        if (this._lastUpdateFrame === frame) {
            // Already updated this frame
            return;
        }
        this._lastUpdateFrame = frame;
        this.updateLighting(false);

        if (debug && !this["_debug"]) {
            const textures = this._getTextures(scene.environment);
            this["_debug"] = true;
            // Show both of them on cubes in the scene
            const unlitMat = new MeshBasicMaterial();
            unlitMat.side = 2;
            const radianceMat = unlitMat.clone();
            radianceMat.map = textures.radianceTexture;
            const planeGeometry = new PlaneGeometry(1, 1, 1, 1)
            const radianceCube = new Mesh(planeGeometry, radianceMat);
            const irradianceMat = unlitMat.clone();
            irradianceMat.map = textures.irradianceTexture;
            const irradianceCube = new Mesh(planeGeometry, irradianceMat);
            scene.add(radianceCube);
            scene.add(irradianceCube);
            radianceCube.name = "MaterialXRadianceCube";
            radianceCube.position.set(.8, 1, .01);
            radianceCube.scale.set(1.5, 1, 1);
            irradianceCube.name = "MaterialXIrradianceCube";
            irradianceCube.position.set(-.8, 1, -.01);
            irradianceCube.scale.set(1.5, 0.98, 1);
            console.log("[MaterialX] environment initialized from Needle context", { textures, radianceCube, irradianceCube });
        }
    }

    // Reset the environment to allow re-initialization
    reset() {
        if (debug) console.log("[MaterialX] Resetting environment");
        this._initializePromise = null;
        this._isInitialized = false;
        this._lastUpdateFrame = -1;
        this._lights = [];
        this._lightData = null;
        this._lightCount = 0;
        this._pmremGenerator?.dispose();
        this._pmremGenerator = null;
        this._renderer = null;
        for (const textureModeMap of this._texturesCache.values()) {
            for (const textureSet of textureModeMap.values()) {
                textureSet.dispose?.();
            }
        }
        this._texturesCache.clear();
    }

    get lights() {
        return this._lights;
    }
    get lightData() {
        return this._lightData;
    }
    get lightCount() { return this._lightCount || 0; }

    /**
     * @param {import("./materialx.material.js").MaterialXMaterial} material
     */
    getTextures(material) {
        const radianceMode = material.environmentRadianceMode ?? "three-pmrem";
        if (material.envMap) {
            // If the material has its own envMap, we don't use the irradiance texture
            return this._getTextures(material.envMap, radianceMode);
        }

        // Use the scene background for lighting if no environment is available
        // If we don't do this we don't see the correct lighting for scenes exported with 'Environment Lighting: Color' and 'Environment Reflections: Skybox'  
        const skybox = this._scene.environment || this._scene.background;
        if (isTextureLike(skybox)) {
            return this._getTextures(skybox, radianceMode);
        }
        return this._getTextures(null, radianceMode);
    }

    /** @type {PMREMGenerator | null} */
    _pmremGenerator = null;
    /** @type {import("three").WebGLRenderer | null} */
    _renderer = null;
    /** @type {Map<Texture | null, Map<string, EnvironmentTextureSet>>} */
    _texturesCache = new Map();

    /**
     * @param {import("three").WebGLRenderer} renderer
     * @returns {Promise<boolean>}
     */
    async _initialize(renderer) {
        this._isInitialized = false;
        this._renderer = renderer;
        this.updateLighting(true);
        this._isInitialized = true;
        return true;
    }

    /**
     * @param {Texture | null | undefined} texture
     * @param {"three-pmrem" | "materialx-prefiltered" | "materialx-fis"} [radianceMode]
     * @returns {EnvironmentTextureSet}
     */
    _getTextures(texture, radianceMode = "three-pmrem") {

        // Fallback to white texture if no texture is provided
        if (!texture) {
            texture = whiteTexture;
        }

        const cacheKey = texture || null;
        let textureModeMap = this._texturesCache.get(cacheKey);
        if (!textureModeMap) {
            textureModeMap = new Map();
            this._texturesCache.set(cacheKey, textureModeMap);
        }

        /** @type {EnvironmentTextureSet | undefined} */
        let res = textureModeMap.get(radianceMode);
        if (res) {
            return res;
        }

        const isPmremTexture = texture.mapping === CubeUVReflectionMapping || texture.isRenderTargetTexture === true;

        if (this._scene && this._renderer && texture) {
            if (debug) console.log("[MaterialX] Generating environment textures", texture.name);
            let radianceRenderTarget;
            let irradianceRenderTarget;

            if (isPmremTexture) {
                // Scene.environment is often already PMREM-processed (CubeUV layout).
                // Running PMREMGenerator on it again corrupts the sampling layout.
                radianceRenderTarget = radianceMode === "materialx-prefiltered"
                    ? renderPMREMToPrefilteredEquirect(this._renderer, texture)
                    : radianceMode === "materialx-fis"
                        ? renderPMREMToEquirect(this._renderer, texture, 0.0, 1024, 512)
                        : null;
                irradianceRenderTarget = renderPMREMToEquirect(this._renderer, texture, 1.0, 32, 16);
            } else {
                const target = this._getPMREMGenerator().fromEquirectangular(texture);
                radianceRenderTarget = radianceMode === "materialx-prefiltered"
                    ? renderPMREMToPrefilteredEquirect(this._renderer, target.texture, undefined, undefined, target.height)
                    : radianceMode === "three-pmrem"
                        ? target
                        : null;
                irradianceRenderTarget = renderPMREMToEquirect(this._renderer, target.texture, 1.0, 32, 16, target.height);
                if (radianceMode !== "three-pmrem") {
                    target.dispose();
                }
            }

            res = {
                radianceTexture: radianceRenderTarget?.texture ?? texture,
                irradianceTexture: irradianceRenderTarget.texture,
                dispose: () => {
                    radianceRenderTarget?.dispose();
                    irradianceRenderTarget?.dispose();
                },
            }
        }
        else {
            res = {
                radianceTexture: null,
                irradianceTexture: null
            }
        }
        textureModeMap.set(radianceMode, res);
        return res;
    }

    /**
     * @returns {PMREMGenerator}
     */
    _getPMREMGenerator() {
        if (!this._renderer) {
            throw new Error("[MaterialX] Cannot create PMREMGenerator before renderer initialization.");
        }
        this._pmremGenerator ??= new PMREMGenerator(this._renderer);
        return this._pmremGenerator;
    }

    /**
     * @param {boolean} collectLights
     */
    updateLighting = (collectLights = false) => {
        if (!this._scene) return;
        // Find lights in scene
        if (collectLights) {
            /** @type {Array<Light>} */
            const lights = new Array();
            this._scene.traverse((/** @type {Object3D} */ object) => {
                if ((/** @type {Light} */ (object)).isLight && object.visible)
                    lights.push(/** @type {Light} */(object));
            });
            // Keep the same ordering strategy as Three.js (shadow casters first)
            // and do this only when re-collecting lights to avoid per-frame sort allocations.
            lights.sort((a, b) => (b.castShadow ? 1 : 0) - (a.castShadow ? 1 : 0));
            this._lights = lights;
        }

        if (state.materialXGenContext) {
            const { lightData, lightCount } = getLightData(this._lights, state.materialXGenContext);
            this._lightData = lightData;
            this._lightCount = lightCount;
            // Note: Shadow data is now handled by Three.js when lights: true is set on the material
        }
    }

    /**
     * Re-collect lights from the scene and rebuild light data.
     * Call this after adding/removing lights, toggling visibility, or changing light properties.
     */
    refreshLights() {
        this.updateLighting(true);
    }
}
