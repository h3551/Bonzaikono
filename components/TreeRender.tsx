import React, { useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { TreeData, GrowthStage, TreeSpecies } from '../types';
import { SPECIES_CONFIG, STAGE_CONFIG } from '../constants';

// --- RNG Utilities ---

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

const getDnaFloat = (dna: string[], cursor: number) => {
  const segmentIdx = Math.floor(cursor / 10) % (dna?.length || 1);
  const segment = (dna && dna[segmentIdx]) ? dna[segmentIdx] : 'SEED';
  const val = cyrb53(`${segment}-${cursor}`);
  return (val % 1000) / 1000;
};

// --- Canvas Drawing Logic ---

const drawLeaf = (
  ctx: CanvasRenderingContext2D, 
  species: TreeSpecies, 
  config: any, 
  scale: number,
  time: number
) => {
  ctx.fillStyle = config.colorLeaf;
  const sway = Math.sin(time * 2 + Math.random() * 10) * 0.1;
  ctx.rotate(sway);

  if (species === TreeSpecies.PINE) {
    ctx.beginPath();
    ctx.arc(0, 0, 6 * scale, 0, Math.PI * 2);
    ctx.fill();
    // Needles
    ctx.strokeStyle = config.colorLeaf;
    ctx.lineWidth = 1 * scale;
    for(let i=0; i<8; i++) {
        ctx.beginPath();
        ctx.moveTo(0,0);
        const ang = (i/8) * Math.PI * 2;
        ctx.lineTo(Math.cos(ang) * 12 * scale, Math.sin(ang) * 12 * scale);
        ctx.stroke();
    }
  } else if (species === TreeSpecies.CHERRY) {
    ctx.beginPath();
    ctx.arc(0, 0, 5 * scale, 0, Math.PI * 2);
    ctx.fillStyle = Math.random() > 0.5 ? config.colorLeaf : '#fed7aa'; 
    ctx.fill();
  } else {
    ctx.beginPath();
    ctx.ellipse(0, 0, 8 * scale, 12 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.rotate(-sway);
};

const drawBranch = (
  ctx: CanvasRenderingContext2D,
  len: number,
  depth: number,
  maxDepth: number,
  cursor: number,
  dna: string[],
  species: TreeSpecies,
  config: any,
  time: number
) => {
  ctx.save();
  
  const width = Math.max(1, (maxDepth - depth) * 3);
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.strokeStyle = config.colorBark;

  ctx.beginPath();
  ctx.moveTo(0, 0);
  
  const staticCurve = (getDnaFloat(dna, cursor + 1) - 0.5) * 20 * (len / 100);
  const windSway = Math.sin(time + depth * 0.5) * (depth * 1.5); 
  
  ctx.quadraticCurveTo(staticCurve + windSway, -len / 2, 0 + windSway * 0.5, -len);
  ctx.stroke();

  if (depth > maxDepth - 3 || depth === maxDepth) {
     if (getDnaFloat(dna, cursor + 99) > 0.4) {
        ctx.save();
        ctx.translate(0 + windSway * 0.5, -len);
        drawLeaf(ctx, species, config, 1.5, time);
        ctx.restore();
     }
  }

  if (depth < maxDepth) {
    ctx.translate(0 + windSway * 0.5, -len);
    
    const branchCount = Math.floor(getDnaFloat(dna, cursor + 2) * 2) + 2; 
    let spread = 0.8; 
    if (species === TreeSpecies.PINE) spread = 0.6;
    if (species === TreeSpecies.OAK) spread = 1.0;

    for (let i = 0; i < branchCount; i++) {
        const variance = (getDnaFloat(dna, cursor + 10 + i) - 0.5) * 0.5;
        const baseAngle = ((i / (branchCount - 1)) - 0.5) * spread * 2; 
        const branchSway = Math.sin(time * 1.5 + depth) * 0.05;
        const angle = baseAngle + variance + branchSway;
        const decay = 0.7 + (getDnaFloat(dna, cursor + 20 + i) * 0.1);
        
        ctx.save();
        ctx.rotate(angle);
        drawBranch(
            ctx, 
            len * decay, 
            depth + 1, 
            maxDepth, 
            cursor + 100 + (i * 50), 
            dna, 
            species, 
            config,
            time
        );
        ctx.restore();
    }
  }

  ctx.restore();
};

const drawSeed = (ctx: CanvasRenderingContext2D, width: number, height: number, color: string, time: number) => {
    // Position seed near bottom so it sits in pot
    const cx = width / 2;
    const cy = height - 100; 
    
    ctx.translate(cx, cy);
    const pulse = Math.sin(time * 2) * 0.1 + 4; 
    ctx.scale(pulse, pulse); 
    
    // Seed Body
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 15, 0.2, 0, Math.PI * 2);
    ctx.fill();
    
    // Tiny Sprout
    ctx.beginPath();
    ctx.moveTo(0, -10);
    const sway = Math.sin(time * 3) * 5;
    ctx.quadraticCurveTo(5 + sway, -25, 10 + sway, -30);
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#84cc16'; 
    ctx.stroke();
    
    // Leaf
    ctx.beginPath();
    ctx.ellipse(10 + sway, -30, 6, 4, 0.5 + sway * 0.05, 0, Math.PI*2);
    ctx.fillStyle = '#84cc16';
    ctx.fill();
};

// --- Main Component ---

interface TreeRenderProps {
  tree: TreeData;
}

export const TreeRender: React.FC<TreeRenderProps> = ({ tree }) => {
  // Stable initialization of canvas resources
  const [canvasResources] = useState(() => {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return { canvas, tex };
  });

  const complexity = useMemo(() => {
    switch (tree.stage) {
      case GrowthStage.SEED: return 0;
      case GrowthStage.SAPLING: return 4;
      case GrowthStage.ADULT: return 7;
      case GrowthStage.MASTER: return 9;
      default: return 1;
    }
  }, [tree.stage]);

  const potConfig = STAGE_CONFIG[tree.stage];
  const speciesConfig = SPECIES_CONFIG[tree.species];

  useFrame((state) => {
    if (!canvasResources) return;
    const { canvas, tex } = canvasResources;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const time = state.clock.elapsedTime;

    // Clear
    ctx.clearRect(0, 0, 1024, 1024);
    
    // Debug/Artistic Border
    ctx.strokeStyle = '#292524'; // stone-800
    ctx.lineWidth = 15;
    ctx.strokeRect(10, 10, 1004, 1004);

    if (tree.stage === GrowthStage.SEED) {
        drawSeed(ctx, 1024, 1024, speciesConfig.colorBark, time);
    } else {
        // Start near bottom center
        const startLen = 140; 
        const startX = 512;
        const startY = 950; 
        
        const dna = tree.dna || [tree.species];
        
        ctx.translate(startX, startY);
        drawBranch(
            ctx, 
            startLen, 
            1, 
            complexity, 
            0, 
            dna, 
            tree.species, 
            speciesConfig,
            time
        );
        ctx.setTransform(1, 0, 0, 1, 0, 0); 
    }

    tex.needsUpdate = true;
  });

  if (!canvasResources) return null;

  return (
    <group>
      {/* Pot - Bowl Shape (Top wider than bottom) */}
      <mesh position={[0, potConfig.potDepth / 2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[potConfig.potWidth / 2, potConfig.potWidth / 2 * 0.7, potConfig.potDepth, 32]} />
        <meshStandardMaterial color={potConfig.potColor} roughness={0.7} />
      </mesh>
      
      {/* Soil */}
      <mesh position={[0, potConfig.potDepth - 0.02, 0]} rotation={[-Math.PI/2, 0, 0]} receiveShadow>
        <circleGeometry args={[potConfig.potWidth / 2 * 0.9, 32]} />
        <meshStandardMaterial color="#3e2723" roughness={1} />
      </mesh>

      {/* Tree Planes */}
      <group position={[0, potConfig.potDepth, 0]}>
         {/* Main Plane */}
         <mesh position={[0, 2.5, 0]} castShadow>
             <planeGeometry args={[5, 5]} />
             <meshStandardMaterial 
                 map={canvasResources.tex} 
                 transparent={true}
                 alphaTest={0.05} // Low alpha test to catch semi-transparent edges if any, but stroke is opaque
                 side={THREE.DoubleSide} 
                 roughness={1}
                 metalness={0}
             />
         </mesh>
         
         {/* Cross Plane (Only for non-seeds to give volume) */}
         {tree.stage !== GrowthStage.SEED && (
             <mesh position={[0, 2.5, 0]} rotation={[0, Math.PI / 2, 0]} castShadow>
                 <planeGeometry args={[5, 5]} />
                 <meshStandardMaterial 
                    map={canvasResources.tex} 
                    transparent={true}
                    alphaTest={0.05} 
                    side={THREE.DoubleSide}
                    roughness={1}
                    color="#e5e5e5" // Slightly darker for fake shading
                 />
             </mesh>
         )}
      </group>
    </group>
  );
};
