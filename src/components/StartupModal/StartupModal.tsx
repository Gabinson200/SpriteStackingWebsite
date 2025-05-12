// src/components/StartupModal/StartupModal.tsx
import React, { useState, useEffect } from 'react';
import { useAppContext } from '../../state/AppContext';

interface StartupModalProps {
  isOpen: boolean;
  // No onClose needed as initialization handles closing conceptually
}

const PREDEFINED_SIZES = [
  "4x4", "8x8", "16x16", "32x32", "64x64", "128x128", "Custom"
];

const parseSizeString = (sizeStr: string): { width: number; height: number } | null => {
    if (sizeStr === "Custom") return null;
    const parts = sizeStr.split('x');
    if (parts.length === 2) {
        const w = parseInt(parts[0], 10);
        const h = parseInt(parts[1], 10);
        if (!isNaN(w) && !isNaN(h)) {
            return { width: w, height: h };
        }
    }
    return null;
};

export const StartupModal: React.FC<StartupModalProps> = ({ isOpen }) => {
  const { dispatch } = useAppContext();

  const [selectedSize, setSelectedSize] = useState<string>(PREDEFINED_SIZES[3]); // Default to 32x32
  const [customWidth, setCustomWidth] = useState<number>(32);
  const [customHeight, setCustomHeight] = useState<number>(32);
  const [layers, setLayers] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);

  const isCustomSize = selectedSize === "Custom";

  // Effect to update customWidth/Height when a predefined size is selected
  useEffect(() => {
    if (!isCustomSize) {
      const parsed = parseSizeString(selectedSize);
      if (parsed) {
        setCustomWidth(parsed.width);
        setCustomHeight(parsed.height);
      }
    }
    // If switching to custom, retain the last values or reset to a default
    // For now, it retains the last set values from predefined or previous custom.
  }, [selectedSize, isCustomSize]);


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let finalWidth = 0;
    let finalHeight = 0;

    if (isCustomSize) {
        finalWidth = customWidth;
        finalHeight = customHeight;
    } else {
        const parsed = parseSizeString(selectedSize);
        if (parsed) {
            finalWidth = parsed.width;
            finalHeight = parsed.height;
        } else {
            setError("Invalid predefined size selected. This should not happen.");
            return;
        }
    }

    if (finalWidth > 0 && finalHeight > 0 && layers > 0 &&
        finalWidth <= 512 && finalHeight <= 512 && layers <= 16) {
      dispatch({ type: 'INIT_PROJECT', width: finalWidth, height: finalHeight, layerCount: layers });
      // Modal will disappear once isInitialized becomes true in App.tsx
    } else {
      let errorMsg = "Invalid input. ";
      if (finalWidth <= 0 || finalHeight <= 0) errorMsg += "Dimensions must be positive. ";
      if (finalWidth > 512 || finalHeight > 512) errorMsg += "Max dimensions are 512x512. ";
      if (layers <= 0 || layers > 16) errorMsg += "Layer count must be between 1 and 16. ";
      setError(errorMsg.trim());
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-6 text-gray-900 dark:text-gray-100 text-center">New Sprite Project</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="size-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Canvas Size:
            </label>
            <select
              id="size-select"
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            >
              {PREDEFINED_SIZES.map(size => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>

          {isCustomSize && (
            <>
              <div>
                <label htmlFor="customWidth" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Width (px):
                </label>
                <input
                  type="number"
                  id="customWidth"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(parseInt(e.target.value, 10) || 0)}
                  min="1"
                  max="512"
                  required={isCustomSize}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
              <div>
                <label htmlFor="customHeight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Custom Height (px):
                </label>
                <input
                  type="number"
                  id="customHeight"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(parseInt(e.target.value, 10) || 0)}
                  min="1"
                  max="512"
                  required={isCustomSize}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
                />
              </div>
            </>
          )}

          {!isCustomSize && (
             <div className="text-sm text-gray-500 dark:text-gray-400">
                Selected: {selectedSize} (Width: {customWidth}px, Height: {customHeight}px)
             </div>
          )}


          <div>
            <label htmlFor="layers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Initial Layers:
            </label>
            <input
              type="number"
              id="layers"
              value={layers}
              onChange={(e) => setLayers(parseInt(e.target.value, 10) || 0)}
              min="1"
              max="16"
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>

          {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-4 rounded-md focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
          >
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
};
