import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useAuth } from "./useAuth";
import { useGameSettings } from "./useGameSettings";

// Player boat interface
export interface Boat {
  id: string;
  userId: number;
  username: string;
  position: { x: number; y: number };
  rotation: number; // in degrees
  tack: "port" | "starboard";
  speed: number;
  sailPosition: number; // 0-100%, 100% being fully trimmed
  lastCheckpoint: number;
  isLocalPlayer: boolean;
}

export type RacePhase = "pre-start" | "starting" | "racing" | "finished";

export interface RaceResult {
  userId: number;
  username: string;
  finishTime: number;
  position: number;
  boatNumber?: number; // Added to track which boat this is (1-4)
}

export type RaceStage = "Not Started" | "Start Leg" | "Upwind Leg" | "Downwind Leg" | "Second Upwind Leg" | "Finish Leg" | "Finished";

interface RaceState {
  // Race state
  phase: RacePhase;
  startTime: number | null;
  timeRemaining: number; // seconds until race start
  raceTime: number; // ms since race started
  boats: Boat[];
  results: RaceResult[];
  
  // Boat race stages
  boat1Stage: RaceStage;
  boat2Stage: RaceStage;
  boat3Stage: RaceStage;
  boat4Stage: RaceStage;
  
  // Course setup
  startLine: { x1: number; y1: number; x2: number; y2: number };
  marks: Array<{ x: number; y: number; type: "top" | "bottom" }>;
  
  // Player state
  localBoat: Boat | null;
  
  // Actions
  initializeRace: (playerCount?: number) => void;
  startCountdown: () => void;
  startRace: () => void;
  updateBoat: (boatId: string, updates: Partial<Boat>) => void;
  finishRace: (boatId: string, time: number) => void;
  resetRace: () => void;
  
  // Controls
  setDirection: (direction: number) => void;
  tack: () => void;
  trimSail: (position: number) => void;
}

// Initial boat setup for a race
const createInitialBoat = (userId: number, username: string, index: number, isLocalPlayer: boolean): Boat => {
  // Position boats just below the start line
  const x = 500 + (index * 120); // Using wider spacing (3 boat lengths) as requested
  const y = 400; // Just below the start line - same for all boats
  
  // Generate boat ID (boat-1, boat-2, etc.) based on index+1
  // This is different from userId which is the actual authenticated user ID
  const boatNumber = index + 1;
  const boatId = `boat-${boatNumber}`;
  
  console.log(`Creating boat ${boatId} for user ID ${userId}, username: ${username}, position: (${x}, ${y})`);
  
  return {
    id: boatId, // This is for internal boat identification
    userId, // This is the actual user ID for database storage
    username,
    position: { x, y },
    rotation: 0, // Pointing upward (toward the wind)
    tack: "starboard",
    speed: 0,
    sailPosition: 100, // Fully trimmed
    lastCheckpoint: 0,
    isLocalPlayer,
  };
};

// Default race course setup - positioned centrally to ensure visibility
// Using fixed middle-of-screen values because we can't access window.innerWidth/Height at module scope
// Start line shortened by 50% (was 400 units wide, now 200 units wide)
const centerX = 500; // Center X position (same as before)
const halfWidth = 100; // Half of the new width (was 200)
const defaultStartLine = { 
  x1: centerX - halfWidth, 
  y1: 350, 
  x2: centerX + halfWidth, 
  y2: 350 
};
const defaultMarks = [
  { x: 500, y: 150, type: "top" as const },
  { x: 500, y: 300, type: "bottom" as const }
];

