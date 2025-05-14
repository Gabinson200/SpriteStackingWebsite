// src/state/AppContext.tsx
import React, { createContext, useContext, useReducer} from 'react';
import type { ReactNode } from 'react';

import type{ AppState, LayerAction } from './types';
import { layerReducer, initialAppState } from '../hooks/useLayerManager'; // We'll define this reducer soon

interface AppContextProps {
  state: AppState;
  dispatch: React.Dispatch<LayerAction>;
}

const AppContext = createContext<AppContextProps | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  // We'll use the reducer from our custom hook here
  const [state, dispatch] = useReducer(layerReducer, initialAppState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = (): AppContextProps => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};