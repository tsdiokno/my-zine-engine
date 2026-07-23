/**
 * =============================================================================
 * MODULE: Keyboard Shortcuts Registry (`/src/editor/hotkeys.ts`)
 * SINGLE RESPONSIBILITY:
 *   Registers and manages all canvas hotkeys using `hotkeys-js`.
 * =============================================================================
 */

import hotkeys from 'hotkeys-js';
import { editorStore } from './store';

export function initHotkeys(saveCallback: () => void): void {
  // Configure hotkeys to filter out standard inputs unless explicitly intended
  hotkeys.filter = (event) => {
    const target = (event.target || event.srcElement) as HTMLElement;
    const isEditingText = document.querySelector('.element-content-wrapper[contenteditable="true"]') !== null;
    if (isEditingText) return false;
    
    const tagName = target.tagName;
    return !(tagName === 'INPUT' || tagName === 'SELECT' || tagName === 'TEXTAREA');
  };

  // Undo: Cmd+Z / Ctrl+Z
  hotkeys('command+z, ctrl+z', (event) => {
    event.preventDefault();
    editorStore.getState().undo();
  });

  // Redo: Cmd+Shift+Z / Ctrl+Shift+Z / Cmd+Y / Ctrl+Y
  hotkeys('command+shift+z, ctrl+shift+z, command+y, ctrl+y', (event) => {
    event.preventDefault();
    editorStore.getState().redo();
  });

  // Delete: Delete or Backspace
  hotkeys('delete, backspace', (event) => {
    event.preventDefault();
    editorStore.getState().pushUndoState();
    editorStore.getState().deleteSelectedElements();
  });

  // Duplicate: Cmd+D / Ctrl+D
  hotkeys('command+d, ctrl+d', (event) => {
    event.preventDefault();
    editorStore.getState().pushUndoState();
    editorStore.getState().duplicateSelectedElements();
  });

  // Save: Cmd+S / Ctrl+S
  hotkeys('command+s, ctrl+s', (event) => {
    event.preventDefault();
    saveCallback();
  });

  // Nudge: Arrow keys
  const arrowKeys = ['left', 'right', 'up', 'down', 'shift+left', 'shift+right', 'shift+up', 'shift+down'];
  hotkeys(arrowKeys.join(','), (event, handler) => {
    const state = editorStore.getState();
    const targets = state.selectedIndices.length > 0
      ? state.selectedIndices
      : (state.activeElementIndex !== null ? [state.activeElementIndex] : []);

    if (targets.length === 0) return;
    event.preventDefault();

    state.pushUndoState();
    const isShift = handler.key.startsWith('shift+');
    const delta = isShift ? 10 : 1;

    targets.forEach((idx) => {
      const el = state.elements[idx];
      if (!el) return;
      let nx = el.x;
      let ny = el.y;

      if (handler.key.includes('left')) nx -= delta * 0.5;
      if (handler.key.includes('right')) nx += delta * 0.5;
      if (handler.key.includes('up')) ny -= delta * 0.5;
      if (handler.key.includes('down')) ny += delta * 0.5;

      state.updateElement(idx, { x: parseFloat(nx.toFixed(2)), y: parseFloat(ny.toFixed(2)) });
    });
  });
}
