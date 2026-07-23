/**
 * =============================================================================
 * MODULE: Zine Visual Editor Main Entry Point (`/src/editor/main.ts`)
 * SINGLE RESPONSIBILITY:
 *   Main orchestrator for the visual studio. Binds store state changes to DOM updates,
 *   initializes drag-and-drop spatial manipulators, binds properties panel inputs,
 *   handles global hotkeys, and syncs asynchronous RPC states with server.
 * =============================================================================
 */

import { editorStore, CANVAS_BASELINE_WIDTH } from './store';

// ==========================================
// WIRE-TRACKER DIAGNOSTIC TELEMETRY SYSTEM
// ==========================================
const WireTracker = {
  logAction: (action, details) => {
    console.log(`%c[ACTION: ${action}]`, 'color: #3b82f6; font-weight: bold;', details || '');
  },
  logState: (key, value) => {
    console.log(`%c[STATE: ${key} updated]`, 'color: #10b981; font-weight: bold;', value);
  },
  logCanvas: (id, msg) => {
    console.log(`%c[CANVAS: Element ID ${id}]`, 'color: #f59e0b; font-weight: bold;', msg);
  },
  validateSync: (checkName, expected, actual, el) => {
    if (String(expected) === String(actual) || (expected == null && actual === '')) {
      console.log(`%c[SYNC VALIDATION: Pass] ${checkName}`, 'color: #10b981; font-weight: bold;');
    } else {
      console.error(`%c[SYNC VALIDATION: Fail] ${checkName} | Expected: ${expected}, Actual: ${actual}`, 'color: #ef4444; font-weight: bold;', el);
    }
  }
};
window.WireTracker = WireTracker;

// Intercept store updates
const originalSet = editorStore.setState;
editorStore.setState = (partial, replace) => {
  const nextState = typeof partial === 'function' ? partial(editorStore.getState()) : partial;
  if (nextState.elements) {
     const diffs = nextState.elements.map((el, i) => {
       const prev = editorStore.getState().elements[i];
       if (JSON.stringify(el) !== JSON.stringify(prev)) return { idx: i, el };
       return null;
     }).filter(Boolean);
     diffs.forEach(d => {
       WireTracker.logState(`Element ${d.idx}`, d.el);
     });
  }
  return originalSet(partial, replace);
};

import { createColorPicker } from './color-picker';
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';
import { renderCanvas } from './canvas-renderer';
import { startInlineEditing, exitAllTextEditing } from './overlay';
import { triggerSuccessConfetti, hexToRgba } from './utils';
import { ZineElement, PageInfo } from './types';
import { initHotkeys } from './hotkeys';
import { initializeIcons } from './icons';
import { downloadClientSideHtml } from './exporter';
import { updateMoveable, destroyMoveable } from './moveable-controller';

// Global Pointer State
let activeElementIdx: number | null = null;

/**
 * Initializes store subscription listeners and binds window DOM events.
 */
function initEditor(): void {
  initializeIcons();
  initHotkeys(() => savePageState(true));

  // Subscribe to store updates to re-render canvas and sync UI controls
  editorStore.subscribe((state, prevState) => {
    if (
      state.elements !== prevState.elements ||
      state.backgroundColor !== prevState.backgroundColor ||
      state.canvasX !== prevState.canvasX ||
      state.horizontalScroll !== prevState.horizontalScroll
    ) {
      renderCanvas();
      initializeIcons();
      updatePropertiesPanelUI();
      updateSaveButtonUI();
    } else if (
      state.selectedIndices !== prevState.selectedIndices ||
      state.activeElementIndex !== prevState.activeElementIndex
    ) {
      // Just update selection UI without a full DOM re-render
      updateSelectionUI();
      updatePropertiesPanelUI();
      updateSaveButtonUI();
      updateMoveable();
    }
  });

  bindGlobalEvents();
  bindUIControls();
  bindCanvasPointerEvents();

  const savedPage = localStorage.getItem('zine-active-page') || '/';
  loadPagesList(savedPage).then(() => {
    loadPageState(savedPage);
  });
}

/**
 * Binds global keyboard hotkeys (Undo, Redo, Delete, Arrow key nudging).
 */
function bindGlobalEvents(): void {
  document.addEventListener('keydown', (e: KeyboardEvent) => {
    const isEditingText = document.querySelector('.element-content-wrapper[contenteditable="true"]') !== null;
    if (isEditingText) return;

    const isInputFocused = ['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName);
    if (isInputFocused) return;

    const isCmdOrCtrl = e.metaKey || e.ctrlKey;

    if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      editorStore.getState().undo();
      return;
    }

    if ((isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === 'z') || (isCmdOrCtrl && e.key.toLowerCase() === 'y')) {
      e.preventDefault();
      editorStore.getState().redo();
      return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault();
      editorStore.getState().pushUndoState();
      editorStore.getState().deleteSelectedElements();
      return;
    }

    if (isCmdOrCtrl && e.key.toLowerCase() === 'd') {
      e.preventDefault();
      editorStore.getState().pushUndoState();
      editorStore.getState().duplicateSelectedElements();
      return;
    }

    if (isCmdOrCtrl && e.key.toLowerCase() === 's') {
      e.preventDefault();
      savePageState(true);
      return;
    }

    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      const state = editorStore.getState();
      const targets = state.selectedIndices.length > 0
        ? state.selectedIndices
        : (state.activeElementIndex !== null ? [state.activeElementIndex] : []);

      if (targets.length === 0) return;
      e.preventDefault();

      state.pushUndoState();
      const delta = e.shiftKey ? 10 : 1;

      targets.forEach((idx) => {
        const el = state.elements[idx];
        if (!el) return;
        let nx = el.x;
        let ny = el.y;
        if (e.key === 'ArrowLeft') nx -= delta * 0.5;
        if (e.key === 'ArrowRight') nx += delta * 0.5;
        if (e.key === 'ArrowUp') ny -= delta * 0.5;
        if (e.key === 'ArrowDown') ny += delta * 0.5;
        state.updateElement(idx, { x: parseFloat(nx.toFixed(2)), y: parseFloat(ny.toFixed(2)) });
      });
    }
  });

  document.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    const canvas = document.getElementById('canvas');
    const propertiesPanel = document.getElementById('properties-panel');
    const toolbar = document.getElementById('toolbar');

    const clickedInEditable = target.closest('.element-content-wrapper[contenteditable="true"]') !== null;
    if (!clickedInEditable) {
      exitAllTextEditing();
    }

    // Deselect if clicking outside canvas and properties panel
    if (
      canvas &&
      !canvas.contains(target) &&
      (!propertiesPanel || !propertiesPanel.contains(target)) &&
      (!toolbar || !toolbar.contains(target))
    ) {
      editorStore.getState().setSelectedIndices([]);
    }

    // Deselect if clicking on canvas background directly (not an element or moveable control)
    if (
      canvas &&
      canvas.contains(target) &&
      !target.closest('.editor-element') &&
      !target.closest('.moveable-control-box')
    ) {
      editorStore.getState().setSelectedIndices([]);
    }
  });

  const canvas = document.getElementById('canvas');
  if (canvas) {
    canvas.addEventListener('dblclick', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const div = target.closest('.editor-element') as HTMLElement | null;
      if (div) {
        const idxAttr = div.getAttribute('data-index');
        if (idxAttr !== null) {
          const idx = parseInt(idxAttr, 10);
          const state = editorStore.getState();
          if (state.elements[idx] && state.elements[idx].type === 'text') {
            startInlineEditing(idx);
          }
        }
      }
    });
  }
}

