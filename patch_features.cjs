const fs = require('fs');

let mainTs = fs.readFileSync('src/editor/main.ts', 'utf8');

// Add Missing Property Bindings
const newBindings = `
  // Image Fill Upload
  const bgImageBtn = document.getElementById('propBgImageUploadBtn');
  const fileUploader = document.getElementById('fileUploader');
  if (bgImageBtn && fileUploader) {
    bgImageBtn.addEventListener('click', () => {
      // Temporarily override the uploader logic for background image
      const oldChange = fileUploader.onchange;
      fileUploader.onchange = async (e) => {
        const target = e.target;
        if (!target.files || target.files.length === 0) return;
        const formData = new FormData();
        formData.append('file', target.files[0]);
        try {
          const res = await fetch(\`/api/upload?page=\${encodeURIComponent(editorStore.getState().activePage || '/')}\`, {
            method: 'POST', body: formData
          });
          const data = await res.json();
          const idx = getActiveIdx();
          if (idx !== null) {
            updateActive({ bgImage: data.filename });
            const input = document.getElementById('propBgImageInput');
            if (input) input.value = data.filename;
          }
        } catch (err) {}
        fileUploader.value = '';
        fileUploader.onchange = oldChange;
      };
      fileUploader.click();
    });
  }

  bindInput('propBgImageInput', 'bgImage');
  bindInput('propBgImageMode', 'bgImageMode');
  bindInput('propSvgPresets', 'customSvgPath');
  bindInput('propCustomSvgPath', 'customSvgPath');

  // Padding
  bindInput('propPaddingAll', 'paddingTop', (v) => parseFloat(v));
  const padAll = document.getElementById('propPaddingAll');
  if (padAll) {
    padAll.addEventListener('input', (e) => {
      const v = parseFloat(e.target.value);
      updateActive({ paddingTop: v, paddingRight: v, paddingBottom: v, paddingLeft: v });
    });
  }
  
  const linkPad = document.getElementById('propLinkPadding');
  if (linkPad) {
    linkPad.addEventListener('change', (e) => {
      const isLinked = e.target.checked;
      document.getElementById('propLinkedPaddingGroup').style.display = isLinked ? 'flex' : 'none';
      document.getElementById('propIndividualPaddingGroup').style.display = isLinked ? 'none' : 'flex';
      updateActive({ linkPadding: isLinked });
    });
  }

  bindInput('propPaddingTop', 'paddingTop', (v) => parseFloat(v));
  bindInput('propPaddingRight', 'paddingRight', (v) => parseFloat(v));
  bindInput('propPaddingBottom', 'paddingBottom', (v) => parseFloat(v));
  bindInput('propPaddingLeft', 'paddingLeft', (v) => parseFloat(v));

  // Hyperlinks
  const hpType = document.getElementById('propHyperlinkType');
  if (hpType) {
    hpType.addEventListener('change', (e) => {
      const v = e.target.value;
      updateActive({ hyperlinkType: v });
      document.getElementById('propLinkPageGroup').style.display = v === 'page' ? 'block' : 'none';
      document.getElementById('propLinkAnchorGroup').style.display = v === 'anchor' ? 'block' : 'none';
      document.getElementById('propLinkExternalGroup').style.display = v === 'external' ? 'block' : 'none';
      document.getElementById('propLinkTargetGroup').style.display = (v !== 'none') ? 'block' : 'none';
    });
  }
  
  bindInput('propLinkPageSelect', 'hyperlink');
  bindInput('propLinkAnchorSelect', 'hyperlink');
  bindInput('propLinkAnchorInput', 'hyperlink');
  bindInput('propLinkExternalInput', 'hyperlink');
  bindInput('propLinkTarget', 'hyperlinkTarget');
  
  // Shadows
  const shadowEnable = document.getElementById('propShadowEnable');
  if (shadowEnable) {
    shadowEnable.addEventListener('change', (e) => {
      const enabled = e.target.checked;
      updateActive({ shadowEnable: enabled });
      document.getElementById('shadowControlsGroup').style.display = enabled ? 'block' : 'none';
    });
  }

  const addShadowBtn = document.getElementById('addShadowBtn');
  if (addShadowBtn) {
    addShadowBtn.addEventListener('click', () => {
      const idx = getActiveIdx();
      if (idx === null) return;
      const el = editorStore.getState().elements[idx];
      const shadows = el.shadows ? [...el.shadows] : [];
      shadows.push({ x: 4, y: 4, blur: 8, color: '#000000', opacity: 0.5 });
      updateActive({ shadows });
      renderShadowList(shadows);
    });
  }

  function renderShadowList(shadows) {
    const container = document.getElementById('shadowListContainer');
    if (!container) return;
    container.innerHTML = '';
    if (!shadows) return;
    
    shadows.forEach((shadow, i) => {
      const shadowDiv = document.createElement('div');
      shadowDiv.style = "background: #18181b; border: 1px solid #3f3f46; border-radius: 6px; padding: 8px;";
      shadowDiv.innerHTML = \`
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span style="font-size: 10px; color: #a1a1aa;">Shadow \${i + 1}</span>
          <span style="font-size: 10px; color: #ef4444; cursor: pointer;" onclick="window.removeShadow(\${i})">Remove</span>
        </div>
        <div class="slider-row">
          <input type="range" class="s-x" min="-50" max="50" value="\${shadow.x}" style="width:40px;">
          <input type="range" class="s-y" min="-50" max="50" value="\${shadow.y}" style="width:40px;">
          <input type="range" class="s-b" min="0" max="50" value="\${shadow.blur}" style="width:40px;">
        </div>
        <div style="display: flex; gap: 4px; margin-top: 4px;">
          <input type="color" class="s-c" value="\${shadow.color}" style="height: 24px; padding: 0;">
          <input type="range" class="s-o" min="0" max="1" step="0.05" value="\${shadow.opacity}">
        </div>
      \`;
      
      const updateS = () => {
        const idx = getActiveIdx();
        if (idx === null) return;
        const el = editorStore.getState().elements[idx];
        const newShadows = [...el.shadows];
        newShadows[i] = {
          x: parseFloat(shadowDiv.querySelector('.s-x').value),
          y: parseFloat(shadowDiv.querySelector('.s-y').value),
          blur: parseFloat(shadowDiv.querySelector('.s-b').value),
          color: shadowDiv.querySelector('.s-c').value,
          opacity: parseFloat(shadowDiv.querySelector('.s-o').value)
        };
        updateActive({ shadows: newShadows });
      };
      
      shadowDiv.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('input', updateS);
      });
      container.appendChild(shadowDiv);
    });
  }
  
  window.removeShadow = (i) => {
    const idx = getActiveIdx();
    if (idx === null) return;
    const el = editorStore.getState().elements[idx];
    const newShadows = [...el.shadows];
    newShadows.splice(i, 1);
    updateActive({ shadows: newShadows });
    renderShadowList(newShadows);
  };
`;

