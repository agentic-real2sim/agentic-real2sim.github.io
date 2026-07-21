import { BufferGeometry, Camera, Euler, FrontSide, GLSL3, Group, Matrix4, Object3D, Scene, ShaderMaterial, Texture, Vector3 } from "three";
import { debug, getFrame, getTime } from "./utils.js";
import { MaterialXEnvironment } from "./materialx.js";
import { generateMaterialPropertiesForUniforms, getUniformValues, getLightTypeIds } from "./materialx.helper.js";

export const DEFAULT_ENVIRONMENT_RADIANCE_MODE = "three-pmrem";

/** @type {Promise<{ computeMikkTSpaceTangents: Function, MikkTSpace: any }> | null} */
let mikkTSpaceTangentsPromise = null;
/** @type {WeakMap<BufferGeometry, Promise<boolean>>} */
const pendingTangentGenerations = new WeakMap();

// Add helper matrices for uniform updates (similar to MaterialX example)
const worldInverseMat = new Matrix4();
const worldTransposeMat = new Matrix4();
const worldInverseTransposeMat = new Matrix4();
const worldViewMat = new Matrix4();
const worldViewProjectionMat = new Matrix4();
const envMat = new Matrix4();
const envRotation = new Euler();

// Local copy of Three.js UniformsUtils.cloneUniforms from
// three/src/renderers/shaders/UniformsUtils.js. Keep this in sync with the
// minimum supported Three.js version when Three changes uniform cloning.
function cloneUniforms(src) {
    const dst = {};
    for (const uniformName in src) {
        dst[uniformName] = {};
        for (const propertyName in src[uniformName]) {
            const property = src[uniformName][propertyName];
            if (property && (
                property.isColor ||
                property.isMatrix3 || property.isMatrix4 ||
                property.isVector2 || property.isVector3 || property.isVector4 ||
                property.isTexture || property.isQuaternion
            )) {
                dst[uniformName][propertyName] = property.isRenderTargetTexture ? null : property.clone();
            }
            else if (Array.isArray(property)) {
                dst[uniformName][propertyName] = property.slice();
            }
            else {
                dst[uniformName][propertyName] = property;
            }
        }
    }
    return dst;
}

// Local copy of Three.js UniformsUtils.mergeUniforms from
// three/src/renderers/shaders/UniformsUtils.js. Copied to avoid importing from
// three/src, which breaks package consumers using Three's public ESM surface.
function mergeUniforms(uniforms) {
    const merged = {};
    for (const uniformSet of uniforms) {
        const tmp = cloneUniforms(uniformSet);
        for (const propertyName in tmp) {
            merged[propertyName] = tmp[propertyName];
        }
    }
    return merged;
}

// Local copy of Three.js UniformsUtils.cloneUniformsGroups from
// three/src/renderers/shaders/UniformsUtils.js. Keep alongside cloneUniforms
// and mergeUniforms so ShaderMaterial.clone() stays behavior-compatible.
function cloneUniformsGroups(src) {
    return src.map(group => group.clone());
}

function createThreeLightUniforms() {
    return {
        ambientLightColor: { value: [] },
        lightProbe: { value: [] },
        directionalLights: { value: [], properties: { direction: {}, color: {} } },
        directionalLightShadows: { value: [], properties: { shadowIntensity: 1, shadowBias: {}, shadowNormalBias: {}, shadowRadius: {}, shadowMapSize: {} } },
        directionalShadowMap: { value: [] },
        directionalShadowMatrix: { value: [] },
        spotLights: { value: [], properties: { color: {}, position: {}, direction: {}, distance: {}, coneCos: {}, penumbraCos: {}, decay: {} } },
        spotLightShadows: { value: [], properties: { shadowIntensity: 1, shadowBias: {}, shadowNormalBias: {}, shadowRadius: {}, shadowMapSize: {} } },
        spotLightMap: { value: [] },
        spotShadowMap: { value: [] },
        spotLightMatrix: { value: [] },
        pointLights: { value: [], properties: { color: {}, position: {}, decay: {}, distance: {} } },
        pointLightShadows: { value: [], properties: { shadowIntensity: 1, shadowBias: {}, shadowNormalBias: {}, shadowRadius: {}, shadowMapSize: {}, shadowCameraNear: {}, shadowCameraFar: {} } },
        pointShadowMap: { value: [] },
        pointShadowMatrix: { value: [] },
        hemisphereLights: { value: [], properties: { direction: {}, skyColor: {}, groundColor: {} } },
        rectAreaLights: { value: [], properties: { color: {}, position: {}, width: {}, height: {} } },
        ltc_1: { value: null },
        ltc_2: { value: null },
        probesSH: { value: null },
        probesMin: { value: new Vector3() },
        probesMax: { value: new Vector3() },
        probesResolution: { value: new Vector3() },
    };
}

function getMikkTSpaceTangents() {
    mikkTSpaceTangentsPromise ??= Promise.all([
        import('three/examples/jsm/utils/BufferGeometryUtils.js'),
        import('three/examples/jsm/libs/mikktspace.module.js'),
    ]).then(async ([utils, MikkTSpace]) => {
        await MikkTSpace.ready;
        return {
            computeMikkTSpaceTangents: utils.computeMikkTSpaceTangents,
            MikkTSpace,
        };
    });
    return mikkTSpaceTangentsPromise;
}

/**
 * @param {BufferGeometry} geometry
 * @returns {Promise<boolean>}
 */
function ensureGeometryTangents(geometry) {
    if (geometry.attributes.tangent) return Promise.resolve(true);

    let pending = pendingTangentGenerations.get(geometry);
    if (pending) return pending;

    pending = (async () => {
        if (!geometry.attributes.position || !geometry.attributes.uv) {
            console.warn('[MaterialX] Cannot generate tangents: geometry requires position and uv attributes.');
            return false;
        }

        if (!geometry.attributes.normal) {
            geometry.computeVertexNormals();
        }

        const { computeMikkTSpaceTangents, MikkTSpace } = await getMikkTSpaceTangents();
        computeMikkTSpaceTangents(geometry, MikkTSpace);

        if (geometry.attributes.tangent) {
            geometry.attributes.tangent.needsUpdate = true;
            return true;
        }

        return false;
    })().catch(error => {
        console.warn('[MaterialX] Failed to generate MikkTSpace tangents.', error);
        return false;
    }).finally(() => {
        pendingTangentGenerations.delete(geometry);
    });

    pendingTangentGenerations.set(geometry, pending);
    return pending;
}

