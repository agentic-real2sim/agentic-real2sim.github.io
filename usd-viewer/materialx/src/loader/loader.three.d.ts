import { Material, MaterialParameters } from "three";
import { GLTFLoader, GLTFLoaderPlugin, GLTFParser } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MaterialXContext } from "../materialx.js";
import type { MaterialXEnvironmentRadianceMode } from "../materialx.js";
import { MaterialXMaterial } from "../materialx.material.js";
import { Callbacks } from "../materialx.helper.js";

export interface MaterialX_root_document {
    /** e.g. 1.39 */
    version: string;
    /** e.g. "Material" */
    name: string;
    /** MaterialX xml content */
    mtlx: string;
    /** MaterialX texture pointers */
    textures: Array<{ name: string, pointer: string }>;
    shaders?: Array<{
        /** The materialx node name */
        name: string;
        /** The original name of the shader */
        originalName: string;
    }>;
}

export interface MaterialX_root_extension {
    documents: Array<MaterialX_root_document>;
}

export interface MaterialX_material_extension {
    /** The MaterialX material name */
    name: string;
    /** The index of the document in the documents array of the root extension. */
    document?: number;
    /** The index of the shader in the shaders array of the root extension. */
    shader?: number;
}

export interface MaterialXLoaderOptions {
    /** The URL of the GLTF file being loaded */
    cacheKey?: string;
    /** Parameters for the MaterialX loader */
    parameters?: Pick<MaterialParameters, "precision">;
    /** Environment radiance backend. Defaults to direct Three.js CubeUV PMREM sampling. */
    environmentRadianceMode?: MaterialXEnvironmentRadianceMode;
    /** Match Three.js glossy specular antialiasing. Defaults to true. */
    specularAntialiasing?: boolean;
    /** Generate missing MikkTSpace tangents for tangent-dependent shaders. Defaults to true. */
    generateTangents?: boolean;
    /** Base path used to resolve relative MaterialX texture filenames for raw .mtlx material creation. */
    path?: string;
    /** Flip texcoord V at the MaterialX texcoord node output. Defaults to false for standalone .mtlx creation and true for GLTFLoader integration. */
    hwTexcoordVerticalFlip?: boolean;
    /** Flip texcoord V inside MaterialX file texture sampling. Defaults to false for standalone .mtlx creation and true for GLTFLoader integration. */
    fileTextureVerticalFlip?: boolean;
}

export declare class MaterialXLoader implements GLTFLoaderPlugin {
    readonly name: "NEEDLE_materials_mtlx";
    private readonly _generatedMaterials: MaterialXMaterial[];
    private _documentReadyPromise: Promise<any> | null;
    private parser: GLTFParser;
    private options: MaterialXLoaderOptions;
    private context: MaterialXContext;

    get materialX_root_data(): MaterialX_root_extension | null;
    get materials(): MaterialXMaterial[];

    constructor(
        parser: GLTFParser,
        options: MaterialXLoaderOptions,
        context: MaterialXContext
    );

    loadMaterial(materialIndex: number): Promise<Material> | null;
    private _loadMaterialAsync(materialIndex: number): Promise<Material>;
}

export declare function useNeedleMaterialX(
    loader: GLTFLoader, 
    options?: MaterialXLoaderOptions, 
    context?: MaterialXContext
): void;

export declare function createMaterialXMaterial(
    mtlx: string, 
    materialNodeName: string | number, 
    loaders?: Callbacks,
    options?: MaterialXLoaderOptions, 
    context?: MaterialXContext
): Promise<Material>;
