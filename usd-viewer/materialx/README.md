# Needle MaterialX – MaterialX Materials for three.js & the Web

Web runtime for [MaterialX](https://materialx.org/) materials in [Needle Engine](https://needle.tools) and [three.js](https://threejs.org/). Renders physically based MaterialX shaders in the browser using WebAssembly — load `.mtlx` files or glTF assets with the `NEEDLE_materials_mtlx` extension (created with Needle Engine's Unity integration and ShaderGraph).

- MaterialX to WebGL shader generation via WASM
- Vertex displacement support (procedural noise, texture-based, animatable)
- Material-level ambient occlusion (per glTF specification)
- UV coordinate convention handling (glTF ↔ OpenGL)
- Three.js `InstancedMesh` support for generated MaterialX shaders
- Automatic MikkTSpace tangent generation when MaterialX shaders need tangents
- Three.js shadow support (directional, spot, point lights)
- Alpha mask and blend transparency modes
- glTF extension for embedding MaterialX materials in `.glb`/`.gltf` files
- Experimental support for loading raw MaterialX XML (`.mtlx`) files
- Works standalone with three.js or as a Needle Engine module

[Learn more in the Needle Engine documentation](https://engine.needle.tools/docs/how-to-guides/export/materialx.html)

[![MaterialX material rendered in the browser with Needle Engine](https://cloud.needle.tools/-/media/Xc99R6zbaD-kpoTw1cMRKA.gif)](https://engine.needle.tools/samples/material-x)


## Installation
`npm i @needle-tools/materialx`  

## Examples
- [three.js Example on Stackblitz](https://stackblitz.com/edit/needle-materialx-example?file=main.js,package.json,index.html)

## How to use

### Use with Needle Engine

**Needle Engine has built in support for MaterialX shaders.**   
No changes to your code are necessary. The MaterialX module will import lazily when needed.

### Use with three.js

```ts
import { useNeedleMaterialX } from "@needle-tools/materialx";
// Call the function with your GLTFLoader instance to add the GLTFLoader plugin
useNeedleMaterialX(<yourGltfLoaderInstance>);
```

### Accessing Materials
MaterialX shaders will create `MaterialXMaterial` materials at runtime. These are custom three.js ShaderMaterials and assigned to objects like any other three.js material.  

[Learn more in the Needle Engine documentation](https://engine.needle.tools/docs/how-to-guides/export/materialx.html)

## Notes

### Anisotropy and environment lighting

The public `environmentRadianceMode` option is a string enum with three modes:

- `three-pmrem` is the default. It samples a prefiltered three.js CubeUV PMREM directly. This is the fast path and is the recommended default for runtime use, but prefiltered environment lookup is scalar-roughness based and does not preserve full anisotropic specular environment reflections. Direct lighting and the rest of the generated MaterialX shader still run normally.
- `materialx-prefiltered` uses MaterialX's stock prefiltered latlong environment shader path. It is useful for parity checks and exported MaterialX-style prefiltered maps, but it is still a prefiltered lookup.
- `materialx-fis` enables MaterialX filtered importance sampling. This path is slower, but it preserves anisotropic specular environment reflections.

For anisotropic specular environment reflection checks, opt into `materialx-fis`:

```ts
import { useNeedleMaterialX } from "@needle-tools/materialx";

useNeedleMaterialX(gltfLoader, {
    environmentRadianceMode: "materialx-fis",
});
```

The same option is available when creating a raw MaterialX material:

```ts
import { Experimental_API } from "@needle-tools/materialx";

const material = await Experimental_API.createMaterialXMaterial(
    mtlxSource,
    0,
    undefined,
    { environmentRadianceMode: "materialx-fis" },
);
```

### Tangents

Some MaterialX shaders need tangent-space data for correct normal, anisotropy, or texture-space lighting. If a geometry is missing tangents, MaterialX materials generate MikkTSpace tangents lazily at render time using Three.js' bundled MikkTSpace utilities.

Automatic tangent generation is enabled by default. To keep the previous warning-only behavior, disable it in the same options object used for other MaterialX settings:

```ts
useNeedleMaterialX(gltfLoader, {
    generateTangents: false,
});
```

For raw MaterialX materials:

```ts
const material = await Experimental_API.createMaterialXMaterial(
    mtlxSource,
    0,
    undefined,
    { generateTangents: false },
);
```

## WASM

### Default (CDN)

By default, MaterialX WASM files are loaded from the Needle CDN at `https://cdn.needle.tools/static/materialx/<version>/`. No configuration needed.

### Custom WASM Location

You can override the WASM location by setting `globalThis.NEEDLE_MATERIALX_LOCATION` **before** MaterialX loads (for example in global scope in a root script).

#### Package-local files

To use the WASM files bundled with the `@needle-tools/materialx` npm package, set the location to one of:

```js
globalThis.NEEDLE_MATERIALX_LOCATION = "package";
// or
globalThis.NEEDLE_MATERIALX_LOCATION = "bin/";
// or
globalThis.NEEDLE_MATERIALX_LOCATION = "./bin/";
// or
globalThis.NEEDLE_MATERIALX_LOCATION = "../bin/";
```

This is useful when you want to avoid network requests or bundle all assets locally.

#### Custom path

To use a custom base URL (for self-hosted deployments, air-gapped environments, or a custom CDN):

```js
globalThis.NEEDLE_MATERIALX_LOCATION = "/assets/materialx/";
```

IMPORTANT: The value must end with a trailing slash (`/`).

### Texture Path Resolution

MaterialX texture filenames are resolved from the MaterialX-authored filename value, any active `fileprefix`, and the loader path. Relative paths are normalized for web requests so hosted asset URLs do not gain duplicate slashes, while absolute URLs such as `https://`, `file://`, root-relative paths, data URIs, blob URLs, and MaterialX filename tokens such as `<UDIM>` are preserved.

For raw `.mtlx` XML loaded from a URL, pass the containing directory as `path`, matching the `parse(data, path, ...)` convention used by Three.js loaders:

```ts
const material = await Experimental_API.createMaterialXMaterial(
    mtlxSource,
    0,
    {
        getTexture: async (url) => textureLoader.loadAsync(url),
    },
    {
        path: "https://example.com/materials/",
    },
);
```


## glTF Extension: NEEDLE_materials_mtlx

There is a root level glTF extension, `NEEDLE_materials_mtlx`, which contains an array of documents. Each document contains a MaterialX xml string, and information about textures and materials used in the document, so they can be resolved from inside the glTF buffers.

The `textures` array is used to resolve texture paths from inside the MaterialX document to texture pointers in the glTF file.

Materials can also contain the `NEEDLE_materials_mtlx` extension, which references a document and shader. This allows you to use the same MaterialX document for multiple materials in the glTF file.

### Root-level extension
```json
{
    "extensions": {
        "NEEDLE_materials_mtlx": {
            "documents": [
                {
                    "name": "Perforated_Metal",
                    "version": "1.38",
                    "xml": "<?xml version='1.0' encoding='UTF-8'?><materialx version=\"1.38\">...</materialx>",
                    "textures": [
                        {
                            "pointer": "/textures/0",
                            "name": "Perforated_Metal_diffuse"
                        },
                        {
                            "pointer": "/textures/1",
                            "name": "Perforated_Metal_normal"
                        }
                    ],
                    "shaders": []  ← optional
                }
            ]
        }
    }
}
```

### Material-level extension
```json
{
    "materials": [
        {
            "name": "Perforated Metal",
            "extensions": {
                "NEEDLE_materials_mtlx": {
                    "name": "Perforated_Metal",
                    "document": 0,
                    "shader": 0
                }
            }
        }
    ]
}
```

<br />

# Contact ✒️
<b>[🌵 Needle](https://needle.tools)</b> • 
[Github](https://github.com/needle-tools) • 
[X](https://x.com/NeedleTools) • 
[Discord](https://discord.needle.tools) • 
[Forum](https://forum.needle.tools) • 
[Youtube](https://www.youtube.com/@needle-tools)