/**
 * Updates DOM classes for selection without a full re-render
 */
function updateSelectionUI(): void {
  const state = editorStore.getState();
  const canvas = document.getElementById('canvas');
  if (!canvas) return;
  const elements = canvas.querySelectorAll('.editor-element');
  elements.forEach((el) => {
    const idxAttr = el.getAttribute('data-index');
    if (idxAttr === null) return;
    const idx = parseInt(idxAttr, 10);
    const isSelected = state.selectedIndices.includes(idx);
    const isActive = state.activeElementIndex === idx;
    if (isActive) {
      el.classList.add('active');
    } else {
      el.classList.remove('active');
    }
    if (isSelected) {
      el.classList.add('selected-element');
    } else {
      el.classList.remove('selected-element');
    }
  });
}

/**
 * Attaches direct pointer drag, resize, and rotate handlers on `#canvas`.
 */
function bindCanvasPointerEvents(): void {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    // Don't interfere if clicking Moveable controls
    if (target.closest('.moveable-control-box')) return;
    
    const div = target.closest('.editor-element') as HTMLElement | null;
    if (!div) return;

    const idxAttr = div.getAttribute('data-index');
    if (idxAttr === null) return;
    const idx = parseInt(idxAttr, 10);
    const state = editorStore.getState();
    const el = state.elements[idx];
    if (!el) return;

    if (state.activeElementIndex !== idx) {
      state.selectElement(idx, e.shiftKey);
      activeElementIdx = idx;
    }
  });
}

/**
 * Binds UI toolbar buttons and input fields in properties inspector to store actions.
 */
