// src/state/types.ts

export type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill';

// Serializable part of a layer for history
export interface LayerDataForHistory {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  dataURL: string | undefined; // dataURL is crucial for history
}

export interface Layer extends LayerDataForHistory {
  offscreenCanvas: HTMLCanvasElement | null; // Can be null after undo/redo, before hydration
}

export interface AppState {
  isInitialized: boolean;
  canvasWidth: number;
  canvasHeight: number;
  layers: Layer[];
  activeLayerId: string | null;
  selectedTool: Tool;
  primaryColor: string;
  zoomLevel: number;
  previewOffset: { x: number; y: number };
  previewRotation: number;
  isColorPickerOpen: boolean;

  // --- Undo/Redo State ---
  history: LayerDataForHistory[][]; // Array of layer array snapshots
  historyIndex: number; // Pointer to current state in history. -1 if empty, 0 for first state.
                         // Max index is history.length - 1
  // --- End Undo/Redo State ---
}

export type LayerAction =
  | { type: 'INIT_PROJECT'; width: number; height: number; layerCount: number }
  | { type: 'LOAD_STATE'; state: Partial<AppState> } // LOAD_STATE might also bring history
  | { type: 'ADD_LAYER' }
  | { type: 'DELETE_LAYER'; id: string }
  | { type: 'SELECT_LAYER'; id: string }
  | { type: 'SET_LAYER_VISIBILITY'; id: string; isVisible: boolean }
  | { type: 'SET_LAYER_LOCK'; id: string; isLocked: boolean }
  | { type: 'SET_LAYER_OPACITY'; id: string; opacity: number }
  | { type: 'RENAME_LAYER'; id: string; name: string }
  | { type: 'REORDER_LAYERS'; sourceIndex: number; destinationIndex: number }
  | { type: 'UPDATE_LAYER_CANVAS'; id: string; canvas: HTMLCanvasElement; dataURL: string } // This will trigger history push
  | { type: 'SET_PRIMARY_COLOR'; color: string }
  | { type: 'SET_SELECTED_TOOL'; tool: Tool }
  | { type: 'SET_ZOOM_LEVEL'; level: number }
  | { type: 'SET_PREVIEW_OFFSET'; offset: { x: number; y: number } }
  | { type: 'SET_PREVIEW_ROTATION'; rotation: number }
  | { type: 'TOGGLE_COLOR_PICKER'; open?: boolean }
  // --- Undo/Redo Actions ---
  | { type: 'UNDO' }
  | { type: 'REDO' }
  // --- Internal action for canvas hydration after undo/redo ---
  // This action updates the offscreenCanvas object without affecting history
  | { type: 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS'; layerId: string; canvas: HTMLCanvasElement };
