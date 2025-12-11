import React, { useState, useEffect, useCallback, useRef } from 'react';
import { TreeData, GrowthStage, TreeSpecies } from './types';
import { STAGE_CONFIG, SPECIES_CONFIG, MAX_STATS, CRITICAL_LOW } from './constants';
import { GardenScene } from './components/GardenScene';
import { getMasterGardenerAdvice } from './services/geminiService';
import { 
  Droplets, 
  Scissors, 
  Sprout, 
  Wind, 
  Shovel, 
  MessageSquare, 
  Plus, 
  ArrowRight,
  Info,
  Sparkles,
  CheckCircle,
  Calendar,
  X,
  Edit2,
  Check,
  Save
} from 'lucide-react';

// --- Components defined locally to avoid too many file splits for this format ---

const StatBar: React.FC<{ label: string; value: number; color: string; icon: React.ReactNode }> = ({ label, value, color, icon }) => (
  <div className="flex items-center gap-3 mb-2">
    <div className={`p-2 rounded-full bg-stone-100 text-stone-600`}>{icon}</div>
    <div className="flex-1">
      <div className="flex justify-between text-xs font-serif uppercase tracking-widest text-stone-500 mb-1">
        <span>{label}</span>
        <span>{Math.round(value)}%</span>
      </div>
      <div className="h-2 w-full bg-stone-200 rounded-full overflow-hidden">
        <div 
          className={`h-full transition-all duration-500 ${color}`} 
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  </div>
);

const ActionButton: React.FC<{ 
  onClick: () => void; 
  icon: React.ReactNode; 
  label: string; 
  disabled?: boolean 
}> = ({ onClick, icon, label, disabled }) => (
  <button 
    onClick={onClick}
    disabled={disabled}
    className={`
      flex flex-col items-center justify-center p-4 rounded-xl border border-stone-200 
      transition-all duration-200
      ${disabled 
        ? 'opacity-40 cursor-not-allowed bg-stone-100' 
        : 'bg-white/80 hover:bg-white hover:shadow-lg hover:-translate-y-1 active:scale-95 cursor-pointer'}
    `}
  >
    <div className="text-stone-700 mb-2">{icon}</div>
    <span className="text-xs font-serif uppercase tracking-wide text-stone-600">{label}</span>
  </button>
);

interface Notification {
  id: number;
  message: string;
  type: 'milestone' | 'health' | 'stage';
}

