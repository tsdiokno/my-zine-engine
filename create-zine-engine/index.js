#!/usr/bin/env node

/**
 * create-zine-engine
 * Standalone NPX installer for Zine Engine.
 * Fetches the latest dependency-free pre-compiled release directly from GitHub.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Determine target directory from CLI arguments
const args = process.argv.slice(2);
const folderName = args[0] || 'my-zine-engine';
const targetDir = path.resolve(process.cwd(), folderName);

const repo = 'tsdiokno/my-zine-engine';
const apiUrl = `https://api.github.com/repos/${repo}/releases/latest`;

// Punk ASCII Banner Art
const BANNER = `
\x1b[35m
  Z I N E - E N G I N E  (NPX Bootstrap)
  =============================================================
  ███████╗██╗███╗   ██╗███████╗    ███████╗███╗   ██╗ ██████╗ 
  ╚══███╔╝██║████╗  ██║██╔════╝    ██╔════╝████╗  ██║██╔════╝ 
    ███╔╝ ██║██╔██╗ ██║█████╗      █████╗  ██╔██╗ ██║██║  ███╗
   ███╔╝  ██║██║╚██╗██║██╔══╝      ██╔══╝  ██║╚██╗██║██║   ██║
  ███████╗██║██║ ╚████║███████╗    ███████╗██║ ╚████║╚██████╔╝
  ╚══════╝╚═╝╚═╝  ╚═══╝╚══════╝    ╚══════╝╚═╝  ╚═══╝ ╚═════╝ 
  =============================================================
             [ LOCAL-FIRST . OFFLINE . PUNK PUBLISHING ]
\x1b[0m
`;

console.log(BANNER);

if (fs.existsSync(targetDir)) {
  console.error(`\x1b[31mError: Target directory '${folderName}' already exists. Please choose a different name.\x1b[0m`);
  process.exit(1);
}

console.log(`\x1b[36m[⚙️] Querying GitHub for the latest Zine Engine release...\x1b[0m`);

// Fetch JSON utility that follows redirects recursively
function fetchJSON(url, callback) {
  const options = {
    headers: {
      'User-Agent': 'create-zine-engine-cli',
      'Accept': 'application/vnd.github.v3+json'
    }
  };

  https.get(url, options, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return fetchJSON(res.headers.location, callback);
    }
    if (res.statusCode !== 200) {
      return callback(new Error(`GitHub API returned status code ${res.statusCode}`));
    }

    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        callback(null, JSON.parse(data));
      } catch (err) {
        callback(err);
      }
    });
  }).on('error', (err) => {
    callback(err);
  });
}

// Download file utility that follows redirects recursively
function downloadFile(url, destPath, callback) {
  const options = {
    headers: {
      'User-Agent': 'create-zine-engine-cli'
    }
  };

  https.get(url, options, (res) => {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return downloadFile(res.headers.location, destPath, callback);
    }
    if (res.statusCode !== 200) {
      return callback(new Error(`Server returned status code ${res.statusCode}`));
    }

    const fileStream = fs.createWriteStream(destPath);
    res.pipe(fileStream);

    fileStream.on('finish', () => {
      fileStream.close();
      callback(null);
    });
  }).on('error', (err) => {
    callback(err);
  });
}

// Platform-independent recursive directory tools
function copyFolderRecursive(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }
  const items = fs.readdirSync(src, { withFileTypes: true });
  for (const item of items) {
    const srcPath = path.join(src, item.name);
    const destPath = path.join(dest, item.name);
    if (item.isDirectory()) {
      copyFolderRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function deleteFolderRecursive(dirPath) {
  if (fs.existsSync(dirPath)) {
    fs.rmSync(dirPath, { recursive: true, force: true });
  }
}

// Start pipeline
fetchJSON(apiUrl, (err, release) => {
  if (err) {
    console.error(`\x1b[31mFailed to connect to GitHub API: ${err.message}\x1b[0m`);
    console.log(`\x1b[33mFalling back to standard archive download...\x1b[0m`);
    // Fallback: Use direct zip archive from master branch
    const fallbackUrl = `https://github.com/${repo}/archive/refs/heads/main.zip`;
    proceedWithDownload(fallbackUrl, true);
    return;
  }

  // Find release ZIP asset
  const zipAsset = (release.assets || []).find(asset => asset.name.endsWith('.zip'));
  if (!zipAsset) {
    console.warn(`\x1b[33mWarning: No built release ZIP found. Falling back to repository source zip...\x1b[0m`);
    proceedWithDownload(release.zipball_url, true);
    return;
  }

  proceedWithDownload(zipAsset.browser_download_url, false);
});

function proceedWithDownload(downloadUrl, isSourceZip) {
  const tempZip = path.join(process.cwd(), `temp-zine-engine-${Date.now()}.zip`);
  console.log(`\x1b[36m[⚙️] Downloading release package...\x1b[0m`);

  downloadFile(downloadUrl, tempZip, (err) => {
    if (err) {
      console.error(`\x1b[31mFailed to download release: ${err.message}\x1b[0m`);
      if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      process.exit(1);
    }

    console.log(`\x1b[36m[⚙️] Extracting archives to ./${folderName}...\x1b[0m`);
    const tempExtractDir = path.join(process.cwd(), `temp-extract-${Date.now()}`);
    fs.mkdirSync(tempExtractDir, { recursive: true });

    try {
      // Platform-specific unzipping
      if (process.platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${tempZip}' -DestinationPath '${tempExtractDir}' -Force"`, { stdio: 'ignore' });
      } else {
        execSync(`unzip -q "${tempZip}" -d "${tempExtractDir}"`, { stdio: 'ignore' });
      }

      // Structure restoration & flattening
      // Release output creates 'Zine-Engine-Release' directory. If source zip, it creates repo-name-commit directory.
      const extractedItems = fs.readdirSync(tempExtractDir);
      const mainFolder = extractedItems.find(item => {
        return fs.statSync(path.join(tempExtractDir, item)).isDirectory();
      });

      if (mainFolder) {
        const sourcePath = path.join(tempExtractDir, mainFolder);
        copyFolderRecursive(sourcePath, targetDir);
      } else {
        copyFolderRecursive(tempExtractDir, targetDir);
      }

      console.log(`\x1b[32m[✓] Extracted successfully!\x1b[0m`);
    } catch (e) {
      console.error(`\x1b[31mFailed to extract ZIP. Please ensure you have extraction utilities available (unzip on Unix or PowerShell on Windows).\x1b[0m`);
      console.error(e.message);
      // Clean up before exit
      if (fs.existsSync(tempZip)) fs.unlinkSync(tempZip);
      deleteFolderRecursive(tempExtractDir);
      process.exit(1);
    }

    // Clean up temporary artifacts
    try {
      fs.unlinkSync(tempZip);
      deleteFolderRecursive(tempExtractDir);
    } catch (cleanErr) {
      // Non-blocking cleanup warning
    }

    // Success Outro
    console.log(`\x1b[32m\n  📥 ZINE ENGINE BOOTSTRAP COMPLETE!\x1b[0m`);
    console.log(`  --------------------------------------------`);
    console.log(`  Your offline publishing engine is ready.`);
    console.log(`  No npm packages are required for the tool to function.`);
    console.log(`\n  \x1b[35m👉 RUN THESE COMMANDS TO START DESIGNING:\x1b[0m`);
    console.log(`     cd \x1b[33m${folderName}\x1b[0m`);
    console.log(`     \x1b[32mnode run.js\x1b[0m`);
    console.log(`\n  Then open: \x1b[36mhttp://localhost:3000/editor/\x1b[0m in your browser.`);
    console.log(`  ============================================\n`);
  });
}
