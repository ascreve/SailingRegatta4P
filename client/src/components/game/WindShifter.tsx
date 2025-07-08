import { useEffect, useRef } from "react";
import { useWind } from "@/lib/stores/useWind";
import { useSeason } from "@/lib/stores/useSeason";
import { useRace } from "@/lib/stores/useRace";

// This component manages wind shifts based on venue characteristics
export default function WindShifter() {
  const { phase } = useRace();
  const { updateWindDirection } = useWind();
  const { currentSeason } = useSeason();
  
  // Use a ref to track last shift time
  const lastShiftTimeRef = useRef(0);
  
  // Set up interval for wind shifts based on venue
  useEffect(() => {
    // Only run wind shifts during racing phase
    if (phase !== "racing") return;
    
    const handleWindShifts = (timestamp: number) => {
      // Skip if we don't have a previous timestamp yet
      if (lastShiftTimeRef.current === 0) {
        lastShiftTimeRef.current = timestamp;
        requestAnimationFrame(handleWindShifts);
        return;
      }
      
      const elapsed = timestamp - lastShiftTimeRef.current;
      
      // Determine shift interval based on venue (in milliseconds)
      let shiftInterval = 10000; // Default (10 seconds between shifts)
      
      if (currentSeason === 'sanfrancisco') {
        shiftInterval = 10000; // San Francisco: Slower shifts (every 10 seconds)
      } else if (currentSeason === 'longbeach') {
        shiftInterval = 7000; // Olympic Venue: Medium shifts (every 7 seconds)
      } else if (currentSeason === 'newportharbor') {
        shiftInterval = 3000; // Newport Harbor: Rapid shifts (every 3 seconds)
      }
      
      // Check if it's time for a shift
      if (elapsed >= shiftInterval) {
        // Update wind direction
        updateWindDirection();
        
        // Reset timer
        lastShiftTimeRef.current = timestamp;
      }
      
      // Continue the loop
      requestAnimationFrame(handleWindShifts);
    };
    
    // Start the animation frame loop
    const animationFrameId = requestAnimationFrame(handleWindShifts);
    
    // Clean up when component unmounts
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [phase, currentSeason, updateWindDirection]);
  
  // This is a "headless" component (no UI)
  return null;
}