if (!mainTs.includes('// Image Fill Upload')) {
  mainTs = mainTs.replace("bindInput('propElementBorderRadius', 'elementBorderRadius', (v) => parseInt(v, 10) || 0);", "bindInput('propElementBorderRadius', 'elementBorderRadius', (v) => parseInt(v, 10) || 0);\n" + newBindings);
}

// Add state syncer in the store subscriber
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
    
    setInputVal('propBgImageInput', el.bgImage || '');
    setInputVal('propBgImageMode', el.bgImageMode || 'cover');
    setInputVal('propSvgPresets', el.customSvgPath || '');
    setInputVal('propCustomSvgPath', el.customSvgPath || '');
    
    const se = document.getElementById('propShadowEnable');
    if (se) {
      se.checked = el.shadowEnable || false;
      const grp = document.getElementById('shadowControlsGroup');
      if (grp) grp.style.display = el.shadowEnable ? 'block' : 'none';
      if (typeof renderShadowList === 'function') renderShadowList(el.shadows || []);
    }
    
    setInputVal('propHyperlinkType', el.hyperlinkType || 'none');
    const ht = el.hyperlinkType || 'none';
    const hpGroup = document.getElementById('propLinkPageGroup');
    const haGroup = document.getElementById('propLinkAnchorGroup');
    const heGroup = document.getElementById('propLinkExternalGroup');
    const htGroup = document.getElementById('propLinkTargetGroup');
    if (hpGroup) hpGroup.style.display = ht === 'page' ? 'block' : 'none';
    if (haGroup) haGroup.style.display = ht === 'anchor' ? 'block' : 'none';
    if (heGroup) heGroup.style.display = ht === 'external' ? 'block' : 'none';
    if (htGroup) htGroup.style.display = ht !== 'none' ? 'block' : 'none';
    
    if (ht === 'page') setInputVal('propLinkPageSelect', el.hyperlink || '');
    else if (ht === 'anchor') setInputVal('propLinkAnchorInput', el.hyperlink || '');
    else if (ht === 'external') setInputVal('propLinkExternalInput', el.hyperlink || '');
    
    setInputVal('propLinkTarget', el.hyperlinkTarget || '_self');
`;

if (!mainTs.includes("const isLinked = el.linkPadding")) {
  mainTs = mainTs.replace("setInputVal('propLinkTarget', el.hyperlinkTarget || '_self');", syncCode);
}

fs.writeFileSync('src/editor/main.ts', mainTs, 'utf8');
