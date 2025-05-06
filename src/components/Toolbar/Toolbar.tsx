// src/components/Toolbar/Toolbar.tsx
import React from 'react';
import { useAppContext } from '../../state/AppContext';
import type{ Tool } from '../../state/types';
import { exportCanvasAsPNG } from '../../utils/fileUtils'; // Import the export function

export const Toolbar: React.FC = () => {
  const { state, dispatch } = useAppContext();
  const { selectedTool, primaryColor, zoomLevel, layers } = state;

  const setTool = (tool: Tool) => {
    dispatch({ type: 'SET_SELECTED_TOOL', tool });
  };

  const handleZoomIn = () => {
    // Simple doubling, add more steps or limits if needed
    dispatch({ type: 'SET_ZOOM_LEVEL', level: Math.min(32, zoomLevel * 2) });
  };

  const handleZoomOut = () => {
    // Simple halving
    dispatch({ type: 'SET_ZOOM_LEVEL', level: Math.max(1, zoomLevel / 2) });
  };

  const handleExport = async () => {
    if (!layers || layers.length === 0) {
        alert("No layers to export.");
        return;
    }
    // Confirmation or modal could be added here
    try {
        // Export each layer individually
        for (const layer of layers) {
            if (layer.offscreenCanvas) {
                const filename = `${layer.name.replace(/[^a-z0-9]/gi, '_') || 'layer'}.png`;
                await exportCanvasAsPNG(layer.offscreenCanvas, filename);
                // Optional: add slight delay between downloads if browser blocks rapid downloads
                // await new Promise(resolve => setTimeout(resolve, 100));
            }
        }
        alert(`Exported ${layers.length} layer(s) as separate PNG files.`);
    } catch (error) {
        console.error("Export failed:", error);
        alert("An error occurred during export.");
    }
  };

  // Function to easily create tool buttons
  const ToolButton: React.FC<{ tool: Tool; label: string }> = ({ tool, label }) => (
    <button
      onClick={() => setTool(tool)}
      className={`px-3 py-1 border rounded ${
        selectedTool === tool
          ? 'bg-indigo-600 text-white border-indigo-700'
          : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 border-gray-300 dark:border-gray-500'
      } transition duration-150 ease-in-out text-sm`}
      title={label}
    >
      {label} {/* Replace with Icons later */}
    </button>
  );

  return (
    <div className="bg-gray-100 dark:bg-gray-800 p-2 shadow-md flex items-center space-x-3 border-b border-gray-300 dark:border-gray-700 flex-wrap">
      {/* Tools */}
      <div className="flex space-x-1">
         <ToolButton tool="pencil" label="Pencil" />
         <ToolButton tool="eraser" label="Eraser" />
         <ToolButton tool="eyedropper" label="Eyedropper" />
         <ToolButton tool="fill" label="Fill" />
      </div>

      {/* Color Preview & Picker Trigger */}
      <div className="flex items-center space-x-2">
         <button
            onClick={() => dispatch({ type: 'TOGGLE_COLOR_PICKER', open: true })}
            className="w-8 h-8 rounded border-2 border-gray-400 dark:border-gray-500 shadow cursor-pointer"
            style={{ backgroundColor: primaryColor }}
            title={`Current Color: ${primaryColor}. Click to change.`}
         />
         {/* Secondary color could be added here */}
      </div>

       {/* Zoom Controls */}
       <div className="flex items-center space-x-1">
         <button onClick={handleZoomOut} className="px-2 py-1 border rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" title="Zoom Out">-</button>
         <span className="text-sm px-2 tabular-nums">{zoomLevel}x</span>
         <button onClick={handleZoomIn} className="px-2 py-1 border rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500" title="Zoom In">+</button>
       </div>

      {/* Export Button */}
       <div className="ml-auto"> {/* Pushes export to the right */}
        <button
          onClick={handleExport}
          className="px-3 py-1 border rounded bg-green-500 hover:bg-green-600 text-white border-green-600 transition duration-150 ease-in-out text-sm"
          title="Export all layers as individual PNGs"
        >
          Export Layers
        </button>
      </div>

    </div>
  );
};