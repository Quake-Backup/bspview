
import { extract, TypeMapping } from "./binary";

const HEADER30 = [
    "ENTITIES",
    "PLANES",
    "TEXTURES",
    "VERTICES",
    "VISIBILITY",
    "NODES",
    "TEXINFO",
    "FACES",
    "LIGHTING",
    "CLIPNODES",
    "LEAVES",
    "MARKSURFACES",
    "EDGES",
    "SURFEDGES",
    "MODELS",
    "HEADER_LUMPS"
]

interface Header {
    id: number;
    lumps: { [key: string]: Lump };
}

export interface Lump {
    name: string;
    offset: number;
    size: number;
}

interface Vector3D {
    x: number;
    y: number;
    z: number;
}

interface Face {
    plane: number;
    side: number;
    firstEdge: number;
    edges: number;
    styles: number;
    textureInfo: number;
    lightmapOffset: number;
}

interface Plane {
    x: number;
    y: number;
    z: number;
    dist: number;
    type: number;
}

interface Entity {
    origin?: string;
}

export interface BSP {
    header: Header;
    vertices: Vector3D[];
    edges: number[][];
    planes: Plane[];
    faces: Face[];
    surfEdges: number[];
    entities: Entity[];
}

function parseHeader(buffer: ArrayBuffer) {

    const view = new DataView(buffer);
    let id = view.getUint32(0, true);

    const lumpData: { [key: string]: Lump } = {}

    for (let i = 0; i < HEADER30.length; i++) {
        let lumpType = HEADER30[i];
        const offset = view.getUint32((i * 8) + 4, true);
        const size = view.getUint32((i * 8) + 8, true);
        lumpData[lumpType] = { name: lumpType, offset, size };
    }

    return {
        id,
        lumps: lumpData
    };
}

function extractLump(buffer: ArrayBuffer, lump: Lump, types: (keyof TypeMapping)[]) {
    return extract(new DataView(buffer, lump.offset, lump.size), types);
}

function parseEntities(entityString: string) {
    
    const split = entityString.split("\n");
    const entities: any[] = [];
    let tempObject: {[key: string]: string} = {};

    split.forEach(line => {
        if (line === "{") {
            // new temp object
            tempObject = {};
        }
        else if (line === "}") {``
            // push to entities
            entities.push(tempObject);
        }
        else {
            const data = line.replace(/\"/g, "").split(" ");
            tempObject[data[0]] = data.slice(1).join(" ");
        }
    });

    return entities;
}

export function parseBSP(buffer: ArrayBuffer): BSP {

    const header = parseHeader(buffer);
    const lumps = header.lumps;

    console.table(lumps);

    // Entities is a special case
    const entityLump = lumps["ENTITIES"];
    const entityString = Buffer.from(buffer.slice(entityLump.offset, entityLump.offset + entityLump.size)).toString("ascii");
    const entities = parseEntities(entityString);

    const vertices = extractLump(buffer, lumps["VERTICES"], ["Float32", "Float32", "Float32"]).map(vertex => {
        return {
            x: vertex[0],
            y: vertex[1],
            z: vertex[2]
        }
    });

    const edges = extractLump(buffer, lumps["EDGES"], ["Uint16", "Uint16"]);
    const planes = extractLump(buffer, lumps["PLANES"], ["Float32", "Float32", "Float32", "Float32", "Uint32"]);
    const surfEdges = extractLump(buffer, lumps["SURFEDGES"], ["Int32"]);

    const faces = extractLump(buffer, lumps["FACES"], ["Uint16", "Uint16", "Uint32", "Uint16", "Uint16", "Uint32", "Uint32"]).map(data => {
        return {
            plane: data[0],
            side: data[1],
            firstEdge: data[2],
            edges: data[3],
            textureInfo: data[4],
            styles: data[5],
            lightmapOffset: data[6]
        }
    });

    const bsp: BSP = {
        header,
        vertices,
        edges,
        planes,
        entities,
        faces,
        surfEdges
    };

    return bsp;
}