import { TreeSpecies, GrowthStage } from './types';

export const SPECIES_CONFIG: Record<TreeSpecies, {
  colorLeaf: string;
  colorBark: string;
  leafShape: 'needle' | 'broad' | 'flower';
  growthSpeed: number;
  description: string;
}> = {
  [TreeSpecies.PINE]: {
    colorLeaf: '#2d4f1e',
    colorBark: '#3e2723',
    leafShape: 'needle',
    growthSpeed: 0.8,
    description: "Symbol of longevity and virtue."
  },
  [TreeSpecies.MAPLE]: {
    colorLeaf: '#b91c1c',
    colorBark: '#5d4037',
    leafShape: 'broad',
    growthSpeed: 1.0,
    description: "Represents balance and peace."
  },
  [TreeSpecies.CHERRY]: {
    colorLeaf: '#fbcfe8',
    colorBark: '#4e342e',
    leafShape: 'flower',
    growthSpeed: 1.2,
    description: "A reminder of the transience of life."
  },
  [TreeSpecies.OAK]: {
    colorLeaf: '#4ade80',
    colorBark: '#5c4033',
    leafShape: 'broad',
    growthSpeed: 0.9,
    description: "Strength and endurance."
  }
};

export const STAGE_CONFIG: Record<GrowthStage, {
  potDepth: number;
  potWidth: number;
  potColor: string;
  label: string;
}> = {
  [GrowthStage.SEED]: { potDepth: 1.5, potWidth: 2, potColor: '#5d4037', label: 'Germination' },
  [GrowthStage.SAPLING]: { potDepth: 1.2, potWidth: 2.5, potColor: '#4e342e', label: 'Growth' },
  [GrowthStage.ADULT]: { potDepth: 0.8, potWidth: 3.5, potColor: '#3e2723', label: 'Refinement' },
  [GrowthStage.MASTER]: { potDepth: 0.4, potWidth: 4, potColor: '#263238', label: 'Masterpiece' },
};

export const MAX_STATS = 100;
export const CRITICAL_LOW = 20;
