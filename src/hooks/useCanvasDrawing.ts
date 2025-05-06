// src/hooks/useCanvasDrawing.ts
import { useRef, useEffect, useCallback, useState } from 'react'; // Import useState
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

export function useCanvasDrawing({ canvasRef, containerRef }: UseCanvasDrawingProps) {
  const { state, dispatch } = useAppContext();
  const {
    canvasWidth,
    canvasHeight,
    layers, // The full layers array [Top, ..., Bottom]
    activeLayerId,
    selectedTool,
    primaryColor,
    zoomLevel,
  } = state;

  // --- State to trigger redraws during drag ---
  const [redrawNonce, setRedrawNonce] = useState(0);
  // ---

  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activeLayerCache = useRef<Layer | null>(null);
  const activeCtxCache = useRef<CanvasRenderingContext2D | null>(null);

  // Effect to update cached layer and context (remains same)
  useEffect(() => {
      activeLayerCache.current = layers.find(l => l.id === activeLayerId) || null;
      activeCtxCache.current = activeLayerCache.current?.offscreenCanvas?.getContext('2d') || null;
      if (activeCtxCache.current) {
          activeCtxCache.current.imageSmoothingEnabled = false;
      }
  }, [activeLayerId, layers]);

  // getLogicalCoords (remains same)
   const getLogicalCoords = useCallback((event: PointerEvent): { x: number; y: number } | null => {
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

  // pencilDraw, eraserDraw (remain same)
  const pencilDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) => {
        drawLine(ctx, x0, y0, x1, y1, color, drawPixel);
    }, []);
  const eraserDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
        const clearFunc = (ctx: CanvasRenderingContext2D, x: number, y: number) => clearPixel(ctx, x, y);
        drawLine(ctx, x0, y0, x1, y1, 'transparent', clearFunc);
    }, []);

  // eyedropperSample (remains same)
  const eyedropperSample = useCallback((logicalCoords: { x: number; y: number }) => {
        for (let i = 0; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.isVisible && layer.offscreenCanvas) {
                const ctx = layer.offscreenCanvas.getContext('2d');
                if (ctx) {
                    const color = getPixelColor(ctx, logicalCoords.x, logicalCoords.y);
                    if (color) { dispatch({ type: 'SET_PRIMARY_COLOR', color }); return; }
                }
            }
        }
    }, [layers, dispatch]);

  // floodFill (remains same)
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
        setRedrawNonce(n => n + 1); // Trigger redraw after fill
    }
  }, [activeCtxCache, activeLayerCache, canvasWidth, canvasHeight, primaryColor, dispatch, state.isInitialized]);


  // --- Event Handlers ---
  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return;
    const coords = getLogicalCoords(event);
    const currentLayer = activeLayerCache.current;
    if (!coords || !currentLayer || currentLayer.isLocked) return;
    const ctx = activeCtxCache.current;
    if (!ctx) return;
    event.preventDefault();

    // Reset nonce at the beginning of a potential draw/fill action
    // setRedrawNonce(0); // Optional: reset here if needed

    switch (selectedTool) {
        case 'pencil':
        case 'eraser':
            isDrawing.current = true;
            lastPoint.current = coords;
            ctx.save(); // Save context state for potential restore on pointer up/leave
            if (selectedTool === 'pencil') {
                drawPixel(ctx, coords.x, coords.y, primaryColor);
            } else {
                clearPixel(ctx, coords.x, coords.y);
            }
            // Trigger initial redraw for the first pixel
            setRedrawNonce(n => n + 1);
            break;
        case 'eyedropper':
            eyedropperSample(coords);
            isDrawing.current = false;
            break;
        case 'fill':
            isDrawing.current = false;
            floodFill(coords.x, coords.y); // floodFill now triggers its own redraw
            break;
    }
  }, [getLogicalCoords, activeLayerCache, activeCtxCache, selectedTool, primaryColor, eyedropperSample, floodFill]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
      // Only run if drawing (pencil/eraser) and mouse button is down
      if (!isDrawing.current || !lastPoint.current || selectedTool === 'fill' || selectedTool === 'eyedropper') return;

      const coords = getLogicalCoords(event);
      const currentLayer = activeLayerCache.current;

      // Stop drawing if moving outside bounds or onto a locked layer
      if (!coords || !currentLayer || currentLayer.isLocked) {
          if (isDrawing.current) { // Check if we were drawing before leaving
              isDrawing.current = false;
              lastPoint.current = null;
              if (activeCtxCache.current && (selectedTool === 'pencil' || selectedTool === 'eraser')) {
                  activeCtxCache.current.restore(); // Restore context state
                  const updatedCanvas = currentLayer?.offscreenCanvas;
                  // Final update dispatch on leaving bounds while drawing
                  if (updatedCanvas && currentLayer) {
                      dispatch({ type: 'UPDATE_LAYER_CANVAS', id: currentLayer.id, canvas: updatedCanvas, dataURL: updatedCanvas.toDataURL() });
                      setRedrawNonce(n => n + 1); // Trigger final redraw
                  }
              }
          }
          return;
      }

      const ctx = activeCtxCache.current;
      if (!ctx) return;

      // Draw line segment if logical coordinates changed
      if (coords.x !== lastPoint.current.x || coords.y !== lastPoint.current.y) {
        switch (selectedTool) {
          case 'pencil':
              pencilDraw(ctx, lastPoint.current.x, lastPoint.current.y, coords.x, coords.y, primaryColor);
              break;
          case 'eraser':
              eraserDraw(ctx, lastPoint.current.x, lastPoint.current.y, coords.x, coords.y);
              break;
        }
        lastPoint.current = coords; // Update last point

        // --- Trigger redraw after drawing segment ---
        setRedrawNonce(n => n + 1);
        // ---
      }
  }, [getLogicalCoords, activeLayerCache, activeCtxCache, selectedTool, primaryColor, dispatch, pencilDraw, eraserDraw]); // Added pencilDraw/eraserDraw deps

  // Shared logic for pointer up / leave
  const finalizeDrawing = useCallback(() => {
    if (isDrawing.current && (selectedTool === 'pencil' || selectedTool === 'eraser')) {
        isDrawing.current = false;
        lastPoint.current = null;
        const currentLayer = activeLayerCache.current;
        if (currentLayer && activeCtxCache.current) {
            activeCtxCache.current.restore(); // Restore context state saved on pointer down
            const updatedCanvas = currentLayer.offscreenCanvas;
            if (updatedCanvas) {
                // Dispatch final update with dataURL for persistence
                dispatch({
                    type: 'UPDATE_LAYER_CANVAS',
                    id: currentLayer.id,
                    canvas: updatedCanvas,
                    dataURL: updatedCanvas.toDataURL()
                });
                // Trigger one last redraw to ensure final state is shown
                setRedrawNonce(n => n + 1);
            }
        }
    } else {
        // Ensure drawing state is reset even if not pencil/eraser
        isDrawing.current = false;
        lastPoint.current = null;
    }
  }, [dispatch, activeLayerCache, activeCtxCache, selectedTool]);


  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return; // Only handle left button release
    finalizeDrawing();
  }, [finalizeDrawing]);

 const handlePointerLeave = useCallback((event: PointerEvent) => {
     // Finalize if leaving the canvas while the button was down
     if (isDrawing.current) {
         finalizeDrawing();
     }
  }, [finalizeDrawing]);

  // Effect for attaching listeners (remains same)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Use capture phase for pointer leave to catch it more reliably if pointer moves fast
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerLeave, { capture: true }); // Use capture
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerLeave, { capture: true }); // Use capture
    };
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave]);


  // --- MODIFIED Effect to redraw the main canvas ---
  useEffect(() => {
    // console.log("Redraw Effect Triggered - Nonce:", redrawNonce); // Debug log
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

    // Add redrawNonce to dependencies to trigger redraw when it changes
  }, [canvasRef, layers, activeLayerId, canvasWidth, canvasHeight, zoomLevel, selectedTool, redrawNonce]);

} // End of useCanvasDrawing hook
