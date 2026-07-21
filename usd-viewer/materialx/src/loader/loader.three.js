import { Material, MeshStandardMaterial, DoubleSide, FrontSide } from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { ready, state } from "../materialx.js";
import { debug } from "../utils.js";
import { MaterialXMaterial } from "../materialx.material.js";
import { VERSION } from "../constants.js";

/**
 * @import { MaterialX_root_extension, MaterialX_material_extension, MaterialXLoaderOptions } from "./loader.three.d.ts"
 */

/**
 * @typedef {Object} MaterialDefinition
 * @property {string} [name] - Optional name for the material
 * @property {boolean} [doubleSided] - Whether the material is double-sided
 * @property {Object<string, any>} [extensions] - Extensions for the material, including MaterialX
 */

/**
 * @typedef {Object} MaterialXMaterialOptions
 * @property {import('three').MaterialParameters} [parameters]
 */

// MaterialX loader extension for js GLTFLoader
export class MaterialXLoader {
    /** @readonly */
    name = "NEEDLE_materials_mtlx";

    /** @type {MaterialXMaterial[]} */
    _generatedMaterials = [];

    /** @type {Promise<any> | null} */
    _documentReadyPromise = null;

    /**
     * @returns {MaterialX_root_extension | null}
     */
    get materialX_root_data() {
        const ext = this.parser.json.extensions?.[this.name];
        if (!ext) {
            return null;
        }
        let result = null;
        if ("documents" in ext && Array.isArray(ext.documents))
            result = ext.documents;
        else
            result = [ext];
        return result;
    }

    /** Generated materialX materials */
    get materials() {
        return this._generatedMaterials;
    }

    /**
     * MaterialXLoader constructor
     * @param {import('three/examples/jsm/loaders/GLTFLoader.js').GLTFParser} parser - The GLTFParser instance
     * @param {MaterialXLoaderOptions} options - The loader options
     * @param {import('../materialx.js').MaterialXContext} context - The context for the GLTF loading process
     */
    constructor(parser, options, context) {
        this.parser = parser;
        this.options = {
            ...options,
            hwTexcoordVerticalFlip: options?.hwTexcoordVerticalFlip ?? true,
            fileTextureVerticalFlip: options?.fileTextureVerticalFlip ?? true,
        };
        this.context = context;

        if (debug) console.log("MaterialXLoader created for parser");
        // Start loading of MaterialX environment if the root extension exists
        if (this.materialX_root_data) {
            ready();
        }
    }

    /**
     * @param {number} materialIndex
     * @returns {Promise<Material> | null}
     */
    loadMaterial(materialIndex) {
        const materialDef = this.parser.json.materials?.[materialIndex];
        if (!materialDef?.extensions?.[this.name]) {
            return null;
        }
        // Wrap the async implementation
        return this._loadMaterialAsync(materialIndex);
    }

    /**
     * @private
     * @param {number} materialIndex
     * @returns {Promise<Material>}
     */
    async _loadMaterialAsync(materialIndex) {

        /** @type {MaterialDefinition} */
        const materialDef = this.parser.json.materials?.[materialIndex];

        // Handle different types of MaterialX data
        /** @type {MaterialX_material_extension} */
        const ext = materialDef.extensions?.[this.name];
        const documentIndex = ext.document || 0;
        const materialX_root_data = this.materialX_root_data?.[documentIndex];
        const mtlx = materialX_root_data.mtlx || null;

        if (debug) console.debug(`[MaterialX] extension found in material[${materialIndex}]:`, materialDef.extensions?.[this.name], "\n→ MTLX root data:", materialX_root_data);

        if (ext && mtlx) {

            /** @type {MaterialXMaterialOptions} */
            const materialOptions = {
                ...this.options,
            }

            if (!materialOptions.parameters) materialOptions.parameters = {};

            if (materialOptions.parameters?.side === undefined && materialDef.doubleSided !== undefined) {
                materialOptions.parameters.side = materialDef.doubleSided ? DoubleSide : FrontSide;
            }

            return createMaterialXMaterial(mtlx, ext.name, {
                cacheKey: this.options.cacheKey || "",
                getTexture: async url => {
                    // Find the index of the texture in the parser
                    const filenameWithoutExt = url.split('/').pop()?.split('.').shift() || '';

                    // Resolve the texture from the MaterialX root extension
                    if (materialX_root_data) {
                        const textures = materialX_root_data.textures || [];
                        let index = -1;
                        for (const texture of textures) {
                            // Find the texture by name and use the pointer string to get the index
                            if (texture.name === filenameWithoutExt) {
                                const ptr = texture.pointer;
                                const indexStr = ptr.substring("/textures/".length);
                                index = parseInt(indexStr);

                                if (isNaN(index) || index < 0) {
                                    console.error("[MaterialX] Invalid texture index in pointer:", ptr);
                                    return;
                                }
                                else {
                                    if (debug) console.log("[MaterialX] Texture index found:", index, "for", filenameWithoutExt);
                                }
                            }
                        }

                        if (index < 0) {
                            console.error("[MaterialX] Texture not found in parser:", filenameWithoutExt, this.parser.json);
                            return;
                        }
                        return this.parser.getDependency("texture", index);
                    }
                    return null;
                }
            }, materialOptions, this.context)
                // Cache and return the generated material
                .then(mat => {
                    if (mat instanceof MaterialXMaterial) this._generatedMaterials.push(mat);
                    return mat;
                })
        }

        // Return fallback material instead of null
        const fallbackMaterial = new MeshStandardMaterial();
        fallbackMaterial.name = "MaterialX_Fallback";
        return fallbackMaterial;
    }
}

