import { Vector2D } from "./physics";

// Helper functions for wind-related calculations

// Calculate the point affected by wind at a specific point
export function calculateWindEffect(
  position: Vector2D,
  windDirection: number,
  windStrength: number,
  deltaTime: number
): Vector2D {
  // Convert wind direction to radians (0 degrees is from top of screen)
  const windRad = (windDirection * Math.PI) / 180;
  
  // Calculate wind force vector
  const windForceX = Math.sin(windRad) * windStrength;
  const windForceY = Math.cos(windRad) * windStrength;
  
  // Calculate displacement due to wind
  const dx = windForceX * deltaTime;
  const dy = windForceY * deltaTime;
  
  return {
    x: position.x + dx,
    y: position.y + dy,
  };
}

// Check if a position is in the turbulence zone behind a boat
export function isInTurbulenceZone(
  position: Vector2D,
  boatPosition: Vector2D,
  boatDirection: number,
  windDirection: number
): boolean {
  // Constants for turbulence zone
  const turbulenceLength = 160; // 4 boat lengths
  const turbulenceWidth = 20; // Width of turbulence zone
  
  // Calculate the turbulence zone as a rectangle behind the boat
  // Use the wind direction to determine the orientation of the turbulence zone
  const turbulenceRad = (windDirection * Math.PI) / 180;
  
  // Calculate the end point of the turbulence zone
  const turbulenceEndX = boatPosition.x + Math.sin(turbulenceRad) * turbulenceLength;
  const turbulenceEndY = boatPosition.y + Math.cos(turbulenceRad) * turbulenceLength;
  
  // Calculate the vector from boat to point
  const dx = position.x - boatPosition.x;
  const dy = position.y - boatPosition.y;
  
  // Project point onto turbulence line
  const turbulenceLineX = turbulenceEndX - boatPosition.x;
  const turbulenceLineY = turbulenceEndY - boatPosition.y;
  const lineLengthSquared = turbulenceLineX * turbulenceLineX + turbulenceLineY * turbulenceLineY;
  
  // Calculate projection scalar (dot product / length squared)
  const t = (dx * turbulenceLineX + dy * turbulenceLineY) / lineLengthSquared;
  
  // If projection is outside line segment, point is not in turbulence zone
  if (t < 0 || t > 1) {
    return false;
  }
  
  // Calculate closest point on line
  const closestX = boatPosition.x + t * turbulenceLineX;
  const closestY = boatPosition.y + t * turbulenceLineY;
  
  // Calculate distance to line
  const distanceSquared = 
    Math.pow(position.x - closestX, 2) + 
    Math.pow(position.y - closestY, 2);
  
  // If distance is less than width, point is in turbulence zone
  return distanceSquared <= turbulenceWidth * turbulenceWidth;
}

// Calculate the wind strength at a position, considering turbulence from other boats
export function getEffectiveWindStrength(
  position: Vector2D,
  baseStrength: number,
  boats: Array<{ position: Vector2D; rotation: number }>,
  windDirection: number
): number {
  let effectiveStrength = baseStrength;
  
  // Check if position is in any boat's turbulence zone
  for (const boat of boats) {
    if (isInTurbulenceZone(position, boat.position, boat.rotation, windDirection)) {
      // Reduce wind strength by 1 knot in turbulence zone
      effectiveStrength = Math.max(1, effectiveStrength - 1);
      break; // Assuming zones don't stack
    }
  }
  
  return effectiveStrength;
}

// Calculate the wind arrow direction for UI display
export function getWindArrowRotation(windDirection: number): number {
  // Convert wind direction to arrow rotation (wind direction is where wind comes FROM)
  // For arrow, we want to show where wind is going TO, so add 180 degrees
  return windDirection + 180;
}

// Generate an array of wind indicator positions for UI display
export function generateWindIndicators(
  canvasWidth: number,
  canvasHeight: number,
  spacing: number
): Vector2D[] {
  const indicators: Vector2D[] = [];
  
  // Create a grid of wind indicators
  for (let x = spacing / 2; x < canvasWidth; x += spacing) {
    for (let y = spacing / 2; y < canvasHeight; y += spacing) {
      indicators.push({ x, y });
    }
  }
  
  return indicators;
}
