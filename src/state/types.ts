// src/state/types.ts

export type Tool = 'pencil' | 'eraser' | 'eyedropper' | 'fill';

export interface LayerDataForHistory {
  id: string;
  name: string;
  isVisible: boolean;
  isLocked: boolean;
  opacity: number;
  dataURL: string | undefined;
  rotation: number; // Added rotation property
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
  previewRotation: number; // This seems to be for the overall preview object rotation
  isColorPickerOpen: boolean;
  history: LayerDataForHistory[][];
  historyIndex: number;
  cameraPitch?: number;
  clipboard: ClipboardLayerData | null;
  showGrid: boolean;
  cursorCoords: { x: number; y: number } | null;
  brushSize: number;
}

// This interface is used for the payload of the LOAD_STATE action.
// It reflects the structure of data coming from a file or localStorage
// before it's fully processed by the reducer into the AppState.
export interface SerializableAppStateForLoad extends Omit<Partial<AppState>, 'layers' | 'history'> {
    layers?: LayerDataForHistory[]; // Layers are initially just data
    history?: LayerDataForHistory[][]; // History is also just data
}

export type LayerAction =
  | { type: 'INIT_PROJECT'; width: number; height: number; layerCount: number }
  | { type: 'LOAD_STATE'; state: SerializableAppStateForLoad } // Use the specific type here
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
  | { type: 'SET_BRUSH_SIZE'; size: number }
  | { type: 'ROTATE_LEFT' } // Added Rotate Left action
  | { type: 'ROTATE_RIGHT' }; // Added Rotate Right action
