import { BufferGeometry, Camera, Euler, Group, IUniform, MaterialParameters, Object3D, Scene, ShaderMaterial, Texture, WebGLRenderer } from "three";
import { MaterialXContext, MaterialXEnvironment } from "./materialx.js";
import type { MaterialXEnvironmentRadianceMode } from "./materialx.js";
import { Callbacks } from "./materialx.helper.js";

declare type MaterialXMaterialInitParameters = {
    name: string;
    shaderName?: string | null;
    shader: any;
    loaders: Callbacks;
    context: MaterialXContext;
    parameters?: MaterialParameters;
    environmentRadianceMode?: MaterialXEnvironmentRadianceMode;
    specularAntialiasing?: boolean;
    generateTangents?: boolean;
    path?: string;
    debug?: boolean;
}

type Uniforms = Record<string, IUniform & { needsUpdate?: boolean }>;
type Precision = "highp" | "mediump" | "lowp";

export declare class MaterialXMaterial extends ShaderMaterial {
    readonly shaderName: string | null;
    readonly ready: Promise<void>;

    copy(source: MaterialXMaterial): this;

    private _context: MaterialXContext | null;
    private _shader: any;
    private _needsTangents: boolean;

    constructor(init?: MaterialXMaterialInitParameters);

    private _missingTangentsWarned: boolean;
    onBeforeRender(renderer: WebGLRenderer, _scene: Scene, camera: Camera, geometry: BufferGeometry, object: Object3D, _group: Group): void;

    envMapIntensity: number;
    envMap: Texture | null;
    envMapRotation: Euler;
    environmentRadianceMode: MaterialXEnvironmentRadianceMode;
    specularAntialiasing: boolean;
    generateTangents: boolean;
    updateUniforms(environment: MaterialXEnvironment, _renderer: WebGLRenderer, object: Object3D, camera: Camera, time?: number, frame?: number): void;

    private updateEnvironmentUniforms(environment: MaterialXEnvironment, scene: Scene): void;
}

export declare const DEFAULT_ENVIRONMENT_RADIANCE_MODE: MaterialXEnvironmentRadianceMode;
