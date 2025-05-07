// src/components/Toolbar/Toolbar.tsx
import React from 'react';
import { useAppContext } from '../../state/AppContext';
import type { Tool } from '../../state/types';
import { exportCanvasAsPNG } from '../../utils/fileUtils';

export const Toolbar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const {
    selectedTool,
    primaryColor,
    layers,
    zoomLevel,
    // --- Get history state for button disabling ---
    history,
    historyIndex,
    // ---
  } = state;

  const setTool = (tool: Tool) => {
    dispatch({ type: 'SET_SELECTED_TOOL', tool });
  };

  const handleExport = async () => { /* ... (same as before) ... */
    if (!layers || layers.length === 0) { alert("No layers to export."); return; }
    try {
        for (const layer of layers) {
            if (layer.offscreenCanvas) {
                const filename = `${layer.name.replace(/[^a-z0-9]/gi, '_') || 'layer'}.png`;
                await exportCanvasAsPNG(layer.offscreenCanvas, filename);
            }
        }
        alert(`Exported ${layers.length} layer(s) as separate PNG files.`);
    } catch (error) { console.error("Export failed:", error); alert("An error occurred during export."); }
  };


  const ToolButton: React.FC<{ tool: Tool; label: string; currentTool: Tool }> = ({ tool, label, currentTool }) => ( /* ... (same) ... */
    <button
      onClick={() => setTool(tool)}
      className={`px-3 py-1 border rounded ${ currentTool === tool ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'} transition duration-150 ease-in-out text-sm`}
      title={label}
    > {label} </button>
  );

  // --- Undo/Redo button states ---
  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1 && historyIndex !== -1;
  // ---

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-2 shadow-md flex items-center space-x-3 border-b border-gray-300 dark:border-gray-700 flex-wrap">
      {/* Tools */}
      <div className="flex space-x-1">
         <ToolButton tool="pencil" label="Pencil" currentTool={selectedTool} />
         <ToolButton tool="eraser" label="Eraser" currentTool={selectedTool} />
         <ToolButton tool="eyedropper" label="Eyedropper" currentTool={selectedTool} />
         <ToolButton tool="fill" label="Fill" currentTool={selectedTool} />
      </div>

      {/* --- Undo/Redo Buttons --- */}
      <div className="flex space-x-1">
        <button
            onClick={() => dispatch({ type: 'UNDO' })}
            disabled={!canUndo}
            className={`px-3 py-1 border rounded text-sm transition-colors ${
                canUndo
                    ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
            }`}
            title="Undo (Left Arrow / Ctrl+Z)"
        >
            Undo
        </button>
        <button
            onClick={() => dispatch({ type: 'REDO' })}
            disabled={!canRedo}
            className={`px-3 py-1 border rounded text-sm transition-colors ${
                canRedo
                    ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
            }`}
            title="Redo (Right Arrow / Ctrl+Y)"
        >
            Redo
        </button>
      </div>
      {/* --- End Undo/Redo Buttons --- */}


      {/* Color Preview & Picker Trigger (same) */}
      <div className="flex items-center space-x-2">
         <button onClick={() => dispatch({ type: 'TOGGLE_COLOR_PICKER', open: true })} className="w-8 h-8 rounded border-2 border-gray-400 dark:border-gray-500 shadow cursor-pointer" style={{ backgroundColor: primaryColor }} title={`Current Color: ${primaryColor}. Click to change.`} />
      </div>

       {/* Zoom Display (same) */}
       <div className="flex items-center space-x-1">
         <span className="text-sm px-2 tabular-nums" title="Zoom Level (use scroll wheel to change)"> Zoom: {zoomLevel.toFixed(2)}x </span>
       </div>

      {/* Export Button (same) */}
       <div className="ml-auto">
        <button onClick={handleExport} className="px-3 py-1 border rounded bg-green-500 hover:bg-green-600 text-white border-green-600 transition duration-150 ease-in-out text-sm" title="Export all layers as individual PNGs"> Export Layers </button>
      </div>
    </div>
  );
};
