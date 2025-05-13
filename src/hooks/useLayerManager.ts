// src/hooks/useLayerManager.ts
import { Reducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Layer, LayerAction, Tool, LayerDataForHistory, ClipboardLayerData } from '../state/types';
import { createOffscreenCanvas } from '../utils/canvasUtils';

const MAX_HISTORY_SIZE = 50;

export const serializeLayersForHistory = (layers: Layer[]): LayerDataForHistory[] => {
    return layers.map(({ offscreenCanvas, ...rest }) => {
        const currentDataURL = offscreenCanvas ? offscreenCanvas.toDataURL() : rest.dataURL;
        return { ...rest, dataURL: currentDataURL };
    });
};

const createInitialHistoryEntry = (layers: Layer[]): LayerDataForHistory[][] => {
    return [serializeLayersForHistory(layers)];
};

const DEFAULT_CAMERA_PITCH = -35.2644; // Or your preferred default
const DEFAULT_BRUSH_SIZE = 1; // Default brush size

export const initialAppState: AppState = {
  isInitialized: false, // This is key for showing the modal initially
  canvasWidth: 0,
  canvasHeight: 0,
  layers: [],
  activeLayerId: null,
  selectedTool: 'pencil',
  primaryColor: '#000000ff',
  zoomLevel: 4,
  previewOffset: { x: 1, y: 1 }, // User's provided default from previous snippet
  previewRotation: 0,
  isColorPickerOpen: false,
  history: [],
  historyIndex: -1,
  cameraPitch: DEFAULT_CAMERA_PITCH, // Initialize if you have this feature
  clipboard: null,
  showGrid: false,
  cursorCoords: null, // Logical coordinates on canvas
  brushSize: DEFAULT_BRUSH_SIZE, // Default brush size
};

const pushToHistory = (currentState: AppState, newLayersSnapshot: LayerDataForHistory[]): Pick<AppState, 'history' | 'historyIndex'> => {
    let newHistory = [...currentState.history];
    let newHistoryIndex = currentState.historyIndex;
    if (newHistoryIndex < newHistory.length - 1) {
        newHistory = newHistory.slice(0, newHistoryIndex + 1);
    }
    newHistory.push(newLayersSnapshot);
    newHistoryIndex++;
    if (newHistory.length > MAX_HISTORY_SIZE) {
        newHistory.shift();
        newHistoryIndex--;
    }
    return { history: newHistory, historyIndex: newHistoryIndex };
};

