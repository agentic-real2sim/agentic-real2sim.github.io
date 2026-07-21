// import { BufferGeometry } from 'three';
// import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Get URL parameter value
 * @param {string} name - Parameter name
 * @returns {boolean|string} Parameter value or false if not found
 */
export function getParam(name) {
    const search = globalThis.location?.search ?? globalThis.window?.location?.search;
    if (!search) return false;
    const urlParams = new URLSearchParams(search);
    const param = urlParams.get(name);
    if (param == null || param === "0" || param === "false") return false;
    if (param === "") return true;
    return param;
}

export const debug = getParam("debugmaterialx");
export const debugUpdate = debug === "update";

let time = 0;
/**
 * Get current time in seconds
 * @returns {number} Current time
 */
export function getTime() {
    return time;
}

let frame = 0;
/**
 * Get current frame number
 * @returns {number} Current frame
 */
export function getFrame() {
    return frame;
}

const performanceApi = globalThis.performance
    || globalThis.window?.performance
    || /** @type {any} */ (globalThis.window)?.webkitPerformance
    || /** @type {any} */ (globalThis.window)?.mozPerformance
    || { now: () => Date.now() };

function updateTime() {
    time = performanceApi.now() / 1000; // Convert to seconds
    frame++;
    globalThis.requestAnimationFrame?.(updateTime);
}

globalThis.requestAnimationFrame?.(updateTime);




export async function waitForNetworkIdle() {
    if (typeof globalThis.requestIdleCallback !== "undefined") {
        return new Promise(res => globalThis.requestIdleCallback(res));
    }
    else {
        console.debug("[MaterialX] Can not wait for network idle, using fallback");
        return new Promise(res => setTimeout(res, 100)); // Fallback to a short delay
    }
}


export function isDevEnvironment() {
    // check if we're in localhost or using an ip address
    const hostname = globalThis.location?.hostname ?? globalThis.window?.location?.hostname;
    return hostname === "localhost" || !!hostname && /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname);
}
