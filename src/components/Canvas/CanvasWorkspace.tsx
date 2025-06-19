// src/components/Canvas/CanvasWorkspace.tsx
import React, { useRef } from 'react'; // Keep React import if JSX is used
import { useCanvasDrawing } from '../../hooks/useCanvasDrawing';
import { useAppContext } from '../../state/AppContext';

export const CanvasWorkspace: React.FC = () => {
  // For TS2322: Initialize refs with null, hook expects RefObject<HTMLCanvasElement | null>
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const { state } = useAppContext();
  const { canvasWidth, canvasHeight, zoomLevel, cursorCoords } = state;

  // Pass refs directly. The hook's prop types were updated to accept RefObject<Element | null>
  useCanvasDrawing({ canvasRef, containerRef, selectionCanvasRef });

  const canvasStyle = {
    width: `${canvasWidth * zoomLevel}px`,
    height: `${canvasHeight * zoomLevel}px`,
    imageRendering: 'pixelated' as const,
  };

  return (
    <div
        ref={containerRef} // Assign ref here
        className="flex-grow bg-gray-400 dark:bg-gray-700 overflow-auto flex items-center justify-center p-4 relative"
        style={{ backgroundColor: 'transparent' }}
    >
      <canvas
        ref={canvasRef} // Assign ref here
        className="shadow-lg border border-gray-500"
        style={canvasStyle}
      >
        Your browser does not support the HTML5 canvas tag.
      </canvas>

      <canvas
        ref={selectionCanvasRef}
        className="absolute pointer-events-none" // pointer-events-none so it doesn't block clicks to the main canvas
        style={{ ...canvasStyle, zIndex: 20 }} // Higher z-index to appear on top
      />
      
      {cursorCoords && (
        <div
            className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded select-none pointer-events-none"
            style={{ fontFamily: 'monospace' }}
        >
            X: {cursorCoords.x.toString().padStart(3, ' ')}, Y: {cursorCoords.y.toString().padStart(3, ' ')}
        </div>
      )}
    </div>
  );
};