export const layerReducer: Reducer<AppState, LayerAction> = (state, action): AppState => {
  switch (action.type) {
    case 'SHOW_NEW_PROJECT_MODAL':
        // Reset the entire state to its initial uninitialized form
        // This will cause App.tsx to show the StartupModal
        return { ...initialAppState }; // isInitialized is false in initialAppState

    case 'INIT_PROJECT': {
      const { width, height, layerCount } = action;
      const initialLayers: Layer[] = [];
      for (let i = 0; i < layerCount; i++) {
        const newCanvas = createOffscreenCanvas(width, height);
        initialLayers.push({
          id: uuidv4(), name: `Layer ${i + 1}`, isVisible: true, isLocked: false, opacity: 1.0,
          offscreenCanvas: newCanvas, dataURL: newCanvas.toDataURL(),
        });
      }
      const reversedInitialLayers = initialLayers.reverse();
      // When initializing a project, ensure all other relevant fields are also set from a clean slate
      // but keep isInitialized true.
      return {
        ...initialAppState, // Start with all defaults (like cameraPitch, clipboard: null etc.)
        isInitialized: true, // This is the key difference from SHOW_NEW_PROJECT_MODAL
        canvasWidth: width,
        canvasHeight: height,
        layers: reversedInitialLayers,
        activeLayerId: reversedInitialLayers[0]?.id || null,
        zoomLevel: calculateInitialZoom(width, height),
        history: createInitialHistoryEntry(reversedInitialLayers),
        historyIndex: 0,
        // Explicitly carry over any non-project specific settings if needed,
        // or ensure initialAppState has suitable defaults.
      };
    }

    case 'LOAD_STATE': {
        const loadedState = action.state;
        let reconstructedLayers: Layer[] = [];
        if (loadedState.layers && loadedState.canvasWidth && loadedState.canvasHeight) {
            reconstructedLayers = loadedState.layers.map(layerData => ({
                ...layerData,
                offscreenCanvas: null, // Mark for hydration
            } as Layer));
        }
        const historyFromLoad = loadedState.history && loadedState.historyIndex !== undefined
            ? loadedState.history.map(snapshot => snapshot.map(layerInHistory => ({ ...layerInHistory }))) // Deep copy history
            : createInitialHistoryEntry(reconstructedLayers);
        const historyIndexFromLoad = loadedState.history && loadedState.historyIndex !== undefined
            ? loadedState.historyIndex : (historyFromLoad.length > 0 ? historyFromLoad.length - 1 : -1);
        return {
            ...initialAppState, // Start with defaults
            ...loadedState,    // Override with loaded data
            layers: reconstructedLayers,
            isInitialized: true, // Mark as initialized after loading
            canvasWidth: loadedState.canvasWidth ?? initialAppState.canvasWidth,
            canvasHeight: loadedState.canvasHeight ?? initialAppState.canvasHeight,
            activeLayerId: loadedState.activeLayerId ?? reconstructedLayers[0]?.id ?? null,
            history: historyFromLoad as LayerDataForHistory[][],
            historyIndex: historyIndexFromLoad,
            cameraPitch: loadedState.cameraPitch ?? initialAppState.cameraPitch,
            clipboard: loadedState.clipboard ?? null,
            showGrid: loadedState.showGrid ?? initialAppState.showGrid,
            brushSize: loadedState.brushSize ?? initialAppState.brushSize,
            cursorCoords: null,
        };
    }

    // ... (ADD_LAYER, DELETE_LAYER, REORDER_LAYERS, UPDATE_LAYER_CANVAS - same as before) ...
    case 'ADD_LAYER': {
      if (!state.isInitialized) return state;
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
      const newCanvas = createOffscreenCanvas(state.canvasWidth, state.canvasHeight);
      const newLayer: Layer = {
        id: uuidv4(), name: `Layer ${state.layers.length + 1}`, isVisible: true, isLocked: false, opacity: 1.0,
        offscreenCanvas: newCanvas, dataURL: newCanvas.toDataURL(),
      };
      const newLayers = [newLayer, ...state.layers];
      return { ...state, ...historyUpdate, layers: newLayers, activeLayerId: newLayer.id };
    }
    case 'DELETE_LAYER': {
      if (state.layers.length <= 1 && action.type === 'DELETE_LAYER') {
          alert("Cannot delete the last layer.");
          return state;
      }
      if (state.layers.length === 0) return state;
      const layerIdToDelete = action.id || state.activeLayerId;
      if (!layerIdToDelete || !state.layers.find(l => l.id === layerIdToDelete)) {
          console.warn("DELETE_LAYER: Layer to delete not found:", layerIdToDelete);
          return state;
      }
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
      const layersAfterDelete = state.layers.filter(layer => layer.id !== layerIdToDelete);
      let newActiveLayerId = state.activeLayerId;
      if (state.activeLayerId === layerIdToDelete || layersAfterDelete.length === 0) {
          const deletedIndex = state.layers.findIndex(l => l.id === layerIdToDelete);
          newActiveLayerId = layersAfterDelete[Math.max(0, deletedIndex -1)]?.id || layersAfterDelete[0]?.id || null;
      }
      return { ...state, ...historyUpdate, layers: layersAfterDelete, activeLayerId: newActiveLayerId };
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
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
      return {
        ...state, ...historyUpdate,
        layers: state.layers.map(layer =>
          layer.id === action.id ? { ...layer, offscreenCanvas: action.canvas, dataURL: action.dataURL } : layer
        ),
      };
    }


    case 'SET_LAYER_VISIBILITY':
    case 'SET_LAYER_LOCK':
    case 'SET_LAYER_OPACITY':
    case 'RENAME_LAYER':
        return { ...state, layers: state.layers.map(layer => {
                if (layer.id === action.id) {
                    if (action.type === 'SET_LAYER_VISIBILITY') return { ...layer, isVisible: action.isVisible };
                    if (action.type === 'SET_LAYER_LOCK') return { ...layer, isLocked: action.isLocked };
                    if (action.type === 'SET_LAYER_OPACITY') return { ...layer, opacity: action.opacity };
                    if (action.type === 'RENAME_LAYER') return { ...layer, name: action.name };
                } return layer;
            }),
        };

    case 'UNDO': {
        if (state.historyIndex <= 0) return state;
        const newHistoryIndex = state.historyIndex - 1;
        const historicalLayersData = state.history[newHistoryIndex];
        const restoredLayers: Layer[] = historicalLayersData.map(data => ({ ...data, offscreenCanvas: null }));
        return { ...state, layers: restoredLayers, historyIndex: newHistoryIndex,
            activeLayerId: state.activeLayerId && restoredLayers.find(l => l.id === state.activeLayerId) ? state.activeLayerId : restoredLayers[0]?.id || null,
        };
    }
    case 'REDO': {
        if (state.historyIndex >= state.history.length - 1 || state.historyIndex < 0) return state;
        const newHistoryIndex = state.historyIndex + 1;
        const historicalLayersData = state.history[newHistoryIndex];
        const restoredLayers: Layer[] = historicalLayersData.map(data => ({ ...data, offscreenCanvas: null }));
        return { ...state, layers: restoredLayers, historyIndex: newHistoryIndex,
            activeLayerId: state.activeLayerId && restoredLayers.find(l => l.id === state.activeLayerId) ? state.activeLayerId : restoredLayers[0]?.id || null,
        };
    }
    case 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS': {
        return { ...state, layers: state.layers.map(layer => layer.id === action.layerId ? { ...layer, offscreenCanvas: action.canvas } : layer ),
        };
    }

    case 'COPY_LAYER': {
        if (!state.activeLayerId) return state;
        const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
        if (!activeLayer) return state;
        const dataURLToCopy = activeLayer.offscreenCanvas ? activeLayer.offscreenCanvas.toDataURL() : activeLayer.dataURL;
        const clipboardData: ClipboardLayerData = {
            name: `${activeLayer.name} Copy`, isVisible: activeLayer.isVisible, isLocked: false,
            opacity: activeLayer.opacity, dataURL: dataURLToCopy, originalId: activeLayer.id,
        };
        return { ...state, clipboard: clipboardData };
    }

    case 'CUT_LAYER': {
        if (!state.activeLayerId) return state;
        const activeLayerToCut = state.layers.find(l => l.id === state.activeLayerId);
        if (!activeLayerToCut) return state;
        const dataURLToCopy = activeLayerToCut.offscreenCanvas ? activeLayerToCut.offscreenCanvas.toDataURL() : activeLayerToCut.dataURL;
        const clipboardData: ClipboardLayerData = {
            name: activeLayerToCut.name, isVisible: activeLayerToCut.isVisible, isLocked: false,
            opacity: activeLayerToCut.opacity, dataURL: dataURLToCopy, originalId: activeLayerToCut.id,
        };
        if (state.layers.length === 1) {
            alert("Copied last layer. Cannot cut the last layer.");
            return { ...state, clipboard: clipboardData };
        }
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
        const layersAfterCut = state.layers.filter(layer => layer.id !== state.activeLayerId);
        let newActiveLayerId = state.activeLayerId;
        const deletedIndex = state.layers.findIndex(l => l.id === state.activeLayerId);
        if (state.activeLayerId === activeLayerToCut.id || layersAfterCut.length === 0) {
             newActiveLayerId = layersAfterCut[Math.max(0, deletedIndex -1)]?.id || layersAfterCut[0]?.id || null;
        }
        return { ...state, ...historyUpdate, layers: layersAfterCut, activeLayerId: newActiveLayerId, clipboard: clipboardData };
    }

    case 'PASTE_LAYER': {
        if (!state.clipboard || !state.isInitialized) return state;
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
        const newLayerId = uuidv4();
        const pastedLayerData = state.clipboard;
        let newLayerName = pastedLayerData.name || "Pasted Layer";
        let copyCount = 1;
        const baseName = newLayerName.replace(/ Copy( \d+)?$/, "");
        while (state.layers.some(l => l.name === newLayerName)) {
            newLayerName = `${baseName} Copy ${copyCount++}`;
        }
        const newPastedLayer: Layer = {
            id: newLayerId, name: newLayerName, isVisible: pastedLayerData.isVisible,
            isLocked: false, opacity: pastedLayerData.opacity, dataURL: pastedLayerData.dataURL,
            offscreenCanvas: null,
        };
        let insertAtIndex = 0;
        if (state.activeLayerId) {
            const activeIdx = state.layers.findIndex(l => l.id === state.activeLayerId);
            if (activeIdx !== -1) {
                insertAtIndex = activeIdx;
            }
        }
        const newLayers = [ ...state.layers.slice(0, insertAtIndex), newPastedLayer, ...state.layers.slice(insertAtIndex) ];
        return { ...state, ...historyUpdate, layers: newLayers, activeLayerId: newLayerId };
    }

    case 'SELECT_LAYER': return { ...state, activeLayerId: action.id };
    case 'SET_PRIMARY_COLOR': return { ...state, primaryColor: action.color };
    case 'SET_SELECTED_TOOL': return { ...state, selectedTool: action.tool };
    case 'SET_ZOOM_LEVEL': return { ...state, zoomLevel: action.level };
    case 'SET_PREVIEW_OFFSET': return { ...state, previewOffset: action.offset };
    case 'SET_PREVIEW_ROTATION': return { ...state, previewRotation: action.rotation };
    case 'TOGGLE_COLOR_PICKER': return { ...state, isColorPickerOpen: action.open ?? !state.isColorPickerOpen };
    case 'SET_CAMERA_PITCH': return { ...state, cameraPitch: action.pitch };
    case 'TOGGLE_GRID': return { ...state, showGrid: !state.showGrid };
    case 'SET_CURSOR_COORDS': return { ...state, cursorCoords: action.coords };

    case 'SET_BRUSH_SIZE': 
        const newBrushSize = Math.max(1, Math.min(32, action.size)); // Clamp between 1 and 32
        return { ...state, brushSize: newBrushSize };
        
    default:
      return state;
  }
};

function calculateInitialZoom(canvasWidth: number, canvasHeight: number): number {
    const maxDim = Math.max(canvasWidth, canvasHeight);
    if (maxDim <= 64) return 8; if (maxDim <= 128) return 4; if (maxDim <= 256) return 2; return 1;
}
