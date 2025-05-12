// src/components/Toolbar/Toolbar.tsx
import React from 'react';
import { useAppContext } from '../../state/AppContext';
import type { Tool, AppState } from '../../state/types'; // Import AppState
import { exportCanvasAsPNG } from '../../utils/fileUtils';
import { exportLayersToLvglH } from '../../utils/lvglExporter';
// Import new file utilities we'll use via App.tsx
import { downloadTextFile, openJsonFile } from '../../utils/fileUtils';
import { serializeLayersForHistory } from '../../hooks/useLayerManager'; // For saving

// Define the structure of the state we save to/load from file
// This should match SerializableAppState in App.tsx
interface ProjectFileData extends Omit<AppState, 'layers' | 'isInitialized' | 'history'> {
    layers: ReturnType<typeof serializeLayersForHistory>; // Array of LayerDataForHistory
    history: ReturnType<typeof serializeLayersForHistory>[]; // Array of arrays of LayerDataForHistory
}


export const Toolbar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const {
    selectedTool,
    primaryColor,
    layers,
    zoomLevel,
    history,
    historyIndex,
    clipboard,
    activeLayerId,
    canvasWidth,
    canvasHeight,
    // Add other state parts needed for saving the full project
    cameraPitch, // if used
    previewOffset,
    previewRotation,
    // No need for isColorPickerOpen, isInitialized in saved file
  } = state;

  const setTool = (tool: Tool) => {
    dispatch({ type: 'SET_SELECTED_TOOL', tool });
  };

  const handleExportPng = async () => { /* ... (same as before) ... */
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

  const handleExportLvgl = () => { /* ... (same as before) ... */
    if (!layers || layers.length === 0) { alert("No layers to export to LVGL."); return; }
    const visibleLayers = layers.filter(layer => layer.isVisible && layer.offscreenCanvas);
    if (visibleLayers.length === 0) { alert("No visible layers with content to export to LVGL."); return; }
    try {
        exportLayersToLvglH(visibleLayers, canvasWidth, canvasHeight, false, "sprite_stack_images");
        alert(`LVGL .h file export initiated for ${visibleLayers.length} layer(s).`);
    } catch (error) { console.error("Export LVGL failed:", error); alert("An error occurred during LVGL export. Check console for details.");}
  };

  // --- File Operation Handlers ---
  const handleNewProject = () => {
    if (window.confirm("Are you sure you want to start a new project? Any unsaved changes will be lost.")) {
        // Dispatch INIT_PROJECT. The StartupModal will typically handle width/height.
        // For simplicity here, we'll re-trigger the initialization sequence.
        // A more robust way would be to set isInitialized to false,
        // which App.tsx would detect and show StartupModal.
        // Or, dispatch INIT_PROJECT with some default dimensions if StartupModal isn't re-shown.
        dispatch({ type: 'INIT_PROJECT', width: 32, height: 32, layerCount: 1 }); // Example defaults
    }
  };

  const handleSaveProject = () => {
    try {
        // Construct the state to save, excluding non-serializable parts like offscreenCanvas
        // and transient UI state like isColorPickerOpen.
        const projectData: ProjectFileData = {
            canvasWidth: state.canvasWidth,
            canvasHeight: state.canvasHeight,
            layers: serializeLayersForHistory(state.layers), // Serialize layers
            activeLayerId: state.activeLayerId,
            selectedTool: state.selectedTool,
            primaryColor: state.primaryColor,
            zoomLevel: state.zoomLevel,
            previewOffset: state.previewOffset,
            previewRotation: state.previewRotation,
            cameraPitch: state.cameraPitch, // Include if this feature is active
            history: state.history, // Save the serialized history
            historyIndex: state.historyIndex,
            clipboard: state.clipboard, // Save clipboard
        };
        const jsonString = JSON.stringify(projectData, null, 2); // Pretty print JSON
        downloadTextFile(jsonString, "sprite_stack_project.ssp", "application/json");
    } catch (error) {
        console.error("Error saving project:", error);
        alert("Failed to save project. See console for details.");
    }
  };

  const handleLoadProject = async () => {
    try {
        const loadedData = await openJsonFile<ProjectFileData>(".ssp"); // Specify custom extension
        if (loadedData) {
            // Dispatch LOAD_STATE with the data.
            // The reducer needs to correctly reconstruct the AppState from this.
            dispatch({ type: 'LOAD_STATE', state: loadedData as Partial<AppState> });
            alert("Project loaded successfully!");
        }
    } catch (error) {
        console.error("Error loading project:", error);
        alert(`Failed to load project: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };
  // --- End File Operation Handlers ---


  const ToolButton: React.FC<{ tool: Tool; label: string; currentTool: Tool }> = ({ tool, label, currentTool }) => ( /* ... (same) ... */
    <button
      onClick={() => setTool(tool)}
      className={`px-3 py-1 border rounded ${ currentTool === tool ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'} transition duration-150 ease-in-out text-sm`}
      title={label}
    > {label} </button>
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1 && historyIndex !== -1;
  const canCopy = !!activeLayerId;
  const canCut = !!activeLayerId && layers.length > 0;
  const canPaste = !!clipboard;

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-2 shadow-md flex items-center space-x-3 border-b border-gray-300 dark:border-gray-700 flex-wrap">
      {/* --- File Operations Group --- */}
      <div className="flex space-x-1 border-r border-gray-300 dark:border-gray-600 pr-2 mr-2">
        <button onClick={handleNewProject} className="px-3 py-1 border rounded text-sm bg-blue-500 hover:bg-blue-600 text-white border-blue-600" title="New Project">New</button>
        <button onClick={handleSaveProject} className="px-3 py-1 border rounded text-sm bg-green-500 hover:bg-green-600 text-white border-green-600" title="Save Project As...">Save</button>
        <button onClick={handleLoadProject} className="px-3 py-1 border rounded text-sm bg-yellow-500 hover:bg-yellow-600 text-black border-yellow-600" title="Load Project...">Load</button>
      </div>
      {/* --- End File Operations Group --- */}

      {/* Tools */}
      <div className="flex space-x-1">
         <ToolButton tool="pencil" label="Pencil" currentTool={selectedTool} />
         <ToolButton tool="eraser" label="Eraser" currentTool={selectedTool} />
         <ToolButton tool="eyedropper" label="Eyedropper" currentTool={selectedTool} />
         <ToolButton tool="fill" label="Fill" currentTool={selectedTool} />
      </div>

      {/* Undo/Redo Buttons */}
      <div className="flex space-x-1">
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canUndo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Undo (Left Arrow / Ctrl+Z)"> Undo </button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canRedo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Redo (Right Arrow / Ctrl+Y)"> Redo </button>
      </div>

      {/* Copy/Cut/Paste Buttons */}
      <div className="flex space-x-1">
        <button onClick={() => dispatch({ type: 'COPY_LAYER' })} disabled={!canCopy} className={`px-3 py-1 border rounded text-sm transition-colors ${ canCopy ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Copy Layer (Ctrl+C)"> Copy </button>
        <button onClick={() => dispatch({ type: 'CUT_LAYER' })} disabled={!canCut} className={`px-3 py-1 border rounded text-sm transition-colors ${ canCut ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Cut Layer (Ctrl+X)"> Cut </button>
        <button onClick={() => dispatch({ type: 'PASTE_LAYER' })} disabled={!canPaste} className={`px-3 py-1 border rounded text-sm transition-colors ${ canPaste ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Paste Layer (Ctrl+V)"> Paste </button>
      </div>

      {/* Color Preview & Picker Trigger */}
      <div className="flex items-center space-x-2">
         <button onClick={() => dispatch({ type: 'TOGGLE_COLOR_PICKER', open: true })} className="w-8 h-8 rounded border-2 border-gray-400 dark:border-gray-500 shadow cursor-pointer" style={{ backgroundColor: primaryColor }} title={`Current Color: ${primaryColor}. Click to change.`} />
      </div>

       {/* Zoom Display */}
       <div className="flex items-center space-x-1">
         <span className="text-sm px-2 tabular-nums" title="Zoom Level (use scroll wheel to change)"> Zoom: {zoomLevel.toFixed(2)}x </span>
       </div>

      {/* Export Buttons Group (PNG and LVGL) */}
       <div className="ml-auto flex space-x-1">
        <button onClick={handleExportPng} className="px-3 py-1 border rounded bg-green-500 hover:bg-green-600 text-white border-green-600 transition duration-150 ease-in-out text-sm" title="Export all layers as individual PNGs"> Export PNGs </button>
        <button onClick={handleExportLvgl} disabled={!layers || layers.filter(l => l.isVisible && l.offscreenCanvas).length === 0} className={`px-3 py-1 border rounded text-sm transition-colors ${ (!layers || layers.filter(l => l.isVisible && l.offscreenCanvas).length === 0) ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-400 cursor-not-allowed border-gray-300 dark:border-gray-500' : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-600'}`} title="Export visible layers to LVGL .h file"> Export LVGL </button>
      </div>
    </div>
  );
};
