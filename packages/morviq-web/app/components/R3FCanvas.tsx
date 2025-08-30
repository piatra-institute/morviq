'use client';

import { useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Stats } from '@react-three/drei';
import * as THREE from 'three';
import { useViewerStore } from '../store/viewerStore';

function SpinningBox() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const { updateCamera } = useViewerStore();

  useFrame(() => {
    if (meshRef.current) meshRef.current.rotation.y += 0.001;
    const matrix = camera.matrix.toArray();
    updateCamera({ view: matrix, projection: camera.projectionMatrix.toArray() });
  });

  return (
    <mesh ref={meshRef} position={[0, 0, 0]}>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#4a9eff" opacity={0.7} transparent wireframe />
    </mesh>
  );
}

export default function R3FCanvas() {
  return (
    <div style={{ width: '100%', height: '100%' }}>
      <Canvas camera={{ position: [5, 5, 5], fov: 45 }} gl={{ preserveDrawingBuffer: true }}>
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />
        <SpinningBox />
        <Grid args={[10, 10]} cellSize={1} cellThickness={0.5} cellColor="#6f6f6f" sectionSize={5} sectionThickness={1} sectionColor="#9d9d9d" fadeDistance={30} fadeStrength={1} followCamera={false} />
        <OrbitControls enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={0.8} />
        <Stats />
      </Canvas>
    </div>
  );
}

