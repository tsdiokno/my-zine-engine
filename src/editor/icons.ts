/**
 * =============================================================================
 * MODULE: Lucide Icon Renderer (`/src/editor/icons.ts`)
 * SINGLE RESPONSIBILITY:
 *   Provides helper utilities to dynamically render Lucide SVG icons into UI controls.
 * =============================================================================
 */

import {
  createIcons,
  Undo,
  Redo,
  Save,
  Trash2,
  Copy,
  Plus,
  Type,
  Square,
  Image,
  Sliders,
  Settings,
  Layers,
  Sparkles,
  Palette,
  Eye,
  Layout,
  ChevronDown,
  X,
  Check
} from 'lucide';

export function initializeIcons(scopeContainer: HTMLElement | Document = document): void {
  createIcons({
    icons: {
      Undo,
      Redo,
      Save,
      Trash2,
      Copy,
      Plus,
      Type,
      Square,
      Image,
      Sliders,
      Settings,
      Layers,
      Sparkles,
      Palette,
      Eye,
      Layout,
      ChevronDown,
      X,
      Check
    },
    nameAttr: 'data-lucide',
  });
}
