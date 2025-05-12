// src/components/Canvas/CanvasWorkspace.tsx
import React, { useRef } from 'react';
import { useCanvasDrawing } from '../../hooks/useCanvasDrawing';
import { useAppContext } from '../../state/AppContext';

export const CanvasWorkspace: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { state } = useAppContext();
  const { canvasWidth, canvasHeight, zoomLevel, cursorCoords } = state; // Get cursorCoords

  useCanvasDrawing({ canvasRef, containerRef });

  const canvasStyle = {
    width: `${canvasWidth * zoomLevel}px`,
    height: `${canvasHeight * zoomLevel}px`,
    imageRendering: 'pixelated' as const,
  };

  return (
    // Container allows scrolling and positioning for cursor coords display
    <div
        ref={containerRef}
        className="flex-grow bg-gray-400 dark:bg-gray-700 overflow-auto flex items-center justify-center p-4 relative" // Added relative positioning
        style={{ backgroundColor: 'transparent' }}
    >
      <canvas
        ref={canvasRef}
        className="shadow-lg border border-gray-500"
        style={canvasStyle}
      >
        Your browser does not support the HTML5 canvas tag.
      </canvas>

      {/* --- Cursor Coordinates Display --- */}
      {cursorCoords && (
        <div
            className="absolute bottom-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1.5 py-0.5 rounded select-none pointer-events-none"
            style={{ fontFamily: 'monospace' }} // Monospace for consistent char width
        >
            X: {cursorCoords.x.toString().padStart(3, ' ')}, Y: {cursorCoords.y.toString().padStart(3, ' ')}
        </div>
      )}
      {/* --- End Cursor Coordinates Display --- */}
    </div>
  );
};
