// src/hooks/useLayerManager.ts
import { Reducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Layer, LayerAction, Tool, LayerDataForHistory } from '../state/types'; // Use type import
import { createOffscreenCanvas } from '../utils/canvasUtils';

const MAX_HISTORY_SIZE = 50; // Max number of undo steps

// Helper to serialize layers for history
export const serializeLayersForHistory = (layers: Layer[]): LayerDataForHistory[] => {
    return layers.map(({ offscreenCanvas, ...rest }) => {
        // Ensure dataURL is current if offscreenCanvas exists, otherwise use existing dataURL
        const currentDataURL = offscreenCanvas ? offscreenCanvas.toDataURL() : rest.dataURL;
        return { ...rest, dataURL: currentDataURL };
    });
};

// Helper to create an initial history entry
const createInitialHistoryEntry = (layers: Layer[]): LayerDataForHistory[][] => {
    return [serializeLayersForHistory(layers)];
};


export const initialAppState: AppState = {
  isInitialized: false,
  canvasWidth: 0,
  canvasHeight: 0,
  layers: [],
  activeLayerId: null,
  selectedTool: 'pencil',
  primaryColor: '#000000ff',
  zoomLevel: 4,
  previewOffset: { x: 1, y: 1 },
  previewRotation: 0,
  isColorPickerOpen: false,
  // --- Undo/Redo Initial State ---
  history: [],
  historyIndex: -1, // No history initially
};

// Function to add current state to history before a modification
const pushToHistory = (currentState: AppState, newLayersSnapshot: LayerDataForHistory[]): Pick<AppState, 'history' | 'historyIndex'> => {
    let newHistory = [...currentState.history];
    let newHistoryIndex = currentState.historyIndex;

    // If we have undone, and now make a new change, clear the "redo" stack
    if (newHistoryIndex < newHistory.length - 1) {
        newHistory = newHistory.slice(0, newHistoryIndex + 1);
    }

    // Add the new state
    newHistory.push(newLayersSnapshot);
    newHistoryIndex++;

    // Cap history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift(); // Remove the oldest entry
        newHistoryIndex--;   // Adjust index accordingly
    }
    return { history: newHistory, historyIndex: newHistoryIndex };
};