function bindUIControls(): void {
  const getActiveIdx = () => editorStore.getState().activeElementIndex;
  const updateActive = (changes: Partial<ZineElement>) => {
    const idx = getActiveIdx();
    if (idx !== null) {
      editorStore.getState().updateElement(idx, changes);
    }
  };

  // Undo & Redo buttons
  
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
const undoBtn = document.getElementById('undoBtn');
  const redoBtn = document.getElementById('redoBtn');
  if (undoBtn) undoBtn.addEventListener('click', () => editorStore.getState().undo());
  if (redoBtn) redoBtn.addEventListener('click', () => editorStore.getState().redo());

  // Save & Export buttons
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => savePageState(true));

  const exportBtn = document.getElementById('exportHtmlBtn') || document.getElementById('exportBtn');
  if (exportBtn) {
    exportBtn.addEventListener('click', async () => {
      await savePageState(false);
      const state = editorStore.getState();
      downloadClientSideHtml(state.elements, state.backgroundColor, state.googleFonts, 'zine-page.html');
    });
  }

  // Add Element buttons
  const addTextBtn = document.getElementById('addTextBtn');
  if (addTextBtn) {
    addTextBtn.addEventListener('click', () => {
      editorStore.getState().pushUndoState();
      editorStore.getState().addElement({
        type: 'text',
        x: 10,
        y: 20,
        w: 80,
        content: 'New Headline',
        text: 'New Headline',
        fontSize: 9,
        fontFamily: 'Syne',
        fontWeight: '900',
        color: '#ffffff',
        textAlign: 'center',
        blendMode: 'normal',
      });
    });
  }

  const addRectBtn = document.getElementById('addRectBtn') || document.getElementById('addShapeBtn');
  if (addRectBtn) {
    addRectBtn.addEventListener('click', () => {
      editorStore.getState().pushUndoState();
      editorStore.getState().addElement({
        type: 'shape',
        shapeType: 'rectangle',
        x: 15,
        y: 25,
        w: 70,
        h: 30,
        fillType: 'solid',
        fillColor: '#3b82f6',
        blendMode: 'normal',
      });
    });
  }
  
  // Image Upload Logic
  const addImageBtn = document.getElementById('addImageBtn');
  fileUploader = document.getElementById('fileUploader') as HTMLInputElement | null;
  if (addImageBtn && fileUploader) {
    addImageBtn.addEventListener('click', () => {
      fileUploader.click();
    });
    fileUploader.addEventListener('change', async (e) => {
      const target = e.target as HTMLInputElement;
      if (!target.files || target.files.length === 0) return;
      const file = target.files[0];
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const pagePath = editorStore.getState().activePage || '/';
        const res = await fetch(`/api/upload?page=${encodeURIComponent(pagePath)}`, {
          method: 'POST',
          body: formData
        });
        if (!res.ok) throw new Error('Upload failed');
        const data = await res.json();
        editorStore.getState().pushUndoState();
        editorStore.getState().addElement({
          type: 'image',
          src: data.filename,
          x: 20,
          y: 20,
          w: 60,
          opacity: 1,
          blendMode: 'normal'
        });
      } catch (err) {
        console.error(err);
        alert('Failed to upload image.');
      }
      
      // Reset input
      fileUploader.value = '';
    });
  }

  const deleteBtn = document.getElementById('deleteBtn') || document.getElementById('deleteElementBtn');
  if (deleteBtn) {
    deleteBtn.addEventListener('click', () => {
      editorStore.getState().pushUndoState();
      editorStore.getState().deleteSelectedElements();
    });
  }

  const duplicateBtn = document.getElementById('duplicateBtn');
  if (duplicateBtn) {
    duplicateBtn.addEventListener('click', () => {
      editorStore.getState().pushUndoState();
      editorStore.getState().duplicateSelectedElements();
    });
  }

  // --- Property Control Event Listener Bindings ---
  const bindInput = (id: string, propKey: keyof ZineElement, transform?: (val: any) => any) => {
    const input = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (!input) return;
    const handler = () => {
      const rawVal = input.type === 'checkbox' ? (input as HTMLInputElement).checked : input.value;
      const val = transform ? transform(rawVal) : rawVal;
      updateActive({ [propKey]: val });
    };
    input.addEventListener('input', handler);
    input.addEventListener('change', handler);
  };

  bindInput('propX', 'x', (v) => parseFloat(v) || 0);
  bindInput('propY', 'y', (v) => parseFloat(v) || 0);
  
  bindInput('propH', 'h', (v) => parseFloat(v) || 0);
  bindInput('propShadowEnable', 'shadowEnable', null, true);
  bindInput('propW', 'w', (v) => parseFloat(v) || 10);
  bindInput('propH', 'h', (v) => parseFloat(v) || 10);
  bindInput('propOpacity', 'opacity', (v) => (parseFloat(v) || 100) / 100);
  bindInput('propRotate', 'rotate', (v) => parseInt(v, 10) || 0);
  bindInput('propRotateX', 'rotateX', (v) => parseInt(v, 10) || 0);
  bindInput('propRotateY', 'rotateY', (v) => parseInt(v, 10) || 0);
  bindInput('propSkewX', 'skewX', (v) => parseInt(v, 10) || 0);
  bindInput('propSkewY', 'skewY', (v) => parseInt(v, 10) || 0);

  // Text properties
  bindInput('propS', 'fontSize', (v) => parseFloat(v) || 4);
  bindInput('propFont', 'fontFamily');
  const propText = document.getElementById('propText') as HTMLTextAreaElement | null;
  if (propText) {
    const handleText = () => {
      updateActive({ content: propText.value, text: propText.value });
    };
    propText.addEventListener('input', handleText);
    propText.addEventListener('change', handleText);
  }
  bindInput('propTracking', 'tracking', (v) => String(v));
  bindInput('propLeading', 'leading', (v) => parseFloat(v) || 1.2);

  // Alignment buttons
  ['Left', 'Center', 'Right', 'Justify'].forEach((align) => {
    const btn = document.getElementById(`align${align}`);
    if (btn) {
      btn.addEventListener('click', () => {
        updateActive({ textAlign: align.toLowerCase() });
      });
    }
  });

  // Fills & Colors
  bindInput('propFillType', 'fillType');
  const propColor = document.getElementById('propColor') as HTMLInputElement | null;
  if (propColor) {
    const handleColor = () => {
      const idx = getActiveIdx();
      if (idx === null) return;
      const el = editorStore.getState().elements[idx];
      if (el.type === 'text') {
        updateActive({ color: propColor.value });
      } else {
        updateActive({ fillColor: propColor.value });
      }
    };
    propColor.addEventListener('input', handleColor);
    propColor.addEventListener('change', handleColor);
  }

  bindInput('propGradAngle', 'gradientAngle', (v) => parseInt(v, 10) || 45);
  setupFloatingUI();

  bindInput('propGradStart', 'gradientColorStart');
  bindInput('propGradEnd', 'gradientColorEnd');
  bindInput('propBgImageInput', 'bgImage');
  bindInput('propBgImageMode', 'bgImageMode');

  // Shape properties
  bindInput('propShapeType', 'shapeType');
  bindInput('propBorderRadius', 'borderRadius', (v) => parseInt(v, 10) || 0);
  bindInput('propStrokeColor', 'strokeColor');
  bindInput('propStrokeWidth', 'strokeWidth', (v) => parseInt(v, 10) || 0);
  bindInput('propCustomSvgPath', 'customSvgPath');

  // Universal Border & Shadows
  bindInput('propBorderWidth', 'borderWidth', (v) => parseInt(v, 10) || 0);
  bindInput('propBorderStyle', 'borderStyle');
  bindInput('propBorderColor', 'borderColor');
  bindInput('propElementBorderRadius', 'elementBorderRadius', (v) => parseInt(v, 10) || 0);

  // Image Fill Upload
  const bgImageBtn = document.getElementById('propBgImageUploadBtn');
  fileUploader = document.getElementById('fileUploader');
  if (bgImageBtn && fileUploader) {
    bgImageBtn.addEventListener('click', () => {
      // Temporarily override the uploader logic for background image
      const oldChange = fileUploader.onchange;
      fileUploader.onchange = async (e) => {
        const target = e.target;
        if (!target.files || target.files.length === 0) return;
        const formData = new FormData();
        formData.append('file', target.files[0]);
        try {
          const res = await fetch(`/api/upload?page=${encodeURIComponent(editorStore.getState().activePage || '/')}`, {
            method: 'POST', body: formData
          });
          const data = await res.json();
          const idx = getActiveIdx();
          if (idx !== null) {
            updateActive({ bgImage: data.filename });
            const input = document.getElementById('propBgImageInput');
            if (input) input.value = data.filename;
          }
        } catch (err) {}
        fileUploader.value = '';
        fileUploader.onchange = oldChange;
      };
      fileUploader.click();
    });
  }

  bindInput('propBgImageInput', 'bgImage');
  bindInput('propBgImageMode', 'bgImageMode');
  bindInput('propSvgPresets', 'customSvgPath');
  bindInput('propCustomSvgPath', 'customSvgPath');

  // Padding
  bindInput('propPaddingAll', 'paddingTop', (v) => parseFloat(v));
  const padAll = document.getElementById('propPaddingAll');
  if (padAll) {
    padAll.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      updateActive({ paddingTop: v, paddingRight: v, paddingBottom: v, paddingLeft: v });
    });
  }
  
  const linkPad = document.getElementById('propLinkPadding');
  if (linkPad) {
    linkPad.addEventListener('change', (e) => {
      const isLinked = e.target.checked;
      document.getElementById('propLinkedPaddingGroup').style.display = isLinked ? 'flex' : 'none';
      document.getElementById('propIndividualPaddingGroup').style.display = isLinked ? 'none' : 'flex';
      updateActive({ linkPadding: isLinked });
    });
  }

  bindInput('propPaddingTop', 'paddingTop', (v) => parseFloat(v));
  bindInput('propPaddingRight', 'paddingRight', (v) => parseFloat(v));
  bindInput('propPaddingBottom', 'paddingBottom', (v) => parseFloat(v));
  bindInput('propPaddingLeft', 'paddingLeft', (v) => parseFloat(v));

  // Hyperlinks
  const hpType = document.getElementById('propHyperlinkType');
  if (hpType) {
    hpType.addEventListener('change', (e) => {
      const v = e.target.value;
      updateActive({ hyperlinkType: v });
      document.getElementById('propLinkPageGroup').style.display = v === 'page' ? 'block' : 'none';
      document.getElementById('propLinkAnchorGroup').style.display = v === 'anchor' ? 'block' : 'none';
      document.getElementById('propLinkExternalGroup').style.display = v === 'external' ? 'block' : 'none';
      document.getElementById('propLinkTargetGroup').style.display = (v !== 'none') ? 'block' : 'none';
    });
  }
  
  bindInput('propLinkPageSelect', 'hyperlink');
  bindInput('propLinkAnchorSelect', 'hyperlink');
  bindInput('propLinkAnchorInput', 'hyperlink');
  bindInput('propLinkExternalInput', 'hyperlink');
  bindInput('propLinkTarget', 'hyperlinkTarget');
  
  // Shadows
  const shadowEnable = document.getElementById('propShadowEnable');
  if (shadowEnable) {
    shadowEnable.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      updateActive({ shadowEnable: enabled });
      document.getElementById('shadowControlsGroup').style.display = enabled ? 'block' : 'none';
    });
  }

  const addShadowBtn = document.getElementById('addShadowBtn');
  if (addShadowBtn) {
    addShadowBtn.addEventListener('click', () => {
      const idx = getActiveIdx();
      if (idx === null) return;
      const el = editorStore.getState().elements[idx];
      const shadows = el.shadows ? [...el.shadows] : [];
      shadows.push({ x: 4, y: 4, blur: 8, color: '#000000', opacity: 0.5 });
      updateActive({ shadows });
      renderShadowList(shadows);
    });
  }

  function renderShadowList(shadows) {
    const container = document.getElementById('shadowListContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!shadows) return;
    
    shadows.forEach((shadow, i) => {
      const shadowDiv = document.createElement('div');
      shadowDiv.style = "background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 8px;";
      shadowDiv.innerHTML = `
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 10px; color: #a1a1aa;">Shadow ${i + 1}</span>
          <span style="font-size: 10px; color: #ef4444; cursor: pointer;" onclick="window.removeShadow(${i})">Remove</span>
        </div>
        <div class="slider-row">
          <input type="range" class="s-x" min="-50" max="50" value="${shadow.x}" style="width:40px;">
          <input type="range" class="s-y" min="-50" max="50" value="${shadow.y}" style="width:40px;">
          <input type="range" class="s-b" min="0" max="50" value="${shadow.blur}" style="width:40px;">
        </div>
        <div style="display: flex; gap: 4px; margin-top: 4px;">
          <input type="color" class="s-c" value="${shadow.color}" style="height: 24px; padding: 0;">
          <input type="range" class="s-o" min="0" max="1" step="0.05" value="${shadow.opacity}">
        </div>
      `;
      
      const updateS = () => {
        const idx = getActiveIdx();
        if (idx === null) return;
        const el = editorStore.getState().elements[idx];
        const newShadows = [...el.shadows];
        newShadows[i] = {
          x: parseFloat(shadowDiv.querySelector('.s-x').value),
          y: parseFloat(shadowDiv.querySelector('.s-y').value),
          blur: parseFloat(shadowDiv.querySelector('.s-b').value),
          color: shadowDiv.querySelector('.s-c').value,
          opacity: parseFloat(shadowDiv.querySelector('.s-o').value)
        };
        updateActive({ shadows: newShadows });
      };
      
      shadowDiv.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', updateS);
      });
      container.appendChild(shadowDiv);
    });
  }
  
  window.removeShadow = (i) => {
    const idx = getActiveIdx();
    if (idx === null) return;
    const el = editorStore.getState().elements[idx];
    const newShadows = [...el.shadows];
    newShadows.splice(i, 1);
    updateActive({ shadows: newShadows });
    renderShadowList(newShadows);
  };

  bindInput('propShadowEnable', 'shadowEnable');
  bindInput('propBlend', 'blendMode');

  // Hyperlinks & Custom Identifiers
  bindInput('propCustomId', 'customId');
  bindInput('propHyperlinkType', 'hyperlinkType');
  bindInput('propLinkExternalInput', 'hyperlink');
  bindInput('propLinkTarget', 'hyperlinkTarget');

  // Canvas background controls
  const bgColorInput = document.getElementById('bgColor') as HTMLInputElement | null;
  if (bgColorInput) {
    const handleBg = () => editorStore.getState().setBackgroundColor(bgColorInput.value);
    bgColorInput.addEventListener('input', handleBg);
    bgColorInput.addEventListener('change', handleBg);
  }

  const canvasXSlider = document.getElementById('canvasXSlider') as HTMLInputElement | null;
  if (canvasXSlider) {
    canvasXSlider.addEventListener('input', () => {
      editorStore.getState().setCanvasX(parseInt(canvasXSlider.value, 10) || 50);
    });
  }

  const alignCanvasLeft = document.getElementById('alignCanvasLeft');
  if (alignCanvasLeft) alignCanvasLeft.addEventListener('click', () => editorStore.getState().setCanvasX(0));
  const alignCanvasCenter = document.getElementById('alignCanvasCenter');
  if (alignCanvasCenter) alignCanvasCenter.addEventListener('click', () => editorStore.getState().setCanvasX(50));
  const alignCanvasRight = document.getElementById('alignCanvasRight');
  if (alignCanvasRight) alignCanvasRight.addEventListener('click', () => editorStore.getState().setCanvasX(100));

  const toggleHorizScroll = document.getElementById('toggleHorizScroll') as HTMLInputElement | null;
  if (toggleHorizScroll) {
    toggleHorizScroll.addEventListener('change', () => {
      editorStore.getState().setHorizontalScroll(toggleHorizScroll.checked);
    });
  }
}

