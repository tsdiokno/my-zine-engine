const fs = require('fs');
let code = fs.readFileSync('src/editor/exporter.ts', 'utf8');
code = code.replace("`${wrapperStart}`<img", "`${wrapperStart}<img");
code = code.replace("/>` + `${wrapperEnd}", "/>${wrapperEnd}");
fs.writeFileSync('src/editor/exporter.ts', code, 'utf8');
