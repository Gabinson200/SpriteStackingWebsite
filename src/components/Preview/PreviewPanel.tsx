// src/components/Preview/PreviewPanel.tsx
import React, { useRef, useEffect } from 'react';
import { useAppContext } from '../../state/AppContext';

const ISO_CAMERA_PITCH_DEGREES = 45;
const Z_SPACING_SENSITIVITY = 5;

export const PreviewPanel: React.FC = () => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch } = useAppContext();
  const { layers, canvasWidth, canvasHeight, previewOffset, previewRotation } = state;

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvasWidth <= 0 || canvasHeight <= 0) return;

    const previewScale = 18;
    const paddingFactor = 0.8;
    const maxDim = Math.max(canvasWidth, canvasHeight);
    const userZFactor = previewOffset.y;
    const maxObjectX = Math.abs(userZFactor) * Z_SPACING_SENSITIVITY * layers.length;
    const maxObjectZ = Math.abs(userZFactor) * Z_SPACING_SENSITIVITY * layers.length;
    const footprintRadius = Math.sqrt(maxObjectX**2 + maxObjectZ**2);
    const requiredDim = (maxDim * previewScale) + (footprintRadius * previewScale * 2.5);
    const previewDim = requiredDim * paddingFactor;

    canvas.width = Math.max(1, previewDim);
    canvas.height = Math.max(1, previewDim);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save(); // Save initial context state

    // Translate to the center of the preview canvas
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply isometric camera pitch rotation
    const pitchRad = ISO_CAMERA_PITCH_DEGREES * Math.PI / 180;
    ctx.rotate(pitchRad);
    ctx.scale(Math.cos(pitchRad), Math.sin(pitchRad));

    const numLayers = layers.length;
    for (let i = numLayers - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.isVisible || !layer.offscreenCanvas) continue;

      ctx.globalAlpha = layer.opacity;

      const depth = i;
      const objZ = depth * userZFactor * Z_SPACING_SENSITIVITY;
      const objX = depth * userZFactor * Z_SPACING_SENSITIVITY; // Assuming X offset is same as Z for isometric feel

      const posX = objX * previewScale;
      const posZ = objZ * previewScale;

      ctx.save(); // Save context state for this layer

      // Translate for layer stacking offset
      ctx.translate(posX, posZ);

      // Apply overall object yaw rotation to each layer individually
      const objectYawRad = previewRotation * Math.PI / 180;
      ctx.rotate(objectYawRad);

      // --- Apply Layer's Individual Rotation ---
      // We don't need to rotate the context here anymore, as the offscreen canvas
      // already contains the rotated pixel data. We just need to draw it centered.
      const layerCenterX = (canvasWidth * previewScale) / 2;
      const layerCenterY = (canvasHeight * previewScale) / 2;

       ctx.drawImage(
          layer.offscreenCanvas,
          0, // Source x
          0, // Source y
          canvasWidth, // Source width
          canvasHeight, // Source height
          -layerCenterX, // Destination x (relative to translated origin)
          -layerCenterY, // Destination y (relative to translated origin)
          canvasWidth * previewScale, // Destination width
          canvasHeight * previewScale // Destination height
      );
      // --- End Apply Layer's Individual Rotation ---


      ctx.restore(); // Restore context state for this layer
    }

    ctx.restore(); // Restore initial context state
    ctx.globalAlpha = 1.0;

  }, [layers, canvasWidth, canvasHeight, previewOffset.y, previewRotation]);

  const handleZSpacingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_OFFSET', offset: { x: state.previewOffset.x, y: parseFloat(e.target.value) } });
   };
  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_ROTATION', rotation: parseFloat(e.target.value) });
   };

  return ( /* ... PreviewPanel JSX ... */
    <div className="w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col flex-shrink-0 p-2 overflow-hidden">
      <h3 className="text-lg font-semibold mb-2 text-center text-gray-800 dark:text-gray-200">Preview</h3>
      <div className="flex-grow flex items-center justify-center bg-checkerboard rounded mb-2 min-h-[150px] overflow-hidden">
        <canvas ref={previewCanvasRef} className="max-w-full max-h-full" style={{ imageRendering: 'pixelated' }} />
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <label htmlFor="offsetY">Z Spacing: {previewOffset.y.toFixed(2)}</label>
          <input type="range" id="offsetY" min="0.0" max="1.0" step="0.02" value={previewOffset.y} onChange={handleZSpacingChange} className="w-full h-1 cursor-pointer"/>
        </div>
        <div>
          <label htmlFor="rotation">Object Yaw: {previewRotation.toFixed(0)}°</label>
          <input type="range" id="rotation" min="-180" max="180" step="1" value={previewRotation} onChange={handleRotationChange} className="w-full h-1 cursor-pointer"/>
        </div>
      </div>
    </div>
  );
};
