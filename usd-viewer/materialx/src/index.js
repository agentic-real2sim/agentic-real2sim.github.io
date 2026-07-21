import { createMaterialXMaterial } from "./loader/loader.three.js";

export { ready, preloadWasm } from "./materialx.js";
export { MaterialXEnvironment } from "./materialx.js";
export { MaterialXMaterial } from "./materialx.material.js";
export { MaterialXLoader } from "./loader/loader.three.js";


/**
 * Experimental API for creating MaterialX materials.
 */
const Experimental_API = {
    createMaterialXMaterial
};

export { Experimental_API };