/**
 * Updates properties inspector panel inputs to match currently selected element.
 */
function updatePropertiesPanelUI(): void {
  const state = editorStore.getState();
  const activeIdx = state.activeElementIndex;
  const panel = document.getElementById('properties-panel');
  if (!panel) return;

  if (activeIdx === null || !state.elements[activeIdx]) {
    panel.style.display = 'none';
    return;
  }

  panel.style.display = 'block';
  const el = state.elements[activeIdx];

  const setInputVal = (id: string, val: any, valTextId?: string, suffix: string = '') => {
    const inp = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
    if (inp && val !== undefined && val !== null) {
      if (inp.type === 'checkbox') {
        (inp as HTMLInputElement).checked = !!val;
      } else if (document.activeElement !== inp) { // Prevent cursor jump for text inputs
        inp.value = String(val);
      }
    }
    if (valTextId) {
      const textNode = document.getElementById(valTextId);
      if (textNode) textNode.textContent = `${val}${suffix}`;
    }
  };

  setInputVal('propX', el.x);
  setInputVal('propY', el.y);
  setInputVal('propW', el.w, 'propWVal', '%');
  setInputVal('propH', el.h || 50, 'propHVal', '%');

  const opacityPercent = Math.round((el.opacity !== undefined && el.opacity !== null ? (el.opacity > 1 ? el.opacity : el.opacity * 100) : 100));
  setInputVal('propOpacity', opacityPercent, 'propOpacityVal', '%');

  setInputVal('propRotate', el.rotate || 0, 'propRotateVal', '°');
  setInputVal('propRotateX', el.rotateX || 0, 'propRotateXVal', '°');
  setInputVal('propRotateY', el.rotateY || 0, 'propRotateYVal', '°');
  setInputVal('propSkewX', el.skewX || 0, 'propSkewXVal', '°');
  setInputVal('propSkewY', el.skewY || 0, 'propSkewYVal', '°');

  setInputVal('propFillType', el.fillType || 'solid');
  setInputVal('propColor', el.color || el.fillColor || '#ffffff');
  setInputVal('propColorText', el.color || el.fillColor || '#ffffff');
  setInputVal('propGradAngle', el.gradientAngle || 45);
  setInputVal('propGradStart', el.gradientColorStart || '#3b82f6');
  setInputVal('propGradEnd', el.gradientColorEnd || '#ec4899');
  setInputVal('propBgImageInput', el.bgImage || '');
  setInputVal('propBgImageMode', el.bgImageMode || 'cover');

  // Text specific container
  const textProps = document.getElementById('textOnlyProps');
  if (textProps) textProps.style.display = el.type === 'text' ? 'block' : 'none';
  if (el.type === 'text') {
    setInputVal('propS', el.fontSize || 4, 'propSVal');
    setInputVal('propFont', el.fontFamily || 'Syne');
    setInputVal('propText', el.content || el.text || '');
    setInputVal('propTracking', el.tracking || 0, 'propTrackingVal', 'px');
    setInputVal('propLeading', el.leading || 1.2, 'propLeadingVal');
  }

  // Shape specific container
  const shapeProps = document.getElementById('shapeOnlyProps');
  if (shapeProps) shapeProps.style.display = el.type === 'shape' ? 'block' : 'none';
  if (el.type === 'shape') {
    setInputVal('propShapeType', el.shapeType || 'rectangle');
    setInputVal('propBorderRadius', el.borderRadius || 0, 'propBorderRadiusVal');
    setInputVal('propStrokeColor', el.strokeColor || '#ffffff');
    setInputVal('propStrokeWidth', el.strokeWidth || 0, 'propStrokeWidthVal');
    setInputVal('propCustomSvgPath', el.customSvgPath || '');
  }

  // Universal Border & Shadow & Link Controls
  setInputVal('propBorderWidth', el.borderWidth || 0, 'propBorderWidthVal', 'px');
  setInputVal('propBorderStyle', el.borderStyle || 'none');
  setInputVal('propBorderColor', el.borderColor || '#ffffff');
  setInputVal('propElementBorderRadius', el.elementBorderRadius || 0, 'propElementBorderRadiusVal', 'px');
  setInputVal('propShadowEnable', !!el.shadowEnable);
  setInputVal('propBlend', el.blendMode || 'normal');
  setInputVal('propCustomId', el.customId || '');
  
    const sh = document.getElementById('shapeHeightProp');
    if (sh) {
      if (el.type === 'shape' || el.type === 'image' || el.type === 'frame') {
        sh.style.display = 'block';
        setInputVal('propH', el.h || el.w || 30, 'propHVal');
      } else {
        sh.style.display = 'none';
      }
    }
    setInputVal('propHyperlinkType', el.hyperlinkType || 'none');
  setInputVal('propLinkExternalInput', el.hyperlink || '');
  
    
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
    const isLinked = el.linkPadding !== false;
    const lp = document.getElementById('propLinkPadding');
    if (lp) lp.checked = isLinked;
    const grpLink = document.getElementById('propLinkedPaddingGroup');
    const grpIndiv = document.getElementById('propIndividualPaddingGroup');
    if (grpLink) grpLink.style.display = isLinked ? 'flex' : 'none';
    if (grpIndiv) grpIndiv.style.display = isLinked ? 'none' : 'flex';
    
    setInputVal('propPaddingAll', el.paddingTop || 0, 'propPaddingAllVal');
    setInputVal('propPaddingTop', el.paddingTop || 0, 'propPaddingTopVal');
    setInputVal('propPaddingRight', el.paddingRight || 0, 'propPaddingRightVal');
    setInputVal('propPaddingBottom', el.paddingBottom || 0, 'propPaddingBottomVal');
    setInputVal('propPaddingLeft', el.paddingLeft || 0, 'propPaddingLeftVal');

    // WIRE-TRACKER: Validate UI Sync
    if (typeof window.WireTracker !== 'undefined' && idx !== null) {
      setTimeout(() => {
        const val = (id) => {
           const el = document.getElementById(id);
           if (!el) return null;
           if (el.type === 'checkbox') return el.checked;
           return el.value;
        };
        const st = editorStore.getState().elements[idx];
        if (!st) return;
        
        WireTracker.validateSync('X Position', st.x, val('propX'), document.getElementById('propX'));
        WireTracker.validateSync('Y Position', st.y, val('propY'), document.getElementById('propY'));
        WireTracker.validateSync('Width', st.w, val('propW'), document.getElementById('propW'));
        WireTracker.validateSync('Opacity', (st.opacity !== undefined ? st.opacity * 100 : 100), val('propOpacity'), document.getElementById('propOpacity'));
        WireTracker.validateSync('Background Image Mode', st.bgImageMode || 'cover', val('propBgImageMode'), document.getElementById('propBgImageMode'));
        WireTracker.validateSync('Hyperlink Type', st.hyperlinkType || 'none', val('propHyperlinkType'), document.getElementById('propHyperlinkType'));
      }, 0);
    }
    
    setInputVal('propBgImageInput', el.bgImage || '');
    setInputVal('propBgImageMode', el.bgImageMode || 'cover');
    setInputVal('propSvgPresets', el.customSvgPath || '');
    setInputVal('propCustomSvgPath', el.customSvgPath || '');
    
    const se = document.getElementById('propShadowEnable');
    if (se) {
      se.checked = el.shadowEnable || false;
      const grp = document.getElementById('shadowControlsGroup');
      if (grp) grp.style.display = el.shadowEnable ? 'block' : 'none';
      if (typeof renderShadowList === 'function') renderShadowList(el.shadows || []);
    }
    
    setInputVal('propHyperlinkType', el.hyperlinkType || 'none');
    const ht = el.hyperlinkType || 'none';
    const hpGroup = document.getElementById('propLinkPageGroup');
    const haGroup = document.getElementById('propLinkAnchorGroup');
    const heGroup = document.getElementById('propLinkExternalGroup');
    const htGroup = document.getElementById('propLinkTargetGroup');
    if (hpGroup) hpGroup.style.display = ht === 'page' ? 'block' : 'none';
    if (haGroup) haGroup.style.display = ht === 'anchor' ? 'block' : 'none';
    if (heGroup) heGroup.style.display = ht === 'external' ? 'block' : 'none';
    if (htGroup) htGroup.style.display = ht !== 'none' ? 'block' : 'none';
    
    if (ht === 'page') setInputVal('propLinkPageSelect', el.hyperlink || '');
    else if (ht === 'anchor') setInputVal('propLinkAnchorInput', el.hyperlink || '');
    else if (ht === 'external') setInputVal('propLinkExternalInput', el.hyperlink || '');
    
    setInputVal('propLinkTarget', el.hyperlinkTarget || '_self');


  // Background Controls
  const bgColorInput = document.getElementById('bgColor') as HTMLInputElement | null;
  if (bgColorInput) bgColorInput.value = state.backgroundColor || '#111111';
  setInputVal('canvasXSlider', state.canvasX, 'canvasXVal', '%');
  const toggleHorizScroll = document.getElementById('toggleHorizScroll') as HTMLInputElement | null;
  if (toggleHorizScroll) toggleHorizScroll.checked = !!state.horizontalScroll;
}

