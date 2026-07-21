import { Context, GLTF, INeedleGLTFExtensionPlugin } from "@needle-tools/engine";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { GLTFExporter } from "three/examples/jsm/exporters/GLTFExporter.js";
import { MaterialXLoader } from "./loader.three.js";

export declare class MaterialXLoaderPlugin implements INeedleGLTFExtensionPlugin {
    readonly name: "MaterialXLoaderPlugin";
    private loader: MaterialXLoader | null;

    onImport(loader: GLTFLoader, url: string, context: Context): void;
    onLoaded(url: string, gltf: GLTF, _context: Context): void;
    onExport(_exporter: GLTFExporter, _context: Context): void;
}

export declare function useNeedleMaterialX(): Promise<void>;
