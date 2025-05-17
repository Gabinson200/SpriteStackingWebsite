// src/components/Toolbar/Toolbar.tsx
import React from 'react';
// AppState is removed from this import line as ProjectFileData will be redefined
import type { Tool, LayerDataForHistory, ClipboardLayerData, SerializableAppStateForLoad } from '../../state/types';
import { useAppContext } from '../../state/AppContext';
import { exportCanvasAsPNG } from '../../utils/fileUtils';
import { exportLayersToLvglH } from '../../utils/lvglExporter';
import { downloadTextFile, openJsonFile } from '../../utils/fileUtils';
import { serializeLayersForHistory } from '../../hooks/useLayerManager';

// Redefined ProjectFileData to not directly Omit<AppState, ...> in this file
// It now explicitly lists the properties it expects.
// This should align with the actual data structure being saved in handleSaveProject.
interface ProjectFileData {
    canvasWidth: number;
    canvasHeight: number;
    layers: LayerDataForHistory[];
    activeLayerId: string | null;
    selectedTool: Tool;
    primaryColor: string;
    zoomLevel: number;
    previewOffset: { x: number; y: number }; // Kept from AppState
    previewRotation: number; // Kept from AppState
    cameraPitch?: number; // Kept from AppState, optional
    history: LayerDataForHistory[][];
    historyIndex: number;
    clipboard: ClipboardLayerData | null;
    showGrid: boolean;
    brushSize: number;
    // Note: isColorPickerOpen and other purely transient UI states are intentionally omitted.
}


const BRUSH_SIZES = [1, 3, 5, 7];

