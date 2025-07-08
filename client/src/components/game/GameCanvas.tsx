import { useRef, useEffect, useState } from "react";
import { useAuth } from "@/lib/stores/useAuth";
import { useRace, Boat, RacePhase } from "@/lib/stores/useRace";
import { useWind, WindCell } from "@/lib/stores/useWind";
import { updateBoatPosition, handleBoatCollision, pointInCircle, hasPointCrossedLine } from "@/lib/game/physics";
import { getEffectiveWindStrength } from "@/lib/game/windUtils";
import { calculateSailRotation, determineTack } from "@/lib/game/boatPhysics";

export default function GameCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastUpdateRef = useRef<number>(0);
  const { user } = useAuth();
  
  // Race state
  const { 
    phase, 
    boats, 
    startLine, 
    marks, 
    startRace, 
    updateBoat, 
    finishRace, 
    timeRemaining,
    startTime,
    localBoat
  } = useRace();
  
  // Wind and current state
  const { baseStrength, direction, cells, getWindAt, updateWindDirection, currentStrength, currentDirection, getCurrentAt } = useWind();
  
  // Local state for key presses
  const [keys, setKeys] = useState<Set<string>>(new Set());

  // Set up the game loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Resize canvas to fill window, but with fixed minimum dimensions for visibility
    const handleResize = () => {
      if (canvas) {
        // Set fixed size to ensure visibility
        canvas.width = 1000;  
        canvas.height = 800;
        
        console.log(`Canvas resized to fixed size: ${canvas.width}x${canvas.height}`);
      }
    };
    
    window.addEventListener("resize", handleResize);
    handleResize();

    // Animation/game loop
    const updateGame = (timestamp: number) => {
      if (!lastUpdateRef.current) {
        lastUpdateRef.current = timestamp;
      }
      
      const deltaTime = (timestamp - lastUpdateRef.current) / 1000; // Convert to seconds
      lastUpdateRef.current = timestamp;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Add debug info to see what's happening
      ctx.fillStyle = "white";
      ctx.font = "14px Arial";
      ctx.fillText(`Phase: ${phase}`, 20, 40);
      ctx.fillText(`Boats count: ${boats.length}`, 20, 60);
      ctx.fillText(`Marks count: ${marks.length}`, 20, 80);
      ctx.fillText(`Canvas size: ${canvas.width}x${canvas.height}`, 20, 100);
      if (boats[0]) {
        ctx.fillText(`Boat position: ${Math.round(boats[0].position.x)},${Math.round(boats[0].position.y)}`, 20, 120);
      }
      
      // Update race timer
      if (phase === "starting") {
        const newTime = Math.max(0, timeRemaining - deltaTime);
        useRace.setState({ timeRemaining: newTime });
        
        if (newTime <= 0) {
          startRace();
        }
      }
      
      // Update race time
      if (phase === "racing" && startTime) {
        const raceTime = Date.now() - startTime;
        useRace.setState({ raceTime });
      }
      
      // Update wind occasionally
      if (Math.random() < 0.001) {
        updateWindDirection();
      }

      // Draw race course - always visible in all phases
      drawRaceCourse(ctx);
      
      // Draw wind cells (for visualization) - always visible
      drawWindCells(ctx, cells);
      
      // Always draw all boats in all phases
      drawBoats(ctx);
      
      if (phase === "racing" || phase === "starting") {
        // Process player input
        handlePlayerInput(deltaTime);
        
        // Update AI boats
        updateAIBoats(deltaTime);
        
        // Update all boats
        updateBoats(deltaTime);
        
        // Check for collisions
        checkCollisions();
        
        // Check for mark roundings and finish line
        checkRaceProgress();
      }
      
      // Continue animation
      animationRef.current = requestAnimationFrame(updateGame);
    };

    // Start the game loop
    animationRef.current = requestAnimationFrame(updateGame);

    // Clean up
    return () => {
      cancelAnimationFrame(animationRef.current);
      window.removeEventListener("resize", handleResize);
    };
  }, [phase, boats, startLine, marks, startRace, updateBoat, finishRace, timeRemaining, startTime]);

  // Set up keyboard controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      setKeys(prev => {
        const newKeys = new Set(Array.from(prev));
        newKeys.add(e.code);
        return newKeys;
      });
    };
    
    const handleKeyUp = (e: KeyboardEvent) => {
      setKeys(prev => {
        const newKeys = new Set(Array.from(prev));
        newKeys.delete(e.code);
        return newKeys;
      });
    };
    
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Handle player input
  const handlePlayerInput = (deltaTime: number) => {
    if (!localBoat) return;
    
    // Get the player's boat
    const playerBoat = boats.find(boat => boat.isLocalPlayer);
    if (!playerBoat) return;
    
    // Handle rotation (left/right arrow keys)
    let newRotation = playerBoat.rotation;
    if (keys.has("ArrowLeft")) {
      newRotation = (playerBoat.rotation - 60 * deltaTime) % 360;
      if (newRotation < 0) newRotation += 360;
    }
    if (keys.has("ArrowRight")) {
      newRotation = (playerBoat.rotation + 60 * deltaTime) % 360;
    }
    
    // Handle tacking/gybing (Enter key)
    if (keys.has("Enter")) {
      const newTack = playerBoat.tack === "port" ? "starboard" : "port";
      updateBoat(playerBoat.id, { tack: newTack });
      // Remove the key to prevent continuous tacking
      setKeys(prev => {
        const newKeys = new Set(Array.from(prev));
        newKeys.delete("Enter");
        return newKeys;
      });
    }
    
    // Handle sail trimming (Shift key)
    let newSailPosition = playerBoat.sailPosition;
    if (keys.has("ShiftLeft") || keys.has("ShiftRight")) {
      // Luff the sail (reduce to minimum trim)
      newSailPosition = 0;
    } else {
      // Otherwise, use ideal sail position
      newSailPosition = 100; // Fully trimmed
    }
    
    // Update the player's boat
    if (newRotation !== playerBoat.rotation || newSailPosition !== playerBoat.sailPosition) {
      updateBoat(playerBoat.id, { 
        rotation: newRotation,
        sailPosition: newSailPosition 
      });
    }
  };

  // Update AI boat behavior
  const updateAIBoats = (deltaTime: number) => {
    // Simple AI: aim for next mark with basic tacking/gybing
    boats.forEach(boat => {
      if (boat.isLocalPlayer) return; // Skip player boat
      
      // Get current mark to aim for based on progress
      const targetMark = marks[boat.lastCheckpoint % marks.length];
      
      // Calculate angle to mark
      const dx = targetMark.x - boat.position.x;
      const dy = targetMark.y - boat.position.y;
      const angleToMark = Math.atan2(dy, dx) * 180 / Math.PI - 90; // -90 to adjust coordinate system
      
      // Normalize angle to 0-360
      const normalizedAngle = (angleToMark + 360) % 360;
      
      // Get wind angle at boat position
      const windInfo = getWindAt(boat.position.x, boat.position.y);
      
      // Determine if we need to tack to make progress upwind
      let targetAngle = normalizedAngle;
      const relativeWindAngle = Math.abs(windInfo.direction - normalizedAngle) % 180;
      
      if (relativeWindAngle < 30) {
        // Too close to the wind, need to tack
        targetAngle = windInfo.direction + (boat.tack === "port" ? 45 : -45);
      }
      
      // Adjust boat rotation towards target
      let newRotation = boat.rotation;
      const angleDiff = targetAngle - boat.rotation;
      const normalizedDiff = ((angleDiff + 180) % 360) - 180; // Normalize to -180 to 180
      
      if (Math.abs(normalizedDiff) > 5) {
        // Turn towards target
        const turnRate = 40 * deltaTime; // degrees per second
        newRotation = boat.rotation + Math.sign(normalizedDiff) * Math.min(turnRate, Math.abs(normalizedDiff));
        
        // Normalize to 0-360
        newRotation = (newRotation + 360) % 360;
      }
      
      // Update AI boat
      updateBoat(boat.id, {
        rotation: newRotation,
        tack: determineTack(newRotation, windInfo.direction),
        sailPosition: 100 // AI always has perfectly trimmed sails
      });
    });
  };

  // Update all boat positions
  const updateBoats = (deltaTime: number) => {
    boats.forEach(boat => {
      // Get wind at boat position
      const windInfo = getWindAt(boat.position.x, boat.position.y);
      
      // Calculate effective wind strength (accounting for turbulence)
      const effectiveWind = getEffectiveWindStrength(
        boat.position,
        windInfo.strength,
        boats.filter(b => b.id !== boat.id), // All other boats
        windInfo.direction
      );
      
      // Update boat position
      const newPosition = updateBoatPosition(
        boat,
        effectiveWind,
        windInfo.direction,
        deltaTime
      );
      
      // Update boat in state
      updateBoat(boat.id, { position: newPosition });
    });
  };

  // Check for collisions between boats and handle them
  const checkCollisions = () => {
    for (let i = 0; i < boats.length; i++) {
      for (let j = i + 1; j < boats.length; j++) {
        const boat1 = boats[i];
        const boat2 = boats[j];
        
        // Simple distance check for collision (boats as circles)
        const dx = boat2.position.x - boat1.position.x;
        const dy = boat2.position.y - boat1.position.y;
        const distanceSquared = dx * dx + dy * dy;
        
        // Assume boats are circles with radius 20
        const minDistance = 40;
        
        if (distanceSquared < minDistance * minDistance) {
          handleBoatCollision(boat1, boat2);
        }
      }
    }
  };

  // Check for mark roundings and race progress
  const checkRaceProgress = () => {
    boats.forEach(boat => {
      if (phase !== "racing") return;
      
      // Check for mark roundings
      marks.forEach((mark, index) => {
        if (boat.lastCheckpoint === index) {
          // Check if boat is close enough to the mark
          const distance = Math.sqrt(
            Math.pow(boat.position.x - mark.x, 2) + 
            Math.pow(boat.position.y - mark.y, 2)
          );
          
          // If boat is within 30px of mark, consider it rounded
          if (distance < 30) {
            // Update last checkpoint
            updateBoat(boat.id, { lastCheckpoint: index + 1 });
          }
        }
      });
      
      // Check for finish line crossing
      if (boat.lastCheckpoint === marks.length) {
        // Check if boat crosses finish line from top to bottom
        const prevPos = { x: boat.position.x, y: boat.position.y - boat.speed };
        const lineStart = { x: startLine.x1, y: startLine.y1 };
        const lineEnd = { x: startLine.x2, y: startLine.y2 };
        
        if (hasPointCrossedLine(prevPos, boat.position, lineStart, lineEnd)) {
          // Check if crossing in the right direction (top to bottom)
          if (prevPos.y < lineStart.y && boat.position.y >= lineStart.y) {
            // Boat has finished the race
            finishRace(boat.id, Date.now() - (startTime || 0));
          }
        }
      }
    });
  };

  // Draw the race course
  const drawRaceCourse = (ctx: CanvasRenderingContext2D) => {
    // Draw start line
    ctx.beginPath();
    ctx.moveTo(startLine.x1, startLine.y1);
    ctx.lineTo(startLine.x2, startLine.y2);
    ctx.strokeStyle = phase === "racing" ? "green" : "white";
    ctx.setLineDash([5, 5]); // Dotted line
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]); // Reset line style
    
    // Draw start buoys
    ctx.fillStyle = "red";
    ctx.beginPath();
    ctx.rect(startLine.x1 - 10, startLine.y1 - 10, 20, 20);
    ctx.fill();
    ctx.beginPath();
    ctx.rect(startLine.x2 - 10, startLine.y2 - 10, 20, 20);
    ctx.fill();
    
    // Draw marks
    marks.forEach(mark => {
      ctx.fillStyle = mark.type === "top" ? "orange" : "yellow";
      ctx.beginPath();
      ctx.arc(mark.x, mark.y, 15, 0, Math.PI * 2);
      ctx.fill();
    });
  };

  // Draw wind cells for visualization
  const drawWindCells = (ctx: CanvasRenderingContext2D, cells: WindCell[]) => {
    cells.forEach(cell => {
      // Draw wind cell with opacity based on strength
      const strengthAlpha = Math.abs(cell.strength) / 4; // -2 to +2 normalized to 0-0.5
      ctx.fillStyle = cell.strength > 0 
        ? `rgba(0, 0, 255, ${strengthAlpha})` // Stronger wind (blue)
        : `rgba(100, 100, 100, ${strengthAlpha})`; // Weaker wind (gray)
      
      ctx.beginPath();
      ctx.arc(cell.x, cell.y, cell.radius, 0, Math.PI * 2);
      ctx.fill();
    });
    
    // Draw wind direction indicator
    const centerX = ctx.canvas.width / 2;
    const centerY = 50;
    
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate(direction * Math.PI / 180);
    
    // Draw arrow
    ctx.strokeStyle = "white";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -20);
    ctx.lineTo(0, 20);
    ctx.moveTo(0, -20);
    ctx.lineTo(-10, -10);
    ctx.moveTo(0, -20);
    ctx.lineTo(10, -10);
    ctx.stroke();
    
    ctx.restore();
  };

  // Draw all boats
  const drawBoats = (ctx: CanvasRenderingContext2D) => {
    boats.forEach(boat => {
      const { x, y } = boat.position;
      const rotation = boat.rotation;
      
      // Calculate sail angle based on wind direction and tack
      const windInfo = getWindAt(x, y);
      const sailRotation = calculateSailRotation(rotation, windInfo.direction, boat.tack);
      
      // Draw boat
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation * Math.PI / 180);
      
      // Boat hull (triangle with slight curve)
      ctx.beginPath();
      ctx.moveTo(0, -15); // Bow
      ctx.lineTo(10, 15); // Starboard quarter
      ctx.quadraticCurveTo(0, 20, -10, 15); // Curved transom
      ctx.lineTo(0, -15); // Back to bow
      ctx.fillStyle = boat.isLocalPlayer ? "#FF5722" : "#2196F3";
      ctx.fill();
      ctx.strokeStyle = "white";
      ctx.lineWidth = 1;
      ctx.stroke();
      
      // Draw sail
      if (boat.sailPosition > 0) { // Only draw sail if it's not completely luffed
        ctx.save();
        ctx.rotate(sailRotation * Math.PI / 180); // Rotate sail based on wind angle
        
        // Draw the sail as a curved shape
        ctx.beginPath();
        ctx.moveTo(0, 0); // Mast base
        ctx.lineTo(0, -25); // Mast top
        
        // Sail curve depends on how trimmed it is
        const sailCurve = 10 * (boat.sailPosition / 100);
        
        // Draw sail with appropriate curve based on trim
        ctx.lineTo(sailCurve, -20);
        ctx.lineTo(sailCurve * 0.8, -10);
        ctx.lineTo(0, 0);
        
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.restore();
      }
      
      ctx.restore();
      
      // Draw username under boat
      ctx.fillStyle = "white";
      ctx.font = "12px Arial";
      ctx.textAlign = "center";
      ctx.fillText(boat.username, x, y + 30);
    });
  };

  return (
    <div className="absolute inset-0 overflow-auto flex justify-center items-center bg-blue-900">
      <canvas 
        ref={canvasRef} 
        className="bg-blue-900"
        style={{ width: '1000px', height: '800px' }}
      />
    </div>
  );
}
