import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { SIZE, CELL_SIZE, BOARD_BOUNDS, CENTER_OFFSET } from '../types';
import type { Piece } from '../types';
// Load the default fallback contents of the chess.obj file
import { CHESS_OBJ_FILE_CONTENTS } from './chessObjFileContents';

const WHITE_COLOR = new THREE.Color(0xe0e0e0);
const BLACK_COLOR = new THREE.Color(0x1a1a1a);
const GRID_COLOR = 0x3b82f6;
const GRID_OPACITY = 0.4;

export async function loadAssets(
    customObjContent: string | undefined, 
    pieceNameMapping: Record<Piece['type'], string>
): Promise<Record<string, THREE.Object3D>> {
    const loader = new OBJLoader();
    const pieceModels: Record<string, THREE.Object3D> = {};

    const createModel = (objString: string, name: string) => {
        const model = loader.parse(objString);
        model.name = name;
        model.traverse((child) => {
            if (child instanceof THREE.Mesh) {
                child.geometry.computeVertexNormals();
            }
        });
        // Center and normalize model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 0) { // Avoid division by zero for empty models
            model.scale.multiplyScalar(1.0 / maxDim);
            model.position.sub(center.multiplyScalar(1.0 / maxDim));
        }
        model.scale.set(1.5,1.5,1.5); // Adjust base scale
        return model;
    };
    
    const objDataToParse = customObjContent || CHESS_OBJ_FILE_CONTENTS;
    
    // --- New, More Robust Parser using Regex Split ---
    const objectChunkMap = new Map<string, string>();
    // Use a positive lookahead regex to split the string by lines starting with 'o '
    // while keeping the delimiter. The 'm' flag is for multiline mode.
    const chunks = objDataToParse.split(/(?=^o )/m);

    for (const chunk of chunks) {
        const trimmedChunk = chunk.trim();
        if (!trimmedChunk) continue;

        // Extract the first line to find the object name
        const firstLineEnd = trimmedChunk.indexOf('\n');
        const firstLine = firstLineEnd === -1 ? trimmedChunk : trimmedChunk.substring(0, firstLineEnd);
        
        const match = firstLine.match(/^o\s*(.*)/);

        if (match && match[1]) {
            const objectName = match[1].trim();
            if (objectName) {
                objectChunkMap.set(objectName.toLowerCase(), trimmedChunk);
            }
        }
    }
    // --- End of New Parser ---

    let loadedPieceTypes = new Set<Piece['type']>();

    // Use the AI-provided mapping to find and build each piece model
    for (const pieceType in pieceNameMapping) {
        const objectName = pieceNameMapping[pieceType as Piece['type']];
        // Look up using the same case-insensitive logic
        const objString = objectChunkMap.get(objectName.toLowerCase());

        if (objString) {
            pieceModels[pieceType] = createModel(objString, objectName);
            loadedPieceTypes.add(pieceType as Piece['type']);
        }
    }
    
    if (loadedPieceTypes.size < 6) {
        throw new Error(`The provided .obj file is missing one or more required piece types after AI analysis. Found: [${[...loadedPieceTypes].join(', ')}]. Required: P, R, N, B, Q, K.`);
    }

    return pieceModels;
}

export function getCellWorldPosition(x: number, y: number, z: number): THREE.Vector3 {
    return new THREE.Vector3(
        x * CELL_SIZE - CENTER_OFFSET,
        z * CELL_SIZE - CENTER_OFFSET + CELL_SIZE, 
        y * CELL_SIZE - CENTER_OFFSET
    );
}

export function createPieceMesh(pieceData: Piece, pieceModels: Record<string, THREE.Object3D>): THREE.Object3D {
    const model = pieceModels[pieceData.type];
    if (!model) {
        console.error(`Model for piece type ${pieceData.type} not found!`);
        return new THREE.Group();
    }

    const pieceGroup = model.clone();
    const color = pieceData.color === 'white' ? WHITE_COLOR : BLACK_COLOR;
    const material = new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.4 });

    pieceGroup.traverse((child) => {
        if (child instanceof THREE.Mesh) {
            child.material = material;
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });

    const worldPos = getCellWorldPosition(pieceData.x, pieceData.y, pieceData.z);
    
    const scale = 3.5;
    pieceGroup.scale.multiplyScalar(scale);
    pieceGroup.position.copy(worldPos);
    // This adjustment lowers the piece's center relative to the cell's center,
    // making it sit more firmly on the board layer.
    pieceGroup.position.y -= (CELL_SIZE * 0.1); 

    if (pieceData.type === 'N') {
        pieceGroup.rotation.y = pieceData.color === 'white' ? -Math.PI / 2 : Math.PI / 2;
    }

    pieceGroup.userData = pieceData;
    pieceGroup.name = `piece_${pieceData.x}_${pieceData.y}_${pieceData.z}`;
    
    return pieceGroup;
}

export function create3DBoard(group: THREE.Group) {
    const gridAndPlaneGroup = new THREE.Group();

    const geometry = new THREE.BufferGeometry();
    const positions: number[] = [];
    const addLine = (p1: {x:number, y:number, z:number}, p2: {x:number, y:number, z:number}) => { positions.push(p1.x, p1.y, p1.z, p2.x, p2.y, p2.z); };

    const min = -BOARD_BOUNDS / 2;
    const max = BOARD_BOUNDS / 2;

    for (let i = 0; i <= SIZE; i++) {
        const coord = i * CELL_SIZE + min;
        const zCoord = coord;

        for(let j=0; j<=SIZE; j++) {
             const innerCoord = j * CELL_SIZE + min;
             addLine({ x: innerCoord, y: min, z: zCoord }, { x: innerCoord, y: max, z: zCoord });
             addLine({ x: min, y: innerCoord, z: zCoord }, { x: max, y: innerCoord, z: zCoord });
        }
    }

    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const material = new THREE.LineBasicMaterial({
        color: GRID_COLOR,
        transparent: true,
        opacity: GRID_OPACITY
    });
    const grid = new THREE.LineSegments(geometry, material);

    const planeGeometry = new THREE.PlaneGeometry(BOARD_BOUNDS, BOARD_BOUNDS);
    const planeMaterial = new THREE.MeshLambertMaterial({
        color: 0x475569,
        side: THREE.DoubleSide
    });
    const plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotation.x = -Math.PI / 2;
    plane.position.y = min - 0.01;
    plane.receiveShadow = true;
    
    gridAndPlaneGroup.add(plane);
    gridAndPlaneGroup.add(grid);
    
    group.add(gridAndPlaneGroup);
    gridAndPlaneGroup.position.y += CELL_SIZE;
}