const CUBE_UV_REFLECTION_FUNCTIONS = `
float mx_cubeuv_getFace(vec3 direction) {
    vec3 absDirection = abs(direction);
    float face = -1.0;
    if (absDirection.x > absDirection.z) {
        if (absDirection.x > absDirection.y)
            face = direction.x > 0.0 ? 0.0 : 3.0;
        else
            face = direction.y > 0.0 ? 1.0 : 4.0;
    } else {
        if (absDirection.z > absDirection.y)
            face = direction.z > 0.0 ? 2.0 : 5.0;
        else
            face = direction.y > 0.0 ? 1.0 : 4.0;
    }
    return face;
}

vec2 mx_cubeuv_getUV(vec3 direction, float face) {
    vec2 uv;
    if (face == 0.0) {
        uv = vec2(direction.z, direction.y) / abs(direction.x);
    } else if (face == 1.0) {
        uv = vec2(-direction.x, -direction.z) / abs(direction.y);
    } else if (face == 2.0) {
        uv = vec2(-direction.x, direction.y) / abs(direction.z);
    } else if (face == 3.0) {
        uv = vec2(-direction.z, direction.y) / abs(direction.x);
    } else if (face == 4.0) {
        uv = vec2(-direction.x, direction.z) / abs(direction.y);
    } else {
        uv = vec2(direction.x, direction.y) / abs(direction.z);
    }
    return 0.5 * (uv + 1.0);
}

vec3 mx_cubeuv_bilinear(sampler2D envMap, vec3 direction, float mipInt) {
    const float cubeUV_minMipLevel = 4.0;
    const float cubeUV_minTileSize = 16.0;
    float face = mx_cubeuv_getFace(direction);
    float filterInt = max(cubeUV_minMipLevel - mipInt, 0.0);
    mipInt = max(mipInt, cubeUV_minMipLevel);
    float faceSize = exp2(mipInt);
    highp vec2 uv = mx_cubeuv_getUV(direction, face) * (faceSize - 2.0) + 1.0;
    if (face > 2.0) {
        uv.y += faceSize;
        face -= 3.0;
    }
    uv.x += face * faceSize;
    uv.x += filterInt * 3.0 * cubeUV_minTileSize;
    uv.y += 4.0 * (exp2(u_envRadianceCubeUVMaxMip) - faceSize);
    uv.x *= u_envRadianceCubeUVTexelWidth;
    uv.y *= u_envRadianceCubeUVTexelHeight;
    // PMREM encodes roughness in the CubeUV atlas itself. If the source KTX2
    // carries hardware mip levels, implicit sampling may pick those mips and
    // corrupt the atlas lookup.
    return textureLod(envMap, uv, 0.0).rgb;
}

float mx_cubeuv_roughnessToMip(float roughness) {
    const float cubeUV_r0 = 1.0;
    const float cubeUV_m0 = -2.0;
    const float cubeUV_r1 = 0.8;
    const float cubeUV_m1 = -1.0;
    const float cubeUV_r4 = 0.4;
    const float cubeUV_m4 = 2.0;
    const float cubeUV_r5 = 0.305;
    const float cubeUV_m5 = 3.0;
    const float cubeUV_r6 = 0.21;
    const float cubeUV_m6 = 4.0;
    float mip = 0.0;
    if (roughness >= cubeUV_r1) {
        mip = (cubeUV_r0 - roughness) * (cubeUV_m1 - cubeUV_m0) / (cubeUV_r0 - cubeUV_r1) + cubeUV_m0;
    } else if (roughness >= cubeUV_r4) {
        mip = (cubeUV_r1 - roughness) * (cubeUV_m4 - cubeUV_m1) / (cubeUV_r1 - cubeUV_r4) + cubeUV_m1;
    } else if (roughness >= cubeUV_r5) {
        mip = (cubeUV_r4 - roughness) * (cubeUV_m5 - cubeUV_m4) / (cubeUV_r4 - cubeUV_r5) + cubeUV_m4;
    } else if (roughness >= cubeUV_r6) {
        mip = (cubeUV_r5 - roughness) * (cubeUV_m6 - cubeUV_m5) / (cubeUV_r5 - cubeUV_r6) + cubeUV_m5;
    } else {
        mip = -2.0 * log2(1.16 * roughness);
    }
    return mip;
}

vec4 mx_cubeuv_texture(sampler2D envMap, vec3 sampleDir, float roughness) {
    float mip = clamp(mx_cubeuv_roughnessToMip(roughness), -2.0, u_envRadianceCubeUVMaxMip);
    float mipF = fract(mip);
    float mipInt = floor(mip);
    vec3 color0 = mx_cubeuv_bilinear(envMap, sampleDir, mipInt);
    if (mipF == 0.0) {
        return vec4(color0, 1.0);
    }
    vec3 color1 = mx_cubeuv_bilinear(envMap, sampleDir, mipInt + 1.0);
    return vec4(mix(color0, color1, mipF), 1.0);
}
`;

const STANDARD_SURFACE_CLOSURE_GATES = [
    { prefix: 'mx_dielectric_bsdf(closureData, coat,', predicate: 'coat >= M_FLOAT_EPS' },
    { prefix: 'mx_conductor_bsdf(closureData, metalness,', predicate: 'metalness >= M_FLOAT_EPS' },
    { prefix: 'mx_dielectric_bsdf(closureData, specular,', predicate: 'specular >= M_FLOAT_EPS' },
    { prefix: 'mx_dielectric_bsdf(closureData, transmission,', predicate: 'transmission >= M_FLOAT_EPS' },
    { prefix: 'mx_sheen_bsdf(closureData, sheen,', predicate: 'sheen >= M_FLOAT_EPS' },
    { prefix: 'mx_translucent_bsdf(closureData, subsurface,', predicate: 'subsurface >= M_FLOAT_EPS' },
    { prefix: 'mx_subsurface_bsdf(closureData, subsurface,', predicate: 'subsurface >= M_FLOAT_EPS' },
    { prefix: 'mx_mix_bsdf(closureData, translucent_bsdf_out, subsurface_bsdf_out,', predicate: 'subsurface >= M_FLOAT_EPS' },
    { prefix: 'mx_uniform_edf(closureData, emission_weight_out,', predicate: 'emission >= M_FLOAT_EPS' },
    { prefix: 'mx_multiply_edf_color3(closureData, emission_edf_out,', predicate: 'emission >= M_FLOAT_EPS' },
    { prefix: 'mx_generalized_schlick_edf(closureData, emission_color0_out,', predicate: 'emission >= M_FLOAT_EPS' },
    { prefix: 'mx_mix_edf(closureData, coat_emission_edf_out, emission_edf_out,', predicate: 'emission >= M_FLOAT_EPS' },
];

/**
 * MaterialX's optimized standard_surface graph still emits every closure call,
 * even when a closure weight is a uniform that is zero for the whole draw. These
 * uniform branches let ANGLE/Metal skip zero-weight branches before entering the
 * heavier BSDF/EDF helpers.
 * @param {string} fragmentShader
 * @returns {string}
 */
export function optimizeMaterialXClosureBranches(fragmentShader) {
    if (!fragmentShader.includes('NG_standard_surface_surfaceshader_optim')) return fragmentShader;

    let optimized = fragmentShader;
    for (const { prefix, predicate } of STANDARD_SURFACE_CLOSURE_GATES) {
        optimized = gateClosureCall(optimized, prefix, predicate);
    }
    return optimized;
}

/**
 * @param {string} source
 * @param {string} callPrefix
 * @param {string} predicate
 * @returns {string}
 */
function gateClosureCall(source, callPrefix, predicate) {
    const pattern = new RegExp(`^(\\s*)${escapeRegExp(callPrefix)}([^\\n]*\\);)$`, 'gm');
    return source.replace(pattern, (_match, indent, rest) => {
        return `${indent}if (${predicate}) {\n${indent}    ${callPrefix}${rest}\n${indent}}`;
    });
}

/**
 * @param {string} value
 * @returns {string}
 */
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TEXTURE_FLIP_Y_FUNCTIONS = `
vec2 mx_three_flip_y(vec2 uv, bool flipY) {
    return flipY ? vec2(uv.x, 1.0 - uv.y) : uv;
}
`;

/**
 * ShaderMaterial bypasses Three.js' built-in texture transform chunks, so
 * MaterialX file texture samples need to account for THREE.Texture.flipY here.
 * @param {string} fragmentShader
 * @returns {string}
 */
