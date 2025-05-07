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
    history,
    historyIndex,
    // --- Get clipboard and activeLayerId for button disabling ---
    clipboard,
    activeLayerId,
    // ---
  } = state;

  const setTool = (tool: Tool) => {
    dispatch({ type: 'SET_SELECTED_TOOL', tool });
  };

  const handleExport = async () => {
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

  const ToolButton: React.FC<{ tool: Tool; label: string; currentTool: Tool }> = ({ tool, label, currentTool }) => (
    <button
      onClick={() => setTool(tool)}
      className={`px-3 py-1 border rounded ${ currentTool === tool ? 'bg-indigo-600 text-white border-indigo-700' : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'} transition duration-150 ease-in-out text-sm`}
      title={label}
    > {label} </button>
  );

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1 && historyIndex !== -1;
  // --- Conditions for enabling Copy/Cut/Paste ---
  const canCopy = !!activeLayerId;
  // Can cut if a layer is active. The reducer handles not cutting the last layer.
  const canCut = !!activeLayerId && layers.length > 0;
  const canPaste = !!clipboard;
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

      {/* Undo/Redo Buttons */}
      <div className="flex space-x-1">
        <button onClick={() => dispatch({ type: 'UNDO' })} disabled={!canUndo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canUndo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Undo (Left Arrow / Ctrl+Z)"> Undo </button>
        <button onClick={() => dispatch({ type: 'REDO' })} disabled={!canRedo} className={`px-3 py-1 border rounded text-sm transition-colors ${ canRedo ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500' : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'}`} title="Redo (Right Arrow / Ctrl+Y)"> Redo </button>
      </div>

      {/* --- Copy/Cut/Paste Buttons --- */}
      <div className="flex space-x-1">
        <button
            onClick={() => dispatch({ type: 'COPY_LAYER' })}
            disabled={!canCopy}
            className={`px-3 py-1 border rounded text-sm transition-colors ${
                canCopy
                    ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
            }`}
            title="Copy Layer (Ctrl+C)"
        >
            Copy
        </button>
        <button
            onClick={() => dispatch({ type: 'CUT_LAYER' })}
            disabled={!canCut}
            className={`px-3 py-1 border rounded text-sm transition-colors ${
                canCut
                    ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
            }`}
            title="Cut Layer (Ctrl+X)"
        >
            Cut
        </button>
        <button
            onClick={() => dispatch({ type: 'PASTE_LAYER' })}
            disabled={!canPaste}
            className={`px-3 py-1 border rounded text-sm transition-colors ${
                canPaste
                    ? 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-gray-200 dark:border-gray-600 cursor-not-allowed'
            }`}
            title="Paste Layer (Ctrl+V)"
        >
            Paste
        </button>
      </div>
      {/* --- End Copy/Cut/Paste Buttons --- */}

      {/* Color Preview & Picker Trigger */}
      <div className="flex items-center space-x-2">
         <button onClick={() => dispatch({ type: 'TOGGLE_COLOR_PICKER', open: true })} className="w-8 h-8 rounded border-2 border-gray-400 dark:border-gray-500 shadow cursor-pointer" style={{ backgroundColor: primaryColor }} title={`Current Color: ${primaryColor}. Click to change.`} />
      </div>

       {/* Zoom Display */}
       <div className="flex items-center space-x-1">
         <span className="text-sm px-2 tabular-nums" title="Zoom Level (use scroll wheel to change)"> Zoom: {zoomLevel.toFixed(2)}x </span>
       </div>

      {/* Export Button */}
       <div className="ml-auto">
        <button onClick={handleExport} className="px-3 py-1 border rounded bg-green-500 hover:bg-green-600 text-white border-green-600 transition duration-150 ease-in-out text-sm" title="Export all layers as individual PNGs"> Export Layers </button>
      </div>
    </div>
  );
};
