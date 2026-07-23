# 📼 Zine Engine — Freeform Web Page Builder

An offline-first, Miro-style freeform drag-and-drop web page builder that exports 100% static, zero-dependency HTML & CSS into `dist/`.

---

## 1. Project Overview

**Zine Engine** is a client-side freeform drag-and-drop web page builder designed for creating custom layouts without being constrained by rigid grid systems or heavy CMS frameworks. It combines an infinite 2D canvas with direct manipulation tools (drag, resize, rotate, snap) and exports production-ready, zero-dependency static HTML & CSS files.

### Core Features
- **Freeform Canvas Interaction**: Position, scale, rotate, and layer elements directly on a responsive 2D canvas.
- **Pure Static Output**: Generates pure HTML & CSS requiring zero runtime JavaScript, no external UI frameworks, and no backend server dependencies to render.
- **In-Browser Persistence**: State is maintained in-memory and saved client-side with full undo/redo capabilities.

---

## 2. The Two-Stage Build Architecture

Zine Engine maintains a strict separation between application compilation and runtime site generation through two distinct build pipelines:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                 STAGE 1: EDITOR APP BUILD (Developer / CI)                   │
│   npm run build  ──►  Vite + vite-plugin-singlefile                         │
│   Source: editor/index.html & src/editor/*                                  │
│   Output: Standalone Editor Application (editor/index.html)                 │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│             STAGE 2: STATIC HTML GENERATOR (In-Browser User Runtime)        │
│   User clicks "Build / Export" inside Editor UI                            │
│   Source: Zustand Canvas State & User Layout Elements                       │
│   Output: Clean Static HTML/CSS directly to dist/                           │
│           (e.g., dist/index.html, dist/about/index.html)                    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Stage 1: The Editor App Build (`npm run build`)
- **Trigger**: Executed by developers or build server via terminal (`npm run build`).
- **Tooling**: Vite bundled with `vite-plugin-singlefile`.
- **Input**: Source code inside `editor/index.html` and `src/editor/*` (editor controls, inspector panels, Moveable handles, Zustand store, Panzoom canvas).
- **Output**: A compiled, self-contained standalone editor application shell.
- **Rule**: This step compiles the editing tool itself and does NOT modify or inject editor code into `dist/`.

### Stage 2: The Static HTML Generator (Runtime Exporter)
- **Trigger**: Executed strictly inside the running Editor App when the end-user clicks **"Build / Export"** in the top control bar.
- **Tooling**: In-browser DOM & CSS compiler engine embedded in the editor (`src/editor/exporter.ts`).
- **Input**: User-created canvas elements, positioning coordinates, typography options, and color palettes stored in the Zustand state engine.
- **Output**: Production-ready static HTML and CSS written directly to `dist/`:
  - Homepage: `dist/index.html`
  - Custom Paths: `dist/about/index.html`, `dist/contact/index.html`, etc.
- **Rule**: Zero editor scripts, toolbar styles, bounding boxes, or builder handles are included in these output files.

---

## 3. Strict Directory & Style Isolation

To guarantee that exported websites remain lightweight and pristine, Zine Engine enforces strict isolation between the editor app and the generated website output:

- **Isolated Editor Workspace (`editor/` and `src/editor/`)**: All editing mechanisms, UI toolbars, floating property panels, canvas overlays, transform handles (`Moveable`), and state stores reside strictly within the editor context.
- **Clean Output Directory (`dist/`)**: The `dist/` folder is reserved exclusively for user-generated static pages (HTML files, CSS stylesheets, and user uploaded media assets).
- **Zero Style Leakage**:
  - Editor-only stylesheets, Tailwind builder utilities, and Moveable control overlays are stripped during static export.
  - Exported pages rely on inline atomic CSS / self-contained styles generated directly from layout data.
  - Final static pages render cleanly in any browser without needing `Moveable`, `Panzoom`, `Zustand`, or any external JavaScript libraries.

---

## 4. Tech Stack & Core Dependencies

The editor application leverages a focused set of open-source primitives and tools:

| Dependency | Purpose / Role |
| :--- | :--- |
| **Vite + `vite-plugin-singlefile`** | Single-file application bundling and fast development server execution. |
| **Moveable** (`moveable`) | High-performance handles for element dragging, resizing, rotation, and alignment snapping. |
| **Panzoom** (`panzoom`) | Smooth canvas panning and zooming for the infinite 2D workspace. |
| **Zustand + Zundo** (`zustand`, `zundo`) | Centralized reactive state management with an automated undo/redo history stack. |
| **Lucide Icons** (`lucide`) | Vector icon suite for editor toolbars, layer panels, and inspector controls. |
| **Floating UI** (`@floating-ui/dom`) | Precise positioning for floating context toolbars and property popovers. |
| **Hotkeys.js** (`hotkeys-js`) | Global keyboard shortcut handling (`Cmd+Z`, `Delete`, `Cmd+D`, arrow key nudging). |
| **Pickr** (`@simonwep/pickr`) | Vanilla color picker supporting HEX, RGBA, gradients, and opacity controls. |

---

## 5. Directory Structure

Below is an overview of the workspace structure:

```
zine-engine/
├── dist/                    # Isolated target output for user-generated static sites
│   └── index.html           # Compiled static user homepage (clean output)
├── editor/                  # Standalone Editor Application
│   └── index.html           # Main Editor UI HTML entry point
├── src/                     # TypeScript Application Source
│   └── editor/              # Isolated Editor Architecture
│       ├── canvas-renderer.ts # DOM Canvas synthesizer & element renderer
│       ├── color-picker.ts    # Pickr color selection wrapper
│       ├── exporter.ts       # In-browser Static HTML & CSS Compiler Engine
│       ├── hotkeys.ts        # Keyboard shortcuts manager
│       ├── icons.ts          # Lucide vector icon manager
│       ├── main.ts           # Editor studio orchestrator & UI bindings
│       ├── overlay.ts        # Inline text editor overlay
│       ├── store.ts          # Zustand state store & history management
│       ├── types.ts          # Data models and element definitions
│       └── utils.ts          # Utility functions
├── .env.example             # Environment variable template
├── build.js                 # Custom production build pipeline script
├── metadata.json            # AI Studio applet metadata
├── package.json             # Dependencies and build scripts
├── server.js                # Express dev server & API endpoint proxy
├── tsconfig.json            # TypeScript compiler configuration
└── vite.config.ts           # Vite build configuration
```

---

## 6. Development & Usage Guide

### Prerequisites
- **Node.js**: `v18.0.0` or higher
- **npm**: `v9.0.0` or higher

### Local Development Setup

1. **Install Dependencies**:
   ```bash
   npm install
   ```

2. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Access the running application at `http://localhost:3000`.

3. **Compile Standalone Editor App**:
   ```bash
   npm run build
   ```
   Executes `build.js` which invokes Vite to bundle the editor application.

### Operating the Editor to Generate `dist/`

1. **Open the Editor**: Navigate to `http://localhost:3000` in your web browser.
2. **Design Your Page**:
   - Add text blocks, shapes, frames, or upload images.
   - Drag, resize, rotate, and snap elements into place on the canvas.
   - Use Panzoom to navigate around the workspace.
   - Adjust colors, fonts, blend modes, and element hierarchy.
3. **Export Static Website**:
   - Click the **"Build / Export"** button in the top toolbar.
   - The embedded HTML compiler engine compiles the current canvas state into pure, zero-dependency HTML and CSS files directly inside the `dist/` directory.
   - You can publish or deploy the contents of `dist/` directly to any static web host (GitHub Pages, Vercel, Netlify, Cloudflare Pages, S3).
