// src/App.tsx
import React, { useEffect, useCallback } from 'react';
import { useAppContext } from './state/AppContext';
import { StartupModal } from './components/StartupModal/StartupModal';
import { Toolbar } from './components/Toolbar/Toolbar';
import { LayerSidebar } from './components/LayerSidebar/LayerSidebar';
import { CanvasWorkspace } from './components/Canvas/CanvasWorkspace';
import { PreviewPanel } from './components/Preview/PreviewPanel';
import { ColorPicker } from './components/ColorPicker/ColorPicker';
import type { AppState, Layer, LayerDataForHistory, ClipboardLayerData } from './state/types'; // Added ClipboardLayerData
import { createOffscreenCanvas } from './utils/canvasUtils';
import { debounce } from 'lodash-es';
import { serializeLayersForHistory } from './hooks/useLayerManager';

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
  cameraPitch?: number; // Keep if present from previous steps
  // --- Add clipboard for persistence ---
  clipboard: ClipboardLayerData | null;
}

const LOCAL_STORAGE_KEY = 'spriteStackerState_v2_history_pitch_clipboard'; // Ensure this key is unique if state structure changed

function App() {
  const { state, dispatch } = useAppContext();
  const { isInitialized, layers, canvasWidth, canvasHeight } = state;

  // Load state from localStorage
  useEffect(() => {
    try {
      const savedStateString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateString) {
        const savedState: Partial<SerializableAppState> = JSON.parse(savedStateString);
        // Basic validation to ensure essential parts are present
        if (savedState.canvasWidth && savedState.canvasHeight && savedState.layers) {
           dispatch({ type: 'LOAD_STATE', state: savedState });
        } else {
            console.warn("Loaded state from localStorage is missing essential data, ignoring.");
        }
      }
    } catch (error) { console.error("Failed to load state from localStorage:", error); }
  }, [dispatch]);

  // Debounced function to save state
  const debouncedSaveState = useCallback(
    debounce((stateToSave: AppState) => {
      try {
        const serializableState: SerializableAppState = {
          canvasWidth: stateToSave.canvasWidth,
          canvasHeight: stateToSave.canvasHeight,
          layers: serializeLayersForHistory(stateToSave.layers), // Use helper
          activeLayerId: stateToSave.activeLayerId,
          primaryColor: stateToSave.primaryColor,
          zoomLevel: stateToSave.zoomLevel,
          previewOffset: stateToSave.previewOffset,
          previewRotation: stateToSave.previewRotation,
          history: stateToSave.history, // Save history directly
          historyIndex: stateToSave.historyIndex,
          cameraPitch: stateToSave.cameraPitch, // Save cameraPitch if it exists in AppState
          // --- Save clipboard ---
          clipboard: stateToSave.clipboard,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializableState));
        // console.log("State saved to localStorage.");
      } catch (error) { console.error("Failed to save state to localStorage:", error); }
    }, 1000),
    [] // No dependencies for the debounce function itself
  );

  // Save state to localStorage whenever relevant parts change
  useEffect(() => {
    if (state.isInitialized && state.canvasWidth > 0 && state.layers.length >= 0) { // Allow saving even if layers array is empty after a cut
        debouncedSaveState(state);
    }
    return () => { debouncedSaveState.cancel(); }; // Cleanup debounce on unmount
  }, [state, debouncedSaveState]); // Watch whole state for simplicity here


  // Canvas Hydration Effect (after Undo/Redo/Paste)
  useEffect(() => {
    if (!isInitialized || canvasWidth <= 0 || canvasHeight <= 0) return;

    layers.forEach(layer => {
      // If offscreenCanvas is null but dataURL exists, it needs hydration
      if (!layer.offscreenCanvas && layer.dataURL) {
        // console.log(`Hydrating layer: ${layer.name}`);
        const newCanvas = createOffscreenCanvas(canvasWidth, canvasHeight);
        const ctx = newCanvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, newCanvas.width, newCanvas.height); // Clear before drawing
            ctx.drawImage(img, 0, 0);
            // Dispatch internal action to update only the offscreenCanvas object
            dispatch({
              type: 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS',
              layerId: layer.id,
              canvas: newCanvas,
            });
            // console.log(`Finished hydrating layer: ${layer.name}`);
          };
          img.onerror = () => {
            console.error(`Error loading image for hydration for layer: ${layer.name}`);
            // Potentially dispatch an action to mark layer as errored or clear its dataURL
          };
          img.src = layer.dataURL;
        }
      }
    });
  // Watch layers array structure, and dimensions for creating new canvases
  }, [layers, canvasWidth, canvasHeight, dispatch, isInitialized]);


  // Keyboard Shortcuts for Undo/Redo & Copy/Paste/Cut
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isInitialized) return; // Don't handle shortcuts if modal is open

      // Check if focus is on an input field to avoid interfering with typing
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
          return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;

      // Undo/Redo with Arrow Keys (if not focused on input and no modifier)
      if (!ctrlOrCmd && !event.altKey && !event.shiftKey) {
          if (event.key === 'ArrowLeft') {
            event.preventDefault(); dispatch({ type: 'UNDO' }); return;
          } else if (event.key === 'ArrowRight') {
            event.preventDefault(); dispatch({ type: 'REDO' }); return;
          }
      }

      // Standard Shortcuts (Ctrl/Cmd + Z, Y, C, X, V)
      if (ctrlOrCmd) {
          switch (event.key.toLowerCase()) {
              case 'z':
                  event.preventDefault();
                  if (event.shiftKey) { // Redo (Cmd+Shift+Z on Mac, Ctrl+Shift+Z often also works on Win)
                      dispatch({ type: 'REDO' });
                  } else { // Undo
                      dispatch({ type: 'UNDO' });
                  }
                  break;
              case 'y': // Redo (typically Ctrl+Y on Windows)
                  if (!isMac) { // Only Ctrl+Y for non-Mac Redo
                      event.preventDefault();
                      dispatch({ type: 'REDO' });
                  }
                  break;
              case 'c': // Copy
                  event.preventDefault();
                  dispatch({ type: 'COPY_LAYER' });
                  break;
              case 'x': // Cut
                  event.preventDefault();
                  dispatch({ type: 'CUT_LAYER' });
                  break;
              case 'v': // Paste
                  event.preventDefault();
                  dispatch({ type: 'PASTE_LAYER' });
                  break;
              default:
                  // Allow other Ctrl/Cmd shortcuts to pass through
                  break;
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [dispatch, isInitialized]); // Add isInitialized to dependencies


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
