// src/App.tsx
import React, { useEffect, useCallback } from 'react';
import { useAppContext } from './state/AppContext';
import { StartupModal } from './components/StartupModal/StartupModal';
import { Toolbar } from './components/Toolbar/Toolbar';
import { LayerSidebar } from './components/LayerSidebar/LayerSidebar';
import { CanvasWorkspace } from './components/Canvas/CanvasWorkspace';
import { PreviewPanel } from './components/Preview/PreviewPanel';
import { ColorPicker } from './components/ColorPicker/ColorPicker';
import type{ Layer } from './state/types'; // Import Layer type
import { debounce } from 'lodash-es'; // For debouncing localStorage writes: npm install lodash-es @types/lodash-es

// Define the structure of the state we want to save
interface SerializableAppState {
  canvasWidth: number;
  canvasHeight: number;
  layers: Omit<Layer, 'offscreenCanvas'>[]; // Save everything except the canvas element
  activeLayerId: string | null;
  primaryColor: string;
  zoomLevel: number;
  previewOffset: { x: number; y: number };
  previewRotation: number;
  // isInitialized doesn't need to be saved/loaded directly
}

const LOCAL_STORAGE_KEY = 'spriteStackerState_v1';

function App() {
  const { state, dispatch } = useAppContext();
  const { isInitialized, isColorPickerOpen } = state;

  // --- Persistence Logic ---

  // Load state from localStorage on initial mount
  useEffect(() => {
    console.log("Attempting to load state from localStorage...");
    try {
      const savedStateString = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedStateString) {
        const savedState: Partial<SerializableAppState> = JSON.parse(savedStateString);
        console.log("Found saved state:", savedState);

        // Basic validation before attempting to load
        if (savedState.canvasWidth && savedState.canvasHeight && savedState.layers) {
           // Dispatch LOAD_STATE with the partial data.
           // The reducer needs to handle reconstructing canvases from dataURLs.
           dispatch({ type: 'LOAD_STATE', state: savedState });
           console.log("Dispatched LOAD_STATE action.");
        } else {
            console.log("Saved state is missing essential data, ignoring.");
        }
      } else {
          console.log("No saved state found.");
      }
    } catch (error) {
      console.error("Failed to load or parse state from localStorage:", error);
      // Optionally clear corrupted storage
      // localStorage.removeItem(LOCAL_STORAGE_KEY);
    }
    // This effect should only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]); // Added dispatch dependency


  // Debounced function to save state
  const debouncedSaveState = useCallback(
    debounce((stateToSave: AppState) => {
      try {
        // Create a serializable version of the state
        const serializableState: SerializableAppState = {
          canvasWidth: stateToSave.canvasWidth,
          canvasHeight: stateToSave.canvasHeight,
          // IMPORTANT: Map layers to exclude the offscreenCanvas object
          layers: stateToSave.layers.map(({ offscreenCanvas, ...rest }) => rest),
          activeLayerId: stateToSave.activeLayerId,
          primaryColor: stateToSave.primaryColor,
          zoomLevel: stateToSave.zoomLevel,
          previewOffset: stateToSave.previewOffset,
          previewRotation: stateToSave.previewRotation,
        };
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(serializableState));
        console.log("State saved to localStorage.");
      } catch (error) {
        console.error("Failed to save state to localStorage:", error);
        // Handle potential storage quota errors?
      }
    }, 1000), // Debounce saving by 1 second
    [] // No dependencies, the function itself doesn't change
  );

  // Save state to localStorage whenever relevant parts change
  useEffect(() => {
    // Only save if the project has been initialized and there's data
    if (state.isInitialized && state.canvasWidth > 0 && state.layers.length > 0) {
        console.log("State changed, queuing save...");
        // Pass the current state to the debounced function
        debouncedSaveState(state);
    }
    // Clean up debounce timer on unmount
    return () => {
        debouncedSaveState.cancel();
    };
    // Watch all the state properties we want to persist
  }, [
      state.isInitialized,
      state.canvasWidth,
      state.canvasHeight,
      state.layers, // Be mindful: This triggers on any layer change, including canvas updates
      state.activeLayerId,
      state.primaryColor,
      state.zoomLevel,
      state.previewOffset,
      state.previewRotation,
      debouncedSaveState, // Include the debounced function itself
      state // Watching the whole state object might be simpler if dependencies are many
    ]);

  // --- Render Logic ---

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-200 dark:bg-gray-800">
      {!isInitialized ? (
        <StartupModal isOpen={!isInitialized} />
      ) : (
        // Main Workspace Layout
        <>
          {/* Top Toolbar */}
          <Toolbar />

          {/* Main Content Area (Panels) */}
          <div className="flex flex-grow overflow-hidden">
            {/* Left Panel: Preview */}
            <PreviewPanel />

            {/* Center Panel: Canvas */}
            <CanvasWorkspace />

            {/* Right Panel: Layers */}
            <LayerSidebar />
          </div>

          {/* Color Picker Modal (rendered conditionally on top) */}
          <ColorPicker />
        </>
      )}
    </div>
  );
}

export default App;