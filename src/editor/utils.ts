/**
 * =============================================================================
 * MODULE: Editor Utilities & Helper Abstractions (`/src/editor/utils.ts`)
 * SINGLE RESPONSIBILITY:
 *   Encapsulates standard, battle-tested utilities using lodash-es, clsx,
 *   @floating-ui/dom, and canvas-confetti.
 * =============================================================================
 */

import cloneDeep from 'lodash-es/cloneDeep';
import debounce from 'lodash-es/debounce';
import throttle from 'lodash-es/throttle';
import { clsx, type ClassValue } from 'clsx';
import { computePosition, offset, flip, shift, autoUpdate } from '@floating-ui/dom';
import confetti from 'canvas-confetti';

export { cloneDeep, debounce, throttle };

/**
 * Combines CSS class names dynamically using `clsx`.
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

/**
 * Positions a floating overlay (e.g. quickbar, context menu) near a target element
 * using @floating-ui/dom positioning algorithms.
 */
export function positionFloatingOverlay(
  referenceEl: HTMLElement,
  floatingEl: HTMLElement,
  placement: 'top' | 'bottom' | 'left' | 'right' = 'top'
): () => void {
  return autoUpdate(referenceEl, floatingEl, () => {
    computePosition(referenceEl, floatingEl, {
      placement,
      middleware: [offset(8), flip(), shift({ padding: 8 })],
    }).then(({ x, y }) => {
      Object.assign(floatingEl.style, {
        left: `${x}px`,
        top: `${y}px`,
      });
    });
  });
}

/**
 * Celebratory particle burst using canvas-confetti upon saving or publishing pages.
 */
export function triggerSuccessConfetti(): void {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.8 },
    colors: ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981'],
  });
}

/**
 * Converts hex color strings (#FFFFFF or #FFF) to RGBA string representations.
 */
export function hexToRgba(hex: string, alpha: number = 1): string {
  if (!hex) return `rgba(0, 0, 0, ${alpha})`;
  let c = hex.replace('#', '');
  if (c.length === 3) {
    c = c.split('').map(char => char + char).join('');
  }
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(0, 0, 0, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Converts RGB string (rgb(255, 255, 255)) or RGBA string to Hex format (#FFFFFF).
 */
export function rgbToHex(rgb: string): string {
  if (!rgb) return '#000000';
  if (rgb.startsWith('#')) return rgb;
  const match = rgb.match(/^rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
  if (!match) return '#000000';
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}
