# 📼 Zine Engine

**Zine Engine** is a local, offline-first digital scrapbook. It bypasses complex web frameworks to give you a drag-and-drop editor that exports 100% static, dependency-free HTML and CSS. You can host it anywhere, share it on a USB drive, or archive it forever.

Here are the principles that guide it:

## Core Principles

1. **Scrapbooking Over Systems:** No databases, CMS, or deployment scripts. Just drag, drop, layer, and save.
2. **The Immutable Canvas:** We reject responsive reflowing. Your layout acts like a physical poster that scales proportionally on any screen to preserve your exact spatial intent.
3. **Vernacular Motion:** There are no complex animation timelines. Motion is achieved strictly through mindful layout and GIFs.
4. **Static Pages, Smart Links:** There is no auto-generated navigation. You connect pages manually, but the engine scans your local folders to make linking easy.
5. **Zero Dependencies:** The downloaded app requires no `npm install`, no cloud accounts, and no internet connection to run.
6. **HTML as the Source of Truth:** The exported output contains no tracking or external libraries. It is purely static, acts as a lossless backup, and will outlast today's platforms.

---

## 🚦 CHOOSE YOUR PATHWAY

Before you proceed, decide how you want to interact with this engine. Choosing the wrong route can lead to unnecessary setup and frustration!

### 🌸 PATH A: I am a Zinester / Artist (I want to make zines!)
You **do not** need to install any development dependencies, compile code, or run npm commands. You can run Zine Engine completely offline and "off the grid."

1. **Do not click the green "Code" button.** Instead, go straight to the [**Releases**](https://github.com/your-username/zine-engine/releases) tab on the right side of this page.
2. Download the `Zine-Engine-Release.zip` from the latest release.
3. Unzip the file anywhere on your computer.
4. Open your terminal or command prompt, navigate to the unzipped folder, and run:
   ```bash
   node run.js
   ```
5. Open [http://localhost:3000/editor/](http://localhost:3000/editor/) in your browser and start designing! Your publications will be saved directly into your local `zine-dist/` folder.

---

### 🔧 PATH B: I am a Mechanic / Contributor (I want to hack the code!)
You want to modify the editor's UI, add new layout components, or hack the core compiler. The codebase is a robust, full-stack application.

*   **Editor Tech Stack:** React, Vite, Tailwind CSS.
*   **Dev Server:** Node.js, Express, Multer.

To start hacking on the engine:

1. Clone this repository to your local machine:
   ```bash
   git clone https://github.com/your-username/zine-engine.git
   cd zine-engine
   ```
2. Install all development dependencies:
   ```bash
   npm install
   ```
3. Boot the development workspace:
   ```bash
   npm run dev
   ```
4. Modify files in `editor/` and `src/` to your heart's content. To compile changes for the distribution build, run:
   ```bash
   npm run build
   ```

---

## 🎨 Architectural Overview

Zine Engine maintains a strict separation between **The Factory** (the source code and editor environment) and **The Tool** (the zero-dependency standalone package):

*   `editor/` contains the static HTML/CSS/JS files for the publishing interface.
*   `server.js` is the full Express-based server used during development.
*   `server/run.js` is a tiny, native Node.js HTTP server that handles static asset serving and local file persistence using *only* standard Node modules. It is bundled as `run.js` in the final release package.
*   `zine-dist/` is the storage folder where the editor compiles and writes your custom pages (layouts, index.html files, uploaded image assets, and `state.json` templates).
