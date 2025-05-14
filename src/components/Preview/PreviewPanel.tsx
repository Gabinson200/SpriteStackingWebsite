// src/components/Preview/PreviewPanel.tsx
// For TS6133 on cosYaw, sinYaw: Removed them as they were unused in the user's provided version.
// The user's version rotates each layer individually by objectYawRad.
import React, { useRef, useEffect } from 'react'; // Keep React import
import { useAppContext } from '../../state/AppContext';

const ISO_CAMERA_PITCH_DEGREES = 45;
const Z_SPACING_SENSITIVITY = 10;

export const PreviewPanel: React.FC = () => {
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const { state, dispatch } = useAppContext();
  const { layers, canvasWidth, canvasHeight, previewOffset, previewRotation } = state;

  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvasWidth <= 0 || canvasHeight <= 0) return;

    const previewScale = 5;
    const paddingFactor = 1;
    const maxDim = Math.max(canvasWidth, canvasHeight);
    const userZFactor = previewOffset.y;
    const maxObjectX = Math.abs(userZFactor) * Z_SPACING_SENSITIVITY * layers.length;
    const maxObjectZ = Math.abs(userZFactor) * Z_SPACING_SENSITIVITY * layers.length;
    const footprintRadius = Math.sqrt(maxObjectX**2 + maxObjectZ**2);
    const requiredDim = (maxDim * previewScale) + (footprintRadius * previewScale * 2);
    const previewDim = requiredDim * paddingFactor;
    canvas.width = Math.max(1, previewDim);
    canvas.height = Math.max(1, previewDim);
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    const pitchRad = ISO_CAMERA_PITCH_DEGREES * Math.PI / 180;
    ctx.rotate(pitchRad);
    ctx.scale(Math.cos(pitchRad), Math.sin(pitchRad));
    const objectYawRad = previewRotation * Math.PI / 180;
    // cosYaw and sinYaw were unused in this version of the logic
    const numLayers = layers.length;
    for (let i = numLayers - 1; i >= 0; i--) {
      const layer = layers[i];
      if (!layer.isVisible || !layer.offscreenCanvas) continue;
      ctx.globalAlpha = layer.opacity;
      const depth = i;
      const objZ = depth * userZFactor * Z_SPACING_SENSITIVITY;
      const objX = depth * userZFactor * Z_SPACING_SENSITIVITY;
      const posX = objX * previewScale;
      const posZ = objZ * previewScale;
      ctx.save();
      ctx.translate(posX, posZ);
      ctx.rotate(objectYawRad);
      const w = canvasWidth * previewScale;
      const h = canvasHeight * previewScale;
      ctx.drawImage( layer.offscreenCanvas, -w / 2, -h / 2, w, h );
      ctx.restore();
    }
    ctx.restore();
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
          <label htmlFor="offsetY">Z Spacing: {previewOffset.y.toFixed(1)}</label>
          <input type="range" id="offsetY" min="0" max="1" step="0.05" value={previewOffset.y} onChange={handleZSpacingChange} className="w-full h-1 cursor-pointer"/>
        </div>
        <div>
          <label htmlFor="rotation">Object Yaw: {previewRotation.toFixed(0)}°</label>
          <input type="range" id="rotation" min="-180" max="180" step="1" value={previewRotation} onChange={handleRotationChange} className="w-full h-1 cursor-pointer"/>
        </div>
      </div>
    </div>
  );
};