/**
 * Updates visual state of top Save button.
 */
function updateSaveButtonUI(): void {
  const saveBtn = document.getElementById('saveBtn') as HTMLButtonElement | null;
  if (!saveBtn) return;
  const state = editorStore.getState();
  if (state.isUnsaved) {
    saveBtn.classList.add('btn-unsaved');
    saveBtn.innerText = 'Save Changes *';
  } else {
    saveBtn.classList.remove('btn-unsaved');
    saveBtn.innerText = 'Saved';
  }
}

/**
 * Asynchronously loads available page routes from Express backend API.
 */
async function loadPagesList(selectedPath: string | null = null): Promise<void> {
  try {
    const res = await fetch('/api/pages');
    if (!res.ok) return;
    const pages: PageInfo[] = await res.json();
    
    const pageSelect = document.getElementById('pageSelect') as HTMLSelectElement | null;
    if (pageSelect) {
      pageSelect.innerHTML = '';
      pages.forEach((p) => {
        const option = document.createElement('option');
        option.value = p.path;
        option.textContent = p.title || p.path;
        if (p.path === (selectedPath || '/')) {
          option.selected = true;
        }
        pageSelect.appendChild(option);
      });
    }
  } catch (err) {
    console.error('Failed to load pages list', err);
  }
}

