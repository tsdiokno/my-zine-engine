/**
 * =============================================================================
 * MODULE: Client-Side Standalone HTML Exporter (`/src/editor/exporter.ts`)
 * SINGLE RESPONSIBILITY:
 *   Synthesizes visual canvas state directly in the browser into standalone,
 *   zero-dependency HTML & CSS files, triggering instant native file downloads.
 * =============================================================================
 */

import { ZineElement } from './types';
import { hexToRgba } from './utils';

/**
 * Compiles in-memory editor state into a standalone, production-ready HTML document string.
 */
export function compileClientSideHtml(
  elements: ZineElement[],
  backgroundColor: string,
  googleFonts: string[] = ['Syne']
): string {
  const fontImports = googleFonts
    .map((font) => `@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;700;900&display=swap');`)
    .join('\n');

  const renderedElementsHtml = elements
    .map((el) => {
      const leftPx = el.x;
      const topPx = el.y;
      const widthPx = el.w;
      const heightStyle = el.h ? `height: ${el.h}vw;` : '';

      const transformParts: string[] = [];
      if (el.rotate) transformParts.push(`rotate(${el.rotate}deg)`);
      if (el.rotateX) transformParts.push(`rotateX(${el.rotateX}deg)`);
      if (el.rotateY) transformParts.push(`rotateY(${el.rotateY}deg)`);
      if (el.skewX) transformParts.push(`skewX(${el.skewX}deg)`);
      if (el.skewY) transformParts.push(`skewY(${el.skewY}deg)`);

      const transformStyle = transformParts.length > 0
        ? `transform: perspective(600px) ${transformParts.join(' ')}; transform-style: preserve-3d;`
        : '';

      const opacityStyle = el.opacity !== undefined ? `opacity: ${el.opacity};` : '';
      const blendStyle = el.blendMode ? `mix-blend-mode: ${el.blendMode};` : '';

      let filterStyle = '';
      if (el.shadows && el.shadows.length > 0) {
        const dropShadows = el.shadows
          .map((s) => `drop-shadow(${s.x || 0}px ${s.y || 0}px ${s.blur || 0}px ${hexToRgba(s.color || '#000000', s.opacity)})`)
          .join(' ');
        filterStyle = `filter: ${dropShadows};`;
      } else if (el.shadowEnable) {
        filterStyle = `filter: drop-shadow(${el.shadowX || 4}px ${el.shadowY || 4}px ${el.shadowBlur || 8}px ${hexToRgba(el.shadowColor || '#000000', 0.8)});`;
      }

      let innerContent = '';
      if (el.type === 'text') {
        const fontSizeStyle = el.fontSize ? `font-size: ${el.fontSize * 0.4}vw;` : 'font-size: 2.4vw;';
        const fontFamilyStyle = `font-family: '${el.fontFamily || 'Syne'}', sans-serif;`;
        const fontWeightStyle = `font-weight: ${el.fontWeight || 900};`;
        const fontStyleStyle = `font-style: ${el.fontStyle || 'normal'};`;
        const colorStyle = `color: ${el.color || '#ffffff'};`;
        const alignStyle = `text-align: ${el.textAlign || 'left'};`;
        const trackingStyle = el.tracking ? `letter-spacing: ${el.tracking}em;` : '';
        const leadingStyle = el.leading ? `line-height: ${el.leading};` : '';

        innerContent = `<div style="${fontSizeStyle} ${fontFamilyStyle} ${fontWeightStyle} ${fontStyleStyle} ${colorStyle} ${alignStyle} ${trackingStyle} ${leadingStyle}">
          ${el.content || el.text || 'Text'}
        </div>`;
      } else if (el.type === 'shape') {
        let fillBg = el.fillColor || '#3b82f6';
        if (el.fillType === 'gradient') {
          fillBg = `linear-gradient(${el.gradientAngle || 90}deg, ${el.gradientColorStart || '#3b82f6'}, ${el.gradientColorEnd || '#ec4899'})`;
        } else if (el.fillType === 'none') {
          fillBg = 'transparent';
        }

        const borderRadius = el.shapeType === 'circle' ? '50%' : `${el.elementBorderRadius || 0}px`;
        const borderStyle = el.borderWidth ? `border: ${el.borderWidth}px ${el.borderStyle || 'solid'} ${el.borderColor || '#ffffff'};` : '';

        innerContent = `<div style="width: 100%; height: 100%; background: ${fillBg}; border-radius: ${borderRadius}; ${borderStyle}"></div>`;
      } else if (el.type === 'image') {
        const borderRadius = el.elementBorderRadius ? `border-radius: ${el.elementBorderRadius}px;` : '';
        innerContent = `<img src="${el.src || ''}" style="width: 100%; height: 100%; object-fit: cover; ${borderRadius}" alt="" />`;
      }

      return `<div class="zine-element" style="position: absolute; left: ${leftPx}%; top: ${topPx}%; width: ${widthPx}%; ${heightStyle} ${transformStyle} ${blendStyle} ${opacityStyle} ${filterStyle}">
        ${innerContent}
      </div>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Exported Zine Page</title>
  <style>
    ${fontImports}
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: ${backgroundColor || '#111111'};
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
      padding: 20px 0;
      font-family: sans-serif;
      overflow-x: hidden;
    }
    .zine-canvas {
      position: relative;
      width: 100%;
      max-width: 390px;
      min-height: 844px;
      background: ${backgroundColor || '#111111'};
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
      border-radius: 12px;
      overflow: hidden;
    }
  </style>
</head>
<body>
  <main class="zine-canvas">
    ${renderedElementsHtml}
  </main>
</body>
</html>`;
}

/**
 * Triggers native browser file download of the compiled HTML document.
 */
export function downloadClientSideHtml(
  elements: ZineElement[],
  backgroundColor: string,
  googleFonts: string[] = ['Syne'],
  filename: string = 'zine-page.html'
): void {
  const htmlContent = compileClientSideHtml(elements, backgroundColor, googleFonts);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
