import * as THREE from 'three';

export interface Callbacks {
    readonly cacheKey?: string;
    readonly getTexture: (path: string) => Promise<THREE.Texture | null | void>;
}

export interface LightData {
    type: number;
    position: THREE.Vector3;
    direction: THREE.Vector3;
    color: THREE.Color;
    intensity: number;
    decay_rate: number;
    inner_angle: number;
    outer_angle: number;
}

export function prepareEnvTexture(texture: THREE.Texture, capabilities?: any): THREE.Texture;

export function getLightRotation(): THREE.Matrix4;

export function findLights(doc: any): Array<any>;

export function getLightTypeIds(): { directional: number, point: number, spot: number };

export function registerLights(mx: any, genContext: any): Promise<void>;

export function getLightData(lights: Array<THREE.Light>, genContext: any): { lightData: LightData[], lightCount: number };

export function getUniformValues(shaderStage: any, loaders?: Callbacks, searchPath?: string): Record<string, THREE.Uniform>;

export function generateMaterialPropertiesForUniforms(material: THREE.ShaderMaterial, shaderStage: any): void;
