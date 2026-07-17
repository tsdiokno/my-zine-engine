import express from 'express';
import path from 'path';
import fs from 'fs';
import multer from 'multer';

const app = express();
const PORT = 3000;

// Body parser with 50mb payload limit to support large editor configurations
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Ensure required directories exist
const zineDistDir = path.join(process.cwd(), 'dist');
const zineSourceDir = path.join(process.cwd(), 'zine-dist');
const editorDir = path.join(process.cwd(), 'editor');

if (!fs.existsSync(zineDistDir)) {
  fs.mkdirSync(zineDistDir, { recursive: true });
}
if (!fs.existsSync(zineSourceDir)) {
  fs.mkdirSync(zineSourceDir, { recursive: true });
}
if (!fs.existsSync(editorDir)) {
  fs.mkdirSync(editorDir, { recursive: true });
}

// Helper to resolve and sanitize paths to prevent directory traversal
function getDirForPath(pagePath) {
  let cleanPath = (pagePath || '/').replace(/[\\/]+/g, '/');
  // Remove leading/trailing slashes for directory construction
  cleanPath = cleanPath.split('/').filter(p => p && p !== '..').join('/');
  return path.join(zineDistDir, cleanPath);
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const page = req.query.page || '/';
    const targetDir = getDirForPath(page);
    fs.mkdirSync(targetDir, { recursive: true });
    cb(null, targetDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, 'asset-' + uniqueSuffix + ext);
  }
});
const upload = multer({ storage: storage });

// Initialize home page default layout if nothing exists yet
const homeDir = getDirForPath('/');
const homeStatePath = path.join(homeDir, 'state.json');
if (!fs.existsSync(homeStatePath)) {
  const defaultState = {
    elements: [
      {
        type: 'text',
        x: 10,
        y: 15,
        w: 80,
        fontSize: 9,
        fontFamily: 'Syne',
        fontWeight: '900',
        color: '#ffffff',
        textAlign: 'center',
        blendMode: 'normal',
        text: 'DIGITAL PRINT\nZINE VOL. I'
      },
      {
        type: 'text',
        x: 15,
        y: 40,
        w: 70,
        fontSize: 3.5,
        fontFamily: 'Inter',
        fontWeight: '400',
        color: '#888888',
        textAlign: 'center',
        blendMode: 'normal',
        text: 'This is a mobile-first, spatial vector-locked digital publication. Built with the Fluid Canvas layout engine, the proportions scale perfectly regardless of screen size.'
      },
      {
        type: 'text',
        x: 10,
        y: 70,
        w: 80,
        fontSize: 5,
        fontFamily: 'Syne',
        fontWeight: '700',
        color: '#ff3b30',
        textAlign: 'center',
        blendMode: 'difference',
        text: 'DRAG, DESIGN & PRINT'
      }
    ],
    googleFonts: ['Syne'],
    backgroundColor: '#0a0a0a'
  };

  fs.writeFileSync(homeStatePath, JSON.stringify(defaultState, null, 2));
  fs.writeFileSync(path.join(homeDir, 'index.html'), compileHtml(defaultState.elements, defaultState.googleFonts, defaultState.backgroundColor));
}

