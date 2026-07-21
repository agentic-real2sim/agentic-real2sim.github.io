//
// Copyright Contributors to the MaterialX Project
// SPDX-License-Identifier: Apache-2.0
//
import * as THREE from 'three';
import { debug, debugUpdate } from './utils.js';
import { isDevEnvironment } from './utils.js';

const IMAGE_PROPERTY_SEPARATOR = "_";
const UADDRESS_MODE_SUFFIX = IMAGE_PROPERTY_SEPARATOR + "uaddressmode";
const VADDRESS_MODE_SUFFIX = IMAGE_PROPERTY_SEPARATOR + "vaddressmode";
const FILTER_TYPE_SUFFIX = IMAGE_PROPERTY_SEPARATOR + "filtertype";
const IMAGE_PATH_SEPARATOR = "/";

/**
 * Initializes the environment texture as MaterialX expects it
 * @param {THREE.Texture} texture
 * @param {Object} capabilities
 * @returns {THREE.Texture}
 */
export function prepareEnvTexture(texture, capabilities) {
    const newTexture = new THREE.DataTexture(texture.image.data, texture.image.width, texture.image.height, /** @type {any} */(texture.format), texture.type);
    newTexture.wrapS = THREE.RepeatWrapping;
    newTexture.anisotropy = capabilities?.getMaxAnisotropy?.() ?? 1;
    newTexture.minFilter = THREE.LinearMipmapLinearFilter;
    newTexture.magFilter = THREE.LinearFilter;
    newTexture.generateMipmaps = true;
    newTexture.needsUpdate = true;
    return newTexture;
}

/**
 * Get Three uniform from MaterialX vector
 * @param {any} value
 * @param {any} dimension
 * @returns {Array<number>}
 */
function fromVector(value, dimension) {
    if (!value) return Array(dimension).fill(0.0);
    if (typeof value.data === "function") return [...value.data()];
    if (typeof value.getData === "function") return fromVector(value.getData(), dimension);
    if (typeof value !== "string" && typeof value[Symbol.iterator] === "function") return [...value];
    return Array(dimension).fill(0.0);
}

/**
 * Get Three uniform from MaterialX matrix
 * @param {any} matrix
 * @param {number} dimension
 * @returns {Array<number>}
 */
function fromMatrix(matrix, dimension) {
    const vec = [];
    if (matrix) {
        for (let i = 0; i < matrix.numRows(); ++i) {
            for (let k = 0; k < matrix.numColumns(); ++k) {
                vec.push(matrix.getItem(i, k));
            }
        }
    } else {
        for (let i = 0; i < dimension; ++i)
            vec.push(0.0);
    }

    return vec;
}

/**
 * @typedef {Object} Callbacks
 * @property {string} [cacheKey] - Cache key for the loaders, used to identify and reuse textures
 * @property {(path: string) => Promise<THREE.Texture | null | void>} getTexture - Get a texture by path
 */

/**
 * @param {string} src
 * @returns {HTMLImageElement | { src: string }}
 */
function createPortableImage(src) {
    if (typeof Image !== 'undefined') {
        const image = new Image();
        image.src = src;
        return image;
    }
    return { src };
}

const defaultTexture = new THREE.Texture();
defaultTexture.needsUpdate = true;
defaultTexture.image = createPortableImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIAQMAAAD+wSzIAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAANQTFRFr6+vGqg52AAAAAxJREFUeJxjZGBEgQAAWAAJLpjsTQAAAABJRU5ErkJggg==");
// defaultTexture.image.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQBAMAAADt3eJSAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAB5QTFRFAAAABAQEw8PD////v7+/vb29Xl5eQEBA+/v7PDw8GPBYkgAAAB1JREFUeJxjZGBgYFQSABIUMlxgDGMGBtaIAnIZAKwQCSDYUEZEAAAAAElFTkSuQmCC";
// defaultTexture.wrapS = THREE.RepeatWrapping;
// defaultTexture.wrapT = THREE.RepeatWrapping;
// defaultTexture.minFilter = THREE.NearestFilter;
// defaultTexture.magFilter = THREE.NearestFilter;
// defaultTexture.repeat = new THREE.Vector2(100, 100);

