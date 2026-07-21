import { Scene, WebGLRenderTarget, PlaneGeometry, OrthographicCamera, ShaderMaterial, RGBAFormat, FloatType, LinearFilter, Mesh, EquirectangularReflectionMapping, RepeatWrapping, LinearMipMapLinearFilter, DataTexture, UnsignedByteType, Vector4 } from 'three';
import { getParam } from './utils.js';

const debug = getParam("debugmaterialx");
const _viewport = new Vector4();

export const whiteTexture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1, RGBAFormat, UnsignedByteType);
whiteTexture.needsUpdate = true;

function toGlslFloat(value) {
    if (!Number.isFinite(value)) return "0.0";
    const result = Number(value).toPrecision(12).replace(/\.?0+($|e)/, "$1");
    return result.includes(".") || result.includes("e") ? result : result + ".0";
}

function getPMREMCubeUVSize(pmremTexture, renderTargetHeight) {
    renderTargetHeight ??= pmremTexture?.userData?.pmremRenderTargetHeight;
    if (Number.isFinite(renderTargetHeight) && renderTargetHeight > 0) {
        const imageHeight = renderTargetHeight;
        const maxMip = Math.max(0, Math.log2(imageHeight) - 2);
        return {
            imageHeight,
            maxMip,
            texelWidth: 1.0 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)),
            texelHeight: 1.0 / imageHeight,
        };
    }
    const imageHeight = pmremTexture.image?.height;
    const resolvedImageHeight = Number.isFinite(imageHeight) && imageHeight > 0 ? imageHeight : 256;
    const maxMip = Math.max(0, Math.log2(resolvedImageHeight) - 2);
    return {
        imageHeight: resolvedImageHeight,
        maxMip,
        texelWidth: 1.0 / (3 * Math.max(Math.pow(2, maxMip), 7 * 16)),
        texelHeight: 1.0 / resolvedImageHeight,
    };
}

function createPrefilteredEquirectMaterial(pmremTexture, cubeUVSize) {
    return new ShaderMaterial({
        defines: {
            USE_ENVMAP: '',
            ENVMAP_TYPE_CUBE_UV: '',
            CUBEUV_TEXEL_WIDTH: toGlslFloat(cubeUVSize.texelWidth),
            CUBEUV_TEXEL_HEIGHT: toGlslFloat(cubeUVSize.texelHeight),
            CUBEUV_MAX_MIP: toGlslFloat(cubeUVSize.maxMip),
        },
        uniforms: {
            envMap: { value: pmremTexture },
            roughness: { value: 0.0 },
        },
        vertexShader: `
            varying vec2 vUv;

            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D envMap;
            uniform float roughness;
            varying vec2 vUv;

            #include <common>
            #include <cube_uv_reflection_fragment>

            vec3 materialXLatlongDirection(vec2 uv) {
                float longitude = (uv.x - 0.5) * (2.0 * PI);
                float latitude = (uv.y - 0.5) * PI;
                float cosLatitude = cos(latitude);

                return vec3(
                    cosLatitude * sin(longitude),
                    -sin(latitude),
                    -cosLatitude * cos(longitude)
                );
            }

            void main() {
                vec3 direction = materialXLatlongDirection(vUv);

                #ifdef ENVMAP_TYPE_CUBE_UV
                    vec4 envColor = textureCubeUV(envMap, direction, roughness);
                #else
                    vec4 envColor = vec4(1.0, 0.0, 1.0, 1.0);
                #endif

                gl_FragColor = vec4(envColor.rgb, 1.0);
            }
        `
    });
}



/**
 * Renders a PMREM environment map to an equirectangular texture with specified roughness
 * @param {import("three").WebGLRenderer} renderer - Three.js WebGL renderer
 * @param {Texture} pmremTexture - PMREM texture (2D CubeUV layout) to convert
 * @param {number} [roughness=0.0] - Roughness value (0.0 to 1.0)
 * @param {number} [width=1024] - Output texture width
 * @param {number} [height=512] - Output texture height
 * @param {number} [renderTargetHeight] - Original render target height (optional, for proper PMREM parameter calculation)
 * @returns {WebGLRenderTarget} Render target containing the equirectangular texture
 * @example 
 * // Creating an equirectangular texture from a PMREM environment map at a certain roughness level:
 * const pmremRenderTarget = pmremGenerator.fromEquirectangular(envMap);
 * const equirectRenderTarget = await renderPMREMToEquirect(renderer, pmremRenderTarget.texture, 0.5, 2048, 1024, pmremRenderTarget.height);
 * 
 * // Use the rendered equirectangular texture
 * const equirectTexture = equirectRenderTarget.texture;
 * 
 * // Apply to your material or save/export
 * someMaterial.map = equirectTexture;
 * 
 * // Don't forget to dispose when done
 * // equirectRenderTarget.dispose();
 */