// Compiler to generate pixel-perfect vector-locked responsive HTML
function compileHtml(elements = [], googleFonts = [], backgroundColor = '#111111') {
  const fontLinks = (googleFonts || [])
    .map(font => `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;700;800;900&display=swap">`)
    .join('\n  ');

  const elementsHtml = (elements || []).filter(Boolean).map((el, idx) => {
    const styleParts = [
      `position: absolute`,
      `left: calc(${el.x} * var(--w-unit))`,
      `top: calc(${el.y} * var(--w-unit))`,
      `width: calc(${el.w} * var(--w-unit))`
    ];

    // Build transform string for rotation and 3D perspective warp
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

    // Border controls for all elements
    if (el.borderWidth) {
      styleParts.push(`border: ${el.borderWidth}px ${el.borderStyle || 'solid'} ${el.borderColor || '#ffffff'}`);
    }
    if (el.elementBorderRadius) {
      styleParts.push(`border-radius: ${el.elementBorderRadius}px`);
      styleParts.push(`overflow: hidden`);
    }

    // Shadow controls for all elements
    if (el.shadowEnable) {
      const sx = el.shadowX !== undefined ? el.shadowX : 4;
      const sy = el.shadowY !== undefined ? el.shadowY : 4;
      const sblur = el.shadowBlur !== undefined ? el.shadowBlur : 8;
      const scolor = el.shadowColor || '#000000';
      styleParts.push(`filter: drop-shadow(${sx}px ${sy}px ${sblur}px ${scolor})`);
    }

    if (el.type === 'text') {
      styleParts.push(`font-size: calc(${el.fontSize || 4} * var(--w-unit))`);
      styleParts.push(`font-family: '${el.fontFamily || 'Inter'}', sans-serif`);
      styleParts.push(`text-align: ${el.textAlign || 'left'}`);
      styleParts.push(`font-weight: ${el.fontWeight || '400'}`);
      styleParts.push(`white-space: pre-wrap`);
      styleParts.push(`line-height: 1.2`);

      // Letter-spacing and font-kerning
      if (el.tracking !== undefined && el.tracking !== '') {
        styleParts.push(`letter-spacing: ${el.tracking}px`);
      }
      if (el.kerning) {
        styleParts.push(`font-kerning: ${el.kerning}`);
      }

      // Text gradients or solids
      if (el.fillType === 'gradient') {
        const angle = el.gradientAngle || 45;
        const start = el.gradientColorStart || '#ff007f';
        const end = el.gradientColorEnd || '#7f00ff';
        styleParts.push(`background: linear-gradient(${angle}deg, ${start}, ${end})`);
        styleParts.push(`-webkit-background-clip: text`);
        styleParts.push(`-webkit-text-fill-color: transparent`);
      } else {
        styleParts.push(`color: ${el.color || '#ffffff'}`);
      }
      
      const formattedText = (el.text || '').replace(/\n/g, '<br>');
      return `    <div id="element-${idx}" class="zine-element text-element" style="${styleParts.join('; ')}">${formattedText}</div>`;
    } else if (el.type === 'image') {
      if (el.aspectRatio) {
        styleParts.push(`aspect-ratio: ${el.aspectRatio}`);
      }
      return `    <img id="element-${idx}" class="zine-element image-element" src="${el.src}" style="${styleParts.join('; ')}; object-fit: cover;" referrerPolicy="no-referrer" />`;
    } else if (el.type === 'shape') {
      // Shape SVG compiler supporting solid/gradient fills and strokes
      const widthUnits = el.w || 30;
      // Default height ratio or custom height
      const heightUnits = el.h || widthUnits;
      styleParts.push(`height: calc(${heightUnits} * var(--w-unit))`);

      let gradientDef = '';
      let fillAttr = el.fillColor || '#ffffff';

      if (el.fillType === 'gradient') {
        const start = el.gradientColorStart || '#ff007f';
        const end = el.gradientColorEnd || '#7f00ff';
        const angle = el.gradientAngle || 45;
        
        // Convert angle into linear gradient coordinates
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

      return `    <div id="element-${idx}" class="zine-element shape-element" style="${styleParts.join('; ')}">
      <svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="none">${gradientDef}
        ${shapeSvgElement}
      </svg>
    </div>`;
    }
    return '';
  }).join('\n');

  // Check if background color contains gradient
  let containerBackgroundStyle = '';
  if (backgroundColor.includes('gradient')) {
    containerBackgroundStyle = `background: ${backgroundColor};`;
  } else {
    containerBackgroundStyle = `background-color: ${backgroundColor};`;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zine Output</title>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700;900&display=swap">
  ${fontLinks}
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    :root {
      --w-unit: 1vw;
    }
    @media (min-width: 650px) {
      :root {
        --w-unit: 5.5px;
      }
    }
    html, body {
      min-height: 100vh;
      width: 100%;
      margin: 0;
      padding: 0;
      ${containerBackgroundStyle}
      background-attachment: fixed;
      background-size: cover;
    }
    body {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      font-family: 'Inter', system-ui, sans-serif;
      overflow-x: hidden;
    }
    .zine-scroll {
      width: calc(100 * var(--w-unit));
      min-height: 100vh;
      position: relative;
      background: transparent;
      overflow-y: auto;
      overflow-x: hidden;
      padding-bottom: calc(10 * var(--w-unit));
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

// API: Recursively scan directories for compiled index.html pages
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

// GET /api/pages - Scan all pages in the publisher
app.get('/api/pages', (req, res) => {
  try {
    const pagesSet = new Set();
    if (fs.existsSync(zineSourceDir)) {
      scanDirectories(zineSourceDir, zineSourceDir).forEach(p => pagesSet.add(p));
    }
    if (fs.existsSync(zineDistDir)) {
      scanDirectories(zineDistDir, zineDistDir).forEach(p => pagesSet.add(p));
    }
    const pages = Array.from(pagesSet).filter(p => p !== '/editor' && p !== '/editor/' && p !== '/assets' && p !== '/src');
    
    // Sort so root / is always first, then alphabetic
    pages.sort((a, b) => {
      if (a === '/') return -1;
      if (b === '/') return 1;
      return a.localeCompare(b);
    });
    res.json(pages);
  } catch (err) {
    res.status(500).json({ error: 'Failed to scan directories', details: err.message });
  }
});

// GET /api/load-page - Retrieve specific state JSON
app.get('/api/load-page', (req, res) => {
  const pagePath = req.query.path || '/';
  const cleanPath = (pagePath || '/').replace(/[\\/]+/g, '/').split('/').filter(p => p && p !== '..').join('/');
  
  const statePathSrc = path.join(zineSourceDir, cleanPath, 'state.json');
  const statePathDist = path.join(zineDistDir, cleanPath, 'state.json');
  
  let statePath = null;
  if (fs.existsSync(statePathSrc)) {
    statePath = statePathSrc;
  } else if (fs.existsSync(statePathDist)) {
    statePath = statePathDist;
  }

  if (statePath && fs.existsSync(statePath)) {
    try {
      const data = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      res.json(data);
    } catch (err) {
      res.status(500).json({ error: 'Failed to read state.json', details: err.message });
    }
  } else {
    // Return empty canvas defaults
    res.json({
      elements: [],
      googleFonts: [],
      backgroundColor: '#111111'
    });
  }
});

// POST /api/upload - Handle file upload in a page-scoped directory
app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const page = req.query.page || '/';
    const cleanPath = page.replace(/[\\/]+/g, '/').split('/').filter(p => p && p !== '..').join('/');
    
    // Copy uploaded file to the persistent source directory (zine-dist) to avoid deletion on clean builds
    const targetSourceDir = path.join(zineSourceDir, cleanPath);
    fs.mkdirSync(targetSourceDir, { recursive: true });
    fs.copyFileSync(req.file.path, path.join(targetSourceDir, req.file.filename));

    // Return absolute web path (root-relative) so it works in both editor and output pages
    const webPath = cleanPath ? `/${cleanPath}/${req.file.filename}` : `/${req.file.filename}`;
    res.json({ filename: webPath });
  } catch (err) {
    res.status(500).json({ error: 'Failed to process uploaded file copy', details: err.message });
  }
});

// POST /api/save-page - Save page layout data & compile HTML
app.post('/api/save-page', (req, res) => {
  const { pagePath, elements, googleFonts, backgroundColor } = req.body;
  if (!pagePath) {
    return res.status(400).json({ error: 'Missing pagePath' });
  }

  try {
    const cleanPath = (pagePath || '/').replace(/[\\/]+/g, '/').split('/').filter(p => p && p !== '..').join('/');
    const targetDir1 = path.join(zineDistDir, cleanPath);
    const targetDir2 = path.join(zineSourceDir, cleanPath);
    
    // Create folders recursively
    fs.mkdirSync(targetDir1, { recursive: true });
    fs.mkdirSync(targetDir2, { recursive: true });

    // Clean, sanitize, and validate elements to avoid circularity and type mismatches
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
        kerning: el.kerning,
        aspectRatio: el.aspectRatio
      };
    });

    const statePayload = {
      elements: cleanElements,
      googleFonts: googleFonts || [],
      backgroundColor: backgroundColor || '#111111'
    };

    // Save state.json ONLY inside the zineSourceDir (zine-dist) - not inside dist
    fs.writeFileSync(path.join(targetDir2, 'state.json'), JSON.stringify(statePayload, null, 2), 'utf8');

    // Compile & write index.html to both (dist gets index.html only, zine-dist gets index.html and state.json)
    const compiledHtml = compileHtml(statePayload.elements, statePayload.googleFonts, statePayload.backgroundColor);
    fs.writeFileSync(path.join(targetDir1, 'index.html'), compiledHtml, 'utf8');
    fs.writeFileSync(path.join(targetDir2, 'index.html'), compiledHtml, 'utf8');

    // Clean up any old error logs if successful
    if (fs.existsSync(path.join(process.cwd(), 'save-error.txt'))) {
      fs.unlinkSync(path.join(process.cwd(), 'save-error.txt'));
    }

    res.json({ success: true, pagePath });
  } catch (err) {
    fs.writeFileSync(path.join(process.cwd(), 'save-error.txt'), `${err.stack || err.message}\nPayload: ${JSON.stringify(req.body, null, 2)}`, 'utf8');
    res.status(500).json({ error: 'Failed to save page', details: err.message });
  }
});

// Serve the editor workspace statically under /editor
app.use('/editor', express.static(editorDir));

// Serve compiled outputs statically from zine-dist at the root path (/)
app.use(express.static(zineDistDir));

// Also catch-all for zine-dist deep routes if Express static redirects aren't sufficient
app.get('*', (req, res, next) => {
  // If request has extension, skip it
  if (path.extname(req.path)) {
    return next();
  }
  const targetDir = getDirForPath(req.path);
  const indexPath = path.join(targetDir, 'index.html');
  if (fs.existsSync(indexPath)) {
    return res.sendFile(indexPath);
  }
  next();
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Zine Engine running on port ${PORT}`);
  console.log(`Editor URL: http://localhost:${PORT}/editor/`);
  console.log(`Zine URL: http://localhost:${PORT}/`);
});
