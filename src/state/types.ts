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
  cameraPitch?: number;
  clipboard: ClipboardLayerData | null;
  showGrid: boolean;
  cursorCoords: { x: number; y: number } | null;

  // --- Brush Size State ---
  brushSize: number; // e.g., 1 for 1x1, 2 for 2x2, etc.
  // --- End Brush Size State ---
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
  | { type: 'SET_CAMERA_PITCH'; pitch: number }
  | { type: 'COPY_LAYER' }
  | { type: 'CUT_LAYER' }
  | { type: 'PASTE_LAYER' }
  | { type: 'SHOW_NEW_PROJECT_MODAL' }
  | { type: 'TOGGLE_GRID' }
  | { type: 'SET_CURSOR_COORDS'; coords: { x: number; y: number } | null }

  // --- Brush Size Action ---
  | { type: 'SET_BRUSH_SIZE'; size: number };
  // --- End Brush Size Action ---
