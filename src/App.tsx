// src/App.tsx
import { useEffect, useCallback } from 'react'; // React import removed as it's not directly used
import { useAppContext } from './state/AppContext';
import { StartupModal } from './components/StartupModal/StartupModal';
import { Toolbar } from './components/Toolbar/Toolbar';
import { LayerSidebar } from './components/LayerSidebar/LayerSidebar';
import { CanvasWorkspace } from './components/Canvas/CanvasWorkspace';
import { PreviewPanel } from './components/Preview/PreviewPanel';
import { ColorPicker } from './components/ColorPicker/ColorPicker';
// Ensure all imported types are used or are type-only imports
import type { AppState, LayerDataForHistory, ClipboardLayerData, SerializableAppStateForLoad } from './state/types';
import { createOffscreenCanvas } from './utils/canvasUtils';
import { debounce } from 'lodash-es';
import { serializeLayersForHistory } from './hooks/useLayerManager';

// This interface defines the structure of the data saved to/loaded from localStorage.
// It omits transient UI states that shouldn't be persisted.
interface SerializableAppStateForStorage extends Omit<AppState,
    'layers' | // layers are serialized by serializeLayersForHistory
    'isInitialized' | // This is runtime state, not persisted
    'history' | // history is serialized separately if needed, or handled by its own structure
    'cursorCoords' | // Transient UI state
    'isColorPickerOpen' // Transient UI state
> {
  layers: LayerDataForHistory[]; // Serialized layer data
  history: LayerDataForHistory[][]; // Serialized history
  // Ensure all other AppState fields that need to be persisted are explicitly included here
  // if not covered by Omit or if their serialized form is different.
  clipboard: ClipboardLayerData | null;
  cameraPitch?: number;
  showGrid: boolean;
  brushSize: number;
}

const LOCAL_STORAGE_KEY = 'spriteStackerState_v2_history_pitch_clipboard';

function App() {
  const { state, dispatch } = useAppContext();
  const { isInitialized, layers, canvasWidth, canvasHeight } = state;

  // Load state from localStorage
  useEffect(() => {
    try {
      const savedStateString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateString) {
        // Data from localStorage is parsed according to SerializableAppStateForStorage
        const savedState = JSON.parse(savedStateString) as SerializableAppStateForStorage;
        if (savedState.canvasWidth && savedState.canvasHeight && savedState.layers) {
           // The 'state' property of LOAD_STATE action expects SerializableAppStateForLoad.
           // Ensure the loaded 'savedState' is compatible or transformed.
           const stateToLoad: SerializableAppStateForLoad = {
                ...savedState, // Spread all compatible fields
                // layers and history are already in the correct LayerDataForHistory format
           };
           dispatch({ type: 'LOAD_STATE', state: stateToLoad });
        }
      }
    } catch (error) { console.error("Failed to load state from localStorage:", error); }
  }, [dispatch]);

  // Debounced function to save state
  const debouncedSaveState = useCallback(
    debounce((stateToSave: AppState) => {
      try {
        // Data for localStorage is structured according to SerializableAppStateForStorage
        const serializableState: SerializableAppStateForStorage = {
          canvasWidth: stateToSave.canvasWidth,
          canvasHeight: stateToSave.canvasHeight,
          layers: serializeLayersForHistory(stateToSave.layers),
          activeLayerId: stateToSave.activeLayerId,
          selectedTool: stateToSave.selectedTool,
          primaryColor: stateToSave.primaryColor,
          zoomLevel: stateToSave.zoomLevel,
          previewOffset: stateToSave.previewOffset,
          previewRotation: stateToSave.previewRotation,
          cameraPitch: stateToSave.cameraPitch,
          history: stateToSave.history,
          historyIndex: stateToSave.historyIndex,
          clipboard: stateToSave.clipboard,
          showGrid: stateToSave.showGrid,
          brushSize: stateToSave.brushSize,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializableState));
      } catch (error) { console.error("Failed to save state to localStorage:", error); }
    }, 1000),
    []
  );

  // Save state to localStorage whenever relevant parts change
  useEffect(() => {
    if (state.isInitialized && state.canvasWidth > 0 && state.layers.length >= 0) {
        debouncedSaveState(state);
    }
    return () => { debouncedSaveState.cancel(); };
  }, [state, debouncedSaveState]);

  // Canvas Hydration Effect
  useEffect(() => {
    if (!isInitialized || canvasWidth <= 0 || canvasHeight <= 0) return;
    layers.forEach(layer => {
      if (!layer.offscreenCanvas && layer.dataURL) {
        const newCanvas = createOffscreenCanvas(canvasWidth, canvasHeight);
        const ctx = newCanvas.getContext('2d');
        if (ctx) {
          const img = new Image();
          img.onload = () => {
            ctx.clearRect(0, 0, newCanvas.width, newCanvas.height); ctx.drawImage(img, 0, 0);
            dispatch({ type: 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS', layerId: layer.id, canvas: newCanvas });
          };
          img.onerror = () => console.error(`Error hydrating layer: ${layer.name}`);
          img.src = layer.dataURL;
        }
      }
    });
  }, [layers, canvasWidth, canvasHeight, dispatch, isInitialized]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isInitialized) return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;
      if (!event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey) {
        if (event.key === 'ArrowLeft') { event.preventDefault(); dispatch({ type: 'UNDO' }); return; }
        else if (event.key === 'ArrowRight') { event.preventDefault(); dispatch({ type: 'REDO' }); return; }
      }
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? event.metaKey : event.ctrlKey;
      if (ctrlOrCmd) {
          switch (event.key.toLowerCase()) {
              case 'z': event.preventDefault(); if (event.shiftKey) { dispatch({ type: 'REDO' }); } else { dispatch({ type: 'UNDO' }); } break;
              case 'y': if (!isMac) { event.preventDefault(); dispatch({ type: 'REDO' }); } break;
              case 'c': event.preventDefault(); dispatch({ type: 'COPY_LAYER' }); break;
              case 'x': event.preventDefault(); dispatch({ type: 'CUT_LAYER' }); break;
              case 'v': event.preventDefault(); dispatch({ type: 'PASTE_LAYER' }); break;
          }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, isInitialized]);

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-200 dark:bg-gray-800">
      {!isInitialized ? <StartupModal isOpen={!isInitialized} /> : (
        <>
          <Toolbar />
          <div className="flex flex-grow overflow-hidden">
            <PreviewPanel /> <CanvasWorkspace /> <LayerSidebar />
          </div>
          <ColorPicker />
        </>
      )}
    </div>
  );
}
export default App;
