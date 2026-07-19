/**
 * Zine Engine - Zero-Dependency Native Runtime Server
 * Designed for Zinesters and Artists. No npm packages or npm install required.
 * Simply run: node run.js
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Resolve directories relative to where run.js is executed
const zineDistDir = path.join(process.cwd(), 'zine-dist');
// Check if core-editor exists (distribution structure), otherwise fallback to local dev folders
const editorDir = fs.existsSync(path.join(process.cwd(), 'core-editor'))
  ? path.join(process.cwd(), 'core-editor')
  : process.cwd();

// Ensure zine-dist exists
if (!fs.existsSync(zineDistDir)) {
  fs.mkdirSync(zineDistDir, { recursive: true });
}

// MIME types lookup helper
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Helper to sanitize page paths and resolve to a clean directory in zine-dist
function getDirForPath(pagePath) {
  let cleanPath = (pagePath || '/').replace(/[\\/]+/g, '/');
  // Strip parent directories to block traversal attacks
  cleanPath = cleanPath.split('/').filter(p => p && p !== '..').join('/');
  return path.join(zineDistDir, cleanPath);
}

// Recursively scan directories for compiled index.html pages
function scanDirectories(dir, baseDir, results = []) {
  if (!fs.existsSync(dir)) return results;
  const items = fs.readdirSync(dir, { withFileTypes: true });
  let hasIndex = false;

  for (const item of items) {
    if (item.name === 'index.html' && item.isFile()) {
      hasIndex = true;
    }
  }

  if (hasIndex) {
    const relativePath = path.relative(baseDir, dir);
    let cleanPath = '/' + relativePath.replace(/\\/g, '/');
    if (cleanPath === '//' || cleanPath === '/') {
      cleanPath = '/';
    } else {
      cleanPath = cleanPath.replace(/\/+$/, '');
    }
    results.push(cleanPath);
  }

  for (const item of items) {
    if (item.isDirectory()) {
      scanDirectories(path.join(dir, item.name), baseDir, results);
    }
  }

  return results;
}

// Binary Multipart Form-Data Parser (Standard HTTP uploads with no dependencies)
function parseMultipart(bodyBuffer, contentType) {
  const boundaryMatch = contentType.match(/boundary=(.+)/);
  if (!boundaryMatch) return null;
  const boundary = '--' + boundaryMatch[1];
  const boundaryBuf = Buffer.from(boundary);
  const parts = [];

  let index = bodyBuffer.indexOf(boundaryBuf);
  while (index !== -1) {
    const nextIndex = bodyBuffer.indexOf(boundaryBuf, index + boundaryBuf.length);
    if (nextIndex === -1) break;

    // Slice out the content between boundaries
    const partData = bodyBuffer.slice(index + boundaryBuf.length, nextIndex);
    
    // Headers and body are separated by \r\n\r\n
    const headerEndIndex = partData.indexOf(Buffer.from('\r\n\r\n'));
    if (headerEndIndex !== -1) {
      const headersStr = partData.slice(0, headerEndIndex).toString('utf8');
      // Strip leading \r\n\r\n and trailing \r\n from boundary ending
      const content = partData.slice(headerEndIndex + 4, partData.length - 2);

      const filenameMatch = headersStr.match(/filename="([^"]+)"/);
      const nameMatch = headersStr.match(/name="([^"]+)"/);

      parts.push({
        headers: headersStr,
        name: nameMatch ? nameMatch[1] : null,
        filename: filenameMatch ? filenameMatch[1] : null,
        content: content
      });
    }
    index = nextIndex;
  }
  return parts;
}

function getRelativeHref(currentPath, targetPath) {
  if (!targetPath) return '';
  if (targetPath.match(/^(https?:\/\/|mailto:|tel:|#)/i)) {
    return targetPath;
  }
  const current = currentPath === '/' ? '' : currentPath.replace(/^\//, '').replace(/\/$/, '');
  const target = targetPath === '/' ? '' : targetPath.replace(/^\//, '').replace(/\/$/, '');
  if (current === target) {
    return 'index.html';
  }
  const currentSegments = current ? current.split('/') : [];
  const depth = currentSegments.length;
  let prefix = '';
  for (let i = 0; i < depth; i++) {
    prefix += '../';
  }
  if (!target) {
    return prefix + 'index.html';
  } else {
    return prefix + target + '/index.html';
  }
}

// Compiler to generate pixel-perfect vector-locked responsive HTML
function compileHtml(elements = [], googleFonts = [], backgroundColor = '#111111', pagePath = '/', canvasX = 50, horizontalScroll = false) {
  const fontLinks = (googleFonts || [])
    .map(font => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;700;800;900&display=swap">`)
    .join('\n  ');

  let maxElementY = 100;
  (elements || []).forEach(el => {
    if (!el) return;
    let estHeight = 30;
    if (el.type === 'text') {
      estHeight = (el.fontSize || 4) * 3;
    } else if (el.type === 'shape') {
      estHeight = el.h || el.w || 30;
    }
    const bottomY = parseFloat(el.y) + estHeight;
    if (bottomY > maxElementY) {
      maxElementY = bottomY;
    }
  });

  const elementsHtml = (elements || []).filter(Boolean).map((el, idx) => {
    const styleParts = [
      `position: absolute`,
      `left: calc(${el.x} * var(--w-unit))`,
      `top: calc(${el.y} * var(--w-unit))`,
      `width: calc(${el.w} * var(--w-unit))`
    ];

    let transformParts = [];
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
      styleParts.push(`overflow: hidden`);
    }

    if (el.opacity !== undefined && el.opacity !== null) {
      styleParts.push(`opacity: ${Number(el.opacity) / 100}`);
    }

    if (el.shadowEnable) {
      if (el.shadows && el.shadows.length > 0) {
        const shadowFilters = el.shadows.map(s => {
          const sx = s.x !== undefined ? s.x : 4;
          const sy = s.y !== undefined ? s.y : 4;
          const sblur = s.blur !== undefined ? s.blur : 8;
          const scolor = s.color || '#000000';
          const sopacity = s.opacity !== undefined ? s.opacity : 1;
          
          const hex = scolor.replace('#', '');
          let r = 0, g = 0, b = 0;
          if (hex.length === 3) {
            r = parseInt(hex[0] + hex[0], 16) || 0;
            g = parseInt(hex[1] + hex[1], 16) || 0;
            b = parseInt(hex[2] + hex[2], 16) || 0;
          } else if (hex.length === 6) {
            r = parseInt(hex.substring(0, 2), 16) || 0;
            g = parseInt(hex.substring(2, 4), 16) || 0;
            b = parseInt(hex.substring(4, 6), 16) || 0;
          }
          const rgbaColor = `rgba(${r}, ${g}, ${b}, ${sopacity})`;
          return `drop-shadow(${sx}px ${sy}px ${sblur}px ${rgbaColor})`;
        }).join(' ');
        styleParts.push(`filter: ${shadowFilters}`);
      } else {
        const sx = el.shadowX !== undefined ? el.shadowX : 4;
        const sy = el.shadowY !== undefined ? el.shadowY : 4;
        const sblur = el.shadowBlur !== undefined ? el.shadowBlur : 8;
        const scolor = el.shadowColor || '#000000';
        styleParts.push(`filter: drop-shadow(${sx}px ${sy}px ${sblur}px ${scolor})`);
      }
    }

    let html = '';
    const elementId = el.customId || `element-${idx}`;

    if (el.type === 'text') {
      styleParts.push(`font-size: calc(${el.fontSize || 4} * var(--w-unit))`);
      styleParts.push(`font-family: '${el.fontFamily || 'Inter'}', sans-serif`);
      styleParts.push(`text-align: ${el.textAlign || 'left'}`);
      styleParts.push(`font-weight: ${el.fontWeight || '400'}`);
      styleParts.push(`white-space: pre-wrap`);
      styleParts.push(`line-height: ${el.leading !== undefined && el.leading !== '' ? el.leading : 1.2}`);

      // Padding for text elements
      if (el.paddingTop !== undefined) {
        styleParts.push(`padding-top: calc(${el.paddingTop} * var(--w-unit))`);
      }
      if (el.paddingRight !== undefined) {
        styleParts.push(`padding-right: calc(${el.paddingRight} * var(--w-unit))`);
      }
      if (el.paddingBottom !== undefined) {
        styleParts.push(`padding-bottom: calc(${el.paddingBottom} * var(--w-unit))`);
      }
      if (el.paddingLeft !== undefined) {
        styleParts.push(`padding-left: calc(${el.paddingLeft} * var(--w-unit))`);
      }

      if (el.tracking !== undefined && el.tracking !== '') {
        styleParts.push(`letter-spacing: ${el.tracking}px`);
      }

      if (el.fillType === 'gradient') {
        const angle = el.gradientAngle || 45;
        const start = el.gradientColorStart || '#ff007f';
        const end = el.gradientColorEnd || '#7f00ff';
        styleParts.push(`background: linear-gradient(${angle}deg, ${start}, ${end})`);
        styleParts.push(`-webkit-background-clip: text`);
        styleParts.push(`-webkit-text-fill-color: transparent`);
      } else if (el.fillType === 'radial-gradient') {
        const start = el.gradientColorStart || '#ff007f';
        const end = el.gradientColorEnd || '#7f00ff';
        styleParts.push(`background: radial-gradient(circle, ${start}, ${end})`);
        styleParts.push(`-webkit-background-clip: text`);
        styleParts.push(`-webkit-text-fill-color: transparent`);
      } else {
        styleParts.push(`color: ${el.color || '#ffffff'}`);
      }
      
      const formattedText = (el.text || '').replace(/\n/g, '<br>');
      html = `    <div id="${elementId}" class="zine-element text-element" style="${styleParts.join('; ')}">${formattedText}</div>`;
    } else if (el.type === 'image') {
      if (el.aspectRatio) {
        styleParts.push(`aspect-ratio: ${el.aspectRatio}`);
      }
      html = `    <img id="${elementId}" class="zine-element image-element" src="${el.src}" style="${styleParts.join('; ')}; object-fit: cover;" referrerPolicy="no-referrer" />`;
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

        if (imgMode === 'cover') {
          preserveRatio = 'xMidYMid slice';
        } else if (imgMode === 'contain') {
          preserveRatio = 'xMidYMid meet';
        } else if (imgMode === 'tile') {
          patternUnits = 'userSpaceOnUse';
          preserveRatio = 'none';
        }

        if (patternUnits === 'userSpaceOnUse') {
          gradientDef = `
      <defs>
        <pattern id="shape-img-${idx}" width="40" height="40" patternUnits="userSpaceOnUse">
          <image href="${imgUrl}" x="0" y="0" width="40" height="40" preserveAspectRatio="${preserveRatio}" />
        </pattern>
      </defs>`;
        } else {
          gradientDef = `
      <defs>
        <pattern id="shape-img-${idx}" width="1" height="1" patternContentUnits="objectBoundingBox">
          <image href="${imgUrl}" x="0" y="0" width="1" height="1" preserveAspectRatio="${preserveRatio}" />
        </pattern>
      </defs>`;
        }
        fillAttr = `url(#shape-img-${idx})`;
      }

      const strokeAttr = el.strokeColor || 'none';
      const strokeWidthAttr = el.strokeWidth || 0;
      const shapeType = el.shapeType || 'circle';

      let shapeSvgElement = '';
      if (shapeType === 'circle') {
        shapeSvgElement = `<circle cx="50" cy="50" r="${48 - strokeWidthAttr/2}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidthAttr}" />`;
      } else if (shapeType === 'ellipse') {
        shapeSvgElement = `<ellipse cx="50" cy="50" rx="${48 - strokeWidthAttr/2}" ry="${33 - strokeWidthAttr/2}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidthAttr}" />`;
      } else if (shapeType === 'square' || shapeType === 'rect') {
        const rx = el.borderRadius || 0;
        shapeSvgElement = `<rect x="${strokeWidthAttr/2 + 1}" y="${strokeWidthAttr/2 + 1}" width="${98 - strokeWidthAttr}" height="${98 - strokeWidthAttr}" rx="${rx}" ry="${rx}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidthAttr}" />`;
      } else if (shapeType === 'triangle') {
        shapeSvgElement = `<polygon points="50,${strokeWidthAttr + 2} ${98 - strokeWidthAttr},${98 - strokeWidthAttr} ${strokeWidthAttr + 2},${98 - strokeWidthAttr}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidthAttr}" />`;
      } else if (shapeType === 'star') {
        shapeSvgElement = `<polygon points="50,5 64,36 98,36 70,57 81,91 50,70 19,91 30,57 2,36 36,36" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidthAttr}" />`;
      } else if (shapeType === 'custom-svg') {
        const pathData = el.customSvgPath || 'M 10,50 Q 25,25 50,50 T 90,50';
        shapeSvgElement = `<path d="${pathData}" fill="${fillAttr}" stroke="${strokeAttr}" stroke-width="${strokeWidthAttr}" stroke-linecap="round" stroke-linejoin="round" />`;
      }

      html = `    <div id="${elementId}" class="zine-element shape-element" style="${styleParts.join('; ')}">
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">${gradientDef}
        ${shapeSvgElement}
      </svg>
    </div>`;
    }

    if (html && el.hyperlink) {
      const relHref = getRelativeHref(pagePath, el.hyperlink);
      const targetAttr = el.hyperlinkTarget === '_blank' ? ' target="_blank"' : '';
      return `    <a href="${relHref}"${targetAttr} style="display: contents; text-decoration: none; color: inherit; outline: none;">
    ${html.trim()}
    </a>`;
    }

    return html;
  }).join('\n');

  let containerBackgroundStyle = (backgroundColor.includes('gradient') || backgroundColor.includes('url('))
    ? `background: ${backgroundColor};`
    : `background-color: ${backgroundColor};`;

  return `<!DOCTYPE html>
<html lang="en" style="scroll-behavior: smooth;">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zine Output</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap">
  ${fontLinks}
  <style>
    :root {
      --w-unit: 1vw;
    }
    @media (min-width: 768px) {
      :root {
        --w-unit: 3.9px; /* Desktop lock height to 390px content viewport width standard */
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    html, body {
      width: 100%;
      min-height: 100vh;
      margin: 0;
      padding: 0;
      ${containerBackgroundStyle}
      background-attachment: fixed;
      background-size: cover;
      overflow-x: ${horizontalScroll ? 'auto' : 'hidden'};
    }
    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      font-family: 'Inter', system-ui, sans-serif;
      overflow-x: ${horizontalScroll ? 'auto' : 'hidden'};
      overflow-y: auto;
    }
    .zine-scroll {
      width: calc(100 * var(--w-unit));
      height: calc(${maxElementY} * var(--w-unit));
      min-height: 100vh;
      position: relative;
      background: transparent;
      overflow: visible;
      padding-bottom: calc(10 * var(--w-unit));
    }
    @media (min-width: 768px) {
      body {
        display: block;
        position: relative;
      }
      .zine-scroll {
        position: relative;
        left: calc(${canvasX} * (100% - 390px) / 100);
      }
    }
    .zine-element {
      user-select: none;
      word-wrap: break-word;
    }
  </style>
