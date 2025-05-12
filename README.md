# SpriteStacker 🎨

SpriteStacker is a web-based pixel art application designed for creating pseudo-3D sprites by drawing and stacking multiple 2D layers. It runs entirely in the browser, with no backend required, and supports exporting your creations for various uses, including LVGL v8 projects.

## ✨ Key Features

* **Pixel-Perfect Drawing Canvas:** Create and edit sprites with precise pixel control.
* **Versatile Drawing Tools:**
    * **Pencil:** Draw single pixels or click-and-drag strokes.
    * **Eraser:** Clear pixels on the active layer.
    * **Eyedropper:** Sample colors from any visible pixel on any layer.
    * **Fill Bucket:** Fill contiguous areas with the selected color.
* **Advanced Color Picker:**
    * 16-bit color selection.
    * Hex, RGB, and HSV input methods.
    * Visual swatch grid for quick color selection.
* **Comprehensive Layer Management:**
    * Add, delete, and rename layers.
    * Drag-and-drop reordering of layers.
    * Toggle layer visibility and lock status.
    * Adjust layer opacity for blending effects.
    * Thumbnail preview for each layer.
* **Live 3D-like Preview Panel:**
    * Real-time composite view of all visible layers.
    * Adjustable Z-spacing between layers.
    * Control object "spin" (yaw) around its Y-axis.
    * Adjustable isometric camera pitch for different viewing angles.
* **Canvas Navigation:**
    * Zoom in and out using the mouse scroll wheel.
* **Robust History & Workflow:**
    * Undo/Redo functionality for drawing actions and layer operations.
    * Copy, Cut, and Paste layers.
* **Persistence:**
    * Project state is automatically saved to the browser's localStorage.
* **Project Management:**
    * **New Project:** Start a fresh workspace via a startup dialog (set dimensions, initial layers).
    * **Save Project As:** Download the entire sprite stack project (including layers, history, settings) as a `.ssp` JSON file.
    * **Load Project:** Upload a previously saved `.ssp` file to continue working.
* **Export Options:**
    * **PNG Export:** Download each layer as a separate PNG image.
    * **LVGL Export:** Generate a C header file (`.h`) compatible with LVGL v8, containing image descriptors (`lv_img_dsc_t`) and pixel data arrays for visible layers (formatted for `LV_IMG_CF_TRUE_COLOR_ALPHA`, 16-bit RGB565 + A8).

## 🛠️ Tech Stack

* **Frontend:** React (with TypeScript)
* **Build Tool:** Vite
* **Styling:** Tailwind CSS
* **Drag & Drop:** `@dnd-kit` for layer reordering
* **State Management:** React Context API with `useReducer`
* **Drawing API:** HTML5 Canvas 2D API (no external drawing libraries)
* **Utilities:** `uuid` for unique IDs, `lodash-es` for debouncing.

## 📂 Project Structure

The project follows a standard React application structure:


sprite-stacker/  
├── public/              # Static assets  
├── src/  
│   ├── assets/          # Images, fonts, etc.  
│   ├── components/      # React components (Canvas, Toolbar, LayerSidebar, etc.)  
│   │   ├── Canvas/  
│   │   ├── ColorPicker/  
│   │   ├── LayerSidebar/  
│   │   ├── Preview/  
│   │   ├── StartupModal/  
│   │   └── Toolbar/  
│   ├── hooks/           # Custom React hooks (useCanvasDrawing, useLayerManager, etc.)  
│   ├── state/           # Global state management (AppContext, types, reducer)  
│   ├── utils/           # Utility functions (canvas, color, file, LVGL export)  
│   ├── App.tsx          # Main application component  
│   ├── main.tsx         # Application entry point  
│   └── index.css        # Global styles & Tailwind directives  
├── tests/               # Unit tests (e.g., for useLayerManager)  
├── index.html           # Main HTML file  
├── package.json         # Project dependencies and scripts  
├── vite.config.ts       # Vite configuration  
├── tsconfig.json        # TypeScript configuration  
├── tailwind.config.cjs  # Tailwind CSS configuration  
└── postcss.config.cjs   # PostCSS configuration  


