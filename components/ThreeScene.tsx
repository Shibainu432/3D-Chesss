
import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import type { Piece, Move, BoardState } from '../types';
import { create3DBoard, createPieceMesh, getCellWorldPosition } from '../lib/threeUtils';
import { CELL_SIZE, SIZE, BOARD_BOUNDS, CENTER_OFFSET } from '../types';

interface ThreeSceneProps {
  boardState: BoardState;
  selectedPiece: Piece | null;
  validMoves: Move[];
  pieceModels: Record<string, THREE.Object3D> | null;
  isLoading: boolean;
  loadingMessage: string;
  hoveredSquare: { x: number; y: number; z: number } | null;
  kingInCheck: 'white' | 'black' | null;
}

const ThreeScene: React.FC<ThreeSceneProps> = ({ boardState, selectedPiece, validMoves, pieceModels, isLoading, loadingMessage, hoveredSquare, kingInCheck }) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const piecesGroupRef = useRef<THREE.Group | null>(null);
  const movesGroupRef = useRef<THREE.Group | null>(null);
  const highlightsGroupRef = useRef<THREE.Group | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  // Effect for one-time scene and renderer setup
  useEffect(() => {
    if (!mountRef.current) return;
    const currentMount = mountRef.current;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x1a202c);
    sceneRef.current = scene;
    
    const camera = new THREE.PerspectiveCamera(75, currentMount.clientWidth / currentMount.clientHeight, 0.1, 1000);
    camera.position.set(70, 70, 70);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    currentMount.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);
    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.0);
    directionalLight.position.set(100, 100, 100);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    const boardGroup = new THREE.Group();
    scene.add(boardGroup);
    create3DBoard(boardGroup);
    
    const piecesGroup = new THREE.Group();
    piecesGroup.name = 'ChessPieces';
    boardGroup.add(piecesGroup);
    piecesGroupRef.current = piecesGroup;

    const movesGroup = new THREE.Group();
    movesGroup.name = 'MoveVisualizations';
    boardGroup.add(movesGroup);
    movesGroupRef.current = movesGroup;

    const highlightsGroup = new THREE.Group();
    highlightsGroup.name = 'Highlights';
    boardGroup.add(highlightsGroup);
    highlightsGroupRef.current = highlightsGroup;
    
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    const onMouseDown = (e: MouseEvent) => { isDragging = true; previousMousePosition = { x: e.clientX, y: e.clientY }; };
    const onMouseUp = () => { isDragging = false; };
    const onMouseMove = (e: MouseEvent) => {
        if (isDragging) {
            const deltaX = e.clientX - previousMousePosition.x;
            const deltaY = e.clientY - previousMousePosition.y;
            boardGroup.rotation.y += deltaX * 0.005;
            boardGroup.rotation.x += deltaY * 0.005;
            previousMousePosition = { x: e.clientX, y: e.clientY };
        }
    };
    const onMouseLeave = () => {
        isDragging = false;
    };
    const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomFactor = 1.05;
        if (e.deltaY > 0) camera.position.multiplyScalar(zoomFactor);
        else camera.position.divideScalar(zoomFactor);
        camera.lookAt(0,0,0);
    };
    
    renderer.domElement.addEventListener('mousedown', onMouseDown);
    renderer.domElement.addEventListener('mouseup', onMouseUp);
    renderer.domElement.addEventListener('mouseleave', onMouseLeave);
    renderer.domElement.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    
    const handleResize = () => {
        if (!currentMount || !cameraRef.current || !rendererRef.current) return;
        camera.aspect = currentMount.clientWidth / currentMount.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(currentMount.clientWidth, currentMount.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    const animate = () => {
      requestAnimationFrame(animate);
      if (sceneRef.current && cameraRef.current) {
        renderer.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('mouseup', onMouseUp);
      renderer.domElement.removeEventListener('mouseleave', onMouseLeave);
      renderer.domElement.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      if (currentMount && renderer.domElement) {
        currentMount.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Sync pieces with boardState
  useEffect(() => {
    if (!pieceModels) return;
    const piecesGroup = piecesGroupRef.current;
    if (!piecesGroup) return;

    while (piecesGroup.children.length) piecesGroup.remove(piecesGroup.children[0]);
    
    boardState.forEach(plane => plane.forEach(row => row.forEach(piece => {
      if (piece) {
        const mesh = createPieceMesh(piece, pieceModels);
        piecesGroup.add(mesh);
      }
    })));
  }, [boardState, pieceModels]);

  // Highlight selected piece and king in check
  useEffect(() => {
    piecesGroupRef.current?.children.forEach(child => {
        const pieceMesh = child as THREE.Group;
        const { x, y, z, type, color } = pieceMesh.userData;

        const isSelected = selectedPiece && x === selectedPiece.x && y === selectedPiece.y && z === selectedPiece.z;
        const isInCheck = type === 'K' && color === kingInCheck;

        let emissiveColor = 0x000000;
        if (isInCheck) {
            emissiveColor = 0xff0000; // Red for check
        } else if (isSelected) {
            emissiveColor = 0x00ff00; // Green for selected
        }
        
        pieceMesh.traverse(subChild => {
            if (subChild instanceof THREE.Mesh && subChild.material instanceof THREE.MeshStandardMaterial) {
                subChild.material.emissive.setHex(emissiveColor);
            }
        });
    });
  }, [selectedPiece, kingInCheck]);

  // Visualize valid moves
  useEffect(() => {
    const movesGroup = movesGroupRef.current;
    if (!movesGroup) return;

    while (movesGroup.children.length) movesGroup.remove(movesGroup.children[0]);

    const moveGeom = new THREE.SphereGeometry(CELL_SIZE * 0.15, 8, 8);
    const captureGeom = new THREE.TorusGeometry(CELL_SIZE * 0.4, CELL_SIZE * 0.05, 8, 16);
    const moveMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.7, depthWrite: false });
    const captureMat = new THREE.MeshBasicMaterial({ color: 0xf87171, transparent: true, opacity: 0.7, depthWrite: false });
    
    validMoves.forEach(move => {
      const worldPos = getCellWorldPosition(move.x, move.y, move.z);
      let mesh;
      if (move.capture) {
        mesh = new THREE.Mesh(captureGeom, captureMat);
        mesh.rotation.x = Math.PI / 2;
      } else {
        mesh = new THREE.Mesh(moveGeom, moveMat);
      }
      mesh.position.copy(worldPos);
      mesh.renderOrder = 1; // Render on top of board grid
      movesGroup.add(mesh);
    });
  }, [validMoves]);

  // Visualize hovered layer and potential moves
  useEffect(() => {
    const highlightsGroup = highlightsGroupRef.current;
    if (!highlightsGroup) return;
    while (highlightsGroup.children.length) highlightsGroup.remove(highlightsGroup.children[0]);

    if (hoveredSquare) {
      // Layer Highlight
      const layerHighlightGeom = new THREE.PlaneGeometry(BOARD_BOUNDS, BOARD_BOUNDS);
      const layerHighlightMat = new THREE.MeshBasicMaterial({
        color: 0x3b82f6,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
      const layerHighlightMesh = new THREE.Mesh(layerHighlightGeom, layerHighlightMat);
      layerHighlightMesh.position.y = hoveredSquare.z * CELL_SIZE - CENTER_OFFSET + CELL_SIZE;
      layerHighlightMesh.rotation.x = Math.PI / 2;
      layerHighlightMesh.renderOrder = 0;
      highlightsGroup.add(layerHighlightMesh);

      // Valid Move Hover Highlight
      const isAValidMove = selectedPiece && validMoves.find(m => m.x === hoveredSquare.x && m.y === hoveredSquare.y && m.z === hoveredSquare.z);
      if (isAValidMove) {
        const moveHighlightGeom = new THREE.BoxGeometry(CELL_SIZE, CELL_SIZE, CELL_SIZE);
        const moveHighlightMat = new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0.25,
          depthWrite: false,
        });
        const moveHighlightMesh = new THREE.Mesh(moveHighlightGeom, moveHighlightMat);
        moveHighlightMesh.position.copy(getCellWorldPosition(hoveredSquare.x, hoveredSquare.y, hoveredSquare.z));
        moveHighlightMesh.renderOrder = 1;
        highlightsGroup.add(moveHighlightMesh);
      }
    }
  }, [hoveredSquare, selectedPiece, validMoves]);

  return (
    <div className="w-full h-full relative">
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-10">
          <p className="text-xl text-white animate-pulse">{loadingMessage}</p>
        </div>
      )}
      <div id="game-container" ref={mountRef} className="w-full h-full" />
    </div>
  );
};

export default ThreeScene;
