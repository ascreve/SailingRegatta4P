import { Boat } from "../stores/useRace";
import { calculateBoatSpeed } from "./boatPhysics";

// Interfaces for physics objects
export interface Vector2D {
  x: number;
  y: number;
}

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  radius: number;
}

// Helper function to convert degrees to radians
export function degToRad(degrees: number): number {
  return degrees * Math.PI / 180;
}

// Helper function to convert radians to degrees
export function radToDeg(radians: number): number {
  return radians * 180 / Math.PI;
}

// Calculate vector from angle and magnitude
export function vectorFromAngle(angleDegrees: number, magnitude: number): Vector2D {
  const angleRad = degToRad(angleDegrees);
  return {
    x: Math.sin(angleRad) * magnitude,
    y: -Math.cos(angleRad) * magnitude, // Negative because 0 degrees is up in our system
  };
}

// Calculate angle between two points
export function angleBetweenPoints(from: Vector2D, to: Vector2D): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  let angle = radToDeg(Math.atan2(dy, dx)) + 90; // +90 because 0 is up in our system
  if (angle < 0) angle += 360;
  return angle;
}

// Calculate distance between two points
export function distance(point1: Vector2D, point2: Vector2D): number {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Check if a point is inside a rectangle
export function pointInRectangle(point: Vector2D, rect: Rectangle): boolean {
  return (
    point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height
  );
}

// Check if a point is inside a circle
export function pointInCircle(point: Vector2D, circle: Circle): boolean {
  const dx = point.x - circle.x;
  const dy = point.y - circle.y;
  return dx * dx + dy * dy <= circle.radius * circle.radius;
}

// Check if two circles are colliding
export function circlesColliding(circle1: Circle, circle2: Circle): boolean {
  const dx = circle1.x - circle2.x;
  const dy = circle1.y - circle2.y;
  const distanceSquared = dx * dx + dy * dy;
  const radiusSum = circle1.radius + circle2.radius;
  return distanceSquared <= radiusSum * radiusSum;
}

// Calculate if a point is on the left side of a line segment
export function isPointLeftOfLine(
  lineStart: Vector2D,
  lineEnd: Vector2D,
  point: Vector2D
): boolean {
  return (
    (lineEnd.x - lineStart.x) * (point.y - lineStart.y) -
      (lineEnd.y - lineStart.y) * (point.x - lineStart.x) >
    0
  );
}

// Check if a line segment intersects with a circle
export function lineCircleIntersection(
  lineStart: Vector2D,
  lineEnd: Vector2D,
  circle: Circle
): boolean {
  // Vector from line start to circle center
  const dx = circle.x - lineStart.x;
  const dy = circle.y - lineStart.y;
  
  // Vector along line
  const lineVectorX = lineEnd.x - lineStart.x;
  const lineVectorY = lineEnd.y - lineStart.y;
  
  // Line length squared
  const lineLengthSquared = lineVectorX * lineVectorX + lineVectorY * lineVectorY;
  
  // Project point onto line
  const dot = (dx * lineVectorX + dy * lineVectorY) / lineLengthSquared;
  
  // Clamp to segment
  const closestT = Math.max(0, Math.min(1, dot));
  
  // Find closest point on line
  const closestX = lineStart.x + closestT * lineVectorX;
  const closestY = lineStart.y + closestT * lineVectorY;
  
  // Distance from circle center to closest point
  const distanceX = circle.x - closestX;
  const distanceY = circle.y - closestY;
  const distanceSquared = distanceX * distanceX + distanceY * distanceY;
  
  return distanceSquared <= circle.radius * circle.radius;
}

// Check if a point has crossed a line segment
export function hasPointCrossedLine(
  prevPos: Vector2D,
  newPos: Vector2D,
  lineStart: Vector2D,
  lineEnd: Vector2D
): boolean {
  const d1 = isPointLeftOfLine(lineStart, lineEnd, prevPos);
  const d2 = isPointLeftOfLine(lineStart, lineEnd, newPos);
  return d1 !== d2;
}

// Calculate new position based on velocity and delta time
export function moveObject(
  position: Vector2D,
  velocity: Vector2D,
  deltaTime: number
): Vector2D {
  return {
    x: position.x + velocity.x * deltaTime,
    y: position.y + velocity.y * deltaTime,
  };
}

// Update boat position based on physics
export function updateBoatPosition(
  boat: Boat,
  windStrength: number,
  windDirection: number,
  deltaTime: number
): Vector2D {
  // Calculate boat speed based on wind, sail position, and boat heading
  const boatSpeed = calculateBoatSpeed(
    boat.rotation,
    windDirection,
    windStrength,
    boat.sailPosition
  );
  
  // Convert boat direction to velocity vector
  const velocity = vectorFromAngle(boat.rotation, boatSpeed);
  
  // Move boat
  return moveObject(boat.position, velocity, deltaTime);
}

// Handle collision between two boats (simple bounce)
export function handleBoatCollision(boat1: Boat, boat2: Boat): void {
  // Calculate vector between boat centers
  const dx = boat2.position.x - boat1.position.x;
  const dy = boat2.position.y - boat1.position.y;
  
  // Calculate distance and normalized direction
  const distance = Math.sqrt(dx * dx + dy * dy);
  const nx = dx / distance;
  const ny = dy / distance;
  
  // Minimum separation distance (boat size)
  const minDistance = 40; // Assuming boat size
  
  if (distance < minDistance) {
    // Calculate overlap
    const overlap = minDistance - distance;
    
    // Move boats apart
    const moveX = nx * overlap / 2;
    const moveY = ny * overlap / 2;
    
    // Update positions
    boat1.position.x -= moveX;
    boat1.position.y -= moveY;
    boat2.position.x += moveX;
    boat2.position.y += moveY;
  }
}
