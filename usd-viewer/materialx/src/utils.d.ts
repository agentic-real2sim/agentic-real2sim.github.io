/**
 * Get URL parameter value
 */
export function getParam(name: string): boolean | string;

export const debug: boolean | string;
export const debugUpdate: boolean;

/**
 * Get current time in seconds
 */
export function getTime(): number;

/**
 * Get current frame number
 */
export function getFrame(): number;


export function waitForNetworkIdle(): Promise<void>;

export function isDevEnvironment(): boolean;