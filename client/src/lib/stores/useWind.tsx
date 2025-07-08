import { create } from "zustand";
import { subscribeWithSelector } from "zustand/middleware";
import { useSeason, Season } from "./useSeason";

// Wind cell represents a specific area with a wind strength
export interface WindCell {
  id: number;
  x: number;
  y: number;
  radius: number;
  strength: number; // -2 to +2 relative to base wind
}

interface WindState {
  // Wind properties
  baseStrength: number; // Base wind strength in knots
  direction: number; // Wind direction in degrees (0 = from top of screen)
  cells: WindCell[]; // Areas of different wind strength

  // Current properties
  currentDirection: number; // Current direction in degrees (0-359)
  currentStrength: number; // Current strength in knots

  // Current simulation settings
  tick: number; // Used to trigger wind shifts

  // Actions
  initializeWind: () => void;
  updateWindDirection: () => void;
  updateWindCells: () => void;
  getWindAt: (x: number, y: number) => { strength: number; direction: number };
  getCurrentAt: (
    x: number,
    y: number,
  ) => { strength: number; direction: number };
}

// Location-specific wind and current settings
interface LocationWindSettings {
  windDirectionRange: number; // How much wind can shift from North (±degrees)
  windChangeSpeed: "slow" | "medium" | "rapid"; // How quickly wind direction changes
  puffFrequency: "low" | "medium" | "high"; // How many puffs appear
  puffDistribution: "random" | "biased"; // How puffs are distributed
  currentMin: number; // Minimum current strength (knots)
  currentMax: number; // Maximum current strength (knots)
  baseWindStrength: number; // Minimum wind strength in knots
  windMaxStrength: number; // Maximum wind strength in knots
  description: string; // Text description of the location's conditions
}

const locationSettings: Record<Season, LocationWindSettings> = {
  sanfrancisco: {
    windDirectionRange: 10, // Wind shifts up to 10 degrees from North
    windChangeSpeed: "medium", // Medium wind changes (smaller, gradual shifts)
    puffFrequency: "medium", // Some random puffs
    puffDistribution: "random", // Puffs distributed randomly
    currentMin: 2.0, // Minimum 2 knots of current
    currentMax: 5.0, // Maximum 5 knots of current
    baseWindStrength: 16, // Minimum wind strength (16 knots)
    windMaxStrength: 28, // Maximum wind strength (28 knots)
    description:
      "San Francisco Bay: Strong currents (2-3 knots), heavy winds (16-28 knots). Wind tends to shift more westerly than easterly (range: 350°-10°).",
  },
  longbeach: {
    windDirectionRange: 10, // Wind shifts up to 10 degrees from North
    windChangeSpeed: "medium", // Medium wind changes (smaller, gradual shifts)
    puffFrequency: "medium", // Medium amount of puffs
    puffDistribution: "biased", // More puffs on one side (fluctuates)
    currentMin: 0.0, // Minimum no current
    currentMax: 1.5, // Maximum 1.5 knots of current
    baseWindStrength: 5, // Minimum wind strength (5 knots)
    windMaxStrength: 28, // Maximum wind strength (28 knots)
    description:
      "Olympic Venue 2028: Olympic racing venue with variable winds (5-28 knots), light currents. Wind shifts equally in both directions (range: 350°-10°).",
  },
  newportharbor: {
    windDirectionRange: 20, // Wind shifts up to 20 degrees from North
    windChangeSpeed: "rapid", // Rapid wind changes with 2-degree increments
    puffFrequency: "high", // Lots of puffs
    puffDistribution: "random", // Randomly distributed puffs
    currentMin: 0.0, // No current
    currentMax: 0.0, // No current
    baseWindStrength: 5, // Minimum wind strength (5 knots)
    windMaxStrength: 12, // Maximum wind strength (12 knots)
    description:
      "Newport Harbor: No current, light to moderate winds (5-12 knots). Wind shifts rapidly in exact ±2° increments (range: 340°-20°).",
  },
};

// Helper function to create wind cells based on location settings
const createWindCells = (
  count: number,
  locationSetting: LocationWindSettings,
): WindCell[] => {
  const cells: WindCell[] = [];
  const canvasWidth = 1000;
  const canvasHeight = 800;

  // Adjust count based on puff frequency
  let adjustedCount = count;
  if (locationSetting.puffFrequency === "low")
    adjustedCount = Math.floor(count * 0.6);
  if (locationSetting.puffFrequency === "high")
    adjustedCount = Math.floor(count * 1.5);

  for (let i = 0; i < adjustedCount; i++) {
    let x = Math.random() * canvasWidth;

    // If biased distribution, favor one side (which side changes over time)
    if (locationSetting.puffDistribution === "biased") {
      // Determine which side has more puffs (changes every minute or so)
      const now = new Date();
      const favorLeftSide = Math.floor(now.getTime() / 60000) % 2 === 0;

      if (favorLeftSide) {
        x = Math.random() * (canvasWidth * 0.7); // 70% chance on left side
      } else {
        x = canvasWidth * 0.3 + Math.random() * (canvasWidth * 0.7); // 70% chance on right side
      }
    }

    cells.push({
      id: i,
      x: x,
      y: Math.random() * canvasHeight,
      radius: 50 + Math.random() * 100, // Random radius between 50-150
      strength: Math.floor(Math.random() * 5) - 2, // Random strength -2 to +2
    });
  }

  return cells;
};

