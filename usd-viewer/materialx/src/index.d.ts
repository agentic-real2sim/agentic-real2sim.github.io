export { ready, type MaterialXContext, type MaterialXEnvironmentRadianceMode, preloadWasm } from "./materialx.js";
export { MaterialXEnvironment } from "./materialx.js";
export { MaterialXMaterial } from "./materialx.material.js";
export { MaterialXLoader } from "./loader/loader.three.js";

import { createMaterialXMaterial } from "./loader/loader.three.js";

declare const Experimental_API: {
    createMaterialXMaterial: typeof createMaterialXMaterial;
};

export { Experimental_API };
