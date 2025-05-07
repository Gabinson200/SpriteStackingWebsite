// src/hooks/useCanvasDrawing.ts
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from '../state/AppContext';
import type { Layer, Tool } from '../state/types'; // Use type import
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
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;
const ZOOM_SENSITIVITY = 0.0025;

export function useCanvasDrawing({ canvasRef, containerRef }: UseCanvasDrawingProps) {
  const { state, dispatch } = useAppContext();
  const {
    canvasWidth,
    canvasHeight,
    layers,
    activeLayerId, // Will be used to determine starting point for eyedropper
    selectedTool,
    primaryColor,
    zoomLevel,
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
          activeCtxCache.current.imageSmoothingEnabled = false;
      }
  }, [activeLayerId, layers]);

   const getLogicalCoords = useCallback((event: PointerEvent | WheelEvent): { x: number; y: number } | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const canvasX = (event.clientX - rect.left);
        const canvasY = (event.clientY - rect.top);
        const logicalX = Math.floor(canvasX / zoomLevel);
        const logicalY = Math.floor(canvasY / zoomLevel);
        if (logicalX >= 0 && logicalX < canvasWidth && logicalY >= 0 && logicalY < canvasHeight) {
            return { x: logicalX, y: logicalY };
        }
        return null;
    }, [canvasRef, zoomLevel, canvasWidth, canvasHeight]);

  const pencilDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) => {
        drawLine(ctx, x0, y0, x1, y1, color, drawPixel);
    }, []);
  const eraserDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
        const clearFunc = (ctx: CanvasRenderingContext2D, x: number, y: number) => clearPixel(ctx, x, y);
        drawLine(ctx, x0, y0, x1, y1, 'transparent', clearFunc);
    }, []);

  // --- Modified eyedropperSample ---
  const eyedropperSample = useCallback((logicalCoords: { x: number; y: number }) => {
        console.log(`Eyedropper: Sampling at logical coordinates (${logicalCoords.x}, ${logicalCoords.y})`);

        // Find the index of the active layer
        const activeLayerIndex = layers.findIndex(layer => layer.id === activeLayerId);

        if (activeLayerIndex === -1) {
            console.log("Eyedropper: No active layer found. Cannot sample.");
            return; // Should not happen if a layer is always active
        }

        // Iterate from the active layer downwards (towards higher indices)
        for (let i = activeLayerIndex; i < layers.length; i++) {
            const layer = layers[i];
            console.log(`Eyedropper: Checking layer "${layer.name}" (ID: ${layer.id}, Index: ${i}), Visible: ${layer.isVisible}`);

            if (layer.isVisible && layer.offscreenCanvas) {
                const ctx = layer.offscreenCanvas.getContext('2d');
                if (ctx) {
                    const color = getPixelColor(ctx, logicalCoords.x, logicalCoords.y);
                    console.log(`Eyedropper: Color sampled from "${layer.name}":`, color);
                    if (color) { // Found first non-transparent pixel
                        console.log(`Eyedropper: Dispatching SET_PRIMARY_COLOR with ${color}`);
                        dispatch({ type: 'SET_PRIMARY_COLOR', color });
                        return; // Stop sampling
                    }
                } else {
                    console.log(`Eyedropper: Could not get context for layer "${layer.name}"`);
                }
            }
        }
        console.log("Eyedropper: No color found at coordinates from active layer downwards (all relevant layers transparent or invisible).");
    }, [layers, dispatch, activeLayerId]); // Added activeLayerId dependency
  // --- End Modified eyedropperSample ---

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
            if (selectedTool === 'pencil') {
                drawPixel(ctx, coords.x, coords.y, primaryColor);
            } else {
                clearPixel(ctx, coords.x, coords.y);
            }
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
  }, [getLogicalCoords, activeLayerCache, activeCtxCache, selectedTool, primaryColor, eyedropperSample, floodFill]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
      if (!isDrawing.current || !lastPoint.current || selectedTool === 'fill' || selectedTool === 'eyedropper') return;
      const coords = getLogicalCoords(event);
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
  }, [getLogicalCoords, activeLayerCache, activeCtxCache, selectedTool, primaryColor, dispatch, pencilDraw, eraserDraw]);

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

 const handlePointerLeave = useCallback((event: PointerEvent) => {
     if (isDrawing.current) {
         finalizeDrawing();
     }
  }, [finalizeDrawing]);

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
    const ctx = canvas?.getContext('2d');

    if (!ctx || !canvas || canvasWidth <= 0 || canvasHeight <= 0) {
        return;
    }

    const activeIndex = layers.findIndex(l => l.id === activeLayerId);

    canvas.width = canvasWidth * zoomLevel;
    canvas.height = canvasHeight * zoomLevel;
    ctx.imageSmoothingEnabled = false;

    const isActiveLayerLocked = (activeIndex !== -1 && layers[activeIndex]?.isLocked) ?? false;
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
                ctx.drawImage(
                    layerToDraw.offscreenCanvas,
                    0, 0,
                    canvas.width, canvas.height
                );
            }
        }
        ctx.globalAlpha = 1.0;
    }
  }, [canvasRef, layers, activeLayerId, canvasWidth, canvasHeight, zoomLevel, selectedTool, redrawNonce]);

}
