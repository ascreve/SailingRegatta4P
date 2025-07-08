import { useEffect, useRef } from "react";
import { useWind } from "@/lib/stores/useWind";
import { generateWindIndicators } from "@/lib/game/windUtils";

// This component is for SVG-based rendering of wind indicators
// It's not currently used in the game, but provided as an alternative to canvas rendering
export default function WindSimulation() {
  const { baseStrength, direction, cells, getWindAt } = useWind();
  const windIndicatorsRef = useRef<{ x: number; y: number }[]>([]);
  
  // Generate wind indicator positions on mount
  useEffect(() => {
    windIndicatorsRef.current = generateWindIndicators(window.innerWidth, window.innerHeight, 100);
  }, []);
  
  return (
    <svg className="absolute inset-0 z-0 pointer-events-none">
      {/* Render wind cells for visualization */}
      {cells.map(cell => (
        <circle
          key={cell.id}
          cx={cell.x}
          cy={cell.y}
          r={cell.radius}
          fill={cell.strength > 0 
            ? `rgba(0, 0, 255, ${Math.abs(cell.strength) / 4})` 
            : `rgba(100, 100, 100, ${Math.abs(cell.strength) / 4})`
          }
        />
      ))}
      
      {/* Render wind indicators */}
      {windIndicatorsRef.current.map((indicator, index) => {
        const { x, y } = indicator;
        const windInfo = getWindAt(x, y);
        
        // Scale arrow size based on wind strength
        const arrowSize = 5 + (windInfo.strength * 0.5);
        
        return (
          <g key={index} transform={`translate(${x}, ${y}) rotate(${windInfo.direction + 180})`}>
            <line
              x1={0}
              y1={-arrowSize}
              x2={0}
              y2={arrowSize}
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={-arrowSize}
              x2={-arrowSize/2}
              y2={-arrowSize/2}
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth={1}
            />
            <line
              x1={0}
              y1={-arrowSize}
              x2={arrowSize/2}
              y2={-arrowSize/2}
              stroke="rgba(255, 255, 255, 0.4)"
              strokeWidth={1}
            />
          </g>
        );
      })}
      
      {/* Global wind direction indicator */}
      <g transform={`translate(${window.innerWidth / 2}, 50) rotate(${direction + 180})`}>
        <line
          x1={0}
          y1={-20}
          x2={0}
          y2={20}
          stroke="white"
          strokeWidth={3}
        />
        <line
          x1={0}
          y1={-20}
          x2={-10}
          y2={-10}
          stroke="white"
          strokeWidth={3}
        />
        <line
          x1={0}
          y1={-20}
          x2={10}
          y2={-10}
          stroke="white"
          strokeWidth={3}
        />
      </g>
    </svg>
  );
}
