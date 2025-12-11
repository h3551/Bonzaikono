export enum TreeSpecies {
  PINE = 'Pine',
  MAPLE = 'Maple',
  CHERRY = 'Cherry',
  OAK = 'Oak'
}

export enum GrowthStage {
  SEED = 0,
  SAPLING = 1,
  ADULT = 2,
  MASTER = 3
}

export interface TreeData {
  id: string;
  species: TreeSpecies;
  stage: GrowthStage;
  age: number; // 0 to 100 within a stage? Or global age.
  
  // Vitals
  water: number; // 0-100
  fertilizer: number; // 0-100
  health: number; // 0-100
  
  // Structure (Procedural generation seed params)
  seedValue: number;
  pruningCount: number;
  wiringState: number; // Affects curve
  
  // Genetics / History
  dna: string[]; // Array of serial IDs accumulated over stages
  
  // Meta
  name: string;
  createdAt: number;
}

export interface BonsaiAdvice {
  text: string;
  mood: 'peaceful' | 'warning' | 'celebratory';
}