// src/hooks/useCanvasDrawing.ts
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from '../state/AppContext';
import type { Layer } from '../state/types';
import { parseColor } from '../utils/colorUtils';
import {
  getPixelColor,
  drawPixel,
  clearPixel,
  drawLine,
  getPixelFromImageData,
  setPixelInImageData,
  areColorsEqual,
  type RgbaPixel,
  drawCheckerboard,
} from '../utils/canvasUtils';

interface UseCanvasDrawingProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  containerRef: React.RefObject<HTMLDivElement | null>;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;
const ZOOM_SENSITIVITY = 0.0025;
const GRID_VISIBILITY_ZOOM_THRESHOLD = 4;

export function useCanvasDrawing({ canvasRef, containerRef }: UseCanvasDrawingProps) {
  if (containerRef && !containerRef.current) {
    // console.log("Container ref is not yet available, or not used in this hook yet.");
  }

  const { state, dispatch } = useAppContext();
  const {
    canvasWidth, canvasHeight, layers, activeLayerId, selectedTool, primaryColor, zoomLevel, showGrid, brushSize,
  } = state;

  const [redrawNonce, setRedrawNonce] = useState(0);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activeLayerCache = useRef<Layer | null>(null);
  const activeCtxCache = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
      activeLayerCache.current = layers.find(l => l.id === activeLayerId) || null;
      activeCtxCache.current = activeLayerCache.current?.offscreenCanvas?.getContext('2d') || null;
      if (activeCtxCache.current) {
          activeCtxCache.imageSmoothingEnabled = false;
      }
  }, [activeLayerId, layers]);

   const getLogicalCoords = useCallback((event: PointerEvent | WheelEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (event.clientX - rect.left);
        const canvasY = (event.clientY - rect.top);

        // --- Apply Inverse Rotation for Coordinate Transformation ---
        // We need to transform the mouse coordinates on the potentially rotated
        // main canvas back to the un-rotated coordinate system of the layer's content.
        const activeLayer = layers.find(l => l.id === activeLayerId);
        const rotation = activeLayer?.rotation ?? 0;

        let logicalX = canvasX / zoomLevel;
        let logicalY = canvasY / zoomLevel;

        if (rotation !== 0) {
            // Translate coordinates to be relative to the canvas center
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const translatedX = logicalX - centerX;
            const translatedY = logicalY - centerY;

            // Apply inverse rotation (clockwise for left rotation, counter-clockwise for right)
            // The rotation stored in state is the visual rotation (clockwise for right rotate button).
            // To get back to the original coordinates, we need to rotate in the opposite direction.
            const inverseRotationInRadians = -rotation * Math.PI / 180;
            const cos = Math.cos(inverseRotationInRadians);
            const sin = Math.sin(inverseRotationInRadians);

            const rotatedX = translatedX * cos - translatedY * sin;
            const rotatedY = translatedX * sin + translatedY * cos;

            // Translate back to the original coordinate system
            logicalX = rotatedX + centerX;
            logicalY = rotatedY + centerY;
        }
        // --- End Apply Inverse Rotation ---


        logicalX = Math.floor(logicalX);
        logicalY = Math.floor(logicalY);


        if (logicalX >= 0 && logicalX < canvasWidth && logicalY >= 0 && logicalY < canvasHeight) {
            return { x: logicalX, y: logicalY };
        }
        return null;
    }, [canvasRef, zoomLevel, canvasWidth, canvasHeight, layers, activeLayerId]);

  const pencilDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) => {
        drawLine(ctx, x0, y0, x1, y1, color, drawPixel, brushSize);
    }, [brushSize]);
  const eraserDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
        const clearFuncWithBrush = ( c: CanvasRenderingContext2D, x: number, y: number, _color: string, size: number ) => clearPixel(c, x, y, size);
        drawLine(ctx, x0, y0, x1, y1, 'transparent', clearFuncWithBrush, brushSize);
    }, [brushSize]);
  const eyedropperSample = useCallback((logicalCoords: { x: number; y: number }) => {
        const activeLayerIndex = layers.findIndex(layer => layer.id === activeLayerId);
        if (activeLayerIndex === -1) { return; }
        // When eyedropping, we sample from the composited view of layers *above* the active one,
        // but we need to sample based on the logical coordinates of the active layer's canvas.
        // The getPixelColor function already handles the logical coordinates correctly.
        for (let i = activeLayerIndex; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.isVisible && layer.offscreenCanvas) {
                const ctx = layer.offscreenCanvas.getContext('2d');
                if (ctx) {
                    // getPixelColor works on the offscreen canvas using its internal coordinates (0 to width/height)
                    const color = getPixelColor(ctx, logicalCoords.x, logicalCoords.y);
                    if (color) { dispatch({ type: 'SET_PRIMARY_COLOR', color }); return; }
                }
            }
        }
    }, [layers, dispatch, activeLayerId]);
  const floodFill = useCallback((startX: number, startY: number) => {
    const ctx = activeCtxCache.current;
    const layer = activeLayerCache.current;
    if (!ctx || !layer || layer.isLocked || !state.isInitialized || canvasWidth <= 0 || canvasHeight <= 0) return;
    const fillColorRgba = parseColor(primaryColor);
    if (!fillColorRgba) { console.error("Invalid fill color:", primaryColor); alert("Select a valid color before filling."); return; }
    const fillColorForImageData: RgbaPixel = { r: fillColorRgba.r, g: fillColorRgba.g, b: fillColorRgba.b, a: Math.round(fillColorRgba.a * 255) };
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const targetColor = getPixelFromImageData(imageData, startX, startY);
    if (!targetColor || areColorsEqual(targetColor, fillColorForImageData)) return;
    const queue: [number, number][] = [[startX, startY]];
    while (queue.length > 0) {
        if (queue.length > canvasWidth * canvasHeight * 2) { console.error("Fill queue exceeded."); alert("Fill area too large."); return; }
        const [x, y] = queue.shift()!;
        const currentColor = getPixelFromImageData(imageData, x, y);
        if (currentColor && areColorsEqual(currentColor, targetColor)) {
            setPixelInImageData(imageData, x, y, fillColorForImageData);
            const neighbors: [number, number][] = [ [x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1] ];
            for (const [nx, ny] of neighbors) {
                 if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) { queue.push([nx, ny]); }
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    const updatedCanvas = layer.offscreenCanvas;
    if (updatedCanvas) {
        dispatch({ type: 'UPDATE_LAYER_CANVAS', id: layer.id, canvas: updatedCanvas, dataURL: updatedCanvas.toDataURL() });
        setRedrawNonce(n => n + 1);
    }
  }, [activeCtxCache, activeLayerCache, canvasWidth, canvasHeight, primaryColor, dispatch, state.isInitialized]);
  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return;
    const coords = getLogicalCoords(event);
    const currentLayer = activeLayerCache.current;
    if (!coords || !currentLayer || currentLayer.isLocked) return;
    const ctx = activeCtxCache.current;
    if (!ctx) return;
    event.preventDefault();
    switch (selectedTool) {
        case 'pencil':
        case 'eraser':
            isDrawing.current = true;
            lastPoint.current = coords;
            ctx.save();
            if (selectedTool === 'pencil') { drawPixel(ctx, coords.x, coords.y, primaryColor, brushSize); }
            else { clearPixel(ctx, coords.x, coords.y, brushSize); }
            setRedrawNonce(n => n + 1);
            break;
        case 'eyedropper':
            eyedropperSample(coords);
            isDrawing.current = false;
            break;
        case 'fill':
            isDrawing.current = false;
            floodFill(coords.x, coords.y);
            break;
    }
  }, [getLogicalCoords, activeLayerCache, activeCtxCache, selectedTool, primaryColor, eyedropperSample, floodFill, brushSize]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
      const coords = getLogicalCoords(event);
      dispatch({ type: 'SET_CURSOR_COORDS', coords: coords });
      if (!isDrawing.current || !lastPoint.current || selectedTool === 'fill' || selectedTool === 'eyedropper') {
          return;
      }
      const currentLayer = activeLayerCache.current;
      if (!coords || !currentLayer || currentLayer.isLocked) {
          if (isDrawing.current) {
              isDrawing.current = false;
              lastPoint.current = null;
              if (activeCtxCache.current && (selectedTool === 'pencil' || selectedTool === 'eraser')) {
                  activeCtxCache.current.restore();
                  const updatedCanvas = currentLayer?.offscreenCanvas;
                  if (updatedCanvas && currentLayer) {
                      dispatch({ type: 'UPDATE_LAYER_CANVAS', id: currentLayer.id, canvas: updatedCanvas, dataURL: updatedCanvas.toDataURL() });
                      setRedrawNonce(n => n + 1);
                  }
              }
          }
          return;
      }
      const ctx = activeCtxCache.current;
      if (!ctx) return;
      if (coords.x !== lastPoint.current.x || coords.y !== lastPoint.current.y) {
        switch (selectedTool) {
          case 'pencil':
              pencilDraw(ctx, lastPoint.current.x, lastPoint.current.y, coords.x, coords.y, primaryColor);
              break;
          case 'eraser':
              eraserDraw(ctx, lastPoint.current.x, lastPoint.current.y, coords.x, coords.y);
              break;
        }
        lastPoint.current = coords;
        setRedrawNonce(n => n + 1);
      }
  }, [getLogicalCoords, dispatch, selectedTool, primaryColor, pencilDraw, eraserDraw, activeLayerCache, activeCtxCache]);

  const finalizeDrawing = useCallback(() => {
    if (isDrawing.current && (selectedTool === 'pencil' || selectedTool === 'eraser')) {
        isDrawing.current = false;
        lastPoint.current = null;
        const currentLayer = activeLayerCache.current;
        if (currentLayer && activeCtxCache.current) {
            activeCtxCache.current.restore();
            const updatedCanvas = currentLayer.offscreenCanvas;
            if (updatedCanvas) {
                dispatch({
                    type: 'UPDATE_LAYER_CANVAS',
                    id: currentLayer.id,
                    canvas: updatedCanvas,
                    dataURL: updatedCanvas.toDataURL()
                });
                setRedrawNonce(n => n + 1);
            }
        }
    } else {
        isDrawing.current = false;
        lastPoint.current = null;
    }
  }, [dispatch, activeLayerCache, activeCtxCache, selectedTool]);

  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return;
    finalizeDrawing();
  }, [finalizeDrawing]);

 const handlePointerLeave = useCallback(() => {
     dispatch({ type: 'SET_CURSOR_COORDS', coords: null });
     if (isDrawing.current) {
         finalizeDrawing();
     }
  }, [finalizeDrawing, dispatch]);

  const handleWheelZoom = useCallback((event: WheelEvent) => {
    event.preventDefault();
    const zoomFactor = 1 - event.deltaY * ZOOM_SENSITIVITY;
    let newZoomLevel = zoomLevel * zoomFactor;
    newZoomLevel = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, newZoomLevel));
    dispatch({ type: 'SET_ZOOM_LEVEL', level: newZoomLevel });
  }, [zoomLevel, dispatch]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerLeave, { capture: true });
    canvas.addEventListener('wheel', handleWheelZoom, { passive: false });
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerLeave, { capture: true });
      canvas.removeEventListener('wheel', handleWheelZoom);
    };
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave, handleWheelZoom]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvasWidth <= 0 || canvasHeight <= 0) return;

    const activeLayer = layers.find(l => l.id === activeLayerId);
    const activeIndex = layers.findIndex(l => l.id === activeLayerId);

    canvas.width = canvasWidth * zoomLevel;
    canvas.height = canvasHeight * zoomLevel;
    ctx.imageSmoothingEnabled = false;

    const isActiveLayerLocked = (activeLayer?.isLocked) ?? false;
    if (isActiveLayerLocked && selectedTool !== 'eyedropper') {
        canvas.style.cursor = 'not-allowed';
    } else {
        switch (selectedTool) {
            case 'pencil': canvas.style.cursor = 'crosshair'; break;
            case 'eraser': canvas.style.cursor = 'crosshair'; break;
            case 'eyedropper': canvas.style.cursor = 'copy'; break;
            case 'fill': canvas.style.cursor = 'crosshair'; break;
            default: canvas.style.cursor = 'default';
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCheckerboard(ctx, canvas.width, canvas.height);

    if (activeIndex !== -1) {
        for (let i = layers.length - 1; i >= activeIndex; i--) {
            const layerToDraw = layers[i];
            if (layerToDraw && layerToDraw.isVisible && layerToDraw.offscreenCanvas) {
                ctx.globalAlpha = (i === activeIndex) ? layerToDraw.opacity : 1.0;

                // Draw the layer's offscreen canvas content directly.
                // The rotation has already been applied to the offscreen canvas pixels.
                ctx.drawImage(
                    layerToDraw.offscreenCanvas,
                    0, 0,
                    canvasWidth, canvasHeight, // Source dimensions from offscreen canvas
                    0, 0,
                    canvas.width, canvas.height // Destination dimensions on main canvas
                );
            }
        }
        ctx.globalAlpha = 1.0;
    }

    if (showGrid && zoomLevel >= GRID_VISIBILITY_ZOOM_THRESHOLD) {
        ctx.strokeStyle = "rgba(128, 128, 128, 0.5)";
        ctx.lineWidth = 1;
        for (let x = 0; x <= canvasWidth; x++) {
            ctx.beginPath();
            ctx.moveTo(x * zoomLevel - 0.5, 0);
            ctx.lineTo(x * zoomLevel - 0.5, canvas.height);
            ctx.stroke();
        }
        for (let y = 0; y <= canvasHeight; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * zoomLevel - 0.5);
            ctx.lineTo(canvas.width, y * zoomLevel - 0.5);
            ctx.stroke();
        }
    }
  }, [canvasRef, layers, activeLayerId, canvasWidth, canvasHeight, zoomLevel, selectedTool, redrawNonce, showGrid]);

}
