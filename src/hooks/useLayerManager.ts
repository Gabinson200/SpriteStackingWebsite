// src/hooks/useLayerManager.ts
import type { Reducer } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { AppState, Layer, LayerAction, LayerDataForHistory, ClipboardLayerData, SerializableAppStateForLoad } from '../state/types';
import { createOffscreenCanvas } from '../utils/canvasUtils';

const MAX_HISTORY_SIZE = 50;

export const serializeLayersForHistory = (layers: Layer[]): LayerDataForHistory[] => {
    return layers.map(({ offscreenCanvas, ...rest }) => {
        const currentDataURL = offscreenCanvas ? offscreenCanvas.toDataURL() : rest.dataURL;
        return { ...rest, dataURL: currentDataURL, rotation: rest.rotation };
    });
};

const createInitialHistoryEntry = (layers: Layer[]): LayerDataForHistory[][] => {
    return [serializeLayersForHistory(layers)];
};

const DEFAULT_CAMERA_PITCH = -35.2644;
const DEFAULT_BRUSH_SIZE = 1;

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
  history: [],
  historyIndex: -1,
  cameraPitch: DEFAULT_CAMERA_PITCH,
  clipboard: null,
  showGrid: true,
  cursorCoords: null,
  brushSize: DEFAULT_BRUSH_SIZE,
  selection: null,
  floatingSelection: null,
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

// Helper function to rotate the canvas content
const rotateCanvasContent = (canvas: HTMLCanvasElement, rotation: number): HTMLCanvasElement => {
    const { width, height } = canvas;
    const rotatedCanvas = createOffscreenCanvas(width, height);
    const ctx = rotatedCanvas.getContext('2d');

    if (!ctx) {
        console.error("Could not get 2D context for rotation.");
        return canvas; // Return original canvas if context is not available
    }

    // Translate to the center of the canvas
    ctx.translate(width / 2, height / 2);
    // Rotate the context
    ctx.rotate(rotation * Math.PI / 180);
    // Draw the original canvas content onto the rotated context
    ctx.drawImage(canvas, -width / 2, -height / 2);

    return rotatedCanvas;
};


