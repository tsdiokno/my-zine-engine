const fs = require('fs');

let mainTs = fs.readFileSync('src/editor/main.ts', 'utf8');

// Pages & Text Alignment Wiring
const pagesWiring = `
  // Text Alignment
  ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'].forEach((id, i) => {
    const btn = document.getElementById(id);
    const aligns = ['left', 'center', 'right', 'justify'];
    if (btn) {
      btn.addEventListener('click', () => {
        updateActive({ textAlign: aligns[i] });
      });
    }
  });

  // Pages
  const pageSelect = document.getElementById('pageSelect');
  if (pageSelect) {
    pageSelect.addEventListener('change', async (e) => {
      const targetPage = e.target.value;
      await savePageState(false);
      editorStore.setState({ activePage: targetPage, elements: [] });
      loadPageState(targetPage);
    });
  }

  const addPageBtn = document.getElementById('addPageBtn');
  if (addPageBtn) {
    addPageBtn.addEventListener('click', async () => {
      const pageName = prompt('Enter new page route/name (e.g. /about):');
      if (!pageName) return;
      try {
        await fetch('/api/pages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: pageName, title: pageName })
        });
        await loadPagesList(pageName);
        editorStore.setState({ activePage: pageName, elements: [] });
        loadPageState(pageName);
      } catch (err) {}
    });
  }

  const duplicatePageBtn = document.getElementById('duplicatePageBtn');
  if (duplicatePageBtn) {
    duplicatePageBtn.addEventListener('click', async () => {
      const active = editorStore.getState().activePage;
      const pageName = prompt('Enter new page route for duplication (e.g. /about-copy):');
      if (!pageName) return;
      await savePageState(false);
      try {
        await fetch('/api/duplicate-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sourcePath: active, targetPath: pageName })
        });
        await loadPagesList(pageName);
        editorStore.setState({ activePage: pageName, elements: [] });
        loadPageState(pageName);
      } catch (err) {}
    });
  }
`;

if (!mainTs.includes("const pageSelect = document.getElementById('pageSelect');\\n  if (pageSelect) {")) {
  mainTs = mainTs.replace("const undoBtn = document.getElementById('undoBtn');", pagesWiring + "\\n  const undoBtn = document.getElementById('undoBtn');");
}

// Fix undo disabled state
const undoFixCode = `
    const undoBtn = document.getElementById('undoBtn');
    if (undoBtn) {
      const hasUndo = state.undoStack.length > 0;
      undoBtn.disabled = !hasUndo;
      undoBtn.style.opacity = hasUndo ? '1' : '0.5';
      undoBtn.style.pointerEvents = hasUndo ? 'auto' : 'none';
    }
    const redoBtn = document.getElementById('redoBtn');
    if (redoBtn) {
      const hasRedo = state.redoStack.length > 0;
      redoBtn.disabled = !hasRedo;
      redoBtn.style.opacity = hasRedo ? '1' : '0.5';
      redoBtn.style.pointerEvents = hasRedo ? 'auto' : 'none';
    }
    
    // Set Text alignment active state
    ['alignLeft', 'alignCenter', 'alignRight', 'alignJustify'].forEach((id, i) => {
      const btn = document.getElementById(id);
      const aligns = ['left', 'center', 'right', 'justify'];
      if (btn) {
        if (el && el.textAlign === aligns[i]) {
          btn.classList.add('active');
          btn.style.background = '#3b82f6';
        } else {
          btn.classList.remove('active');
          btn.style.background = 'transparent';
        }
      }
    });
`;

if (!mainTs.includes("undoBtn.disabled = !hasUndo;")) {
  mainTs = mainTs.replace("const isLinked = el.linkPadding !== false;", undoFixCode + "\\n    const isLinked = el.linkPadding !== false;");
}

fs.writeFileSync('src/editor/main.ts', mainTs, 'utf8');
