import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GameSettingsState {
  // Game settings
  boatCount: number;
  
  // Actions
  setBoatCount: (count: number) => void;
  incrementBoatCount: () => void;
  decrementBoatCount: () => void;
  
  // Backward compatibility
  get singleBoatMode(): boolean;
  toggleBoatMode: () => void;
}

export const useGameSettings = create<GameSettingsState>()(
  persist(
    (set, get) => ({
      // Default settings - start with 2 boats
      boatCount: 2,
      
      // Set exact boat count (1-4)
      setBoatCount: (count: number) => set({ boatCount: Math.min(Math.max(count, 1), 4) }),
      
      // Increment boat count (max 4)
      incrementBoatCount: () => set((state) => ({ 
        boatCount: Math.min(state.boatCount + 1, 4) 
      })),
      
      // Decrement boat count (min 1)
      decrementBoatCount: () => set((state) => ({ 
        boatCount: Math.max(state.boatCount - 1, 1) 
      })),
      
      // For backward compatibility
      get singleBoatMode() {
        return get().boatCount === 1;
      },
      
      // Toggle between single boat and multi-boat mode (preserves previous multi-boat count)
      toggleBoatMode: () => set((state) => {
        // If currently in single boat mode, go back to previous multi-boat mode or default to 2
        if (state.boatCount === 1) {
          return { boatCount: 2 };
        }
        // Otherwise, switch to single boat mode
        return { boatCount: 1 };
      }),
    }),
    {
      name: 'goat-sailing-race-settings',
    }
  )
);