export const layerReducer: Reducer<AppState, LayerAction> = (state, action): AppState => {
  switch (action.type) {
    case 'SHOW_NEW_PROJECT_MODAL':
        return { ...initialAppState };

    case 'INIT_PROJECT': {
      const { width, height, layerCount } = action;
      const initialLayers: Layer[] = [];
      for (let i = 0; i < layerCount; i++) {
        const newCanvas = createOffscreenCanvas(width, height);
        initialLayers.push({
          id: uuidv4(), name: `Layer ${i + 1}`, isVisible: true, isLocked: false, opacity: 1.0,
          offscreenCanvas: newCanvas, dataURL: newCanvas.toDataURL(), rotation: 0, // Initialize rotation
        });
      }
      const reversedInitialLayers = initialLayers.reverse();
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
        const loadedState = action.state as SerializableAppStateForLoad; // Cast for easier access
        let reconstructedLayers: Layer[] = [];
        if (loadedState.layers && loadedState.canvasWidth && loadedState.canvasHeight) {
            reconstructedLayers = loadedState.layers.map(layerData => ({
                ...layerData,
                offscreenCanvas: null, // Mark for hydration
                rotation: layerData.rotation ?? 0, // Ensure rotation is loaded, default to 0
            } as Layer));
        }
        const historyFromLoad = loadedState.history
            ? loadedState.history.map(snapshot => snapshot.map(layerInHistory => ({ ...layerInHistory, rotation: layerInHistory.rotation ?? 0 }))) // Ensure history includes rotation
            : createInitialHistoryEntry(reconstructedLayers);
        const historyIndexFromLoad = loadedState.historyIndex !== undefined && loadedState.historyIndex !== null
            ? loadedState.historyIndex
            : (historyFromLoad.length > 0 ? historyFromLoad.length - 1 : -1);

        return {
            ...initialAppState,
            ...(loadedState as Partial<AppState>), // Spread known AppState compatible fields
            layers: reconstructedLayers,
            isInitialized: true,
            canvasWidth: loadedState.canvasWidth ?? initialAppState.canvasWidth,
            canvasHeight: loadedState.canvasHeight ?? initialAppState.canvasHeight,
            activeLayerId: loadedState.activeLayerId ?? reconstructedLayers[0]?.id ?? null,
            history: historyFromLoad,
            historyIndex: historyIndexFromLoad,
            cameraPitch: loadedState.cameraPitch ?? initialAppState.cameraPitch,
            clipboard: loadedState.clipboard ?? null,
            showGrid: loadedState.showGrid ?? initialAppState.showGrid,
            brushSize: loadedState.brushSize ?? initialAppState.brushSize,
            cursorCoords: null,
            selection: loadedState.selection ?? null,
        };
    }
    case 'ADD_LAYER': {
      if (!state.isInitialized) return state;
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
      const newCanvas = createOffscreenCanvas(state.canvasWidth, state.canvasHeight);
      const newLayer: Layer = {
        id: uuidv4(), name: `Layer ${state.layers.length + 1}`, isVisible: true, isLocked: false, opacity: 1.0,
        offscreenCanvas: newCanvas, dataURL: newCanvas.toDataURL(), rotation: 0, // Initialize rotation
      };
      const newLayers = [newLayer, ...state.layers];
      return { ...state, ...historyUpdate, layers: newLayers, activeLayerId: newLayer.id };
    }
    case 'DELETE_LAYER': {
      if (state.layers.length <= 1 && action.type === 'DELETE_LAYER') {
          alert("Cannot delete the last layer."); return state;
      }
      if (state.layers.length === 0) return state;
      const layerIdToDelete = action.id || state.activeLayerId;
      if (!layerIdToDelete || !state.layers.find(l => l.id === layerIdToDelete)) {
          return state;
      }
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
      const layersAfterDelete = state.layers.filter(layer => layer.id !== layerIdToDelete);
      let newActiveLayerId: string | null = state.activeLayerId;
      const deletedIndex = state.layers.findIndex(l => l.id === layerIdToDelete);
      if (state.activeLayerId === layerIdToDelete || layersAfterDelete.length === 0) {
           newActiveLayerId = layersAfterDelete[Math.max(0, deletedIndex -1)]?.id || layersAfterDelete[0]?.id || null;
      }
      return { ...state, ...historyUpdate, layers: layersAfterDelete, activeLayerId: newActiveLayerId };
    }
    case 'REORDER_LAYERS': {
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
        const { sourceIndex: D, destinationIndex: N } = action;
        const layers = Array.from(state.layers);
        const [removed] = layers.splice(D, 1);
        layers.splice(N, 0, removed);
        return { ...state, ...historyUpdate, layers };
    }
    case 'UPDATE_LAYER_CANVAS': {
      const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
      return {
        ...state, ...historyUpdate,
        layers: state.layers.map(layer =>
          layer.id === action.id ? { ...layer, offscreenCanvas: action.canvas, dataURL: action.dataURL } : layer
        ),
        selection: null, // Reset selection on canvas update
        floatingSelection: null, // Reset floating selection on canvas update
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
        const restoredLayers: Layer[] = historicalLayersData.map(data => ({ ...data, offscreenCanvas: null, rotation: data.rotation ?? 0 })); // Ensure rotation is restored
        return { ...state, layers: restoredLayers, historyIndex: newHistoryIndex,
            activeLayerId: state.activeLayerId && restoredLayers.find(l => l.id === state.activeLayerId) ? state.activeLayerId : restoredLayers[0]?.id || null,
        };
    }
    case 'REDO': {
        if (state.historyIndex >= state.history.length - 1 || state.historyIndex < 0) return state;
        const newHistoryIndex = state.historyIndex + 1;
        const historicalLayersData = state.history[newHistoryIndex];
        const restoredLayers: Layer[] = historicalLayersData.map(data => ({ ...data, offscreenCanvas: null, rotation: data.rotation ?? 0 })); // Ensure rotation is restored
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
            rotation: activeLayer.rotation, // Include rotation
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
            rotation: activeLayerToCut.rotation, // Include rotation
        };
        if (state.layers.length === 1) {
            alert("Copied last layer. Cannot cut the last layer.");
            return { ...state, clipboard: clipboardData };
        }
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
        const layersAfterCut = state.layers.filter(layer => layer.id !== state.activeLayerId);
        let newActiveLayerId: string | null = state.activeLayerId;
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
            offscreenCanvas: null, rotation: pastedLayerData.rotation ?? 0, // Include rotation, default to 0
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
    case 'SELECT_LAYER': return { ...state, activeLayerId: action.id, selection: null, floatingSelection: null };
    case 'SET_PRIMARY_COLOR': return { ...state, primaryColor: action.color };
    case 'SET_SELECTED_TOOL': return { ...state, selectedTool: action.tool };
    case 'SET_ZOOM_LEVEL': return { ...state, zoomLevel: action.level };
    case 'SET_PREVIEW_OFFSET': return { ...state, previewOffset: action.offset };
    case 'SET_PREVIEW_ROTATION': return { ...state, previewRotation: action.rotation };
    case 'TOGGLE_COLOR_PICKER': return { ...state, isColorPickerOpen: action.open ?? !state.isColorPickerOpen };
    case 'UNDO': {
        if (state.historyIndex <= 0) return state;
        const newHistoryIndex = state.historyIndex - 1;
        const historicalLayersData = state.history[newHistoryIndex];
        const restoredLayers: Layer[] = historicalLayersData.map(data => ({ ...data, offscreenCanvas: null, rotation: data.rotation ?? 0 })); // Ensure rotation is restored
        return { ...state, layers: restoredLayers, historyIndex: newHistoryIndex,
            activeLayerId: state.activeLayerId && restoredLayers.find(l => l.id === state.activeLayerId) ? state.activeLayerId : restoredLayers[0]?.id || null,
        };
    }
    case 'REDO': {
        if (state.historyIndex >= state.history.length - 1 || state.historyIndex < 0) return state;
        const newHistoryIndex = state.historyIndex + 1;
        const historicalLayersData = state.history[newHistoryIndex];
        const restoredLayers: Layer[] = historicalLayersData.map(data => ({ ...data, offscreenCanvas: null, rotation: data.rotation ?? 0 })); // Ensure rotation is restored
        return { ...state, layers: restoredLayers, historyIndex: newHistoryIndex,
            activeLayerId: state.activeLayerId && restoredLayers.find(l => l.id === state.activeLayerId) ? state.activeLayerId : restoredLayers[0]?.id || null,
        };
    }
    case 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS': {
        return { ...state, layers: state.layers.map(layer => layer.id === action.layerId ? { ...layer, offscreenCanvas: action.canvas } : layer ),
        };
    }
    case 'SET_CAMERA_PITCH': return { ...state, cameraPitch: action.pitch };
    case 'TOGGLE_GRID': return { ...state, showGrid: !state.showGrid };
    case 'SET_CURSOR_COORDS': return { ...state, cursorCoords: action.coords };
    case 'SET_BRUSH_SIZE':
        const newBrushSize = Math.max(1, Math.min(action.size, 32));
        return { ...state, brushSize: newBrushSize };

    case 'SET_SELECTION':
        // When setting a new selection, clear any floating selection data
        return { ...state, selection: action.rect, floatingSelection: null };

    // --- Handle Floating Selection Actions ---
    case 'LIFT_SELECTION': {
        if (!state.selection || !state.activeLayerId) return state;

        const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
        if (!activeLayer?.offscreenCanvas) return state;

        const ctx = activeLayer.offscreenCanvas.getContext('2d');
        if (!ctx) return state;

        // 1. Get the pixel data from the selected area
        const { x, y, width, height } = state.selection;
        const imageData = ctx.getImageData(x, y, width, height);

        // 2. Create the floating selection object
        const newFloatingSelection = { imageData, x, y, initialPosition: { x, y } };

        if (action.clearOriginal) { // This is a "cut" or "move" operation
            // 3a. Clear the area on the original canvas and push to history
            const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
            ctx.clearRect(x, y, width, height);
            const dataURL = activeLayer.offscreenCanvas.toDataURL(); // Get updated dataURL
            return {
                ...state,
                ...historyUpdate,
                floatingSelection: newFloatingSelection,
                selection: null, // Clear the "marching ants" selection rectangle
                layers: state.layers.map(l => l.id === activeLayer.id ? { ...l, dataURL } : l),
            };
        } else { // This is a "copy" operation
            // 3b. Don't modify the original canvas, just set the floating selection
            return {
                ...state,
                floatingSelection: newFloatingSelection,
                selection: null, // Clear the "marching ants" selection rectangle
            };
        }
    }

    case 'STAMP_FLOATING_SELECTION': {
        if (!state.floatingSelection || !state.activeLayerId) return state;

        const activeLayer = state.layers.find(l => l.id === state.activeLayerId);
        if (!activeLayer?.offscreenCanvas) return state;

        const ctx = activeLayer.offscreenCanvas.getContext('2d');
        if (!ctx) return state;

        // Take a history snapshot before stamping
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));

        // Draw the floating image data onto the active layer
        const { imageData, x, y } = state.floatingSelection;
        ctx.putImageData(imageData, x, y);

        const dataURL = activeLayer.offscreenCanvas.toDataURL();

        return {
            ...state,
            ...historyUpdate,
            floatingSelection: null, // Clear floating selection after stamping
            layers: state.layers.map(l => l.id === activeLayer.id ? { ...l, dataURL } : l),
        };
    }

    case 'MOVE_FLOATING_SELECTION': {
        if (!state.floatingSelection) return state;
        return {
            ...state,
            floatingSelection: {
                ...state.floatingSelection,
                x: action.newPosition.x,
                y: action.newPosition.y,
            },
        };
    }

    case 'CLEAR_FLOATING_SELECTION': {
        return { ...state, floatingSelection: null };
    }
    // ---
    case 'ROTATE_LEFT': {
        if (!state.activeLayerId) return state;
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
        const rotatedLayers = state.layers.map(layer => {
            if (layer.id === state.activeLayerId) {
                if (!layer.offscreenCanvas) return layer; // Cannot rotate if no canvas

                // Rotate the canvas content
                const newRotation = (layer.rotation - 90 + 360) % 360;
                const rotatedCanvas = rotateCanvasContent(layer.offscreenCanvas, -90); // Rotate content -90 degrees

                return {
                    ...layer,
                    rotation: newRotation,
                    offscreenCanvas: rotatedCanvas,
                    dataURL: rotatedCanvas.toDataURL() // Update data URL
                };
            }
            return layer;
        });
        return { ...state, ...historyUpdate, layers: rotatedLayers };
    }
    case 'ROTATE_RIGHT': {
        if (!state.activeLayerId) return state;
        const historyUpdate = pushToHistory(state, serializeLayersForHistory(state.layers));
        const rotatedLayers = state.layers.map(layer => {
            if (layer.id === state.activeLayerId) {
                 if (!layer.offscreenCanvas) return layer; // Cannot rotate if no canvas

                // Rotate the canvas content
                const newRotation = (layer.rotation + 90) % 360;
                const rotatedCanvas = rotateCanvasContent(layer.offscreenCanvas, 90); // Rotate content +90 degrees

                return {
                    ...layer,
                    rotation: newRotation,
                    offscreenCanvas: rotatedCanvas,
                    dataURL: rotatedCanvas.toDataURL() // Update data URL
                };
            }
            return layer;
        });
        return { ...state, ...historyUpdate, layers: rotatedLayers };
    }

    default:
      return state;
  }
};

function calculateInitialZoom(canvasWidth: number, canvasHeight: number): number {
    const maxDim = Math.max(canvasWidth, canvasHeight);
    if (maxDim <= 64) return 8; if (maxDim <= 128) return 4; if (maxDim <= 256) return 2; return 1;
}
