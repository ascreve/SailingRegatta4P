import { memo } from "react";
import { useRace } from "@/lib/stores/useRace";
import { useWind } from "@/lib/stores/useWind";
import { calculateSailRotation } from "@/lib/game/boatPhysics";

interface BoatProps {
  id: string;
  x: number;
  y: number;
  rotation: number;
  tack: "port" | "starboard";
  username: string;
  isLocalPlayer: boolean;
  sailPosition: number;
}

// This component is used for SVG-based rendering
// It's not currently used in the game, but provided as an alternative to canvas rendering
const Boat = memo(({ id, x, y, rotation, tack, username, isLocalPlayer, sailPosition }: BoatProps) => {
  const { getWindAt } = useWind();
  
  // Get wind at boat position
  const windInfo = getWindAt(x, y);
  
  // Calculate sail angle based on wind and tack
  const sailRotation = calculateSailRotation(rotation, windInfo.direction, tack);
  
  return (
    <g transform={`translate(${x}, ${y}) rotate(${rotation})`}>
      {/* Boat hull */}
      <path
        d="M0,-15 L10,15 Q0,20 -10,15 Z"
        fill={isLocalPlayer ? "#FF5722" : "#2196F3"}
        stroke="white"
        strokeWidth={1}
      />
      
      {/* Sail (only if not completely luffed) */}
      {sailPosition > 0 && (
        <g transform={`rotate(${sailRotation})`}>
          <path
            d={`M0,0 L0,-25 L${10 * (sailPosition / 100)},-20 L${8 * (sailPosition / 100)},-10 Z`}
            fill="white"
          />
        </g>
      )}
      
      {/* Username - positioned outside the transformation to remain readable */}
      <text
        x={0}
        y={30}
        textAnchor="middle"
        fill="white"
        fontSize={12}
        transform={`rotate(${-rotation})`}
      >
        {username}
      </text>
    </g>
  );
});

export default Boat;
