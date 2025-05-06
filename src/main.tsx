// src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import { AppProvider } from './state/AppContext.tsx' // Import the provider
import './index.css' // Import Tailwind base styles

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {/* Wrap the entire App with the context provider */}
    <AppProvider>
      <App />
    </AppProvider>
  </React.StrictMode>,
)