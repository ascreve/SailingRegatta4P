import { create } from 'zustand';

export type Season = 'sanfrancisco' | 'longbeach' | 'newportharbor';

interface SeasonState {
  // Current sailing location
  currentSeason: Season;
  
  // Date when location was last changed (to enforce minimum duration)
  lastSeasonChange: Date;
  
  // Location wind configuration
  seasonConfig: {
    [key in Season]: {
      // Visual effects (kept but not used due to user preference)
      backgroundColor: string;
      puffColor: string;
      
      // Wind behavior
      windShiftRange: number;     // How much the wind can shift in degrees (e.g. ±10°)
      windShiftSpeed: number;     // How fast wind shifts (0-1)
      gusts: boolean;             // Whether strong gusts can occur
      gustProbability: number;    // 0-1 probability of gusts
      gustStrength: number;       // 1.0 = normal, higher = stronger gusts
      puffFrequency: number;      // 0-1, how frequently puffs appear
      puffSize: number;           // Size multiplier for puffs (1.0 = normal)
      puffOpacity: number;        // 0-1 opacity of puffs
      windVariability: number;    // How unstable/variable the wind is (0-1)
    }
  };
  
  // Actions
  changeSeason: (season: Season) => void;
  cycleToNextSeason: () => void;
}

export const useSeason = create<SeasonState>((set, get) => ({
  currentSeason: 'longbeach',  // Start with Long Beach by default
  lastSeasonChange: new Date(),
  
  seasonConfig: {
    sanfrancisco: {
      backgroundColor: '#c4e7d4',  // Light green (unused)
      puffColor: '#a0d8ef',        // Light blue (unused)
      windShiftRange: 25,          // Large wind shifts
      windShiftSpeed: 0.9,         // Fast shifts
      gusts: true,                 // San Francisco has strong gusts
      gustProbability: 0.4,        // Very frequent gusts
      gustStrength: 1.8,           // Strong gusts
      puffFrequency: 0.25,         // Many puffs
      puffSize: 0.9,               // Slightly smaller puffs (dense cold air)
      puffOpacity: 0.9,            // Very visible puffs
      windVariability: 0.9         // Extremely variable wind
    },
    longbeach: {
      backgroundColor: '#e8f4f8',  // Light blue sky (unused)
      puffColor: '#b0e2ff',        // Light blue puffs (unused)
      windShiftRange: 10,          // Standard wind shifts
      windShiftSpeed: 0.5,         // Standard shift speed
      gusts: false,                // Few gusts in Long Beach
      gustProbability: 0.05,       // Very rare gusts
      gustStrength: 1.0,           // Normal strength when they happen
      puffFrequency: 0.1,          // Standard puff frequency
      puffSize: 1.0,               // Standard puff size
      puffOpacity: 0.6,            // Standard opacity
      windVariability: 0.4         // Relatively stable wind
    },
    newportharbor: {
      backgroundColor: '#f8e0c3',  // Light orange/amber (unused)
      puffColor: '#d8c9ae',        // Beige/tan puffs (unused)
      windShiftRange: 15,          // Moderate wind shifts
      windShiftSpeed: 0.7,         // Moderate shift speed
      gusts: true,                 // Newport Harbor has occasional gusts
      gustProbability: 0.2,        // Occasional gusts
      gustStrength: 1.3,           // Moderate strength gusts 
      puffFrequency: 0.15,         // Medium puff frequency
      puffSize: 1.2,               // Slightly larger puffs
      puffOpacity: 0.7,            // Medium opacity
      windVariability: 0.7         // Fairly variable
    }
  },
  
  // Change to a specific location
  changeSeason: (season: Season) => {
    set({ 
      currentSeason: season,
      lastSeasonChange: new Date()
    });
    console.log(`Location changed to ${season}`);
  },
  
  // Cycle to the next location in order
  cycleToNextSeason: () => {
    const { currentSeason } = get();
    
    // Define location order
    const seasonOrder: Season[] = ['sanfrancisco', 'longbeach', 'newportharbor'];
    
    // Find current index
    const currentIndex = seasonOrder.indexOf(currentSeason);
    
    // Calculate next index (wrap around to 0 if at end)
    const nextIndex = (currentIndex + 1) % seasonOrder.length;
    
    // Set new location
    set({ 
      currentSeason: seasonOrder[nextIndex],
      lastSeasonChange: new Date()
    });
    
    console.log(`Sailed to ${seasonOrder[nextIndex]}`);
  }
}));

// Helper function to get current season config
export function getCurrentSeasonConfig() {
  const { currentSeason, seasonConfig } = useSeason.getState();
  return seasonConfig[currentSeason];
}