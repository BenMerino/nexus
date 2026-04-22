import React, { useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { MarchingCubes } from 'three-stdlib';
import type { CloudCommunity } from './community-clouds';

const RESOLUTION = 28;
const BALL_MAX_COUNT = 30000;
const ISOLATION = 80;

/** A single community's metaball blob. Each node contributes a 3D Gaussian
 *  to the scalar field; MarchingCubes extracts a smooth isosurface. The
 *  mesh is rescaled every frame to fit the community's bounding box so
 *  positions stay well-distributed in the MC's unit cube. */
export function CloudMetaball({ community }: { community: CloudCommunity }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({
    color: new THREE.Color(community.color),
    transparent: true,
    opacity: community.deemphasis ? 0.25 : community.emphasis ? 0.85 : 0.6,
    roughness: 1.0, metalness: 0.0,
    side: THREE.DoubleSide, depthWrite: true,
  }), [community.color, community.emphasis, community.deemphasis]);

  const cubes = useMemo(() => {
    const mc = new MarchingCubes(RESOLUTION, material, false, false, BALL_MAX_COUNT);
    mc.isolation = ISOLATION;
    return mc;
  }, [material]);

  useFrame(() => {
    const nodes = community.nodes;
    if (nodes.length === 0) { cubes.visible = false; return; }
    cubes.visible = true;

    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
    for (const n of nodes) {
      if (n.x < minX) minX = n.x; if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y; if (n.y > maxY) maxY = n.y;
      if (n.z < minZ) minZ = n.z; if (n.z > maxZ) maxZ = n.z;
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2, cz = (minZ + maxZ) / 2;
    const halfX = Math.max(60, (maxX - minX) / 2 + 60);
    const halfY = Math.max(60, (maxY - minY) / 2 + 60);
    const halfZ = Math.max(60, (maxZ - minZ) / 2 + 50);
    const half = Math.max(halfX, halfY, halfZ);

    cubes.position.set(cx, cy, cz);
    cubes.scale.set(half, half, half);

    cubes.reset();
    const strength = Math.max(0.25, Math.min(0.9, 2.2 / Math.sqrt(nodes.length)));
    for (const n of nodes) {
      const bx = (n.x - cx) / half;
      const by = (n.y - cy) / half;
      const bz = (n.z - cz) / half;
      cubes.addBall(bx * 0.5 + 0.5, by * 0.5 + 0.5, bz * 0.5 + 0.5, strength, 12);
    }
    cubes.update();
  });

  return <primitive object={cubes} />;
}
