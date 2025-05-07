// src/App.tsx
import React, { useEffect, useCallback } from 'react';
import { useAppContext } from './state/AppContext';
import { StartupModal } from './components/StartupModal/StartupModal';
import { Toolbar } from './components/Toolbar/Toolbar';
import { LayerSidebar } from './components/LayerSidebar/LayerSidebar';
import { CanvasWorkspace } from './components/Canvas/CanvasWorkspace';
import { PreviewPanel } from './components/Preview/PreviewPanel';
import { ColorPicker } from './components/ColorPicker/ColorPicker';
import type { AppState, Layer, LayerDataForHistory } from './state/types'; // Use type import
import { createOffscreenCanvas } from './utils/canvasUtils';
import { debounce } from 'lodash-es';
// --- Import serializeLayersForHistory ---
import { serializeLayersForHistory } from './hooks/useLayerManager'; // Adjust path if necessary

// SerializableAppState needs to include history for localStorage
interface SerializableAppState {
  canvasWidth: number;
  canvasHeight: number;
  layers: LayerDataForHistory[];
  activeLayerId: string | null;
  primaryColor: string;
  zoomLevel: number;
  previewOffset: { x: number; y: number };
  previewRotation: number;
  history: LayerDataForHistory[][];
  historyIndex: number;
}

const LOCAL_STORAGE_KEY = 'spriteStackerState_v2_history';

function App() {
  const { state, dispatch } = useAppContext();
  const { isInitialized, layers, canvasWidth, canvasHeight } = state;

  // --- Persistence Logic ---
  useEffect(() => {
    try {
      const savedStateString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateString) {
        const savedState: Partial<SerializableAppState> = JSON.parse(savedStateString);
        if (savedState.canvasWidth && savedState.canvasHeight && savedState.layers) {
           dispatch({ type: 'LOAD_STATE', state: savedState });
        }
      }
    } catch (error) { console.error("Failed to load state from localStorage:", error); }
  }, [dispatch]);

  const debouncedSaveState = useCallback(
    debounce((stateToSave: AppState) => {
      try {
        const serializableState: SerializableAppState = {
          canvasWidth: stateToSave.canvasWidth,
          canvasHeight: stateToSave.canvasHeight,
          layers: serializeLayersForHistory(stateToSave.layers), // Now correctly referenced
          activeLayerId: stateToSave.activeLayerId,
          primaryColor: stateToSave.primaryColor,
          zoomLevel: stateToSave.zoomLevel,
          previewOffset: stateToSave.previewOffset,
          previewRotation: stateToSave.previewRotation,
          history: stateToSave.history,
          historyIndex: stateToSave.historyIndex,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializableState));
        // console.log("State saved to localStorage.");
      } catch (error) { console.error("Failed to save state to localStorage:", error); }
    }, 1000),
    [] // serializeLayersForHistory is stable, no need to add to deps if imported
  );

  useEffect(() => {
    if (state.isInitialized && state.canvasWidth > 0 && state.layers.length > 0) {
        debouncedSaveState(state);
    }
    return () => { debouncedSaveState.cancel(); };
  }, [state, debouncedSaveState]);


  // --- Canvas Hydration Effect ---
  useEffect(() => {
    if (!isInitialized || canvasWidth <= 0 || canvasHeight <= 0) return;

    layers.forEach(layer => {
      if (!layer.offscreenCanvas && layer.dataURL) {
        // console.log(`Hydrating layer: ${layer.name}`);
        const newCanvas = createOffscreenCanvas(canvasWidth, canvasHeight);
        const ctx = newCanvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, newCanvas.width, newCanvas.height);
            ctx.drawImage(img, 0, 0);
            dispatch({
              type: 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS',
              layerId: layer.id,
              canvas: newCanvas,
            });
            // console.log(`Finished hydrating layer: ${layer.name}`);
          };
          img.onerror = () => {
            console.error(`Error loading image for hydration for layer: ${layer.name}`);
          };
          img.src = layer.dataURL;
        }
      }
    });
  }, [layers, canvasWidth, canvasHeight, dispatch, isInitialized]);


  // --- Keyboard Shortcuts for Undo/Redo ---
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isInitialized) return;

      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        dispatch({ type: 'UNDO' });
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        dispatch({ type: 'REDO' });
      }
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      if (ctrlOrCmd && event.key.toLowerCase() === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
              dispatch({ type: 'REDO' });
          } else {
              dispatch({ type: 'UNDO' });
          }
      } else if (ctrlOrCmd && event.key.toLowerCase() === 'y' && !isMac) {
          event.preventDefault();
          dispatch({ type: 'REDO' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, isInitialized]);


  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-200 dark:bg-gray-800">
      {!isInitialized ? (
        <StartupModal isOpen={!isInitialized} />
      ) : (
        <>
          <Toolbar />
          <div className="flex flex-grow overflow-hidden">
            <PreviewPanel />
            <CanvasWorkspace />
            <LayerSidebar />
          </div>
          <ColorPicker />
        </>
      )}
    </div>
  );
}

export default App;
