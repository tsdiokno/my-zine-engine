import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
const editorSourceDir = path.join(process.cwd(), 'editor');
const zineDistDir = path.join(process.cwd(), 'zine-dist');

console.log('Starting custom Zine build process...');

// Ensure dist folder exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
}

// Recursive copy helper
function copyFolderRecursiveSync(source, target) {
  let files = [];

  const targetFolder = target;
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true });
  }

  if (fs.lstatSync(source).isDirectory()) {
    files = fs.readdirSync(source);
    files.forEach(function (file) {
      if (file === 'state.json') {
        return; // Skip copying state.json to dist directory!
      }
      const curSource = path.join(source, file);
      const curTarget = path.join(targetFolder, file);
      if (fs.lstatSync(curSource).isDirectory()) {
        copyFolderRecursiveSync(curSource, curTarget);
      } else {
        fs.copyFileSync(curSource, curTarget);
      }
    });
  }
}

// Carry over any zines or uploads from 'zine-dist' to 'dist' to ensure zero data loss
if (fs.existsSync(zineDistDir)) {
  console.log('Carrying over existing content from zine-dist to dist...');
  copyFolderRecursiveSync(zineDistDir, distDir);
}

// Copy the editor folder to dist/editor
const distEditorDir = path.join(distDir, 'editor');
if (fs.existsSync(editorSourceDir)) {
  console.log('Copying editor workspace to dist/editor...');
  copyFolderRecursiveSync(editorSourceDir, distEditorDir);
}

console.log('Build completed successfully!');
