/**
 * =============================================================================
 * MODULE: Moveable Spatial Controller (`/src/editor/moveable-controller.ts`)
 * SINGLE RESPONSIBILITY:
 *   Manages direct canvas drag, resize, rotate, and snapping interactions using
 *   Moveable and pointer fallbacks, syncing coordinate updates directly into `editorStore`.
 * =============================================================================
 */

import Moveable from 'moveable';
import { editorStore, CANVAS_BASELINE_WIDTH } from './store';

let moveableInstance: Moveable | null = null;

/**
 * Attaches or refreshes Moveable transform controls for the currently active element on `#canvas`.
 */
export function updateMoveable(): void {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const state = editorStore.getState();
  const activeIdx = state.activeElementIndex;

  if (activeIdx === null || !state.elements[activeIdx]) {
    if (moveableInstance) {
      moveableInstance.destroy();
      moveableInstance = null;
    }
    return;
  }

  const targetNode = canvas.querySelector(`.editor-element[data-index="${activeIdx}"]`) as HTMLElement;
  if (!targetNode) {
    if (moveableInstance) {
      moveableInstance.destroy();
      moveableInstance = null;
    }
    return;
  }

  const actualCanvasWidth = canvas.clientWidth || CANVAS_BASELINE_WIDTH;

  if (!moveableInstance) {
    moveableInstance = new Moveable(canvas, {
      target: targetNode,
      draggable: true,
      resizable: true,
      rotatable: true,
      snappable: true,
      snapThreshold: 5,
      origin: false,
      padding: { left: 0, top: 0, right: 0, bottom: 0 },
    });

    moveableInstance.on('dragStart', () => {
      editorStore.getState().pushUndoState();
    });

    moveableInstance.on('drag', ({ target, left, top }) => {
      target.style.left = `${left}px`;
      target.style.top = `${top}px`;
      const newX = parseFloat(((left / actualCanvasWidth) * 100).toFixed(2));
      const newY = parseFloat(((top / actualCanvasWidth) * 100).toFixed(2));
      const propX = document.getElementById('propX') as HTMLInputElement;
      const propY = document.getElementById('propY') as HTMLInputElement;
      if (propX) propX.value = newX.toString();
      if (propY) propY.value = newY.toString();
    });

    moveableInstance.on('dragEnd', ({ target }) => {
      const idxAttr = target.getAttribute('data-index');
      if (idxAttr === null) return;
      const idx = parseInt(idxAttr, 10);
      const left = parseFloat(target.style.left);
      const top = parseFloat(target.style.top);
      const newX = parseFloat(((left / actualCanvasWidth) * 100).toFixed(2));
      const newY = parseFloat(((top / actualCanvasWidth) * 100).toFixed(2));
      editorStore.getState().updateElement(idx, { x: newX, y: newY });
    });

    moveableInstance.on('resizeStart', () => {
      editorStore.getState().pushUndoState();
    });

    moveableInstance.on('resize', ({ target, width, height, drag }) => {
      target.style.width = `${width}px`;
      target.style.height = `${height}px`;
      target.style.left = `${drag.left}px`;
      target.style.top = `${drag.top}px`;
      const newX = parseFloat(((drag.left / actualCanvasWidth) * 100).toFixed(2));
      const newY = parseFloat(((drag.top / actualCanvasWidth) * 100).toFixed(2));
      const newW = parseFloat(((width / actualCanvasWidth) * 100).toFixed(2));
      const newH = parseFloat(((height / actualCanvasWidth) * 100).toFixed(2));
      
      const propX = document.getElementById('propX') as HTMLInputElement;
      const propY = document.getElementById('propY') as HTMLInputElement;
      const propW = document.getElementById('propW') as HTMLInputElement;
      const propH = document.getElementById('propH') as HTMLInputElement;
      if (propX) propX.value = newX.toString();
      if (propY) propY.value = newY.toString();
      if (propW) propW.value = newW.toString();
      if (propH) propH.value = newH.toString();
    });

    moveableInstance.on('resizeEnd', ({ target }) => {
      const idxAttr = target.getAttribute('data-index');
      if (idxAttr === null) return;
      const idx = parseInt(idxAttr, 10);
      const left = parseFloat(target.style.left);
      const top = parseFloat(target.style.top);
      const width = parseFloat(target.style.width);
      const height = parseFloat(target.style.height);
      const newX = parseFloat(((left / actualCanvasWidth) * 100).toFixed(2));
      const newY = parseFloat(((top / actualCanvasWidth) * 100).toFixed(2));
      const newW = parseFloat(((width / actualCanvasWidth) * 100).toFixed(2));
      const newH = parseFloat(((height / actualCanvasWidth) * 100).toFixed(2));
      editorStore.getState().updateElement(idx, { x: newX, y: newY, w: newW, h: newH });
    });

    moveableInstance.on('rotateStart', () => {
      editorStore.getState().pushUndoState();
    });

    moveableInstance.on('rotate', ({ target, beforeRotation }) => {
      const newRotate = Math.round(beforeRotation);
      
      // Update transform style directly for smooth preview
      const currentTransform = target.style.transform;
      // Replace existing rotate() or append it
      if (currentTransform.includes('rotate(')) {
        target.style.transform = currentTransform.replace(/rotate\([^)]+\)/, `rotate(${newRotate}deg)`);
      } else {
        target.style.transform = `${currentTransform} rotate(${newRotate}deg)`.trim();
      }

      const propRotate = document.getElementById('propRotate') as HTMLInputElement;
      const propRotateVal = document.getElementById('propRotateVal');
      if (propRotate) propRotate.value = newRotate.toString();
      if (propRotateVal) propRotateVal.textContent = `${newRotate}°`;
    });

    moveableInstance.on('rotateEnd', ({ target }) => {
      const idxAttr = target.getAttribute('data-index');
      if (idxAttr === null) return;
      const idx = parseInt(idxAttr, 10);
      
      // Extract rotate from transform
      const match = target.style.transform.match(/rotate\(([-0-9.]+)deg\)/);
      const newRotate = match ? Math.round(parseFloat(match[1])) : 0;
      editorStore.getState().updateElement(idx, { rotate: newRotate });
    });
  } else {
    moveableInstance.target = targetNode;
    moveableInstance.updateRect();
  }
}

/**
 * Clears active Moveable instance.
 */
export function destroyMoveable(): void {
  if (moveableInstance) {
    moveableInstance.destroy();
    moveableInstance = null;
  }
}
