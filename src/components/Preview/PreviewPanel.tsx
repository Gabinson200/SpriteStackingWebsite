// src/components/Preview/PreviewPanel.tsx
import React, { useRef, useEffect } from 'react';
import { useAppContext } from '../../state/AppContext';
// Removed unused import: import { compositeLayers } from '../../utils/canvasUtils';

export const PreviewPanel: React.FC = () => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch } = useAppContext();
  // Ensure layers are used in the correct visual order (index 0 is visually top)
  const { layers, canvasWidth, canvasHeight, previewOffset, previewRotation } = state;

  // Redraw preview canvas when layers or settings change
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (ctx && canvas && canvasWidth > 0 && canvasHeight > 0) {
        // Determine preview canvas size
        const previewScale = 2; // Base scale for the sprite itself
        // Increase padding factor for more space around the scaled sprite
        const paddingFactor = 1.8; // Increased from 1.5 to give more room
        const maxDim = Math.max(canvasWidth, canvasHeight);
        // Calculate dimensions needed for the sprite at scale + offset/rotation room
        const maxOffsetEffect = Math.max(Math.abs(previewOffset.x), Math.abs(previewOffset.y)) * layers.length * previewScale;
        const requiredDim = (maxDim * previewScale) + (maxOffsetEffect * 2); // Account for offset pushing in both directions
        const previewDim = requiredDim * paddingFactor; // Add padding around the required dimensions

        canvas.width = previewDim;
        canvas.height = previewDim;

        ctx.imageSmoothingEnabled = false; // Keep it crisp

        // Clear previous frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);

         // Center the drawing area
         ctx.save();
         // Translate to the center of the larger canvas
         ctx.translate(canvas.width / 2, canvas.height / 2);
         ctx.rotate(previewRotation * Math.PI / 180); // Apply rotation
         // Translate back by half the *scaled sprite size* to center the sprite's origin
         ctx.translate(-(canvasWidth * previewScale / 2), -(canvasHeight * previewScale / 2));

        // Composite layers with offset for pseudo-3D effect
        // Draw layers from back (highest index) to front (lowest index)
        const numLayers = layers.length;
        for (let i = numLayers - 1; i >= 0; i--) { // Iterate backwards
             const layer = layers[i];
             if (!layer.isVisible || !layer.offscreenCanvas) continue;

             ctx.globalAlpha = layer.opacity;

             // Calculate offset based on layer's visual depth (0 = front, numLayers-1 = back)
             // Since we iterate i from numLayers-1 down to 0, the depth is simply i
             const depth = i;
             const offsetX = depth * previewOffset.x * previewScale;
             const offsetY = depth * previewOffset.y * previewScale;

             // Draw the layer with offset and scaling
             ctx.drawImage(
                 layer.offscreenCanvas,
                 offsetX,
                 offsetY,
                 canvasWidth * previewScale,
                 canvasHeight * previewScale
             );
         }
         ctx.restore(); // Restore transform state

        // Reset global alpha after drawing all layers
        ctx.globalAlpha = 1.0;
    }
    // Add previewOffset and previewRotation as dependencies
  }, [layers, canvasWidth, canvasHeight, previewOffset, previewRotation, previewCanvasRef]);

  // Handlers for controls (remain the same)
  const handleOffsetXChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_OFFSET', offset: { ...previewOffset, x: parseFloat(e.target.value) } });
  };
  const handleOffsetYChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_OFFSET', offset: { ...previewOffset, y: parseFloat(e.target.value) } });
  };
  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_ROTATION', rotation: parseFloat(e.target.value) });
  };


  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col flex-shrink-0 p-2 overflow-hidden"> {/* Added overflow-hidden */}
      <h3 className="text-lg font-semibold mb-2 text-center text-gray-800 dark:text-gray-200">Preview</h3>
      {/* Ensure container allows canvas to be centered */}
      <div className="flex-grow flex items-center justify-center bg-checkerboard rounded mb-2 min-h-[150px] overflow-hidden"> {/* Added overflow-hidden */}
        <canvas
          ref={previewCanvasRef}
          className="max-w-full max-h-full" // Canvas scales down if container is smaller
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      {/* Controls (remain the same) */}
      <div className="space-y-2 text-sm">
        <div>
          <label htmlFor="offsetX" className="block text-xs font-medium text-gray-700 dark:text-gray-300">X Offset: {previewOffset.x.toFixed(1)}</label>
          <input type="range" id="offsetX" min="-5" max="5" step="0.1" value={previewOffset.x} onChange={handleOffsetXChange} className="w-full h-1 cursor-pointer" />
        </div>
        <div>
          <label htmlFor="offsetY" className="block text-xs font-medium text-gray-700 dark:text-gray-300">Y Offset: {previewOffset.y.toFixed(1)}</label>
          <input type="range" id="offsetY" min="-5" max="5" step="0.1" value={previewOffset.y} onChange={handleOffsetYChange} className="w-full h-1 cursor-pointer" />
        </div>
        <div>
          <label htmlFor="rotation" className="block text-xs font-medium text-gray-700 dark:text-gray-300">Rotation: {previewRotation.toFixed(0)}°</label>
          <input type="range" id="rotation" min="-180" max="180" step="1" value={previewRotation} onChange={handleRotationChange} className="w-full h-1 cursor-pointer" />
        </div>
      </div>
    </div>
  );
};
