// src/components/LayerSidebar/LayerSidebar.tsx
import React from 'react'; // Keep React import
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor,
    useSensor, useSensors, type DragEndEvent, // Use type import
} from '@dnd-kit/core';
import {
    // arrayMove, // Removed unused import
    SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useAppContext } from '../../state/AppContext';
import { LayerItem } from './LayerItem';

export const LayerSidebar: React.FC = () => {
    const { state, dispatch } = useAppContext();
    const { layers, activeLayerId } = state;
    const sensors = useSensors( useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates, }) );
    const handleAddLayer = () => dispatch({ type: 'ADD_LAYER' });
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
    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            const oldIndex = layers.findIndex((layer) => layer.id === active.id);
            const newIndex = layers.findIndex((layer) => layer.id === over.id);
            if (oldIndex !== -1 && newIndex !== -1) {
                 dispatch({ type: 'REORDER_LAYERS', sourceIndex: oldIndex, destinationIndex: newIndex });
            }
        }
    };
    const layerIds = layers.map(layer => layer.id);

    return ( /* ... LayerSidebar JSX ... */
        <div className="w-64 bg-gray-100 dark:bg-gray-800 border-l border-gray-300 dark:border-gray-700 flex flex-col flex-shrink-0 h-full overflow-hidden">
            <h3 className="text-lg font-semibold p-2 border-b border-gray-300 dark:border-gray-700 text-center text-gray-800 dark:text-gray-200">Layers</h3>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd} >
                <div className="flex-grow overflow-y-auto">
                    <SortableContext items={layerIds} strategy={verticalListSortingStrategy} >
                        {layers.map((layer) => (
                            <LayerItem key={layer.id} id={layer.id} layer={layer} isActive={layer.id === activeLayerId} />
                        ))}
                    </SortableContext>
                </div>
            </DndContext>
            <div className="p-2 border-t border-gray-300 dark:border-gray-700 flex justify-center space-x-2">
                <button onClick={handleAddLayer} className="px-3 py-1 border rounded bg-blue-500 hover:bg-blue-600 text-white border-blue-600 text-sm" title="Add New Layer" > + Add </button>
                <button onClick={handleDeleteLayer} disabled={layers.length <= 1 || !activeLayerId} className={`px-3 py-1 border rounded text-sm ${layers.length <= 1 || !activeLayerId ? 'bg-gray-400 dark:bg-gray-600 text-gray-700 dark:text-gray-400 cursor-not-allowed' : 'bg-red-500 hover:bg-red-600 text-white border-red-600'}`} title="Delete Selected Layer" > - Delete </button>
            </div>
        </div>
    );
};