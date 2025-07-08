import { useState, useEffect } from "react";
import { useRace, RaceResult } from "@/lib/stores/useRace";
import { useWind } from "@/lib/stores/useWind";
import { useGameSettings } from "@/lib/stores/useGameSettings";
import { useAuth } from "@/lib/stores/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "sonner";

// UI Components
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Trophy, RotateCcw, Wind, Navigation, Ship, ChevronLeft, ChevronRight } from "lucide-react";

export default function GameUI() {
  const {
    phase,
    timeRemaining,
    raceTime,
    startTime,
    results,
    boats,
    startCountdown,
    startRace,
    resetRace,
    initializeRace,
  } = useRace();

  const { baseStrength, direction, currentStrength, currentDirection } =
    useWind();
  const { singleBoatMode, toggleBoatMode } = useGameSettings();
  // Start with controls open by default on the landing screen
  const [showControls, setShowControls] = useState(true);
  const [resultsSaved, setResultsSaved] = useState(false);
  const { user, isAuthenticated } = useAuth();

  // Track which results have been saved to avoid duplicates
  // We now track by position (1 for 1st place, 2 for 2nd place, etc.)
  const [savedResultIds, setSavedResultIds] = useState<number[]>([]);

  // Handle boat count changes without restarting the race
  const { boatCount, setBoatCount, incrementBoatCount, decrementBoatCount } =
    useGameSettings();

  // Submit race results to update game statistics
  useEffect(() => {
    const submitRaceResults = async () => {
      // Debug authentication state
      console.log("Authentication state:", {
        isAuthenticated,
        userId: user?.id,
        username: user?.username,
      });

      // Only proceed if user is authenticated
      if (!isAuthenticated || !user) {
        console.log(
          "User not authenticated or user data missing, skipping race result submission",
        );
        return;
      }

      // Process each result that belongs to the current user and hasn't been saved yet
      for (const result of results) {
        // Debug result data
        console.log("Processing race result:", {
          resultUserId: result.userId,
          currentUserId: user.id,
          position: result.position,
          alreadySaved: savedResultIds.includes(result.position),
          time: result.finishTime,
        });

        // Only save results for the current user's boats
        if (
          result.userId === user.id &&
          !savedResultIds.includes(result.position)
        ) {
          try {
            console.log(
              `Submitting race result for position ${result.position}:`,
              result,
            );

            // Calculate total number of boats finished so far - we save the current state
            // even if the race is still in progress for some boats
            const numberBoatsFinished = results.length;

            // Use the boatNumber property to get the correct boat (not position)
            const boatNumber = result.boatNumber || 1; // Default to 1 if not specified

            // Get custom boat name if available from user profile (handle type-safely)
            let boatName = result.username;

            // Check which boat number this is and get the appropriate name
            if (boatNumber === 1 && user?.boat1Name) {
              boatName = user.boat1Name;
            } else if (boatNumber === 2 && user?.boat2Name) {
              boatName = user.boat2Name;
            } else if (boatNumber === 3 && user?.boat3Name) {
              boatName = user.boat3Name;
            } else if (boatNumber === 4 && user?.boat4Name) {
              boatName = user.boat4Name;
            }

            // Generate a unique race ID if not already created
            const raceId =
              window.localStorage.getItem("current-race-id") ||
              `race-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

            // Store the race ID for all boat finishes in this race
            if (!window.localStorage.getItem("current-race-id")) {
              window.localStorage.setItem("current-race-id", raceId);
            }

            // We need to validate that this boat actually completed all race stages
            // Only submit if it has the boatNumber property, which indicates it was properly processed
            // by the finishRace function (which now checks completion of all stages)
            if (result.boatNumber === undefined) {
              console.log(`Skipping result for ${result.username} - boat did not complete all race stages`);
              // Mark as saved anyway to avoid repeated attempts
              setSavedResultIds(prev => [...prev, result.position]);
              return;
            }
            
            // Submit individual race result with boat name and race ID
            // Include the boat number for reference, but position now represents finishing order
            const response = await apiRequest("POST", "/api/race/results", {
              position: result.position, // This is now the actual finish position (1st, 2nd, etc.)
              totalTime: result.finishTime,
              boatName: boatName,
              raceId: raceId,
              boatNumber: result.boatNumber, // Pass the boat number separately
            });

            console.log(
              "Race result saved successfully, server response:",
              response,
            );

            // Mark this result as saved
            setSavedResultIds((prev) => [...prev, result.position]);

            // Show clear feedback that the result was saved
            toast.success(
              `Race result for ${result.username} (position ${result.position}) saved!`,
              {
                duration: 5000,
                position: "top-center",
                icon: "🏆",
              },
            );
          } catch (error) {
            console.error(
              `Failed to save race result for position ${result.position}:`,
              error,
            );
            console.error("Error details:", error);
            toast.error(
              `Failed to save race result for position ${result.position}`,
            );
          }
        } else {
          console.log(
            `Skipping result for position ${result.position}:`,
            result.userId === user.id
              ? "Already saved"
              : `Belongs to different user (${result.userId}, not ${user.id})`,
          );
        }
      }

      // We don't need to wait for the phase to be "finished" to consider results saved
      // This ensures results are saved incrementally as boats finish
      if (results.length > 0 && !resultsSaved) {
        setResultsSaved(true);
      }
    };
    // Call submitRaceResults when new results come in
    if (results.length > 0) {
      console.log(`Attempting to submit ${results.length} race results`);
      submitRaceResults();
    }
  }, [results, isAuthenticated, user, savedResultIds, resultsSaved]);

  // Close controls panel when transitioning to the game screen
  useEffect(() => {
    if (phase === "racing") {
      console.log("Game started, closing controls panel");
      setShowControls(false);
    }
  }, [phase]);

  const handleBoatCountChange = (newCount: number) => {
    setBoatCount(newCount);
    console.log(`Changed to ${newCount} boat${newCount !== 1 ? "s" : ""} mode`);
  };

  // Format time as MM:SS
  const formatTime = (timeMs: number) => {
    const totalSeconds = Math.floor(timeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  };

  // Format countdown time
  const formatCountdown = (timeSeconds: number) => {
    const minutes = Math.floor(timeSeconds / 60);
    const seconds = Math.floor(timeSeconds % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  // Start a new race
  const handleNewRace = () => {
    setResultsSaved(false); // Reset the saved state

    // Clear the current race ID from localStorage to ensure a new one is generated
    window.localStorage.removeItem("current-race-id");

    // Reset race state and reload
    resetRace();
    window.location.reload(); // Refresh page to start completely fresh
  };

  // Toggle controls help
  const toggleControls = () => {
    setShowControls((prev) => !prev);
  };

  return (
    <div className="absolute inset-0 pointer-events-none">


      {/* Removed Race timer/countdown box as requested */}

      {/* Wind direction display moved to canvas below timer */}



      {/* Restart button - moved lower on mobile to avoid overlap with finish progress */}
      {phase !== "pre-start" && (
        <div className="absolute md:bottom-4 top-16 right-4 pointer-events-auto">
          <Button
            variant="outline"
            onClick={handleNewRace}
            className="border-white text-white hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Restart
          </Button>
        </div>
      )}

      {/* Start button (pre-start phase) - 300% bigger, centered, black bg, white text */}
      {phase === "pre-start" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-auto">
          <img
            src="/images/goat-sailing-logo.png"
            alt="GOAT Sailing Race Logo"
            className="w-96 h-auto mb-12"
          />
          <Button
            onClick={() => {
              console.log("Starting race immediately, current phase:", phase);

              // Use the current settings from the wind store based on location
              console.log(
                `Setting new current: ${currentDirection.toFixed(1)}° at ${currentStrength.toFixed(1)} knots`,
              );

              // Skip countdown and start race directly
              startRace();
            }}
            className="bg-black text-white border-2 border-white hover:bg-white hover:text-black transform scale-[3] px-8 py-4 text-xl font-bold rounded-lg shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-all duration-300"
          >
            START RACE
          </Button>
        </div>
      )}

      {/* Results display and new race button */}
      {phase === "finished" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Card className="bg-black/80 text-white p-6 max-w-md w-full pointer-events-auto">
            <div className="flex items-center justify-center mb-4">
              <Trophy className="h-8 w-8 text-yellow-400 mr-2" />
              <h2 className="text-2xl font-semibold">Race Results</h2>
            </div>

            <div className="space-y-2 mb-6">
              {results.map((result, index) => (
                <div
                  key={result.userId}
                  className={`flex items-center justify-between p-2 ${
                    result.userId === user?.id ? "bg-primary/20 rounded" : ""
                  }`}
                >
                  <div className="flex items-center">
                    <span className="font-semibold mr-2 text-base">
                      #{result.position}.
                    </span>
                    <span className="text-base">{result.username}</span>
                    {/* Add a saved indicator for results that were saved to the database */}
                    {savedResultIds.includes(result.position) &&
                      user?.id === result.userId && (
                        <span className="ml-2 text-xs bg-green-600 text-white px-1 py-0.5 rounded-sm">
                          Saved
                        </span>
                      )}
                  </div>
                  <div className="text-base">
                    {formatTime(result.finishTime)}
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleNewRace}
              className="w-full border-white text-white border hover:bg-white/10 text-base"
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              New Race
            </Button>
          </Card>
        </div>
      )}

      {/* Mini results panel when some boats have finished but race is still ongoing */}
      {phase === "racing" &&
        results.length > 0 &&
        results.length < boats.length && (
          <div className="absolute top-16 right-4 pointer-events-auto">
            <Card className="bg-black/60 text-white p-3 shadow-xl border border-gray-700">
              <h3 className="text-base font-semibold mb-2 flex items-center">
                <Trophy className="h-4 w-4 text-yellow-400 mr-1" />
                Standings
              </h3>
              <div className="space-y-1 text-base">
                {results.map((result) => (
                  <div
                    key={result.userId}
                    className="flex justify-between gap-4"
                  >
                    <span className="flex items-center">
                      {result.username}
                      {/* Add a saved indicator for results that were saved to the database */}
                      {savedResultIds.includes(result.position) &&
                        user?.id === result.userId && (
                          <span className="ml-2 text-xs bg-green-600 text-white px-1 py-0.5 rounded-sm">
                            Saved
                          </span>
                        )}
                    </span>
                    <span>{formatTime(result.finishTime)}</span>
                  </div>
                ))}

                {boats
                  .filter(
                    (boat) => !results.some((r) => r.userId === boat.userId),
                  )
                  .map((boat) => (
                    <div
                      key={boat.id}
                      className="flex justify-between gap-4 opacity-70"
                    >
                      <span>{boat.username}</span>
                      <span>Racing...</span>
                    </div>
                  ))}
              </div>
              
              {/* Boat Count Toggle - placed below player stats */}
              <div className="mt-3 pt-2 border-t border-gray-700">
                <Button
                  variant="outline"
                  onClick={() => {
                    // Cycle through 1-4 boats
                    const nextCount = boatCount >= 4 ? 1 : boatCount + 1;
                    handleBoatCountChange(nextCount);
                  }}
                  className="w-full flex items-center justify-center gap-2 border-white text-white hover:bg-white/10"
                >
                  <Ship className="h-4 w-4" />
                  <span>Boats: {boatCount}</span>
                </Button>
              </div>
            </Card>
          </div>
        )}

      {/* Mobile Touch Controls */}
      {phase === "racing" && (
        <>
          {/* Boat 1 Controls - Bottom Right */}
          <div className="md:hidden absolute bottom-4 right-4 flex flex-col gap-2 pointer-events-auto mobile-controls mobile-safe-padding">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-white text-center bg-black/50 px-2 py-1 rounded">
                {user?.boat1Name || "Boat 1"}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-12 h-12 p-0 bg-white/20 hover:bg-white/30 border-white/50 text-white"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    console.log('Mobile left button pressed');
                    const event = new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    console.log('Mobile left button released');
                    const event = new KeyboardEvent('keyup', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    console.log('Mobile left button mouse down');
                    const event = new KeyboardEvent('keydown', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    console.log('Mobile left button mouse up');
                    const event = new KeyboardEvent('keyup', { code: 'ArrowLeft', key: 'ArrowLeft', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-12 h-12 p-0 bg-white/20 hover:bg-white/30 border-white/50 text-white"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    console.log('Mobile right button pressed');
                    const event = new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    console.log('Mobile right button released');
                    const event = new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    console.log('Mobile right button mouse down');
                    const event = new KeyboardEvent('keydown', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    console.log('Mobile right button mouse up');
                    const event = new KeyboardEvent('keyup', { code: 'ArrowRight', key: 'ArrowRight', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>

          {/* Boat 2 Controls - Bottom Left */}
          <div className="md:hidden absolute bottom-4 left-4 flex flex-col gap-2 pointer-events-auto mobile-controls mobile-safe-padding">
            <div className="flex flex-col gap-1">
              <div className="text-xs text-white text-center bg-black/50 px-2 py-1 rounded">
                {user?.boat2Name || "Boat 2"}
              </div>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-12 h-12 p-0 bg-white/20 hover:bg-white/30 border-white/50 text-white"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 left button pressed');
                    const event = new KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 left button released');
                    const event = new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 left button mouse down');
                    const event = new KeyboardEvent('keydown', { code: 'KeyA', key: 'a', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 left button mouse up');
                    const event = new KeyboardEvent('keyup', { code: 'KeyA', key: 'a', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                >
                  <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-12 h-12 p-0 bg-white/20 hover:bg-white/30 border-white/50 text-white"
                  onTouchStart={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 right button pressed');
                    const event = new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 right button released');
                    const event = new KeyboardEvent('keyup', { code: 'KeyS', key: 's', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 right button mouse down');
                    const event = new KeyboardEvent('keydown', { code: 'KeyS', key: 's', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                  onMouseUp={(e) => {
                    e.preventDefault();
                    console.log('Mobile boat 2 right button mouse up');
                    const event = new KeyboardEvent('keyup', { code: 'KeyS', key: 's', bubbles: true });
                    window.dispatchEvent(event);
                  }}
                >
                  <ChevronRight className="h-6 w-6" />
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
