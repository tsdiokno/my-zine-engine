const fs = require('fs');
let mainTs = fs.readFileSync('src/editor/main.ts', 'utf8');

const telemetryActionLogger = `
    // WIRE-TRACKER: Global UI Event Interceptor
    if (typeof window.WireTracker !== 'undefined') {
      document.body.addEventListener('input', (e) => {
        const target = e.target;
        if (target && target.id && target.id.startsWith('prop')) {
          WireTracker.logAction('Input Changed', \`ID: \${target.id}, Value: \${target.value}\`);
        }
      });
      document.body.addEventListener('click', (e) => {
        const target = e.target;
        if (target && target.id && target.id.startsWith('prop')) {
          WireTracker.logAction('Click / Toggle', \`ID: \${target.id}, Value: \${target.value || target.checked}\`);
        } else if (target && target.tagName === 'BUTTON') {
          WireTracker.logAction('Button Clicked', \`Text: \${target.innerText}, ID: \${target.id}\`);
        }
      });
    }
`;

if (!mainTs.includes('WireTracker: Global UI Event Interceptor')) {
  mainTs = mainTs.replace("function setupFloatingUI() {", telemetryActionLogger + "\\nfunction setupFloatingUI() {");
  fs.writeFileSync('src/editor/main.ts', mainTs, 'utf8');
}
