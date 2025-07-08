import React, { useState } from 'react';
import { useSeason, Season } from '@/lib/stores/useSeason';
import { useWind } from '@/lib/stores/useWind';
import { useRace } from '@/lib/stores/useRace';
import { Info } from 'lucide-react';

export default function LocationSelector() {
  // Get current season/location and change function from store
  const currentSeason = useSeason(state => state.currentSeason);
  const changeSeason = useSeason(state => state.changeSeason);
  const cycleToNextSeason = useSeason(state => state.cycleToNextSeason);
  
  // Get wind initialization function to update when location changes
  const initializeWind = useWind(state => state.initializeWind);
  
  // Get wind and current state for information display (avoid infinite loop with separate selectors)
  const windBaseStrength = useWind(state => state.baseStrength);
  const windDirection = useWind(state => state.direction);
  const currentStrength = useWind(state => state.currentStrength);
  const currentDirection = useWind(state => state.currentDirection);
  
  // Get race functions to restart race when location changes
  const startRace = useRace(state => state.startRace);
  const resetRace = useRace(state => state.resetRace);
  
  // State to toggle info panel
  const [showInfo, setShowInfo] = useState(false);
  
  // Location options
  const seasons: Season[] = ['sanfrancisco', 'longbeach', 'newportharbor'];
  
  // Get location icon based on sailing venue
  const getSeasonIcon = (season: Season) => {
    switch (season) {
      case 'sanfrancisco':
        return '🌉'; // Red bridge (Golden Gate)
      case 'longbeach':
        return '🏅'; // Medal for Olympic venue
      case 'newportharbor':
        return '⛵'; // Sailboat
      default:
        return '🌊'; // Wave as fallback
    }
  };
  
  // Format location name for display (with proper spacing and capitalization)
  const getSeasonName = (season: Season) => {
    switch (season) {
      case 'sanfrancisco':
        return 'San Francisco';
      case 'longbeach':
        return 'Olympic Venue 2028';
      case 'newportharbor':
        return 'Newport Harbor';
      default:
        return season;
    }
  };
  
  return (
    <div className="absolute top-16 right-2 bg-opacity-90 bg-white dark:bg-gray-800 p-2 rounded-lg shadow-md z-50">
      <div className="flex flex-col items-start space-y-1">
        <div className="flex items-center space-x-2">
          <span className="text-lg font-semibold">
            {getSeasonIcon(currentSeason)} {getSeasonName(currentSeason)}
          </span>
          
          <div className="relative">
            <button
              onClick={() => setShowInfo(!showInfo)}
              className="p-1 text-gray-600 hover:text-blue-500 dark:text-gray-300 dark:hover:text-blue-400"
              aria-label="Location information"
            >
              <Info size={16} />
            </button>
            
            {showInfo && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 shadow-lg rounded-md p-3 text-xs z-50">
                <h4 className="font-semibold text-sm mb-1">{getSeasonName(currentSeason)} Conditions</h4>
                <div className="space-y-1">
                  <p>
                    <strong>Wind:</strong> {windBaseStrength.toFixed(1)} knots 
                    (from {windDirection === 0 ? 'North' : `${Math.round(windDirection)}°`})
                  </p>
                  <p>
                    <strong>Current:</strong> {currentStrength.toFixed(1)} knots 
                    {currentStrength > 0 ? `(flow ${Math.round(currentDirection)}°)` : ''}
                  </p>
                  <p className="text-gray-600 dark:text-gray-400 italic text-[10px] mt-1">
                    {/* Use descriptions directly from the wind store */}
                    {(() => {
                      // Get description from the location settings in the wind store
                      const locationSettings = {
                        sanfrancisco: "San Francisco Bay: Strong currents (2-3 knots), heavy winds (16-28 knots). Wind tends to shift more westerly than easterly (range: 350°-10°).",
                        longbeach: "Olympic Venue 2028: Olympic racing venue with variable winds (5-28 knots), light currents. Wind shifts equally in both directions (range: 350°-10°).", 
                        newportharbor: "Newport Harbor: No current, light to moderate winds (5-12 knots). Wind shifts rapidly in exact ±2° increments (range: 340°-20°)."
                      };
                      return locationSettings[currentSeason];
                    })()}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex flex-wrap gap-1 mt-1">
          {seasons.map(season => (
            <button
              key={season}
              onClick={() => {
                // Change the selected location
                changeSeason(season);
                
                // Reinitialize wind and current patterns based on the new location
                initializeWind();
                
                // Restart the race
                resetRace();
                setTimeout(() => {
                  startRace();
                }, 500); // Small delay to ensure wind is initialized
                
                console.log(`Changed location to ${getSeasonName(season)}, reinitialized conditions, and restarted race`);
              }}
              className={`px-2 py-1 text-xs rounded ${
                currentSeason === season
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {getSeasonIcon(season)} {getSeasonName(season)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}