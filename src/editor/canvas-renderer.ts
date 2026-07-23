/**
 * =============================================================================
 * MODULE: Canvas DOM Renderer (`/src/editor/canvas-renderer.ts`)
 * SINGLE RESPONSIBILITY:
 *   Synthesizes the DOM hierarchy inside `#canvas` based on current `editorStore` state.
 *   Handles 3D perspective transforms, ink blend mode wrappers, multi-layer drop shadow stacks,
 *   vector shape SVGs, typography styles, and interactive handle controls.
 * =============================================================================
 */

import { editorStore, CANVAS_BASELINE_WIDTH } from './store';
import { ZineElement } from './types';
import { cn, hexToRgba } from './utils';
import { updateMoveable } from './moveable-controller';

/**
 * Renders all canvas elements and background fills from the global store into `#canvas`.
 */
export function renderCanvas(): void {
  const canvas = document.getElementById('canvas');
  if (!canvas) return;

  const state = editorStore.getState();
  const elements = state.elements || [];

  // Update canvas container alignment and width offset
  const container = document.getElementById('canvas-container');
  if (container) {
    container.style.justifyContent = state.canvasX < 50 ? 'flex-start' : (state.canvasX > 50 ? 'flex-end' : 'center');
  }

  // Preserve background & grid pattern DOM nodes while clearing previous elements
  const marginGuides = canvas.querySelector('#canvas-margin-guides');
  const gridPattern = canvas.querySelector('#canvas-grid-pattern');
  const overlay = canvas.querySelector('#inline-editing-ghost-overlay');

  canvas.innerHTML = '';
  if (marginGuides) canvas.appendChild(marginGuides);
  if (gridPattern) canvas.appendChild(gridPattern);
  if (overlay) canvas.appendChild(overlay);

  // Apply canvas background
  canvas.style.background = state.backgroundColor || '#111111';

  // Calculate dynamic canvas height baseline extension based on element positions
  let maxBottomPx = 600; // Baseline canvas height coefficient
  const actualCanvasWidth = canvas.clientWidth || CANVAS_BASELINE_WIDTH;

  elements.forEach((el) => {
    if (!el) return;
    const topPx = (el.y / 100) * actualCanvasWidth;
    const heightPx = el.h ? (el.h / 100) * actualCanvasWidth : 50;
    const bottomPx = topPx + heightPx + 40;
    if (bottomPx > maxBottomPx) {
      maxBottomPx = bottomPx;
    }
  });
  canvas.style.minHeight = `${maxBottomPx}px`;

  // Render elements
  elements.forEach((el, idx) => {
    if (!el) return;

    const div = document.createElement('div');
    const isSelected = state.selectedIndices.includes(idx);
    const isActive = state.activeElementIndex === idx;

    div.className = cn('editor-element', {
      'active': isActive,
      'selected-element': isSelected,
    });
    div.setAttribute('data-index', idx.toString());

    // Coordinate mapping relative to canvas baseline
    const leftPx = (el.x / 100) * actualCanvasWidth;
    const topPx = (el.y / 100) * actualCanvasWidth;
    const widthPx = (el.w / 100) * actualCanvasWidth;

    div.style.position = 'absolute';
    div.style.left = `${leftPx}px`;
    div.style.top = `${topPx}px`;
    div.style.width = `${widthPx}px`;

    if (el.h) {
      const heightPx = (el.h / 100) * actualCanvasWidth;
      div.style.height = `${heightPx}px`;
    }

    // 3D Transforms
    const transformParts: string[] = [];
    if (el.rotate) transformParts.push(`rotate(${el.rotate}deg)`);
    if (el.rotateX) transformParts.push(`rotateX(${el.rotateX}deg)`);
    if (el.rotateY) transformParts.push(`rotateY(${el.rotateY}deg)`);
    if (el.skewX) transformParts.push(`skewX(${el.skewX}deg)`);
    if (el.skewY) transformParts.push(`skewY(${el.skewY}deg)`);

    if (transformParts.length > 0) {
      div.style.transform = `perspective(600px) ${transformParts.join(' ')}`;
      div.style.transformStyle = 'preserve-3d';
      div.style.backfaceVisibility = 'visible';
    } else {
      div.style.transform = '';
    }

    // Intermediate Blend Wrapper for Ink Treatments and Drop Shadows
    const blendWrapper = document.createElement('div');
    blendWrapper.className = 'element-blend-wrapper';
    blendWrapper.style.width = '100%';
    blendWrapper.style.height = '100%';
    blendWrapper.style.mixBlendMode = el.blendMode || 'normal';

    if (el.opacity !== undefined && el.opacity !== null) {
      blendWrapper.style.opacity = el.opacity.toString();
    }

    // Multi-layer drop shadow filter stack construction
    if (el.shadows && el.shadows.length > 0) {
      const dropShadowFilters = el.shadows.map(s => {
        const colorRgba = hexToRgba(s.color || '#000000', s.opacity !== undefined ? s.opacity : 1);
        return `drop-shadow(${s.x || 0}px ${s.y || 0}px ${s.blur || 0}px ${colorRgba})`;
      }).join(' ');
      blendWrapper.style.filter = dropShadowFilters;
    } else if (el.shadowEnable) {
      const colorRgba = hexToRgba(el.shadowColor || '#000000', 0.8);
      blendWrapper.style.filter = `drop-shadow(${el.shadowX || 4}px ${el.shadowY || 4}px ${el.shadowBlur || 8}px ${colorRgba})`;
    } else {
      blendWrapper.style.filter = 'none';
    }

    // Synthesize Type-Specific Inner Content
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'element-content-wrapper';
    contentWrapper.style.width = '100%';
    contentWrapper.style.height = '100%';

    if (el.type === 'text') {
      contentWrapper.style.fontSize = el.fontSize ? `${(el.fontSize / 10) * actualCanvasWidth * 0.1}px` : '24px';
      contentWrapper.style.fontFamily = el.fontFamily || 'Syne';
      contentWrapper.style.fontWeight = el.fontWeight ? el.fontWeight.toString() : '900';
      contentWrapper.style.fontStyle = el.fontStyle || 'normal';
      contentWrapper.style.color = el.color || '#ffffff';
      contentWrapper.style.textAlign = el.textAlign || 'left';
      if (el.tracking) contentWrapper.style.letterSpacing = `${el.tracking}em`;
      if (el.leading) contentWrapper.style.lineHeight = el.leading.toString();

      // Custom inner padding
      const pt = el.paddingTop !== undefined ? el.paddingTop : 0;
      const pr = el.paddingRight !== undefined ? el.paddingRight : 0;
      const pb = el.paddingBottom !== undefined ? el.paddingBottom : 0;
      const pl = el.paddingLeft !== undefined ? el.paddingLeft : 0;
      contentWrapper.style.padding = `${pt}px ${pr}px ${pb}px ${pl}px`;

      contentWrapper.innerHTML = el.content || el.text || 'Text';

    } else if (el.type === 'shape') {
      const shapeContainer = document.createElement('div');
      shapeContainer.className = 'shape-element-container';
      shapeContainer.style.width = '100%';
      shapeContainer.style.height = '100%';

      let fillBg = el.fillColor || '#3b82f6';
      if (el.fillType === 'gradient') {
        const start = el.gradientColorStart || '#3b82f6';
        const end = el.gradientColorEnd || '#ec4899';
        const angle = el.gradientAngle !== undefined ? el.gradientAngle : 90;
        fillBg = `linear-gradient(${angle}deg, ${start}, ${end})`;
      } else if (el.fillType === 'none') {
        fillBg = 'transparent';
      }

      if (el.shapeType === 'circle') {
        shapeContainer.style.borderRadius = '50%';
        shapeContainer.style.background = fillBg;
      } else if (el.shapeType === 'triangle') {
        shapeContainer.style.width = '0';
        shapeContainer.style.height = '0';
        shapeContainer.style.borderLeft = `${widthPx / 2}px solid transparent`;
        shapeContainer.style.borderRight = `${widthPx / 2}px solid transparent`;
        shapeContainer.style.borderBottom = `${(el.h ? (el.h / 100) * actualCanvasWidth : widthPx)}px solid ${el.fillColor || '#3b82f6'}`;
      } else {
        shapeContainer.style.background = fillBg;
        if (el.elementBorderRadius) {
          shapeContainer.style.borderRadius = `${el.elementBorderRadius}px`;
        }
      }

      if (el.borderWidth) {
        shapeContainer.style.borderWidth = `${el.borderWidth}px`;
        shapeContainer.style.borderStyle = el.borderStyle || 'solid';
        shapeContainer.style.borderColor = el.borderColor || '#ffffff';
      }

      contentWrapper.appendChild(shapeContainer);

    } else if (el.type === 'image') {
      const img = document.createElement('img');
      img.src = el.src || '';
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.objectFit = 'cover';
      img.style.pointerEvents = 'none';
      if (el.elementBorderRadius) {
        img.style.borderRadius = `${el.elementBorderRadius}px`;
      }
      contentWrapper.appendChild(img);
    }

    blendWrapper.appendChild(contentWrapper);
    div.appendChild(blendWrapper);

    // Append Resize & Rotate Control Handles for active elements are now handled by Moveable!

    canvas.appendChild(div);
  });

  // Attach Moveable spatial manipulators to the currently active canvas element
  updateMoveable();
}