/**
 * Asynchronously fetches state snapshot for a target page route.
 */
async function loadPageState(pagePath: string): Promise<void> {
  let loadedData: any = null;
  try {
    const res = await fetch(`/api/load-page?path=${encodeURIComponent(pagePath)}`);
    if (res.ok) {
      loadedData = await res.json();
    }
  } catch (err) {
    console.log('Server state endpoint unavailable, using local state');
  }

  if (!loadedData) {
    const localSaved = localStorage.getItem(`zine-state-${pagePath}`);
    if (localSaved) {
      try {
        loadedData = JSON.parse(localSaved);
      } catch (e) {
        console.error('Failed to parse local state:', e);
      }
    }
  }

  if (loadedData) {
    editorStore.setState({
      activePage: pagePath,
      elements: loadedData.elements || [],
      googleFonts: loadedData.googleFonts || ['Syne'],
      backgroundColor: loadedData.backgroundColor || '#111111',
      canvasX: loadedData.canvasX !== undefined ? loadedData.canvasX : 50,
      horizontalScroll: !!loadedData.horizontalScroll,
      selectedIndices: [],
      activeElementIndex: null,
      isUnsaved: false,
      undoStack: [],
      redoStack: [],
    });
  }

  localStorage.setItem('zine-active-page', pagePath);
}

/**
 * Serializes current store state to backend server and mirrors to browser localStorage.
 */
