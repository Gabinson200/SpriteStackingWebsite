// src/hooks/useCanvasDrawing.ts
import { useRef, useEffect, useCallback, useState } from 'react';
import { useAppContext } from '../state/AppContext';
import type { Layer, Tool, SelectionRect } from '../state/types';
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
  selectionCanvasRef: React.RefObject<HTMLCanvasElement | null>;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 32;
const ZOOM_SENSITIVITY = 0.0025;
const GRID_VISIBILITY_ZOOM_THRESHOLD = 4;

export function useCanvasDrawing({ canvasRef, containerRef, selectionCanvasRef }: UseCanvasDrawingProps) {
  const { state, dispatch } = useAppContext();
  const {
    canvasWidth, canvasHeight, layers, activeLayerId, selectedTool, primaryColor, zoomLevel, showGrid, selection, floatingSelection, brushSize,
  } = state;

  const [redrawNonce, setRedrawNonce] = useState(0);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const activeLayerCache = useRef<Layer | null>(null);
  const activeCtxCache = useRef<CanvasRenderingContext2D | null>(null);
  const selectionStartPoint = useRef<{ x: number; y: number } | null>(null);
  const [interactionMode, setInteractionMode] = useState<'idle' | 'selecting' | 'movingSelection'>('idle');
  const moveStartPoint = useRef<{ x: number; y: number } | null>(null);
  const clickOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

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

        const activeLayer = layers.find(l => l.id === activeLayerId);
        const rotation = activeLayer?.rotation ?? 0;

        let logicalX = canvasX / zoomLevel;
        let logicalY = canvasY / zoomLevel;

        if (rotation !== 0) {
            const centerX = canvasWidth / 2;
            const centerY = canvasHeight / 2;
            const translatedX = logicalX - centerX;
            const translatedY = logicalY - centerY;
            const inverseRotationInRadians = -rotation * Math.PI / 180;
            const cos = Math.cos(inverseRotationInRadians);
            const sin = Math.sin(inverseRotationInRadians);
            const rotatedX = translatedX * cos - translatedY * sin;
            const rotatedY = translatedX * sin + translatedY * cos;
            logicalX = rotatedX + centerX;
            logicalY = rotatedY + centerY;
        }

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
        for (let i = activeLayerIndex; i < layers.length; i++) {
            const layer = layers[i];
            if (layer.isVisible && layer.offscreenCanvas) {
                const ctx = layer.offscreenCanvas.getContext('2d');
                if (ctx) {
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
    if (!fillColorRgba) { return; }
    const fillColorForImageData: RgbaPixel = { r: fillColorRgba.r, g: fillColorRgba.g, b: fillColorRgba.b, a: Math.round(fillColorRgba.a * 255) };
    const imageData = ctx.getImageData(0, 0, canvasWidth, canvasHeight);
    const targetColor = getPixelFromImageData(imageData, startX, startY);
    if (!targetColor || areColorsEqual(targetColor, fillColorForImageData)) return;
    const queue: [number, number][] = [[startX, startY]];
    while (queue.length > 0) {
        if (queue.length > canvasWidth * canvasHeight * 4) { return; }
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

  
  const drawOverlay = useCallback((lineDashOffset = 0, tempRect: SelectionRect | null = null) => {
    const canvas = selectionCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const rectToDraw = tempRect || selection;

    if (rectToDraw && !floatingSelection) {
        const { x, y, width, height } = rectToDraw;
        ctx.save();
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 1;
        if (!tempRect) {
            ctx.setLineDash([4, 4]);
            ctx.lineDashOffset = -lineDashOffset;
        }
        ctx.strokeRect(x * zoomLevel, y * zoomLevel, width * zoomLevel, height * zoomLevel);
        if (!tempRect) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineDashOffset = 4 - lineDashOffset;
            ctx.strokeRect(x * zoomLevel, y * zoomLevel, width * zoomLevel, height * zoomLevel);
        }
        ctx.restore();
    }
    
    if (floatingSelection) {
        const { imageData, x, y } = floatingSelection;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageData.width;
        tempCanvas.height = imageData.height;
        tempCanvas.getContext('2d')?.putImageData(imageData, 0, 0);
        ctx.drawImage(tempCanvas, x * zoomLevel, y * zoomLevel, imageData.width * zoomLevel, imageData.height * zoomLevel);
    }
  }, [selectionCanvasRef, zoomLevel, selection, floatingSelection]);


  useEffect(() => {
    let animationFrameId: number;
    let lineDashOffset = 0;
    
    const animate = () => {
      if (interactionMode !== 'selecting') {
        lineDashOffset = (lineDashOffset + 0.25) % 8;
        drawOverlay(lineDashOffset);
      }
      animationFrameId = requestAnimationFrame(animate);
    };

    if (selection || floatingSelection) {
      animate();
    } else {
      drawOverlay(0);
    }

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [selection, floatingSelection, drawOverlay, interactionMode]);

  const handlePointerDown = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return;
    const coords = getLogicalCoords(event);
    const currentLayer = activeLayerCache.current;
    if (!coords || !currentLayer || currentLayer.isLocked) return;
    
    if (selectedTool === 'selection') {
        // If a selection is already floating, clicking anywhere stamps it down.
        if (floatingSelection) {
            dispatch({ type: 'STAMP_FLOATING_SELECTION' });
            return;
        }

        // Check if the click is inside an existing, finalized selection.
        if (selection && coords.x >= selection.x && coords.x < selection.x + selection.width &&
            coords.y >= selection.y && coords.y < selection.y + selection.height) {
            
            setInteractionMode('movingSelection');
            moveStartPoint.current = coords;
        } else {
            // Otherwise, start drawing a new selection.
            setInteractionMode('selecting');
            selectionStartPoint.current = coords;
            dispatch({ type: 'SET_SELECTION', rect: null });
        }
        return;
    }

    // Logic for other tools
    event.preventDefault();
    isDrawing.current = true;
    lastPoint.current = coords;
    const ctx = activeCtxCache.current;
    if (!ctx) return;
    ctx.save();
    switch (selectedTool) {
        case 'pencil':
            drawPixel(ctx, coords.x, coords.y, primaryColor, brushSize);
            break;
        case 'eraser':
            clearPixel(ctx, coords.x, coords.y, brushSize);
            break;
        case 'eyedropper':
            eyedropperSample(coords);
            isDrawing.current = false;
            break;
        case 'fill':
            floodFill(coords.x, coords.y);
            isDrawing.current = false;
            break;
    }
    if (selectedTool === 'pencil' || selectedTool === 'eraser') {
      setRedrawNonce(n => n + 1);
    }
  }, [
      getLogicalCoords, dispatch, activeLayerCache, selectedTool, 
      floatingSelection, selection, primaryColor, brushSize, 
      eyedropperSample, floodFill
  ]);

  const handlePointerMove = useCallback((event: PointerEvent) => {
      const coords = getLogicalCoords(event);
      dispatch({ type: 'SET_CURSOR_COORDS', coords: coords });

      // If we are in move mode and a selection is floating, update its position.
      if (interactionMode === 'movingSelection' && moveStartPoint.current && coords) {
        
        // If nothing is floating yet, this is the FIRST drag movement.
        if (!floatingSelection) {
            const dragThreshold = 2; // Prevents lifting on an accidental jiggle.
            const dx = Math.abs(coords.x - moveStartPoint.current.x);
            const dy = Math.abs(coords.y - moveStartPoint.current.y);

            // If the mouse has moved enough, "lift" the selection.
            if (dx >= dragThreshold || dy >= dragThreshold) {
                if (selection) {
                    // Calculate the offset based on the starting point and the selection box.
                    clickOffset.current = {
                        x: moveStartPoint.current.x - selection.x,
                        y: moveStartPoint.current.y - selection.y
                    };
                    
                    // LIFT and MOVE in the same event tick to avoid race conditions.
                    // This is the definitive fix for the "disappearing pixels" bug.
                    const newPosition = {
                        x: coords.x - clickOffset.current.x,
                        y: coords.y - clickOffset.current.y,
                    };
                    
                    // Dispatch BOTH actions. First, lift the pixels into the floating state...
                    dispatch({ type: 'LIFT_SELECTION', clearOriginal: false });
                    // ...and then immediately dispatch the first move to place it under the cursor.
                    dispatch({ type: 'MOVE_FLOATING_SELECTION', newPosition });
                }
            }
        } else {
            // A selection is already floating, so just update its position as we drag.
            const newPosition = {
                x: coords.x - clickOffset.current.x,
                y: coords.y - clickOffset.current.y,
            };
            dispatch({ type: 'MOVE_FLOATING_SELECTION', newPosition });
        }
        return;
      }
      
      // If we are drawing a new selection...
      if (interactionMode === 'selecting' && selectionStartPoint.current && coords) {
        const startX = Math.min(selectionStartPoint.current.x, coords.x);
        const startY = Math.min(selectionStartPoint.current.y, coords.y);
        const width = Math.abs(selectionStartPoint.current.x - coords.x);
        const height = Math.abs(selectionStartPoint.current.y - coords.y);
        const tempRect = { x: startX, y: startY, width: width, height: height };
        drawOverlay(0, tempRect);
        return;
      }

      // Logic for other tools
      if (!isDrawing.current || !lastPoint.current || !coords) return;
      const ctx = activeCtxCache.current;
      if (!ctx || (activeLayerCache.current?.isLocked)) return;

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
  }, [
      getLogicalCoords, dispatch, interactionMode, floatingSelection, 
      selectedTool, drawOverlay, primaryColor, pencilDraw, eraserDraw, activeCtxCache, activeLayerCache
  ]);

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
            }
        }
    } else {
        isDrawing.current = false;
        lastPoint.current = null;
    }
  }, [dispatch, activeLayerCache, activeCtxCache, selectedTool]);


  const handlePointerUp = useCallback((event: PointerEvent) => {
    if (event.button !== 0) return;

    if (interactionMode === 'movingSelection') {
        // If a selection was floating, stamp it. This completes the move.
        if (floatingSelection) {
            dispatch({ type: 'STAMP_FLOATING_SELECTION' });
        }
        setInteractionMode('idle');
        moveStartPoint.current = null;
        return;
    }

    if (interactionMode === 'selecting' && selectionStartPoint.current) {
        const upCoords = getLogicalCoords(event) || selectionStartPoint.current;
        const startX = Math.min(selectionStartPoint.current.x, upCoords.x);
        const startY = Math.min(selectionStartPoint.current.y, upCoords.y);
        let width = Math.abs(selectionStartPoint.current.x - upCoords.x);
        let height = Math.abs(selectionStartPoint.current.y - upCoords.y);

        if (width > 0 || height > 0) {
            dispatch({ type: 'SET_SELECTION', rect: { x: startX, y: startY, width, height } });
        } else {
            dispatch({ type: 'SET_SELECTION', rect: null });
        }
        setInteractionMode('idle');
        selectionStartPoint.current = null;
        return;
    }

    // Finalize drawing for other tools
    if (isDrawing.current) {
        const ctx = activeCtxCache.current;
        if (ctx) {
            ctx.restore();
            const layer = activeLayerCache.current;
            if (layer && layer.offscreenCanvas) {
                dispatch({type: 'UPDATE_LAYER_CANVAS', id: layer.id, canvas: layer.offscreenCanvas, dataURL: layer.offscreenCanvas.toDataURL()});
            }
        }
        isDrawing.current = false;
        lastPoint.current = null;
    }
  }, [getLogicalCoords, dispatch, interactionMode, floatingSelection]);

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
    const eventTarget = canvas;
    
    eventTarget.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    eventTarget.addEventListener('pointerleave', handlePointerLeave);
    eventTarget.addEventListener('wheel', handleWheelZoom, { passive: false });
    
    return () => {
      eventTarget.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      eventTarget.removeEventListener('pointerleave', handlePointerLeave);
      eventTarget.removeEventListener('wheel', handleWheelZoom);
    };
  }, [canvasRef, handlePointerDown, handlePointerMove, handlePointerUp, handlePointerLeave, handleWheelZoom]);


  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx || canvasWidth <= 0 || canvasHeight <= 0) return;

    canvas.width = canvasWidth * zoomLevel;
    canvas.height = canvasHeight * zoomLevel;
    ctx.imageSmoothingEnabled = false;
    
    const activeLayer = activeLayerCache.current;
    const isActiveLayerLocked = activeLayer?.isLocked ?? false;
    if (isActiveLayerLocked && selectedTool !== 'eyedropper') {
        canvas.style.cursor = 'not-allowed';
    } else {
        switch (selectedTool) {
            case 'pencil':
            case 'eraser':
            case 'fill':
                canvas.style.cursor = 'crosshair'; 
                break;
            case 'eyedropper': 
                canvas.style.cursor = 'copy'; 
                break;
            case 'selection':
                canvas.style.cursor = 'default';
                break;
            default: 
                canvas.style.cursor = 'default';
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawCheckerboard(ctx, canvas.width, canvas.height);
    
    for (let i = layers.length - 1; i >= 0; i--) {
        const layerToDraw = layers[i];
        if (layerToDraw && layerToDraw.isVisible && layerToDraw.offscreenCanvas) {
            ctx.globalAlpha = layerToDraw.opacity;
            ctx.drawImage(
                layerToDraw.offscreenCanvas,
                0, 0,
                canvasWidth, canvasHeight,
                0, 0,
                canvas.width, canvas.height
            );
        }
    }
    ctx.globalAlpha = 1.0;
    
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

  useEffect(() => {
    const canvas = selectionCanvasRef.current;
    if (canvas) {
        canvas.width = canvasWidth * zoomLevel;
        canvas.height = canvasHeight * zoomLevel;
        drawOverlay();
    }
  }, [canvasWidth, canvasHeight, zoomLevel, selectionCanvasRef, drawOverlay]);

}
