'use client';

import dynamic from 'next/dynamic';

const R3FCanvas = dynamic(() => import('./R3FCanvas'), { ssr: false });

export default function Viewer3D() {
  return <R3FCanvas />;
}
