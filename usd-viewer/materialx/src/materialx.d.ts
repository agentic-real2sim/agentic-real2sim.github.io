import { Light, Scene, Texture, WebGLRenderer } from "three";
import type { MaterialX as MX } from "./materialx.types.js";

/**
 * Override the base URL for MaterialX WASM files.
 * Set this global **before** any MaterialX code runs to load WASM from a custom location.
 * 
 * Special values:
 * - `"package"`: Use local files bundled with the npm package
 * - `"/custom/path/"`: Use a custom base URL (must end with `/`)
 * - `undefined`: Use default CDN
 * 
 * @default `https://cdn.needle.tools/static/materialx/<version>/`
 * @example
 * ```js
 * // Use package-local files (same as "bin/")
 * globalThis.NEEDLE_MATERIALX_LOCATION = "package";
 * 
 * // Use custom CDN or self-hosted files
 * globalThis.NEEDLE_MATERIALX_LOCATION = "/assets/materialx/";
 * ```
 */
declare global {
    var NEEDLE_MATERIALX_LOCATION: string | undefined;
}

export function preloadWasm(trigger: "immediately" | "network_idle"): Promise<void>;

export type MaterialXContext = {
    getTime?(): number;
    getFrame?(): number;
}

type EnvironmentTextureSet = {
    radianceTexture: Texture | null;
    irradianceTexture: Texture | null;
    dispose?: () => void;
}

export declare const state: {
    materialXModule: MX.MODULE | null;
    materialXGenerator: MX.MODULE["HwShaderGenerator"] | null;
    materialXGenContext: MX.GenContext | null;
    materialXStdLib: MX.StandardLibrary | null;
    materialXInitPromise: Promise<void> | null;
};

/** 
 * Wait for the MaterialX WASM module to be ready.
 */
export declare function ready(): Promise<void>;

/**
 * MaterialXEnvironment manages the environment settings for MaterialX materials.
 */
export declare class MaterialXEnvironment {
    static get(scene: Scene): MaterialXEnvironment | null;
    private static _environments: WeakMap<Scene, MaterialXEnvironment>;
    private static getEnvironment(scene: Scene): MaterialXEnvironment;

    private _lights: Array<Light>;
    private _lightData: any[] | null;
    private _lightCount: number;
    private _initializePromise: Promise<boolean> | null;
    private _isInitialized: boolean;
    private _lastUpdateFrame: number;
    private _scene: Scene;

    constructor(_scene: Scene);

    initialize(renderer: WebGLRenderer): Promise<boolean>;
    update(frame: number, scene: Scene, renderer: WebGLRenderer): void;
    reset(): void;
    /**
     * Re-collect lights from the scene and rebuild light data.
     * Call this after adding/removing lights, toggling visibility, or changing light properties.
     */
    refreshLights(): void;

    get lights(): Array<Light>;
    get lightData(): any[] | null;
    get lightCount(): number;
    getTextures(material: any): EnvironmentTextureSet;

    private _pmremGenerator: any | null;
    private _renderer: WebGLRenderer | null;
    private _texturesCache: Map<Texture | null, Map<string, EnvironmentTextureSet>>;
    private _initialize(renderer: WebGLRenderer): Promise<boolean>;
    private _getTextures(texture: Texture | null | undefined, radianceMode?: MaterialXEnvironmentRadianceMode): EnvironmentTextureSet;
    private _getPMREMGenerator(): any;
    private updateLighting(collectLights?: boolean): void;
}

export type MaterialXEnvironmentRadianceMode = "three-pmrem" | "materialx-prefiltered" | "materialx-fis";
