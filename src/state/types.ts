// src/state/types.ts
export type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill';

export interface Layer {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  opacity: number; // 0 to 1
  // We store the canvas element directly in state for easy access.
  // For localStorage, we'll need to serialize/deserialize its content.
  offscreenCanvas: HTMLCanvasElement | null;
  // Store a data URL representation for persistence and potentially faster thumbnail rendering
  dataURL?: string;
}

export interface AppState {
  isInitialized: boolean;
  canvasWidth: number;
  canvasHeight: number;
  layers: Layer[];
  activeLayerId: string | null;
  selectedTool: Tool;
  primaryColor: string; // Store as hex string (e.g., #RRGGBBAA or #RGB)
  zoomLevel: number;
  previewOffset: { x: number; y: number };
  previewRotation: number;
  // Add other transient UI states if needed
  isColorPickerOpen: boolean;
}

// Define action types for a potential reducer (used in useLayerManager)
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
  | { type: 'TOGGLE_COLOR_PICKER'; open?: boolean };