export const Toolbar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const {
    selectedTool, primaryColor, layers, zoomLevel, history, historyIndex,
    clipboard, activeLayerId, canvasWidth, canvasHeight,
    // Removed cameraPitch, previewOffset, previewRotation from destructuring here
    // as they are only used in handleSaveProject and will be accessed via `state.`
    showGrid, brushSize,
  } = state;

  const setTool = (tool: Tool) => dispatch({ type: 'SET_SELECTED_TOOL', tool });
  const handleSetBrushSize = (size: number) => dispatch({ type: 'SET_BRUSH_SIZE', size });

  const handleExportPng = async () => {
    if (!layers || layers.length === 0) { alert("No layers to export."); return; }
    try {
        for (const layer of layers) {
            if (layer.offscreenCanvas) {
                const filename = `${layer.name.replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'layer'}.png`;
                await exportCanvasAsPNG(layer.offscreenCanvas, filename);
            }
        }
        alert(`Exported ${layers.length} layer(s) as separate PNG files.`);
    } catch (error) { console.error("Export PNG failed:", error); alert("An error occurred during PNG export."); }
  };

  const handleExportLvgl = () => {
    if (!layers || layers.length === 0) { alert("No layers to export to LVGL."); return; }
    const visibleLayers = layers.filter(layer => layer.isVisible && layer.offscreenCanvas);
    if (visibleLayers.length === 0) { alert("No visible layers with content to export to LVGL."); return; }
    try {
        exportLayersToLvglH(visibleLayers, canvasWidth, canvasHeight, true, "sprite_stack_images");
        alert(`LVGL .h file export initiated for ${visibleLayers.length} layer(s).`);
    } catch (error) { console.error("Export LVGL failed:", error); alert("An error occurred during LVGL export. Check console for details.");}
  };

  const handleNewProject = () => {
    if (window.confirm("Are you sure you want to start a new project? Any unsaved changes will be lost.")) {
        dispatch({ type: 'SHOW_NEW_PROJECT_MODAL' });
    }
  };

  const handleSaveProject = () => {
    try {
        // Access cameraPitch, previewOffset, previewRotation directly from state object
        const projectData: ProjectFileData = {
            canvasWidth: state.canvasWidth,
            canvasHeight: state.canvasHeight,
            layers: serializeLayersForHistory(state.layers),
            activeLayerId: state.activeLayerId,
            selectedTool: state.selectedTool,
            primaryColor: state.primaryColor,
            zoomLevel: state.zoomLevel,
            previewOffset: state.previewOffset,       // Used state.previewOffset
            previewRotation: state.previewRotation,   // Used state.previewRotation
            cameraPitch: state.cameraPitch,           // Used state.cameraPitch
            history: state.history,
            historyIndex: state.historyIndex,
            clipboard: state.clipboard,
            showGrid: state.showGrid,
            brushSize: state.brushSize,
        };
        const jsonString = JSON.stringify(projectData, null, 2);
        downloadTextFile(jsonString, "sprite_stack_project.ssp", "application/json");
    } catch (error) { console.error("Error saving project:", error); alert("Failed to save project. See console for details."); }
  };

  const handleLoadProject = async () => {
    try {
        const loadedDataFromFile = await openJsonFile<ProjectFileData>(".ssp");
        if (loadedDataFromFile) {
            const stateToLoad: SerializableAppStateForLoad = { ...loadedDataFromFile };
            dispatch({ type: 'LOAD_STATE', state: stateToLoad });
            alert("Project loaded successfully!");
        }
    } catch (error) { console.error("Error loading project:", error); alert(`Failed to load project: ${error instanceof Error ? error.message : "Unknown error"}`);}
  };

  const ToolButton: React.FC<{ tool: Tool; label: string; currentTool: Tool }> = ({ tool, label, currentTool }) => (
    <button
      onClick={() => setTool(tool)}
      className={`px-3 py-1 border rounded ${
        currentTool === tool
          ? 'bg-indigo-600 text-white border-indigo-700'
          : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
      } transition duration-150 ease-in-out text-sm`}
      title={label}
    >
      {label}
    </button>
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1 && historyIndex !== -1;
  const canCopy = !!activeLayerId;
  const canCut = !!activeLayerId && layers.length > 0;
  const canPaste = !!clipboard;

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-2 shadow-md flex items-center space-x-3 border-b border-gray-300 dark:border-gray-700 flex-wrap">
      {/* File Operations Group */}
      <div className="flex space-x-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
        <button onClick={handleNewProject} className="px-3 py-1 border rounded text-sm bg-blue-500 hover:bg-blue-600 text-white border-blue-600" title="New Project">New</button>
        <button onClick={handleSaveProject} className="px-3 py-1 border rounded text-sm bg-green-500 hover:bg-green-600 text-white border-green-600" title="Save Project As...">Save</button>
        <button onClick={handleLoadProject} className="px-3 py-1 border rounded text-sm bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-600" title="Load Project...">Load</button>
      </div>

      {/* Tools */}
      <div className="flex space-x-1">
         <ToolButton tool="pencil" label="Pencil" currentTool={selectedTool} />
         <ToolButton tool="eraser" label="Eraser" currentTool={selectedTool} />
         <ToolButton tool="eyedropper" label="Eyedropper" currentTool={selectedTool} />
         <ToolButton tool="fill" label="Fill" currentTool={selectedTool} />
      </div>

      {/* Brush Size Selector */}
      {(selectedTool === 'pencil' || selectedTool === 'eraser') && (
        <div className="flex items-center space-x-1 border-l border-gray-300 dark:border-gray-600 pl-2 ml-2">
            <span className="text-xs text-gray-600 dark:text-gray-400 mr-1">Size:</span>
            {BRUSH_SIZES.map(size => (
                <button
                    key={size}
                    onClick={() => handleSetBrushSize(size)}
                    className={`px-2 py-0.5 border rounded text-xs ${
                        brushSize === size
                            ? 'bg-indigo-500 text-white border-indigo-600'
                            : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
                    }`}
                    title={`${size}px Brush`}
                >
                    {size}
                </button>
            ))}
        </div>
      )}

      {/* Undo/Redo Buttons */}
      <div className="flex space-x-1 ml-2 border-l border-gray-300 dark:border-gray-600 pl-2">
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canUndo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Undo (Left Arrow / Ctrl+Z)"> Undo </button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canRedo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Redo (Right Arrow / Ctrl+Y)"> Redo </button>
      </div>

      {/* Copy/Cut/Paste Buttons */}
      <div className="flex space-x-1">
        <button onClick={() => dispatch({ type: 'COPY_LAYER' })} disabled={!canCopy} className={`px-3 py-1 border rounded text-sm transition-colors ${ canCopy ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Copy Layer (Ctrl+C)"> Copy </button>
        <button onClick={() => dispatch({ type: 'CUT_LAYER' })} disabled={!canCut} className={`px-3 py-1 border rounded text-sm transition-colors ${ canCut ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Cut Layer (Ctrl+X)"> Cut </button>
        <button onClick={() => dispatch({ type: 'PASTE_LAYER' })} disabled={!canPaste} className={`px-3 py-1 border rounded text-sm transition-colors ${ canPaste ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Paste Layer (Ctrl+V)"> Paste </button>
      </div>
      
      {/* Show Grid Checkbox */}
      <div className="flex items-center space-x-1 ml-2 border-l border-gray-300 dark:border-gray-600 pl-2">
        <input type="checkbox" id="showGridCheckbox" checked={showGrid} onChange={() => dispatch({ type: 'TOGGLE_GRID' })} className="form-checkbox h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:checked:bg-indigo-500"/>
        <label htmlFor="showGridCheckbox" className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer"> Show Grid </label>
      </div>

      {/* Color Preview & Picker Trigger */}
      <div className="flex items-center space-x-2 ml-auto">
         <button onClick={() => dispatch({ type: 'TOGGLE_COLOR_PICKER', open: true })} className="w-8 h-8 rounded border-2 border-gray-400 dark:border-gray-500 shadow cursor-pointer" style={{ backgroundColor: primaryColor }} title={`Current Color: ${primaryColor}. Click to change.`} />
      </div>

       {/* Zoom Display */}
       <div className="flex items-center space-x-1">
         <span className="text-sm px-2 tabular-nums" title="Zoom Level (use scroll wheel to change)"> Zoom: {zoomLevel.toFixed(2)}x </span>
       </div>

      {/* Export Buttons Group (PNG and LVGL) */}
       <div className="flex space-x-1">
        <button onClick={handleExportPng} className="px-3 py-1 border rounded bg-green-500 hover:bg-green-600 text-white border-green-600 transition duration-150 ease-in-out text-sm" title="Export all layers as individual PNGs"> Export PNGs </button>
        <button onClick={handleExportLvgl} disabled={!layers || layers.filter(l => l.isVisible && l.offscreenCanvas).length === 0} className={`px-3 py-1 border rounded text-sm transition-colors ${ (!layers || layers.filter(l => l.isVisible && l.offscreenCanvas).length === 0) ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-400 cursor-not-allowed border-gray-300 dark:border-gray-500' : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-600'}`} title="Export visible layers to LVGL .h file"> Export LVGL </button>
      </div>
    </div>
  );
};