export const useWind = create<WindState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    baseStrength: 5, // 5 knots base wind speed
    direction: 0, // Wind coming from top of screen
    cells: [],
    currentDirection: 0,
    currentStrength: 0,
    tick: 0,

    // Actions
    initializeWind: () => {
      // Get current location from season store
      const { currentSeason } = useSeason.getState();
      const settings = locationSettings[currentSeason as Season];

      // Randomize current direction (using compass angles 0-360°)
      const randomCurrentDirection = Math.random() * 360; // 0-360 degrees

      // Set current strength based on location settings
      // If min and max are the same, use that value
      // Otherwise, randomly select a value between min and max
      const currentStrength =
        settings.currentMin === settings.currentMax
          ? settings.currentMin
          : settings.currentMin +
            Math.random() * (settings.currentMax - settings.currentMin);

      // Randomize wind strength between min and max for the location
      const randomWindStrength = settings.windMaxStrength
        ? settings.baseWindStrength +
          Math.random() * (settings.windMaxStrength - settings.baseWindStrength)
        : settings.baseWindStrength;

      // Initialize wind direction based on location settings
      // Randomly set initial direction within the allowed range from North
      // Using standard compass angles (0-360°)
      let initialWindDirection = 0; // Default is North (0°)

      // 50% chance to start with either east or west variation from North
      if (Math.random() > 0.5) {
        // East variation (clockwise, 0° to +range)
        initialWindDirection = Math.random() * settings.windDirectionRange;
      } else {
        // West variation (counterclockwise, 360-range to 359°)
        initialWindDirection =
          360 - Math.random() * settings.windDirectionRange;
      }

      set({
        baseStrength: randomWindStrength, // Use the randomized wind strength
        direction: initialWindDirection,
        cells: createWindCells(10, settings),
        currentDirection: randomCurrentDirection,
        currentStrength: currentStrength,
        tick: 0,
      });

      console.log(
        `Wind initialized for ${currentSeason}: Direction=${Math.round(initialWindDirection)}°, Strength=${randomWindStrength.toFixed(1)} knots (range: ${settings.baseWindStrength}-${settings.windMaxStrength} knots)`,
      );
      console.log(
        `Current initialized for ${currentSeason}: Direction=${Math.round(randomCurrentDirection)}°, Strength=${currentStrength.toFixed(1)} knots`,
      );
      console.log(`Location conditions: ${settings.description}`);
    },

    updateWindDirection: () => {
      // Get current location from season store
      const { currentSeason } = useSeason.getState();
      const settings = locationSettings[currentSeason as Season];

      // Shift wind direction based on location settings
      set((state) => {
        // Determine shift magnitude based on wind change speed and location
        let shiftMagnitude = 0.5; // Default (slow)

        if (settings.windChangeSpeed === "medium") {
          shiftMagnitude = 1.0;
        } else if (settings.windChangeSpeed === "rapid") {
          // Newport Harbor specific - use larger increments (2 degrees) for more rapid shifts
          if (currentSeason === "newportharbor") {
            shiftMagnitude = 4.0; // Even more rapid for Newport Harbor (2 degree shifts)
          } else {
            shiftMagnitude = 2.0; // Standard rapid
          }
        }

        // Generate a random shift that can be positive (east/clockwise) or negative (west/counterclockwise)
        let randomShift;

        // Handle venue-specific wind shift patterns
        if (currentSeason === "newportharbor") {
          // Newport Harbor: Exact 2-degree increments (either +2° or -2°) for precise shifts
          randomShift = Math.random() > 0.5 ? 2.0 : -2.0;
          console.log(
            `Newport Harbor wind shift: exactly ${randomShift}° (${randomShift > 0 ? "clockwise/east" : "counterclockwise/west"})`,
          );
        } else if (currentSeason === "sanfrancisco") {
          // San Francisco: Larger shifts (1-2 degrees) with preference for westerly (negative) shifts
          // 60% chance for westerly shift, 40% chance for easterly shift
          if (Math.random() < 0.6) {
            // Westerly shift (counterclockwise)
            randomShift = -(Math.random() * shiftMagnitude + 0.5);
          } else {
            // Easterly shift (clockwise)
            randomShift = Math.random() * shiftMagnitude + 0.5;
          }
          console.log(
            `San Francisco wind shift: ${randomShift.toFixed(2)}° (${randomShift > 0 ? "clockwise/east" : "counterclockwise/west"})`,
          );
        } else if (currentSeason === "longbeach") {
          // Olympic Venue: Medium shifts with more symmetrical distribution
          // 50/50 chance for easterly or westerly shifts
          randomShift =
            (Math.random() > 0.5 ? 1 : -1) * (Math.random() * shiftMagnitude);
          console.log(
            `Olympic Venue wind shift: ${randomShift.toFixed(2)}° (${randomShift > 0 ? "clockwise/east" : "counterclockwise/west"})`,
          );
        } else {
          // Generic behavior for any other venues
          randomShift = Math.random() * 2 * shiftMagnitude - shiftMagnitude;
          console.log(
            `Wind shift: ${randomShift.toFixed(2)}° (${randomShift > 0 ? "clockwise/east" : "counterclockwise/west"})`,
          );
        }

        // Apply the shift to the current direction
        let newDirection = (state.direction + randomShift) % 360;

        // Handle negative angles by adding 360
        if (newDirection < 0) newDirection += 360;

        // Keep direction within the windDirectionRange from North (0°)
        // Allow wind to shift both east (0° to +range) and west (360-range to 359°)
        const range = settings.windDirectionRange;

        // Check if direction has shifted outside the allowed range
        // Handle both North (0°) and all other compass directions
        const oldDirection = state.direction;

        if (newDirection === 0 || newDirection === 360) {
          // We're exactly on North, which is always allowed
          newDirection = 0; // Normalize to 0
        } else if (newDirection > 0 && newDirection <= 180) {
          // East side of compass (clockwise from North)
          if (newDirection > range) {
            // If we've gone too far east, cap at the maximum eastern range
            console.log(
              `Wind capped eastward: ${newDirection.toFixed(1)}° → ${range}°`,
            );
            newDirection = range;
          }
        } else {
          // West side of compass (counterclockwise from North)
          if (
            newDirection < 360 &&
            newDirection > 180 &&
            newDirection < 360 - range
          ) {
            // If we've gone too far west, cap at the maximum western range
            console.log(
              `Wind capped westward: ${newDirection.toFixed(1)}° → ${360 - range}°`,
            );
            newDirection = 360 - range;
          }
        }

        // Log the final direction change
        if (Math.abs(oldDirection - newDirection) >= 0.1) {
          console.log(
            `Wind direction changed: ${Math.round(oldDirection)}° → ${Math.round(newDirection)}°`,
          );
        }

        return { direction: newDirection, tick: state.tick + 1 };
      });
    },

    updateWindCells: () => {
      // Get current location from season store
      const { currentSeason } = useSeason.getState();
      const settings = locationSettings[currentSeason as Season];

      // Slowly drift wind cells and occasionally change strength
      set((state) => {
        const newCells = state.cells.map((cell) => {
          // Random drift
          const driftX = Math.random() * 2 - 1;
          const driftY = Math.random() * 2 - 1;

          // Occasionally change strength with location-specific probabilities
          let strengthChangeProb = 0.1; // Default
          if (settings.puffFrequency === "low") strengthChangeProb = 0.05;
          if (settings.puffFrequency === "high") strengthChangeProb = 0.15;

          const newStrength =
            Math.random() < strengthChangeProb
              ? Math.max(
                  -2,
                  Math.min(2, cell.strength + (Math.random() > 0.5 ? 1 : -1)),
                )
              : cell.strength;

          return {
            ...cell,
            x: cell.x + driftX,
            y: cell.y + driftY,
            strength: newStrength,
          };
        });

        return { cells: newCells };
      });
    },

    getWindAt: (x, y) => {
      const { baseStrength, direction, cells } = get();

      // Calculate wind strength based on cells
      let strengthModifier = 0;

      for (const cell of cells) {
        // Calculate distance from point to cell center
        const distance = Math.sqrt(
          Math.pow(x - cell.x, 2) + Math.pow(y - cell.y, 2),
        );

        // If point is within cell radius, apply the cell's strength modifier
        if (distance < cell.radius) {
          // Weight by distance from center (stronger at center, weaker at edges)
          const weight = 1 - distance / cell.radius;
          strengthModifier += cell.strength * weight;
        }
      }

      // Clamp wind strength between 1-10 knots
      const finalStrength = Math.max(
        1,
        Math.min(10, baseStrength + strengthModifier),
      );

      return {
        strength: finalStrength,
        direction: direction,
      };
    },

    getCurrentAt: (x, y) => {
      const { currentStrength, currentDirection } = get();

      // Currently, current is uniform across the field
      return {
        strength: currentStrength,
        direction: currentDirection,
      };
    },
  })),
);
