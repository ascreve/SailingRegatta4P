import { useEffect, useState, useCallback } from "react";
import { useRace } from "@/lib/stores/useRace";
import { useWind } from "@/lib/stores/useWind";
import { useAuth } from "@/lib/stores/useAuth";
import { useGameSettings } from "@/lib/stores/useGameSettings";
import GameCanvas from "./GameCanvas";
import SimpleGameCanvas from "./SimpleGameCanvas";
import GameUI from "./GameUI";
import LocationSelector from "./LocationSelector";
import WindShifter from "./WindShifter";

// UI components
import { Button } from "@/components/ui/button";

export default function Game() {
  const { phase, initializeRace } = useRace();
  const { initializeWind } = useWind();
  const { user } = useAuth();
  const { singleBoatMode } = useGameSettings();
  const [gameStarted, setGameStarted] = useState(false);

  // Start a new race
  const startGame = useCallback(() => {
    console.log("Starting game from main screen");
    initializeWind();
    initializeRace(singleBoatMode ? 1 : 2); // 1 or 2 boats based on setting
    setGameStarted(true);
  }, [initializeWind, initializeRace, singleBoatMode]);
  
  // Update race setup when boat mode changes without restarting the race
  useEffect(() => {
    if (gameStarted) {
      // Only update boat count, don't restart the race
      console.log(`Boat mode changed to: ${singleBoatMode ? 'Single Boat' : 'Two Boats'}`);
      
      // Just recreate the race with the new boat count
      // Instead of trying to add a property that doesn't exist in the interface
      console.log("Reinitializing race with new boat count:", singleBoatMode ? 1 : 2);
      initializeRace(singleBoatMode ? 1 : 2);
    }
  }, [singleBoatMode, gameStarted]);

  // Initialize the game on component mount
  useEffect(() => {
    if (!gameStarted) {
      startGame();
    }
  }, [gameStarted, startGame]);

  // Handle keyboard input for game controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!gameStarted) return;
      
      // Key mappings are handled by the GameCanvas component
    };
    
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [gameStarted]);

  return (
    <div className="relative w-full h-[calc(100vh-3.5rem)] overflow-hidden bg-background text-foreground">
      {/* Main game container */}
      <div className="relative w-full h-full">
        {/* Game canvas - either complex or simple */}
        {gameStarted && phase === "pre-start" && <GameCanvas />}
        {gameStarted && (phase === "starting" || phase === "racing" || phase === "finished") && <SimpleGameCanvas />}
        
        {/* Game UI overlay */}
        {gameStarted && <GameUI />}
        
        {/* Location selector - only show during gameplay on desktop */}
        {gameStarted && phase === "racing" && (
          <div className="hidden md:block">
            <LocationSelector />
          </div>
        )}
        
        {/* Add wind shifter component to control wind changes based on venue */}
        {gameStarted && phase === "racing" && <WindShifter />}
        
        {/* Start screen with GOAT logo mosaic background */}
        {!gameStarted && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-blue-950 via-blue-900 to-indigo-900 overflow-hidden">
            {/* GOAT logo mosaic background */}
            <div className="absolute inset-0 grid grid-cols-6 gap-4 p-6">
              {/* Generate a 6x6 grid of logos with varying opacities */}
              {Array.from({ length: 36 }).map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                  <img 
                    src="/images/goat-sailing-logo.png" 
                    alt="GOAT Sailing Race Logo" 
                    className={`w-full h-auto ${
                      i % 5 === 0 ? 'opacity-10' : 
                      i % 5 === 1 ? 'opacity-20' : 
                      i % 5 === 2 ? 'opacity-30' : 
                      i % 5 === 3 ? 'opacity-40' : 
                      'opacity-50'
                    }`}
                    style={{ 
                      transform: `rotate(${(i % 4) * 90}deg) scale(${0.8 + (i % 3) * 0.2})` 
                    }}
                  />
                </div>
              ))}
            </div>
            
            {/* Semi-transparent overlay to improve button visibility */}
            <div className="absolute inset-0 bg-gradient-to-t from-blue-950/80 via-blue-900/50 to-indigo-900/40"></div>
            
            {/* Main content */}
            <div className="z-10 flex flex-col items-center">
              {/* Logo and title with glow effect */}
              <img 
                src="/images/goat-sailing-logo.png" 
                alt="GOAT Sailing Race Logo" 
                className="w-96 h-auto mb-6"
              />
              <h1 className="text-5xl font-bold mb-12 text-white tracking-wider drop-shadow-glow">
                GOAT SAILING RACE
              </h1>
              
              {/* Boats display */}
              <div className="flex justify-around w-full max-w-4xl mb-12 px-8">
                {/* Boat 1 - Orange */}
                <div className="flex flex-col items-center">
                  <div className="w-40 h-40 relative">
                    <div className="absolute inset-0 bg-gradient-radial from-orange-400/20 to-transparent rounded-full animate-pulse"></div>
                    
                    {/* Simplified 3D-style boat */}
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 scale-[3]">
                      {/* Hull */}
                      <div className="w-12 h-5 bg-gradient-to-r from-orange-700 to-orange-500 rounded-t-full"></div>
                      
                      {/* Sail */}
                      <div className="absolute -top-6 left-[22px] w-0 h-0 
                                     border-l-[12px] border-l-transparent
                                     border-b-[16px] border-b-white
                                     border-r-[2px] border-r-transparent
                                     transform -rotate-15 origin-bottom-left
                                     shadow-lg">
                      </div>
                    </div>
                  </div>
                  <h3 className="text-orange-500 font-bold mt-2">{user?.username || "Username 1"}</h3>
                  <p className="text-gray-300 text-sm mt-1">Arrow Keys, ENTER to tack</p>
                </div>
                
                {/* Boat 2 - Blue - Only show in two-boat mode */}
                {!singleBoatMode && (
                  <div className="flex flex-col items-center">
                    <div className="w-40 h-40 relative">
                      <div className="absolute inset-0 bg-gradient-radial from-blue-400/20 to-transparent rounded-full animate-pulse"></div>
                      
                      {/* Simplified 3D-style boat */}
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 scale-[3]">
                        {/* Hull */}
                        <div className="w-12 h-5 bg-gradient-to-r from-blue-700 to-blue-500 rounded-t-full"></div>
                        
                        {/* Sail */}
                        <div className="absolute -top-6 left-[22px] w-0 h-0 
                                      border-l-[12px] border-l-transparent
                                      border-b-[16px] border-b-white
                                      border-r-[2px] border-r-transparent
                                      transform -rotate-15 origin-bottom-left
                                      shadow-lg">
                        </div>
                      </div>
                    </div>
                    <h3 className="text-blue-500 font-bold mt-2">Username 2</h3>
                    <p className="text-gray-300 text-sm mt-1">A/S Keys, E to tack</p>
                  </div>
                )}
              </div>
              
              {/* Start button with glow effect */}
              <Button 
                size="lg" 
                onClick={startGame}
                className="mt-6 text-xl font-bold py-8 px-16 bg-black text-white border-2 border-white hover:bg-white hover:text-black rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-300 transform hover:scale-110"
              >
                START RACE
              </Button>
              
              {/* Global controls */}
              <p className="text-gray-400 text-sm mt-12">Press SPACEBAR during game to pause</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
