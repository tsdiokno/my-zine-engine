const fs = require('fs');

let mainTs = fs.readFileSync('src/editor/main.ts', 'utf8');

const heightFix = `
    const sh = document.getElementById('shapeHeightProp');
    if (sh) {
      if (el.type === 'shape' || el.type === 'image' || el.type === 'frame') {
        sh.style.display = 'block';
        setInputVal('propH', el.h || el.w || 30, 'propHVal');
      } else {
        sh.style.display = 'none';
      }
    }
`;

if (!mainTs.includes("const sh = document.getElementById('shapeHeightProp');")) {
  mainTs = mainTs.replace("setInputVal('propHyperlinkType', el.hyperlinkType || 'none');", heightFix + "\\n    setInputVal('propHyperlinkType', el.hyperlinkType || 'none');");
  
  // Also we need to bind the input propH
  const bindCode = `
  bindInput('propH', 'h', (v) => parseFloat(v) || 0);
  bindInput('propShadowEnable', 'shadowEnable', null, true);
  `;
  mainTs = mainTs.replace("bindInput('propW', 'w',", bindCode + "\\n  bindInput('propW', 'w',");
  
  fs.writeFileSync('src/editor/main.ts', mainTs, 'utf8');
}
