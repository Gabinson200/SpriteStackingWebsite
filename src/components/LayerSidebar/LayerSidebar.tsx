// src/components/LayerSidebar/LayerSidebar.tsx
import React from 'react';
// --- Import dnd-kit components and hooks ---
import {
    DndContext,
    closestCenter, // Collision detection strategy
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
}from '@dnd-kit/core';

import type { DragEndEvent } from '@dnd-kit/core'; // Type for drag end event

import {
    arrayMove, // Utility to reorder arrays
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy, // Strategy for vertical lists
} from '@dnd-kit/sortable';
// --- End Import ---
import { useAppContext } from '../../state/AppContext';
import { LayerItem } from './LayerItem'; // LayerItem will also be updated

export const LayerSidebar: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { layers, activeLayerId } = state;

    // --- Configure Sensors for dnd-kit ---
    // Use PointerSensor for mouse/touch dragging
    // Use KeyboardSensor for accessibility (allows reordering with keyboard)
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );
    // --- End Sensor Configuration ---

    const handleAddLayer = () => {
        dispatch({ type: 'ADD_LAYER' });
    };

    const handleDeleteLayer = () => {
        if (activeLayerId && layers.length > 1) {
            if (window.confirm(`Are you sure you want to delete layer "${layers.find(l => l.id === activeLayerId)?.name}"?`)) {
                dispatch({ type: 'DELETE_LAYER', id: activeLayerId });
            }
        } else if (layers.length <= 1) {
            alert("Cannot delete the last layer.");
        } else {
            alert("Select a layer to delete.");
        }
    };

    // --- Drag End handler for dnd-kit ---
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        // Check if the item was dropped over a valid target
        if (over && active.id !== over.id) {
            // Find the original and new indices based on the unique IDs
            const oldIndex = layers.findIndex((layer) => layer.id === active.id);
            const newIndex = layers.findIndex((layer) => layer.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                 // Dispatch the reorder action using the indices
                 dispatch({ type: 'REORDER_LAYERS', sourceIndex: oldIndex, destinationIndex: newIndex });
            } else {
                console.warn("dnd-kit: Could not find indices for dragged items", active.id, over.id);
            }
        }
    };
    // --- End Drag End handler ---

    // Create an array of layer IDs for SortableContext
    const layerIds = layers.map(layer => layer.id);

    return (
        <div className="w-64 bg-gray-100 dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700 flex flex-col flex-shrink-0 h-full overflow-hidden">
            <h3 className="text-lg font-semibold p-2 border-b border-gray-300 dark:border-gray-700 text-center text-gray-800 dark:text-gray-200">Layers</h3>

            {/* --- Wrap Layer List with DndContext --- */}
            {/* Provides context for sensors and collision detection */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter} // Simple strategy for vertical lists
                onDragEnd={handleDragEnd} // Attach the handler
            >
                <div className="flex-grow overflow-y-auto"> {/* Scrollable container */}
                    {/* --- Define Sortable Context --- */}
                    {/* Provides context for sortable items, needs unique IDs */}
                    <SortableContext
                        items={layerIds} // Pass the array of unique IDs
                        strategy={verticalListSortingStrategy} // Use vertical list strategy
                    >
                        {/* Map over layers and render LayerItem */}
                        {layers.map((layer) => (
                            // LayerItem now needs its 'id' prop passed for dnd-kit
                            <LayerItem
                                key={layer.id}
                                id={layer.id} // Pass the unique ID
                                layer={layer}
                                isActive={layer.id === activeLayerId}
                            />
                        ))}
                    </SortableContext>
                    {/* --- End Sortable Context --- */}
                </div>
            </DndContext>
            {/* --- End DndContext --- */}

            {/* Layer Actions (remain the same) */}
            <div className="p-2 border-t border-gray-300 dark:border-gray-700 flex justify-center space-x-2">
                <button
                    onClick={handleAddLayer}
                    className="px-3 py-1 border rounded bg-blue-500 hover:bg-blue-600 text-white border-blue-600 text-sm"
                    title="Add New Layer"
                >
                    + Add
                </button>
                <button
                    onClick={handleDeleteLayer}
                    disabled={layers.length <= 1 || !activeLayerId}
                    className={`px-3 py-1 border rounded text-sm ${layers.length <= 1 || !activeLayerId ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white border-red-600'}`}
                    title="Delete Selected Layer"
                >
                    - Delete
                </button>
            </div>
        </div>
    );
};
