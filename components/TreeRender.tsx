import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeData, GrowthStage, TreeSpecies } from '../types';
import { SPECIES_CONFIG, STAGE_CONFIG } from '../constants';

// String hashing function for seeded random behavior from DNA
const cyrb53 = (str: string, seed = 0) => {
  let h1 = 0xdeadbeef ^ seed, h2 = 0x41c6ce57 ^ seed;
  for (let i = 0, ch; i < str.length; i++) {
    ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return 4294967296 * (2097151 & h2) + (h1 >>> 0);
};

// Returns a float between 0 and 1
const getDnaRandom = (dna: string[], depth: number, offset: number) => {
  // Use the specific DNA segment corresponding to the depth/growth stage if available
  // Default to the first segment (seed) if we are deeper than current history
  const segmentIndex = Math.min(Math.floor(depth / 2), dna.length - 1);
  const segment = dna[segmentIndex] || dna[0] || 'DEFAULT';
  const val = cyrb53(segment + depth + offset);
  return (val % 1000) / 1000;
};

// A recursive branch component to generate the tree structure
interface BranchProps {
  position: [number, number, number];
  rotation: [number, number, number];
  length: number;
  radius: number;
  depth: number;
  maxDepth: number;
  species: TreeSpecies;
  pruneState: number; // Random seed for missing branches
  wireState: number; // Influences curvature
  dna: string[];
}

const Branch: React.FC<BranchProps> = ({ 
  position, 
  rotation, 
  length, 
  radius, 
  depth, 
  maxDepth, 
  species,
  pruneState,
  wireState,
  dna
}) => {
  const config = SPECIES_CONFIG[species];
  const isEnd = depth >= maxDepth;
  
  // Use DNA for deterministic structure
  const rndStructure = getDnaRandom(dna, depth, 100);
  const rndAngle = getDnaRandom(dna, depth, 200);
  
  // Pruning logic
  if (depth > 1 && getDnaRandom(dna, depth, 300 + pruneState) > 0.85) {
    return null; 
  }

  // Wiring logic: modify angles
  const curveMod = wireState * 0.2; 

  const nextLength = length * (0.75 + (rndStructure * 0.1)); // DNA affects length decay
  const nextRadius = radius * 0.7;

  // Calculate child branches
  const childCount = isEnd ? 0 : 2; 
  const children = [];

  if (!isEnd) {
    for (let i = 0; i < childCount; i++) {
      // DNA drives the angle variance
      const angleVariance = (rndAngle * 0.6 - 0.3); 
      const angleOffset = (i === 0 ? 0.6 : -0.6) + angleVariance + curveMod;
      
      const rotX = (getDnaRandom(dna, depth + 1, i * 50) * 0.6);
      const rotZ = angleOffset;
      
      children.push(
        <Branch
          key={i}
          position={[0, length, 0]}
          rotation={[rotX, 0, rotZ]}
          length={nextLength}
          radius={nextRadius}
          depth={depth + 1}
          maxDepth={maxDepth}
          species={species}
          pruneState={pruneState}
          wireState={wireState}
          dna={dna}
        />
      );
    }
  }

  // Leaf Color variation based on DNA
  const leafColor = useMemo(() => {
    const baseColor = new THREE.Color(config.colorLeaf);
    const shift = (getDnaRandom(dna, maxDepth, 999) - 0.5) * 0.1;
    return baseColor.offsetHSL(0, 0, shift);
  }, [config.colorLeaf, dna, maxDepth]);

  return (
    <group position={position} rotation={rotation}>
      {/* Wood Segment */}
      <mesh position={[0, length / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[nextRadius, radius, length, 8]} />
        <meshStandardMaterial color={config.colorBark} roughness={0.9} />
      </mesh>

      {/* Foliage at the end of terminal branches */}
      {isEnd && (
        <group position={[0, length, 0]}>
          <mesh scale={[1, 1, 1]} castShadow receiveShadow>
             {/* Using Dodecahedron for low-poly leaf cluster look */}
            <dodecahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial color={leafColor} />
          </mesh>
          <mesh position={[0.3, 0.2, 0]} scale={[0.7, 0.7, 0.7]} castShadow>
            <dodecahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial color={leafColor} />
          </mesh>
           <mesh position={[-0.2, 0.3, 0.2]} scale={[0.8, 0.8, 0.8]} castShadow>
            <dodecahedronGeometry args={[0.4, 0]} />
            <meshStandardMaterial color={leafColor} />
          </mesh>
        </group>
      )}

      {children}
    </group>
  );
};

// --- Custom Seed Component ---
// Visualizes the initial seed based on DNA, stylized as a 2D-viewed-in-3D object (extruded shape)
const SeedObject: React.FC<{ dna: string[], species: TreeSpecies }> = ({ dna, species }) => {
  const seedHash = getDnaRandom(dna, 0, 1);
  const color = SPECIES_CONFIG[species].colorBark;
  
  return (
    <group position={[0, 0.1, 0]}>
      {/* Seed Body */}
      <mesh castShadow receiveShadow position={[0, 0.1, 0]}>
         {/* Slightly randomized seed shape */}
        <capsuleGeometry args={[0.15 + (seedHash * 0.05), 0.3 + (seedHash * 0.1), 4, 8]} /> 
        <meshStandardMaterial color={color} roughness={0.6} />
      </mesh>
      
      {/* A tiny sprout indicator if it's healthy */}
      <mesh position={[0.1, 0.2, 0]} rotation={[0, 0, -0.5]}>
         <planeGeometry args={[0.1, 0.2]} />
         <meshStandardMaterial color="#8bc34a" side={THREE.DoubleSide} transparent opacity={0.8} />
      </mesh>
    </group>
  );
};

interface TreeRenderProps {
  tree: TreeData;
}

export const TreeRender: React.FC<TreeRenderProps> = ({ tree }) => {
  const groupRef = useRef<THREE.Group>(null);

  // Calculate complexity based on stage/age
  const complexity = useMemo(() => {
    switch (tree.stage) {
      case GrowthStage.SEED: return 0;
      case GrowthStage.SAPLING: return 3;
      case GrowthStage.ADULT: return 5;
      case GrowthStage.MASTER: return 7; // Increased depth for master
      default: return 1;
    }
  }, [tree.stage]);

  const potConfig = STAGE_CONFIG[tree.stage];

  // Animation for gentle swaying
  useFrame((state) => {
    if (groupRef.current && tree.stage !== GrowthStage.SEED) {
      const swaySpeed = tree.stage === GrowthStage.MASTER ? 0.3 : 0.5;
      groupRef.current.rotation.z = Math.sin(state.clock.elapsedTime * swaySpeed) * 0.02;
    }
  });

  // Ensure DNA exists for legacy data support
  const dna = tree.dna || [tree.species + 'INIT'];

  return (
    <group ref={groupRef}>
      {/* Pot */}
      <mesh position={[0, potConfig.potDepth / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[potConfig.potWidth, potConfig.potWidth * 0.8, potConfig.potDepth, 32]} />
        <meshStandardMaterial color={potConfig.potColor} roughness={0.8} />
      </mesh>
      
      {/* Soil */}
      <mesh position={[0, potConfig.potDepth - 0.1, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <circleGeometry args={[potConfig.potWidth * 0.95, 32]} />
        <meshStandardMaterial color="#3e2723" roughness={1} />
      </mesh>

      {/* Tree Logic */}
      <group position={[0, potConfig.potDepth - 0.2, 0]}>
        {tree.stage === GrowthStage.SEED ? (
          <SeedObject dna={dna} species={tree.species} />
        ) : (
          <Branch 
            position={[0, 0, 0]} 
            rotation={[0, 0, 0]}
            length={1.5}
            radius={0.3}
            depth={0}
            maxDepth={complexity}
            species={tree.species}
            pruneState={tree.pruningCount}
            wireState={tree.wiringState}
            dna={dna}
          />
        )}
      </group>
    </group>
  );
};