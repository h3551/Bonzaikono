import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Environment, ContactShadows } from '@react-three/drei';
import { TreeData } from '../types';
import { TreeRender } from './TreeRender';

interface GardenSceneProps {
  tree: TreeData | null;
}

export const GardenScene: React.FC<GardenSceneProps> = ({ tree }) => {
  return (
    <div className="w-full h-full absolute inset-0 -z-10 bg-gradient-to-b from-stone-200 to-stone-400">
      <Canvas shadows camera={{ position: [0, 2, 8], fov: 45 }}>
        <Suspense fallback={null}>
          <Environment preset="forest" blur={0.8} background={false} />
          
          <ambientLight intensity={0.5} />
          <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} shadow-mapSize={2048} castShadow />
          
          {tree && <TreeRender tree={tree} />}

          <ContactShadows resolution={1024} scale={10} blur={2} opacity={0.5} far={10} color="#000000" />
          <OrbitControls 
            enablePan={false} 
            minPolarAngle={Math.PI / 4} 
            maxPolarAngle={Math.PI / 2}
            minDistance={4}
            maxDistance={12}
          />
        </Suspense>
      </Canvas>
    </div>
  );
};
