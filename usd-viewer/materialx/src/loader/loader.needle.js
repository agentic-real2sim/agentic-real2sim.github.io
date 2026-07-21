import { addCustomExtensionPlugin, Context } from "@needle-tools/engine";
import { useNeedleMaterialX as _useNeedleMaterialX } from "./loader.three.js";
import { debug } from "../utils.js";
import { preloadWasm } from "../materialx.js";

/**
 * @typedef {import("@needle-tools/engine").INeedleGLTFExtensionPlugin} INeedleGLTFExtensionPlugin
 */

/**
 * MaterialX Loader Plugin for Needle Engine
 * @implements {INeedleGLTFExtensionPlugin}
 */
export class MaterialXLoaderPlugin {
    /** @readonly */
    name = "MaterialXLoaderPlugin";

    /** @type {import("./loader.three.d.ts").MaterialXLoader | null} */
    loader = null;

    /**
     * @param {import('three/examples/jsm/loaders/GLTFLoader.js').GLTFLoader} loader
     * @param {string} url
     * @param {Context} context
     */
    onImport = (loader, url, context) => {
        if (debug) console.log("MaterialXLoaderPlugin: Registering MaterialX extension for", url);
        _useNeedleMaterialX(loader, {
            cacheKey: url,
            parameters: {
                precision: /** @type {import('three').MaterialParameters["precision"]} */ (context.renderer.capabilities.getMaxPrecision("highp")),
            }
        }, {
            getTime: () => context.time.time,
            getFrame: () => context.time.frame,
        });
    };

    /**
     * @param {string} url
     * @param {import("@needle-tools/engine").GLTF} gltf
     * @param {Context} _context
     */
    onLoaded = (url, gltf, _context) => {
        if (debug) console.log("[MaterialX] MaterialXLoaderPlugin: glTF loaded", { url, scene: gltf.scene, materialX_root_data: this.loader?.materialX_root_data });
    };

    /**
     * @param {import('three/examples/jsm/exporters/GLTFExporter.js').GLTFExporter} _exporter
     * @param {Context} _context
     */
    onExport = (_exporter, _context) => {
        console.warn("[MaterialX] Export is not supported");
    };
}

/**
 * Add the MaterialXLoaderPlugin to the Needle Engine.
 * @returns {Promise<void>}
 */
export async function useNeedleMaterialX() {
    preloadWasm("network_idle");
    addCustomExtensionPlugin(new MaterialXLoaderPlugin());
}
