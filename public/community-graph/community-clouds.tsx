import React, { useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { Camera } from './projection';
import { CloudMetaball } from './cloud-metaball';

export interface CloudCommunity {
  key: string;
  color: string;
  nodes: { x: number; y: number; z: number }[];
  emphasis?: boolean;
  deemphasis?: boolean;
}

interface Props {
  communities: CloudCommunity[];
  camera: Camera;
  width: number;
  height: number;
}

/** One metaball cloud per community. WebGL canvas positioned over the SVG
 *  at pointerEvents: none so SVG nodes still catch clicks. */
export function CommunityClouds({ communities, camera, width, height }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, width, height, pointerEvents: 'none', zIndex: 1 }}>
      <Canvas
        orthographic
        dpr={[1, 2]}
        camera={{ near: -4000, far: 4000, zoom: 1 }}
        gl={{ alpha: true, antialias: true }}
      >
        <CameraRig camera={camera} width={width} height={height} />
        <ambientLight intensity={0.9} />
        {communities.map(c => (
          <CloudMetaball key={c.key} community={c} />
        ))}
      </Canvas>
    </div>
  );
}

/** Sync the orthographic Three camera to the graph's (cx, cy, yaw, pitch)
 *  so WebGL content lines up pixel-perfect with the SVG underneath. */
function CameraRig({ camera, width, height }: { camera: Camera; width: number; height: number }) {
  const { camera: three } = useThree();
  useEffect(() => {
    const cam = three as THREE.OrthographicCamera;
    cam.left = -width / 2;
    cam.right = width / 2;
    cam.top = -height / 2;
    cam.bottom = height / 2;
    cam.updateProjectionMatrix();
  }, [three, width, height]);

  useFrame(() => {
    const cam = three as THREE.OrthographicCamera;
    const r = 1000;
    cam.position.set(
      camera.cx + r * Math.sin(camera.yaw) * Math.cos(camera.pitch),
      camera.cy - r * Math.sin(camera.pitch),
      r * Math.cos(camera.yaw) * Math.cos(camera.pitch),
    );
    cam.up.set(0, -1, 0);
    cam.lookAt(camera.cx, camera.cy, 0);
  });

  return null;
}