/**
 * Add the MaterialXLoader to the GLTFLoader instance.
 * @param {GLTFLoader} loader
 * @param {MaterialXLoaderOptions} [options]
 * @param {import('../materialx.js').MaterialXContext} [context]
 */
export function useNeedleMaterialX(loader, options, context) {
    loader.register(p => {
        const loader = new MaterialXLoader(p, options || {}, context || {});
        return loader;
    });
}

/**
 * Parse the MaterialX document once and cache it
 * @param {string} mtlx
 * @returns {Promise<import("../materialx.types.js").MaterialX.Document>}
 */
async function load(mtlx) {
    // Ensure MaterialX is initialized
    await ready();
    if (!state.materialXModule) {
        throw new Error("[MaterialX] module failed to initialize");
    }
    // Create MaterialX document and parse ALL the XML data from root
    const doc = state.materialXModule.createDocument();
    doc.setDataLibrary(state.materialXStdLib);
    // Parse all MaterialX XML strings from the root data
    await state.materialXModule.readFromXmlString(doc, mtlx, "");
    if (debug) console.log("[MaterialX] root document parsed successfully");
    return doc;
}

/**
 * @param {string} mtlx
 * @param {string | number} materialNodeNameOrIndex
 * @param {import('../materialx.helper.js').Callbacks} [loaders]
 * @param {MaterialXLoaderOptions} [options]
 * @param {import('../materialx.js').MaterialXContext} [context]
 * @returns {Promise<Material>}
 */