const NotificationToast: React.FC<{ notification: Notification; onClose: (id: number) => void }> = ({ notification, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(notification.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [notification.id, onClose]);

  let icon;
  let colorClass;
  let title;

  switch (notification.type) {
    case 'milestone':
      icon = <Calendar size={20} />;
      colorClass = 'text-amber-700 border-amber-500 bg-amber-50';
      title = 'Age Milestone';
      break;
    case 'health':
      icon = <Sparkles size={20} />;
      colorClass = 'text-green-700 border-green-500 bg-green-50';
      title = 'Perfect Health';
      break;
    case 'stage':
      icon = <CheckCircle size={20} />;
      colorClass = 'text-purple-700 border-purple-500 bg-purple-50';
      title = 'Growth Stage';
      break;
  }

  return (
    <div className={`mb-3 p-4 rounded-xl shadow-xl border-l-4 flex items-center gap-3 animate-slide-in pointer-events-auto w-72 backdrop-blur-md bg-white/95 ${colorClass.split(' ').filter(c => c.startsWith('border')).join(' ')}`}>
      <div className={`p-2 rounded-full bg-white/50 ${colorClass.split(' ')[0]}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className={`text-sm font-serif font-bold ${colorClass.split(' ')[0]}`}>{title}</p>
        <p className="text-xs text-stone-600 leading-snug">{notification.message}</p>
      </div>
      <button onClick={() => onClose(notification.id)} className="text-stone-400 hover:text-stone-600 transition-colors">
        <X size={16} />
      </button>
    </div>
  );
};

// Helper: Generate DNA segment
const generateDNASegment = (prefix: string, stats?: { health: number, water: number, fertilizer: number }) => {
  if (!stats) {
    // Initial Seed Segment: PREFIX-RANDOM
    return `${prefix}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  }
  // Evolution Segment: Encodes stats into the ID
  // H: Health, W: Water, F: Fertilizer (Hex encoded for compactness)
  const h = Math.floor(stats.health).toString(16).toUpperCase().padStart(2, '0');
  const w = Math.floor(stats.water).toString(16).toUpperCase().padStart(2, '0');
  const f = Math.floor(stats.fertilizer).toString(16).toUpperCase().padStart(2, '0');
  
  // Add a randomness factor so identical stats don't produce identical trees
  const rnd = Math.random().toString(36).substring(2, 4).toUpperCase();
  
  return `EVO-${h}${w}${f}-${rnd}`;
};

export default function App() {
  // --- State Initialization with LocalStorage ---
  const [inventory, setInventory] = useState<TreeData[]>(() => {
    try {
      const saved = localStorage.getItem('zen-bonsai-storage');
      return saved ? JSON.parse(saved).inventory : [];
    } catch (e) {
      console.error("Failed to load inventory", e);
      return [];
    }
  });

  const [activeTreeId, setActiveTreeId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('zen-bonsai-storage');
      return saved ? JSON.parse(saved).activeTreeId : null;
    } catch (e) {
      return null;
    }
  });

  // Derived state for the currently active tree
  const activeTree = inventory.find(t => t.id === activeTreeId) || null;

  const [advice, setAdvice] = useState<string | null>(null);
  const [isLoadingAdvice, setIsLoadingAdvice] = useState(false);
  const [showNewTreeModal, setShowNewTreeModal] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Renaming state
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  
  // Ref to track previous state for milestone detection
  const prevTreeRef = useRef<TreeData | null>(null);

  // --- Persistence Effect ---
  useEffect(() => {
    const data = { inventory, activeTreeId };
    localStorage.setItem('zen-bonsai-storage', JSON.stringify(data));
  }, [inventory, activeTreeId]);

  const addNotification = useCallback((message: string, type: Notification['type']) => {
    const id = Date.now();
    setNotifications(prev => [...prev, { id, message, type }]);
  }, []);

  const removeNotification = useCallback((id: number) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // -- Game Loop / Tick --
  useEffect(() => {
    if (!activeTreeId) return;

    const interval = setInterval(() => {
      setInventory(prevInv => prevInv.map(tree => {
        // Only update the active tree
        if (tree.id !== activeTreeId) return tree;

        // Decay logic
        const waterDecay = 0.5; // lose water over time
        const fertDecay = 0.2; 
        
        let newHealth = tree.health;
        
        // Health penalty if stats are critical
        if (tree.water < CRITICAL_LOW || tree.fertilizer < CRITICAL_LOW) {
          newHealth = Math.max(0, newHealth - 0.5);
        } else if (tree.water > 50 && tree.fertilizer > 50) {
          newHealth = Math.min(MAX_STATS, newHealth + 0.1); // Slowly heal
        }

        // Growth logic (very simplified for demo)
        // Trees age automatically
        const newAge = tree.age + 0.1;

        return {
          ...tree,
          water: Math.max(0, tree.water - waterDecay),
          fertilizer: Math.max(0, tree.fertilizer - fertDecay),
          health: newHealth,
          age: newAge
        };
      }));
    }, 1000); // 1 tick per second

    return () => clearInterval(interval);
  }, [activeTreeId]);

  // -- Milestone Monitor --
  useEffect(() => {
    if (!activeTree) {
      prevTreeRef.current = null;
      return;
    }

    const prev = prevTreeRef.current;
    if (prev && prev.id === activeTree.id) { // Ensure we are comparing the same tree
      // Stage Change
      if (activeTree.stage > prev.stage) {
        addNotification(`Your ${activeTree.species} has evolved to the ${STAGE_CONFIG[activeTree.stage].label} stage!`, 'stage');
      }

      // Age Milestones (every 10 cycles for demo)
      const prevAge = Math.floor(prev.age);
      const currAge = Math.floor(activeTree.age);
      if (currAge > prevAge && currAge > 0 && currAge % 10 === 0) {
        addNotification(`The tree has reached ${currAge} cycles of age.`, 'milestone');
      }

      // Max Health Reached
      if (activeTree.health >= MAX_STATS && prev.health < MAX_STATS) {
        addNotification("Your tree is radiating with perfect vitality!", 'health');
      }
    }

    prevTreeRef.current = activeTree;
  }, [activeTree, addNotification]);

  // -- Actions Helpers --
  const updateActiveTree = (updater: (t: TreeData) => TreeData) => {
    if (!activeTreeId) return;
    setInventory(prev => prev.map(t => t.id === activeTreeId ? updater(t) : t));
  };

  // -- Actions --

  const handleCreateTree = (species: TreeSpecies) => {
    const speciesPrefix = species.substring(0, 3).toUpperCase();
    const initialDNA = generateDNASegment(speciesPrefix);
    
    const newTree: TreeData = {
      id: Math.random().toString(36).substr(2, 9),
      species,
      stage: GrowthStage.SEED,
      age: 0,
      water: 50,
      fertilizer: 50,
      health: 100,
      seedValue: Math.random(),
      pruningCount: 0,
      wiringState: 0,
      dna: [initialDNA], // Start with just the seed DNA
      name: `My ${species}`,
      createdAt: Date.now()
    };
    setInventory(prev => [...prev, newTree]);
    setActiveTreeId(newTree.id);
    setShowNewTreeModal(false);
    setAdvice("A new life begins. Keep the soil moist.");
  };

  const handleWater = () => {
    updateActiveTree(t => ({ ...t, water: Math.min(MAX_STATS, t.water + 30) }));
  };

  const handleFertilize = () => {
    updateActiveTree(t => ({ ...t, fertilizer: Math.min(MAX_STATS, t.fertilizer + 30) }));
  };

  const handlePrune = () => {
    const tree = activeTree;
    if (!tree || tree.stage < GrowthStage.SAPLING) return;
    updateActiveTree(t => ({ ...t, pruningCount: t.pruningCount + 1 }));
  };

  const handleWire = () => {
    const tree = activeTree;
    if (!tree || tree.stage < GrowthStage.ADULT) return;
    updateActiveTree(t => ({ ...t, wiringState: (t.wiringState + 1) % 5 }));
  };

  const handleAdvanceStage = () => {
    if (!activeTree) return;
    
    // Check health requirement
    if (activeTree.health < 80) {
      setAdvice("The tree is too weak to be repotted.");
      return;
    }

    // Check Age requirements based on current stage
    let minAge = 0;
    if (activeTree.stage === GrowthStage.SEED) minAge = 1;      // Stage 1 needs age > 1
    if (activeTree.stage === GrowthStage.SAPLING) minAge = 15;  // Stage 2 needs age > 15
    
    if (activeTree.age < minAge) {
      setAdvice(`The tree is not yet ready. Patience. (Needs Age ${minAge})`);
      return;
    }

    const nextStage = activeTree.stage + 1;
    if (nextStage > GrowthStage.MASTER) return;

    // Generate new DNA segment based on current stats
    const newDNA = generateDNASegment("S" + nextStage, {
      health: activeTree.health,
      water: activeTree.water,
      fertilizer: activeTree.fertilizer
    });

    updateActiveTree(t => ({ 
      ...t, 
      stage: nextStage,
      dna: [...t.dna, newDNA] // Append history
    }));
    setAdvice(`The roots spread deeper into the earth.`); 
  };

  const handleConsult = async () => {
    if (!activeTree) return;
    setIsLoadingAdvice(true);
    const text = await getMasterGardenerAdvice(activeTree);
    setAdvice(text);
    setIsLoadingAdvice(false);
  };

  // -- Renaming Handlers --
  const handleStartEdit = () => {
    if (activeTree) {
      setTempName(activeTree.name);
      setIsEditingName(true);
    }
  };

  const handleSaveName = () => {
    if (activeTree && tempName.trim()) {
      updateActiveTree(t => ({ ...t, name: tempName.trim() }));
      setIsEditingName(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditingName(false);
  };

  // -- Render --

  if (!activeTree && inventory.length === 0 && !showNewTreeModal) {
    // Empty state / Onboarding
    return (
      <div className="h-screen w-full flex items-center justify-center bg-stone-100 font-serif">
        <div className="text-center p-8 max-w-lg">
          <h1 className="text-4xl font-bold text-stone-800 mb-4">Zen Bonsai</h1>
          <p className="text-stone-600 mb-8 italic">"The best time to plant a tree was 20 years ago. The second best time is now."</p>
          <button 
            onClick={() => setShowNewTreeModal(true)}
            className="px-8 py-3 bg-stone-800 text-stone-100 rounded shadow-lg hover:bg-stone-700 transition"
          >
            Enter the Garden
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-full relative overflow-hidden font-sans text-stone-800">
      
      {/* 3D Background */}
      <GardenScene tree={activeTree} />

      {/* Top Navigation / Header */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start z-10 pointer-events-none">
        <div>
          <h1 className="text-3xl font-serif font-bold text-stone-900 tracking-wider">ZEN BONSAI</h1>
          {activeTree && (
            <div className="mt-2 inline-block bg-white/60 backdrop-blur-md px-4 py-2 rounded-lg pointer-events-auto min-w-[200px]">
              
              {isEditingName ? (
                <div className="flex items-center gap-2 mb-1">
                  <input 
                    type="text" 
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="bg-white/80 border border-stone-300 rounded px-2 py-1 text-lg font-bold w-full focus:outline-none focus:border-stone-500 font-serif text-stone-800"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveName();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                  />
                  <button onClick={handleSaveName} className="p-1 text-green-700 hover:bg-green-100 rounded" title="Save">
                    <Check size={18} />
                  </button>
                  <button onClick={handleCancelEdit} className="p-1 text-red-700 hover:bg-red-100 rounded" title="Cancel">
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 mb-1 group">
                  <h2 className="text-lg font-bold text-stone-800 font-serif">{activeTree.name}</h2>
                  <button 
                    onClick={handleStartEdit}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-stone-500 hover:text-stone-800"
                    title="Rename Tree"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}

              <div className="text-xs uppercase tracking-widest text-stone-600 mb-1">
                {activeTree.species} • {STAGE_CONFIG[activeTree.stage].label} • Age {Math.floor(activeTree.age)}
              </div>
              <div className="text-[10px] text-stone-400 font-mono tracking-tight opacity-70">
                DNA: {activeTree.dna ? activeTree.dna.join(' > ') : 'INIT'}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex gap-2">
           {inventory.length > 0 && !activeTree && (
              <div className="pointer-events-auto bg-white/80 backdrop-blur p-4 rounded-xl shadow-lg animate-fade-in mr-4">
                 <p className="text-sm text-stone-600 mb-2">Your Garden</p>
                 <div className="flex gap-2">
                   {inventory.map(t => (
                     <button 
                       key={t.id}
                       onClick={() => setActiveTreeId(t.id)}
                       className="w-8 h-8 rounded-full bg-stone-200 hover:bg-zen-green hover:text-white transition flex items-center justify-center text-xs"
                     >
                       {t.species[0]}
                     </button>
                   ))}
                 </div>
              </div>
           )}

          <button 
            onClick={() => setShowNewTreeModal(true)}
            className="pointer-events-auto bg-stone-800 text-white p-3 rounded-full hover:bg-stone-700 shadow-lg transition"
            title="New Tree"
          >
            <Plus size={24} />
          </button>
        </div>
      </div>

      {/* Notifications Layer */}
      <div className="absolute top-24 right-0 p-6 z-20 flex flex-col items-end pointer-events-none gap-2">
        {notifications.map(n => (
          <NotificationToast key={n.id} notification={n} onClose={removeNotification} />
        ))}
      </div>

      {/* Main UI Overlay - Bottom */}
      {activeTree && (
        <div className="absolute bottom-0 left-0 w-full p-6 z-10 pointer-events-none flex flex-col md:flex-row items-end justify-between gap-6">
          
          {/* Stats Panel */}
          <div className="w-full md:w-80 bg-white/80 backdrop-blur-md p-5 rounded-2xl shadow-xl pointer-events-auto">
             <StatBar 
               label="Moisture" 
               value={activeTree.water} 
               color="bg-blue-400" 
               icon={<Droplets size={16} />} 
             />
             <StatBar 
               label="Nutrition" 
               value={activeTree.fertilizer} 
               color="bg-amber-400" 
               icon={<Sprout size={16} />} 
             />
             <StatBar 
               label="Vigor" 
               value={activeTree.health} 
               color="bg-green-500" 
               icon={<Wind size={16} />} 
             />
          </div>

          {/* Advice Bubble */}
          {advice && (
             <div className="hidden md:block flex-1 max-w-md mb-4 bg-stone-900/90 text-stone-100 p-6 rounded-t-2xl rounded-br-2xl pointer-events-auto animate-fade-in shadow-2xl">
               <div className="flex gap-4">
                 <div className="mt-1"><Info size={20} className="text-stone-400" /></div>
                 <div>
                   <h3 className="font-serif font-bold mb-1 text-stone-300">Master's Whisper</h3>
                   <p className="text-sm italic leading-relaxed">"{advice}"</p>
                 </div>
               </div>
             </div>
          )}

          {/* Actions Bar */}
          <div className="flex gap-3 overflow-x-auto pb-2 md:pb-0 pointer-events-auto">
            <ActionButton 
              label="Water" 
              icon={<Droplets className="text-blue-500" />} 
              onClick={handleWater} 
            />
            
            {activeTree.stage === GrowthStage.SEED ? (
               // Seed specific actions
               <div className="px-4 py-2 bg-stone-100 rounded-xl flex items-center text-xs text-stone-500 uppercase tracking-widest">
                 Wait for germination...
               </div>
            ) : (
              <>
                <ActionButton 
                  label="Feed" 
                  icon={<Sprout className="text-amber-600" />} 
                  onClick={handleFertilize} 
                  disabled={activeTree.stage === GrowthStage.MASTER}
                />
                <ActionButton 
                  label="Prune" 
                  icon={<Scissors className="text-stone-600" />} 
                  onClick={handlePrune} 
                  disabled={activeTree.stage < GrowthStage.SAPLING}
                />
                <ActionButton 
                  label="Shape" 
                  icon={<Wind className="text-stone-500" />} 
                  onClick={handleWire} 
                  disabled={activeTree.stage < GrowthStage.ADULT}
                />
              </>
            )}

            <div className="w-px bg-stone-300 mx-1"></div>

            <ActionButton 
              label="Consult" 
              icon={isLoadingAdvice ? <div className="animate-spin">⏳</div> : <MessageSquare className="text-purple-600" />} 
              onClick={handleConsult} 
            />

            {activeTree.stage < GrowthStage.MASTER && (
               <ActionButton 
                 label="Evolve" 
                 icon={<ArrowRight className="text-stone-800" />} 
                 onClick={handleAdvanceStage}
                 disabled={activeTree.health < 90 || activeTree.age < 1} // Basic gating
               />
            )}
            
            <ActionButton 
              label="Garden" 
              icon={<Save className="text-stone-600" />} 
              onClick={() => setActiveTreeId(null)}
            />
          </div>

        </div>
      )}

      {/* New Tree Modal */}
      {showNewTreeModal && (
        <div className="absolute inset-0 z-50 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-stone-50 p-8 rounded-2xl shadow-2xl max-w-2xl w-full">
            <h2 className="text-3xl font-serif font-bold text-center mb-2 text-stone-800">Select a Seed</h2>
            <p className="text-center text-stone-500 mb-8">Each seed holds the potential of a thousand years.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {Object.values(TreeSpecies).map((species) => {
                 const config = SPECIES_CONFIG[species as TreeSpecies];
                 return (
                   <button 
                     key={species}
                     onClick={() => handleCreateTree(species as TreeSpecies)}
                     className="flex items-start gap-4 p-4 border border-stone-200 rounded-xl hover:bg-white hover:border-stone-400 hover:shadow-md transition text-left group"
                   >
                     <div 
                       className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center text-xl shadow-inner group-hover:scale-110 transition"
                       style={{ backgroundColor: config.colorLeaf, color: 'white' }}
                     >
                       🌱
                     </div>
                     <div>
                       <h3 className="font-bold text-lg text-stone-800">{species}</h3>
                       <p className="text-xs text-stone-500 mt-1 leading-snug">{config.description}</p>
                     </div>
                   </button>
                 );
              })}
            </div>
            
            <div className="mt-8 text-center">
              <button 
                onClick={() => setShowNewTreeModal(false)}
                className="text-stone-500 hover:text-stone-800 text-sm underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Garden Overview (When no tree is active but inventory exists) */}
      {!activeTree && inventory.length > 0 && !showNewTreeModal && (
         <div className="absolute inset-0 z-40 bg-stone-100 flex flex-col items-center justify-center p-8">
            <h1 className="text-4xl font-serif font-bold text-stone-800 mb-8">Your Bonsai Collection</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl w-full">
              {inventory.map(tree => (
                <div key={tree.id} className="bg-white p-6 rounded-xl shadow-lg border border-stone-200 hover:shadow-xl transition flex flex-col items-center text-center">
                   <div className="w-16 h-16 rounded-full bg-stone-100 mb-4 flex items-center justify-center text-2xl">
                     {SPECIES_CONFIG[tree.species].leafShape === 'needle' ? '🌲' : '🌳'}
                   </div>
                   <h3 className="font-serif font-bold text-xl mb-1">{tree.name}</h3>
                   <p className="text-xs uppercase tracking-widest text-stone-500 mb-4">{tree.species} • {STAGE_CONFIG[tree.stage].label}</p>
                   
                   <div className="w-full bg-stone-100 h-2 rounded-full mb-4 overflow-hidden">
                     <div className="bg-green-500 h-full" style={{ width: `${tree.health}%` }}></div>
                   </div>

                   <button 
                     onClick={() => setActiveTreeId(tree.id)}
                     className="px-6 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-700 transition w-full"
                   >
                     Tend to Tree
                   </button>
                </div>
              ))}
              
              <button 
                 onClick={() => setShowNewTreeModal(true)}
                 className="bg-stone-200 border-2 border-dashed border-stone-300 p-6 rounded-xl flex flex-col items-center justify-center text-stone-500 hover:bg-stone-100 hover:border-stone-400 transition"
              >
                 <Plus size={32} className="mb-2" />
                 <span className="font-serif">Plant New Seed</span>
              </button>
            </div>
         </div>
      )}

    </div>
  );
}