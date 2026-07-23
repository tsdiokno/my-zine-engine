
import { ZineElement } from './types';

// Helper to calculate hex with opacity
function hexToRgba(hex: string, alpha: number) {
  let r = 0, g = 0, b = 0;
  if (hex.length === 4) {
    r = parseInt(hex[1] + hex[1], 16);
    g = parseInt(hex[2] + hex[2], 16);
    b = parseInt(hex[3] + hex[3], 16);
  } else if (hex.length === 7) {
    r = parseInt(hex.substring(1, 3), 16);
    g = parseInt(hex.substring(3, 5), 16);
    b = parseInt(hex.substring(5, 7), 16);
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function generateHtmlString(
  elements: ZineElement[],
  backgroundColor: string,
  googleFonts: string[]
): string {
  const fontLinks = googleFonts.map(font => {
    const formatted = font.replace(/ /g, '+');
    return `<link href="https://fonts.googleapis.com/css2?family=${formatted}:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">`;
  }).join('\n    ');

  let maxElementY = 100;
  let horizontalScroll = false;
  elements.forEach((el) => {
    let estHeight = 30; // fallback if h not set
    if (el.type === 'text') {
      estHeight = el.h || 10;
    } else if (el.type === 'shape') {
      estHeight = el.h || el.w || 30;
    }
    const bottomY = el.y + estHeight;
    if (bottomY > maxElementY) {
      maxElementY = bottomY;
    }
  });

  let minX = 0;
  let maxX = 100;
  elements.forEach((el) => {
    const x = el.x || 0;
    const w = el.w || 0;
    if (x < minX) minX = x;
    if (x + w > maxX) maxX = x + w;
  });

  const elementsHtml = elements.map((el, idx) => {
    const styleParts: string[] = [
      `position: absolute`,
      `left: calc(${el.x} * var(--w-unit))`,
      `top: calc(${el.y} * var(--w-unit))`,
      `width: calc(${el.w} * var(--w-unit))`
    ];

    let transformParts: string[] = [];
    if (el.rotate) transformParts.push(`rotate(${el.rotate}deg)`);
    if (el.rotateX) transformParts.push(`rotateX(${el.rotateX}deg)`);
    if (el.rotateY) transformParts.push(`rotateY(${el.rotateY}deg)`);
    if (el.skewX) transformParts.push(`skewX(${el.skewX}deg)`);
    if (el.skewY) transformParts.push(`skewY(${el.skewY}deg)`);

    if (transformParts.length > 0) {
      styleParts.push(`transform: perspective(600px) ${transformParts.join(' ')}`);
      styleParts.push(`transform-style: preserve-3d`);
      styleParts.push(`backface-visibility: visible`);
    }

    if (el.blendMode && el.blendMode !== 'normal') {
      styleParts.push(`mix-blend-mode: ${el.blendMode}`);
    }

    if (el.borderWidth) {
      styleParts.push(`border: ${el.borderWidth}px ${el.borderStyle || 'solid'} ${el.borderColor || '#ffffff'}`);
    }
    if (el.elementBorderRadius) {
      styleParts.push(`border-radius: ${el.elementBorderRadius}px`);
    }

    const hasShadows = el.shadows && el.shadows.length > 0;
    if (hasShadows) {
      const ds = el.shadows!.map(s => `drop-shadow(${s.x || 0}px ${s.y || 0}px ${s.blur || 0}px ${hexToRgba(s.color || '#000000', s.opacity ?? 0.5)})`).join(' ');
      styleParts.push(`filter: ${ds}`);
    } else if (el.shadowEnable) {
      styleParts.push(`filter: drop-shadow(${el.shadowX || 4}px ${el.shadowY || 4}px ${el.shadowBlur || 8}px ${hexToRgba(el.shadowColor || '#000000', 0.5)})`);
    }

    if (el.opacity !== undefined) {
      styleParts.push(`opacity: ${el.opacity}`);
    }

    // Padding
    if (el.paddingTop) styleParts.push(`padding-top: calc(${el.paddingTop} * var(--w-unit))`);
    if (el.paddingRight) styleParts.push(`padding-right: calc(${el.paddingRight} * var(--w-unit))`);
    if (el.paddingBottom) styleParts.push(`padding-bottom: calc(${el.paddingBottom} * var(--w-unit))`);
    if (el.paddingLeft) styleParts.push(`padding-left: calc(${el.paddingLeft} * var(--w-unit))`);

    let html = '';
    const elementId = el.customId ? el.customId : `el-${idx}`;

    // Wrap with anchor tag if hyperlink is present
    let wrapperStart = '';
    let wrapperEnd = '';
    if (el.hyperlinkType && el.hyperlinkType !== 'none' && el.hyperlink) {
      let targetAttr = el.hyperlinkTarget === '_blank' ? ' target="_blank" rel="noopener noreferrer"' : '';
      let href = el.hyperlink;
      
      if (el.hyperlinkType === 'page') {
        if (!href.endsWith('.html')) href += '.html';
      } else if (el.hyperlinkType === 'anchor') {
        if (!href.startsWith('#')) href = '#' + href;
      }
      
      wrapperStart = `<a href="${href}"${targetAttr} style="text-decoration: none; color: inherit; display: block; width: 100%; height: 100%;">`;
      wrapperEnd = `</a>`;
    }

    if (el.type === 'text') {
      styleParts.push(`font-family: '${el.fontFamily || 'Inter'}', sans-serif`);
      styleParts.push(`font-size: calc(${el.fontSize || 12} * var(--w-unit))`);
      styleParts.push(`font-weight: ${el.fontWeight || '400'}`);
      if (el.fontStyle) styleParts.push(`font-style: ${el.fontStyle}`);
      styleParts.push(`text-align: ${el.textAlign || 'left'}`);
      if (el.tracking) styleParts.push(`letter-spacing: ${el.tracking}em`);
      if (el.leading) styleParts.push(`line-height: ${el.leading}`);

      if (el.fillType === 'gradient') {
        const start = el.gradientColorStart || '#ff007f';
        const end = el.gradientColorEnd || '#7f00ff';
        const angle = el.gradientAngle || 45;
        styleParts.push(`background: linear-gradient(${angle}deg, ${start}, ${end})`);
        styleParts.push(`-webkit-background-clip: text`);
        styleParts.push(`-webkit-text-fill-color: transparent`);
      } else {
        styleParts.push(`color: ${el.color || '#ffffff'}`);
      }
      
      const textRaw = el.content !== undefined ? el.content : (el.text || '');
      const formattedText = textRaw.replace(/\n/g, '<br>');
      html = `<div id="${elementId}" class="zine-element text-element" style="${styleParts.join('; ')}">${wrapperStart}${formattedText}${wrapperEnd}</div>`;
      
    } else if (el.type === 'image') {
      if (el.h) styleParts.push(`height: calc(${el.h} * var(--w-unit))`);
      if (el.aspectRatio) styleParts.push(`aspect-ratio: ${el.aspectRatio}`);
      
      html = `<img id="${elementId}" class="zine-element image-element" src="${el.src}" style="${styleParts.join('; ')}; object-fit: cover;" referrerPolicy="no-referrer" />`;
      if (wrapperStart) {
        html = `<div class="zine-element-wrapper" style="position: absolute; left: calc(${el.x} * var(--w-unit)); top: calc(${el.y} * var(--w-unit)); width: calc(${el.w} * var(--w-unit)); ${el.h ? `height: calc(${el.h} * var(--w-unit));` : ''}">${wrapperStart}<img id="${elementId}" class="zine-element image-element" src="${el.src}" style="${styleParts.filter(s => !s.startsWith('left:') && !s.startsWith('top:') && !s.startsWith('width:') && !s.startsWith('height:') && !s.startsWith('position:')).join('; ')}; object-fit: cover; width: 100%; height: 100%;" referrerPolicy="no-referrer" />${wrapperEnd}</div>`;
      }
      
    } else if (el.type === 'shape') {
      const widthUnits = el.w || 30;
      const heightUnits = el.h || widthUnits;
      styleParts.push(`height: calc(${heightUnits} * var(--w-unit))`);

      let gradientDef = '';
      let fillAttr = el.fillColor || '#ffffff';

      if (el.fillType === 'gradient') {
        const start = el.gradientColorStart || '#ff007f';
        const end = el.gradientColorEnd || '#7f00ff';
        const angle = el.gradientAngle || 45;
        const angleRad = (angle * Math.PI) / 180;
        const x1 = Math.round(50 - Math.cos(angleRad) * 50) + '%';
        const y1 = Math.round(50 + Math.sin(angleRad) * 50) + '%';
        const x2 = Math.round(50 + Math.cos(angleRad) * 50) + '%';
        const y2 = Math.round(50 - Math.sin(angleRad) * 50) + '%';

        gradientDef = `
      <defs>
        <linearGradient id="shape-grad-${idx}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </linearGradient>
      </defs>`;
        fillAttr = `url(#shape-grad-${idx})`;
      } else if (el.fillType === 'radial-gradient') {
        const start = el.gradientColorStart || '#ff007f';
        const end = el.gradientColorEnd || '#7f00ff';
        gradientDef = `
      <defs>
        <radialGradient id="shape-radgrad-${idx}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stop-color="${start}" />
          <stop offset="100%" stop-color="${end}" />
        </radialGradient>
      </defs>`;
        fillAttr = `url(#shape-radgrad-${idx})`;
      } else if (el.fillType === 'image') {
        const imgUrl = el.bgImage || '';
        const imgMode = el.bgImageMode || 'cover';
        let preserveRatio = 'none';
        let patternUnits = 'objectBoundingBox';
        if (imgMode === 'cover') preserveRatio = 'xMidYMid slice';
        else if (imgMode === 'contain') preserveRatio = 'xMidYMid meet';
        else if (imgMode === 'tile') patternUnits = 'userSpaceOnUse';

        gradientDef = `
      <defs>
        <pattern id="shape-img-${idx}" patternUnits="${patternUnits}" width="100%" height="100%">
          <image href="${imgUrl}" width="100%" height="100%" preserveAspectRatio="${preserveRatio}" />
        </pattern>
      </defs>`;
        fillAttr = `url(#shape-img-${idx})`;
      } else if (el.fillType === 'none') {
        fillAttr = 'none';
      }

      let strokeAttr = '';
      if (el.strokeWidth) {
        strokeAttr = `stroke="${el.strokeColor || '#ffffff'}" stroke-width="${el.strokeWidth}"`;
      }

      let svgContent = '';
      const sType = el.shapeType || 'rectangle';
      
      if (sType === 'rectangle') {
        const rx = el.borderRadius ? `rx="${el.borderRadius}%"` : '';
        svgContent = `<rect width="100%" height="100%" fill="${fillAttr}" ${strokeAttr} ${rx} />`;
      } else if (sType === 'circle') {
        svgContent = `<circle cx="50%" cy="50%" r="50%" fill="${fillAttr}" ${strokeAttr} />`;
      } else if (sType === 'triangle') {
        svgContent = `<polygon points="50,0 100,100 0,100" fill="${fillAttr}" ${strokeAttr} />`;
      } else if (sType === 'star') {
        svgContent = `<polygon points="50,5 61,40 98,40 68,62 79,96 50,75 21,96 32,62 2,40 39,40" fill="${fillAttr}" ${strokeAttr} />`;
      } else if (sType === 'heart') {
        svgContent = `<path d="M 50,30 C 50,30 40,0 20,0 C 0,0 0,25 0,25 C 0,55 50,95 50,95 C 50,95 100,55 100,25 C 100,25 100,0 80,0 C 60,0 50,30 50,30 Z" fill="${fillAttr}" ${strokeAttr} />`;
      } else if (sType === 'custom' && el.customSvgPath) {
        svgContent = `<path d="${el.customSvgPath}" fill="${fillAttr}" ${strokeAttr} vector-effect="non-scaling-stroke" />`;
      } else {
        const rx = el.borderRadius ? `rx="${el.borderRadius}%"` : '';
        svgContent = `<rect width="100%" height="100%" fill="${fillAttr}" ${strokeAttr} ${rx} />`;
      }

      html = `<div id="${elementId}" class="zine-element shape-element" style="${styleParts.join('; ')}">${wrapperStart}
        <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none">
          ${gradientDef}
          ${svgContent}
        </svg>${wrapperEnd}
      </div>`;
    }
    return html;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>Zine Output</title>
  ${fontLinks}
  <style>
    :root {
      --w-unit: min(1vw, 3.9px);
    }
    @media (min-width: 390px) {
      :root {
        --w-unit: 3.9px;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: ${backgroundColor};
      font-family: 'Inter', sans-serif;
      overflow-x: hidden;
      overflow-y: auto;
      -webkit-font-smoothing: antialiased;
    }
    .zine-container {
      position: relative;
      width: 100%;
      max-width: 390px;
      min-height: calc(${maxElementY} * var(--w-unit) + 100px);
      margin: 0 auto;
      overflow: hidden;
      background-color: ${backgroundColor};
    }
    .zine-element {
      position: absolute;
    }
    .text-element {
      word-wrap: break-word;
      white-space: pre-wrap;
    }
  </style>
</head>
<body>
  <div class="zine-container">
    ${elementsHtml}
  </div>
</body>
</html>`;
}

export function downloadClientSideHtml(
  elements: ZineElement[],
  backgroundColor: string,
  googleFonts: string[],
  filename: string = 'zine-page.html'
) {
  const htmlContent = generateHtmlString(elements, backgroundColor, googleFonts);
  const blob = new Blob([htmlContent], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
