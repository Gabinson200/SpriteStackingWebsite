// src/components/Canvas/CanvasWorkspace.tsx
import React, { useRef } from 'react';
import { useCanvasDrawing } from '../../hooks/useCanvasDrawing';
import { useAppContext } from '../../state/AppContext';

export const CanvasWorkspace: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null); // Ref for the container
  const { state } = useAppContext();
  const { canvasWidth, canvasHeight, zoomLevel } = state;

  // Attach drawing hook
  useCanvasDrawing({ canvasRef, containerRef });

  // Calculate the CSS dimensions for the canvas based on logical size and zoom
  const canvasStyle = {
    width: `${canvasWidth * zoomLevel}px`,
    height: `${canvasHeight * zoomLevel}px`,
    // Add pixelated rendering style for crisp pixels at zoom
    imageRendering: 'pixelated' as const, // Standard
    // '-ms-interpolation-mode': 'nearest-neighbor', // IE/Edge legacy
  };

  return (
    // Container allows scrolling if canvas is larger than the view
    <div
        ref={containerRef}
        className="flex-grow bg-gray-400 dark:bg-gray-700 overflow-auto flex items-center justify-center p-4" // Center canvas within scrollable area
        style={{ backgroundColor: 'transparent' }} // Let canvas checkerboard show
    >
      {/* The actual canvas element */}
      <canvas
        ref={canvasRef}
        className="shadow-lg border border-gray-500" // Basic styling
        style={canvasStyle}
        // Width/Height attributes are set dynamically in the hook based on zoom
      >
        Your browser does not support the HTML5 canvas tag.
      </canvas>
    </div>
  );
};