export function renderPMREMToEquirect(renderer, pmremTexture, roughness = 0.0, width = 1024, height = 512, renderTargetHeight) {
    // TODO Validate inputs
    // console.log(renderer, pmremTexture);

    const cubeUVSize = getPMREMCubeUVSize(pmremTexture, renderTargetHeight);

    // Create render target for equirectangular output
    const renderTarget = new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        type: FloatType,
        minFilter: LinearMipMapLinearFilter,
        magFilter: LinearFilter,
        generateMipmaps: true,
        wrapS: RepeatWrapping,
        anisotropy: renderer.capabilities.getMaxAnisotropy(),
    });
    // Create fullscreen quad geometry and camera
    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);

    // Create shader material for PMREM to equirectangular conversion
    const material = new ShaderMaterial({
        defines: {
            USE_ENVMAP: '',
            ENVMAP_TYPE_CUBE_UV: '',
            CUBEUV_TEXEL_WIDTH: toGlslFloat(cubeUVSize.texelWidth),
            CUBEUV_TEXEL_HEIGHT: toGlslFloat(cubeUVSize.texelHeight),
            CUBEUV_MAX_MIP: toGlslFloat(cubeUVSize.maxMip),
        },
        uniforms: {
            envMap: { value: pmremTexture },
            roughness: { value: roughness }
        },
        vertexShader: `
            varying vec2 vUv;
            
            void main() {
                vUv = uv;
                gl_Position = vec4(position.xy, 0.0, 1.0);
            }
        `,
        fragmentShader: `
            uniform sampler2D envMap;
            uniform float roughness;
            varying vec2 vUv;
            
            #include <common>
            #include <cube_uv_reflection_fragment>
            
            void main() {
                // Use the inverse of MaterialX's mx_latlong_projection().
                // MaterialX samples u_envRadiance through mx_latlong_map_lookup,
                // so this conversion must write the same latlong convention.
                float longitude = (vUv.x - 0.5) * (2.0 * PI);
                float latitude = (vUv.y - 0.5) * PI;
                float cosLatitude = cos(latitude);

                vec3 direction = vec3(
                    cosLatitude * sin(longitude),
                    -sin(latitude),
                    -cosLatitude * cos(longitude)
                );
                
                // Sample the PMREM cube texture using the direction and roughness
                #ifdef ENVMAP_TYPE_CUBE_UV
                    vec4 envColor = textureCubeUV(envMap, direction, roughness);
                #else
                    vec4 envColor = vec4(1.0, 0.0, 1.0, 1.0); // Magenta fallback
                #endif

                gl_FragColor = vec4(envColor.rgb, 1.0);
            }
        `
    });

    // Create temporary scene and mesh for rendering
    const tempScene = new Scene();
    const mesh = new Mesh(geometry, material);
    tempScene.add(mesh);

    // Store current renderer state
    const currentRenderTarget = renderer.getRenderTarget();
    const currentAutoClear = renderer.autoClear;
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowMapEnabled = renderer.shadowMap.enabled;
    const currentViewport = renderer.getViewport(_viewport);

    renderTarget.texture.generateMipmaps = true;

    try {
        // Disable XR and shadow mapping during our render to avoid interference
        renderer.xr.enabled = false;
        renderer.shadowMap.enabled = false;

        // Render to our target
        renderer.autoClear = true;
        renderTarget.viewport.set(0, 0, width, height);
        renderTarget.scissor.set(0, 0, width, height);
        renderer.setRenderTarget(renderTarget);
        renderer.clear(); // Explicitly clear the render target
        renderer.render(tempScene, camera);
    } finally {
        // Restore renderer state completely
        renderer.setRenderTarget(currentRenderTarget);
        renderer.setViewport(currentViewport);
        renderer.autoClear = currentAutoClear;
        renderer.xr.enabled = currentXrEnabled;
        renderer.shadowMap.enabled = currentShadowMapEnabled;

        // Clean up temporary objects
        geometry.dispose();
        material.dispose();
        tempScene.remove(mesh);
    }

    renderTarget.texture.name = 'PMREM_Equirectangular_Texture_' + roughness.toFixed(2);
    renderTarget.texture.mapping = EquirectangularReflectionMapping;

    // Log mipmap infos
    if (debug) console.log('[MaterialX] PMREM to Equirect Render Target:', {
        width: renderTarget.width,
        height: renderTarget.height,
        mipmaps: renderTarget.texture.mipmaps?.length,
        roughness: roughness,
    });

    return renderTarget;
}

