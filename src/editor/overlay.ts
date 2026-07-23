/**
 * =============================================================================
 * MODULE: Inline Text Editing & Ghost Overlay Management (`/src/editor/overlay.ts`)
 * SINGLE RESPONSIBILITY:
 *   Manages contenteditable inline text editing sessions for canvas elements and
 *   maintains a decoupled, non-blocking ghost bounding box overlay that mirrors
 *   spatial dimensions without interfering with native character selection.
 * =============================================================================
 */

import { editorStore } from './store';

let editingOverlay: HTMLElement | null = null;

/**
 * Constructs or aligns the non-blocking ghost overlay bounding box.
 */
export function updateEditingOverlay(div: HTMLElement): void {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  if (!editingOverlay) {
    editingOverlay = document.createElement('div');
    editingOverlay.id = 'inline-editing-ghost-overlay';
    editingOverlay.style.position = 'absolute';
    editingOverlay.style.pointerEvents = 'none';
    editingOverlay.style.boxSizing = 'border-box';
    editingOverlay.style.border = '1px dashed #3b82f6';
    editingOverlay.style.outline = '1px solid rgba(59, 130, 246, 0.4)';
    editingOverlay.style.outlineOffset = '1px';
    editingOverlay.style.zIndex = '99999';
    canvas.appendChild(editingOverlay);
  }

  // Mirror exact 3D spatial properties from canvas element node
  editingOverlay.style.left = div.style.left;
  editingOverlay.style.top = div.style.top;
  editingOverlay.style.width = div.style.width;
  editingOverlay.style.height = `${div.offsetHeight}px`;
  editingOverlay.style.transform = div.style.transform;
  editingOverlay.style.transformStyle = div.style.transformStyle;
  editingOverlay.style.transformOrigin = div.style.transformOrigin;
  editingOverlay.style.backfaceVisibility = div.style.backfaceVisibility;
}

/**
 * Removes active ghost overlay from the DOM.
 */
export function removeEditingOverlay(): void {
  if (editingOverlay) {
    editingOverlay.remove();
    editingOverlay = null;
  }
}

/**
 * Initiates native inline HTML editing on a text canvas element.
 */
export function startInlineEditing(idx: number): void {
  const state = editorStore.getState();
  const el = state.elements[idx];
  if (!el || el.type !== 'text') return;

  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const div = canvas.querySelector(`.editor-element[data-index="${idx}"]`) as HTMLElement | null;
  if (!div) return;

  const contentWrapper = div.querySelector('.element-content-wrapper') as HTMLElement | null;
  if (!contentWrapper) return;

  div.classList.remove('active');
  div.querySelectorAll('.resize-handle, .rotate-handle').forEach(h => h.remove());

  contentWrapper.contentEditable = 'true';
  contentWrapper.focus();

  // Move selection range to end of text wrapper
  const range = document.createRange();
  const sel = window.getSelection();
  if (sel) {
    range.selectNodeContents(contentWrapper);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }

  updateEditingOverlay(div);

  // Recalculate overlay box bounds dynamically during input insertion/deletion
  const handleInput = () => {
    updateEditingOverlay(div);
  };
  contentWrapper.removeEventListener('input', handleInput);
  contentWrapper.addEventListener('input', handleInput);
}

/**
 * Terminates all inline contenteditable sessions, saving updated HTML strings to store.
 */
export function exitAllTextEditing(): void {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const wrappers = canvas.querySelectorAll('.element-content-wrapper[contenteditable="true"]');
  let hasChanges = false;

  wrappers.forEach((wrapper) => {
    const htmlWrapper = wrapper as HTMLElement;
    const div = htmlWrapper.closest('.editor-element') as HTMLElement | null;
    if (div) {
      const idxAttr = div.getAttribute('data-index');
      if (idxAttr !== null) {
        const idx = parseInt(idxAttr, 10);
        const state = editorStore.getState();
        if (state.elements[idx]) {
          const newContent = htmlWrapper.innerHTML;
          if (state.elements[idx].content !== newContent) {
            editorStore.getState().updateElement(idx, { content: newContent });
            hasChanges = true;
          }
        }
      }
    }
    htmlWrapper.contentEditable = 'false';
  });

  removeEditingOverlay();

  if (hasChanges) {
    editorStore.getState().setIsUnsaved(true);
  }
}
