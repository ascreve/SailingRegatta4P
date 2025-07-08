import { memo } from "react";
import { useRace } from "@/lib/stores/useRace";

interface RaceCourseProps {
  phase: string;
}

// This component is for SVG-based rendering of the race course
// It's not currently used in the game, but provided as an alternative to canvas rendering
const RaceCourse = memo(({ phase }: RaceCourseProps) => {
  const { startLine, marks } = useRace();
  
  return (
    <svg className="absolute inset-0 z-10 pointer-events-none">
      {/* Draw start line */}
      <line
        x1={startLine.x1}
        y1={startLine.y1}
        x2={startLine.x2}
        y2={startLine.y2}
        stroke={phase === "racing" ? "green" : "white"}
        strokeWidth={2}
        strokeDasharray="5,5"
      />
      
      {/* Draw start buoys */}
      <rect
        x={startLine.x1 - 10}
        y={startLine.y1 - 10}
        width={20}
        height={20}
        fill="red"
      />
      <rect
        x={startLine.x2 - 10}
        y={startLine.y2 - 10}
        width={20}
        height={20}
        fill="red"
      />
      
      {/* Draw marks */}
      {marks.map((mark, index) => (
        <circle
          key={index}
          cx={mark.x}
          cy={mark.y}
          r={15}
          fill={mark.type === "top" ? "orange" : "yellow"}
        />
      ))}
      
      {/* Draw course lines for guidance */}
      <path
        d={`M${startLine.x1 + (startLine.x2 - startLine.x1) / 2},${startLine.y1} 
            L${marks[0].x},${marks[0].y} 
            L${marks[1].x},${marks[1].y}
            L${startLine.x1 + (startLine.x2 - startLine.x1) / 2},${startLine.y1}`}
        stroke="rgba(255,255,255,0.2)"
        strokeWidth={1}
        fill="none"
      />
    </svg>
  );
});

export default RaceCourse;