async function savePageState(showNotice = true): Promise<void> {
  const state = editorStore.getState();
  const payload = {
    pagePath: state.activePage,
    elements: state.elements,
    googleFonts: state.googleFonts,
    backgroundColor: state.backgroundColor,
    canvasX: state.canvasX,
    horizontalScroll: state.horizontalScroll,
  };

  localStorage.setItem(`zine-state-${state.activePage}`, JSON.stringify(payload));
  editorStore.getState().setIsUnsaved(false);
  triggerSuccessConfetti();

  try {
    await fetch('/api/save-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.log('Saved to browser client localStorage');
  }

  if (showNotice) {
    console.log('Page saved successfully!');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initEditor);
} else {
  initEditor();
}

/**
 * Setup Floating UIs: Quickbar, Rich Text, Context Menu, Inspector
 */
let cleanupFloatingQuickbar: (() => void) | null = null;
let cleanupRichQuickbar: (() => void) | null = null;
let cleanupContextMenu: (() => void) | null = null;
let isDraggingInspector = false;


    // WIRE-TRACKER: Global UI Event Interceptor
    if (typeof window.WireTracker !== 'undefined') {
      document.body.addEventListener('input', (e) => {
        const target = e.target;
        if (target && target.id && target.id.startsWith('prop')) {
          WireTracker.logAction('Input Changed', `ID: ${target.id}, Value: ${target.value}`);
        }
      });
      document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.id && target.id.startsWith('prop')) {
          WireTracker.logAction('Click / Toggle', `ID: ${target.id}, Value: ${target.value || target.checked}`);
        } else if (target && target.tagName === 'BUTTON') {
          WireTracker.logAction('Button Clicked', `Text: ${target.innerText}, ID: ${target.id}`);
        }
      });
    }
