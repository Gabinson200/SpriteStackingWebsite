// src/components/Toolbar/Toolbar.tsx
import React from 'react';
import { useAppContext } from '../../state/AppContext';
import type { Tool } from '../../state/types';
import { exportCanvasAsPNG } from '../../utils/fileUtils';
// We'll add the LVGL export function later
import { exportLayersToLvglH } from '../../utils/lvglExporter'; // Placeholder for now

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
    canvasWidth, // Needed for LVGL export
    canvasHeight, // Needed for LVGL export
  } = state;

  const setTool = (tool: Tool) => {
    dispatch({ type: 'SET_SELECTED_TOOL', tool });
  };

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
    if (!layers || layers.length === 0) {
        alert("No layers to export to LVGL.");
        return;
    }
    // For now, export all visible layers, with LV_COLOR_16_SWAP = false
    // We can add UI for these options later
    const visibleLayers = layers.filter(layer => layer.isVisible && layer.offscreenCanvas);
    if (visibleLayers.length === 0) {
        alert("No visible layers with content to export to LVGL.");
        return;
    }
    try {
        exportLayersToLvglH(visibleLayers, canvasWidth, canvasHeight, false, "sprite_stack_images");
        alert(`LVGL .h file export initiated for ${visibleLayers.length} layer(s).`);
    } catch (error) {
        console.error("Export LVGL failed:", error);
        alert("An error occurred during LVGL export. Check console for details.");
    }
  };


  const ToolButton: React.FC<{ tool: Tool; label: string; currentTool: Tool }> = ({ tool, label, currentTool }) => (
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
      {/* Tools */}
      <div className="flex space-x-1">
         <ToolButton tool="pencil" label="Pencil" currentTool={selectedTool} />
         {/* ... other tool buttons ... */}
         <ToolButton tool="eraser" label="Eraser" currentTool={selectedTool} />
         <ToolButton tool="eyedropper" label="Eyedropper" currentTool={selectedTool} />
         <ToolButton tool="fill" label="Fill" currentTool={selectedTool} />
      </div>

      {/* Undo/Redo Buttons */}
      <div className="flex space-x-1">
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canUndo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Undo (Left Arrow / Ctrl+Z)"> Undo </button>
        {/* ... redo button ... */}
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canRedo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Redo (Right Arrow / Ctrl+Y)"> Redo </button>
      </div>

      {/* Copy/Cut/Paste Buttons */}
      <div className="flex space-x-1">
        <button onClick={() => dispatch({ type: 'COPY_LAYER' })} disabled={!canCopy} className={`px-3 py-1 border rounded text-sm transition-colors ${ canCopy ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Copy Layer (Ctrl+C)"> Copy </button>
        {/* ... cut button ... */}
        <button onClick={() => dispatch({ type: 'CUT_LAYER' })} disabled={!canCut} className={`px-3 py-1 border rounded text-sm transition-colors ${ canCut ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Cut Layer (Ctrl+X)"> Cut </button>
        {/* ... paste button ... */}
        <button onClick={() => dispatch({ type: 'PASTE_LAYER' })} disabled={!canPaste} className={`px-3 py-1 border rounded text-sm transition-colors ${ canPaste ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Paste Layer (Ctrl+V)"> Paste </button>
      </div>

      {/* Color Preview & Picker Trigger (same) */}
      {/* ... */}
       <div className="flex items-center space-x-2">
         <button onClick={() => dispatch({ type: 'TOGGLE_COLOR_PICKER', open: true })} className="w-8 h-8 rounded border-2 border-gray-400 dark:border-gray-500 shadow cursor-pointer" style={{ backgroundColor: primaryColor }} title={`Current Color: ${primaryColor}. Click to change.`} />
      </div>

       {/* Zoom Display (same) */}
       {/* ... */}
       <div className="flex items-center space-x-1">
         <span className="text-sm px-2 tabular-nums" title="Zoom Level (use scroll wheel to change)"> Zoom: {zoomLevel.toFixed(2)}x </span>
       </div>

      {/* Export Buttons Group (PNG and LVGL) */}
       <div className="ml-auto flex space-x-1">
        <button
          onClick={handleExportPng}
          className="px-3 py-1 border rounded bg-green-500 hover:bg-green-600 text-white border-green-600 transition duration-150 ease-in-out text-sm"
          title="Export all layers as individual PNGs"
        >
          Export PNGs
        </button>
        {/* --- LVGL Export Button --- */}
        <button
          onClick={handleExportLvgl}
          disabled={!layers || layers.filter(l => l.isVisible && l.offscreenCanvas).length === 0} // Disable if no visible layers with content
          className={`px-3 py-1 border rounded text-sm transition-colors ${
            (!layers || layers.filter(l => l.isVisible && l.offscreenCanvas).length === 0)
                ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-400 cursor-not-allowed border-gray-300 dark:border-gray-500'
                : 'bg-teal-500 hover:bg-teal-600 text-white border-teal-600'
          }`}
          title="Export visible layers to LVGL .h file"
        >
          Export LVGL
        </button>
        {/* --- End LVGL Export Button --- */}
      </div>
    </div>
  );
};