/**
 * Renders a Three.js PMREM CubeUV texture to an equirectangular texture whose mip
 * levels encode increasing roughness for MaterialX SPECULAR_ENVIRONMENT_PREFILTER.
 * @param {import("three").WebGLRenderer} renderer
 * @param {Texture} pmremTexture
 * @param {number} [width=2048]
 * @param {number} [height=1024]
 * @param {number} [renderTargetHeight]
 * @returns {WebGLRenderTarget}
 */
export function renderPMREMToPrefilteredEquirect(renderer, pmremTexture, width = 2048, height = 1024, renderTargetHeight) {
    const cubeUVSize = getPMREMCubeUVSize(pmremTexture, renderTargetHeight);
    const mipCount = Math.floor(Math.log2(Math.max(width, height))) + 1;
    const materialXRadianceMipCount = Math.min(8, mipCount);

    const renderTarget = new WebGLRenderTarget(width, height, {
        format: RGBAFormat,
        type: FloatType,
        minFilter: LinearMipMapLinearFilter,
        magFilter: LinearFilter,
        generateMipmaps: false,
        wrapS: RepeatWrapping,
        anisotropy: renderer.capabilities.getMaxAnisotropy(),
    });
    renderTarget.texture.mipmaps = Array.from({ length: mipCount }, (_, mip) => ({
        width: Math.max(1, width >> mip),
        height: Math.max(1, height >> mip),
    }));

    const geometry = new PlaneGeometry(2, 2);
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const material = createPrefilteredEquirectMaterial(pmremTexture, cubeUVSize);

    const tempScene = new Scene();
    const mesh = new Mesh(geometry, material);
    tempScene.add(mesh);

    const currentRenderTarget = renderer.getRenderTarget();
    const currentAutoClear = renderer.autoClear;
    const currentXrEnabled = renderer.xr.enabled;
    const currentShadowMapEnabled = renderer.shadowMap.enabled;
    const currentViewport = renderer.getViewport(_viewport);

    try {
        renderer.xr.enabled = false;
        renderer.shadowMap.enabled = false;
        renderer.autoClear = true;

        for (let mip = 0; mip < mipCount; mip++) {
            const materialXMip = Math.min(mip, materialXRadianceMipCount - 1);
            const lodBias = materialXMip / Math.max(1, materialXRadianceMipCount - 1);
            const alpha = lodBias < 0.5 ? lodBias * lodBias : 2.0 * (lodBias - 0.375);
            const roughness = Math.sqrt(Math.min(1, Math.max(0, alpha)));
            const mipWidth = Math.max(1, width >> mip);
            const mipHeight = Math.max(1, height >> mip);
            material.uniforms.roughness.value = Math.min(1, Math.max(0, roughness));
            renderTarget.viewport.set(0, 0, mipWidth, mipHeight);
            renderTarget.scissor.set(0, 0, mipWidth, mipHeight);
            renderer.setRenderTarget(renderTarget, 0, mip);
            renderer.clear();
            renderer.render(tempScene, camera);
        }
    } finally {
        renderer.setRenderTarget(currentRenderTarget);
        renderer.setViewport(currentViewport);
        renderer.autoClear = currentAutoClear;
        renderer.xr.enabled = currentXrEnabled;
        renderer.shadowMap.enabled = currentShadowMapEnabled;

        geometry.dispose();
        material.dispose();
        tempScene.remove(mesh);
    }

    renderTarget.texture.name = 'PMREM_Prefiltered_Equirectangular_Texture';
    renderTarget.texture.mapping = EquirectangularReflectionMapping;
    renderTarget.texture.generateMipmaps = false;
    renderTarget.texture.userData.materialXRadianceMips = materialXRadianceMipCount;

    if (debug) console.log('[MaterialX] PMREM to prefiltered equirect render target:', {
        width: renderTarget.width,
        height: renderTarget.height,
        mipCount,
    });

    return renderTarget;
}
