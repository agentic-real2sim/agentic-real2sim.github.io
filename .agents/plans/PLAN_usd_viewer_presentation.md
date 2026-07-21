# USD Viewer Presentation Plan

## Goal

Improve every bundled USD episode with a tighter matte ground, balanced studio lighting, and soft contact shadows while preserving stage switching, animation, and responsive embedding.

## Requirements

- Keep the five binary USD assets unchanged; apply one presentation override in the three.js viewer.
- Resize `Mesh_ground_id0_geom` geometry once from its authored 10-unit span to 2 units before camera fitting, so the ground no longer makes the subject tiny.
- Override the ground after material resolution with `#344154`, metalness `0`, roughness `0.92`, and environment intensity `0.55`.
- Use the bundled neutral HDR with AgX tone mapping at exposure `0.9`.
- Reduce authored USD light conversion to `0.0018`; add a cool hemisphere fill and warm directional key with PCF filtering and a shadow radius of `4`.
- Aim the key at the non-ground scene bounds and configure a shadow frustum that covers the two-unit stage.
- Reapply only material properties after `materialsReady()`; never rescale geometry twice.
- Preserve arbitrary USD loading when no matching ground mesh exists.

## Implementation

1. Extend `usd-viewer/viewer-config.js` with the tested presentation values for the ground, authored lights, fill, key, background, and shadows.
2. Export `HemisphereLight` and `PCFShadowMap` from `usd-viewer/viewer-runtime-three.js`.
3. Extend `lightingConfig()` in `usd-viewer/viewer-app.js`, create the configured lights, and enable soft shadow rendering.
4. Add a ground-presentation helper that computes the geometry's authored local XY span, scales it once to the target size, applies matte material values, and updates key targeting from non-ground bounds.
5. Pass the configured authored-light scale into `createThreeHydra()`. Apply ground geometry before `fitCameraToSelection()`, then reapply its material asynchronously after `materialsReady()` for the active load generation.

## Validation

- Run JS syntax checks and `git diff --check`.
- Load all five bundled stages through the live viewer and assert: 2-unit ground bounds, expected material values, AgX/exposure, configured fill/key, soft shadows, and a substantially tighter camera distance.
- Capture and inspect desktop and mobile screenshots; exercise in-place episode switching to prove the override is per-stage and not compounded.

No new packages, binary asset edits, unrelated refactors, commit, or push are in scope.
