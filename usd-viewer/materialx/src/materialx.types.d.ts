


export namespace MaterialX {
    export type Collection<T> = T[] | {
        size(): number;
        get(index: number): T | null | undefined;
    };

    export type AttributeElement = {
        getName?(): string;
        getType?(): string;
        getCategory?(): string;
        getNodeString?(): string;
        getNodeGroup?(): string;
        getValueString?(): string;
        getNodeName?(): string;
        getInterfaceName?(): string;
        getAttribute?(name: string): string | null | undefined;
        hasAttribute?(name: string): boolean;
        getAttributeNames?(): Iterable<string>;
    };

    export type VariableBlock = Collection<{
        getPath?(): string;
        getVariable?(): string;
    }>;

    export type MODULE = {
        ShaderInterfaceType: Record<string, number>;
        HwSpecularEnvironmentMethod: Record<string, number>;
        HwShaderGenerator: {
            bindLightShader(def: NodeDef, id: number, genContext: GenContext): void;
            unbindLightShaders(context: GenContext): void;
        };
        createDocument(): Document;
        readFromXmlString(doc: Document, xml: string, searchPath?: string): void;
        loadStandardLibraries(genContext: GenContext): StandardLibrary;
        isTransparentSurface(renderableElement: Node, target: string): boolean;
        /** Returns the alpha mode for a renderable element: "opaque", "mask", or "blend".
         * Inspects the shader node (and its nodegraph implementation) for alpha_mode inputs. */
        getAlphaMode?(renderableElement: Node, target: string): string;
        /** Extracts a detailed error message from a WASM exception pointer, including error logs. */
        getExceptionDetailedMessage?(exceptionPtr: number): string;
        /** Extracts a basic error message from a WASM exception pointer. */
        getExceptionMessage?(exceptionPtr: number): string;
    }


    export type GenContext = {
    }

    export type StandardLibrary = {
        getNodeDefs?(): Collection<NodeDef>;
        getNodeGraphs?(): Collection<NodeGraph>;
    }
    
    // https://github.com/AcademySoftwareFoundation/MaterialX/blob/b74787db6544283dc32afc8085ebc93cabe937cb/source/MaterialXGenShader/ShaderStage.h#L56
    export type ShaderStage = {
        getUniformBlocks(): Record<string, VariableBlock>;
    }

    export type Document = {
        setDataLibrary(lib: StandardLibrary): void;
        importLibrary(lib: Document): void;
        /** Validates the document and returns validation result with error messages. */
        validate?(): { valid: boolean; message: string };

        getNodes(): Node[];
        getMaterialNodes(): MaterialXNode[];
        getNodeGraphs(): NodeGraph[];
    }

    export type Input = AttributeElement;

    export type Output = AttributeElement;

    export type Node = AttributeElement & {
        getName(): string;
        getType(): string;
        getNodeDef?(): NodeDef | null;
        getNodeDefString?(): string;
        getInputs?(): Collection<Input>;
        getOutputs?(): Collection<Output>;
    }

    export type NodeDef = AttributeElement & {
        getName(): string;
        getNodeString?(): string;
        getActiveInputs?(): Collection<Input>;
        getActiveOutputs?(): Collection<Output>;
    }

    export type NodeGraph = AttributeElement & {
        getName(): string;
        getNodes(): Node[];
        getOutputs?(): Collection<Output>;
        getNodeDefString?(): string;
    }

    export type Matrix = {
        numRows(): number;
        numColumns(): number;
        get size(): number;
        getItem(row: number, col: number): number;
    }

    export type MaterialXNode = Node & {
        getNamePath?: () => string;
    }

    export type MaterilaXNode = MaterialXNode;

}