function patchTextureFlipY(fragmentShader) {
    const textureNames = [...fragmentShader.matchAll(/\buniform\s+sampler2D\s+([A-Za-z_][A-Za-z0-9_]*)\s*;/g)]
        .map(match => match[1])
        .filter(name => !name.startsWith('u_') && name !== 'albedoTable');

    if (!textureNames.length) return fragmentShader;

    for (const name of textureNames) {
        const escapedName = escapeRegExp(name);
        fragmentShader = fragmentShader.replace(
            new RegExp(`\\btexture\\s*\\(\\s*${escapedName}\\s*,\\s*([^,\\)]+)\\)`, 'g'),
            `texture(${name}, mx_three_flip_y($1, ${name}_flipY))`
        );
        fragmentShader = fragmentShader.replace(
            new RegExp(`\\btextureLod\\s*\\(\\s*${escapedName}\\s*,\\s*([^,\\)]+)\\s*,`, 'g'),
            `textureLod(${name}, mx_three_flip_y($1, ${name}_flipY),`
        );
    }

    const uniforms = textureNames.map(name => `uniform bool ${name}_flipY;`).join('\n');
    return fragmentShader.replace(
        /(precision\s+\w+\s+float;)/,
        `$1\n${uniforms}\n${TEXTURE_FLIP_Y_FUNCTIONS}`
    );
}

/**
 * The stock WebGL image node implementations rely on sampler wrapping, but the
 * MaterialX "constant" address mode returns the node default outside [0, 1].
 * @param {string} fragmentShader
 * @returns {string}
 */
function patchImageAddressModes(fragmentShader) {
    return fragmentShader.replace(
        /(void\s+mx_image_\w+\([^)]*\bdefaultval\b[^)]*\buaddressmode\b[^)]*\bvaddressmode\b[^)]*\)\s*\{\s*vec2\s+uv\s*=\s*mx_transform_uv\(texcoord,\s*uv_scale,\s*uv_offset\);\s*)result\s*=\s*texture\(([^,]+),\s*uv\)(\.[A-Za-z]+)?;/g,
        (_match, prefix, sampler, swizzle = "") => `${prefix}if ((uaddressmode == 0 && (uv.x < 0.0 || uv.x > 1.0)) || (vaddressmode == 0 && (uv.y < 0.0 || uv.y > 1.0))) {
        result = defaultval;
    } else {
        result = texture(${sampler}, uv)${swizzle};
    }`
    );
}

