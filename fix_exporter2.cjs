const fs = require('fs');
let code = fs.readFileSync('src/editor/exporter.ts', 'utf8');

const badLine = 'html = `<div class="zine-element-wrapper" style="position: absolute; left: calc(${el.x} * var(--w-unit)); top: calc(${el.y} * var(--w-unit)); width: calc(${el.w} * var(--w-unit)); ${el.h ? `height: calc(${el.h} * var(--w-unit));` : \'\'}">${wrapperStart}`<img id="${elementId}" class="zine-element image-element" src="${el.src}" style="${styleParts.filter(s => !s.startsWith(\'left:\') && !s.startsWith(\'top:\') && !s.startsWith(\'width:\') && !s.startsWith(\'height:\') && !s.startsWith(\'position:\')).join(\'; \')}; object-fit: cover; width: 100%; height: 100%;" referrerPolicy="no-referrer" />${wrapperEnd}</div>`;';

const goodLine = "html = `<div class=\"zine-element-wrapper\" style=\"position: absolute; left: calc(${el.x} * var(--w-unit)); top: calc(${el.y} * var(--w-unit)); width: calc(${el.w} * var(--w-unit)); ${el.h ? `height: calc(${el.h} * var(--w-unit));` : ''}\">${wrapperStart}<img id=\"${elementId}\" class=\"zine-element image-element\" src=\"${el.src}\" style=\"${styleParts.filter(s => !s.startsWith('left:') && !s.startsWith('top:') && !s.startsWith('width:') && !s.startsWith('height:') && !s.startsWith('position:')).join('; ')}; object-fit: cover; width: 100%; height: 100%;\" referrerPolicy=\"no-referrer\" />${wrapperEnd}</div>`;";

code = code.replace(badLine, goodLine);
fs.writeFileSync('src/editor/exporter.ts', code, 'utf8');