</head>
<body>
  <div class="zine-scroll">
${elementsHtml}
  </div>
</body>
</html>`;
}

// Create the Server
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. GET /api/pages - Scan directory for zine-dist sub-folders containing index.html
  if (req.method === 'GET' && pathname === '/api/pages') {
    try {
      const pagesSet = new Set();
      if (fs.existsSync(zineDistDir)) {
        scanDirectories(zineDistDir, zineDistDir).forEach(p => pagesSet.add(p));
      }
      const pages = Array.from(pagesSet).filter(p => p !== '/editor' && p !== '/editor/' && p !== '/assets');
      pages.sort((a, b) => {
        if (a === '/') return -1;
        if (b === '/') return 1;
        return a.localeCompare(b);
      });

      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(pages));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Failed to scan pages', details: err.message }));
    }
  }

  // 2. GET /api/load-page - Retrieve specific state JSON
  if (req.method === 'GET' && pathname === '/api/load-page') {
    const pagePath = parsedUrl.searchParams.get('path') || '/';
    const cleanDir = getDirForPath(pagePath);
    const statePath = path.join(cleanDir, 'state.json');

    if (fs.existsSync(statePath)) {
      try {
        const data = fs.readFileSync(statePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(data);
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Failed to read state.json', details: err.message }));
      }
    } else {
      // Empty Canvas default state
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        elements: [],
        googleFonts: [],
        backgroundColor: '#111111'
      }));
    }
  }

  // 3. POST /api/upload - Handle binary multipart upload
  if (req.method === 'POST' && pathname === '/api/upload') {
    const page = parsedUrl.searchParams.get('page') || '/';
    const cleanDir = getDirForPath(page);
    fs.mkdirSync(cleanDir, { recursive: true });

    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyBuffer = Buffer.concat(chunks);
        const contentType = req.headers['content-type'] || '';
        const parts = parseMultipart(bodyBuffer, contentType);

        if (!parts || parts.length === 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Failed to parse file or boundary missing' }));
        }

        const filePart = parts.find(p => p.filename);
        if (!filePart) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'No file found in payload' }));
        }

        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(filePart.filename) || '.png';
        const newFilename = 'asset-' + uniqueSuffix + ext;
        const targetPath = path.join(cleanDir, newFilename);

        fs.writeFileSync(targetPath, filePart.content);

        // Build root-relative web path
        const pageRelative = page.replace(/[\\/]+/g, '/').split('/').filter(p => p && p !== '..').join('/');
        const webPath = pageRelative ? `/${pageRelative}/${newFilename}` : `/${newFilename}`;

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ filename: webPath }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Failed to write file', details: err.message }));
      }
    });
    return;
  }

  // 4. POST /api/save-page - Save page JSON layout and write compiled HTML
  if (req.method === 'POST' && pathname === '/api/save-page') {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => {
      try {
        const bodyStr = Buffer.concat(chunks).toString('utf8');
        const { pagePath, elements, googleFonts, backgroundColor, canvasX, horizontalScroll } = JSON.parse(bodyStr);

        if (!pagePath) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing pagePath' }));
        }

        const cleanDir = getDirForPath(pagePath);
        fs.mkdirSync(cleanDir, { recursive: true });

        // Build clean sanitised element state
        const cleanElements = (elements || []).filter(Boolean).map(el => {
          return {
            type: el.type,
            x: el.x !== undefined ? Number(el.x) : 0,
            y: el.y !== undefined ? Number(el.y) : 0,
            w: el.w !== undefined ? Number(el.w) : 0,
            h: el.h !== undefined ? Number(el.h) : 0,
            text: el.text || '',
            src: el.src || '',
            fontSize: el.fontSize !== undefined ? Number(el.fontSize) : undefined,
            fontFamily: el.fontFamily,
            fontWeight: el.fontWeight,
            color: el.color,
            textAlign: el.textAlign,
            blendMode: el.blendMode,
            rotate: el.rotate !== undefined ? Number(el.rotate) : undefined,
            rotateX: el.rotateX !== undefined ? Number(el.rotateX) : undefined,
            rotateY: el.rotateY !== undefined ? Number(el.rotateY) : undefined,
            skewX: el.skewX !== undefined ? Number(el.skewX) : undefined,
            skewY: el.skewY !== undefined ? Number(el.skewY) : undefined,
            fillType: el.fillType,
            fillColor: el.fillColor,
            gradientColorStart: el.gradientColorStart,
            gradientColorEnd: el.gradientColorEnd,
            gradientAngle: el.gradientAngle !== undefined ? Number(el.gradientAngle) : undefined,
            strokeColor: el.strokeColor,
            strokeWidth: el.strokeWidth !== undefined ? Number(el.strokeWidth) : undefined,
            borderRadius: el.borderRadius !== undefined ? Number(el.borderRadius) : undefined,
            elementBorderRadius: el.elementBorderRadius !== undefined ? Number(el.elementBorderRadius) : undefined,
            borderColor: el.borderColor,
            borderStyle: el.borderStyle,
            borderWidth: el.borderWidth !== undefined ? Number(el.borderWidth) : undefined,
            shadowEnable: !!el.shadowEnable,
            shadowColor: el.shadowColor,
            shadowBlur: el.shadowBlur !== undefined ? Number(el.shadowBlur) : undefined,
            shadowX: el.shadowX !== undefined ? Number(el.shadowX) : undefined,
            shadowY: el.shadowY !== undefined ? Number(el.shadowY) : undefined,
            tracking: el.tracking !== undefined ? String(el.tracking) : undefined,
            leading: el.leading !== undefined ? Number(el.leading) : undefined,
            aspectRatio: el.aspectRatio,
            bgImage: el.bgImage,
            bgImageMode: el.bgImageMode,
            opacity: el.opacity !== undefined && el.opacity !== null ? Number(el.opacity) : undefined,
            shadows: el.shadows ? el.shadows.map(s => ({
              x: s.x !== undefined ? Number(s.x) : 4,
              y: s.y !== undefined ? Number(s.y) : 4,
              blur: s.blur !== undefined ? Number(s.blur) : 8,
              color: s.color || '#000000',
              opacity: s.opacity !== undefined ? Number(s.opacity) : 1
            })) : undefined,
            linkPadding: el.linkPadding !== undefined ? !!el.linkPadding : undefined,
            paddingTop: el.paddingTop !== undefined ? Number(el.paddingTop) : undefined,
            paddingRight: el.paddingRight !== undefined ? Number(el.paddingRight) : undefined,
            paddingBottom: el.paddingBottom !== undefined ? Number(el.paddingBottom) : undefined,
            paddingLeft: el.paddingLeft !== undefined ? Number(el.paddingLeft) : undefined,
            customId: el.customId !== undefined ? String(el.customId) : undefined,
            hyperlink: el.hyperlink !== undefined ? String(el.hyperlink) : undefined,
            hyperlinkTarget: el.hyperlinkTarget !== undefined ? String(el.hyperlinkTarget) : undefined
          };
        });

        const statePayload = {
          elements: cleanElements,
          googleFonts: googleFonts || [],
          backgroundColor: backgroundColor || '#111111',
          canvasX: canvasX !== undefined ? Number(canvasX) : 50,
          horizontalScroll: horizontalScroll !== undefined ? !!horizontalScroll : false
        };

        // Write state.json
        fs.writeFileSync(path.join(cleanDir, 'state.json'), JSON.stringify(statePayload, null, 2), 'utf8');

        // Compile HTML
        const compiledHtml = compileHtml(
          statePayload.elements,
          statePayload.googleFonts,
          statePayload.backgroundColor,
          pagePath,
          statePayload.canvasX,
          statePayload.horizontalScroll
        );
        fs.writeFileSync(path.join(cleanDir, 'index.html'), compiledHtml, 'utf8');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ success: true, pagePath }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Failed to save page', details: err.message }));
      }
    });
    return;
  }

  // 5. STATIC FILES SERVING
  let relativeFilePath = pathname;

  // Editor route
  if (pathname.startsWith('/editor')) {
    // If request is exactly /editor or /editor/, serve index.html
    if (pathname === '/editor' || pathname === '/editor/') {
      relativeFilePath = '/editor/index.html';
    }
    
    // Resolve inside editorDir
    const localPath = path.join(editorDir, relativeFilePath);
    if (fs.existsSync(localPath) && fs.statSync(localPath).isFile()) {
      const ext = path.extname(localPath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      return fs.createReadStream(localPath).pipe(res);
    }
  }

  // Zine distribution files
  const zineLocalPath = path.join(zineDistDir, relativeFilePath);
  if (fs.existsSync(zineLocalPath) && fs.statSync(zineLocalPath).isFile()) {
    const ext = path.extname(zineLocalPath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    return fs.createReadStream(zineLocalPath).pipe(res);
  }

  // Fallback deep routing for zines pages without file extension (e.g., /about -> /about/index.html)
  if (!path.extname(relativeFilePath)) {
    const deepIndexDir = getDirForPath(relativeFilePath);
    const deepIndexPath = path.join(deepIndexDir, 'index.html');
    if (fs.existsSync(deepIndexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return fs.createReadStream(deepIndexPath).pipe(res);
    }
  }

  // Not Found
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

// Start Server
server.listen(PORT, '0.0.0.0', () => {
  console.log(`\x1b[35m`);
  console.log(`  Z I N E - E N G I N E  (Dependency-Free Node.js Server)`);
  console.log(`  ======================================================`);
  console.log(`  Running offline and off-the-grid on port ${PORT}`);
  console.log(`  - Editor: http://localhost:${PORT}/editor/`);
  console.log(`  - Zines:  http://localhost:${PORT}/`);
  console.log(`\x1b[0m`);
});
