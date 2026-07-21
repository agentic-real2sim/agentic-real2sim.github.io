# Changelog
All notable changes to this package will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## [1.7.3] - 2026-07-09

### Fixed
- Three PMREM environment sampling now reads the encoded CubeUV atlas from the base texture level, keeping glossy MaterialX reflections stable for prefiltered KTX2 environments that include hardware mip levels.

## [1.7.2] - 2026-07-06

### Fixed
- MaterialX materials now honor Three.js `InstancedMesh` per-instance transforms in generated vertex shaders, including position, normal, and tangent transforms.
- Raw `.mtlx` material creation can now resolve relative texture filenames through the public `path` option.

## [1.7.1] - 2026-07-01

### Fixed
- Normalized MaterialX texture request paths when combining loader search paths, `fileprefix`, and relative filename values, avoiding duplicate slashes in hosted asset URLs.
- Preserved absolute texture URLs and filename substitution tokens while resolving relative MaterialX texture paths.
- Improved texture path handling for included MaterialX libraries, file prefixes, relative paths, and texture-load diagnostics.

## [1.7.0] - 2026-06-30

### Added
- Runtime environment radiance modes for fast Three.js PMREM sampling, MaterialX prefiltered latlong sampling, and MaterialX filtered importance sampling.
- Browser examples for material library inspection, PMREM comparison, shaderball previews, configurable environments, and graph-driven material loading.
- Missing tangents are now automatically generated for MaterialX materials that require them. Set `generateTangents: false` to disable this.

### Changed
- Rebuilt the bundled MaterialX runtime to 1.39.5.
- Improved texture sampling, alpha-mode render state, environment rotation, and PMREM handling for Three.js integration.

### Fixed
- Removed runtime imports of `three/src`, `UniformsLib` so the package can share the host application's Three.js import map.
- Added the JSON module import attribute for `package.json` so raw browser ESM imports can read the package version without MIME errors.
- Made Node ESM imports browser-global safe and load the bundled MaterialX WASM/data files from the installed package when `ready()` runs under Node.
- Switched bundled MaterialX Emscripten loaders to `node:module` builtin imports for Deno compatibility, and added runtime smoke scripts for Node, Deno, and Bun.
- Corrected material parameter editing for color values, environment controls, and graph-loaded materials in browser examples.
- Improved consistency of example controls and camera behavior across the material library, graph, shadows, and complex scenes.

## [1.6.0] – 2026-04-01

### Added
- UV coordinate convention handling via `hwTexcoordVerticalFlip` — correctly converts between glTF and OpenGL UV conventions at the shader level
- Material-level ambient occlusion for `gltf_pbr` — modulates indirect lighting per the glTF specification
- Visual graph editor for interactive MaterialX authoring

### Changed
- WASM rebuilt (MaterialX 1.39.4, Emscripten 3.1.74)

## [1.5.1] – 2026-03-22

### Fixed
- UV patching: always wrap vec3 targets regardless of source UV declaration type
- Vertex color: wrap vec3→vec4 for color attributes (Three.js provides vec3)
- Shader test page uses proper environment/lighting matching other test pages

### Added
- Playwright e2e tests validating 111+ MaterialX materials for shader compilation

## [1.5.0] – 2026-03-20

### Added
- Vertex displacement support (GLSL and ESSL/WebGL 2)
- Normal recomputation via screen-space derivatives (dFdx/dFdy) for displaced surfaces
- Procedural noise displacement (fractal3d, position, math nodes)
- Texture-based displacement (image node sampling in vertex shader)
- Displacement animation support via Three.js PropertyBinding
- Three.js shadow support for lit MaterialX shaders (directional, spot, point)
- Alpha mode detection via `getAlphaMode` for mask/blend transparency

### Fixed
- Unlit shaders no longer emit shadow uniforms that cause compilation errors
- UV vec2/vec3 patching for displacement vertex shaders
- Skip MaterialX shader closure types (surfaceshader, displacementshader, etc.) in uniform handling

### Changed
- WASM rebuilt with displacement support (MaterialX 1.39.4, Emscripten 3.1.74)
- Environment map intensity now combines per-material and scene intensity

## [1.4.6] – 2026-03-17
- Fix: Compatibility with older Rollup/Vite 4 by replacing `import ... with` syntax

## [1.4.5] – 2026-03-17
- Fix: Improved error log formatting with package version

## [1.4.4] – 2026-03-17
- Fix: Minor type fixes and improved logging

## [1.4.3] – 2026-02-20
- Add: `globalThis.NEEDLE_MATERIALX_LOCATION` to override WASM location. Use `"package"` for package-local files, or a custom path for self-hosted/CDN.

## [1.4.2] – 2026-02-10
- Fix: Improve error handling when MaterialX renderable element is not found

## [1.4.1] – 2026-02-10
- Change: Use CDN as default WASM source

## [1.4.0] – 2026-02-10
- Change: Load WASM binaries from Needle CDN by default instead of bundling locally

## [1.3.4] – 2026-02-09
- Fix: Matrix update for AR sessions

## [1.3.3] – 2026-02-09
- Add: Support for loading `.mtlx` files by index
- Fix: Type fixes in loader

## [1.3.2] - 2025-08-12
- Fix: Error when MaterialX extension is not present

## [1.3.1] - 2025-08-12
- Docs: README improvements

## [1.3.0] - 2025-08-12
- Change: Refactor extension to use a documents array instead of a single document, backwards compatibility is maintained

## [1.2.2] - 2025-07-24
- Add: `preloadWasm` function with support to wait for network idle. This is automatically done for Needle Engine projects.

## [1.2.1] - 2025-07-23
- Fix: Error caused by scene.environment being null

## [1.2.0] - 2025-07-23
- Add: Support to load raw MaterialX materials (from mtlx as XML)
- Fix: Warn if tangents are missing
- Fix: Improve unsupported light handling
- Change: Refactor library to js + jsdoc

## [1.1.0] - 2025-07-15
- Add: `useNeedleMaterialX` hooks for vanilla three.js and Needle Engine

## [1.0.6] - 2025-07-15
- Fix: Texture/environment sampling on some Android devices

## [1.0.3] - 2025-07-10
- Fix: Version bump for npm publish

## [1.0.2] - 2025-07-10
- Add: Material extension `doubleSided` support
- Fix: Improved lighting support
- Fix: Texture loading and glTF texture index resolution

## [1.0.1] - 2025-07-08
- Initial release