## 🚀 Getting Started

### Prerequisites

* Node.js (v18.x or later recommended)
* npm (v8.x or later) or yarn

### Installation

1.  **Clone the repository:**
    ```bash
    git clone [https://github.com/your-username/sprite-stacker.git](https://github.com/your-username/sprite-stacker.git)
    cd sprite-stacker
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
    (or `yarn install` if you prefer yarn)

### Running the Application

1.  **Development Mode:**
    To start the Vite development server:
    ```bash
    npm run dev
    ```
    This will typically open the application at `http://localhost:5173`. The server supports Hot Module Replacement (HMR).

2.  **Building for Production:**
    To create an optimized production build:
    ```bash
    npm run build
    ```
    The output will be in the `dist/` folder.

3.  **Previewing Production Build:**
    To serve the production build locally for testing:
    ```bash
    npm run preview
    ```

## 📖 How to Use

1.  **New Project:** Upon first visit or after selecting "New" from the File menu, a dialog will prompt you to set the canvas width, height, and initial number of layers.
2.  **Drawing:** Select a tool (Pencil, Eraser, Fill) from the toolbar. Choose a color using the color swatch or the detailed Color Picker. Click or drag on the main canvas to draw on the currently active layer.
3.  **Layer Management:**
    * Use the Layer Sidebar on the right to manage layers.
    * Click a layer to make it active.
    * Use the icons on each layer item to toggle visibility and lock status.
    * Adjust the opacity slider for transparency effects.
    * Drag and drop layers to reorder them.
    * Use the "+ Add" and "- Delete" buttons at the bottom of the sidebar.
4.  **Preview Panel:**
    * The left panel shows a live preview of your stacked sprite.
    * **Z Spacing:** Adjusts the vertical separation between layers in the isometric view.
    * **Object Spin (Yaw):** Rotates the entire sprite stack around its central vertical axis.
    * *(If implemented)* **Camera Pitch:** Adjusts the elevation angle of the isometric camera.
5.  **Toolbar Actions:**
    * **File Menu:** "New", "Save" (downloads a `.ssp` project file), "Load" (uploads a `.ssp` file).
    * **Undo/Redo:** Step backward or forward through your recent actions.
    * **Copy/Cut/Paste:** Manage layers via the clipboard.
    * **Zoom Display:** Shows current zoom level (controlled by mouse scroll wheel over the canvas).
    * **Export PNGs:** Downloads each visible layer as a separate PNG file.
    * **Export LVGL:** Generates and downloads a `.h` C header file for LVGL.

## 🔮 Future Enhancements (Potential Ideas)

* Additional drawing tools (e.g., line, rectangle, circle, selection).
* Customizable color palettes and swatch saving.
* Frame-by-frame animation capabilities.
* More export options (e.g., animated GIF, combined spritesheets).
* Panning functionality for the main canvas.
* Zooming towards the mouse cursor position.
* More robust error handling and user feedback.
* UI options for LVGL export (e.g., `LV_COLOR_16_SWAP`, color depth selection).
* Advanced isometric controls (e.g., separate camera azimuth).

## 🤝 Contributing (Optional)

Contributions are welcome! If you'd like to contribute, please feel free to fork the repository, make your changes, and submit a pull request. For major changes, please open an issue first to discuss what you would like to change.

---

Happy Sprite Stacking!




# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default tseslint.config({
  extends: [
    // Remove ...tseslint.configs.recommended and replace with this
    ...tseslint.configs.recommendedTypeChecked,
    // Alternatively, use this for stricter rules
    ...tseslint.configs.strictTypeChecked,
    // Optionally, add this for stylistic rules
    ...tseslint.configs.stylisticTypeChecked,
  ],
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config({
  plugins: {
    // Add the react-x and react-dom plugins
    'react-x': reactX,
    'react-dom': reactDom,
  },
  rules: {
    // other rules...
    // Enable its recommended typescript rules
    ...reactX.configs['recommended-typescript'].rules,
    ...reactDom.configs.recommended.rules,
  },
})
```
