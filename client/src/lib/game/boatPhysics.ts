import { degToRad } from "./physics";

// The range of angles considered "upwind"
// Upwind is defined as <90° to the wind
export const UPWIND_ANGLE = 90;

// Minimum angle to the wind to make progress upwind (tacking angle)
export const MIN_UPWIND_ANGLE = 30;

// Calculate optimal sail position based on wind angle
export function calculateOptimalSailPosition(
  boatDirection: number,
  windDirection: number
): number {
  // Calculate the relative wind angle to the boat
  let relativeWindAngle = Math.abs(windDirection - boatDirection);
  
  // Normalize to 0-180 range (port and starboard are symmetrical)
  if (relativeWindAngle > 180) {
    relativeWindAngle = 360 - relativeWindAngle;
  }
  
  // Upwind sailing (0-90 degrees to wind)
  if (relativeWindAngle < UPWIND_ANGLE) {
    // Close-hauled sailing: sail is trimmed in tight
    return 100; // 100% trimmed
  } 
  // Reaching (90-150 degrees to wind)
  else if (relativeWindAngle < 150) {
    // Progressively ease the sail out
    const easing = (relativeWindAngle - UPWIND_ANGLE) / 60; // 0-1 value
    return 100 - (easing * 50); // From 100% to 50% trimmed
  } 
  // Downwind (150-180 degrees to wind)
  else {
    // Sail is eased out
    const easing = (relativeWindAngle - 150) / 30; // 0-1 value
    return 50 - (easing * 25); // From 50% to 25% trimmed
  }
}

// Calculate sail efficiency based on sail position vs optimal position
export function calculateSailEfficiency(
  boatDirection: number,
  windDirection: number,
  sailPosition: number
): number {
  const optimalPosition = calculateOptimalSailPosition(boatDirection, windDirection);
  
  // Calculate difference from optimal position (0-100)
  const difference = Math.abs(sailPosition - optimalPosition);
  
  // Convert to efficiency (100% at optimal, drops as position moves away)
  let efficiency = 1 - (difference / 100);
  
  // Limit minimum efficiency to 0.3 to avoid boats coming to a complete stop
  return Math.max(0.3, efficiency);
}

// Calculate boat speed based on wind and sail factors
export function calculateBoatSpeed(
  boatDirection: number,
  windDirection: number,
  windStrength: number,
  sailPosition: number
): number {
  // Calculate the relative wind angle to the boat
  let relativeWindAngle = Math.abs(windDirection - boatDirection);
  
  // Normalize to 0-180 range (port and starboard are symmetrical)
  if (relativeWindAngle > 180) {
    relativeWindAngle = 360 - relativeWindAngle;
  }
  
  // Base speed is 5 knots
  let baseSpeed = 5;
  
  // Adjust base speed based on wind strength
  baseSpeed += (windStrength - 5) * 0.4; // +/- 2 knots for wind strength variation
  
  // Calculate sail efficiency
  const sailEfficiency = calculateSailEfficiency(
    boatDirection,
    windDirection,
    sailPosition
  );
  
  // Calculate angle efficiency
  let angleEfficiency = 1.0;
  
  // Upwind sailing is slower
  if (relativeWindAngle < UPWIND_ANGLE) {
    // Very slow when sailing directly into the wind
    if (relativeWindAngle < MIN_UPWIND_ANGLE) {
      angleEfficiency = 0.1; // Nearly stopped when pinching
    } else {
      // Linear increase from slow to full speed as angle increases to 90
      angleEfficiency = 0.5 + 0.5 * ((relativeWindAngle - MIN_UPWIND_ANGLE) / (UPWIND_ANGLE - MIN_UPWIND_ANGLE));
    }
  }
  // Reaching is fastest
  else if (relativeWindAngle < 150) {
    angleEfficiency = 1.2; // 20% speed bonus when reaching
  }
  // Downwind is slightly slower than reaching
  else {
    angleEfficiency = 1.0;
  }
  
  // Apply both efficiencies to base speed
  const finalSpeed = baseSpeed * sailEfficiency * angleEfficiency;
  
  // Ensure speed is never negative, and has a reasonable minimum
  return Math.max(0.5, finalSpeed);
}

// Determine which tack a boat is on based on wind direction
export function determineTack(
  boatDirection: number,
  windDirection: number
): "port" | "starboard" {
  // Calculate the difference between wind and boat direction
  let angleDiff = (boatDirection - windDirection) % 360;
  if (angleDiff < 0) angleDiff += 360;
  
  // Determine the tack based on relative position to wind
  return angleDiff < 180 ? "port" : "starboard";
}

// Calculate the visual rotation angle for the sail based on wind and boat direction
export function calculateSailRotation(
  boatDirection: number,
  windDirection: number,
  tack: "port" | "starboard"
): number {
  // Calculate the relative wind angle to the boat
  let relativeWindAngle = windDirection - boatDirection;
  
  // Normalize to -180 to 180 range
  if (relativeWindAngle > 180) relativeWindAngle -= 360;
  if (relativeWindAngle < -180) relativeWindAngle += 360;
  
  // Determine sail angle based on tack and wind angle
  if (tack === "port") {
    // Port tack: sail on starboard side
    return Math.min(45, Math.max(-45, -relativeWindAngle / 2));
  } else {
    // Starboard tack: sail on port side
    return Math.min(45, Math.max(-45, -relativeWindAngle / 2));
  }
}

// Check if a boat is pointing upwind enough to make progress
export function isPointingUpwind(
  boatDirection: number,
  windDirection: number
): boolean {
  // Calculate the relative wind angle to the boat
  let relativeWindAngle = Math.abs(windDirection - boatDirection);
  
  // Normalize to 0-180 range
  if (relativeWindAngle > 180) {
    relativeWindAngle = 360 - relativeWindAngle;
  }
  
  // Check if boat is pointing at least at the minimum upwind angle
  return relativeWindAngle >= MIN_UPWIND_ANGLE;
}
