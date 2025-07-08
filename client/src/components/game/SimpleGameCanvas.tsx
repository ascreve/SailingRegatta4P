import { useRef, useEffect, useState } from "react";
import { useRace } from "@/lib/stores/useRace";
import { useAudio } from "@/lib/stores/useAudio";
import { useWind } from "@/lib/stores/useWind";
import { useSeason, getCurrentSeasonConfig } from "@/lib/stores/useSeason";
import { useGameSettings } from "@/lib/stores/useGameSettings";
import { useAuth } from "@/lib/stores/useAuth";
import { updateBoatPosition } from "@/lib/game/physics";

// Helper function to format time in MM:SS.ms format
const formatTime = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const milliseconds = Math.floor((ms % 1000) / 10); // Get only first 2 digits of ms

  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}.${milliseconds.toString().padStart(2, "0")}`;
};

export default function SimpleGameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const [width, setWidth] = useState(window.innerWidth * 0.9);
  const [height, setHeight] = useState(window.innerHeight * 0.9);
  const [keys, setKeys] = useState<Set<string>>(new Set());
  // Get current authenticated user for custom boat names
  const { user } = useAuth();
  const [boatState, setBoatState] = useState({
    x: window.innerWidth * 0.45,
    y: window.innerHeight * 0.95, // Positioned just above the bottom boundary
    rotation: 0, // Using compass angles (0 = North, 90 = East, 180 = South, 270 = West)
    speed: 0,
  });

  // State for stage transition effects
  const [transitionEffects, setTransitionEffects] = useState<
    Array<{
      x: number;
      y: number;
      color: string;
      size: number;
      createdAt: number;
    }>
  >([]);

  // Function to show stage transition effects
  const showStageTransitionEffect = (x: number, y: number, color: string) => {
    setTransitionEffects((prev) => [
      ...prev,
      {
        x,
        y,
        color,
        size: 10,
        createdAt: Date.now(),
      },
    ]);

    // Try to play transition sound if audio is initialized
    const audio = useAudio.getState();
    if (audio && audio.successSound) {
      audio.playSuccess();
    }
  };

  // Second boat state (controlled with A/S keys, D for luffing)
  const [boat2State, setBoat2State] = useState({
    x: window.innerWidth * 0.55, // Position slightly to the right of the first boat
    y: window.innerHeight * 0.95, // Positioned just above the bottom boundary
    rotation: 0, // Using compass angles (0 = North, 90 = East, 180 = South, 270 = West)
    speed: 0,
  });

  // Third boat state (controlled with M/N keys)
  const [boat3State, setBoat3State] = useState({
    x: window.innerWidth * 0.45, // Position slightly to the left
    y: window.innerHeight * 0.95, // Same y position as boat 1 and 2
    rotation: 0,
    speed: 0,
  });

  // Fourth boat state (controlled with 8/9 keys)
  const [boat4State, setBoat4State] = useState({
    x: window.innerWidth * 0.55, // Position slightly to the right
    y: window.innerHeight * 0.95, // Same y position as all other boats
    rotation: 0,
    speed: 0,
  });

  // Race stage tracking
  const [raceStage, setRaceStage] = useState<string>("Not Started");
  const [lastCheckpoint, setLastCheckpoint] = useState<number>(0);
  const [finishTime, setFinishTime] = useState<number | null>(null);
  const [raceStartTime, setRaceStartTime] = useState<number | null>(null);

  // Leaderboard state - track player times and positions
  const [leaderboard, setLeaderboard] = useState<
    Array<{ player: string; time: number }>
  >([]);

  // Wind puffs state - these are areas of stronger wind that move down the course
  const [windPuffs, setWindPuffs] = useState<
    Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      speedBoost: number;
      opacity: number;
      strength?: number; // Optional to maintain compatibility with existing code
      curveFactor?: number; // Controls shape variability (rounder or more elliptical)
    }>
  >([]);

  // Boat size constant for both rendering and physics (reduced by 50% from original)
  const boatRadius = Math.min(window.innerWidth, window.innerHeight) * 0.015; // 0.03 * 0.5 = 0.015

  // Function to check if a boat is in the turbulence/wind shadow zone of another boat
  const isInTurbulenceZone = (
    boatPos: { x: number; y: number }, // Position of the boat we're checking
    blockingBoatPos: { x: number; y: number }, // Position of the boat creating the wind shadow
    blockingBoatRotation: number, // Rotation of the boat creating the shadow
    shadowLength: number, // Length of the shadow zone
  ): boolean => {
    // Skip wind shadow check entirely in single boat mode
    if (singleBoatMode) {
      return false;
    }

    // The shadow should only affect boats behind the blocking boat relative to the wind
    // Since wind is coming from North (0 degrees), the shadow extends southward

    // Only check boats that are below (south of) the blocking boat
    if (boatPos.y <= blockingBoatPos.y) {
      return false; // Not in potential shadow zone
    }

    // Check if boat is within the defined shadow length
    const distance = Math.sqrt(
      Math.pow(boatPos.x - blockingBoatPos.x, 2) +
        Math.pow(boatPos.y - blockingBoatPos.y, 2),
    );

    if (distance > shadowLength) {
      return false; // Too far away to be affected
    }

    // For simplicity, we'll use a cone-shaped shadow zone extending southward
    // Check if boat is within this cone
    const shadowWidth = shadowLength * 0.5; // Half-width of shadow at its furthest extent
    const widthAtDistance = (distance / shadowLength) * shadowWidth;

    // Check if boat is within the horizontal bounds of the shadow
    return Math.abs(boatPos.x - blockingBoatPos.x) < widthAtDistance;
  };

  // Reference to track the race marks in a consistent way
  const topMarkRef = useRef({ x: 0, y: 0, radius: 0 });
  const bottomMarkRef = useRef({ x: 0, y: 0, radius: 0 });
  const startLineRef = useRef({ x1: 0, y1: 0, x2: 0, y2: 0 });

  // References to track boat finish state
  const boat1FinishedRef = useRef(false);
  const boat2FinishedRef = useRef(false);
  const boat3FinishedRef = useRef(false);
  const boat4FinishedRef = useRef(false);

  // Game pause state
  const [isPaused, setIsPaused] = useState(false);

  // Wind direction that shifts over time (0 = North)
  const [windDirection, setWindDirection] = useState(0);
  const windTrendRef = useRef(1); // 1 = shifting right, -1 = shifting left

  // Get wind and current settings from the wind store (initialized based on location)
  const windStore = useWind();
  const currentDirection = windStore.currentDirection;
  const currentStrength = windStore.currentStrength;

  // Current vector (direction and speed) - derived from wind store
  const [current, setCurrent] = useState({
    direction: 0, // Will be updated from the wind store
    speed: 0, // Will be updated from the wind store
  });

  // Get race state from the central store
  const {
    phase,
    timeRemaining,
    startRace,
    boat1Stage,
    boat2Stage,
    boat3Stage,
    boat4Stage,
  } = useRace();

  // Get the boat mode setting
  const { singleBoatMode } = useGameSettings();

  // Get the boat count from game settings (1-4 boats)
  const { boatCount } = useGameSettings();

  // Initialize audio effects
  useEffect(() => {
    // Load success sound for stage transitions
    const successSound = new Audio("/success.mp3");
    useAudio.getState().setSuccessSound(successSound);

    // Load collision sound
    const hitSound = new Audio("/hit.mp3");
    useAudio.getState().setHitSound(hitSound);

    // Initialize with sound unmuted for better user experience
    useAudio.setState({ isMuted: false });

    console.log("Audio effects initialized");

    return () => {
      // Clean up audio resources when component unmounts
      successSound.pause();
      hitSound.pause();
    };
  }, []);

  // Effect to initialize current state from wind store
  useEffect(() => {
    // Get current directly from the wind store
    const windStore = useWind.getState();
    const storeCurrentDirection = windStore.currentDirection;
    const storeCurrentStrength = windStore.currentStrength;

    // Initialize current with values from the wind store
    setCurrent({
      direction: storeCurrentDirection,
      speed: storeCurrentStrength / 10, // Convert knots to internal speed units (0-0.3 range)
    });

    // Also subscribe to wind store changes for current values
    const unsubscribeDirection = useWind.subscribe(
      (state) => state.currentDirection,
      (currentDirection) => {
        setCurrent((prev) => ({ ...prev, direction: currentDirection }));
      },
    );

    const unsubscribeStrength = useWind.subscribe(
      (state) => state.currentStrength,
      (currentStrength) => {
        setCurrent((prev) => ({ ...prev, speed: currentStrength / 10 }));
        console.log(
          `Current strength updated: ${currentStrength.toFixed(1)} knots`,
        );
      },
    );

    console.log(
      `Using current from wind store: Direction=${Math.round(storeCurrentDirection)}°, Strength=${storeCurrentStrength.toFixed(1)} knots`,
    );

    return () => {
      unsubscribeDirection();
      unsubscribeStrength();
    };
  }, []);

  // Effect to properly initialize race stages when race starts
  useEffect(() => {
    // When race phase changes to racing, initialize boat stages if not already set
    if (phase === "racing") {
      // Get current boat stages from race store
      const raceState = useRace.getState();
      const { boat1Stage, boat2Stage, boat3Stage, boat4Stage } = raceState;

      // Check if any active boat stages need initialization
      const needsInit =
        boat1Stage === "Not Started" ||
        (boatCount >= 2 && boat2Stage === "Not Started") ||
        (boatCount >= 3 && boat3Stage === "Not Started") ||
        (boatCount >= 4 && boat4Stage === "Not Started");

      if (needsInit) {
        console.log("Race started - initializing boat stages to Start Leg");

        // Create update object with all active boats set to "Start Leg"
        const stageUpdates: any = { boat1Stage: "Start Leg" };

        if (boatCount >= 2) stageUpdates.boat2Stage = "Start Leg";
        if (boatCount >= 3) stageUpdates.boat3Stage = "Start Leg";
        if (boatCount >= 4) stageUpdates.boat4Stage = "Start Leg";

        // Update race store with initialized stages
        useRace.setState(stageUpdates);

        // Also update local state
        setRaceStage("Start Leg");
        setRaceStartTime(Date.now());
      }
    }
  }, [phase, boatCount]);

  // Subscribe to season changes to update current values
  useEffect(() => {
    // Set up subscription to the season store
    const unsubscribe = useSeason.subscribe((state) => {
      // When season changes, get current values from wind store after a small delay
      // to ensure wind store is updated first
      setTimeout(() => {
        const currentSeason = state.currentSeason;
        const windStore = useWind.getState();
        const storeCurrentDirection = windStore.currentDirection;
        const storeCurrentStrength = windStore.currentStrength;

        // Update current with values from the wind store
        setCurrent({
          direction: storeCurrentDirection,
          speed: storeCurrentStrength / 10, // Convert knots to internal speed units (0-0.3 range)
        });

        console.log(
          `Current updated for ${currentSeason}: Direction=${Math.round(storeCurrentDirection)}°, Strength=${storeCurrentStrength.toFixed(1)} knots`,
        );
      }, 100);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // Set up keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle spacebar for pause/unpause
      if (e.code === "Space") {
        // Prevent default behavior like page scrolling
        e.preventDefault();

        // Force a direct state update for more reliable toggle behavior
        const newPausedState = !isPaused;
        console.log("Game " + (newPausedState ? "paused" : "resumed"));

        // Set the pause state directly
        setIsPaused(newPausedState);

        // When resuming the game, we'll force the animation loop to reset
        // timestamps on the next render to prevent jumps in physics/animation
        if (!newPausedState) {
          // Force next animation frame to set a new baseline time
          lastUpdateRef.current = null as unknown as number;
        }
      } else {
        // All other keys
        setKeys((prev) => {
          const newKeys = new Set(Array.from(prev));
          newKeys.add(e.code);
          return newKeys;
        });
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") {
        // Don't process Space in keyUp
        setKeys((prev) => {
          const newKeys = new Set(Array.from(prev));
          newKeys.delete(e.code);
          return newKeys;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [isPaused]); // Include isPaused in dependencies

  // Set up canvas and draw content with animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to 110% of window (zoom out 20%)
    const handleResize = () => {
      setWidth(window.innerWidth * 1.1);
      setHeight(window.innerHeight * 1.1);
      canvas.width = window.innerWidth * 1.1;
      canvas.height = window.innerHeight * 1.1;
    };

    // Initial resize
    handleResize();
    window.addEventListener("resize", handleResize);

    console.log(
      "Simple canvas initialized with size:",
      canvas.width,
      "x",
      canvas.height,
    );

    // Function to draw simple game elements
    const draw = (timestamp: number) => {
      if (!lastUpdateRef.current) {
        lastUpdateRef.current = timestamp;
      }

      // Calculate deltaTime, but if we're paused, set it to zero so no physics updates happen
      const deltaTime = isPaused
        ? 0
        : (timestamp - lastUpdateRef.current) / 1000; // Convert to seconds

      // Only update the timestamp if we're not paused to prevent large jumps when unpausing
      if (!isPaused) {
        lastUpdateRef.current = timestamp;
      }

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Get current season config (for non-visual effects)
      const seasonConfig = getCurrentSeasonConfig();

      // Draw standard blue background (no seasonal color changes as requested)
      ctx.fillStyle = "#1e3a8a"; // Deep blue background
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Set boundary margin constant (used throughout the code)
      const boundaryMargin = boatRadius * 2;

      // Randomly generate new wind puffs (only when racing and not paused)
      // Use season's puff frequency for generation chance
      if (
        phase === "racing" &&
        !isPaused &&
        Math.random() < (0.016 * seasonConfig.puffFrequency) / 0.1
      ) {
        // Create a new wind puff using season configuration for size, appearance, etc.
        // Base size adjusted by season's puffSize factor
        const basePuffWidth = (Math.random() * 100 + 50) * 1.8; // Basic size calculation (90-270px)
        const puffWidth = basePuffWidth * seasonConfig.puffSize; // Apply seasonal size adjustment

        // Vary the height-to-width ratio for more interesting shapes
        const heightRatio = 0.5 + Math.random() * 0.4; // Ratio between 0.5-0.9 for varied oval shapes
        const puffHeight = puffWidth * heightRatio;

        // Position randomly across the width of the course, but within boundaries
        const minX = boundaryMargin + puffWidth / 2;
        const maxX = canvas.width - boundaryMargin - puffWidth / 2;
        const puffX = Math.random() * (maxX - minX) + minX;

        // Randomize wind strength, with season-specific gust probabilities
        // Check if this should be a strong gust based on season settings
        let isGust =
          seasonConfig.gusts && Math.random() < seasonConfig.gustProbability;

        // Base wind strength with seasonal variability
        let windStrength =
          0.3 + Math.random() * 0.7 * seasonConfig.windVariability;

        // Apply gust strength multiplier if this is a gust
        if (isGust) {
          windStrength = Math.min(
            1.0,
            windStrength * seasonConfig.gustStrength,
          );
          console.log(
            `Seasonal gust generated with strength: ${windStrength.toFixed(2)}`,
          );
        }

        // Calculate speed boost based on wind strength
        const speedBoost = 0.2 + windStrength * 0.2; // 20-40% boost based on strength

        // Add variation in shape by storing a "curve factor" for drawing
        const curveFactor = 0.7 + Math.random() * 0.6; // Random between 0.7-1.3

        const newPuff = {
          x: puffX,
          y: -puffHeight, // Start just above the visible area
          width: puffWidth,
          height: puffHeight,
          speedBoost: speedBoost, // Variable speed boost based on strength
          opacity: seasonConfig.puffOpacity, // Use seasonal opacity setting
          strength: windStrength, // Store wind strength for color intensity
          curveFactor: curveFactor, // New property for varied curved shapes
        };

        setWindPuffs((prev) => [...prev, newPuff]);
      }

      // Draw wind puffs
      if (phase === "racing") {
        // Update wind puffs only if not paused
        if (!isPaused) {
          setWindPuffs((prev) => {
            return (
              prev
                // Move puffs downward - 15% faster than before
                .map((puff) => ({
                  ...puff,
                  y: puff.y + 34.5 * deltaTime, // Move at 34.5 pixels per second (30 * 1.15 = 34.5)
                  // Keep opacity constant instead of fading
                  opacity: puff.opacity,
                }))
                // Only remove puffs when they are completely below the canvas
                .filter((puff) => puff.y < canvas.height + puff.height)
            );
          });
        }

        // Draw wind puffs with varied but static curved shapes using seasonal colors
        for (const puff of windPuffs) {
          ctx.save();
          // Get color based on wind strength (back to standard blue, no seasonal variation)
          const strength = puff.strength || 0.5; // Default to 0.5 if not defined

          // Calculate color intensity based on strength (darker blue = stronger wind)
          // RGB values range from light (200, 255, 255) to dark (50, 100, 200)
          const r = Math.floor(200 - strength * 150);
          const g = Math.floor(255 - strength * 155);
          const b = Math.floor(255 - strength * 55);

          // Create a gradient fill for the puff with larger radius
          const curveFactor = puff.curveFactor || 1.0;
          const gradientRadius = puff.width / 1.2; // Larger gradient radius

          const puffGradient = ctx.createRadialGradient(
            puff.x,
            puff.y,
            0,
            puff.x,
            puff.y,
            gradientRadius,
          );
          puffGradient.addColorStop(
            0,
            `rgba(${r}, ${g}, ${b}, ${puff.opacity})`,
          );
          puffGradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);

          ctx.fillStyle = puffGradient;

          // Each puff's shape is determined by its curveFactor, which is set when created
          // This ensures shape variety but no vibration/variation during movement
          if (puff.curveFactor && puff.curveFactor > 1.0) {
            // Use bezier curves for organic shapes
            const halfWidth = puff.width / 2;
            const halfHeight = puff.height / 2;

            ctx.beginPath();
            // Start at left side
            ctx.moveTo(puff.x - halfWidth, puff.y);

            // Create fixed control points based on the puff's curveFactor
            const ctrlFactor = curveFactor; // Use exact curveFactor (no random variation)

            // Top curve
            ctx.bezierCurveTo(
              puff.x - halfWidth * 0.5,
              puff.y - halfHeight * ctrlFactor,
              puff.x + halfWidth * 0.5,
              puff.y - halfHeight * ctrlFactor,
              puff.x + halfWidth,
              puff.y,
            );

            // Right curve
            ctx.bezierCurveTo(
              puff.x + halfWidth * ctrlFactor,
              puff.y + halfHeight * 0.5,
              puff.x + halfWidth * ctrlFactor,
              puff.y + halfHeight * 0.5,
              puff.x,
              puff.y + halfHeight,
            );

            // Bottom curve
            ctx.bezierCurveTo(
              puff.x - halfWidth * 0.5,
              puff.y + halfHeight * ctrlFactor,
              puff.x - halfWidth * 0.5,
              puff.y + halfHeight * ctrlFactor,
              puff.x - halfWidth,
              puff.y,
            );
          } else {
            // Use ellipse with fixed rotation based on curveFactor
            // Convert curveFactor to a rotation angle (0-45 degrees)
            const rotationAngle = ((curveFactor - 0.7) * Math.PI) / 4;

            ctx.beginPath();
            ctx.ellipse(
              puff.x,
              puff.y,
              puff.width / 2,
              puff.height / 2,
              rotationAngle,
              0,
              Math.PI * 2,
            );
          }

          ctx.fill();
          ctx.restore();
        }
      }

      // Draw boundary indicators
      ctx.strokeStyle = "rgba(255, 0, 0, 0.3)"; // Semi-transparent red
      ctx.lineWidth = 3;
      ctx.setLineDash([10, 10]); // Dashed line
      ctx.strokeRect(
        boundaryMargin,
        boundaryMargin,
        canvas.width - boundaryMargin * 2,
        canvas.height - boundaryMargin * 2,
      );
      ctx.setLineDash([]); // Reset to solid line

      const centerX = canvas.width / 2;
      const margin = canvas.width * 0.1;

      // Draw start line at bottom of screen
      const startLineY = canvas.height * 0.85; // Moved to bottom 15% of screen
      const lineWidth = canvas.width * 0.5;

      ctx.beginPath();
      ctx.moveTo(centerX - lineWidth / 2, startLineY);
      ctx.lineTo(centerX + lineWidth / 2, startLineY);
      ctx.strokeStyle = "white";
      ctx.setLineDash([5, 5]); // Dotted line
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.setLineDash([]); // Reset

      // Draw start buoys (reduced by 50%)
      const buoySize = Math.min(canvas.width, canvas.height) * 0.015; // 0.03 * 0.5 = 0.015
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.rect(
        centerX - lineWidth / 2 - buoySize / 2,
        startLineY - buoySize / 2,
        buoySize,
        buoySize,
      );
      ctx.fill();
      ctx.beginPath();
      ctx.rect(
        centerX + lineWidth / 2 - buoySize / 2,
        startLineY - buoySize / 2,
        buoySize,
        buoySize,
      );
      ctx.fill();

      // Store left and right red buoy positions for collision detection
      const leftBuoyRef = {
        x: centerX - lineWidth / 2,
        y: startLineY,
        radius: buoySize / 2, // Use half of buoy size as "radius" for consistent collision
      };

      const rightBuoyRef = {
        x: centerX + lineWidth / 2,
        y: startLineY,
        radius: buoySize / 2, // Use half of buoy size as "radius" for consistent collision
      };

      // Draw race marks (top and bottom) with increased distance (reduced by 50%)
      const markRadius = Math.min(canvas.width, canvas.height) * 0.01; // 0.02 * 0.5 = 0.01

      // Top mark (orange) - moved higher
      const topMarkX = centerX;
      const topMarkY = canvas.height * 0.15;
      ctx.fillStyle = "orange";
      ctx.beginPath();
      ctx.arc(topMarkX, topMarkY, markRadius, 0, Math.PI * 2);
      ctx.fill();

      // Store top mark position for race stage tracking
      topMarkRef.current = { x: topMarkX, y: topMarkY, radius: markRadius };

      // Middle mark (yellow) - moved to just 1 boat length above start line
      const bottomMarkX = centerX;
      const markSpacing = boatRadius * 2; // 1 boat length spacing
      const bottomMarkY = startLineY - markSpacing; // 1 boat length above start line
      ctx.fillStyle = "yellow";
      ctx.beginPath();
      ctx.arc(bottomMarkX, bottomMarkY, markRadius, 0, Math.PI * 2);
      ctx.fill();

      // Store bottom mark position for race stage tracking
      bottomMarkRef.current = {
        x: bottomMarkX,
        y: bottomMarkY,
        radius: markRadius,
      };

      // Store start line position
      startLineRef.current = {
        x1: centerX - lineWidth / 2,
        y1: startLineY,
        x2: centerX + lineWidth / 2,
        y2: startLineY,
      };

      // Update wind direction to shift over time if not paused
      // Use location-specific wind shift patterns
      if (phase === "racing" && !isPaused) {
        // Get current location settings
        const { currentSeason } = useSeason.getState();

        // Use seasonal wind shift speed and range settings
        const shiftSpeed = seasonConfig.windShiftSpeed; // 0-1 (multiplier)
        const shiftRange = seasonConfig.windShiftRange; // degrees (±)

        // Adjust update frequency based on location
        let updateFrequency = 0.1; // Default (baseline)

        // Adjust frequency based on location
        if (currentSeason === "sanfrancisco") {
          // San Francisco: slow wind changes (10° range)
          updateFrequency = 0.07;
        } else if (currentSeason === "longbeach") {
          // Long Beach: slow wind changes (10° range)
          updateFrequency = 0.07;
        } else if (currentSeason === "newportharbor") {
          // Newport Harbor: rapid wind changes (20° range)
          updateFrequency = 0.15;
        }

        // Use location-specific update frequency
        if (
          Math.random() <
          updateFrequency * deltaTime * seasonConfig.windVariability
        ) {
          setWindDirection((prevDirection) => {
            // Calculate new direction based on current trend and seasonal speed
            let newDirection =
              prevDirection + windTrendRef.current * 0.5 * shiftSpeed;

            // Use seasonal shift range (±)
            if (newDirection >= shiftRange) {
              newDirection = shiftRange;
              windTrendRef.current = -1; // Start moving left
              console.log(
                `Wind shift reached maximum ${shiftRange}° - changing direction`,
              );
            } else if (newDirection <= -shiftRange) {
              newDirection = -shiftRange;
              windTrendRef.current = 1; // Start moving right
              console.log(
                `Wind shift reached minimum -${shiftRange}° - changing direction`,
              );
            }

            return newDirection;
          });

          // Current remains fixed during a race, as requested
        }
      }

      // Process movement controls if in racing phase and not paused
      if (phase === "racing" && !isPaused) {
        // Update boat based on keyboard input
        const rotationSpeed = 60 * deltaTime; // degrees per second
        const acceleration = 50 * deltaTime; // units per second²

        // ===== BOAT 1 CONTROLS (Arrow keys) =====
        // Left/Right for rotation (using compass angles 0-360)
        if (keys.has("ArrowLeft")) {
          setBoatState((prev) => {
            // Subtract rotation speed and normalize to 0-360 compass degrees
            let newRotation = prev.rotation - rotationSpeed;
            if (newRotation < 0) newRotation += 360;
            return { ...prev, rotation: newRotation };
          });
        }
        if (keys.has("ArrowRight")) {
          setBoatState((prev) => {
            // Add rotation speed and normalize to 0-360 compass degrees
            let newRotation = (prev.rotation + rotationSpeed) % 360;
            return { ...prev, rotation: newRotation };
          });
        }

        // Tacking functionality removed as requested

        // Update boat speed with wind physics
        if (!keys.has("ShiftLeft") && !keys.has("ShiftRight")) {
          // Use dynamic wind direction instead of fixed North (0)
          const boatDirection = boatState.rotation;

          // Calculate the relative angle more consistently (0-180)
          let relativeAngle = Math.abs(windDirection - boatDirection);

          // Normalize to 0-180 range (port and starboard are symmetrical)
          if (relativeAngle > 180) {
            relativeAngle = 360 - relativeAngle;
          }

          // Calculate wind efficiency factor (1.0 at beam reach, less upwind or downwind)
          // Best speed at 90° to wind, slower directly upwind or downwind
          let windEfficiency = 0;

          if (relativeAngle < 30) {
            // The "no-go" zone - within 30 degrees of wind direction, no movement
            windEfficiency = 0;
          } else if (relativeAngle < 60) {
            // Close hauled - moderate speed
            windEfficiency = 0.5;
          } else if (relativeAngle < 120) {
            // Beam reach - fastest
            windEfficiency = 1.0;
          } else if (relativeAngle < 150) {
            // Broad reach - fast
            windEfficiency = 0.8;
          } else {
            // Running - moderate speed
            windEfficiency = 0.6;
          }

          // Check if boat 1 is in the wind shadow zone of other boats
          let isInWindShadow = false;
          
          // Check against boat 2 if active
          if (!isInWindShadow && boatCount >= 2) {
            isInWindShadow = isInTurbulenceZone(
              { x: boatState.x, y: boatState.y },
              { x: boat2State.x, y: boat2State.y },
              boat2State.rotation,
              boatRadius * 6,
            );
          }
          
          // Check against boat 3 if active and not already in shadow
          if (!isInWindShadow && boatCount >= 3) {
            isInWindShadow = isInTurbulenceZone(
              { x: boatState.x, y: boatState.y },
              { x: boat3State.x, y: boat3State.y },
              boat3State.rotation,
              boatRadius * 6,
            );
          }
          
          // Check against boat 4 if active and not already in shadow
          if (!isInWindShadow && boatCount >= 4) {
            isInWindShadow = isInTurbulenceZone(
              { x: boatState.x, y: boatState.y },
              { x: boat4State.x, y: boat4State.y },
              boat4State.rotation,
              boatRadius * 6,
            );
          }

          // Apply wind shadow penalty if needed
          if (isInWindShadow) {
            windEfficiency = Math.max(0.1, windEfficiency - 0.2); // Reduce efficiency, min 0.1
            console.log("Boat 1 is in wind shadow!");
          }

          // Check if boat is in a wind puff
          let isInWindPuff = false;
          for (const puff of windPuffs) {
            // Use more accurate elliptical detection for curved puffs
            const distance = Math.sqrt(
              Math.pow((boatState.x - puff.x) / (puff.width / 2), 2) +
                Math.pow((boatState.y - puff.y) / (puff.height / 2), 2),
            );

            // If distance < 1, the boat is inside the elliptical area
            if (distance < 1) {
              isInWindPuff = true;
              // Only apply speed boost if not in irons (relativeAngle >= 30)
              if (relativeAngle >= 30) {
                windEfficiency += puff.speedBoost; // Apply speed boost
                console.log("Boat 1 is in a wind puff! Speed boost applied.");
              } else {
                console.log(
                  "Boat 1 is in a wind puff but in irons - no speed boost.",
                );
              }
              break;
            }
          }

          // Max speed reduced to 50 as requested
          const maxSpeed = 50 * windEfficiency;

          // Gradually increase speed if not luffing, taking wind into account
          setBoatState((prev) => ({
            ...prev,
            speed: Math.min(
              maxSpeed,
              prev.speed + acceleration * windEfficiency,
            ),
          }));
        } else {
          // Reduce speed when luffing
          setBoatState((prev) => ({
            ...prev,
            speed: Math.max(0, prev.speed - acceleration * 3),
          }));
        }

        // Calculate boat movement
        const radians = (boatState.rotation * Math.PI) / 180;
        const vx = Math.sin(radians) * boatState.speed * deltaTime;
        const vy = -Math.cos(radians) * boatState.speed * deltaTime;

        // Add current effect to movement (inverted - arrow shows where current flows FROM)
        const currentRadians = ((current.direction + 180) * Math.PI) / 180; // Add 180 degrees to invert direction
        const currentVx =
          Math.sin(currentRadians) * current.speed * 10 * deltaTime;
        const currentVy =
          -Math.cos(currentRadians) * current.speed * 10 * deltaTime;

        // Tentative new position for boat 1, including current effect
        let newBoat1X = boatState.x + vx + currentVx;
        let newBoat1Y = boatState.y + vy + currentVy;

        // Apply boundary constraints for boat 1
        if (newBoat1X < boundaryMargin) {
          newBoat1X = boundaryMargin;
        } else if (newBoat1X > canvas.width - boundaryMargin) {
          newBoat1X = canvas.width - boundaryMargin;
        }

        if (newBoat1Y < boundaryMargin) {
          newBoat1Y = boundaryMargin;
        } else if (newBoat1Y > canvas.height - boundaryMargin) {
          newBoat1Y = canvas.height - boundaryMargin;
        }

        // ===== BOAT 2 CONTROLS (A/S keys) =====
        // Only process boat 2 controls if at least 2 boats are in play
        if (boatCount >= 2) {
          // A/S for rotation (using compass angles 0-360)
          if (keys.has("KeyA")) {
            setBoat2State((prev) => {
              // Subtract rotation speed and normalize to 0-360 compass degrees
              let newRotation = prev.rotation - rotationSpeed;
              if (newRotation < 0) newRotation += 360;
              return { ...prev, rotation: newRotation };
            });
          }
          if (keys.has("KeyS")) {
            setBoat2State((prev) => {
              // Add rotation speed and normalize to 0-360 compass degrees
              let newRotation = (prev.rotation + rotationSpeed) % 360;
              return { ...prev, rotation: newRotation };
            });
          }
        }

        // ===== BOAT 3 CONTROLS (M/N keys) =====
        // Only process boat 3 controls if at least 3 boats are in play
        if (boatCount >= 3) {
          // M/N for rotation (using compass angles 0-360)
          if (keys.has("KeyN")) {
            setBoat3State((prev) => {
              // Subtract rotation speed and normalize to 0-360 compass degrees
              let newRotation = prev.rotation - rotationSpeed;
              if (newRotation < 0) newRotation += 360;
              return { ...prev, rotation: newRotation };
            });
          }
          if (keys.has("KeyM")) {
            setBoat3State((prev) => {
              // Add rotation speed and normalize to 0-360 compass degrees
              let newRotation = (prev.rotation + rotationSpeed) % 360;
              return { ...prev, rotation: newRotation };
            });
          }
        }

        // ===== BOAT 4 CONTROLS (8/9 numeric keys) =====
        // Only process boat 4 controls if all 4 boats are in play
        if (boatCount >= 4) {
          // Numpad8/Numpad9 or Digit8/Digit9 for rotation (using compass angles 0-360)
          if (keys.has("Numpad8") || keys.has("Digit8")) {
            setBoat4State((prev) => {
              // Subtract rotation speed and normalize to 0-360 compass degrees
              let newRotation = prev.rotation - rotationSpeed;
              if (newRotation < 0) newRotation += 360;
              return { ...prev, rotation: newRotation };
            });
          }
          if (keys.has("Numpad9") || keys.has("Digit9")) {
            setBoat4State((prev) => {
              // Add rotation speed and normalize to 0-360 compass degrees
              let newRotation = (prev.rotation + rotationSpeed) % 360;
              return { ...prev, rotation: newRotation };
            });
          }
        }

        // Update boat2 speed with wind physics - only if at least 2 boats are in play
        if (boatCount >= 2) {
          if (!keys.has("KeyD")) {
            // Use dynamic wind direction for boat 2 as well
            const boat2Direction = boat2State.rotation;

            // Calculate the relative angle more consistently (0-180)
            let relativeAngle2 = Math.abs(windDirection - boat2Direction);

            // Normalize to 0-180 range (port and starboard are symmetrical)
            if (relativeAngle2 > 180) {
              relativeAngle2 = 360 - relativeAngle2;
            }

            // Calculate wind efficiency factor
            let windEfficiency2 = 0;

            if (relativeAngle2 < 30) {
              // The "no-go" zone - within 30 degrees of wind direction, no movement
              windEfficiency2 = 0;
            } else if (relativeAngle2 < 60) {
              windEfficiency2 = 0.5;
            } else if (relativeAngle2 < 120) {
              windEfficiency2 = 1.0;
            } else if (relativeAngle2 < 150) {
              windEfficiency2 = 0.8;
            } else {
              windEfficiency2 = 0.6;
            }

            // Check if boat 2 is in the wind shadow/turbulence zone of other boats
            let isInWindShadow2 = false;
            
            // Check against boat 1
            isInWindShadow2 = isInTurbulenceZone(
              { x: boat2State.x, y: boat2State.y },
              { x: boatState.x, y: boatState.y },
              boatState.rotation,
              boatRadius * 6,
            );
            
            // Check against boat 3 if not already in shadow and boat 3 is active
            if (!isInWindShadow2 && boatCount >= 3) {
              isInWindShadow2 = isInTurbulenceZone(
                { x: boat2State.x, y: boat2State.y },
                { x: boat3State.x, y: boat3State.y },
                boat3State.rotation,
                boatRadius * 6,
              );
            }
            
            // Check against boat 4 if not already in shadow and boat 4 is active
            if (!isInWindShadow2 && boatCount >= 4) {
              isInWindShadow2 = isInTurbulenceZone(
                { x: boat2State.x, y: boat2State.y },
                { x: boat4State.x, y: boat4State.y },
                boat4State.rotation,
                boatRadius * 6,
              );
            }

            // Apply wind shadow penalty if needed
            if (isInWindShadow2) {
              windEfficiency2 = Math.max(0.1, windEfficiency2 - 0.2); // Reduce efficiency, min 0.1
              console.log("Boat 2 is in wind shadow!");
            }

            // Check if boat 2 is in a wind puff
            let isInWindPuff2 = false;
            for (const puff of windPuffs) {
              // Use more accurate elliptical detection for curved puffs
              const distance = Math.sqrt(
                Math.pow((boat2State.x - puff.x) / (puff.width / 2), 2) +
                  Math.pow((boat2State.y - puff.y) / (puff.height / 2), 2),
              );

              // If distance < 1, the boat is inside the elliptical area
              if (distance < 1) {
                isInWindPuff2 = true;
                // Only apply speed boost if not in irons (relativeAngle2 >= 30)
                if (relativeAngle2 >= 30) {
                  windEfficiency2 += puff.speedBoost; // Apply speed boost
                  console.log("Boat 2 is in a wind puff! Speed boost applied.");
                } else {
                  console.log(
                    "Boat 2 is in a wind puff but in irons - no speed boost.",
                  );
                }
                break;
              }
            }

            // Max speed
            const maxSpeed2 = 50 * windEfficiency2;

            // Gradually increase speed if not luffing
            setBoat2State((prev) => ({
              ...prev,
              speed: Math.min(
                maxSpeed2,
                prev.speed + acceleration * windEfficiency2,
              ),
            }));
          } else {
            // Reduce speed when luffing
            setBoat2State((prev) => ({
              ...prev,
              speed: Math.max(0, prev.speed - acceleration * 3),
            }));
          }
        }

        // Update boat3 speed with wind physics - only if at least 3 boats are in play
        if (boatCount >= 3) {
          if (!keys.has("Comma")) {
            // Same wind physics as boat 2
            const boat3Direction = boat3State.rotation;

            // Calculate the relative angle more consistently (0-180)
            let relativeAngle3 = Math.abs(windDirection - boat3Direction);

            // Normalize to 0-180 range (port and starboard are symmetrical)
            if (relativeAngle3 > 180) {
              relativeAngle3 = 360 - relativeAngle3;
            }

            // Calculate wind efficiency factor
            let windEfficiency3 = 0;

            if (relativeAngle3 < 30) {
              // The "no-go" zone - within 30 degrees of wind direction, no movement
              windEfficiency3 = 0;
            } else if (relativeAngle3 < 60) {
              windEfficiency3 = 0.5;
            } else if (relativeAngle3 < 120) {
              windEfficiency3 = 1.0;
            } else if (relativeAngle3 < 150) {
              windEfficiency3 = 0.8;
            } else {
              windEfficiency3 = 0.6;
            }

            // Check if boat 3 is in the wind shadow zone of other boats
            let isInWindShadow3 = false;
            // Check against boat 1
            isInWindShadow3 = isInTurbulenceZone(
              { x: boat3State.x, y: boat3State.y },
              { x: boatState.x, y: boatState.y },
              boatState.rotation,
              boatRadius * 6,
            );

            // Check against boat 2 if not already in shadow
            if (!isInWindShadow3 && boatCount >= 2) {
              isInWindShadow3 = isInTurbulenceZone(
                { x: boat3State.x, y: boat3State.y },
                { x: boat2State.x, y: boat2State.y },
                boat2State.rotation,
                boatRadius * 6,
              );
            }
            
            // Check against boat 4 if not already in shadow and boat 4 is active
            if (!isInWindShadow3 && boatCount >= 4) {
              isInWindShadow3 = isInTurbulenceZone(
                { x: boat3State.x, y: boat3State.y },
                { x: boat4State.x, y: boat4State.y },
                boat4State.rotation,
                boatRadius * 6,
              );
            }

            // Apply wind shadow penalty if needed
            if (isInWindShadow3) {
              windEfficiency3 = Math.max(0.1, windEfficiency3 - 0.2); // Reduce efficiency, min 0.1
              console.log("Boat 3 is in wind shadow!");
            }

            // Check if boat 3 is in a wind puff
            for (const puff of windPuffs) {
              // Use elliptical detection for curved puffs
              const distance = Math.sqrt(
                Math.pow((boat3State.x - puff.x) / (puff.width / 2), 2) +
                  Math.pow((boat3State.y - puff.y) / (puff.height / 2), 2),
              );

              // If distance < 1, the boat is inside the elliptical area
              if (distance < 1) {
                // Only apply speed boost if not in irons (relativeAngle3 >= 30)
                if (relativeAngle3 >= 30) {
                  windEfficiency3 += puff.speedBoost; // Apply speed boost
                  console.log("Boat 3 is in a wind puff! Speed boost applied.");
                }
                break;
              }
            }

            // Max speed
            const maxSpeed3 = 50 * windEfficiency3;

            // Gradually increase speed
            setBoat3State((prev) => ({
              ...prev,
              speed: Math.min(
                maxSpeed3,
                prev.speed + acceleration * windEfficiency3,
              ),
            }));
          } else {
            // Reduce speed when luffing with comma key
            setBoat3State((prev) => ({
              ...prev,
              speed: Math.max(0, prev.speed - acceleration * 3),
            }));
          }
        }

        // Update boat4 speed with wind physics - only if 4 boats are in play
        if (boatCount >= 4) {
          if (!keys.has("Digit0") && !keys.has("Numpad0")) {
            // Same wind physics as other boats
            const boat4Direction = boat4State.rotation;

            // Calculate the relative angle (0-180)
            let relativeAngle4 = Math.abs(windDirection - boat4Direction);

            // Normalize to 0-180 range
            if (relativeAngle4 > 180) {
              relativeAngle4 = 360 - relativeAngle4;
            }

            // Calculate wind efficiency factor
            let windEfficiency4 = 0;

            if (relativeAngle4 < 30) {
              // The "no-go" zone - within 30 degrees of wind direction
              windEfficiency4 = 0;
            } else if (relativeAngle4 < 60) {
              windEfficiency4 = 0.5;
            } else if (relativeAngle4 < 120) {
              windEfficiency4 = 1.0;
            } else if (relativeAngle4 < 150) {
              windEfficiency4 = 0.8;
            } else {
              windEfficiency4 = 0.6;
            }

            // Check if boat 4 is in the wind shadow zone of other boats
            let isInWindShadow4 = false;
            
            // Check against boat 1
            isInWindShadow4 = isInTurbulenceZone(
              { x: boat4State.x, y: boat4State.y },
              { x: boatState.x, y: boatState.y },
              boatState.rotation,
              boatRadius * 6,
            );
            
            // Check against boat 2 if not already in shadow
            if (!isInWindShadow4 && boatCount >= 2) {
              isInWindShadow4 = isInTurbulenceZone(
                { x: boat4State.x, y: boat4State.y },
                { x: boat2State.x, y: boat2State.y },
                boat2State.rotation,
                boatRadius * 6,
              );
            }
            
            // Check against boat 3 if not already in shadow
            if (!isInWindShadow4 && boatCount >= 3) {
              isInWindShadow4 = isInTurbulenceZone(
                { x: boat4State.x, y: boat4State.y },
                { x: boat3State.x, y: boat3State.y },
                boat3State.rotation,
                boatRadius * 6,
              );
            }

            // Apply wind shadow penalty if needed
            if (isInWindShadow4) {
              windEfficiency4 = Math.max(0.1, windEfficiency4 - 0.2); // Reduce efficiency, min 0.1
              console.log("Boat 4 is in wind shadow!");
            }

            // Check if boat 4 is in a wind puff
            for (const puff of windPuffs) {
              // Use elliptical detection for curved puffs
              const distance = Math.sqrt(
                Math.pow((boat4State.x - puff.x) / (puff.width / 2), 2) +
                  Math.pow((boat4State.y - puff.y) / (puff.height / 2), 2),
              );

              // If distance < 1, the boat is inside the elliptical area
              if (distance < 1) {
                // Only apply speed boost if not in irons (relativeAngle4 >= 30)
                if (relativeAngle4 >= 30) {
                  windEfficiency4 += puff.speedBoost; // Apply speed boost
                  console.log("Boat 4 is in a wind puff! Speed boost applied.");
                }
                break;
              }
            }

            // Max speed
            const maxSpeed4 = 50 * windEfficiency4;

            // Gradually increase speed
            setBoat4State((prev) => ({
              ...prev,
              speed: Math.min(
                maxSpeed4,
                prev.speed + acceleration * windEfficiency4,
              ),
            }));
          } else {
            // Reduce speed when luffing with 0 key
            setBoat4State((prev) => ({
              ...prev,
              speed: Math.max(0, prev.speed - acceleration * 3),
            }));
          }
        }

        // Calculate movements for all active boats
        // Boat 2 movement
        const radians2 = (boat2State.rotation * Math.PI) / 180;
        const vx2 = Math.sin(radians2) * boat2State.speed * deltaTime;
        const vy2 = -Math.cos(radians2) * boat2State.speed * deltaTime;

        // Boat 3 movement
        const radians3 = (boat3State.rotation * Math.PI) / 180;
        const vx3 = Math.sin(radians3) * boat3State.speed * deltaTime;
        const vy3 = -Math.cos(radians3) * boat3State.speed * deltaTime;

        // Boat 4 movement
        const radians4 = (boat4State.rotation * Math.PI) / 180;
        const vx4 = Math.sin(radians4) * boat4State.speed * deltaTime;
        const vy4 = -Math.cos(radians4) * boat4State.speed * deltaTime;

        // Add current effect to boat movements (using same current for all boats)
        // Tentative new positions including current effect
        let newBoat2X = boat2State.x + vx2 + currentVx;
        let newBoat2Y = boat2State.y + vy2 + currentVy;
        let newBoat3X = boat3State.x + vx3 + currentVx;
        let newBoat3Y = boat3State.y + vy3 + currentVy;
        let newBoat4X = boat4State.x + vx4 + currentVx;
        let newBoat4Y = boat4State.y + vy4 + currentVy;

        // Apply boundary constraints for boat 2
        if (newBoat2X < boundaryMargin) {
          newBoat2X = boundaryMargin;
        } else if (newBoat2X > canvas.width - boundaryMargin) {
          newBoat2X = canvas.width - boundaryMargin;
        }

        if (newBoat2Y < boundaryMargin) {
          newBoat2Y = boundaryMargin;
        } else if (newBoat2Y > canvas.height - boundaryMargin) {
          newBoat2Y = canvas.height - boundaryMargin;
        }

        // Apply boundary constraints for boat 3
        if (boatCount >= 3) {
          if (newBoat3X < boundaryMargin) {
            newBoat3X = boundaryMargin;
          } else if (newBoat3X > canvas.width - boundaryMargin) {
            newBoat3X = canvas.width - boundaryMargin;
          }

          if (newBoat3Y < boundaryMargin) {
            newBoat3Y = boundaryMargin;
          } else if (newBoat3Y > canvas.height - boundaryMargin) {
            newBoat3Y = canvas.height - boundaryMargin;
          }
        }

        // Apply boundary constraints for boat 4
        if (boatCount >= 4) {
          if (newBoat4X < boundaryMargin) {
            newBoat4X = boundaryMargin;
          } else if (newBoat4X > canvas.width - boundaryMargin) {
            newBoat4X = canvas.width - boundaryMargin;
          }

          if (newBoat4Y < boundaryMargin) {
            newBoat4Y = boundaryMargin;
          } else if (newBoat4Y > canvas.height - boundaryMargin) {
            newBoat4Y = canvas.height - boundaryMargin;
          }
        }

        // Variables to track if we need to adjust positions due to boat-boat collision
        let boat1NeedsAdjustment = false;
        let boat2NeedsAdjustment = false;
        let boat3NeedsAdjustment = false;
        let boat4NeedsAdjustment = false;

        let newBoat1XWithMarks = newBoat1X;
        let newBoat1YWithMarks = newBoat1Y;
        let newBoat2XWithMarks = newBoat2X;
        let newBoat2YWithMarks = newBoat2Y;
        let newBoat3XWithMarks = newBoat3X;
        let newBoat3YWithMarks = newBoat3Y;
        let newBoat4XWithMarks = newBoat4X;
        let newBoat4YWithMarks = newBoat4Y;

        let boat1SpeedAdjusted = boatState.speed;
        let boat2SpeedAdjusted = boat2State.speed;
        let boat3SpeedAdjusted = boat3State.speed;
        let boat4SpeedAdjusted = boat4State.speed;

        // Collision detection between all active boats
        if (boatCount >= 2) {
          // Create an array of active boat positions and states for easier collision detection
          interface BoatCollisionInfo {
            id: number;
            x: number;
            y: number;
            speed: number;
            needsAdjustment: boolean;
          }

          const activeBoats: BoatCollisionInfo[] = [
            {
              id: 1,
              x: newBoat1X,
              y: newBoat1Y,
              speed: boatState.speed,
              needsAdjustment: false,
            },
            {
              id: 2,
              x: newBoat2X,
              y: newBoat2Y,
              speed: boat2State.speed,
              needsAdjustment: false,
            },
          ];

          // Add boat 3 if active
          if (boatCount >= 3) {
            activeBoats.push({
              id: 3,
              x: newBoat3X,
              y: newBoat3Y,
              speed: boat3State.speed,
              needsAdjustment: false,
            });
          }

          // Add boat 4 if active
          if (boatCount >= 4) {
            activeBoats.push({
              id: 4,
              x: newBoat4X,
              y: newBoat4Y,
              speed: boat4State.speed,
              needsAdjustment: false,
            });
          }

          // Check collisions between all pairs of boats
          for (let i = 0; i < activeBoats.length; i++) {
            for (let j = i + 1; j < activeBoats.length; j++) {
              const boat1 = activeBoats[i];
              const boat2 = activeBoats[j];

              // Calculate distance between boats
              const distance = Math.sqrt(
                Math.pow(boat1.x - boat2.x, 2) + Math.pow(boat1.y - boat2.y, 2),
              );

              // If boats would collide, handle it
              if (distance < boatRadius * 2) {
                boat1.needsAdjustment = true;
                boat2.needsAdjustment = true;

                // Calculate angle between boats for deflection
                const collisionAngle = Math.atan2(
                  boat2.y - boat1.y,
                  boat2.x - boat1.x,
                );

                // Use the exact same push distance formula as boat-mark collisions
                const pushDistance = Math.max(
                  (boatRadius * 2 - distance) * 0.75,
                  boatRadius * 0.25,
                );
                const pushX = Math.cos(collisionAngle) * pushDistance;
                const pushY = Math.sin(collisionAngle) * pushDistance;

                // Update boat positions in the array
                if (boat1.id === 1) {
                  newBoat1XWithMarks = boat1.x - pushX;
                  newBoat1YWithMarks = boat1.y - pushY;
                  boat1SpeedAdjusted = boat1.speed * 0.95;
                } else if (boat1.id === 2) {
                  newBoat2XWithMarks = boat1.x - pushX;
                  newBoat2YWithMarks = boat1.y - pushY;
                  boat2SpeedAdjusted = boat1.speed * 0.95;
                } else if (boat1.id === 3) {
                  newBoat3XWithMarks = boat1.x - pushX;
                  newBoat3YWithMarks = boat1.y - pushY;
                  boat3SpeedAdjusted = boat1.speed * 0.95;
                } else if (boat1.id === 4) {
                  newBoat4XWithMarks = boat1.x - pushX;
                  newBoat4YWithMarks = boat1.y - pushY;
                  boat4SpeedAdjusted = boat1.speed * 0.95;
                }

                if (boat2.id === 1) {
                  newBoat1XWithMarks = boat2.x + pushX;
                  newBoat1YWithMarks = boat2.y + pushY;
                  boat1SpeedAdjusted = boat2.speed * 0.95;
                } else if (boat2.id === 2) {
                  newBoat2XWithMarks = boat2.x + pushX;
                  newBoat2YWithMarks = boat2.y + pushY;
                  boat2SpeedAdjusted = boat2.speed * 0.95;
                } else if (boat2.id === 3) {
                  newBoat3XWithMarks = boat2.x + pushX;
                  newBoat3YWithMarks = boat2.y + pushY;
                  boat3SpeedAdjusted = boat2.speed * 0.95;
                } else if (boat2.id === 4) {
                  newBoat4XWithMarks = boat2.x + pushX;
                  newBoat4YWithMarks = boat2.y + pushY;
                  boat4SpeedAdjusted = boat2.speed * 0.95;
                }

                // Log collision and play sound effect
                console.log(
                  `Boats ${boat1.id} and ${boat2.id} collided and separated!`,
                );

                // Play collision sound
                useAudio.getState().playHit();
              }
            }
          }

          // Update boat adjustment flags based on the collision checks
          boat1NeedsAdjustment = activeBoats[0].needsAdjustment;
          boat2NeedsAdjustment = activeBoats[1].needsAdjustment;

          if (boatCount >= 3) {
            boat3NeedsAdjustment = activeBoats[2].needsAdjustment;
          }

          if (boatCount >= 4) {
            boat4NeedsAdjustment = activeBoats[3].needsAdjustment;
          }
        }

        // Continue with other checks regardless of boat mode
        {
          // Check for collisions with marks
          const topMark = topMarkRef.current;
          const bottomMark = bottomMarkRef.current;

          // Check collision with top mark for boat 1
          const distanceToTopMark1 = Math.sqrt(
            Math.pow(newBoat1X - topMark.x, 2) +
              Math.pow(newBoat1Y - topMark.y, 2),
          );

          // Check collision with bottom mark for boat 1
          const distanceToBottomMark1 = Math.sqrt(
            Math.pow(newBoat1X - bottomMark.x, 2) +
              Math.pow(newBoat1Y - bottomMark.y, 2),
          );

          // Check collision with left red buoy for boat 1
          const distanceToLeftBuoy1 = Math.sqrt(
            Math.pow(newBoat1X - leftBuoyRef.x, 2) +
              Math.pow(newBoat1Y - leftBuoyRef.y, 2),
          );

          // Check collision with right red buoy for boat 1
          const distanceToRightBuoy1 = Math.sqrt(
            Math.pow(newBoat1X - rightBuoyRef.x, 2) +
              Math.pow(newBoat1Y - rightBuoyRef.y, 2),
          );

          // Check collision with top mark for boat 2
          const distanceToTopMark2 = Math.sqrt(
            Math.pow(newBoat2X - topMark.x, 2) +
              Math.pow(newBoat2Y - topMark.y, 2),
          );

          // Check collision with bottom mark for boat 2
          const distanceToBottomMark2 = Math.sqrt(
            Math.pow(newBoat2X - bottomMark.x, 2) +
              Math.pow(newBoat2Y - bottomMark.y, 2),
          );

          // Check collision with left red buoy for boat 2
          const distanceToLeftBuoy2 = Math.sqrt(
            Math.pow(newBoat2X - leftBuoyRef.x, 2) +
              Math.pow(newBoat2Y - leftBuoyRef.y, 2),
          );

          // Check collision with right red buoy for boat 2
          const distanceToRightBuoy2 = Math.sqrt(
            Math.pow(newBoat2X - rightBuoyRef.x, 2) +
              Math.pow(newBoat2Y - rightBuoyRef.y, 2),
          );

          // Check collision distances for boat 3 (if active)
          let distanceToTopMark3 = 0;
          let distanceToBottomMark3 = 0;
          let distanceToLeftBuoy3 = 0;
          let distanceToRightBuoy3 = 0;
          
          if (boatCount >= 3) {
            distanceToTopMark3 = Math.sqrt(
              Math.pow(newBoat3X - topMark.x, 2) +
                Math.pow(newBoat3Y - topMark.y, 2),
            );
            distanceToBottomMark3 = Math.sqrt(
              Math.pow(newBoat3X - bottomMark.x, 2) +
                Math.pow(newBoat3Y - bottomMark.y, 2),
            );
            distanceToLeftBuoy3 = Math.sqrt(
              Math.pow(newBoat3X - leftBuoyRef.x, 2) +
                Math.pow(newBoat3Y - leftBuoyRef.y, 2),
            );
            distanceToRightBuoy3 = Math.sqrt(
              Math.pow(newBoat3X - rightBuoyRef.x, 2) +
                Math.pow(newBoat3Y - rightBuoyRef.y, 2),
            );
          }

          // Check collision distances for boat 4 (if active)
          let distanceToTopMark4 = 0;
          let distanceToBottomMark4 = 0;
          let distanceToLeftBuoy4 = 0;
          let distanceToRightBuoy4 = 0;
          
          if (boatCount >= 4) {
            distanceToTopMark4 = Math.sqrt(
              Math.pow(newBoat4X - topMark.x, 2) +
                Math.pow(newBoat4Y - topMark.y, 2),
            );
            distanceToBottomMark4 = Math.sqrt(
              Math.pow(newBoat4X - bottomMark.x, 2) +
                Math.pow(newBoat4Y - bottomMark.y, 2),
            );
            distanceToLeftBuoy4 = Math.sqrt(
              Math.pow(newBoat4X - leftBuoyRef.x, 2) +
                Math.pow(newBoat4Y - leftBuoyRef.y, 2),
            );
            distanceToRightBuoy4 = Math.sqrt(
              Math.pow(newBoat4X - rightBuoyRef.x, 2) +
                Math.pow(newBoat4Y - rightBuoyRef.y, 2),
            );
          }

          // We're already using the adjustment variables from the boat-boat collision section

          // Handle mark collisions using exactly the same approach as boat-boat collisions

          // Boat 1 collision with top mark
          if (distanceToTopMark1 < boatRadius + topMark.radius) {
            boat1NeedsAdjustment = true;
            // Calculate angle between boat and mark for deflection (same as boat-boat collision)
            const collisionAngle = Math.atan2(
              newBoat1Y - topMark.y,
              newBoat1X - topMark.x,
            );

            // Use the exact same push distance formula as boat-boat collisions
            const pushDistance = Math.max(
              (boatRadius + topMark.radius - distanceToTopMark1) * 0.75,
              boatRadius * 0.25,
            );

            // Calculate new position using the same approach
            newBoat1XWithMarks =
              newBoat1X + Math.cos(collisionAngle) * pushDistance;
            newBoat1YWithMarks =
              newBoat1Y + Math.sin(collisionAngle) * pushDistance;

            // Same speed reduction as boat-boat collisions
            boat1SpeedAdjusted = boatState.speed * 0.95;

            // Play hit sound for mark collision
            useAudio.getState().playHit();

            console.log("Boat 1 hit top mark!");
          }

          // Boat 1 collision with bottom mark
          if (distanceToBottomMark1 < boatRadius + bottomMark.radius) {
            boat1NeedsAdjustment = true;
            // Calculate angle between boat and mark for deflection
            const collisionAngle = Math.atan2(
              newBoat1Y - bottomMark.y,
              newBoat1X - bottomMark.x,
            );

            // Use same push distance formula
            const pushDistance = Math.max(
              (boatRadius + bottomMark.radius - distanceToBottomMark1) * 0.75,
              boatRadius * 0.25,
            );

            newBoat1XWithMarks =
              newBoat1X + Math.cos(collisionAngle) * pushDistance;
            newBoat1YWithMarks =
              newBoat1Y + Math.sin(collisionAngle) * pushDistance;

            // Same speed reduction
            boat1SpeedAdjusted = boatState.speed * 0.95;

            // Play hit sound for mark collision
            useAudio.getState().playHit();

            console.log("Boat 1 hit bottom mark!");
          }

          // Boat 1 collision with left red buoy (start/finish line)
          if (distanceToLeftBuoy1 < boatRadius + leftBuoyRef.radius) {
            boat1NeedsAdjustment = true;
            // Calculate angle between boat and buoy for deflection
            const collisionAngle = Math.atan2(
              newBoat1Y - leftBuoyRef.y,
              newBoat1X - leftBuoyRef.x,
            );

            // Use same push distance formula for consistent physics
            const pushDistance = Math.max(
              (boatRadius + leftBuoyRef.radius - distanceToLeftBuoy1) * 0.75,
              boatRadius * 0.25,
            );

            newBoat1XWithMarks =
              newBoat1X + Math.cos(collisionAngle) * pushDistance;
            newBoat1YWithMarks =
              newBoat1Y + Math.sin(collisionAngle) * pushDistance;

            // Same speed reduction
            boat1SpeedAdjusted = boatState.speed * 0.95;

            // Play hit sound for buoy collision
            useAudio.getState().playHit();

            console.log("Boat 1 hit left red buoy!");
          }

          // Boat 1 collision with right red buoy (start/finish line)
          if (distanceToRightBuoy1 < boatRadius + rightBuoyRef.radius) {
            boat1NeedsAdjustment = true;
            // Calculate angle between boat and buoy for deflection
            const collisionAngle = Math.atan2(
              newBoat1Y - rightBuoyRef.y,
              newBoat1X - rightBuoyRef.x,
            );

            // Use same push distance formula for consistent physics
            const pushDistance = Math.max(
              (boatRadius + rightBuoyRef.radius - distanceToRightBuoy1) * 0.75,
              boatRadius * 0.25,
            );

            newBoat1XWithMarks =
              newBoat1X + Math.cos(collisionAngle) * pushDistance;
            newBoat1YWithMarks =
              newBoat1Y + Math.sin(collisionAngle) * pushDistance;

            // Same speed reduction
            boat1SpeedAdjusted = boatState.speed * 0.95;

            // Play hit sound for buoy collision
            useAudio.getState().playHit();

            console.log("Boat 1 hit right red buoy!");
          }

          // Boat 2 collision with marks - only check if we have 2 boats
          if (boatCount === 2) {
            // Boat 2 collision with top mark
            if (distanceToTopMark2 < boatRadius + topMark.radius) {
              boat2NeedsAdjustment = true;
              // Calculate angle between boat and mark for deflection
              const collisionAngle = Math.atan2(
                newBoat2Y - topMark.y,
                newBoat2X - topMark.x,
              );

              // Use same push distance formula
              const pushDistance = Math.max(
                (boatRadius + topMark.radius - distanceToTopMark2) * 0.75,
                boatRadius * 0.25,
              );

              newBoat2XWithMarks =
                newBoat2X + Math.cos(collisionAngle) * pushDistance;
              newBoat2YWithMarks =
                newBoat2Y + Math.sin(collisionAngle) * pushDistance;

              // Same speed reduction
              boat2SpeedAdjusted = boat2State.speed * 0.95;

              // Play hit sound for mark collision
              useAudio.getState().playHit();

              console.log("Boat 2 hit top mark!");
            }

            // Boat 2 collision with bottom mark
            if (distanceToBottomMark2 < boatRadius + bottomMark.radius) {
              boat2NeedsAdjustment = true;
              // Calculate angle between boat and mark for deflection
              const collisionAngle = Math.atan2(
                newBoat2Y - bottomMark.y,
                newBoat2X - bottomMark.x,
              );

              // Use same push distance formula
              const pushDistance = Math.max(
                (boatRadius + bottomMark.radius - distanceToBottomMark2) * 0.75,
                boatRadius * 0.25,
              );

              newBoat2XWithMarks =
                newBoat2X + Math.cos(collisionAngle) * pushDistance;
              newBoat2YWithMarks =
                newBoat2Y + Math.sin(collisionAngle) * pushDistance;

              // Same speed reduction
              boat2SpeedAdjusted = boat2State.speed * 0.95;

              // Play hit sound for mark collision
              useAudio.getState().playHit();

              console.log("Boat 2 hit bottom mark!");
            }

            // Boat 2 collision with left red buoy (start/finish line)
            if (distanceToLeftBuoy2 < boatRadius + leftBuoyRef.radius) {
              boat2NeedsAdjustment = true;
              // Calculate angle between boat and buoy for deflection
              const collisionAngle = Math.atan2(
                newBoat2Y - leftBuoyRef.y,
                newBoat2X - leftBuoyRef.x,
              );

              // Use same push distance formula for consistent physics
              const pushDistance = Math.max(
                (boatRadius + leftBuoyRef.radius - distanceToLeftBuoy2) * 0.75,
                boatRadius * 0.25,
              );

              newBoat2XWithMarks =
                newBoat2X + Math.cos(collisionAngle) * pushDistance;
              newBoat2YWithMarks =
                newBoat2Y + Math.sin(collisionAngle) * pushDistance;

              // Same speed reduction
              boat2SpeedAdjusted = boat2State.speed * 0.95;

              // Play hit sound for buoy collision
              useAudio.getState().playHit();

              console.log("Boat 2 hit left red buoy!");
            }

            // Boat 2 collision with right red buoy (start/finish line)
            if (distanceToRightBuoy2 < boatRadius + rightBuoyRef.radius) {
              boat2NeedsAdjustment = true;
              // Calculate angle between boat and buoy for deflection
              const collisionAngle = Math.atan2(
                newBoat2Y - rightBuoyRef.y,
                newBoat2X - rightBuoyRef.x,
              );

              // Use same push distance formula for consistent physics
              const pushDistance = Math.max(
                (boatRadius + rightBuoyRef.radius - distanceToRightBuoy2) *
                  0.75,
                boatRadius * 0.25,
              );

              newBoat2XWithMarks =
                newBoat2X + Math.cos(collisionAngle) * pushDistance;
              newBoat2YWithMarks =
                newBoat2Y + Math.sin(collisionAngle) * pushDistance;

              // Same speed reduction
              boat2SpeedAdjusted = boat2State.speed * 0.95;

              // Play hit sound for buoy collision
              useAudio.getState().playHit();

              console.log("Boat 2 hit right red buoy!");
            }
          }

          // Boat 3 collision with marks - only check if we have 3+ boats
          if (boatCount >= 3) {
            // Boat 3 collision with top mark
            if (distanceToTopMark3 < boatRadius + topMark.radius) {
              boat3NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat3Y - topMark.y,
                newBoat3X - topMark.x,
              );
              const pushDistance = Math.max(
                (boatRadius + topMark.radius - distanceToTopMark3) * 0.75,
                boatRadius * 0.25,
              );
              newBoat3XWithMarks = newBoat3X + Math.cos(collisionAngle) * pushDistance;
              newBoat3YWithMarks = newBoat3Y + Math.sin(collisionAngle) * pushDistance;
              boat3SpeedAdjusted = boat3State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 3 hit top mark!");
            }

            // Boat 3 collision with bottom mark
            if (distanceToBottomMark3 < boatRadius + bottomMark.radius) {
              boat3NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat3Y - bottomMark.y,
                newBoat3X - bottomMark.x,
              );
              const pushDistance = Math.max(
                (boatRadius + bottomMark.radius - distanceToBottomMark3) * 0.75,
                boatRadius * 0.25,
              );
              newBoat3XWithMarks = newBoat3X + Math.cos(collisionAngle) * pushDistance;
              newBoat3YWithMarks = newBoat3Y + Math.sin(collisionAngle) * pushDistance;
              boat3SpeedAdjusted = boat3State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 3 hit bottom mark!");
            }

            // Boat 3 collision with left red buoy
            if (distanceToLeftBuoy3 < boatRadius + leftBuoyRef.radius) {
              boat3NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat3Y - leftBuoyRef.y,
                newBoat3X - leftBuoyRef.x,
              );
              const pushDistance = Math.max(
                (boatRadius + leftBuoyRef.radius - distanceToLeftBuoy3) * 0.75,
                boatRadius * 0.25,
              );
              newBoat3XWithMarks = newBoat3X + Math.cos(collisionAngle) * pushDistance;
              newBoat3YWithMarks = newBoat3Y + Math.sin(collisionAngle) * pushDistance;
              boat3SpeedAdjusted = boat3State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 3 hit left red buoy!");
            }

            // Boat 3 collision with right red buoy
            if (distanceToRightBuoy3 < boatRadius + rightBuoyRef.radius) {
              boat3NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat3Y - rightBuoyRef.y,
                newBoat3X - rightBuoyRef.x,
              );
              const pushDistance = Math.max(
                (boatRadius + rightBuoyRef.radius - distanceToRightBuoy3) * 0.75,
                boatRadius * 0.25,
              );
              newBoat3XWithMarks = newBoat3X + Math.cos(collisionAngle) * pushDistance;
              newBoat3YWithMarks = newBoat3Y + Math.sin(collisionAngle) * pushDistance;
              boat3SpeedAdjusted = boat3State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 3 hit right red buoy!");
            }
          }

          // Boat 4 collision with marks - only check if we have 4 boats
          if (boatCount >= 4) {
            // Boat 4 collision with top mark
            if (distanceToTopMark4 < boatRadius + topMark.radius) {
              boat4NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat4Y - topMark.y,
                newBoat4X - topMark.x,
              );
              const pushDistance = Math.max(
                (boatRadius + topMark.radius - distanceToTopMark4) * 0.75,
                boatRadius * 0.25,
              );
              newBoat4XWithMarks = newBoat4X + Math.cos(collisionAngle) * pushDistance;
              newBoat4YWithMarks = newBoat4Y + Math.sin(collisionAngle) * pushDistance;
              boat4SpeedAdjusted = boat4State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 4 hit top mark!");
            }

            // Boat 4 collision with bottom mark
            if (distanceToBottomMark4 < boatRadius + bottomMark.radius) {
              boat4NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat4Y - bottomMark.y,
                newBoat4X - bottomMark.x,
              );
              const pushDistance = Math.max(
                (boatRadius + bottomMark.radius - distanceToBottomMark4) * 0.75,
                boatRadius * 0.25,
              );
              newBoat4XWithMarks = newBoat4X + Math.cos(collisionAngle) * pushDistance;
              newBoat4YWithMarks = newBoat4Y + Math.sin(collisionAngle) * pushDistance;
              boat4SpeedAdjusted = boat4State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 4 hit bottom mark!");
            }

            // Boat 4 collision with left red buoy
            if (distanceToLeftBuoy4 < boatRadius + leftBuoyRef.radius) {
              boat4NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat4Y - leftBuoyRef.y,
                newBoat4X - leftBuoyRef.x,
              );
              const pushDistance = Math.max(
                (boatRadius + leftBuoyRef.radius - distanceToLeftBuoy4) * 0.75,
                boatRadius * 0.25,
              );
              newBoat4XWithMarks = newBoat4X + Math.cos(collisionAngle) * pushDistance;
              newBoat4YWithMarks = newBoat4Y + Math.sin(collisionAngle) * pushDistance;
              boat4SpeedAdjusted = boat4State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 4 hit left red buoy!");
            }

            // Boat 4 collision with right red buoy
            if (distanceToRightBuoy4 < boatRadius + rightBuoyRef.radius) {
              boat4NeedsAdjustment = true;
              const collisionAngle = Math.atan2(
                newBoat4Y - rightBuoyRef.y,
                newBoat4X - rightBuoyRef.x,
              );
              const pushDistance = Math.max(
                (boatRadius + rightBuoyRef.radius - distanceToRightBuoy4) * 0.75,
                boatRadius * 0.25,
              );
              newBoat4XWithMarks = newBoat4X + Math.cos(collisionAngle) * pushDistance;
              newBoat4YWithMarks = newBoat4Y + Math.sin(collisionAngle) * pushDistance;
              boat4SpeedAdjusted = boat4State.speed * 0.95;
              useAudio.getState().playHit();
              console.log("Boat 4 hit right red buoy!");
            }
          }

          // Update boat 1 position
          setBoatState((prev) => ({
            ...prev,
            x: boat1NeedsAdjustment ? newBoat1XWithMarks : newBoat1X,
            y: boat1NeedsAdjustment ? newBoat1YWithMarks : newBoat1Y,
            speed: boat1NeedsAdjustment ? boat1SpeedAdjusted : prev.speed,
          }));

          // Update boat 2 position if in play
          if (boatCount >= 2) {
            setBoat2State((prev) => ({
              ...prev,
              x: boat2NeedsAdjustment ? newBoat2XWithMarks : newBoat2X,
              y: boat2NeedsAdjustment ? newBoat2YWithMarks : newBoat2Y,
              speed: boat2NeedsAdjustment ? boat2SpeedAdjusted : prev.speed,
            }));
          }

          // Update boat 3 position if in play
          if (boatCount >= 3) {
            setBoat3State((prev) => ({
              ...prev,
              x: boat3NeedsAdjustment ? newBoat3XWithMarks : newBoat3X,
              y: boat3NeedsAdjustment ? newBoat3YWithMarks : newBoat3Y,
              speed: boat3NeedsAdjustment ? boat3SpeedAdjusted : prev.speed,
            }));
          }

          // Update boat 4 position if in play
          if (boatCount >= 4) {
            setBoat4State((prev) => ({
              ...prev,
              x: boat4NeedsAdjustment ? newBoat4XWithMarks : newBoat4X,
              y: boat4NeedsAdjustment ? newBoat4YWithMarks : newBoat4Y,
              speed: boat4NeedsAdjustment ? boat4SpeedAdjusted : prev.speed,
            }));
          }
        }

        // Race stage tracking and collision detection
        if (phase === "racing") {
          // If race was just started, update race start time
          if (raceStage === "Not Started") {
            setRaceStage("Start Leg");
            setRaceStartTime(Date.now());
          }

          // Force-set race stage to Start Leg if still Not Started
          // Force-set race stages for all active boats
          const raceState = useRace.getState();

          if (raceState.boat1Stage === "Not Started") {
            console.log("Force-setting boat1Stage to Start Leg");
            useRace.setState({ boat1Stage: "Start Leg" });
          }

          if (boatCount >= 2 && raceState.boat2Stage === "Not Started") {
            console.log("Force-setting boat2Stage to Start Leg");
            useRace.setState({ boat2Stage: "Start Leg" });
          }

          if (boatCount >= 3 && raceState.boat3Stage === "Not Started") {
            console.log("Force-setting boat3Stage to Start Leg");
            useRace.setState({ boat3Stage: "Start Leg" });
          }

          if (boatCount >= 4 && raceState.boat4Stage === "Not Started") {
            console.log("Force-setting boat4Stage to Start Leg");
            useRace.setState({ boat4Stage: "Start Leg" });
          }

          // Get current race stages
          const boat1Stage = useRace.getState().boat1Stage;
          const boat2Stage = useRace.getState().boat2Stage;

          // BOAT 1 RACE PROGRESSION

          // Check for start line crossing (Start Leg) for Boat 1
          if (boat1Stage === "Start Leg") {
            const startLine = startLineRef.current;

            // Enhanced debugging for start line check
            console.log(
              "START CHECK - Boat 1: X=" +
                boatState.x.toFixed(1) +
                ", Y=" +
                boatState.y.toFixed(1) +
                ", Line Y=" +
                startLine.y1.toFixed(1) +
                ", Between posts: " +
                (boatState.x >= startLine.x1 && boatState.x <= startLine.x2),
            );

            // Verify boat has crossed the start line from below to above
            // This ensures proper direction of crossing (must cross from south to north)
            const isNearStartLine =
              Math.abs(boatState.y - startLine.y1) < boatRadius * 3; // Increased detection range
            const isBetweenPosts =
              boatState.x >= startLine.x1 - boatRadius &&
              boatState.x <= startLine.x2 + boatRadius; // More lenient post detection
            const isMovingUpward =
              boatState.rotation > 260 || boatState.rotation < 100; // Wider heading range for north-ish

            // Debug info
            console.log(
              "START LINE CHECK - Near line: " +
                isNearStartLine +
                ", Distance: " +
                Math.abs(boatState.y - startLine.y1).toFixed(1) +
                ", Between posts: " +
                isBetweenPosts +
                ", Rotation: " +
                boatState.rotation.toFixed(1) +
                ", Moving upward: " +
                isMovingUpward,
            );

            // The boat progresses to the next stage if it crosses the start line properly
            if (isNearStartLine && isBetweenPosts && isMovingUpward) {
              console.log(
                "*** Boat 1 crossed start line - advancing to Upwind Leg ***",
              );
              useRace.setState({ boat1Stage: "Upwind Leg" });

              // Add visual and audio feedback for stage transition
              showStageTransitionEffect(boatState.x, boatState.y, "#FF5722");

              if (raceStage === "Start Leg") {
                setRaceStage("Upwind Leg");
              }
              console.log("Boat 1 race stage changed: Start Leg → Upwind Leg");
            }
          }

          // Check for top mark rounding (Upwind Leg) for Boat 1
          if (boat1Stage === "Upwind Leg") {
            const topMark = topMarkRef.current;

            // Only mark stage as complete when the boat has crossed the Y position of the mark
            // and its X position matches the mark (must be within a small range of the mark's X position)
            const xDistanceFromMark = Math.abs(boatState.x - topMark.x);
            if (
              boatState.y <= topMark.y &&
              xDistanceFromMark <= boatRadius * 2
            ) {
              useRace.setState({ boat1Stage: "Downwind Leg" });

              // Add visual and audio feedback for stage transition
              showStageTransitionEffect(boatState.x, boatState.y, "#FF5722");

              if (raceStage === "Upwind Leg") {
                setRaceStage("Downwind Leg");
              }
              console.log(
                "Boat 1 race stage changed: Upwind Leg → Downwind Leg",
              );
            }
          }

          // Check for bottom (yellow) mark rounding (Downwind Leg) for Boat 1
          if (boat1Stage === "Downwind Leg") {
            const bottomMark = bottomMarkRef.current;

            // Only mark stage as complete when the boat has crossed the Y position of the mark
            // and its X position matches the mark (must be within a small range of the mark's X position)
            const xDistanceFromMark = Math.abs(boatState.x - bottomMark.x);
            if (
              boatState.y >= bottomMark.y &&
              xDistanceFromMark <= boatRadius * 2
            ) {
              useRace.setState({ boat1Stage: "Second Upwind Leg" });

              // Add visual and audio feedback for stage transition
              showStageTransitionEffect(boatState.x, boatState.y, "#FF5722");

              if (raceStage === "Downwind Leg") {
                setRaceStage("Second Upwind Leg");
              }
              console.log(
                "Boat 1 race stage changed: Downwind Leg → Second Upwind Leg",
              );
            }
          }

          // Check for second top mark rounding (Second Upwind Leg) for Boat 1
          if (boat1Stage === "Second Upwind Leg") {
            const topMark = topMarkRef.current;

            // Only mark stage as complete when the boat has crossed the Y position of the mark
            // and its X position matches the mark (must be within a small range of the mark's X position)
            const xDistanceFromMark = Math.abs(boatState.x - topMark.x);
            if (
              boatState.y <= topMark.y &&
              xDistanceFromMark <= boatRadius * 2
            ) {
              useRace.setState({ boat1Stage: "Finish Leg" });

              // Add visual and audio feedback for stage transition
              showStageTransitionEffect(boatState.x, boatState.y, "#FF5722");

              if (raceStage === "Second Upwind Leg") {
                setRaceStage("Finish Leg");
              }
              console.log(
                "Boat 1 race stage changed: Second Upwind Leg → Finish Leg",
              );
            }
          }

          // Check for finish line crossing (Finish) for Boat 1
          if (boat1Stage === "Finish Leg" && !boat1FinishedRef.current) {
            const startLine = startLineRef.current;

            // Enhanced debugging for finish line check
            console.log(
              "FINISH CHECK - Boat 1: X=" +
                boatState.x.toFixed(1) +
                ", Y=" +
                boatState.y.toFixed(1) +
                ", Line Y=" +
                startLine.y1.toFixed(1) +
                ", Between posts: " +
                (boatState.x >= startLine.x1 && boatState.x <= startLine.x2),
            );

            // Verify boat is between red marks at the finish line
            // Only need Y position to match one of the red marks
            const hasMatchingYPosition =
              Math.abs(boatState.y - startLine.y1) < 20; // Increased tolerance to 20px

            // Check if X position is between the left and right red marks
            const isBetweenPosts =
              boatState.x >= startLine.x1 && boatState.x <= startLine.x2;

            // Check if boat is heading southward (finishing direction)
            const isMovingDownward =
              boatState.rotation > 90 && boatState.rotation < 270;

            // Debug info for finish line crossing
            console.log(
              "FINISH LINE CHECK - Boat 1 - Y matches line: " +
                hasMatchingYPosition +
                ", Y-distance: " +
                Math.abs(boatState.y - startLine.y1).toFixed(1) +
                ", Between posts: " +
                isBetweenPosts +
                ", Rotation: " +
                boatState.rotation.toFixed(1) +
                ", Moving downward: " +
                isMovingDownward,
            );

            // On finish leg, just being at the same Y position as red marks is enough when between the marks
            if (isBetweenPosts && hasMatchingYPosition) {
              console.log(
                "*** Boat 1 detected at finish line - race completed! ***",
              );
              useRace.setState({ boat1Stage: "Finished" });
              boat1FinishedRef.current = true; // Mark boat 1 as finished

              // Add special celebration effect for finish
              showStageTransitionEffect(boatState.x, boatState.y, "#4ade80"); // Green color for finish

              const finishTime = Date.now() - (raceStartTime || 0);
              setFinishTime(finishTime);

              // Get current user information from race store
              const raceStore = useRace.getState();
              const currentBoat = raceStore.boats.find(
                (b) => b.id === "boat-1",
              );

              // Finish the race for boat 1 in the race store to record results properly
              if (currentBoat) {
                // This adds the result to the race store with proper user ID
                useRace.getState().finishRace("boat-1", finishTime);
                console.log(
                  "Recorded race result for",
                  currentBoat.username,
                  "with time",
                  finishTime,
                );
              }

              // Update local leaderboard for display
              setLeaderboard((prev) => {
                // Create a new entry with custom boat name if available
                const boatName =
                  user?.boat1Name && user.boat1Name.trim()
                    ? user.boat1Name
                    : currentBoat?.username || "Player 1";
                const newEntry = {
                  player: boatName,
                  time: finishTime,
                };

                // Add to existing leaderboard and sort by time (fastest first)
                const updatedLeaderboard = [...prev, newEntry].sort(
                  (a, b) => a.time - b.time,
                );

                return updatedLeaderboard;
              });

              console.log(
                `Boat 1 finished! Time: ${finishTime / 1000} seconds`,
              );

              // Don't update overall race stage when boat 1 finishes
              // This allows boat 2 to continue independently
              // Individual boat stages are tracked separately
            }
          }

          // BOAT 2 RACE PROGRESSION - only if at least 2 boats are active

          if (boatCount >= 2) {
            // Check for start line crossing (Start Leg) for Boat 2
            if (boat2Stage === "Start Leg") {
              const startLine = startLineRef.current;

              // Enhanced debugging for start line check
              console.log(
                "START CHECK - Boat 2: X=" +
                  boat2State.x.toFixed(1) +
                  ", Y=" +
                  boat2State.y.toFixed(1) +
                  ", Line Y=" +
                  startLine.y1.toFixed(1) +
                  ", Between posts: " +
                  (boat2State.x >= startLine.x1 &&
                    boat2State.x <= startLine.x2),
              );

              // Verify boat has crossed the start line from below to above
              // This ensures proper direction of crossing (must cross from south to north)
              const isNearStartLine =
                Math.abs(boat2State.y - startLine.y1) < boatRadius * 3; // Increased detection range
              const isBetweenPosts =
                boat2State.x >= startLine.x1 - boatRadius &&
                boat2State.x <= startLine.x2 + boatRadius; // More lenient post detection
              const isMovingUpward =
                boat2State.rotation > 260 || boat2State.rotation < 100; // Wider heading range for north-ish

              // Debug info
              console.log(
                "START LINE CHECK - Boat 2 - Near line: " +
                  isNearStartLine +
                  ", Distance: " +
                  Math.abs(boat2State.y - startLine.y1).toFixed(1) +
                  ", Between posts: " +
                  isBetweenPosts +
                  ", Rotation: " +
                  boat2State.rotation.toFixed(1) +
                  ", Moving upward: " +
                  isMovingUpward,
              );

              // The boat progresses to the next stage if it crosses the start line properly
              if (isNearStartLine && isBetweenPosts && isMovingUpward) {
                console.log(
                  "*** Boat 2 crossed start line - advancing to Upwind Leg ***",
                );
                useRace.setState({ boat2Stage: "Upwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat2State.x,
                  boat2State.y,
                  "#3B82F6",
                );

                console.log(
                  "Boat 2 race stage changed: Start Leg → Upwind Leg",
                );
              }
            }
          }

          // Rest of boat 2 race progression - only if at least 2 boats are active
          if (boatCount >= 2) {
            // Check for top mark rounding (Upwind Leg) for Boat 2
            if (boat2Stage === "Upwind Leg") {
              const topMark = topMarkRef.current;

              // Only mark stage as complete when the boat has crossed the Y position of the mark
              // and its X position matches the mark (must be within a small range of the mark's X position)
              const xDistanceFromMark = Math.abs(boat2State.x - topMark.x);
              if (
                boat2State.y <= topMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat2Stage: "Downwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat2State.x,
                  boat2State.y,
                  "#3B82F6",
                );

                console.log(
                  "Boat 2 race stage changed: Upwind Leg → Downwind Leg",
                );
              }
            }

            // Check for bottom mark rounding (Downwind Leg) for Boat 2
            if (boat2Stage === "Downwind Leg") {
              const bottomMark = bottomMarkRef.current;

              // Only mark stage as complete when the boat has crossed the Y position of the mark
              // and its X position matches the mark (must be within a small range of the mark's X position)
              const xDistanceFromMark = Math.abs(boat2State.x - bottomMark.x);
              if (
                boat2State.y >= bottomMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat2Stage: "Second Upwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat2State.x,
                  boat2State.y,
                  "#3B82F6",
                );

                console.log(
                  "Boat 2 race stage changed: Downwind Leg → Second Upwind Leg",
                );
              }
            }

            // Check for second top mark rounding (Second Upwind Leg) for Boat 2
            if (boat2Stage === "Second Upwind Leg") {
              const topMark = topMarkRef.current;

              // Only mark stage as complete when the boat has crossed the Y position of the mark
              // and its X position matches the mark (must be within a small range of the mark's X position)
              const xDistanceFromMark = Math.abs(boat2State.x - topMark.x);
              if (
                boat2State.y <= topMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat2Stage: "Finish Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat2State.x,
                  boat2State.y,
                  "#3B82F6",
                );

                console.log(
                  "Boat 2 race stage changed: Second Upwind Leg → Finish Leg",
                );
              }
            }

            // Check for finish line crossing (Finish) for Boat 2
            if (boat2Stage === "Finish Leg" && !boat2FinishedRef.current) {
              const startLine = startLineRef.current;

              // Enhanced debugging for finish line check
              console.log(
                "FINISH CHECK - Boat 2: X=" +
                  boat2State.x.toFixed(1) +
                  ", Y=" +
                  boat2State.y.toFixed(1) +
                  ", Line Y=" +
                  startLine.y1.toFixed(1) +
                  ", Between posts: " +
                  (boat2State.x >= startLine.x1 &&
                    boat2State.x <= startLine.x2),
              );

              // Verify boat is between red marks at the finish line
              // Only need Y position to match one of the red marks
              const hasMatchingYPosition =
                Math.abs(boat2State.y - startLine.y1) < 20; // Increased tolerance to 20px

              // Check if X position is between the left and right red marks
              const isBetweenPosts =
                boat2State.x >= startLine.x1 && boat2State.x <= startLine.x2;

              // Check if boat is heading southward (finishing direction)
              const isMovingDownward =
                boat2State.rotation > 90 && boat2State.rotation < 270;

              // Debug info for finish line crossing
              console.log(
                "FINISH LINE CHECK - Boat 2 - Y matches line: " +
                  hasMatchingYPosition +
                  ", Y-distance: " +
                  Math.abs(boat2State.y - startLine.y1).toFixed(1) +
                  ", Between posts: " +
                  isBetweenPosts +
                  ", Rotation: " +
                  boat2State.rotation.toFixed(1) +
                  ", Moving downward: " +
                  isMovingDownward,
              );

              // On finish leg, just being at the same Y position as red marks is enough when between the marks
              if (isBetweenPosts && hasMatchingYPosition) {
                console.log(
                  "*** Boat 2 detected at finish line - race completed! ***",
                );
                useRace.setState({ boat2Stage: "Finished" });
                boat2FinishedRef.current = true; // Mark boat 2 as finished

                // Add special celebration effect for finish
                showStageTransitionEffect(
                  boat2State.x,
                  boat2State.y,
                  "#4ade80",
                ); // Green color for finish

                const boat2FinishTime = Date.now() - (raceStartTime || 0);

                // Get current user information from race store for boat 2
                const raceStore = useRace.getState();
                const boat2 = raceStore.boats.find((b) => b.id === "boat-2");

                // Finish the race for boat 2 in the race store to record results properly
                if (boat2) {
                  // This adds the result to the race store with proper user ID
                  useRace.getState().finishRace("boat-2", boat2FinishTime);
                  console.log(
                    "Recorded race result for",
                    boat2.username,
                    "with time",
                    boat2FinishTime,
                  );
                }

                // Add boat 2 to leaderboard
                setLeaderboard((prev) => {
                  // Create a new entry for boat 2 with custom boat name if available
                  const boatName =
                    user?.boat2Name && user.boat2Name.trim()
                      ? user.boat2Name
                      : boat2?.username || "Player 2";
                  const newEntry = {
                    player: boatName,
                    time: boat2FinishTime,
                  };

                  // Add to existing leaderboard and sort by time
                  const updatedLeaderboard = [...prev, newEntry].sort(
                    (a, b) => a.time - b.time,
                  );

                  return updatedLeaderboard;
                });

                console.log(
                  `Boat 2 finished! Time: ${boat2FinishTime / 1000} seconds`,
                );

                // Don't update global race stage to "Finished" here either
                // This allows each boat to be tracked independently
              }
            }
          }

          // BOAT 3 RACE PROGRESSION - only if at least 3 boats are active
          if (boatCount >= 3) {
            // Check for start line crossing (Start Leg) for Boat 3
            if (boat3Stage === "Start Leg") {
              const startLine = startLineRef.current;

              // Verify boat has crossed the start line from below to above
              const isNearStartLine =
                Math.abs(boat3State.y - startLine.y1) < boatRadius * 3;
              const isBetweenPosts =
                boat3State.x >= startLine.x1 - boatRadius &&
                boat3State.x <= startLine.x2 + boatRadius;
              const isMovingUpward =
                boat3State.rotation > 260 || boat3State.rotation < 100;

              // The boat progresses to the next stage if it crosses the start line properly
              if (isNearStartLine && isBetweenPosts && isMovingUpward) {
                console.log(
                  "*** Boat 3 crossed start line - advancing to Upwind Leg ***",
                );
                useRace.setState({ boat3Stage: "Upwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat3State.x,
                  boat3State.y,
                  "#10B981",
                );

                console.log(
                  "Boat 3 race stage changed: Start Leg → Upwind Leg",
                );
              }
            }

            // Check for top mark rounding (Upwind Leg) for Boat 3
            if (boat3Stage === "Upwind Leg") {
              const topMark = topMarkRef.current;

              const xDistanceFromMark = Math.abs(boat3State.x - topMark.x);
              if (
                boat3State.y <= topMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat3Stage: "Downwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat3State.x,
                  boat3State.y,
                  "#10B981",
                );

                console.log(
                  "Boat 3 race stage changed: Upwind Leg → Downwind Leg",
                );
              }
            }

            // Check for bottom mark rounding (Downwind Leg) for Boat 3
            if (boat3Stage === "Downwind Leg") {
              const bottomMark = bottomMarkRef.current;

              const xDistanceFromMark = Math.abs(boat3State.x - bottomMark.x);
              if (
                boat3State.y >= bottomMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat3Stage: "Second Upwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat3State.x,
                  boat3State.y,
                  "#10B981",
                );

                console.log(
                  "Boat 3 race stage changed: Downwind Leg → Second Upwind Leg",
                );
              }
            }

            // Check for second top mark rounding (Second Upwind Leg) for Boat 3
            if (boat3Stage === "Second Upwind Leg") {
              const topMark = topMarkRef.current;

              const xDistanceFromMark = Math.abs(boat3State.x - topMark.x);
              if (
                boat3State.y <= topMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat3Stage: "Finish Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat3State.x,
                  boat3State.y,
                  "#10B981",
                );

                console.log(
                  "Boat 3 race stage changed: Second Upwind Leg → Finish Leg",
                );
              }
            }

            // Check for finish line crossing (Finish) for Boat 3
            if (boat3Stage === "Finish Leg" && !boat3FinishedRef.current) {
              const startLine = startLineRef.current;

              // Verify boat is between red marks at the finish line
              const hasMatchingYPosition =
                Math.abs(boat3State.y - startLine.y1) < 20;
              const isBetweenPosts =
                boat3State.x >= startLine.x1 && boat3State.x <= startLine.x2;

              // On finish leg, just being at the same Y position as red marks is enough when between the marks
              if (isBetweenPosts && hasMatchingYPosition) {
                console.log(
                  "*** Boat 3 detected at finish line - race completed! ***",
                );
                useRace.setState({ boat3Stage: "Finished" });
                boat3FinishedRef.current = true; // Mark boat 3 as finished

                // Add special celebration effect for finish
                showStageTransitionEffect(
                  boat3State.x,
                  boat3State.y,
                  "#4ade80",
                ); // Green color for finish

                const boat3FinishTime = Date.now() - (raceStartTime || 0);

                // Get current user information from race store for boat 3
                const raceStore = useRace.getState();
                const boat3 = raceStore.boats.find((b) => b.id === "boat-3");

                // Finish the race for boat 3 in the race store to record results properly
                if (boat3) {
                  // This adds the result to the race store with proper user ID
                  useRace.getState().finishRace("boat-3", boat3FinishTime);
                  console.log(
                    "Recorded race result for",
                    boat3.username,
                    "with time",
                    boat3FinishTime,
                  );
                }

                // Add boat 3 to leaderboard
                setLeaderboard((prev) => {
                  // Create a new entry for boat 3 with custom boat name if available
                  const boatName =
                    user?.boat3Name && user.boat3Name.trim()
                      ? user.boat3Name
                      : boat3?.username || "Player 3";
                  const newEntry = {
                    player: boatName,
                    time: boat3FinishTime,
                  };

                  // Add to existing leaderboard and sort by time
                  const updatedLeaderboard = [...prev, newEntry].sort(
                    (a, b) => a.time - b.time,
                  );

                  return updatedLeaderboard;
                });

                console.log(
                  `Boat 3 finished! Time: ${boat3FinishTime / 1000} seconds`,
                );
              }
            }
          }

          // BOAT 4 RACE PROGRESSION - only if 4 boats are active
          if (boatCount >= 4) {
            // Check for start line crossing (Start Leg) for Boat 4
            if (boat4Stage === "Start Leg") {
              const startLine = startLineRef.current;

              // Verify boat has crossed the start line from below to above
              const isNearStartLine =
                Math.abs(boat4State.y - startLine.y1) < boatRadius * 3;
              const isBetweenPosts =
                boat4State.x >= startLine.x1 - boatRadius &&
                boat4State.x <= startLine.x2 + boatRadius;
              const isMovingUpward =
                boat4State.rotation > 260 || boat4State.rotation < 100;

              // The boat progresses to the next stage if it crosses the start line properly
              if (isNearStartLine && isBetweenPosts && isMovingUpward) {
                console.log(
                  "*** Boat 4 crossed start line - advancing to Upwind Leg ***",
                );
                useRace.setState({ boat4Stage: "Upwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat4State.x,
                  boat4State.y,
                  "#8B5CF6",
                );

                console.log(
                  "Boat 4 race stage changed: Start Leg → Upwind Leg",
                );
              }
            }

            // Check for top mark rounding (Upwind Leg) for Boat 4
            if (boat4Stage === "Upwind Leg") {
              const topMark = topMarkRef.current;

              const xDistanceFromMark = Math.abs(boat4State.x - topMark.x);
              if (
                boat4State.y <= topMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat4Stage: "Downwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat4State.x,
                  boat4State.y,
                  "#8B5CF6",
                );

                console.log(
                  "Boat 4 race stage changed: Upwind Leg → Downwind Leg",
                );
              }
            }

            // Check for bottom mark rounding (Downwind Leg) for Boat 4
            if (boat4Stage === "Downwind Leg") {
              const bottomMark = bottomMarkRef.current;

              const xDistanceFromMark = Math.abs(boat4State.x - bottomMark.x);
              if (
                boat4State.y >= bottomMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat4Stage: "Second Upwind Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat4State.x,
                  boat4State.y,
                  "#8B5CF6",
                );

                console.log(
                  "Boat 4 race stage changed: Downwind Leg → Second Upwind Leg",
                );
              }
            }

            // Check for second top mark rounding (Second Upwind Leg) for Boat 4
            if (boat4Stage === "Second Upwind Leg") {
              const topMark = topMarkRef.current;

              const xDistanceFromMark = Math.abs(boat4State.x - topMark.x);
              if (
                boat4State.y <= topMark.y &&
                xDistanceFromMark <= boatRadius * 2
              ) {
                useRace.setState({ boat4Stage: "Finish Leg" });

                // Add visual and audio feedback for stage transition
                showStageTransitionEffect(
                  boat4State.x,
                  boat4State.y,
                  "#8B5CF6",
                );

                console.log(
                  "Boat 4 race stage changed: Second Upwind Leg → Finish Leg",
                );
              }
            }

            // Check for finish line crossing (Finish) for Boat 4
            if (boat4Stage === "Finish Leg" && !boat4FinishedRef.current) {
              const startLine = startLineRef.current;

              // Verify boat is between red marks at the finish line
              const hasMatchingYPosition =
                Math.abs(boat4State.y - startLine.y1) < 20;
              const isBetweenPosts =
                boat4State.x >= startLine.x1 && boat4State.x <= startLine.x2;

              // On finish leg, just being at the same Y position as red marks is enough when between the marks
              if (isBetweenPosts && hasMatchingYPosition) {
                console.log(
                  "*** Boat 4 detected at finish line - race completed! ***",
                );
                useRace.setState({ boat4Stage: "Finished" });
                boat4FinishedRef.current = true; // Mark boat 4 as finished

                // Add special celebration effect for finish
                showStageTransitionEffect(
                  boat4State.x,
                  boat4State.y,
                  "#4ade80",
                ); // Green color for finish

                const boat4FinishTime = Date.now() - (raceStartTime || 0);

                // Get current user information from race store for boat 4
                const raceStore = useRace.getState();
                const boat4 = raceStore.boats.find((b) => b.id === "boat-4");

                // Finish the race for boat 4 in the race store to record results properly
                if (boat4) {
                  // This adds the result to the race store with proper user ID
                  useRace.getState().finishRace("boat-4", boat4FinishTime);
                  console.log(
                    "Recorded race result for",
                    boat4.username,
                    "with time",
                    boat4FinishTime,
                  );
                }

                // Add boat 4 to leaderboard
                setLeaderboard((prev) => {
                  // Create a new entry for boat 4 with custom boat name if available
                  const boatName =
                    user?.boat4Name && user.boat4Name.trim()
                      ? user.boat4Name
                      : boat4?.username || "Player 4";
                  const newEntry = {
                    player: boatName,
                    time: boat4FinishTime,
                  };

                  // Add to existing leaderboard and sort by time
                  const updatedLeaderboard = [...prev, newEntry].sort(
                    (a, b) => a.time - b.time,
                  );

                  return updatedLeaderboard;
                });

                console.log(
                  `Boat 4 finished! Time: ${boat4FinishTime / 1000} seconds`,
                );
              }
            }
          }
        }
      }

      // If racing, draw turbulence zones behind boats
      if (phase === "racing") {
        // Draw wind shadow/turbulence zones
        // Boat 1's turbulence zone
        const shadowLength = boatRadius * 7.2; // 3.6 boat lengths (increased by 20% from 6)
        const shadowWidth = shadowLength * 0.5; // Half-width at furthest extent

        ctx.save();
        // Translate to boat position
        ctx.translate(boatState.x, boatState.y);

        // Draw the wind shadow with gradient, rotated based on wind direction
        // Convert wind direction to radians (positive = clockwise rotation)
        const windRadians = (windDirection * Math.PI) / 180;

        // Rotate context to match wind direction
        ctx.rotate(windRadians);

        const shadowGradient = ctx.createLinearGradient(0, 0, 0, shadowLength);
        shadowGradient.addColorStop(0, "rgba(255, 255, 255, 0.3)");
        shadowGradient.addColorStop(1, "rgba(255, 255, 255, 0.05)");

        ctx.fillStyle = shadowGradient;
        ctx.beginPath();
        ctx.moveTo(0, 0); // Start at boat center
        ctx.lineTo(shadowWidth, shadowLength); // Right edge of shadow
        ctx.lineTo(-shadowWidth, shadowLength); // Left edge of shadow
        ctx.closePath();
        ctx.fill();

        // Removed "Wind Shadow" label as requested

        ctx.restore();

        // Boat 2's turbulence zone - only if at least 2 boats active
        if (boatCount >= 2) {
          ctx.save();
          // Translate to boat 2 position
          ctx.translate(boat2State.x, boat2State.y);

          // Draw the wind shadow with gradient, rotated based on wind direction
          // Convert wind direction to radians (positive = clockwise rotation)
          const windRadians2 = (windDirection * Math.PI) / 180;

          // Rotate context to match wind direction
          ctx.rotate(windRadians2);

          const shadowGradient2 = ctx.createLinearGradient(
            0,
            0,
            0,
            shadowLength,
          );
          shadowGradient2.addColorStop(0, "rgba(200, 200, 255, 0.3)");
          shadowGradient2.addColorStop(1, "rgba(200, 200, 255, 0.05)");

          ctx.fillStyle = shadowGradient2;
          ctx.beginPath();
          ctx.moveTo(0, 0); // Start at boat center
          ctx.lineTo(shadowWidth, shadowLength); // Right edge of shadow
          ctx.lineTo(-shadowWidth, shadowLength); // Left edge of shadow
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }

        // Boat 3's turbulence zone - only if at least 3 boats active
        if (boatCount >= 3) {
          ctx.save();
          // Translate to boat 3 position
          ctx.translate(boat3State.x, boat3State.y);

          // Draw the wind shadow with gradient, rotated based on wind direction
          const windRadians3 = (windDirection * Math.PI) / 180;

          // Rotate context to match wind direction
          ctx.rotate(windRadians3);

          const shadowGradient3 = ctx.createLinearGradient(
            0,
            0,
            0,
            shadowLength,
          );
          shadowGradient3.addColorStop(0, "rgba(150, 255, 200, 0.3)");
          shadowGradient3.addColorStop(1, "rgba(150, 255, 200, 0.05)");

          ctx.fillStyle = shadowGradient3;
          ctx.beginPath();
          ctx.moveTo(0, 0); // Start at boat center
          ctx.lineTo(shadowWidth, shadowLength); // Right edge of shadow
          ctx.lineTo(-shadowWidth, shadowLength); // Left edge of shadow
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }

        // Boat 4's turbulence zone - only if all 4 boats active
        if (boatCount >= 4) {
          ctx.save();
          // Translate to boat 4 position
          ctx.translate(boat4State.x, boat4State.y);

          // Draw the wind shadow with gradient, rotated based on wind direction
          const windRadians4 = (windDirection * Math.PI) / 180;

          // Rotate context to match wind direction
          ctx.rotate(windRadians4);

          const shadowGradient4 = ctx.createLinearGradient(
            0,
            0,
            0,
            shadowLength,
          );
          shadowGradient4.addColorStop(0, "rgba(200, 180, 255, 0.3)");
          shadowGradient4.addColorStop(1, "rgba(200, 180, 255, 0.05)");

          ctx.fillStyle = shadowGradient4;
          ctx.beginPath();
          ctx.moveTo(0, 0); // Start at boat center
          ctx.lineTo(shadowWidth, shadowLength); // Right edge of shadow
          ctx.lineTo(-shadowWidth, shadowLength); // Left edge of shadow
          ctx.closePath();
          ctx.fill();

          ctx.restore();
        }
      }

      // Calculate boat size for proper spacing
      const boatScale = Math.min(canvas.width, canvas.height) * 0.03;
      // Calculate proper boat spacing (with 3 boat lengths between each boat)
      const singleBoatLength = boatScale * 2; // Single boat length
      const boatSpacing = singleBoatLength * 3; // Spacing of 3 boat lengths between each boat

      // Calculate boat position for drawing
      const currentBoatX =
        phase === "racing" ? boatState.x : centerX - boatSpacing * 1.5; // Position boat 1
      const currentBoatY =
        phase === "racing" ? boatState.y : canvas.height * 0.95; // Positioned just above the bottom boundary
      const boatRotation = phase === "racing" ? boatState.rotation : 0;

      // Check if boat 1 is in a wind puff for visual effect
      let boat1InPuff = false;
      for (const puff of windPuffs) {
        const inPuffX = Math.abs(boatState.x - puff.x) < puff.width / 2;
        const inPuffY = Math.abs(boatState.y - puff.y) < puff.height / 2;
        if (inPuffX && inPuffY) {
          boat1InPuff = true;
          break;
        }
      }

      // Draw speed boost indicator for boat 1 if in wind puff
      if (boat1InPuff && phase === "racing") {
        ctx.save();
        ctx.translate(currentBoatX, currentBoatY);

        // Draw pulsing circle around boat to indicate speed boost
        const pulseSize =
          boatScale * 1.8 + Math.sin(Date.now() / 100) * boatScale * 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(200, 255, 255, 0.3)";
        ctx.fill();

        // Draw speed lines
        ctx.strokeStyle = "rgba(200, 255, 255, 0.7)";
        ctx.lineWidth = 2;
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(
            Math.cos(angle) * pulseSize * 1.2,
            Math.sin(angle) * pulseSize * 1.2,
          );
          ctx.stroke();
        }

        ctx.restore();
      }

      // Draw Boat 1 (orange)
      ctx.save();
      ctx.translate(currentBoatX, currentBoatY);
      ctx.rotate((boatRotation * Math.PI) / 180);
      ctx.scale(boatScale / 15, boatScale / 15); // Scale boat proportionally

      // Boat hull - smaller more compact version
      ctx.beginPath();
      ctx.moveTo(0, -10); // Bow (reduced from -15)
      ctx.quadraticCurveTo(3, -3, 6, 6); // Curved starboard side (reduced from 5,-5,10,10)
      ctx.lineTo(6, 9); // Starboard quarter (reduced from 10,15)
      ctx.quadraticCurveTo(0, 12, -6, 9); // Curved transom (reduced from 0,20,-10,15)
      ctx.lineTo(-6, 6); // Port quarter (reduced from -10,10)
      ctx.quadraticCurveTo(-3, -3, 0, -10); // Curved port side back to bow (reduced from -5,-5,0,-15)
      ctx.fillStyle = boat1InPuff ? "#FFB74D" : "#FF5722"; // Brighter orange if in puff
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Sail - smaller size, moved to the back half of the boat
      ctx.beginPath();
      ctx.moveTo(0, 0); // Mast position in the center
      ctx.lineTo(0, -12); // Mast top (reduced from -20)
      ctx.lineTo(3, 3); // Sail curve - now angled backwards (reduced from 5,5)
      ctx.lineTo(0, 6); // Lower part of sail (reduced from 10)
      ctx.lineTo(0, 0); // Back to mast
      ctx.fillStyle = "white";
      ctx.fill();

      ctx.restore();

      // Get boat info for labels
      const raceStore = useRace.getState();
      const boat1 = raceStore.boats.find((b) => b.id === "boat-1");
      // User is already retrieved from useAuth() at the component level

      // Draw player 1 label with custom boat name or fallback to username
      ctx.fillStyle = "white";
      ctx.font = "14px Arial"; // Consistent font size
      ctx.textAlign = "center";
      // Use custom boat name if available, otherwise fall back to username
      const boat1Name =
        user?.boat1Name && user.boat1Name.trim()
          ? user.boat1Name
          : boat1?.username || "Player 1";
      ctx.fillText(boat1Name, currentBoatX, currentBoatY + boatScale * 2);

      // Render additional boats based on boat count
      if (boatCount >= 2) {
        // Calculate boat 2 position for drawing
        const currentBoat2X =
          phase === "racing" ? boat2State.x : centerX + boatSpacing; // Space boat 2 one boat length to the right
        const currentBoat2Y =
          phase === "racing" ? boat2State.y : canvas.height * 0.95; // Same Y position as all other boats
        const boat2Rotation = phase === "racing" ? boat2State.rotation : 0;

        // Check if boat 2 is in a wind puff for visual effect
        let boat2InPuff = false;
        for (const puff of windPuffs) {
          const inPuffX = Math.abs(boat2State.x - puff.x) < puff.width / 2;
          const inPuffY = Math.abs(boat2State.y - puff.y) < puff.height / 2;
          if (inPuffX && inPuffY) {
            boat2InPuff = true;
            break;
          }
        }

        // Draw speed boost indicator for boat 2 if in wind puff
        if (boat2InPuff && phase === "racing") {
          ctx.save();
          ctx.translate(currentBoat2X, currentBoat2Y);

          // Draw pulsing circle around boat to indicate speed boost
          const pulseSize =
            boatScale * 1.8 + Math.sin(Date.now() / 100) * boatScale * 0.3;
          ctx.beginPath();
          ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(200, 255, 255, 0.3)";
          ctx.fill();

          // Draw speed lines
          ctx.strokeStyle = "rgba(200, 255, 255, 0.7)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(
              Math.cos(angle) * pulseSize * 1.2,
              Math.sin(angle) * pulseSize * 1.2,
            );
            ctx.stroke();
          }

          ctx.restore();
        }

        // Draw Boat 2 (blue)
        ctx.save();
        ctx.translate(currentBoat2X, currentBoat2Y);
        ctx.rotate((boat2Rotation * Math.PI) / 180);
        ctx.scale(boatScale / 15, boatScale / 15);

        // Boat 2 hull - smaller more compact version (same as boat 1)
        ctx.beginPath();
        ctx.moveTo(0, -10); // Bow (reduced from -15)
        ctx.quadraticCurveTo(3, -3, 6, 6); // Curved starboard side (reduced from 5,-5,10,10)
        ctx.lineTo(6, 9); // Starboard quarter (reduced from 10,15)
        ctx.quadraticCurveTo(0, 12, -6, 9); // Curved transom (reduced from 0,20,-10,15)
        ctx.lineTo(-6, 6); // Port quarter (reduced from -10,10)
        ctx.quadraticCurveTo(-3, -3, 0, -10); // Curved port side back to bow (reduced from -5,-5,0,-15)
        ctx.fillStyle = boat2InPuff ? "#93C5FD" : "#3B82F6"; // Brighter blue if in puff
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Boat 2 sail - smaller size, moved to the back half of the boat
        ctx.beginPath();
        ctx.moveTo(0, 0); // Mast position in the center
        ctx.lineTo(0, -12); // Mast top (reduced from -20)
        ctx.lineTo(3, 3); // Sail curve - now angled backwards (reduced from 5,5)
        ctx.lineTo(0, 6); // Lower part of sail (reduced from 10)
        ctx.lineTo(0, 0); // Back to mast
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.restore();

        // Draw player 2 label with custom boat name or username
        ctx.fillStyle = "white";
        ctx.font = "14px Arial"; // Consistent font size
        ctx.textAlign = "center";

        // Use the already defined boat2 variable or get it from the race store
        const boat2Player = raceStore.boats.find((b) => b.id === "boat-2");
        // Use custom boat name if available, otherwise fall back to username
        const boat2Name =
          user?.boat2Name && user.boat2Name.trim()
            ? user.boat2Name
            : boat2Player?.username || "Player 2";
        ctx.fillText(boat2Name, currentBoat2X, currentBoat2Y + boatScale * 2);
      }

      // Render boat 3 if boat count is 3 or more
      if (boatCount >= 3) {
        // Calculate boat 3 position for drawing
        const currentBoat3X =
          phase === "racing" ? boat3State.x : centerX - boatSpacing * 3; // Position to left by one boat length
        const currentBoat3Y =
          phase === "racing" ? boat3State.y : canvas.height * 0.95; // Same Y position as all other boats
        const boat3Rotation = phase === "racing" ? boat3State.rotation : 0;

        // Check if boat 3 is in a wind puff for visual effect
        let boat3InPuff = false;
        for (const puff of windPuffs) {
          const inPuffX = Math.abs(boat3State.x - puff.x) < puff.width / 2;
          const inPuffY = Math.abs(boat3State.y - puff.y) < puff.height / 2;
          if (inPuffX && inPuffY) {
            boat3InPuff = true;
            break;
          }
        }

        // Draw speed boost indicator for boat 3 if in wind puff
        if (boat3InPuff && phase === "racing") {
          ctx.save();
          ctx.translate(currentBoat3X, currentBoat3Y);

          // Draw pulsing circle around boat to indicate speed boost
          const pulseSize =
            boatScale * 1.8 + Math.sin(Date.now() / 100) * boatScale * 0.3;
          ctx.beginPath();
          ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(200, 255, 255, 0.3)";
          ctx.fill();

          // Draw speed lines for boat 3
          ctx.strokeStyle = "rgba(200, 255, 255, 0.7)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(
              Math.cos(angle) * pulseSize * 1.2,
              Math.sin(angle) * pulseSize * 1.2,
            );
            ctx.stroke();
          }

          ctx.restore();
        }

        // Draw Boat 3 (green)
        ctx.save();
        ctx.translate(currentBoat3X, currentBoat3Y);
        ctx.rotate((boat3Rotation * Math.PI) / 180);
        ctx.scale(boatScale / 15, boatScale / 15);

        // Boat 3 hull - same shape as other boats
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.quadraticCurveTo(3, -3, 6, 6);
        ctx.lineTo(6, 9);
        ctx.quadraticCurveTo(0, 12, -6, 9);
        ctx.lineTo(-6, 6);
        ctx.quadraticCurveTo(-3, -3, 0, -10);
        ctx.fillStyle = boat3InPuff ? "#86EFAC" : "#10B981"; // Green - brighter if in puff
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Boat 3 sail
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -12);
        ctx.lineTo(3, 3);
        ctx.lineTo(0, 6);
        ctx.lineTo(0, 0);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.restore();

        // Draw player 3 label with custom boat name
        const boat3Player = raceStore.boats.find((b) => b.id === "boat-3");
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        // Use custom boat name if available, otherwise fall back to username
        const boat3Name =
          user?.boat3Name && user.boat3Name.trim()
            ? user.boat3Name
            : boat3Player?.username || "Player 3";
        ctx.fillText(boat3Name, currentBoat3X, currentBoat3Y + boatScale * 2);
      }

      // Render boat 4 if boat count is 4
      if (boatCount >= 4) {
        // Calculate boat 4 position for drawing
        const currentBoat4X =
          phase === "racing" ? boat4State.x : centerX + boatSpacing * 3; // Position to right by one boat length
        const currentBoat4Y =
          phase === "racing" ? boat4State.y : canvas.height * 0.95; // Same Y position as all other boats
        const boat4Rotation = phase === "racing" ? boat4State.rotation : 0;

        // Check if boat 4 is in a wind puff for visual effect
        let boat4InPuff = false;
        for (const puff of windPuffs) {
          const inPuffX = Math.abs(boat4State.x - puff.x) < puff.width / 2;
          const inPuffY = Math.abs(boat4State.y - puff.y) < puff.height / 2;
          if (inPuffX && inPuffY) {
            boat4InPuff = true;
            break;
          }
        }

        // Draw speed boost indicator for boat 4 if in wind puff
        if (boat4InPuff && phase === "racing") {
          ctx.save();
          ctx.translate(currentBoat4X, currentBoat4Y);

          // Draw pulsing circle around boat to indicate speed boost
          const pulseSize =
            boatScale * 1.8 + Math.sin(Date.now() / 100) * boatScale * 0.3;
          ctx.beginPath();
          ctx.arc(0, 0, pulseSize, 0, Math.PI * 2);
          ctx.fillStyle = "rgba(200, 255, 255, 0.3)";
          ctx.fill();

          // Draw speed lines for boat 4
          ctx.strokeStyle = "rgba(200, 255, 255, 0.7)";
          ctx.lineWidth = 2;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(
              Math.cos(angle) * pulseSize * 1.2,
              Math.sin(angle) * pulseSize * 1.2,
            );
            ctx.stroke();
          }

          ctx.restore();
        }

        // Draw Boat 4 (purple)
        ctx.save();
        ctx.translate(currentBoat4X, currentBoat4Y);
        ctx.rotate((boat4Rotation * Math.PI) / 180);
        ctx.scale(boatScale / 15, boatScale / 15);

        // Boat 4 hull - same shape as other boats
        ctx.beginPath();
        ctx.moveTo(0, -10);
        ctx.quadraticCurveTo(3, -3, 6, 6);
        ctx.lineTo(6, 9);
        ctx.quadraticCurveTo(0, 12, -6, 9);
        ctx.lineTo(-6, 6);
        ctx.quadraticCurveTo(-3, -3, 0, -10);
        ctx.fillStyle = boat4InPuff ? "#C4B5FD" : "#8B5CF6"; // Purple - brighter if in puff
        ctx.fill();
        ctx.strokeStyle = "white";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Boat 4 sail
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -12);
        ctx.lineTo(3, 3);
        ctx.lineTo(0, 6);
        ctx.lineTo(0, 0);
        ctx.fillStyle = "white";
        ctx.fill();

        ctx.restore();

        // Draw player 4 label with custom boat name
        const boat4Player = raceStore.boats.find((b) => b.id === "boat-4");
        ctx.fillStyle = "white";
        ctx.font = "14px Arial";
        ctx.textAlign = "center";
        // Use custom boat name if available, otherwise fall back to username
        const boat4Name =
          user?.boat4Name && user.boat4Name.trim()
            ? user.boat4Name
            : boat4Player?.username || "Player 4";
        ctx.fillText(boat4Name, currentBoat4X, currentBoat4Y + boatScale * 2);
      }

      // Draw stage transition effects
      const currentTime = Date.now();
      // Update and draw transition effects
      const updatedEffects = transitionEffects.filter((effect) => {
        // Only keep effects less than 2 seconds old
        if (currentTime - effect.createdAt > 2000) return false;

        // Calculate effect size and opacity based on age
        const age = (currentTime - effect.createdAt) / 1000; // in seconds
        const size = effect.size + age * 50; // Grow effect over time
        const opacity = 1 - age / 2; // Fade out over 2 seconds

        // Draw pulse effect
        ctx.save();
        ctx.globalAlpha = opacity;
        ctx.fillStyle = effect.color;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, size, 0, Math.PI * 2);
        ctx.fill();

        // Draw text "STAGE COMPLETE!"
        ctx.fillStyle = "white";
        ctx.font = "bold 20px Arial";
        ctx.textAlign = "center";
        ctx.fillText("STAGE COMPLETE!", effect.x, effect.y - size - 10);

        ctx.restore();

        return true;
      });

      // Update effects state if needed
      if (updatedEffects.length !== transitionEffects.length) {
        setTransitionEffects(updatedEffects);
      }

      // Draw debug info
      ctx.fillStyle = "white";
      ctx.font = "14px Arial"; // Consistent font size
      ctx.textAlign = "left";

      // Race stage display (more prominent)
      if (phase === "racing") {
        // Define race stage sequence variables here
        const stageSequence = [
          "Start Leg",
          "Upwind Leg",
          "Downwind Leg",
          "Second Upwind Leg",
          "Finish Leg",
          "Finished",
        ];
        const stageSequenceWidth = 500;
        const stageWidth = stageSequenceWidth / stageSequence.length;
        const sequenceY = 20;
        const sequenceHeight = 30;

        // Draw race stages at top
        // We're removing the background as requested
        // ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        // ctx.fillRect(centerX - stageSequenceWidth/2, sequenceY, stageSequenceWidth, sequenceHeight);

        // Draw stage markers
        stageSequence.forEach((stage, index) => {
          const stageX = centerX - stageSequenceWidth / 2 + index * stageWidth;

          // Current stage highlighting
          if (stage === boat1Stage) {
            ctx.fillStyle = "rgba(255, 87, 34, 0.4)"; // Player 1 color
            ctx.fillRect(stageX, sequenceY, stageWidth, sequenceHeight);
          }
          // Only show boat 2 highlighting if at least 2 boats are active
          if (boatCount >= 2 && stage === boat2Stage) {
            ctx.fillStyle = "rgba(59, 130, 246, 0.4)"; // Player 2 color (blue)
            ctx.fillRect(stageX, sequenceY, stageWidth, sequenceHeight);
          }

          // Show boat 3 highlighting if at least 3 boats are active
          if (boatCount >= 3 && stage === boat3Stage) {
            ctx.fillStyle = "rgba(16, 185, 129, 0.4)"; // Player 3 color (green)
            ctx.fillRect(stageX, sequenceY, stageWidth, sequenceHeight);
          }

          // Show boat 4 highlighting if all 4 boats are active
          if (boatCount >= 4 && stage === boat4Stage) {
            ctx.fillStyle = "rgba(139, 92, 246, 0.4)"; // Player 4 color (purple)
            ctx.fillRect(stageX, sequenceY, stageWidth, sequenceHeight);
          }

          // Stage labels - using consistent font size
          ctx.fillStyle = "white";
          ctx.font = "14px Arial"; // Use consistent font size
          ctx.textAlign = "center";
          ctx.fillText(
            stage.split(" ")[0],
            stageX + stageWidth / 2,
            sequenceY + sequenceHeight / 2 + 4,
          ); // First word only
        });

        // Race timer display
        const raceTimeDisplay = raceStartTime
          ? `Time: ${formatTime(Date.now() - raceStartTime)}`
          : "";

        // Moved time display below the progress bar (25px down from the progress bar)
        if (raceStage === "Finished") {
          ctx.fillStyle = "#4ade80"; // Green color
          ctx.fillText(
            `Finished in ${formatTime(finishTime || 0)}`,
            centerX,
            75,
          );
        } else if (raceTimeDisplay) {
          ctx.fillStyle = "white";
          ctx.textAlign = "center";
          ctx.font = "14px Arial";
          ctx.fillText(raceTimeDisplay, centerX, 75);
        }
      }

      // Boat info when racing
      if (phase === "racing") {
        // Removed race info at top (now displayed under player info)

        // Player 1 info with custom boat name
        const leftMargin = margin;
        ctx.fillStyle = "#FF5722"; // Orange for player 1
        ctx.font = "bold 14px Arial"; // Consistent font size
        // Use custom boat name in the side panel if available
        const boat1DisplayName =
          user?.boat1Name && user.boat1Name.trim()
            ? user.boat1Name
            : boat1?.username || "Player 1";
        ctx.fillText(`${boat1DisplayName}:`, leftMargin, margin + 50);
        ctx.fillStyle = "white";
        ctx.font = "14px Arial"; // Consistent font size
        ctx.fillText(
          `Speed: ${Math.round(boatState.speed)}`,
          leftMargin,
          margin + 70,
        );

        // Wind info for player 1 - use dynamic wind direction
        const boatDirection = boatState.rotation;

        // Calculate the relative wind angle more consistently
        let relativeAngle = Math.abs(windDirection - boatDirection);

        // Normalize to 0-180 range (port and starboard are symmetrical)
        if (relativeAngle > 180) {
          relativeAngle = 360 - relativeAngle;
        }

        let windEfficiency = 0;
        let pointOfSail = "";

        if (relativeAngle < 30) {
          windEfficiency = 0; // Reduced to 0 (no movement)
          pointOfSail = "In Irons";
        } else if (relativeAngle < 60) {
          windEfficiency = 0.5;
          pointOfSail = "Close Hauled";
        } else if (relativeAngle < 120) {
          windEfficiency = 1.0;
          pointOfSail = "Beam Reach";
        } else if (relativeAngle < 150) {
          windEfficiency = 0.8;
          pointOfSail = "Broad Reach";
        } else {
          windEfficiency = 0.6;
          pointOfSail = "Running";
        }

        ctx.fillText(`Point of Sail: ${pointOfSail}`, leftMargin, margin + 90);
        ctx.fillText(
          `Heading: ${Math.round(boatDirection)}°`,
          leftMargin,
          margin + 110,
        );

        // Display this boat's specific race stage with white text as requested
        ctx.fillStyle = "white"; // Use white for stage text
        ctx.font = "bold 14px Arial";
        ctx.fillText(`Stage: ${boat1Stage}`, leftMargin, margin + 130);
        ctx.fillStyle = "white"; // Keep white as default
        ctx.font = "14px Arial";

        // Player 2 info - only process & show if at least 2 boats are active
        if (boatCount >= 2) {
          ctx.fillStyle = "#3B82F6"; // Blue for player 2
          ctx.font = "bold 14px Arial"; // Consistent font size

          // Get boat 2 info from the race store
          const boat2Info = raceStore.boats.find((b) => b.id === "boat-2");
          // Use custom boat name in the side panel if available
          const boat2DisplayName =
            user?.boat2Name && user.boat2Name.trim()
              ? user.boat2Name
              : boat2Info?.username || "Player 2";
          ctx.fillText(`${boat2DisplayName}:`, leftMargin, margin + 150); // +10 pixels
          ctx.fillStyle = "white";
          ctx.font = "14px Arial"; // Consistent font size
          ctx.fillText(
            `Speed: ${Math.round(boat2State.speed)}`,
            leftMargin,
            margin + 170,
          ); // +10 pixels

          // Wind info for player 2
          const boat2Direction = boat2State.rotation;

          // Calculate the relative wind angle more consistently
          let relativeAngle2 = Math.abs(windDirection - boat2Direction);

          // Normalize to 0-180 range (port and starboard are symmetrical)
          if (relativeAngle2 > 180) {
            relativeAngle2 = 360 - relativeAngle2;
          }

          let windEfficiency2 = 0;
          let pointOfSail2 = "";

          if (relativeAngle2 < 30) {
            windEfficiency2 = 0; // Reduced to 0 (no movement)
            pointOfSail2 = "In Irons";
          } else if (relativeAngle2 < 60) {
            windEfficiency2 = 0.5;
            pointOfSail2 = "Close Hauled";
          } else if (relativeAngle2 < 120) {
            windEfficiency2 = 1.0;
            pointOfSail2 = "Beam Reach";
          } else if (relativeAngle2 < 150) {
            windEfficiency2 = 0.8;
            pointOfSail2 = "Broad Reach";
          } else {
            windEfficiency2 = 0.6;
            pointOfSail2 = "Running";
          }

          ctx.fillText(
            `Point of Sail: ${pointOfSail2}`,
            leftMargin,
            margin + 190,
          ); // +10 pixels
          ctx.fillText(
            `Heading: ${Math.round(boat2Direction)}°`,
            leftMargin,
            margin + 210,
          ); // +10 pixels

          // Display boat 2's specific race stage with white text
          ctx.fillStyle = "white"; // Use white for stage text
          ctx.font = "bold 14px Arial";
          ctx.fillText(`Stage: ${boat2Stage}`, leftMargin, margin + 230); // +10 pixels
          ctx.fillStyle = "white"; // Keep white as default
          ctx.font = "14px Arial";
        }

        // Player 3 info - only display if at least 3 boats are active
        if (boatCount >= 3) {
          ctx.fillStyle = "#10B981"; // Green for player 3
          ctx.font = "bold 14px Arial";

          // Get boat 3 info from the race store
          const boat3Info = raceStore.boats.find((b) => b.id === "boat-3");
          // Use custom boat name in the side panel if available
          const boat3DisplayName =
            user?.boat3Name && user.boat3Name.trim()
              ? user.boat3Name
              : boat3Info?.username || "Player 3";
          ctx.fillText(`${boat3DisplayName}:`, leftMargin, margin + 250); // +20 from boat 2
          ctx.fillStyle = "white";
          ctx.font = "14px Arial";
          ctx.fillText(
            `Speed: ${Math.round(boat3State.speed)}`,
            leftMargin,
            margin + 270,
          );

          // Wind info for player 3
          const boat3Direction = boat3State.rotation;

          // Calculate relative wind angle
          let relativeAngle3 = Math.abs(windDirection - boat3Direction);

          // Normalize to 0-180 range
          if (relativeAngle3 > 180) {
            relativeAngle3 = 360 - relativeAngle3;
          }

          // Determine point of sail and efficiency
          let windEfficiency3 = 0;
          let pointOfSail3 = "";

          if (relativeAngle3 < 30) {
            windEfficiency3 = 0;
            pointOfSail3 = "In Irons";
          } else if (relativeAngle3 < 60) {
            windEfficiency3 = 0.5;
            pointOfSail3 = "Close Hauled";
          } else if (relativeAngle3 < 120) {
            windEfficiency3 = 1.0;
            pointOfSail3 = "Beam Reach";
          } else if (relativeAngle3 < 150) {
            windEfficiency3 = 0.8;
            pointOfSail3 = "Broad Reach";
          } else {
            windEfficiency3 = 0.6;
            pointOfSail3 = "Running";
          }

          ctx.fillText(
            `Point of Sail: ${pointOfSail3}`,
            leftMargin,
            margin + 290,
          );
          ctx.fillText(
            `Heading: ${Math.round(boat3Direction)}°`,
            leftMargin,
            margin + 310,
          );

          // Display boat 3's race stage with white text
          ctx.fillStyle = "white"; // Use white for stage text
          ctx.font = "bold 14px Arial";
          ctx.fillText(`Stage: ${boat3Stage}`, leftMargin, margin + 330);
          ctx.fillStyle = "white"; // Keep white as default
          ctx.font = "14px Arial";
        }

        // Player 4 info - only display if all 4 boats are active
        if (boatCount >= 4) {
          ctx.fillStyle = "#8B5CF6"; // Purple for player 4
          ctx.font = "bold 14px Arial";

          // Get boat 4 info from the race store
          const boat4Info = raceStore.boats.find((b) => b.id === "boat-4");
          // Use custom boat name in the side panel if available
          const boat4DisplayName =
            user?.boat4Name && user.boat4Name.trim()
              ? user.boat4Name
              : boat4Info?.username || "Player 4";
          ctx.fillText(`${boat4DisplayName}:`, leftMargin, margin + 350); // +20 from boat 3
          ctx.fillStyle = "white";
          ctx.font = "14px Arial";
          ctx.fillText(
            `Speed: ${Math.round(boat4State.speed)}`,
            leftMargin,
            margin + 370,
          );

          // Wind info for player 4
          const boat4Direction = boat4State.rotation;

          // Calculate relative wind angle
          let relativeAngle4 = Math.abs(windDirection - boat4Direction);

          // Normalize to 0-180 range
          if (relativeAngle4 > 180) {
            relativeAngle4 = 360 - relativeAngle4;
          }

          // Determine point of sail and efficiency
          let windEfficiency4 = 0;
          let pointOfSail4 = "";

          if (relativeAngle4 < 30) {
            windEfficiency4 = 0;
            pointOfSail4 = "In Irons";
          } else if (relativeAngle4 < 60) {
            windEfficiency4 = 0.5;
            pointOfSail4 = "Close Hauled";
          } else if (relativeAngle4 < 120) {
            windEfficiency4 = 1.0;
            pointOfSail4 = "Beam Reach";
          } else if (relativeAngle4 < 150) {
            windEfficiency4 = 0.8;
            pointOfSail4 = "Broad Reach";
          } else {
            windEfficiency4 = 0.6;
            pointOfSail4 = "Running";
          }

          ctx.fillText(
            `Point of Sail: ${pointOfSail4}`,
            leftMargin,
            margin + 390,
          );
          ctx.fillText(
            `Heading: ${Math.round(boat4Direction)}°`,
            leftMargin,
            margin + 410,
          );

          // Display boat 4's race stage with white text
          ctx.fillStyle = "white"; // Use white for stage text
          ctx.font = "bold 14px Arial";
          ctx.fillText(`Stage: ${boat4Stage}`, leftMargin, margin + 430);
          ctx.fillStyle = "white"; // Keep white as default
          ctx.font = "14px Arial";
        }

        // Race stage sequence is now drawn at the beginning of the racing phase

        // Wind direction moved below timer in center as requested
        // Format wind direction using compass angles (0-360°)
        // 0° = North, 90° = East, 180° = South, 270° = West
        let directionLabel = `${Math.round(windDirection)}°`;
        const windText = `Wind Direction: ${directionLabel}`;

        // Position it 75px below the timer (which is at 20px + 30px + 25px from top)
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial"; // Consistent font size
        ctx.textAlign = "center";
        // Since the timer is at about 75px from top (20+30+25), put wind direction 25px below that
        ctx.fillText(windText, centerX, 100);

        // Current direction display - added below wind direction
        // Get the actual current strength from the wind store (in knots, not internal units)
        const windStore = useWind.getState();
        const actualCurrentStrength = windStore.currentStrength;
        const currentText = `Current Direction: ${actualCurrentStrength.toFixed(1)} knots (flow ${Math.round(current.direction)}°)`;
        ctx.fillText(currentText, centerX, 120); // 20px below wind direction

        // Wind direction arrow removed as requested

        // Current indicator removed as requested

        // Removed wind speed display as requested

        // Draw leaderboard at middle right of screen
        const leaderboardX = canvas.width - margin - 120; // 120px width for leaderboard, pushed further right
        const leaderboardY = canvas.height / 2 - 100; // Positioned in the middle right

        // Removed black background from leaderboard as requested

        // Leaderboard title
        ctx.fillStyle = "white";
        ctx.font = "bold 14px Arial"; // Consistent font size
        ctx.textAlign = "center";
        ctx.fillText("LEADERBOARD", leaderboardX + 60, leaderboardY + 25);

        // Draw leaderboard entries
        ctx.font = "14px Arial"; // Consistent font size
        ctx.textAlign = "left";

        if (leaderboard.length === 0) {
          ctx.fillText(
            "No finishers yet",
            leaderboardX + 10,
            leaderboardY + 60,
          );
        } else {
          leaderboard.forEach((entry, index) => {
            const position = index + 1;
            const formattedTime = formatTime(entry.time);
            ctx.fillText(
              `${position}. ${entry.player}: ${formattedTime}`,
              leaderboardX + 10,
              leaderboardY + 60 + index * 30,
            );
          });
        }

        // Reset text alignment for subsequent text
        ctx.textAlign = "left";

        // Removed keys display at bottom left as requested
      }

      // Wind arrow removed as requested

      // Show pause state in center of screen
      if (isPaused && phase === "racing") {
        // Calculate center Y position
        const centerY = canvas.height / 2;

        // Semi-transparent overlay
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Pause text
        ctx.fillStyle = "white";
        ctx.font = `bold ${Math.max(32, canvas.width * 0.05)}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("GAME PAUSED", centerX, centerY - 40);

        // Instructions
        ctx.font = `${Math.max(16, canvas.width * 0.02)}px Arial`;
        ctx.fillText("Press SPACEBAR to resume", centerX, centerY + 20);

        // Reset baseline
        ctx.textBaseline = "alphabetic";
      }

      // Update countdown timer if in starting phase
      if (phase === "starting") {
        // Update timer in race store
        const newTime = Math.max(0, timeRemaining - deltaTime);
        useRace.setState({ timeRemaining: newTime });

        if (newTime <= 0) {
          startRace();
        }
      }

      // Continue animation
      animationRef.current = requestAnimationFrame(draw);
    };

    // Start animation loop
    animationRef.current = requestAnimationFrame(draw);

    // Cleanup
    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [phase, timeRemaining, startRace, keys, boatState, isPaused]);

  return (
    <div className="absolute inset-0 overflow-hidden flex justify-center items-center bg-blue-900">
      <canvas
        ref={canvasRef}
        className="bg-blue-900"
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    </div>
  );
}
