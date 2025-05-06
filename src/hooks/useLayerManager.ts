// src/hooks/useLayerManager.ts
import type{ Reducer } from 'react';
import { v4 as uuidv4 } from 'uuid'; // Need to install uuid: npm install uuid @types/uuid
import type{ AppState, Layer, LayerAction, Tool } from '../state/types';
import { createOffscreenCanvas } from '../utils/canvasUtils';

// Define the initial state
export const initialAppState: AppState = {
  isInitialized: false,
  canvasWidth: 0,
  canvasHeight: 0,
  layers: [],
  activeLayerId: null,
  selectedTool: 'pencil',
  primaryColor: '#000000ff', // Black, fully opaque
  zoomLevel: 4, // Start with some zoom
  previewOffset: { x: 1, y: 1 }, // Default small offset
  previewRotation: 0,
  isColorPickerOpen: false,
};

// The main reducer function
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
          dataURL: newCanvas.toDataURL(), // Initial empty data URL
        });
      }
      return {
        ...initialAppState, // Reset most state
        isInitialized: true,
        canvasWidth: width,
        canvasHeight: height,
        layers: initialLayers.reverse(), // Typically layer 1 is on top visually
        activeLayerId: initialLayers[0]?.id || null, // Select the top layer
        zoomLevel: calculateInitialZoom(width, height), // Calculate a sensible zoom
      };
    }

    case 'LOAD_STATE': {
      // Carefully merge loaded state, recreating canvas elements
      const loadedState = action.state;
      const layers = (loadedState.layers ?? []).map(layerData => {
          const canvas = createOffscreenCanvas(loadedState.canvasWidth ?? 0, loadedState.canvasHeight ?? 0);
          if (layerData.dataURL && canvas.getContext('2d')) {
              const img = new Image();
              img.onload = () => {
                  canvas.getContext('2d')!.drawImage(img, 0, 0);
                  // Note: This happens async, might need a mechanism to signal redraw
              };
              img.src = layerData.dataURL;
          }
          return {
              ...layerData,
              offscreenCanvas: canvas, // Replace potentially non-existent canvas
          } as Layer; // Assert type after merging
      });

      return {
          ...initialAppState, // Start from defaults
          ...loadedState,    // Override with loaded data
          layers,            // Use the reconstructed layers
          isInitialized: true, // Mark as initialized
          // Ensure critical values exist
          canvasWidth: loadedState.canvasWidth ?? initialAppState.canvasWidth,
          canvasHeight: loadedState.canvasHeight ?? initialAppState.canvasHeight,
          activeLayerId: loadedState.activeLayerId ?? layers[0]?.id ?? null,
      };
  }


    case 'ADD_LAYER': {
      if (!state.isInitialized) return state;
      const newCanvas = createOffscreenCanvas(state.canvasWidth, state.canvasHeight);
      const newLayer: Layer = {
        id: uuidv4(),
        name: `Layer ${state.layers.length + 1}`,
        isVisible: true,
        isLocked: false,
        opacity: 1.0,
        offscreenCanvas: newCanvas,
        dataURL: newCanvas.toDataURL(),
      };
      // Add the new layer to the top (index 0)
      const newLayers = [newLayer, ...state.layers];
      return {
        ...state,
        layers: newLayers,
        activeLayerId: newLayer.id, // Select the new layer
      };
    }

    case 'DELETE_LAYER': {
      if (state.layers.length <= 1) return state; // Don't delete the last layer
      const layers = state.layers.filter(layer => layer.id !== action.id);
      let activeLayerId = state.activeLayerId;
      if (activeLayerId === action.id) {
        // If deleting the active layer, select the one below or the new top one
        const deletedIndex = state.layers.findIndex(l => l.id === action.id);
        activeLayerId = layers[deletedIndex]?.id || layers[0]?.id || null;
      }
      return { ...state, layers, activeLayerId };
    }

    case 'SELECT_LAYER':
      return { ...state, activeLayerId: action.id };

    case 'SET_LAYER_VISIBILITY':
      return {
        ...state,
        layers: state.layers.map(layer =>
          layer.id === action.id ? { ...layer, isVisible: action.isVisible } : layer
        ),
      };

    case 'SET_LAYER_LOCK':
        return {
            ...state,
            layers: state.layers.map(layer =>
            layer.id === action.id ? { ...layer, isLocked: action.isLocked } : layer
            ),
        };

    case 'SET_LAYER_OPACITY':
      return {
        ...state,
        layers: state.layers.map(layer =>
          layer.id === action.id ? { ...layer, opacity: action.opacity } : layer
        ),
      };

    case 'RENAME_LAYER':
        return {
          ...state,
          layers: state.layers.map(layer =>
            layer.id === action.id ? { ...layer, name: action.name } : layer
          ),
        };

    case 'REORDER_LAYERS': {
        const { sourceIndex, destinationIndex } = action;
        const layers = Array.from(state.layers);
        const [removed] = layers.splice(sourceIndex, 1);
        layers.splice(destinationIndex, 0, removed);
        return { ...state, layers };
    }

    case 'UPDATE_LAYER_CANVAS': {
        // This is crucial: update both the canvas object and its dataURL representation
        return {
          ...state,
          layers: state.layers.map(layer =>
            layer.id === action.id ? { ...layer, offscreenCanvas: action.canvas, dataURL: action.dataURL } : layer
          ),
        };
    }

    case 'SET_PRIMARY_COLOR':
      return { ...state, primaryColor: action.color };

    case 'SET_SELECTED_TOOL':
      return { ...state, selectedTool: action.tool };

    case 'SET_ZOOM_LEVEL':
      // Add constraints to zoom level if needed
      return { ...state, zoomLevel: Math.max(1, action.level) };

    case 'SET_PREVIEW_OFFSET':
      return { ...state, previewOffset: action.offset };

    case 'SET_PREVIEW_ROTATION':
       return { ...state, previewRotation: action.rotation };

    case 'TOGGLE_COLOR_PICKER':
        return { ...state, isColorPickerOpen: action.open ?? !state.isColorPickerOpen };

    default:
      return state;
  }
};

// Helper to calculate a reasonable initial zoom based on canvas size and screen space
function calculateInitialZoom(canvasWidth: number, canvasHeight: number): number {
    const maxDim = Math.max(canvasWidth, canvasHeight);
    // Try to fit the canvas within ~400px area initially
    if (maxDim <= 64) return 8;
    if (maxDim <= 128) return 4;
    if (maxDim <= 256) return 2;
    return 1; // Default to 1x for larger canvases
}

// Note: We don't export a hook `useLayerManager` directly.
// Instead, the reducer and initial state are used within AppContext.