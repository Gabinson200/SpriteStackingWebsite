// src/components/StartupModal/StartupModal.tsx
import React, { useState } from 'react';
import { useAppContext } from '../../state/AppContext';

interface StartupModalProps {
  isOpen: boolean;
  // No onClose needed as initialization handles closing conceptually
}

export const StartupModal: React.FC<StartupModalProps> = ({ isOpen }) => {
  const { dispatch } = useAppContext();
  const [width, setWidth] = useState(32);
  const [height, setHeight] = useState(32);
  const [layers, setLayers] = useState(3);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (width > 0 && height > 0 && layers > 0 && width <= 512 && height <= 512 && layers <= 16) {
      setError(null);
      dispatch({ type: 'INIT_PROJECT', width, height, layerCount: layers });
      // Modal will disappear once isInitialized becomes true in App.tsx
    } else {
      setError('Invalid dimensions or layer count. Max 512x512, 16 layers. All values must be positive.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold mb-4 text-gray-900 dark:text-gray-100">New Sprite Project</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="width" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Width (px):</label>
            <input
              type="number"
              id="width"
              value={width}
              onChange={(e) => setWidth(parseInt(e.target.value) || 0)}
              min="1"
              max="512" // Performance constraint
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="height" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Height (px):</label>
            <input
              type="number"
              id="height"
              value={height}
              onChange={(e) => setHeight(parseInt(e.target.value) || 0)}
              min="1"
              max="512" // Performance constraint
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="layers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Initial Layers:</label>
            <input
              type="number"
              id="layers"
              value={layers}
              onChange={(e) => setLayers(parseInt(e.target.value) || 0)}
              min="1"
              max="16" // Performance constraint
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-100"
            />
          </div>
          {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition duration-150 ease-in-out"
          >
            Create Project
          </button>
        </form>
      </div>
    </div>
  );
};