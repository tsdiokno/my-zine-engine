/**
 * =============================================================================
 * MODULE: Color Picker Primitive Integration (`/src/editor/color-picker.ts`)
 * SINGLE RESPONSIBILITY:
 *   Wraps `@simonwep/pickr` color picker instance creation and event handlers.
 * =============================================================================
 */

import Pickr from '@simonwep/pickr';
import '@simonwep/pickr/dist/themes/nano.min.css';

export interface ColorPickerOptions {
  el: HTMLElement | string;
  defaultColor?: string;
  onChange?: (colorHex: string) => void;
  onSave?: (colorHex: string) => void;
}

export function createColorPicker(options: ColorPickerOptions): Pickr {
  const pickr = Pickr.create({
    el: options.el,
    theme: 'nano',
    default: options.defaultColor || '#3b82f6',
    swatches: [
      '#000000',
      '#ffffff',
      '#3b82f6',
      '#8b5cf6',
      '#ec4899',
      '#ef4444',
      '#f59e0b',
      '#10b981',
    ],
    components: {
      preview: true,
      opacity: true,
      hue: true,
      interaction: {
        hex: true,
        rgba: true,
        input: true,
        clear: false,
        save: true,
      },
    },
  });

  if (options.onChange) {
    pickr.on('change', (color: Pickr.HSVaColor) => {
      options.onChange!(color.toHEXA().toString());
    });
  }

  if (options.onSave) {
    pickr.on('save', (color: Pickr.HSVaColor | null) => {
      if (color) {
        options.onSave!(color.toHEXA().toString());
      }
    });
  }

  return pickr;
}
