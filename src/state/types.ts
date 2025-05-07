// src/state/types.ts

export type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill';

export interface LayerDataForHistory {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  dataURL: string | undefined;
}

export interface Layer extends LayerDataForHistory {
  offscreenCanvas: HTMLCanvasElement | null;
}

// --- Define Clipboard Content Type ---
// We'll store the full LayerDataForHistory, but generate a new ID on paste.
export type ClipboardLayerData = Omit<LayerDataForHistory, 'id'> & { originalId?: string };


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
  history: LayerDataForHistory[][];
  historyIndex: number;
  cameraPitch?: number; // Keep if you added this previously

  // --- Clipboard State ---
  clipboard: ClipboardLayerData | null; // Can hold one layer's data
  // --- End Clipboard State ---
}

export type LayerAction =
  | { type: 'INIT_PROJECT'; width: number; height: number; layerCount: number }
  | { type: 'LOAD_STATE'; state: Partial<AppState> }
  | { type: 'ADD_LAYER' }
  | { type: 'DELETE_LAYER'; id: string }
  | { type: 'SELECT_LAYER'; id: string }
  | { type: 'SET_LAYER_VISIBILITY'; id: string; isVisible: boolean }
  | { type: 'SET_LAYER_LOCK'; id: string; isLocked: boolean }
  | { type: 'SET_LAYER_OPACITY'; id: string; opacity: number }
  | { type: 'RENAME_LAYER'; id: string; name: string }
  | { type: 'REORDER_LAYERS'; sourceIndex: number; destinationIndex: number }
  | { type: 'UPDATE_LAYER_CANVAS'; id: string; canvas: HTMLCanvasElement; dataURL: string }
  | { type: 'SET_PRIMARY_COLOR'; color: string }
  | { type: 'SET_SELECTED_TOOL'; tool: Tool }
  | { type: 'SET_ZOOM_LEVEL'; level: number }
  | { type: 'SET_PREVIEW_OFFSET'; offset: { x: number; y: number } }
  | { type: 'SET_PREVIEW_ROTATION'; rotation: number }
  | { type: 'TOGGLE_COLOR_PICKER'; open?: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'INTERNAL_UPDATE_LAYER_OFFSCREEN_CANVAS'; layerId: string; canvas: HTMLCanvasElement }
  | { type: 'SET_CAMERA_PITCH'; pitch: number } // Keep if you added this

  // --- Copy/Paste/Cut Actions ---
  | { type: 'COPY_LAYER' }    // Copies the active layer to clipboard
  | { type: 'CUT_LAYER' }     // Copies active layer to clipboard and deletes it
  | { type: 'PASTE_LAYER' };  // Pastes layer from clipboard
  // --- End Copy/Paste/Cut Actions ---