function patchInstancingTransforms(vertexShader) {
    if (!vertexShader.includes('u_worldMatrix') || vertexShader.includes('mtlxWorldMatrix')) return vertexShader;

    let helper = `
mat4 mtlxWorldMatrix()
{
#ifdef USE_INSTANCING
    return u_worldMatrix * instanceMatrix;
#else
    return u_worldMatrix;
#endif
}
`;

    if (vertexShader.includes('u_worldInverseTransposeMatrix')) {
        helper += `
vec3 mtlxWorldNormal(vec3 objectNormal)
{
    vec3 transformedNormal = objectNormal;
#ifdef USE_INSTANCING
    mat3 instanceNormalMatrix = mat3(instanceMatrix);
    transformedNormal /= vec3(
        dot(instanceNormalMatrix[0], instanceNormalMatrix[0]),
        dot(instanceNormalMatrix[1], instanceNormalMatrix[1]),
        dot(instanceNormalMatrix[2], instanceNormalMatrix[2])
    );
    transformedNormal = instanceNormalMatrix * transformedNormal;
#endif
    return normalize(mat3(u_worldInverseTransposeMatrix) * transformedNormal);
}
`;
    }

    vertexShader = vertexShader.replace(/void\s+main\s*\(\s*\)\s*\{/, `${helper}\nvoid main() {`);
    vertexShader = vertexShader.replaceAll(
        'u_worldMatrix * vec4(position, 1.0)',
        'mtlxWorldMatrix() * vec4(position, 1.0)',
    );
    vertexShader = vertexShader.replaceAll(
        'mx_matrix_mul(u_worldMatrix, vec4(tangent, 0.0)).xyz',
        '(mtlxWorldMatrix() * vec4(tangent, 0.0)).xyz',
    );
    vertexShader = vertexShader.replaceAll(
        'normalize(mx_matrix_mul(u_worldInverseTransposeMatrix, vec4(normal, 0.0)).xyz)',
        'mtlxWorldNormal(normal)',
    );
    vertexShader = vertexShader.replaceAll(
        'normalize(mat3(viewMatrix) * mat3(u_worldInverseTransposeMatrix) * normal)',
        'normalize(mat3(viewMatrix) * mtlxWorldNormal(normal))',
    );

    return vertexShader;
}

/**
 * @typedef {Object} MaterialXMaterialInitParameters
 * @property {string} name
 * @property {string | null} [shaderName] - Optional name of the shader
 * @property {any} shader
 * @property {import('./materialx.helper.js').Callbacks} loaders
 * @property {import('./materialx.js').MaterialXContext} context
 * @property {import('three').MaterialParameters} [parameters] - Optional parameters
 * @property {"three-pmrem" | "materialx-prefiltered" | "materialx-fis"} [environmentRadianceMode]
 * @property {boolean} [specularAntialiasing] - Match Three.js glossy specular antialiasing. Defaults to true.
 * @property {boolean} [generateTangents] - Generate missing MikkTSpace tangents for tangent-dependent shaders. Defaults to true.
 * @property {string} [path] - Base path used to resolve relative MaterialX texture filenames.
 * @property {boolean} [debug] - Debug flag
 */

/**
 * @typedef {"highp" | "mediump" | "lowp"} Precision
 */

// @dont-generate-component
export class MaterialXMaterial extends ShaderMaterial {

    /** The original name of the shader 
     * @type {string | null} */
    shaderName = null;

    /**
     * @param {MaterialXMaterial} source
     * @returns {this}
     */
    copy(source) {
        super.copy(source);
        this.shaderName = source.shaderName;
        this._context = source._context;
        this._shader = source._shader;
        this._needsTangents = source._needsTangents;
        this.uniforms = cloneUniforms(source.uniforms);
        this.uniformsGroups = cloneUniformsGroups(source.uniformsGroups);
        this.envMapIntensity = source.envMapIntensity;
        this.envMap = source.envMap;
        this.envMapRotation.copy(source.envMapRotation);
        this.environmentRadianceMode = source.environmentRadianceMode;
        this.specularAntialiasing = source.specularAntialiasing;
        this.generateTangents = source.generateTangents;
        this.ready = source.ready;
        generateMaterialPropertiesForUniforms(this, this._shader.getStage('pixel'));
        generateMaterialPropertiesForUniforms(this, this._shader.getStage('vertex'));
        this.needsUpdate = true;
        return this;
    }

    /** @type {import('./materialx.js').MaterialXContext | null} */
    _context = null;
    /** @type {any} */
    _shader = null;
    /** @type {boolean} */
    _needsTangents = false;
    /** @type {WeakSet<BufferGeometry>} */
    _pendingTangentGeometries = new WeakSet();
    /** @type {Promise<void>} */
    ready = Promise.resolve();

    /**
     * @param {MaterialXMaterialInitParameters} [init]
     */
    constructor(init) {

        /** @type {import('three').ShaderMaterialParameters | undefined} */
        let materialParameters = undefined;
        /** @type {string} */
        let vertexShader = "";
        /** @type {string} */
        let fragmentShader = "";
        /** @type {Record<string, string>} */
        let defines = {};
        /** @type {"three-pmrem" | "materialx-prefiltered" | "materialx-fis"} */
        let environmentRadianceMode = DEFAULT_ENVIRONMENT_RADIANCE_MODE;
        let specularAntialiasing = true;
        let generateTangents = true;

        if (init) {

        // Get vertex and fragment shader source, and remove #version directive for newer js. 
        // It's added by three.js glslVersion.
        vertexShader = init.shader.getSourceCode("vertex");
        fragmentShader = init.shader.getSourceCode("pixel");

        vertexShader = vertexShader.replace(/^#version.*$/gm, '').trim();
        fragmentShader = fragmentShader.replace(/^#version.*$/gm, '').trim();
        fragmentShader = optimizeMaterialXClosureBranches(fragmentShader);
        fragmentShader = patchImageAddressModes(fragmentShader);
        fragmentShader = patchTextureFlipY(fragmentShader);

        // MaterialX uses different attribute names than js defaults,
        // so we patch the MaterialX shaders to match the js standard names.
        // Otherwise, we'd have to modify the mesh attributes (see original MaterialX for reference).

        // Patch vertexShader
        vertexShader = vertexShader.replace(/\bi_position\b/g, 'position');
        vertexShader = vertexShader.replace(/\bi_normal\b/g, 'normal');
        vertexShader = vertexShader.replace(/\bi_texcoord_0\b/g, 'uv');
        vertexShader = vertexShader.replace(/\bi_texcoord_1\b/g, 'uv1');
        vertexShader = vertexShader.replace(/\bi_texcoord_2\b/g, 'uv2');
        vertexShader = vertexShader.replace(/\bi_texcoord_3\b/g, 'uv3');
        vertexShader = vertexShader.replace(/\bi_tangent\b/g, 'tangent');
        vertexShader = vertexShader.replace(/\bi_color_0\b/g, 'color');
        // TODO: do we need to add depthbuffer fragments? https://discourse.threejs.org/t/shadermaterial-render-order-with-logarithmicdepthbuffer-is-wrong/49221/4
        // Add logdepthbuf_pars_vertex at the beginning of the vertex shader before main()
        // vertexShader = vertexShader.replace(/void\s+main\s*\(\s*\)\s*{/, `#include <logdepthbuf_pars_vertex>\nvoid main() {`);
        // // Add logdepthbuf_vertex to vertex shader if not present at end of main()
        // vertexShader = vertexShader.replace(/void\s+main\s*\(\s*\)\s*{/, `void main() {\n    #include <logdepthbuf_vertex>\n`);

        // Patch fragmentShader
        const precision = init.parameters?.precision || "highp";
        vertexShader = vertexShader.replace(/precision mediump float;/g, `precision ${precision} float;`);
        vertexShader = vertexShader.replace(/#define M_FLOAT_EPS 1e-8/g, precision === "highp" ? `#define M_FLOAT_EPS 1e-8` : `#define M_FLOAT_EPS 1e-3`);
        fragmentShader = fragmentShader.replace(/precision mediump float;/g, `precision ${precision} float;`);
        fragmentShader = fragmentShader.replace(/#define M_FLOAT_EPS 1e-8/g, precision === "highp" ? `#define M_FLOAT_EPS 1e-8` : `#define M_FLOAT_EPS 1e-3`);

        fragmentShader = fragmentShader.replace(/\bi_position\b/g, 'position');
        fragmentShader = fragmentShader.replace(/\bi_normal\b/g, 'normal');
        fragmentShader = fragmentShader.replace(/\bi_texcoord_0\b/g, 'uv');
        fragmentShader = fragmentShader.replace(/\bi_texcoord_1\b/g, 'uv1');
        fragmentShader = fragmentShader.replace(/\bi_texcoord_2\b/g, 'uv2');
        fragmentShader = fragmentShader.replace(/\bi_texcoord_3\b/g, 'uv3');
        fragmentShader = fragmentShader.replace(/\bi_tangent\b/g, 'tangent');
        fragmentShader = fragmentShader.replace(/\bi_color_0\b/g, 'color');

        // Patch env intensity uniform to match Three.js naming convention.
        // MaterialX generates `u_envLightIntensity`; Three.js uses `envMapIntensity`.
        // This lets us combine material.envMapIntensity * scene.environmentIntensity
        // the same way MeshStandardMaterial does.
        fragmentShader = fragmentShader.replace(/\bu_envLightIntensity\b/g, 'envMapIntensity');
        specularAntialiasing = init.specularAntialiasing ?? true;
        generateTangents = init.generateTangents ?? true;
        if (specularAntialiasing) {
            fragmentShader = patchEnvironmentSpecularAntialiasing(fragmentShader);
        }
        environmentRadianceMode = normalizeEnvironmentRadianceMode(init.environmentRadianceMode);
        if (environmentRadianceMode === "three-pmrem") {
            fragmentShader = patchPrefilteredEnvironmentLookup(fragmentShader);
        }

        // Capture some vertex shader properties
        // Detect whether each UV was originally vec2 or vec3 before removing declarations.
        // Three.js always provides vec2 attributes, so vec3 assignments need wrapping.
        const uv_is_vec2 = vertexShader.includes('in vec2 uv;');
        const uv1_is_vec2 = vertexShader.includes('in vec2 uv1;');
        const uv2_is_vec2 = vertexShader.includes('in vec2 uv2;');
        const uv3_is_vec2 = vertexShader.includes('in vec2 uv3;');

        // Remove `in vec3 position;` and so on since they're already declared by ShaderMaterial
        vertexShader = vertexShader.replace(/in\s+vec3\s+position;/g, '');
        vertexShader = vertexShader.replace(/in\s+vec3\s+normal;/g, '');
        vertexShader = vertexShader.replace(/in\s+vec2\s+uv;/g, '');
        vertexShader = vertexShader.replace(/in\s+vec3\s+uv;/g, '');
        var hasUv1 = vertexShader.includes('in vec3 uv1;');
        vertexShader = vertexShader.replace(/in\s+vec3\s+uv1;/g, '');
        var hasUv2 = vertexShader.includes('in vec3 uv2;');
        vertexShader = vertexShader.replace(/in\s+vec3\s+uv2;/g, '');
        var hasUv3 = vertexShader.includes('in vec3 uv3;');
        vertexShader = vertexShader.replace(/in\s+vec3\s+uv3;/g, '');
        var hasTangent = vertexShader.includes('in vec4 tangent;');
        vertexShader = vertexShader.replace(/in\s+vec4\s+tangent;/g, '');
        var hasColor = vertexShader.includes('in vec4 color;');
        vertexShader = vertexShader.replace(/in\s+vec4\s+color;/g, '');
        // Three.js provides `color` as vec3 but MaterialX declares it as vec4.
        // Wrap assignments to vec4 targets: `color_0 = color;` → `color_0 = vec4(color, 1.0);`
        if (hasColor) {
            vertexShader = vertexShader.replace(/\bvec4 (\w+) = color;/g, 'vec4 $1 = vec4(color, 1.0);');
            vertexShader = vertexShader.replace(/(\w+) = color;/g, (match, name) => {
                if (match.includes('vec4')) return match;
                const isVec4 = new RegExp(`\\bvec4\\s+${name}\\b`).test(vertexShader);
                return isVec4 ? `${name} = vec4(color, 1.0);` : match;
            });
        }

        // Patch uv vec2→vec3. Three.js provides uv/uv1/uv2/uv3 as vec2.
        // MaterialX may declare them as vec3, and hwTexcoordVerticalFlip
        // generates `vec3(uv.x, 1.0 - uv.y, uv.z)` — but .z is invalid
        // on a vec2. We need to fix both patterns:
        //   `x = uv;` where x is vec3 → `x = vec3(uv, 0.0);`
        //   `x = vec3(uv.x, ..., uv.z)` → `x = vec3(uv.x, ..., 0.0)`
        /** @param {string} shader @param {string} uvName */
        function patchUvAssignments(shader, uvName) {
            // Fix hwTexcoordVerticalFlip output: replace .z access on vec2 attribute
            // `vec3(uv.x, 1.0 - uv.y, uv.z)` → `vec3(uv.x, 1.0 - uv.y, 0.0)`
            shader = shader.replace(
                new RegExp(`vec3\\(${uvName}\\.x,\\s*1\\.0 - ${uvName}\\.y,\\s*${uvName}\\.z\\)`, 'g'),
                `vec3(${uvName}.x, 1.0 - ${uvName}.y, 0.0)`
            );
            // Plain passthrough: `vec3 x = uv;` → `vec3 x = vec3(uv, 0.0);`
            shader = shader.replace(new RegExp(`\\bvec3 (\\w+) = ${uvName};`, 'g'), `vec3 $1 = vec3(${uvName}, 0.0);`);
            // Non-declaration: `x = uv;` → wrap only when target is vec3
            shader = shader.replace(new RegExp(`(\\w+) = ${uvName};`, 'g'), (match, name) => {
                if (match.includes('vec3')) return match;
                const isVec3 = new RegExp(`\\bvec3\\s+${name}\\b`).test(shader);
                return isVec3 ? `${name} = vec3(${uvName}, 0.0);` : match;
            });
            shader = shader.replace(new RegExp(`(\\w+) = vec2\\(${uvName}\\.x,\\s*1\\.0 - ${uvName}\\.y\\);`, 'g'), (match, name) => {
                const isVec3 = new RegExp(`\\bvec3\\s+${name}\\b`).test(shader);
                return isVec3 ? `${name} = vec3(${uvName}.x, 1.0 - ${uvName}.y, 0.0);` : match;
            });
            return shader;
        }
        vertexShader = patchUvAssignments(vertexShader, 'uv');
        vertexShader = patchUvAssignments(vertexShader, 'uv1');
        vertexShader = patchUvAssignments(vertexShader, 'uv2');
        vertexShader = patchUvAssignments(vertexShader, 'uv3');

        // Patch units – seems MaterialX uses different units and we end up with wrong light values?
        // result.direction = light.position - position;
        fragmentShader = fragmentShader.replace(
            /result\.direction\s*=\s*light\.position\s*-\s*position;/g,
            'result.direction = (light.position - position) * 10.0 / 1.0;');

        // Add tonemapping and colorspace handling
        // Replace `out vec4 out1;` with `out vec4 gl_FragColor;`
        fragmentShader = fragmentShader.replace(
            /out\s+vec4\s+out1;/,
            'layout(location = 0) out vec4 pc_fragColor;\n#define gl_FragColor pc_fragColor');

        // Replace `out1 = vec4(<CAPTURE>)` with `gl_FragColor = vec4(<CAPTURE>)` and tonemapping/colorspace handling
        fragmentShader = fragmentShader.replace(/^\s*out1\s*=\s*vec4\((.*)\);/gm, `
    gl_FragColor = vec4($1);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>`);

        defines = {};
        if (hasUv1) defines['USE_UV1'] = '';
        if (hasUv2) defines['USE_UV2'] = '';
        if (hasUv3) defines['USE_UV3'] = '';
        if (hasTangent) defines['USE_TANGENT'] = '';
        if (hasColor) defines['USE_COLOR'] = '';

        // Detect whether the vertex shader declares the inverse-transpose matrix uniform.
        // Unlit shaders omit this uniform, so shadow code that references it would fail.
        const hasShadowUniforms = vertexShader.includes('u_worldInverseTransposeMatrix');

        // Add Three.js shadow support (only when the vertex shader has the required uniforms)
        if (hasShadowUniforms) {
        // Insert shadow pars before main() in vertex shader
        vertexShader = vertexShader.replace(
            /void\s+main\s*\(\s*\)\s*\{/,
            `#include <common>
#include <shadowmap_pars_vertex>
void main() {`
        );

        // Insert shadow vertex calculation at the end of vertex main (before the closing brace)
        // We need to compute worldPosition and transformedNormal for shadow coords
        // Note: Three.js shadowmap_vertex expects transformedNormal in VIEW space:
        //   it does `inverseTransformDirection(transformedNormal, viewMatrix)` to get world-space normal
        vertexShader = vertexShader.replace(
            /(\n\s*)\}(\s*)$/,
            `$1    // Three.js shadow support
$1    vec4 worldPosition = u_worldMatrix * vec4(position, 1.0);
$1    vec3 transformedNormal = normalize(mat3(viewMatrix) * mat3(u_worldInverseTransposeMatrix) * normal);
$1    #include <shadowmap_vertex>
$1}$2`
        );

        // Insert shadow includes at the very beginning of the fragment shader (after precision)
        // This ensures DirectionalLightShadow struct is defined before getMxShadow uses it
        fragmentShader = fragmentShader.replace(
            /(precision\s+\w+\s+float;)/,
            `$1

#include <common>
#include <packing>
#include <shadowmap_pars_fragment>`
        );

        // Get MaterialX light type IDs for shadow dispatch
        const lightTypeIds = getLightTypeIds();

        // Generate GLSL helper functions that sample shadow maps using constant indices.
        // Sampler arrays require constant integral expression indices in GLSL ES 3.0,
        // so we use if/else chains with literal constants (guarded by preprocessor).
        const MAX_SHADOW_LIGHTS = 4; // max shadow-casting lights per type

        let dirShadowCases = '';
        for (let i = 0; i < MAX_SHADOW_LIGHTS; i++) {
            dirShadowCases += `
        #if NUM_DIR_LIGHT_SHADOWS > ${i}
        ${i > 0 ? 'else ' : ''}if (idx == ${i}) {
            DirectionalLightShadow s = directionalLightShadows[${i}];
            return getShadow(directionalShadowMap[${i}], s.shadowMapSize, s.shadowIntensity, s.shadowBias, s.shadowRadius, vDirectionalShadowCoord[${i}]);
        }
        #endif`;
        }

        let spotShadowCases = '';
        for (let i = 0; i < MAX_SHADOW_LIGHTS; i++) {
            spotShadowCases += `
        #if NUM_SPOT_LIGHT_SHADOWS > ${i}
        ${i > 0 ? 'else ' : ''}if (idx == ${i}) {
            SpotLightShadow s = spotLightShadows[${i}];
            return getShadow(spotShadowMap[${i}], s.shadowMapSize, s.shadowIntensity, s.shadowBias, s.shadowRadius, vSpotLightCoord[${i}]);
        }
        #endif`;
        }

        let pointShadowCases = '';
        for (let i = 0; i < MAX_SHADOW_LIGHTS; i++) {
            pointShadowCases += `
        #if NUM_POINT_LIGHT_SHADOWS > ${i}
        ${i > 0 ? 'else ' : ''}if (idx == ${i}) {
            PointLightShadow s = pointLightShadows[${i}];
            return getPointShadow(pointShadowMap[${i}], s.shadowMapSize, s.shadowIntensity, s.shadowBias, s.shadowRadius, vPointShadowCoord[${i}], s.shadowCameraNear, s.shadowCameraFar);
        }
        #endif`;
        }

        // Insert getMxShadow helper function BEFORE sampleLightSource (so it's defined when used)
        // Supports directional, spot, and point light shadows.
        // Uses global per-type counters to track which shadow map index to use.
        fragmentShader = fragmentShader.replace(
            /void sampleLightSource\(LightData light, vec3 position, out lightshader result\)/,
            `// MaterialX light type IDs (from registerLights)
#define MX_LIGHT_TYPE_DIRECTIONAL ${lightTypeIds.directional}
#define MX_LIGHT_TYPE_POINT ${lightTypeIds.point}
#define MX_LIGHT_TYPE_SPOT ${lightTypeIds.spot}

// Per-type shadow index counters (global so they persist across sampleLightSource calls)
int mxDirShadowIdx = 0;
int mxSpotShadowIdx = 0;
int mxPointShadowIdx = 0;

// Shadow sampling helpers using constant indices (required for sampler arrays in GLSL ES 3.0)
float sampleMxDirShadow(int idx) {
    #ifdef USE_SHADOWMAP
    #if NUM_DIR_LIGHT_SHADOWS > 0
    ${dirShadowCases}
    #endif
    #endif
    return 1.0;
}

float sampleMxSpotShadow(int idx) {
    #ifdef USE_SHADOWMAP
    #if NUM_SPOT_LIGHT_SHADOWS > 0
    ${spotShadowCases}
    #endif
    #endif
    return 1.0;
}

float sampleMxPointShadow(int idx) {
    #ifdef USE_SHADOWMAP
    #if NUM_POINT_LIGHT_SHADOWS > 0
    ${pointShadowCases}
    #endif
    #endif
    return 1.0;
}

void sampleLightSource(LightData light, vec3 position, out lightshader result)`
        );

        // Find the sampleLightSource function and add shadow + counter increment at the end.
        // The per-type counters track which Three.js shadow map index to use for each light type.
        // Lights must be sorted (shadow-casting first per type) to match Three.js shadow map ordering.
        fragmentShader = fragmentShader.replace(
            /(void sampleLightSource\(LightData light, vec3 position, out lightshader result\)\s*\{[\s\S]*?)(^\})/m,
            `$1    // Apply Three.js shadow and increment per-type shadow counters
    if (light.type == MX_LIGHT_TYPE_DIRECTIONAL) {
        result.intensity *= sampleMxDirShadow(mxDirShadowIdx);
        mxDirShadowIdx++;
    } else if (light.type == MX_LIGHT_TYPE_SPOT) {
        result.intensity *= sampleMxSpotShadow(mxSpotShadowIdx);
        mxSpotShadowIdx++;
    } else if (light.type == MX_LIGHT_TYPE_POINT) {
        result.intensity *= sampleMxPointShadow(mxPointShadowIdx);
        mxPointShadowIdx++;
    }
$2`
        );
        } // end hasShadowUniforms

        vertexShader = patchInstancingTransforms(vertexShader);

        const threeParameters = { ...init.parameters };
        materialParameters = {
            name: init.name,
            uniforms: {},
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            glslVersion: GLSL3,
            depthTest: true,
            defines: defines,
            lights: true, // Enable Three.js light uniforms
            ...threeParameters, // Spread any additional parameters passed to the material
        };
        }

        super(materialParameters);

        // Constructor can be called without init during clone() paths.
        if (!init) {
            return;
        }

        const path = init.path || "";
        /** @type {Array<Promise<unknown>>} */
        const pendingTextureLoads = [];
        this.shaderName = init.shaderName || null;
        this._context = init.context;
        this._shader = init.shader;
        this._needsTangents = vertexShader.includes('in vec4 tangent;') || vertexShader.includes('in vec3 tangent;');
        this.environmentRadianceMode = environmentRadianceMode;
        this.specularAntialiasing = specularAntialiasing;
        this.generateTangents = generateTangents;

        Object.assign(this.uniforms,
            // Three.js light uniforms (required when lights: true). These use
            // Three's merge/clone semantics; generated MaterialX texture
            // uniforms below must keep their original object identity so async
            // texture resolution updates the same uniform object.
            mergeUniforms([createThreeLightUniforms()]),
            getUniformValues(init.shader.getStage('vertex'), init.loaders, path, pendingTextureLoads),
            getUniformValues(init.shader.getStage('pixel'), init.loaders, path, pendingTextureLoads),
            {
                u_worldMatrix: { value: new Matrix4() },
                u_worldInverseMatrix: { value: new Matrix4() },
                u_worldTransposeMatrix: { value: new Matrix4() },
                u_worldInverseTransposeMatrix: { value: new Matrix4() },
                u_worldViewMatrix: { value: new Matrix4() },
                u_viewProjectionMatrix: { value: new Matrix4() },
                u_worldViewProjectionMatrix: { value: new Matrix4() },
                u_viewPosition: { value: new Vector3() },

                u_envMatrix: { value: new Matrix4() },
                u_envRadiance: { value: null, type: 't' },
                u_envRadianceMips: { value: 8, type: 'i' },
                u_envRadianceCubeUVTexelWidth: { value: 1 / 768 },
                u_envRadianceCubeUVTexelHeight: { value: 1 / 1024 },
                u_envRadianceCubeUVMaxMip: { value: 8 },
                // TODO we need to figure out how we can set a PMREM here... doing many texture samples is prohibitively expensive
                u_envRadianceSamples: { value: 8, type: 'i' },
                u_envIrradiance: { value: null, type: 't' },
                envMapIntensity: { value: 1.0 },
                u_refractionEnv: { value: true },
                u_refractionTwoSided: { value: false },
                u_numActiveLightSources: { value: 0 },
                u_lightData: { value: [], needsUpdate: false }, // Array of light data. We need to set needsUpdate to false until we actually update it
            });
        this.ready = Promise.all(pendingTextureLoads).then(() => undefined);

        generateMaterialPropertiesForUniforms(this, init.shader.getStage('pixel'));
        generateMaterialPropertiesForUniforms(this, init.shader.getStage('vertex'));


        if (debug || init.debug) {
            // Get lighting and environment data from MaterialX environment
            console.group("[MaterialX]: ", this.name);
            console.log(`Vertex shader length: ${vertexShader.length}\n`, vertexShader);
            console.log(`Fragment shader length: ${fragmentShader.length}\n`, fragmentShader);
            console.groupEnd();
        }
    }

    /** @type {boolean} */
    _missingTangentsWarned = false;

    /**
     * @param {import("three").WebGLRenderer} renderer
     * @param {Scene} _scene
     * @param {Camera} camera
     * @param {BufferGeometry} geometry
     * @param {Object3D} object
     * @param {Group} _group
     */
    onBeforeRender(renderer, _scene, camera, geometry, object, _group) {
        if (this._needsTangents && !geometry.attributes.tangent) {
            if (this.generateTangents) {
                if (!this._pendingTangentGeometries.has(geometry)) {
                    this._pendingTangentGeometries.add(geometry);
                    ensureGeometryTangents(geometry).then(generated => {
                        if (generated) {
                            this.needsUpdate = true;
                        } else if (!this._missingTangentsWarned) {
                            this._missingTangentsWarned = true;
                            console.warn(`[MaterialX] Tangents are required for this material (${this.name}) but could not be generated for the geometry.`);
                        }
                    }).finally(() => {
                        this._pendingTangentGeometries.delete(geometry);
                    });
                }
            } else if (!this._missingTangentsWarned) {
                this._missingTangentsWarned = true;
                console.warn(`[MaterialX] Tangents are required for this material (${this.name}) but not present in the geometry. Automatic tangent generation is disabled.`);
            }
        }
        const time = this._context?.getTime?.() || getTime();
        const frame = this._context?.getFrame?.() || getFrame();
        const env = MaterialXEnvironment.get(_scene);
        if (env) {
            env.update(frame, _scene, renderer);
            this.updateEnvironmentUniforms(env, _scene);
        }
        this.updateUniforms(renderer, object, camera, time, frame);
    }

    /** @type {number} */
    envMapIntensity = 1.0; // Default intensity for environment map
    /** @type {Texture | null} */
    envMap = null; // Environment map texture, can be set externally
    /** @type {Euler} */
    envMapRotation = new Euler();
    /** @type {"three-pmrem" | "materialx-prefiltered" | "materialx-fis"} */
    environmentRadianceMode = DEFAULT_ENVIRONMENT_RADIANCE_MODE;
    /** @type {boolean} */
    specularAntialiasing = true;
    /** @type {boolean} */
    generateTangents = true;

    /**
     * @param {import("three").WebGLRenderer} _renderer
     * @param {Object3D} object
     * @param {Camera} camera
     * @param {number} [time]
     * @param {number} [frame]
     */
    updateUniforms = (_renderer, object, camera, time, frame) => {

        // window.showBalloonMessage(`Updating MaterialX uniforms for ${object.name} at frame ${frame}`);

        const uniforms = this.uniforms;

        // Update standard transformation matrices
        if (uniforms.u_worldMatrix) {
            uniforms.u_worldMatrix.value.copy(object.matrixWorld);
            // @ts-ignore
            uniforms.u_worldMatrix.needsUpdate = true;
        }

        if (uniforms.u_worldInverseMatrix) {
            uniforms.u_worldInverseMatrix.value.copy(worldInverseMat.copy(object.matrixWorld).invert());
            // @ts-ignore
            uniforms.u_worldInverseMatrix.needsUpdate = true;
        }

        if (uniforms.u_worldTransposeMatrix) {
            uniforms.u_worldTransposeMatrix.value.copy(worldTransposeMat.copy(object.matrixWorld).transpose());
            // @ts-ignore
            uniforms.u_worldTransposeMatrix.needsUpdate = true;
        }

        // Update view position
        if (uniforms.u_viewPosition) {
            uniforms.u_viewPosition.value.setFromMatrixPosition(camera.matrixWorld);
            // @ts-ignore
            uniforms.u_viewPosition.needsUpdate = true;
        }

        if (uniforms.u_viewProjectionMatrix) {
            uniforms.u_viewProjectionMatrix.value.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
            // @ts-ignore
            uniforms.u_viewProjectionMatrix.needsUpdate = true;
        }

        if (uniforms.u_worldViewMatrix) {
            uniforms.u_worldViewMatrix.value.copy(worldViewMat.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld));
            // @ts-ignore
            uniforms.u_worldViewMatrix.needsUpdate = true;
        }

        if (uniforms.u_worldViewProjectionMatrix) {
            worldViewMat.multiplyMatrices(camera.matrixWorldInverse, object.matrixWorld);
            uniforms.u_worldViewProjectionMatrix.value.copy(worldViewProjectionMat.multiplyMatrices(camera.projectionMatrix, worldViewMat));
            // @ts-ignore
            uniforms.u_worldViewProjectionMatrix.needsUpdate = true;
        }

        if (uniforms.u_worldInverseTransposeMatrix) {
            uniforms.u_worldInverseTransposeMatrix.value.copy(worldInverseTransposeMat.copy(object.matrixWorld).invert().transpose());
            // @ts-ignore
            uniforms.u_worldInverseTransposeMatrix.needsUpdate = true;
        }

        // if (uniforms.u_shadowMap) {
        //     const light = environment.lights?.[2] || null;
        //     uniforms.u_shadowMatrix.value = light?.shadow?.matrix.clone().premultiply(object.matrixWorld.clone()).invert();
        //     uniforms.u_shadowMap.value = light.shadow?.map || null;
        //     uniforms.u_shadowMap.needsUpdate = true;
        //     console.log("[MaterialX] Renderer shadow map updated", light);
        // }

        // Update time uniforms
        if (uniforms.u_time) {
            if (time === undefined) time = getTime();
            uniforms.u_time.value = time;
        }
        if (uniforms.u_frame) {
            if (frame === undefined) frame = getFrame();
            uniforms.u_frame.value = frame;
        }

        this.uniformsNeedUpdate = true;
    }

    /**
     * @private
    * @param {MaterialXEnvironment} environment
    * @param {Scene} scene
     */
    updateEnvironmentUniforms = (environment, scene) => {

        const uniforms = this.uniforms;

        // Get lighting data from environment
        const lightData = environment.lightData || null;
        const lightCount = environment.lightCount || 0;
        const textures = environment.getTextures(this) || null;

        // Update light count
        if (uniforms.u_numActiveLightSources && lightCount >= 0) {
            uniforms.u_numActiveLightSources.value = lightCount;
        }

        // Update light data
        if (lightData?.length) {
            uniforms.u_lightData.value = lightData;
            if ("needsUpdate" in uniforms.u_lightData && uniforms.u_lightData.needsUpdate === false) {
                if (debug) console.debug(`[MaterialX] LightData assigned (${this.name}, ${this.uuid})`, lightData);
                uniforms.u_lightData.needsUpdate = undefined;
            }
        }

        // Update environment uniforms
        if (uniforms.u_envRadiance) {
            const prev = uniforms.u_envRadiance.value;
            uniforms.u_envRadiance.value = textures.radianceTexture;
            // @ts-ignore
            if (prev != textures.radianceTexture) uniforms.u_envRadiance.needsUpdate = true;
        }
        if (uniforms.u_envRadianceMips) {
            const radianceWidth = textures.radianceTexture?.source.data.width ?? textures.radianceTexture?.image?.width ?? 0;
            const radianceHeight = textures.radianceTexture?.source.data.height ?? textures.radianceTexture?.image?.height ?? 0;
            const materialXRadianceMips = textures.radianceTexture?.userData?.materialXRadianceMips;
            uniforms.u_envRadianceMips.value = Number.isFinite(materialXRadianceMips)
                ? Math.max(1, Math.trunc(materialXRadianceMips))
                : Math.max(1, Math.trunc(Math.log2(Math.max(radianceWidth, radianceHeight, 1))) + 1);
        }
        if (uniforms.u_envRadianceCubeUVTexelWidth || uniforms.u_envRadianceCubeUVTexelHeight || uniforms.u_envRadianceCubeUVMaxMip) {
            const cubeUVSize = getCubeUVSize(textures.radianceTexture);
            if (uniforms.u_envRadianceCubeUVTexelWidth) uniforms.u_envRadianceCubeUVTexelWidth.value = cubeUVSize.texelWidth;
            if (uniforms.u_envRadianceCubeUVTexelHeight) uniforms.u_envRadianceCubeUVTexelHeight.value = cubeUVSize.texelHeight;
            if (uniforms.u_envRadianceCubeUVMaxMip) uniforms.u_envRadianceCubeUVMaxMip.value = cubeUVSize.maxMip;
        }
        if (uniforms.u_envIrradiance) {
            const prev = uniforms.u_envIrradiance.value;
            uniforms.u_envIrradiance.value = textures.irradianceTexture;
            // @ts-ignore
            if (prev != textures.irradianceTexture) uniforms.u_envIrradiance.needsUpdate = true;
        }
        if (uniforms.u_envMatrix) {
            const rotation = scene.environment && !this.envMap ? scene.environmentRotation : this.envMapRotation;
            const texture = scene.environment && !this.envMap ? scene.environment : this.envMap;
            envRotation.copy(rotation);
            // Match Three.js WebGLMaterials: environment rotations are applied in
            // the shader after converting from Three's left-handed env frame.
            envRotation.x *= -1;
            envRotation.y *= -1;
            envRotation.z *= -1;
            if (texture?.isCubeTexture && texture.isRenderTargetTexture === false) {
                envRotation.y *= -1;
                envRotation.z *= -1;
            }
            uniforms.u_envMatrix.value.copy(envMat.makeRotationFromEuler(envRotation));
            // @ts-ignore
            uniforms.u_envMatrix.needsUpdate = true;
        }

        // Sync environment intensity: combine per-material envMapIntensity with scene.environmentIntensity
        // (mirrors MeshStandardMaterial behaviour in Three.js)
        if (uniforms.envMapIntensity) {
            uniforms.envMapIntensity.value = (this.envMapIntensity ?? 1.0) * (scene.environmentIntensity ?? 1.0);
        }

        // Note: Shadow uniforms are handled by Three.js when lights: true is set

        this.uniformsNeedUpdate = true;
    }
}

/**
 * MaterialX's "prefiltered" GLSL target expects a latlong texture with roughness
 * in mip levels. Three.js already stores the scene environment as a prefiltered
 * CubeUV PMREM, so sample that texture directly and translate MaterialX's lod
 * back to the alpha/roughness value that produced it.
 * @param {string} fragmentShader
 * @returns {string}
 */
function patchPrefilteredEnvironmentLookup(fragmentShader) {
    if (!fragmentShader.includes('mx_latlong_alpha_to_lod') || !fragmentShader.includes('mx_latlong_map_lookup')) {
        return fragmentShader;
    }

    const uniforms = `
uniform float u_envRadianceCubeUVTexelWidth;
uniform float u_envRadianceCubeUVTexelHeight;
uniform float u_envRadianceCubeUVMaxMip;
`;
    fragmentShader = fragmentShader.replace(/(uniform\s+sampler2D\s+u_envRadiance;\s*)/, `$1${uniforms}`);
    fragmentShader = fragmentShader.replace(
        /(vec3 mx_latlong_map_lookup\(vec3 dir, mat4 transform, float lod, sampler2D tex_sampler\)\s*\{[\s\S]*?\n\})/,
        `$1

${CUBE_UV_REFLECTION_FUNCTIONS}
float mx_materialx_lod_to_alpha(float lod)
{
    float lodBias = lod / max(float(u_envRadianceMips - 1), 1.0);
    return (lodBias < 0.5) ? lodBias * lodBias : 2.0 * (lodBias - 0.375);
}

vec3 mx_cubeuv_map_lookup(vec3 dir, mat4 transform, float lod, sampler2D tex_sampler)
{
    vec3 envDir = normalize((transform * vec4(dir, 0.0)).xyz);
    float roughness = sqrt(clamp(mx_materialx_lod_to_alpha(lod), 0.0, 1.0));
    return mx_cubeuv_texture(tex_sampler, envDir, roughness).rgb;
}

vec3 mx_cubeuv_irradiance_map_lookup(vec3 dir, mat4 transform, float lod, sampler2D tex_sampler)
{
    vec3 envDir = normalize((transform * vec4(dir, 0.0)).xyz);
    return mx_cubeuv_texture(u_envRadiance, envDir, 1.0).rgb;
}`
    );
    fragmentShader = replaceCubeUVLatlongLookups(fragmentShader);
    return fragmentShader;
}

/**
 * Three.js avoids sharp IBL aliasing on smooth glossy silhouettes by applying a
 * minimum environment roughness and derivative-based geometry roughness before
 * sampling the prefiltered environment. MaterialX receives squared roughness
 * (alpha) at this point, so convert to roughness, apply the same adjustment,
 * and square it again for the stock MaterialX environment code.
 * @param {string} fragmentShader
 * @returns {string}
 */
function patchEnvironmentSpecularAntialiasing(fragmentShader) {
    if (fragmentShader.includes('mx_three_antialias_specular_alpha')) {
        return fragmentShader;
    }

    const helper = `vec2 mx_three_antialias_specular_alpha(vec3 N, vec2 alpha)
{
    vec3 normal = normalize(N);
    vec3 dxy = max(abs(dFdx(normal)), abs(dFdy(normal)));
    float geometryRoughness = max(max(dxy.x, dxy.y), dxy.z);
    vec2 roughness = sqrt(clamp(alpha, vec2(0.0), vec2(1.0)));
    roughness = min(vec2(1.0), max(roughness, vec2(0.0525)) + vec2(geometryRoughness));
    return roughness * roughness;
}

`;

    const patched = fragmentShader.replace(
        /\bvec2\s+safeAlpha\s*=\s*clamp\(roughness,\s*M_FLOAT_EPS,\s*1\.0\);/g,
        'vec2 safeAlpha = mx_three_antialias_specular_alpha(N, clamp(roughness, M_FLOAT_EPS, 1.0));'
    );
    if (patched === fragmentShader) {
        return fragmentShader;
    }

    const precisionMatch = patched.match(/precision\s+\w+\s+float;\s*/);
    if (!precisionMatch || precisionMatch.index === undefined) {
        return helper + patched;
    }

    const insertAt = precisionMatch.index + precisionMatch[0].length;
    return patched.slice(0, insertAt) + '\n' + helper + patched.slice(insertAt);
}

/**
 * In direct mode both specular radiance and diffuse irradiance should sample the
 * same Three.js CubeUV PMREM. Radiance uses MaterialX's requested lod; irradiance
 * samples the fully-blurred roughness-1 level, matching Three.js IBL behavior.
 * @param {string} source
 * @returns {string}
 */
function replaceCubeUVLatlongLookups(source) {
    const needle = 'mx_latlong_map_lookup(';
    let result = '';
    let offset = 0;

    while (offset < source.length) {
        const start = source.indexOf(needle, offset);
        if (start === -1) {
            result += source.slice(offset);
            break;
        }

        const argsStart = start + needle.length;
        const end = findMatchingParen(source, argsStart - 1);
        if (end === -1) {
            result += source.slice(offset);
            break;
        }

        const args = splitTopLevelArguments(source.slice(argsStart, end));
        const samplerName = args.at(-1)?.trim();
        let functionName = 'mx_latlong_map_lookup';
        if (samplerName === 'u_envRadiance') {
            functionName = 'mx_cubeuv_map_lookup';
        } else if (samplerName === 'u_envIrradiance') {
            functionName = 'mx_cubeuv_irradiance_map_lookup';
        }

        result += source.slice(offset, start) + functionName + source.slice(start + 'mx_latlong_map_lookup'.length, end + 1);
        offset = end + 1;
    }

    return result;
}

/**
 * @param {string} source
 * @param {number} openParenIndex
 * @returns {number}
 */
function findMatchingParen(source, openParenIndex) {
    let depth = 0;
    for (let i = openParenIndex; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        else if (char === ')') {
            depth--;
            if (depth === 0) return i;
        }
    }
    return -1;
}

/**
 * @param {string} source
 * @returns {string[]}
 */
function splitTopLevelArguments(source) {
    const args = [];
    let depth = 0;
    let start = 0;
    for (let i = 0; i < source.length; i++) {
        const char = source[i];
        if (char === '(') depth++;
        else if (char === ')') depth--;
        else if (char === ',' && depth === 0) {
            args.push(source.slice(start, i));
            start = i + 1;
        }
    }
    args.push(source.slice(start));
    return args;
}

/**
 * @param {Texture | null | undefined} texture
 */
function getCubeUVSize(texture) {
    const imageHeight = texture?.image?.height ?? texture?.source?.data?.height ?? 1024;
    const maxMip = Math.max(0, Math.log2(imageHeight) - 2);
    return {
        maxMip,
        texelHeight: 1 / imageHeight,
        texelWidth: 1 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)),
    };
}

/**
 * @param {unknown} value
 * @returns {"three-pmrem" | "materialx-prefiltered" | "materialx-fis"}
 */
function normalizeEnvironmentRadianceMode(value) {
    if (value === "materialx-fis") return "materialx-fis";
    return value === "materialx-prefiltered" ? "materialx-prefiltered" : DEFAULT_ENVIRONMENT_RADIANCE_MODE;
}
