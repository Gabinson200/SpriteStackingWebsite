// src/components/LayerSidebar/LayerItem.tsx
import React, { useState, useRef, useEffect } from 'react';
import type { Layer } from '../../state/types';
import { useAppContext } from '../../state/AppContext';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Simple SVG Drag Handle Icon (gripper dots)
const DragHandleIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 cursor-grab active:cursor-grabbing">
      <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5m0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5"/>
    </svg>
);


interface LayerItemProps {
  layer: Layer;
  isActive: boolean;
  id: string;
}

export const LayerItem: React.FC<LayerItemProps> = ({ layer, isActive, id }) => {
    const { dispatch } = useAppContext();
    const [isEditingName, setIsEditingName] = useState(false);
    const [nameInput, setNameInput] = useState(layer.name);
    const nameInputRef = useRef<HTMLInputElement>(null);

    const {
        attributes,
        listeners, // These will be applied ONLY to the drag handle now
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.8 : 1,
        zIndex: isDragging ? 10 : 'auto',
        // userSelect: 'none' // Apply this via className or only when dragging if needed
    };

    // --- Event Handlers (remain the same) ---
     const handleSelect = () => {
        // Don't select if dragging just finished (prevents accidental selection)
        // Note: This might need adjustment based on exact timing/behavior
        if (isDragging) return;
        if (!isActive) {
            dispatch({ type: 'SELECT_LAYER', id: layer.id });
        }
    };
    // ... (other handlers: toggleVisibility, toggleLock, etc. remain unchanged) ...
    const toggleVisibility = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({ type: 'SET_LAYER_VISIBILITY', id: layer.id, isVisible: !layer.isVisible });
    };

    const toggleLock = (e: React.MouseEvent) => {
        e.stopPropagation();
        dispatch({ type: 'SET_LAYER_LOCK', id: layer.id, isLocked: !layer.isLocked });
    };

    const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch({ type: 'SET_LAYER_OPACITY', id: layer.id, opacity: parseFloat(e.target.value) });
    };

    const handleNameDoubleClick = () => {
        setIsEditingName(true);
    };

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setNameInput(e.target.value);
    };

    const handleNameBlur = () => {
        if (nameInput.trim() && nameInput !== layer.name) {
            dispatch({ type: 'RENAME_LAYER', id: layer.id, name: nameInput.trim() });
        } else {
            setNameInput(layer.name);
        }
        setIsEditingName(false);
    };

    const handleNameKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            handleNameBlur();
        } else if (e.key === 'Escape') {
            setNameInput(layer.name);
            setIsEditingName(false);
        }
    };

     useEffect(() => {
        if (isEditingName) {
            nameInputRef.current?.focus();
            nameInputRef.current?.select();
        }
    }, [isEditingName]);


    const Thumbnail: React.FC<{ dataURL?: string }> = ({ dataURL }) => (
        <div className="w-10 h-10 border border-gray-400 dark:border-gray-600 mr-2 flex-shrink-0 bg-checkerboard">
            {dataURL && <img src={dataURL} alt="Layer Thumbnail" className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />}
        </div>
    );

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes} // Attributes applied to the main draggable node
            // onClick={handleSelect} // Apply onClick to a specific inner element if needed to avoid conflict with handle
            className={`flex items-center p-2 border-b border-gray-300 dark:border-gray-700 transition-colors duration-150 relative select-none ${ // Added select-none
                isActive ? 'bg-indigo-100 dark:bg-indigo-900' : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            } ${isDragging ? 'shadow-lg' : ''}`}
        >
            {/* --- Dedicated Drag Handle --- */}
            {/* Apply listeners ONLY to this element */}
            <div {...listeners} className="pr-2 cursor-grab active:cursor-grabbing touch-none">
                 <DragHandleIcon />
            </div>
            {/* --- End Drag Handle --- */}

            {/* Main clickable/selectable area (apply handleSelect here) */}
            <div className="flex-grow flex items-center cursor-pointer" onClick={handleSelect}>
                {/* Thumbnail */}
                <Thumbnail dataURL={layer.dataURL} />

                {/* Layer Info & Controls */}
                <div className="flex-grow flex flex-col mr-2 overflow-hidden">
                    {/* Name (Editable) */}
                    {isEditingName ? (
                         <input
                            ref={nameInputRef}
                            type="text"
                            value={nameInput}
                            onChange={handleNameChange}
                            onBlur={handleNameBlur}
                            onKeyDown={handleNameKeyDown}
                            className="text-sm font-medium px-1 py-0 border border-indigo-500 rounded bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 focus:outline-none"
                            onClick={(e) => e.stopPropagation()} // Prevent select on click
                        />
                    ) : (
                        <span
                            className="text-sm font-medium truncate"
                            onDoubleClick={handleNameDoubleClick}
                            title={layer.name + " (Double-click to rename)"}
                        >
                            {layer.name}
                        </span>
                    )}
                    {/* Opacity Slider */}
                    <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={layer.opacity}
                        onChange={handleOpacityChange}
                        onClick={(e) => e.stopPropagation()} // Prevent select on click
                        className="w-full h-1 bg-gray-300 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer mt-1"
                        title={`Opacity: ${Math.round(layer.opacity * 100)}%`}
                    />
                </div>
            </div>


            {/* Action Icons (remain clickable, outside drag handle) */}
            <div className="flex items-center space-x-1 flex-shrink-0 pl-1">
                <button onClick={toggleLock} title={layer.isLocked ? "Unlock Layer" : "Lock Layer"} className={`w-5 h-5 text-xs ${layer.isLocked ? 'text-red-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>
                    {layer.isLocked ? '🔒' : '🔓'}
                </button>
                <button onClick={toggleVisibility} title={layer.isVisible ? "Hide Layer" : "Show Layer"} className={`w-5 h-5 text-xs ${layer.isVisible ? 'text-blue-500' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-white'}`}>
                    {layer.isVisible ? '👁️' : '👁️‍🗨️'}
                </button>
            </div>
        </div>
    );
};
