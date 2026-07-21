import { WebGLRenderer, WebGLRenderTarget, Texture } from 'three';

export const whiteTexture: Texture;

/**
 * Renders a PMREM environment map to an equirectangular texture with specified roughness
 */
export function renderPMREMToEquirect(
    renderer: WebGLRenderer,
    pmremTexture: Texture,
    roughness?: number,
    width?: number,
    height?: number,
    renderTargetHeight?: number
): WebGLRenderTarget;

/**
 * Renders a PMREM environment map to an equirectangular texture with roughness encoded in mip levels.
 */
export function renderPMREMToPrefilteredEquirect(
    renderer: WebGLRenderer,
    pmremTexture: Texture,
    width?: number,
    height?: number,
    renderTargetHeight?: number
): WebGLRenderTarget;
