// src/components/Preview/PreviewPanel.tsx
import React, { useRef, useEffect } from 'react';
import { useAppContext } from '../../state/AppContext';

// --- Constants for the Standard Isometric Projection ---
const ISO_CAMERA_PITCH_DEGREES = 45; // Rotation around world X-axis
const Z_SPACING_SENSITIVITY = 10; // Multiplier for the Z-spacing slider (object's Z-axis)

export const PreviewPanel: React.FC = () => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch } = useAppContext();
  const { layers, canvasWidth, canvasHeight, previewOffset, previewRotation } = state;

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!ctx || !canvas || canvasWidth <= 0 || canvasHeight <= 0) return;

    const previewScale = 6;
    const paddingFactor = 1;
    const maxDim = Math.max(canvasWidth, canvasHeight);

    // Estimate dimensions
    const userZFactor = previewOffset.y;
    const maxObjectX = Math.abs(userZFactor) * Z_SPACING_SENSITIVITY * layers.length;
    const maxObjectZ = Math.abs(userZFactor) * Z_SPACING_SENSITIVITY * layers.length;
    const footprintRadius = Math.sqrt(maxObjectX**2 + maxObjectZ**2) * 0.707;
    const requiredDim = (maxDim * previewScale) + (footprintRadius * previewScale * 2);
    const previewDim = requiredDim * paddingFactor;

    canvas.width = previewDim;
    canvas.height = previewDim;

    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Center canvas
    ctx.translate(canvas.width / 2, canvas.height / 2);

    // Apply fixed isometric camera pitch
    const pitchRad = ISO_CAMERA_PITCH_DEGREES * Math.PI / 180;
    ctx.rotate(pitchRad);
    ctx.scale(Math.cos(pitchRad), Math.sin(pitchRad));
    

    const objectYawRad = previewRotation * Math.PI / 180;
    const cosYaw = Math.cos(objectYawRad);
    const sinYaw = Math.sin(objectYawRad);

    const numLayers = layers.length;
    for (let i = numLayers - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.isVisible || !layer.offscreenCanvas) continue;

      ctx.globalAlpha = layer.opacity;
      const depth = i;

      // Compute object-space position (X, Z) before yaw
      const objZ = depth * userZFactor * Z_SPACING_SENSITIVITY;
      const objX = depth * userZFactor * Z_SPACING_SENSITIVITY;

      // For position, we do NOT apply yaw; keep stack arrangement fixed
      const posX = objX * previewScale;
      const posZ = objZ * previewScale;

      ctx.save();
      // Translate to this layer's stack position
      ctx.translate(posX, posZ);
      // Rotate around its own center (Z axis)
      ctx.rotate(objectYawRad);

      // Draw layer centered
      const w = canvasWidth * previewScale;
      const h = canvasHeight * previewScale;
      ctx.drawImage(
        layer.offscreenCanvas,
        -w / 2,
        -h / 2,
        w,
        h
      );

      ctx.restore();
    }

    ctx.restore();
    ctx.globalAlpha = 1.0;
  }, [layers, canvasWidth, canvasHeight, previewOffset.y, previewRotation]);

  const handleZSpacingChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_OFFSET', offset: { x: previewOffset.x, y: parseFloat(e.target.value) } });
  };
  const handleRotationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    dispatch({ type: 'SET_PREVIEW_ROTATION', rotation: parseFloat(e.target.value) });
  };

  return (
    <div className="w-64 bg-gray-100 dark:bg-gray-800 border-r border-gray-300 dark:border-gray-700 flex flex-col flex-shrink-0 p-2 overflow-hidden">
      <h3 className="text-lg font-semibold mb-2 text-center text-gray-800 dark:text-gray-200">Preview</h3>
      <div className="flex-grow flex items-center justify-center bg-checkerboard rounded mb-2 min-h-[150px] overflow-hidden">
        <canvas
          ref={previewCanvasRef}
          className="max-w-full max-h-full"
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <label htmlFor="offsetY" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Z Spacing: {previewOffset.y.toFixed(1)}
          </label>
          <input
            type="range"
            id="offsetY"
            min="0"
            max="1"
            step="0.05"
            value={previewOffset.y}
            onChange={handleZSpacingChange}
            className="w-full h-1 cursor-pointer"
          />
        </div>
        <div>
          <label htmlFor="rotation" className="block text-xs font-medium text-gray-700 dark:text-gray-300">
            Object Yaw: {previewRotation.toFixed(0)}°
          </label>
          <input
            type="range"
            id="rotation"
            min="-180"
            max="180"
            step="1"
            value={previewRotation}
            onChange={handleRotationChange}
            className="w-full h-1 cursor-pointer"
          />
        </div>
      </div>
    </div>
  );
};