export const useRace = create<RaceState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    phase: "pre-start",
    startTime: null,
    timeRemaining: 180, // 3 minutes
    raceTime: 0,
    boats: [],
    results: [],
    boat1Stage: "Not Started",
    boat2Stage: "Not Started",
    boat3Stage: "Not Started",
    boat4Stage: "Not Started",
    startLine: defaultStartLine,
    marks: defaultMarks,
    localBoat: null,
    
    // Actions
    initializeRace: () => {
      const boats: Boat[] = [];
      
      // Get the authenticated user's username if available
      const authUser = useAuth.getState().user;
      const username = authUser?.username || "Player 1";
      
      // Get the actual user ID (if authenticated) or use a default
      const actualUserId = authUser?.id || 1;
      console.log("Initializing race with user ID:", actualUserId, "User:", authUser?.username);
      
      // Get boat count from game settings
      const { boatCount } = useGameSettings.getState();
      
      // Get custom boat names from user profile if available
      const boat1Name = authUser?.boat1Name && authUser.boat1Name.trim() ? authUser.boat1Name : username;
      const boat2Name = authUser?.boat2Name && authUser.boat2Name.trim() ? authUser.boat2Name : "Boat 2";
      const boat3Name = authUser?.boat3Name && authUser.boat3Name.trim() ? authUser.boat3Name : "Boat 3";
      const boat4Name = authUser?.boat4Name && authUser.boat4Name.trim() ? authUser.boat4Name : "Boat 4";
      
      // Add local player boat with custom name - USE ACTUAL USER ID
      const localBoat = createInitialBoat(actualUserId, boat1Name, 0, true);
      boats.push(localBoat);
      
      // Add additional boats based on user-selected boat count, using custom names
      // Additional boats will use incremental IDs for targeting purposes only
      // but the actual saved results will still use the authenticated user's ID
      if (boatCount > 1) {
        boats.push(createInitialBoat(actualUserId, boat2Name, 1, false));
        
        if (boatCount > 2) {
          boats.push(createInitialBoat(actualUserId, boat3Name, 2, false));
          
          if (boatCount > 3) {
            boats.push(createInitialBoat(actualUserId, boat4Name, 3, false));
          }
        }
      }
      
      set({
        phase: "pre-start",
        boats,
        localBoat,
        timeRemaining: 180,
        results: [],
        boat1Stage: "Not Started",
        boat2Stage: "Not Started",
        boat3Stage: "Not Started",
        boat4Stage: "Not Started",
      });
    },
    
    startCountdown: () => {
      console.log("Starting countdown - current state:", get());
      set(state => ({ 
        phase: "starting", 
        timeRemaining: 180,  // Reset to 3 minutes (180 seconds)
        startTime: null,
        // Make sure we're preserving all other state
        boats: state.boats,
        localBoat: state.localBoat,
        startLine: state.startLine,
        marks: state.marks,
        results: state.results,
        boat1Stage: state.boat1Stage,
        boat2Stage: state.boat2Stage,
        boat3Stage: state.boat3Stage,
        boat4Stage: state.boat4Stage
      }));
      console.log("After countdown start - new state:", get());
    },
    
    startRace: () => {
      console.log("Starting race - current state:", get());
      set(state => ({
        phase: "racing",
        startTime: Date.now(),
        // Preserve all other state
        boats: state.boats,
        localBoat: state.localBoat,
        startLine: state.startLine,
        marks: state.marks,
        timeRemaining: state.timeRemaining,
        results: state.results,
        raceTime: state.raceTime,
        boat1Stage: state.boat1Stage,
        boat2Stage: state.boat2Stage,
        boat3Stage: state.boat3Stage,
        boat4Stage: state.boat4Stage
      }));
      console.log("After race start - new state:", get());
    },
    
    updateBoat: (boatId, updates) => {
      set(state => ({
        boats: state.boats.map(boat => 
          boat.id === boatId ? { ...boat, ...updates } : boat
        ),
        localBoat: state.localBoat?.id === boatId ? { ...state.localBoat, ...updates } : state.localBoat,
      }));
    },
    
    finishRace: (boatId, time) => {
      const { boats, results, boat1Stage, boat2Stage, boat3Stage, boat4Stage } = get();
      const boat = boats.find(b => b.id === boatId);
      
      if (!boat) {
        console.error(`Boat with ID ${boatId} not found in the race`);
        return;
      }
      
      // Check if this boat already has a result
      // Use both boat ID and user ID to correctly track each unique boat
      const boatNumber = parseInt(boatId.split('-')[1]);
      if (results.some(r => r.userId === boat.userId && r.boatNumber === boatNumber)) {
        console.log(`Boat ${boatId} (userID: ${boat.userId}) already has a result, skipping`);
        return;
      }
      
      // Check if the boat has completed all required race stages before saving result
      // Each boat must complete: Start Leg → Upwind Leg → Downwind Leg → Second Upwind Leg → Finish Leg → Finished
      let hasCompletedAllStages = false;
      
      // Check the appropriate boat's stage
      if (boatId === "boat-1") {
        // For boat 1, check if it has reached the Finish Leg stage
        hasCompletedAllStages = boat1Stage === "Finish Leg" || boat1Stage === "Finished";
      } else if (boatId === "boat-2") {
        // For boat 2, check if it has reached the Finish Leg stage
        hasCompletedAllStages = boat2Stage === "Finish Leg" || boat2Stage === "Finished";
      } else if (boatId === "boat-3") {
        // For boat 3, check if it has reached the Finish Leg stage
        hasCompletedAllStages = boat3Stage === "Finish Leg" || boat3Stage === "Finished";
      } else if (boatId === "boat-4") {
        // For boat 4, check if it has reached the Finish Leg stage
        hasCompletedAllStages = boat4Stage === "Finish Leg" || boat4Stage === "Finished";
      }
      
      // Only record the result if the boat has completed all stages
      if (!hasCompletedAllStages) {
        console.log(`Boat ${boatId} has not completed all race stages yet. Current stage: ${
          boatId === "boat-1" ? boat1Stage :
          boatId === "boat-2" ? boat2Stage :
          boatId === "boat-3" ? boat3Stage :
          boat4Stage
        }. Skipping result recording.`);
        
        // Still update the boat stage to Finished, but don't record a result
        let stageUpdates: Partial<RaceState> = {};
        
        if (boatId === "boat-1") {
          stageUpdates.boat1Stage = "Finished";
        } else if (boatId === "boat-2") {
          stageUpdates.boat2Stage = "Finished";
        } else if (boatId === "boat-3") {
          stageUpdates.boat3Stage = "Finished";
        } else if (boatId === "boat-4") {
          stageUpdates.boat4Stage = "Finished";
        }
        
        set(stageUpdates);
        return;
      }
      
      // Create a new array with all results including this new one
      const allResults = [...results, {
        userId: boat.userId,
        username: boat.username,
        finishTime: time,
        position: 0, // Temporary placeholder
        boatNumber: boatNumber // Store the boat number separately
      }];
      
      // Sort results by finish time (fastest first)
      allResults.sort((a, b) => a.finishTime - b.finishTime);
      
      // Assign positions based on the sorted order
      const updatedResults = allResults.map((result, index) => ({
        ...result,
        position: index + 1 // Position 1 is first place (fastest time)
      }));
      
      console.log(`Recording race result for boat ${boatId}:`, {
        userId: boat.userId,
        username: boat.username,
        finishTime: time,
        boatNumber: boatId.split('-')[1],
        position: updatedResults.find(r => r.userId === boat.userId && r.boatNumber === boatNumber)?.position
      });
      
      // Update the appropriate boat stage based on boat ID
      let updates: Partial<RaceState> = {
        results: updatedResults,
      };
      
      // Set the proper boat's stage to finished
      if (boatId === "boat-1") {
        updates.boat1Stage = "Finished";
      } else if (boatId === "boat-2") {
        updates.boat2Stage = "Finished";
      } else if (boatId === "boat-3") {
        updates.boat3Stage = "Finished";
      } else if (boatId === "boat-4") {
        updates.boat4Stage = "Finished";
      }
      
      // Get a count of active boats in the race
      const activeBoatCount = get().boats.length;
      
      // Calculate how many boats have now finished (including this one)
      const finishedBoatsCount = results.length + 1;
      
      // ONLY mark race as "finished" when ALL boats have finished
      if (finishedBoatsCount >= activeBoatCount) {
        updates.phase = "finished";
        console.log(`All ${activeBoatCount} boats have finished - race complete!`);
      } else {
        console.log(`${finishedBoatsCount} of ${activeBoatCount} boats have finished. Race continues for ${activeBoatCount - finishedBoatsCount} more boats.`);
      }
      
      set(updates);
    },
    
    resetRace: () => {
      set({
        phase: "pre-start",
        startTime: null,
        timeRemaining: 180,
        raceTime: 0,
        boats: [],
        results: [],
        localBoat: null,
        boat1Stage: "Not Started",
        boat2Stage: "Not Started",
        boat3Stage: "Not Started",
        boat4Stage: "Not Started",
      });
    },
    
    // Control functions
    setDirection: (direction) => {
      const { localBoat } = get();
      if (localBoat) {
        set(state => ({
          localBoat: { ...state.localBoat!, rotation: direction },
        }));
      }
    },
    
    tack: () => {
      const { localBoat } = get();
      if (localBoat) {
        const newTack = localBoat.tack === "port" ? "starboard" : "port";
        set(state => ({
          localBoat: { ...state.localBoat!, tack: newTack },
        }));
      }
    },
    
    trimSail: (position) => {
      const { localBoat } = get();
      if (localBoat) {
        set(state => ({
          localBoat: { ...state.localBoat!, sailPosition: position },
        }));
      }
    },
  }))
);