const defaultNormalTexture = new THREE.Texture();
defaultNormalTexture.needsUpdate = true;
defaultNormalTexture.image = createPortableImage("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAIBAMAAAA2IaO4AAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAABJQTFRFgYH4gIH4gYH3gIH3gIH5gID4m94ORAAAADFJREFUeJxjZBBkfMdo9P/BB0aBj/8FGB0ufghgFGT4r8wo+P8rD2Pgo3sMjIz8jAwAMLoN0ZjS5hgAAAAASUVORK5CYII=");

/**
 * @param {string} key
 * @returns {any}
 */
function tryGetFromCache(key) {
    const wasEnabled = THREE.Cache.enabled;
    THREE.Cache.enabled = true;
    const value = THREE.Cache.get(key);
    THREE.Cache.enabled = wasEnabled;
    return value;
}

/**
 * @param {string} key
 * @param {any} value
 */
function addToCache(key, value) {
    const wasEnabled = THREE.Cache.enabled;
    THREE.Cache.enabled = true;
    THREE.Cache.add(key, value);
    THREE.Cache.enabled = wasEnabled;
    if (debug) console.log('[MaterialX] Added to cache:', key, value);
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isAbsoluteTexturePath(value) {
    return /^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//") || value.startsWith("/");
}

/**
 * @param {string} value
 * @returns {boolean}
 */
function isAbsoluteUrl(value) {
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(value);
}

/**
 * @param {string} value
 * @returns {string}
 */
function withTrailingSlash(value) {
    return value.endsWith(IMAGE_PATH_SEPARATOR) ? value : `${value}${IMAGE_PATH_SEPARATOR}`;
}

/**
 * @param {string} value
 * @returns {string}
 */
function normalizeRelativeTexturePath(value) {
    const suffixStart = value.search(/[?#]/);
    const path = suffixStart >= 0 ? value.slice(0, suffixStart) : value;
    const suffix = suffixStart >= 0 ? value.slice(suffixStart) : "";
    const hasLeadingSlash = path.startsWith(IMAGE_PATH_SEPARATOR);
    const parts = [];

    for (const part of path.split(IMAGE_PATH_SEPARATOR)) {
        if (!part || part === ".") continue;
        if (part === "..") {
            const previous = parts[parts.length - 1];
            if (previous && previous !== "..") parts.pop();
            else if (!hasLeadingSlash) parts.push(part);
            continue;
        }
        parts.push(part);
    }

    const normalizedPath = `${hasLeadingSlash ? IMAGE_PATH_SEPARATOR : ""}${parts.join(IMAGE_PATH_SEPARATOR)}`;
    return `${normalizedPath}${suffix}`;
}

/**
 * @param {string} searchPath
 * @param {string} value
 * @returns {string}
 */
function resolveTexturePath(searchPath, value) {
    if (isAbsoluteTexturePath(value)) return value;
    if (!searchPath) return value;

    const normalizedSearchPath = searchPath.replace(/\/+$/, "");
    if (!normalizedSearchPath) return value;

    if (isAbsoluteUrl(normalizedSearchPath)) {
        return new URL(value, withTrailingSlash(normalizedSearchPath)).href;
    }

    if (THREE.LoaderUtils?.resolveURL) {
        return normalizeRelativeTexturePath(THREE.LoaderUtils.resolveURL(value, withTrailingSlash(normalizedSearchPath)));
    }

    return normalizeRelativeTexturePath(`${normalizedSearchPath}${IMAGE_PATH_SEPARATOR}${value}`);
}

/**
 * Get Three uniform from MaterialX value
 * @param {any} uniforms
 * @param {string} type
 * @param {any} value
 * @param {string} name
 * @param {Callbacks} loaders
 * @param {string} searchPath
 * @param {Array<Promise<unknown>>} [pendingTextureLoads]
 * @returns {THREE.Uniform}
 */
function toThreeUniform(threeUniforms, uniforms, type, value, name, loaders, searchPath, pendingTextureLoads) {

    const uniform = new THREE.Uniform(/** @type {any} */(null));

    switch (type) {
        case 'float':
        case 'integer':
        case 'boolean':
            uniform.value = value;
            break;
        case 'vector2':
            uniform.value = /** @type {any} */ (fromVector(value, 2));
            break;
        case 'vector3':
        case 'color3':
            uniform.value = /** @type {any} */ (fromVector(value, 3));
            break;
        case 'vector4':
        case 'color4':
            uniform.value = /** @type {any} */ (fromVector(value, 4));
            break;
        case 'matrix33':
            uniform.value = /** @type {any} */ (fromMatrix(value, 9));
            break;
        case 'matrix44':
            uniform.value = /** @type {any} */ (fromMatrix(value, 16));
            break;
        case 'filename':
            if (value) {
                // Cache / reuse texture to avoid reload overhead.
                // Note: that data blobs and embedded data textures are not cached as they are transient data.
                let checkCache = true;
                let texturePath = value;
                if (value.startsWith('blob:')) {
                    checkCache = false;
                }
                else if (value.startsWith('data:')) {
                    checkCache = false;
                }
                else if (value.startsWith('http')) {
                    checkCache = true;
                }
                else {
                    texturePath = resolveTexturePath(searchPath, value);
                }

                const cacheKey = loaders.cacheKey?.length ? `${loaders.cacheKey}-${texturePath}` : texturePath;
                const cacheValue = checkCache ? tryGetFromCache(cacheKey) : null;
                if (cacheValue) {
                    if (debug) console.log('[MaterialX] Use cached texture: ', cacheKey, cacheValue);
                    if (cacheValue instanceof Promise) {
                        const trackedLoad = cacheValue.then(res => {
                            if (res) {
                                uniform.value = res;
                                if (threeUniforms[name + "_flipY"]) threeUniforms[name + "_flipY"].value = !!res.flipY;
                            }
                            else console.warn(`[MaterialX] Failed to load texture ${name} '${texturePath}'`);
                            return res;
                        }).catch(err => {
                            console.error(`[MaterialX] Failed to load texture ${name} '${texturePath}'`, err);
                            return null;
                        });
                        pendingTextureLoads?.push(trackedLoad);
                    }
                    else {
                        uniform.value = cacheValue;
                        if (threeUniforms[name + "_flipY"]) threeUniforms[name + "_flipY"].value = !!cacheValue.flipY;
                    }
                }
                else {
                    if (debug) console.log('[MaterialX] Load texture:', texturePath);

                    if (name.toLowerCase().includes("normal")) uniform.value = /** @type {any} */ (defaultNormalTexture);
                    else uniform.value = /** @type {any} */ (defaultTexture);
                    const defaultValue = uniform.value;
                    // Save the loading promise in the cache
                    const promise = loaders.getTexture(texturePath)
                        ?.then(res => {
                            if (res) {
                                res.colorSpace = THREE.LinearSRGBColorSpace;
                                setTextureParameters(res, name, uniforms);
                                res.needsUpdate = true;
                            }
                            return res;
                        })
                        .catch(err => {
                            console.error(`[MaterialX] Failed to load texture ${name} '${texturePath}'`, err);
                            return defaultValue;
                        });

                    if (checkCache) addToCache(cacheKey, promise);

                    const trackedLoad = promise?.then(res => {
                        // Replace Promise cache entry with the resolved texture value.
                        // This avoids keeping long-lived promise/closure graphs in THREE.Cache.
                        if (checkCache && res) addToCache(cacheKey, res);
                        if (res) {
                            uniform.value = /** @type {any} */ (res);
                            if (threeUniforms[name + "_flipY"]) threeUniforms[name + "_flipY"].value = !!res.flipY;
                        }
                        else console.warn(`[MaterialX] Failed to load texture ${name} '${texturePath}'`);
                        return res;
                    });
                    if (trackedLoad) pendingTextureLoads?.push(trackedLoad);
                }
            }
            threeUniforms[name + "_flipY"] = new THREE.Uniform(!!uniform.value?.flipY);
            break;
        case 'samplerCube':
        case 'string':
        case 'surfaceshader':
        case 'displacementshader':
        case 'volumeshader':
        case 'lightshader':
            // MaterialX closure/shader types — not emitted uniforms, skip silently
            break;
        default:
            const key = type + ':' + name;
            if (!valueTypeWarningMap.has(key)) {
                valueTypeWarningMap.set(key, true);
                if (debug || isDevEnvironment()) console.warn(`MaterialX: Unsupported uniform '${name}': ${type}`);
            }
            break;
    }

    return uniform;
}

/** @type {Map<string, boolean>} */
const valueTypeWarningMap = new Map();

/**
 * Get Three wrapping mode
 * @param {number} mode
 * @returns {THREE.Wrapping}
 */
function getAddressMode(mode) {
    if (typeof mode === "number") return mode;
    switch (String(mode ?? "").toLowerCase()) {
        case "constant":
            return 0;
        case "clamp":
            return 1;
        case "periodic":
            return 2;
        case "mirror":
            return 3;
        default:
            return 2;
    }
}

/**
 * Get Three wrapping mode
 * @param {unknown} mode
 * @returns {THREE.Wrapping}
 */
function getWrapping(mode) {
    switch (getAddressMode(mode)) {
        case 0:
        case 1:
            return THREE.ClampToEdgeWrapping;
        case 3:
            return THREE.MirroredRepeatWrapping;
        case 2:
        default:
            return THREE.RepeatWrapping;
    }
}

/**
 * @param {unknown} mode
 * @returns {number}
 */
function getFilterType(mode) {
    if (typeof mode === "number") return mode;
    switch (String(mode ?? "").toLowerCase()) {
        case "closest":
            return 0;
        case "linear":
            return 1;
        default:
            return -1;
    }
}

/**
 * @param {any} uniforms
 * @param {string} name
 * @param {any} defaultValue
 * @returns {any}
 */
function getUniformData(uniforms, name, defaultValue) {
    const uniform = uniforms?.find?.(name);
    const value = uniform?.getValue?.();
    if (!value) return defaultValue;
    if (typeof value.getData === "function") return value.getData();
    if (typeof value.data === "function") return value.data();
    return defaultValue;
}

/**
 * Set Three texture parameters
 * @param {THREE.Texture} texture
 * @param {string} name
 * @param {any} uniforms
 * @param {boolean} [generateMipmaps=true]
 */
function setTextureParameters(texture, name, uniforms, generateMipmaps = true) {
    const idx = name.lastIndexOf(IMAGE_PROPERTY_SEPARATOR);
    const base = name.substring(0, idx) || name;

    texture.wrapS = getWrapping(getUniformData(uniforms, base + UADDRESS_MODE_SUFFIX, 2));
    texture.wrapT = getWrapping(getUniformData(uniforms, base + VADDRESS_MODE_SUFFIX, 2));

    const mxFilterType = getFilterType(getUniformData(uniforms, base + FILTER_TYPE_SUFFIX, -1));
    let minFilter = generateMipmaps ? THREE.LinearMipMapLinearFilter : THREE.LinearFilter;
    let magFilter = THREE.LinearFilter;
    if (mxFilterType === 0) {
        minFilter = /** @type {any} */ (generateMipmaps ? THREE.NearestMipMapNearestFilter : THREE.NearestFilter);
        magFilter = THREE.NearestFilter;
    }
    texture.minFilter = minFilter;
    texture.magFilter = magFilter;
}

/**
 * Return the global light rotation matrix
 * @returns {THREE.Matrix4}
 */
export function getLightRotation() {
    return new THREE.Matrix4().makeRotationY(Math.PI / 2);
}

/**
 * Returns all lights nodes in a MaterialX document
 * @param {any} doc
 * @returns {Array<any>}
 */
export function findLights(doc) {
    let lights = new Array();
    for (let node of doc.getNodes()) {
        if (node.getType() === "lightshader")
            lights.push(node);
    }
    return lights;
}

/** @type {Object<string, number>} */
let lightTypesBound = {};

/**
 * Returns the current mapping of MaterialX light definition names to their type IDs.
 * These IDs are used in the shader's LightData.type field.
 * @returns {{ directional: number, point: number, spot: number }}
 */
export function getLightTypeIds() {
    return {
        directional: lightTypesBound['ND_directional_light'] || 1,
        point: lightTypesBound['ND_point_light'] || 2,
        spot: lightTypesBound['ND_spot_light'] || 3,
    };
}

/**
 * Register lights in shader generation context
 * @param {any} mx - MaterialX Module
 * @param {any} genContext - Shader generation context
 * @returns {Promise<void>}
 */
export async function registerLights(mx, genContext) {
    lightTypesBound = {};
    const maxLightCount = genContext.getOptions().hwMaxActiveLightSources;
    mx.HwShaderGenerator.unbindLightShaders(genContext);
    let lightId = 1;
    // All light types so that we have NodeDefs for them
    const defaultLightRigXml = `<?xml version="1.0"?>
<materialx version="1.39">
    <directional_light name="default_directional_light" type="lightshader">
    </directional_light>
    <point_light name="default_point_light" type="lightshader">
    </point_light>
    <spot_light name="default_spot_light" type="lightshader">
    </spot_light>
    <!--
    <area_light name="default_area_light" type="lightshader">
    </area_light>
    -->
</materialx>`;

    // Load default light rig XML to ensure we have all light types available
    const lightRigDoc = mx.createDocument();
    await mx.readFromXmlString(lightRigDoc, defaultLightRigXml, "");
    const document = mx.createDocument();
    const stdlib = mx.loadStandardLibraries(genContext);
    document.setDataLibrary(stdlib);
    document.importLibrary(lightRigDoc);
    const defaultLights = findLights(document);
    if (debug) console.log("Default lights in MaterialX document", defaultLights);

    // Loading a document seems to reset this option for some reason, so we set it again
    genContext.getOptions().hwMaxActiveLightSources = maxLightCount;

    // Register types only – we get these from the default light rig XML above
    // This is needed to ensure that the light shaders are bound for each light type
    for (let light of defaultLights) {
        const lightDef = light.getNodeDef();
        if (debug) console.log("Default light node definition", lightDef);
        if (!lightDef) continue;

        const lightName = lightDef.getName();
        if (debug) console.log("Registering default light", { lightName, lightDef });
        if (!lightTypesBound[lightName]) {
            // TODO check if we need to bind light shader for each three.js light instead of once per type
            if (debug) console.log("Bind light shader for node", { lightName, lightId, lightDef });
            lightTypesBound[lightName] = lightId;
            mx.HwShaderGenerator.bindLightShader(lightDef, lightId++, genContext);
        }
    }

    if (debug) console.log("Light types bound in MaterialX context", lightTypesBound);
}

const _lightTypeWarnings = {}
const _emptyLightPosition = new THREE.Vector3(0, 0, 0);
const _emptyLightDirection = new THREE.Vector3(0, 0, -1);
const _emptyLightColor = new THREE.Color(0, 0, 0);
const _emptyLight = Object.freeze({
    type: 0,
    position: _emptyLightPosition,
    direction: _emptyLightDirection,
    color: _emptyLightColor,
    intensity: 0.0,
    decay_rate: 2.0,
    inner_angle: 0.0,
    outer_angle: 0.0,
});
/**
 * Converts Three.js light type to MaterialX node name
 * @param {string} threeLightType
 * @returns {string|null}
 */
function threeLightTypeToMaterialXNodeName(threeLightType) {
    switch (threeLightType) {
        case 'PointLight':
            return 'ND_point_light';
        case 'DirectionalLight':
            return 'ND_directional_light';
        case 'SpotLight':
            return 'ND_spot_light';
        default:
            if (!_lightTypeWarnings[threeLightType]) {
                _lightTypeWarnings[threeLightType] = true;
                console.warn('MaterialX: Unsupported light type: ' + threeLightType);
            }
            return null; // Unsupported light type
    }
}

/**
 * @typedef {Object} LightData
 * @property {number} type - Light type ID
 * @property {THREE.Vector3} position - Position in world space
 * @property {THREE.Vector3} direction - Direction in world space
 * @property {THREE.Color} color - Color of the light
 * @property {number} intensity - Intensity of the light
 * @property {number} decay_rate - Decay rate for point and spot lights
 * @property {number} inner_angle - Inner angle for spot lights
 * @property {number} outer_angle - Outer angle for spot lights
 */

/**
 * Update light data for shader uniforms
 * @param {Array<THREE.Light>} lights
 * @param {any} genContext
 * @returns {{ lightData: LightData[], lightCount: number }}
 */
export function getLightData(lights, genContext) {
    const lightData = new Array();
    const maxLightCount = genContext.getOptions().hwMaxActiveLightSources;

    // Three.js lights
    for (let light of lights) {
        // Skip if light is not a Three.js light
        if (!light?.isLight) continue;

        // Types in MaterialX: point_light, directional_light, spot_light

        const lightDefinitionName = threeLightTypeToMaterialXNodeName(light.type);

        if (!lightDefinitionName) {
            continue; // Unsupported light type
        }
        if (!lightTypesBound[lightDefinitionName]) {
            if (debug) console.error("MaterialX: Light type not registered in context. Make sure to register light types before using them.", lightDefinitionName);
        }

        const wp = light.getWorldPosition(new THREE.Vector3());
        // For target-based lights (SpotLight, DirectionalLight), compute direction from position to target.
        // Using getWorldQuaternion() doesn't work because Three.js target-based lights don't set rotation.
        let wd;
        const directionalOrSpot = (/** @type {THREE.DirectionalLight | THREE.SpotLight | null} */ (
            (/** @type {THREE.DirectionalLight} */ (light)).isDirectionalLight || (/** @type {THREE.SpotLight} */ (light)).isSpotLight
                ? light
                : null
        ));
        if (directionalOrSpot) {
            const targetPos = directionalOrSpot.target.getWorldPosition(new THREE.Vector3());
            wd = targetPos.sub(wp).normalize();
        } else {
            const wq = light.getWorldQuaternion(new THREE.Quaternion());
            wd = new THREE.Vector3(0, 0, -1).applyQuaternion(wq);
        }

        // Shader math from the generated MaterialX shader:
        // float low = min(light.inner_angle, light.outer_angle);
        // float high = light.inner_angle;
        // float cosDir = dot(result.direction, -light.direction);
        // float spotAttenuation = smoothstep(low, high, cosDir);

        const outerAngleRad = /** @type {THREE.SpotLight} */ (light).angle;
        const innerAngleRad = outerAngleRad * (1 - /** @type {THREE.SpotLight} */ (light).penumbra);
        const inner_angle = Math.cos(innerAngleRad);
        const outer_angle = Math.cos(outerAngleRad);

        lightData.push({
            type: lightTypesBound[lightDefinitionName],
            position: wp.clone(),
            direction: wd.clone(),
            color: light.color.clone(),
            // Luminous efficacy for converting radiant power in watts (W) to luminous flux in lumens (lm) at a wavelength of 555 nm.
            // Also, three.js lights don't have PI scale baked in, but MaterialX does, so we need to divide by PI for point and spot lights.
            intensity: light.intensity * (/** @type {THREE.PointLight} */ (light).isPointLight ? 683.0 / 3.1415 : /** @type {THREE.SpotLight} */ (light).isSpotLight ? 683.0 / 3.1415 : 1.0),
            decay_rate: 2.0,
            // Approximations for testing – the relevant light has 61.57986...129.4445 as inner/outer spot angle
            inner_angle: inner_angle,
            outer_angle: outer_angle,
        });
    }

    // Count the number of lights that are not empty
    const lightCount = lightData.length;

    // If we don't have enough entries in lightData, fill with empty lights
    while (lightData.length < maxLightCount) {
        lightData.push(_emptyLight);
    }

    if (debugUpdate) console.log("Registered lights in MaterialX context", lightTypesBound, lightData);

    return { lightData, lightCount };
}

/**
 * Get uniform values for a shader
 * @param {any} shaderStage
 * @param {Callbacks} loaders
 * @param {string} searchPath
 * @param {Array<Promise<unknown>>} [pendingTextureLoads]
 * @returns {Object<string, THREE.Uniform>}
 */
export function getUniformValues(shaderStage, loaders, searchPath, pendingTextureLoads) {
    loaders ??= { getTexture: async () => null };
    searchPath ??= "";
    /** @type {Object<string, THREE.Uniform>} */
    const threeUniforms = {};

    const uniformBlocks = shaderStage.getUniformBlocks()
    for (const [blockName, uniforms] of Object.entries(uniformBlocks)) {
        // Seems struct uniforms (like in LightData) end up here as well, we should filter those out.
        if (blockName === "LightData") continue;

        if (!uniforms.empty()) {
            for (let i = 0; i < uniforms.size(); ++i) {
                const variable = uniforms.get(i);
                const value = variable.getValue()?.getData();
                const uniformName = variable.getVariable();
                const type = variable.getType().getName();
                threeUniforms[uniformName] = toThreeUniform(threeUniforms, uniforms, type, value, uniformName, loaders, searchPath, pendingTextureLoads);
                if (debug) console.log("Adding uniform", { path: variable.getPath(), type: type, name: uniformName, value: threeUniforms[uniformName], },);
            }
        }
    }

    return threeUniforms;
}

/**
 * @param {THREE.ShaderMaterial} material
 * @param {any} shaderStage
 */
export function generateMaterialPropertiesForUniforms(material, shaderStage) {

    const uniformBlocks = shaderStage.getUniformBlocks()
    for (const [blockName, uniforms] of Object.entries(uniformBlocks)) {
        // Seems struct uniforms (like in LightData) end up here as well, we should filter those out.
        if (blockName === "LightData") continue;

        if (!uniforms.empty()) {
            for (let i = 0; i < uniforms.size(); ++i) {
                const variable = uniforms.get(i);
                const uniformName = variable.getVariable();
                let key = variable.getPath().split('/').pop();
                switch (key) {
                    case "_Color":
                        key = "color";
                        break;
                    case "_Roughness":
                        key = "roughness";
                        break;
                    case "_Metallic":
                        key = "metalness";
                        break;
                }
                if (key) {
                    if (material.hasOwnProperty(key)) {
                        if (debug) console.warn(`[MaterialX] Uniform ${uniformName} already exists in material as property ${key}, skipping.`);
                    }
                    else {
                        Object.defineProperty(material, key, {
                            get: function () {
                                return this.uniforms?.[uniformName].value
                            },
                            set: function (v) {
                                const uniforms = this.uniforms;
                                if (!uniforms || !uniforms[uniformName]) {
                                    console.warn(`[MaterialX] Uniform ${uniformName} not found in ${this.name} uniforms`);
                                    return;
                                }
                                this.uniforms[uniformName].value = v;
                                this.uniformsNeedUpdate = true;
                            }
                        });
                    }
                }
            }
        }
    }
}
