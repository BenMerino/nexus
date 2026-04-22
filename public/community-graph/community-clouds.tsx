import React, { useEffect, useRef } from 'react';
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

/** WebGL metaball clouds for each community. The canvas sits below the SVG
 *  (zIndex 0) and ignores pointer events so the SVG drag rect stays on top. */
export function CommunityClouds({ communities, camera, width, height }: Props) {
  return (
    <div style={{ position: 'absolute', inset: 0, width, height, pointerEvents: 'none', zIndex: 0 }}>
      <Canvas
        orthographic
        dpr={[1, 2]}
        camera={{ near: -4000, far: 4000, zoom: 1 }}
        gl={{ alpha: true, antialias: true }}
        style={{ pointerEvents: 'none', width: '100%', height: '100%' }}
      >
        <CameraSync width={width} height={height} />
        <ambientLight intensity={1} />
        <SceneTransform camera={camera}>
          {communities.map(c => (
            <CloudMetaball key={c.key} community={c} />
          ))}
        </SceneTransform>
      </Canvas>
    </div>
  );
}

/** Orthographic camera covering the pixel box (0..width, 0..height) with
 *  the Y axis flipped by the ortho bounds (top > bottom) so world Y grows
 *  downward exactly like the SVG. Keeps Three's default up=(0,1,0) so the
 *  camera's local X axis agrees with world X (no left/right mirror). */
function CameraSync({ width, height }: { width: number; height: number }) {
  const { camera } = useThree();
  useEffect(() => {
    const cam = camera as THREE.OrthographicCamera;
    cam.left = 0;
    cam.right = width;
    cam.top = 0;
    cam.bottom = height;
    cam.position.set(0, 0, 1000);
    cam.up.set(0, 1, 0);
    cam.lookAt(0, 0, 0);
    cam.updateProjectionMatrix();
  }, [camera, width, height]);
  return null;
}

interface SceneTransformProps { camera: Camera; children: React.ReactNode }

/** Match the SVG projection: translate to (cx, cy, 0), rotate by yaw around
 *  Z then by pitch around X, translate back. Everything Three renders inside
 *  this group lands on the same pixels as the SVG's project(). */
function SceneTransform({ camera, children }: SceneTransformProps) {
  const yawPivot = useRef<THREE.Group>(null);
  const pitchPivot = useRef<THREE.Group>(null);

  useFrame(() => {
    // Match the SVG project(): yaw around Z, pitch around X, applied
    // pitch-outer-yaw-inner so rotating yaw always spins around the
    // scene's vertical axis regardless of tilt.
    if (yawPivot.current) yawPivot.current.rotation.z = camera.yaw;
    if (pitchPivot.current) pitchPivot.current.rotation.x = camera.pitch;
  });

  return (
    <group position={[camera.cx, camera.cy, 0]}>
      <group ref={pitchPivot}>
        <group ref={yawPivot}>
          <group position={[-camera.cx, -camera.cy, 0]}>{children}</group>
        </group>
      </group>
    </group>
  );
}
