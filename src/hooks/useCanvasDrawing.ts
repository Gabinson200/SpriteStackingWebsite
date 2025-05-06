// src/hooks/useCanvasDrawing.ts
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from '../state/AppContext';
import type{ Layer, Tool } from '../state/types';
import { parseColor } from '../utils/colorUtils';
import { compositeLayers, getPixelColor, drawPixel, clearPixel, drawLine,
    getPixelFromImageData,
    setPixelInImageData,
    areColorsEqual,
    drawCheckerboard
 } from '../utils/canvasUtils';

// testing i made a change to see if it works
import type {RgbaPixel} from '../utils/colorUtils';

interface UseCanvasDrawingProps {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>; // Ref to the scrollable container
}

export function useCanvasDrawing({ canvasRef, containerRef }: UseCanvasDrawingProps) {
  const { state, dispatch } = useAppContext();
  const {
    canvasWidth,
    canvasHeight,
    layers,
    activeLayerId,
    selectedTool,
    primaryColor,
    zoomLevel,
  } = state;

  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activeLayerCache = useRef<Layer | null>(null); // Cache active layer for drawing ops
  const activeCtxCache = useRef<CanvasRenderingContext2D | null>(null); // Cache active layer's context

  // Update cached layer and context when activeLayerId changes
  useEffect(() => {
      activeLayerCache.current = layers.find(l => l.id === activeLayerId) || null;
      activeCtxCache.current = activeLayerCache.current?.offscreenCanvas?.getContext('2d') || null;
      if (activeCtxCache.current) {
          activeCtxCache.current.imageSmoothingEnabled = false; // Ensure crisp drawing on the offscreen canvas too
      }
  }, [activeLayerId, layers]);


  // Function to get logical pixel coordinates from canvas event coordinates
  const getLogicalCoords = useCallback((event: PointerEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    // Calculate coordinates relative to the canvas element, factoring in zoom
    const canvasX = (event.clientX - rect.left);
    const canvasY = (event.clientY - rect.top);

    // Convert to logical coordinates (0 to canvasWidth/Height - 1)
    const logicalX = Math.floor(canvasX / zoomLevel);
    const logicalY = Math.floor(canvasY / zoomLevel);

    // Ensure coordinates are within the logical bounds
    if (logicalX >= 0 && logicalX < canvasWidth && logicalY >= 0 && logicalY < canvasHeight) {
        return { x: logicalX, y: logicalY };
    }
    return null; // Click was outside logical canvas bounds

  }, [canvasRef, zoomLevel, canvasWidth, canvasHeight]);


  // --- Drawing Functions ---

  const pencilDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) => {
    drawLine(ctx, x0, y0, x1, y1, color, drawPixel);
  }, []);

  const eraserDraw = useCallback((ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) => {
      // Need a custom drawFunc for clearRect within drawLine
      const clearFunc = (ctx: CanvasRenderingContext2D, x: number, y: number) => clearPixel(ctx, x, y);
      drawLine(ctx, x0, y0, x1, y1, 'transparent', clearFunc); // Color doesn't matter for clearRect
  }, []);


  const eyedropperSample = useCallback((logicalCoords: { x: number; y: number }) => {
    // Iterate top-down through visible layers
    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        if (layer.isVisible && layer.offscreenCanvas) {
            const ctx = layer.offscreenCanvas.getContext('2d');
            if (ctx) {
                const color = getPixelColor(ctx, logicalCoords.x, logicalCoords.y);
                if (color) { // Found a non-transparent pixel
                    dispatch({ type: 'SET_PRIMARY_COLOR', color });
                    // Optionally switch back to previous tool (e.g., pencil)
                    // dispatch({ type: 'SET_SELECTED_TOOL', tool: 'pencil' });
                    return; // Stop after finding the topmost color
                }
            }
        }
    }
     // If no color found (all layers transparent at this point), maybe do nothing or set to default?
  }, [layers, dispatch]);


  
  // --- Flood Fill Implementation ---
  const floodFill = useCallback((startX: number, startY: number) => {
    const ctx = activeCtxCache.current;
    const layer = activeLayerCache.current;

    if (!ctx || !layer || layer.isLocked || !state.isInitialized || canvasWidth <= 0 || canvasHeight <= 0) {
        console.log("Fill conditions not met.");
        return;
    }

    // 1. Get Fill Color (parse primaryColor)
    const fillColorRgba = parseColor(primaryColor);
    if (!fillColorRgba) {
        console.error("Invalid fill color:", primaryColor);
        alert("Select a valid color before filling.");
        return;
    }
     // Convert alpha from 0-1 to 0-255 for direct ImageData manipulation
     const fillColorForImageData: RgbaPixel = {
        r: fillColorRgba.r,
        g: fillColorRgba.g,
        b: fillColorRgba.b,
        a: Math.round(fillColorRgba.a * 255),
     };


    // 2. Get ImageData and Target Color
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const targetColor = getPixelFromImageData(imageData, startX, startY);

    if (!targetColor) return; // Clicked outside bounds somehow

    // 3. Check if target and fill colors are the same
    if (areColorsEqual(targetColor, fillColorForImageData)) {
        console.log("Target color is the same as fill color, no fill needed.");
        return; // No need to fill
    }

    console.log(`Fill: Start(${startX},${startY}), Target(${targetColor.r},${targetColor.g},${targetColor.b},${targetColor.a}), Fill(${fillColorForImageData.r},${fillColorForImageData.g},${fillColorForImageData.b},${fillColorForImageData.a})`);


    // 4. Flood Fill Algorithm (Queue-based BFS)
    const queue: [number, number][] = [[startX, startY]];
    // Optional: Use a Set for visited pixels if performance becomes an issue
    // const visited = new Set<string>();
    // visited.add(`${startX},${startY}`);

    while (queue.length > 0) {
        if (queue.length > canvasWidth * canvasHeight * 2) { // Safety break for huge queues
            console.error("Fill queue exceeded safety limit. Aborting.");
            alert("Fill area too large or complex. Fill aborted.");
            return;
        }

        const [x, y] = queue.shift()!; // Get pixel from queue

        // Check bounds (redundant if getPixelFromImageData handles it, but good practice)
        // if (x < 0 || x >= canvasWidth || y < 0 || y >= canvasHeight) continue;

        // Get current color of this pixel
        const currentColor = getPixelFromImageData(imageData, x, y);

        // If it matches the target color, fill it and add neighbors
        if (currentColor && areColorsEqual(currentColor, targetColor)) {
            setPixelInImageData(imageData, x, y, fillColorForImageData);

            // Enqueue neighbors (4-directional)
            const neighbors: [number, number][] = [
                [x + 1, y],
                [x - 1, y],
                [x, y + 1],
                [x, y - 1],
            ];

            for (const [nx, ny] of neighbors) {
                // Optional visited check:
                // const neighborKey = `${nx},${ny}`;
                // if (!visited.has(neighborKey)) {
                //    queue.push([nx, ny]);
                //    visited.add(neighborKey);
                // }
                // If not using visited Set, rely on color check (make sure fill/target differ)
                 if (nx >= 0 && nx < canvasWidth && ny >= 0 && ny < canvasHeight) { // Check bounds before queuing
                     queue.push([nx, ny]);
                 }
            }
        }
    }

    // 5. Put modified data back and dispatch update
    console.log("Fill complete, putting image data back.");
    ctx.putImageData(imageData, 0, 0);

    // Dispatch update for persistence and thumbnail/preview refresh
    const updatedCanvas = layer.offscreenCanvas;
    if (updatedCanvas) {
        dispatch({
            type: 'UPDATE_LAYER_CANVAS',
            id: layer.id,
            canvas: updatedCanvas,
            dataURL: updatedCanvas.toDataURL() // Regenerate dataURL
        });
    }
  }, [activeCtxCache, activeLayerCache, canvasWidth, canvasHeight, primaryColor, dispatch, state.isInitialized]); // Add dependencies


  // --- Event Handlers Update ---

  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return; // Only handle left clicks
    const coords = getLogicalCoords(event);
    const currentLayer = activeLayerCache.current; // Use cached ref

    if (!coords || !currentLayer || currentLayer.isLocked) return;

    const ctx = activeCtxCache.current; // Use cached ref
    if (!ctx) return;

    event.preventDefault(); // Prevent default actions like text selection

    switch (selectedTool) {
        case 'pencil':
        case 'eraser':
            isDrawing.current = true;
            lastPoint.current = coords;
            ctx.save(); // Save context state
            if (selectedTool === 'pencil') {
                drawPixel(ctx, coords.x, coords.y, primaryColor);
            } else {
                clearPixel(ctx, coords.x, coords.y);
            }
            break;
        case 'eyedropper':
            eyedropperSample(coords);
            isDrawing.current = false; // Single click action
            break;
        case 'fill': // --- Add Fill Tool Case ---
            isDrawing.current = false; // Single click action
            floodFill(coords.x, coords.y); // Trigger flood fill
            break; // --- End Fill Tool Case ---
    }

  }, [getLogicalCoords, activeLayerCache, activeCtxCache, selectedTool, primaryColor, /*pencilDraw, eraserDraw,*/ eyedropperSample, floodFill]); // Include floodFill


  // handlePointerMove remains the same (fill tool doesn't draw on move)
  const handlePointerMove = useCallback((event: PointerEvent) => {
      if (!isDrawing.current || !lastPoint.current || selectedTool === 'fill' || selectedTool === 'eyedropper') return; // Ignore move for fill/eyedropper

      const coords = getLogicalCoords(event);
      if (!coords || !activeLayerCache.current || activeLayerCache.current.isLocked) {
          // Finalize drawing if moving outside locked layer or canvas bounds while drawing
          if (isDrawing.current) {
              isDrawing.current = false;
              lastPoint.current = null;
              if (activeCtxCache.current && (selectedTool === 'pencil' || selectedTool === 'eraser')) {
                  activeCtxCache.current.restore(); // Restore context state
                  const updatedCanvas = activeLayerCache.current?.offscreenCanvas;
                  if (updatedCanvas && activeLayerCache.current) {
                      dispatch({ type: 'UPDATE_LAYER_CANVAS', id: activeLayerCache.current.id, canvas: updatedCanvas, dataURL: updatedCanvas.toDataURL() });
                  }
              }
          }
          return;
      }


      const ctx = activeCtxCache.current;
      if (!ctx) return;

      // Only draw line if the logical coordinates have changed
      if (coords.x !== lastPoint.current.x || coords.y !== lastPoint.current.y) {
        switch (selectedTool) {
          case 'pencil':
            drawLine(ctx, lastPoint.current.x, lastPoint.current.y, coords.x, coords.y, primaryColor, drawPixel);
            break;
          case 'eraser':
             const clearFunc = (ctx: CanvasRenderingContext2D, x: number, y: number) => clearPixel(ctx, x, y);
             drawLine(ctx, lastPoint.current.x, lastPoint.current.y, coords.x, coords.y, 'transparent', clearFunc);
            break;
        }
        lastPoint.current = coords; // Update last point
      }

  }, [getLogicalCoords, activeLayerCache, activeCtxCache, selectedTool, primaryColor, dispatch]);


  // handlePointerUp needs to finalize drawing for pencil/eraser but not fill/eyedropper
  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return; // Only handle left clicks

    // Finalize drawing state only if pencil/eraser was active
    if (isDrawing.current && (selectedTool === 'pencil' || selectedTool === 'eraser')) {
        isDrawing.current = false;
        lastPoint.current = null;

        if (activeLayerCache.current && activeCtxCache.current) {
            activeCtxCache.current.restore(); // Restore context state if saved
            const updatedCanvas = activeLayerCache.current.offscreenCanvas;
            if(updatedCanvas) {
                dispatch({
                    type: 'UPDATE_LAYER_CANVAS',
                    id: activeLayerCache.current.id,
                    canvas: updatedCanvas,
                    dataURL: updatedCanvas.toDataURL()
                });
            }
        }
    } else {
         // Reset drawing flag even if not pencil/eraser, just in case
         isDrawing.current = false;
         lastPoint.current = null;
    }

  }, [dispatch, activeLayerCache, activeCtxCache, selectedTool]);

 // handlePointerLeave needs similar finalization logic as pointerUp for pencil/eraser
 const handlePointerLeave = useCallback((event: PointerEvent) => {
     if (isDrawing.current && (selectedTool === 'pencil' || selectedTool === 'eraser')) {
          isDrawing.current = false;
          lastPoint.current = null;
          if (activeLayerCache.current && activeCtxCache.current) {
              activeCtxCache.current.restore();
              const updatedCanvas = activeLayerCache.current.offscreenCanvas;
              if(updatedCanvas) {
                  dispatch({
                      type: 'UPDATE_LAYER_CANVAS',
                      id: activeLayerCache.current.id,
                      canvas: updatedCanvas,
                      dataURL: updatedCanvas.toDataURL()
                  });
              }
          }
     }
  }, [dispatch, activeLayerCache, activeCtxCache, selectedTool]);


  // Effect to attach/detach pointer event listeners
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Using pointer events handles mouse, pen, and touch
    canvas.addEventListener('pointerdown', handlePointerDown);
    canvas.addEventListener('pointermove', handlePointerMove);
    canvas.addEventListener('pointerup', handlePointerUp);
    canvas.addEventListener('pointerleave', handlePointerLeave); // Handle leaving the canvas area

    // Cleanup function
    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown);
      canvas.removeEventListener('pointermove', handlePointerMove);
      canvas.removeEventListener('pointerup', handlePointerUp);
      canvas.removeEventListener('pointerleave', handlePointerLeave);
    };
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave]);


  // --- MODIFIED Effect to redraw the main canvas ---
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');

    if (!ctx || !canvas || canvasWidth <= 0 || canvasHeight <= 0) {
        return; // Exit if canvas context or dimensions aren't ready
    }

    // --- Find the currently active layer ---
    const currentActiveLayer = layers.find(l => l.id === activeLayerId);

    // --- Resize visible canvas based on zoom ---
    canvas.width = canvasWidth * zoomLevel;
    canvas.height = canvasHeight * zoomLevel;
    ctx.imageSmoothingEnabled = false; // Ensure crisp rendering after resize

    // --- Set cursor based on tool and lock status ---
    const isActiveLayerLocked = currentActiveLayer?.isLocked ?? false;
    if (isActiveLayerLocked && selectedTool !== 'eyedropper') {
        canvas.style.cursor = 'not-allowed';
    } else {
        switch (selectedTool) {
            case 'pencil': canvas.style.cursor = 'crosshair'; break;
            case 'eraser': canvas.style.cursor = 'crosshair'; break;
            case 'eyedropper': canvas.style.cursor = 'copy'; break;
            case 'fill': canvas.style.cursor = 'crosshair'; break; // Or bucket cursor
            default: canvas.style.cursor = 'default';
        }
    }

    // --- Clear the main canvas and draw checkerboard ---
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCheckerboard(ctx, canvas.width, canvas.height);

    // --- Draw ONLY the active layer's offscreen canvas ---
    if (currentActiveLayer && currentActiveLayer.offscreenCanvas) {
        // Draw the layer scaled by zoomLevel
        ctx.drawImage(
            currentActiveLayer.offscreenCanvas,
            0, // No offset needed for main canvas view
            0, // No offset needed for main canvas view
            canvas.width, // Draw at the full zoomed size
            canvas.height // Draw at the full zoomed size
        );
    } else {
        // Optional: Draw something else if no layer is active or canvas is missing
        // console.log("No active layer canvas to draw.");
    }

    // Dependencies: Redraw when active layer changes, layers array changes (to find active layer),
    // dimensions change, or zoom changes. Also selectedTool for cursor.
  }, [canvasRef, layers, activeLayerId, canvasWidth, canvasHeight, zoomLevel, selectedTool]);

} // End of useCanvasDrawing hook