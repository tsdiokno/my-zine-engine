const fs = require('fs');
const content = fs.readFileSync('src/editor/main.ts', 'utf8');

const telemetryCode = `
// ==========================================
// WIRE-TRACKER DIAGNOSTIC TELEMETRY SYSTEM
// ==========================================
const WireTracker = {
  logAction: (action, details) => {
    console.log(\`%c[ACTION: \${action}]\`, 'color: #3b82f6; font-weight: bold;', details || '');
  },
  logState: (key, value) => {
    console.log(\`%c[STATE: \${key} updated]\`, 'color: #10b981; font-weight: bold;', value);
  },
  logCanvas: (id, msg) => {
    console.log(\`%c[CANVAS: Element ID \${id}]\`, 'color: #f59e0b; font-weight: bold;', msg);
  },
  validateSync: (checkName, expected, actual, el) => {
    if (String(expected) === String(actual) || (expected == null && actual === '')) {
      console.log(\`%c[SYNC VALIDATION: Pass] \${checkName}\`, 'color: #10b981; font-weight: bold;');
    } else {
      console.error(\`%c[SYNC VALIDATION: Fail] \${checkName} | Expected: \${expected}, Actual: \${actual}\`, 'color: #ef4444; font-weight: bold;', el);
    }
  }
};
window.WireTracker = WireTracker;

// Intercept store updates
const originalSet = editorStore.setState;
editorStore.setState = (partial, replace) => {
  const nextState = typeof partial === 'function' ? partial(editorStore.getState()) : partial;
  if (nextState.elements) {
     const diffs = nextState.elements.map((el, i) => {
       const prev = editorStore.getState().elements[i];
       if (JSON.stringify(el) !== JSON.stringify(prev)) return { idx: i, el };
       return null;
     }).filter(Boolean);
     diffs.forEach(d => {
       WireTracker.logState(\`Element \${d.idx}\`, d.el);
     });
  }
  return originalSet(partial, replace);
};
`;

const newContent = content.replace("import { editorStore, CANVAS_BASELINE_WIDTH } from './store';", "import { editorStore, CANVAS_BASELINE_WIDTH } from './store';\n" + telemetryCode);
fs.writeFileSync('src/editor/main.ts', newContent, 'utf8');
