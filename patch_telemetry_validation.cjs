const fs = require('fs');

let mainTs = fs.readFileSync('src/editor/main.ts', 'utf8');

const syncCode = `
    const isLinked = el.linkPadding !== false;
    const lp = document.getElementById('propLinkPadding');
    if (lp) lp.checked = isLinked;
    const grpLink = document.getElementById('propLinkedPaddingGroup');
    const grpIndiv = document.getElementById('propIndividualPaddingGroup');
    if (grpLink) grpLink.style.display = isLinked ? 'flex' : 'none';
    if (grpIndiv) grpIndiv.style.display = isLinked ? 'none' : 'flex';
    
    setInputVal('propPaddingAll', el.paddingTop || 0, 'propPaddingAllVal');
    setInputVal('propPaddingTop', el.paddingTop || 0, 'propPaddingTopVal');
    setInputVal('propPaddingRight', el.paddingRight || 0, 'propPaddingRightVal');
    setInputVal('propPaddingBottom', el.paddingBottom || 0, 'propPaddingBottomVal');
    setInputVal('propPaddingLeft', el.paddingLeft || 0, 'propPaddingLeftVal');
`;

const validationCode = `
    // WIRE-TRACKER: Validate UI Sync
    if (typeof window.WireTracker !== 'undefined' && idx !== null) {
      setTimeout(() => {
        const val = (id) => {
           const el = document.getElementById(id);
           if (!el) return null;
           if (el.type === 'checkbox') return el.checked;
           return el.value;
        };
        const st = editorStore.getState().elements[idx];
        if (!st) return;
        
        WireTracker.validateSync('X Position', st.x, val('propX'), document.getElementById('propX'));
        WireTracker.validateSync('Y Position', st.y, val('propY'), document.getElementById('propY'));
        WireTracker.validateSync('Width', st.w, val('propW'), document.getElementById('propW'));
        WireTracker.validateSync('Opacity', (st.opacity !== undefined ? st.opacity * 100 : 100), val('propOpacity'), document.getElementById('propOpacity'));
        WireTracker.validateSync('Background Image Mode', st.bgImageMode || 'cover', val('propBgImageMode'), document.getElementById('propBgImageMode'));
        WireTracker.validateSync('Hyperlink Type', st.hyperlinkType || 'none', val('propHyperlinkType'), document.getElementById('propHyperlinkType'));
      }, 0);
    }
`;

if (!mainTs.includes('WireTracker.validateSync(')) {
  mainTs = mainTs.replace(syncCode, syncCode + "\\n" + validationCode);
}

fs.writeFileSync('src/editor/main.ts', mainTs, 'utf8');