export const layerReducer: Reducer<AppState, LayerAction> = (state, action): AppState => {
  switch (action.type) {
    case 'INIT_PROJECT': {
      const { width, height, layerCount } = action;
      const initialLayers: Layer[] = [];
      for (let i = 0; i < layerCount; i++) {
        const newCanvas = createOffscreenCanvas(width, height);
        initialLayers.push({
          id: uuidv4(),
          name: `Layer ${i + 1}`,
          isVisible: true,
          isLocked: false,
          opacity: 1.0,
          offscreenCanvas: newCanvas,
          dataURL: newCanvas.toDataURL(),
        });
      }
      const reversedInitialLayers = initialLayers.reverse(); // Layer 1 on top
      return {
        ...initialAppState,
        isInitialized: true,
        canvasWidth: width,
        canvasHeight: height,
        layers: reversedInitialLayers,
        activeLayerId: reversedInitialLayers[0]?.id || null,
        zoomLevel: calculateInitialZoom(width, height),
        history: createInitialHistoryEntry(reversedInitialLayers),
        historyIndex: 0,
      };
    }

    case 'LOAD_STATE': {
        const loadedState = action.state;
        let reconstructedLayers: Layer[] = [];
        if (loadedState.layers && loadedState.canvasWidth && loadedState.canvasHeight) {
            reconstructedLayers = loadedState.layers.map(layerData => {
                const canvas = createOffscreenCanvas(loadedState.canvasWidth!, loadedState.canvasHeight!);
                // Note: Actual drawing from dataURL will be handled by hydration effect in App.tsx
                return {
                    ...layerData,
                    offscreenCanvas: canvas, // Fresh canvas, needs hydration
                } as Layer; // Assert type
            });
        }

        // If history is provided in loadedState, use it, otherwise create from current layers
        const historyFromLoad = loadedState.history && loadedState.historyIndex !== undefined
            ? loadedState.history
            : createInitialHistoryEntry(reconstructedLayers);
        const historyIndexFromLoad = loadedState.history && loadedState.historyIndex !== undefined
            ? loadedState.historyIndex
            : (historyFromLoad.length > 0 ? historyFromLoad.length - 1 : -1);


        return {
            ...initialAppState,
            ...loadedState,
            layers: reconstructedLayers,
            isInitialized: true,
            canvasWidth: loadedState.canvasWidth ?? initialAppState.canvasWidth,
            canvasHeight: loadedState.canvasHeight ?? initialAppState.canvasHeight,
            activeLayerId: loadedState.activeLayerId ?? reconstructedLayers[0]?.id ?? null,
            history: historyFromLoad as LayerDataForHistory[][], // Cast if loaded
            historyIndex: historyIndexFromLoad,
        };
    }

    case 'ADD_LAYER': {
      if (!state.isInitialized) return state;
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers)); // Snapshot before change

      const newCanvas = createOffscreenCanvas(state.canvasWidth, state.canvasHeight);
      const newLayer: Layer = {
        id: uuidv4(), name: `Layer ${state.layers.length + 1}`, isVisible: true, isLocked: false, opacity: 1.0,
        offscreenCanvas: newCanvas, dataURL: newCanvas.toDataURL(),
      };
      const newLayers = [newLayer, ...state.layers];
      return { ...state, ...historyUpdate, layers: newLayers, activeLayerId: newLayer.id };
    }

    case 'DELETE_LAYER': {
      if (state.layers.length <= 1) return state;
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));

      const layers = state.layers.filter(layer => layer.id !== action.id);
      let activeLayerId = state.activeLayerId;
      if (activeLayerId === action.id) {
        const deletedIndex = state.layers.findIndex(l => l.id === action.id);
        activeLayerId = layers[deletedIndex]?.id || layers[0]?.id || null;
      }
      return { ...state, ...historyUpdate, layers, activeLayerId };
    }

    case 'REORDER_LAYERS': {
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
        const { sourceIndex, destinationIndex } = action;
        const layers = Array.from(state.layers);
        const [removed] = layers.splice(sourceIndex, 1);
        layers.splice(destinationIndex, 0, removed);
        return { ...state, ...historyUpdate, layers };
    }

    case 'UPDATE_LAYER_CANVAS': {
      // Snapshot current state BEFORE this specific layer is updated
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));

      return {
        ...state,
        ...historyUpdate, // Apply new history state
        layers: state.layers.map(layer =>
          layer.id === action.id
            ? { ...layer, offscreenCanvas: action.canvas, dataURL: action.dataURL }
            : layer
        ),
      };
    }

    // Actions that modify layer properties but not canvas content directly
    // could also be made undoable by pushing to history.
    // For simplicity, focusing on UPDATE_LAYER_CANVAS for history.
    // If others are needed, add `pushToHistory` call.
    case 'SET_LAYER_VISIBILITY':
    case 'SET_LAYER_LOCK':
    case 'SET_LAYER_OPACITY':
    case 'RENAME_LAYER':
        // Example: Make RENAME_LAYER undoable
        // const historyUpdateForRename = pushToHistory(state, serializeLayersForHistory(state.layers));
        return {
            ...state,
            // ...historyUpdateForRename, // Uncomment if making this undoable
            layers: state.layers.map(layer => {
                if (layer.id === action.id) {
                    if (action.type === 'SET_LAYER_VISIBILITY') return { ...layer, isVisible: action.isVisible };
                    if (action.type === 'SET_LAYER_LOCK') return { ...layer, isLocked: action.isLocked };
                    if (action.type === 'SET_LAYER_OPACITY') return { ...layer, opacity: action.opacity };
                    if (action.type === 'RENAME_LAYER') return { ...layer, name: action.name };
                }
                return layer;
            }),
        };


    case 'UNDO': {
        if (state.historyIndex <= 0) return state; // Cannot undo if at the first state or no history
        const newHistoryIndex = state.historyIndex - 1;
        const historicalLayersData = state.history[newHistoryIndex];

        const restoredLayers: Layer[] = historicalLayersData.map(data => ({
            ...data,
            // Mark offscreenCanvas as null; it will be hydrated by an effect in App.tsx
            offscreenCanvas: null,
        }));

        return {
            ...state,
            layers: restoredLayers,
            historyIndex: newHistoryIndex,
            // Active layer might need to be restored if it's part of history snapshot
            // For now, keep current activeLayerId or select the first one
            activeLayerId: state.activeLayerId && restoredLayers.find(l => l.id === state.activeLayerId)
                           ? state.activeLayerId
                           : restoredLayers[0]?.id || null,
        };
    }

    case 'REDO': {
        if (state.historyIndex >= state.history.length - 1 || state.historyIndex < 0) {
            return state; // Cannot redo if at the latest state or no history
        }
        const newHistoryIndex = state.historyIndex + 1;
        const historicalLayersData = state.history[newHistoryIndex];

        const restoredLayers: Layer[] = historicalLayersData.map(data => ({
            ...data,
            offscreenCanvas: null, // Mark for hydration
        }));
        return {
            ...state,
            layers: restoredLayers,
            historyIndex: newHistoryIndex,
            activeLayerId: state.activeLayerId && restoredLayers.find(l => l.id === state.activeLayerId)
                           ? state.activeLayerId
                           : restoredLayers[0]?.id || null,
        };
    }

    case 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS': {
        // This action updates the offscreenCanvas object directly
        // and SHOULD NOT create a new history entry.
        return {
            ...state,
            layers: state.layers.map(layer =>
                layer.id === action.layerId
                    ? { ...layer, offscreenCanvas: action.canvas }
                    : layer
            ),
        };
    }

    // Non-history actions
    case 'SELECT_LAYER': return { ...state, activeLayerId: action.id };
    case 'SET_PRIMARY_COLOR': return { ...state, primaryColor: action.color };
    case 'SET_SELECTED_TOOL': return { ...state, selectedTool: action.tool };
    case 'SET_ZOOM_LEVEL': return { ...state, zoomLevel: action.level };
    case 'SET_PREVIEW_OFFSET': return { ...state, previewOffset: action.offset };
    case 'SET_PREVIEW_ROTATION': return { ...state, previewRotation: action.rotation };
    case 'TOGGLE_COLOR_PICKER': return { ...state, isColorPickerOpen: action.open ?? !state.isColorPickerOpen };

    default:
      return state;
  }
};

function calculateInitialZoom(canvasWidth: number, canvasHeight: number): number {
    const maxDim = Math.max(canvasWidth, canvasHeight);
    if (maxDim <= 64) return 8; if (maxDim <= 128) return 4; if (maxDim <= 256) return 2; return 1;
}
