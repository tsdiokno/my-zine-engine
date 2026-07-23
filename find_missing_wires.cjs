const fs = require('fs');

const html = fs.readFileSync('editor/index.html', 'utf8');
const main = fs.readFileSync('src/editor/main.ts', 'utf8');

const idRegex = /id="(prop[a-zA-Z0-9]+)"/g;
let match;
const ids = new Set();
while ((match = idRegex.exec(html)) !== null) {
  ids.add(match[1]);
}

const missing = [];
for (const id of ids) {
  if (!main.includes(id) && !id.endsWith('Group') && !id.endsWith('Val') && !id.endsWith('Wrapper') && !id.endsWith('Select') && !id.endsWith('Input') && !id.endsWith('Search') && id !== 'propertiesPlaceholder' && id !== 'propertiesPanel' && id !== 'propertiesContainer') {
    missing.push(id);
  }
}

console.log("Missing generic inputs:", missing);

const shadowIds = [...ids].filter(i => i.startsWith('propShadow'));
console.log("Shadow IDs in HTML:", shadowIds);
const linkIds = [...ids].filter(i => i.startsWith('propLink') || i.startsWith('propHyperlink'));
console.log("Link IDs in HTML:", linkIds);