export async function createMaterialXMaterial(mtlx, materialNodeNameOrIndex, loaders, options, context) {
    try {
        if (debug) console.log(`Creating MaterialX material: ${materialNodeNameOrIndex}`);
        loaders ??= {
            getTexture: async () => null,
        };


        const doc = await load(mtlx);

        if (!state.materialXModule || !state.materialXGenerator || !state.materialXGenContext) {
            console.warn("[MaterialX] WASM module not ready, returning fallback material");
            const fallbackMaterial = new MeshStandardMaterial();
            fallbackMaterial.name = `MaterialX_Fallback_${materialNodeNameOrIndex}`;
            return fallbackMaterial;
        }

        // Find the renderable element following MaterialX example pattern exactly
        let renderableElement = null;
        let foundRenderable = false;

        if (debug) console.log("[MaterialX] document", doc);

        // Search for material nodes first (following the reference pattern)
        const materialNodes = doc.getMaterialNodes();
        if (debug) console.log(`[MaterialX] Found ${materialNodes.length} material nodes in document`, materialNodes);

        // Handle both array and vector-like APIs
        for (let i = 0; i < materialNodes.length; ++i) {
            const materialNode = materialNodes[i];
            if (materialNode) {
                const name = materialNode.getNamePath?.();
                if (debug) console.log(`[MaterialX] Scan material[${i}]: ${name}`);

                // Find the matching material
                if (materialNodes.length === 1 || name == materialNodeNameOrIndex || i === materialNodeNameOrIndex) {
                    materialNodeNameOrIndex = name;
                    renderableElement = materialNode;
                    foundRenderable = true;
                    if (debug) console.log(`[MaterialX] Use material node: '${name}'`);
                    break;
                }
            }
        }

        /*
        // If no material nodes found, search nodeGraphs
        if (!foundRenderable) {
            const nodeGraphs = doc.getNodeGraphs();
            console.log(`Found ${nodeGraphs.length} node graphs in document`);
            const nodeGraphsLength = nodeGraphs.length;
            for (let i = 0; i < nodeGraphsLength; ++i) {
                const nodeGraph = nodeGraphs[i];
                if (nodeGraph) {
                    // Skip any nodegraph that has nodedef or sourceUri
                    if ((nodeGraph as any).hasAttribute('nodedef') || (nodeGraph as any).hasSourceUri()) {
                        continue;
                    }
                    // Skip any nodegraph that is connected to something downstream
                    if ((nodeGraph as any).getDownstreamPorts().length > 0) {
                        continue;
                    }
                    const outputs = (nodeGraph as any).getOutputs();
                    for (let j = 0; j < outputs.length; ++j) {
                        const output = outputs[j];
                        if (output && !foundRenderable) {
                            renderableElement = output;
                            foundRenderable = true;
                            break;
                        }
                    }
                    if (foundRenderable) break;
                }
            }
        }
         
        // If still no element found, search document outputs
        if (!foundRenderable) {
            const outputs = doc.getOutputs();
            console.log(`Found ${outputs.length} output nodes in document`);
            const outputsLength = outputs.length;
            for (let i = 0; i < outputsLength; ++i) {
                const output = outputs[i];
                if (output && !foundRenderable) {
                    renderableElement = output;
                    foundRenderable = true;
                    break;
                }
            }
        }
        */

        if (!renderableElement) {
            if (materialNodes.length <= 0) {
                console.warn(`[MaterialX] No material nodes found in MaterialX document.`);
            }
            else {
                console.warn(`[MaterialX] No renderable element found in MaterialX document (${materialNodeNameOrIndex}) → Please provide a name or index. ${materialNodes.length} options: ${materialNodes.map(n => n.getNamePath()).join(", ")}`);
            }
            const fallbackMaterial = new MeshStandardMaterial();
            fallbackMaterial.color.set(0xff00ff);
            fallbackMaterial.name = `MaterialX_NoRenderable_${materialNodeNameOrIndex}`;
            return fallbackMaterial;
        }

        if (debug) console.log("[MaterialX] Using renderable element for shader generation");

        // Check transparency and alpha mode.
        // getAlphaMode() is the source of truth: it checks both direct gltf_pbr nodes
        // and inner gltf_pbr nodes inside custom shader graph nodegraphs.
        // isTransparentSurface() is a fallback for non-gltf_pbr shaders.
        const target = state.materialXGenerator.getTarget();
        const alphaMode = typeof state.materialXModule.getAlphaMode === "function"
            ? state.materialXModule.getAlphaMode(renderableElement, target)
            : (state.materialXModule.isTransparentSurface(renderableElement, target) ? "blend" : "opaque");
        const isMask = alphaMode === "mask";
        const isBlend = alphaMode === "blend";
        const renderAsTransparent = isBlend;
        // Both MASK and BLEND need alpha handling in the generated shader.
        const needsAlpha = isMask || isBlend;

        // Emscripten's getOptions() returns a temporary wrapper; set all options
        // that matter for generation in one block right before generate().
        {
            const opts = state.materialXGenContext.getOptions();
            // MASK and BLEND need alpha handling in the generated shader.
            opts.hwTransparency = needsAlpha;
            opts.hwTexcoordVerticalFlip = options?.hwTexcoordVerticalFlip ?? false;
            opts.fileTextureVerticalFlip = options?.fileTextureVerticalFlip ?? false;
            opts.hwSpecularEnvironmentMethod = options?.environmentRadianceMode === "materialx-fis"
                ? state.materialXModule.HwSpecularEnvironmentMethod.SPECULAR_ENVIRONMENT_FIS
                : state.materialXModule.HwSpecularEnvironmentMethod.SPECULAR_ENVIRONMENT_PREFILTER;
        }

        // Generate shaders using the element's name path
        if (debug) console.log("[MaterialX] Generating MaterialX shaders...");
        const elementName = renderableElement.getNamePath ? renderableElement.getNamePath() : renderableElement.getName();

        const shader = state.materialXGenerator.generate(elementName, renderableElement, state.materialXGenContext);

        const shaderMaterial = new MaterialXMaterial({
            name: typeof elementName === "string" ? elementName : `MaterialX_${materialNodeNameOrIndex}`,
            shaderName: null, //shaderInfo?.originalName || shaderInfo?.name || null,
            shader,
            context: context || {},
            environmentRadianceMode: options?.environmentRadianceMode,
            specularAntialiasing: options?.specularAntialiasing,
            generateTangents: options?.generateTangents,
            path: options?.path,
            parameters: {
                // MASK uses discard; BLEND uses Three.js transparent sorting and blending.
                transparent: renderAsTransparent,
                // For MASK mode, set alphaTest so Three.js enables alpha testing
                alphaTest: isMask ? 0.0001 : 0,
                ...options?.parameters,
            },
            loaders: loaders,
        });
        await shaderMaterial.ready;

        // Add debugging to see if the material compiles correctly
        if (debug) console.log("[MaterialX]  material created:", shaderMaterial.name);
        return shaderMaterial;

    } catch (error) {
        // WASM exceptions arrive as integer pointers. Extract the detailed error message
        // which includes shader compilation errors, line numbers, and error logs.
        let errorMessage = error;
        if (typeof error === "number" && state?.materialXModule) {
            try {
                const getDetailed = state.materialXModule.getExceptionDetailedMessage;
                const getBasic = state.materialXModule.getExceptionMessage;
                errorMessage = (typeof getDetailed === "function" ? getDetailed(error) : null)
                    || (typeof getBasic === "function" ? getBasic(error) : null)
                    || `WASM exception code ${error}`;
            } catch (_) {
                errorMessage = `WASM exception code ${error}`;
            }
        }
        console.error(`[MaterialX v${VERSION}] Error creating MaterialX material (${materialNodeNameOrIndex}):\n${errorMessage}\n→ MaterialX source:\n`, mtlx);
        // Return a fallback material with stored MaterialX data
        const fallbackMaterial = new MeshStandardMaterial();
        fallbackMaterial.color.set(0xff00ff);
        fallbackMaterial.name = `MaterialX_Error_${materialNodeNameOrIndex}`;
        return fallbackMaterial;
    }
}