function setupFloatingUI() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  // Floating Inspector dragging logic
  const inspector = document.getElementById('floating-inspector');
  const inspectorHeader = document.getElementById('floating-inspector-header');
  if (inspector && inspectorHeader) {
    let startX = 0, startY = 0, startLeft = 0, startTop = 0;
    
    inspectorHeader.addEventListener('mousedown', (e) => {
      isDraggingInspector = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = inspector.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      
      const onMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingInspector) return;
        const dx = moveEvent.clientX - startX;
        const dy = moveEvent.clientY - startY;
        inspector.style.left = `${startLeft + dx}px`;
        inspector.style.top = `${startTop + dy}px`;
        inspector.style.transform = 'none'; // Clear any centering transforms
      };
      const onMouseUp = () => {
        isDraggingInspector = false;
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      };
      
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    const closeBtn = document.getElementById('floating-inspector-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        inspector.style.display = 'none';
      });
    }

    // Bind all floating inspector inputs
    const bindFloat = (id: string, prop: string, parser: (val: string) => any = (v) => v) => {
      const el = document.getElementById(id) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (!el) return;
      const handler = () => {
        const idx = getActiveIdx();
        if (idx === null) return;
        updateActive({ [prop]: parser(el.value) });
      };
      el.addEventListener('input', handler);
      el.addEventListener('change', handler);
    };

    bindFloat('floatX', 'x', parseFloat);
    bindFloat('floatY', 'y', parseFloat);
    bindFloat('floatW', 'w', parseFloat);
    bindFloat('floatH', 'h', parseFloat);
    bindFloat('floatText', 'content');
    bindFloat('floatFillType', 'fillType');
    const floatColorTextEl = document.getElementById('floatColorText');
    if (floatColorTextEl) {
      const handler = () => {
        const idx = getActiveIdx();
        if (idx === null) return;
        const el = editorStore.getState().elements[idx];
        const val = (floatColorTextEl as HTMLInputElement).value;
        if (el.type === 'text') updateActive({ color: val });
        else updateActive({ fillColor: val });
      };
      floatColorTextEl.addEventListener('input', handler);
      floatColorTextEl.addEventListener('change', handler);
    }
    bindFloat('floatGradAngle', 'gradientAngle', parseInt);
    bindFloat('floatGradStart', 'gradientColorStart');
    bindFloat('floatGradEnd', 'gradientColorEnd');
    bindFloat('floatBlend', 'blendMode');
    bindFloat('floatRotate', 'rotate', parseInt);
    bindFloat('floatRotateX', 'rotateX', parseInt);
    bindFloat('floatRotateY', 'rotateY', parseInt);
    bindFloat('floatSkewX', 'skewX', parseInt);
    bindFloat('floatSkewY', 'skewY', parseInt);

    const colorPickerEl = document.getElementById('floatColorPicker');
    if (colorPickerEl) {
      createColorPicker({
        el: colorPickerEl,
        onChange: (hex) => {
          const textInput = document.getElementById('floatColorText') as HTMLInputElement;
          if (textInput) textInput.value = hex;
          const idx = getActiveIdx();
          if (idx !== null) {
            const el = editorStore.getState().elements[idx];
            if (el.type === 'text') updateActive({ color: hex });
            else updateActive({ fillColor: hex });
          }
        }
      });
    }

    // Tabs logic
    const tabs = document.querySelectorAll('.inspector-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        const paneId = target.getAttribute('data-target');
        if (!paneId) return;
        tabs.forEach(t => t.classList.remove('active'));
        target.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const pane = document.getElementById(paneId);
        if (pane) pane.classList.add('active');
      });
    });
  }

  // Quickbar actions
  const action = (id: string, fn: (idx: number, el: any) => void) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('click', () => {
      const idx = getActiveIdx();
      if (idx === null) return;
      editorStore.getState().pushUndoState();
      fn(idx, editorStore.getState().elements[idx]);
    });
  };

  action('qb-rotate-left', (idx, el) => updateActive({ rotate: (el.rotate || 0) - 15 }));
  action('qb-rotate-right', (idx, el) => updateActive({ rotate: (el.rotate || 0) + 15 }));
  action('qb-scale-up', (idx, el) => updateActive({ w: el.w * 1.05 }));
  action('qb-scale-down', (idx, el) => updateActive({ w: el.w * 0.95 }));
  action('qb-bring-forward', (idx) => editorStore.getState().moveElement(idx, 'forward'));
  action('qb-delete', () => editorStore.getState().deleteSelectedElements());
  
  const qbTune = document.getElementById('qb-tune');
  if (qbTune) {
    qbTune.addEventListener('click', () => {
      if (inspector) inspector.style.display = 'block';
    });
  }

  // Rich Text quickbar actions
  const execCmd = (id: string, cmd: string, val?: string) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent losing focus
      document.execCommand(cmd, false, val);
    });
  };
  execCmd('rich-bold', 'bold');
  execCmd('rich-italic', 'italic');
  execCmd('rich-underline', 'underline');
  execCmd('rich-strike', 'strikeThrough');
  execCmd('rich-super', 'superscript');
  execCmd('rich-sub', 'subscript');
  execCmd('menu-rich-clear', 'removeFormat');
  
  const richFontFamily = document.getElementById('rich-font-family') as HTMLSelectElement;
  if (richFontFamily) richFontFamily.addEventListener('change', () => document.execCommand('fontName', false, richFontFamily.value));
  
  const richFontSize = document.getElementById('rich-font-size') as HTMLInputElement;
  if (richFontSize) richFontSize.addEventListener('change', () => document.execCommand('fontSize', false, '7')); // Custom sizes are tricky with execCommand, '7' is max HTML font size

  const richColor = document.getElementById('rich-color') as HTMLInputElement;
  if (richColor) richColor.addEventListener('change', () => document.execCommand('foreColor', false, richColor.value));

  // Context Menu Logic
  const contextMenu = document.getElementById('context-menu');
  if (contextMenu) {
    canvas.addEventListener('contextmenu', (e) => {
      const target = e.target as HTMLElement;
      const elDiv = target.closest('.editor-element') as HTMLElement;
      if (!elDiv) return;
      e.preventDefault();
      
      const idxAttr = elDiv.getAttribute('data-index');
      if (idxAttr === null) return;
      const idx = parseInt(idxAttr, 10);
      editorStore.getState().selectElement(idx);

      contextMenu.style.display = 'block';
      contextMenu.style.left = `${e.clientX}px`;
      contextMenu.style.top = `${e.clientY}px`;
    });
    
    document.addEventListener('click', (e) => {
      if (!contextMenu.contains(e.target as Node)) {
        contextMenu.style.display = 'none';
      }
    });

    const ctxAction = (id: string, fn: (idx: number, el: any) => void) => {
      const btn = document.getElementById(id);
      if (!btn) return;
      btn.addEventListener('click', () => {
        const idx = getActiveIdx();
        if (idx === null) return;
        editorStore.getState().pushUndoState();
        fn(idx, editorStore.getState().elements[idx]);
        contextMenu.style.display = 'none';
      });
    };

    ctxAction('menu-bring-forward', (idx) => editorStore.getState().moveElement(idx, 'forward'));
    ctxAction('menu-bring-front', (idx) => editorStore.getState().moveElement(idx, 'front'));
    ctxAction('menu-send-backward', (idx) => editorStore.getState().moveElement(idx, 'backward'));
    ctxAction('menu-send-back', (idx) => editorStore.getState().moveElement(idx, 'back'));
    ctxAction('menu-stretch-wider', (idx, el) => updateActive({ w: el.w * 1.10 }));
    ctxAction('menu-stretch-narrower', (idx, el) => updateActive({ w: el.w * 0.90 }));
    ctxAction('menu-duplicate', () => editorStore.getState().duplicateSelectedElements());
    ctxAction('menu-delete', () => editorStore.getState().deleteSelectedElements());
    
    const menuEditFloating = document.getElementById('menu-edit-floating');
    if (menuEditFloating) {
      menuEditFloating.addEventListener('click', () => {
        if (inspector) inspector.style.display = 'block';
        contextMenu.style.display = 'none';
      });
    }
  }

  // Subscribe to store to update Floating Inspector UI and Floating Quickbar Positioning
  editorStore.subscribe((state, prevState) => {
    const idx = state.activeElementIndex;
    const qb = document.getElementById('floating-quickbar');
    const richQb = document.getElementById('text-formatting-quickbar');
    
    if (idx === null || !state.elements[idx]) {
      if (qb) qb.style.display = 'none';
      if (richQb) richQb.style.display = 'none';
      if (cleanupFloatingQuickbar) { cleanupFloatingQuickbar(); cleanupFloatingQuickbar = null; }
      if (cleanupRichQuickbar) { cleanupRichQuickbar(); cleanupRichQuickbar = null; }
      return;
    }

    const el = state.elements[idx];
    const elNode = canvas.querySelector(`.editor-element[data-index="${idx}"]`) as HTMLElement;
    
    if (elNode) {
      // Floating Quickbar
      if (qb) {
        qb.style.display = 'flex';
        if (cleanupFloatingQuickbar) cleanupFloatingQuickbar();
        cleanupFloatingQuickbar = autoUpdate(elNode, qb, () => {
          computePosition(elNode, qb, {
            placement: 'top',
            middleware: [offset(10), flip(), shift({ padding: 10 })],
          }).then(({ x, y }) => {
            Object.assign(qb.style, { left: `${x}px`, top: `${y}px` });
          });
        });
      }
      
      // Rich Text Quickbar
      if (richQb && el.type === 'text') {
        richQb.style.display = 'flex';
        if (cleanupRichQuickbar) cleanupRichQuickbar();
        cleanupRichQuickbar = autoUpdate(elNode, richQb, () => {
          computePosition(elNode, richQb, {
            placement: 'bottom',
            middleware: [offset(10), flip(), shift({ padding: 10 })],
          }).then(({ x, y }) => {
            Object.assign(richQb.style, { left: `${x}px`, top: `${y}px` });
          });
        });
      } else if (richQb) {
        richQb.style.display = 'none';
        if (cleanupRichQuickbar) { cleanupRichQuickbar(); cleanupRichQuickbar = null; }
      }
    }

    // Sync floating inspector if visible
    if (inspector && inspector.style.display !== 'none') {
      const setV = (id: string, val: any) => {
        const i = document.getElementById(id) as HTMLInputElement;
        if (i && document.activeElement !== i) i.value = val !== undefined ? String(val) : '';
      };
      setV('floatX', el.x);
      setV('floatY', el.y);
      setV('floatW', el.w);
      setV('floatH', el.h);
      if (el.type === 'text') setV('floatText', el.content || el.text);
      setV('floatFillType', el.fillType || 'solid');
      setV('floatColorText', el.fillColor || el.color || '#ffffff');
      setV('floatGradAngle', el.gradientAngle);
      setV('floatGradStart', el.gradientColorStart);
      setV('floatGradEnd', el.gradientColorEnd);
      setV('floatBlend', el.blendMode);
      setV('floatRotate', el.rotate || 0);
      setV('floatRotateX', el.rotateX || 0);
      setV('floatRotateY', el.rotateY || 0);
      setV('floatSkewX', el.skewX || 0);
      setV('floatSkewY', el.skewY || 0);
    }
  });
}
